-- ===========================================================================
-- APPLY NOW: Run this in Supabase SQL Editor (one-time)
-- Project: trmleuxyneucveymqmod
-- ===========================================================================
-- This file bundles the 3 pending migrations that need to be applied to the
-- production Supabase database. Run it in:
--   Supabase Dashboard > SQL Editor > New Query > paste > Run
--
-- All statements are idempotent (safe to re-run).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Migration 1: ensure_realtime_tables (20260606000000)
-- Purpose: Make sure critical tables are in the supabase_realtime publication
--          so WebSocket subscriptions work for bookings/locations/etc.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
    RAISE NOTICE 'Added bookings to supabase_realtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
    RAISE NOTICE 'Added locations to supabase_realtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    RAISE NOTICE 'Added notifications to supabase_realtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    RAISE NOTICE 'Added conversations to supabase_realtime';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    RAISE NOTICE 'Added messages to supabase_realtime';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- Migration 2: message_push_trigger (20260605000000)
-- Purpose: Send a push notification when a new chat message is inserted.
--          Reuses the send-push-notification Edge Function.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_message_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  request_id bigint;
  sender_name text;
  message_preview text;
  link_url text;
BEGIN
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  IF supabase_url IS NULL THEN
    supabase_url := 'https://trmleuxyneucveymqmod.supabase.co';
  END IF;

  IF NEW.receiver_id IS NULL OR NEW.receiver_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(
    NULLIF(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))), ''),
    'Alguien'
  ) INTO sender_name
  FROM public.user_profiles
  WHERE user_id = NEW.sender_id;

  IF sender_name IS NULL THEN
    sender_name := 'Alguien';
  END IF;

  message_preview := LEFT(COALESCE(NEW.message_text, '📎 Mensaje'), 100);

  link_url := '/chat?conversationId=' || NEW.conversation_id;

  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'user_id', NEW.receiver_id,
      'title', '💬 ' || sender_name,
      'body', message_preview,
      'link_to', link_url,
      'data', jsonb_build_object(
        'type', 'chat_message',
        'conversation_id', NEW.conversation_id,
        'sender_id', NEW.sender_id
      )
    )
  ) INTO request_id;

  RAISE LOG 'Chat push notification request sent to user %, request_id: %', NEW.receiver_id, request_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_send_push ON public.messages;

CREATE TRIGGER on_message_send_push
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.send_message_push_notification();

GRANT EXECUTE ON FUNCTION public.send_message_push_notification() TO service_role;


-- ---------------------------------------------------------------------------
-- Migration 3: add_tips (20260607000000)
-- Purpose: Allow owners to leave a tip for the walker after a completed walk.
--          100% of the tip goes to the walker, paid from owner wallet balance.
-- ---------------------------------------------------------------------------

-- 3a. Add 'tip' to transactions.transaction_type CHECK
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transaction_type_check
  CHECK (transaction_type = ANY (ARRAY[
    'payment'::text,
    'refund'::text,
    'deposit'::text,
    'withdrawal'::text,
    'penalty'::text,
    'bonus'::text,
    'tip'::text
  ]));

-- 3b. Add tip columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS tip_amount integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS tip_message text;

-- 3c. Index for tip queries
CREATE INDEX IF NOT EXISTS idx_bookings_tip
  ON public.bookings(booking_status, tip_amount)
  WHERE tip_amount > 0;

-- 3d. process_tip RPC function
CREATE OR REPLACE FUNCTION public.process_tip(
  p_booking_id uuid,
  p_tip_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_walker_user_id uuid;
  v_owner_balance numeric;
  v_walker_balance numeric;
  v_tx_id uuid;
  v_tx_number text;
BEGIN
  IF p_tip_amount IS NULL OR p_tip_amount <= 0 THEN
    RAISE EXCEPTION 'Tip amount must be greater than 0'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.booking_status <> 'completed' THEN
    RAISE EXCEPTION 'Tips can only be left on completed walks (current status: %)',
      v_booking.booking_status
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(v_booking.tip_amount, 0) > 0 THEN
    RAISE EXCEPTION 'A tip has already been left for this walk'
      USING ERRCODE = '23514';
  END IF;

  SELECT user_id INTO v_walker_user_id
  FROM public.walkers
  WHERE id = v_booking.walker_id;

  IF v_walker_user_id IS NULL THEN
    RAISE EXCEPTION 'Walker user_id not found for walker %', v_booking.walker_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT balance INTO v_owner_balance
  FROM public.user_profiles
  WHERE user_id = v_booking.owner_id
  FOR UPDATE;

  IF v_owner_balance IS NULL THEN
    RAISE EXCEPTION 'Owner profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_balance < p_tip_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Available: %, required: %',
      v_owner_balance, p_tip_amount
      USING ERRCODE = '23514';
  END IF;

  SELECT balance INTO v_walker_balance
  FROM public.user_profiles
  WHERE user_id = v_walker_user_id
  FOR UPDATE;

  UPDATE public.user_profiles
  SET balance = balance - p_tip_amount,
      updated_at = now()
  WHERE user_id = v_booking.owner_id;

  UPDATE public.user_profiles
  SET balance = balance + p_tip_amount,
      updated_at = now()
  WHERE user_id = v_walker_user_id;

  v_tx_number := 'TX-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad((floor(random() * 10000))::text, 4, '0');

  INSERT INTO public.transactions (
    user_id, booking_id, transaction_type, amount, fee_amount, net_amount,
    currency, payment_method, payment_gateway, status, description,
    platform_fee, net_earning, metadata
  ) VALUES (
    v_booking.owner_id, p_booking_id, 'tip', p_tip_amount, 0, p_tip_amount,
    'COP', 'wallet', 'platform', 'completed', 'Propina al paseador',
    0, p_tip_amount,
    jsonb_build_object('tip', true, 'walker_user_id', v_walker_user_id)
  )
  RETURNING id INTO v_tx_id;

  UPDATE public.bookings
  SET tip_amount = p_tip_amount,
      tip_paid_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'transaction_number', v_tx_number,
    'tip_amount', p_tip_amount,
    'owner_balance_after', v_owner_balance - p_tip_amount,
    'walker_balance_after', COALESCE(v_walker_balance, 0) + p_tip_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_tip(uuid, integer) TO authenticated;

-- 3e. Make sure bookings is in realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
END $$;
