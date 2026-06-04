-- Migration: Add tips (propinas) feature
-- Allows owners to leave a tip for the walker after a walk is completed.
-- 100% of the tip goes to the walker (no platform commission).
-- Tips are paid from the owner's wallet balance.

-- 1. Add 'tip' to transactions.transaction_type CHECK constraint
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

-- 2. Add tip columns to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS tip_amount integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS tip_message text;

-- 3. Index for fast tip queries
CREATE INDEX IF NOT EXISTS idx_bookings_tip
  ON public.bookings(booking_status, tip_amount)
  WHERE tip_amount > 0;

-- 4. SQL function to process a tip payment
--    Validates balance, debits owner, credits walker, creates transaction.
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
  -- Validate amount
  IF p_tip_amount IS NULL OR p_tip_amount <= 0 THEN
    RAISE EXCEPTION 'Tip amount must be greater than 0'
      USING ERRCODE = '22023';
  END IF;

  -- Lock booking row
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Only completed walks can receive tips
  IF v_booking.booking_status <> 'completed' THEN
    RAISE EXCEPTION 'Tips can only be left on completed walks (current status: %)',
      v_booking.booking_status
      USING ERRCODE = '23514';
  END IF;

  -- Prevent double-tipping
  IF COALESCE(v_booking.tip_amount, 0) > 0 THEN
    RAISE EXCEPTION 'A tip has already been left for this walk'
      USING ERRCODE = '23514';
  END IF;

  -- Get the walker's user_id (walkers.user_id is FK to user_profiles.user_id)
  SELECT user_id INTO v_walker_user_id
  FROM public.walkers
  WHERE id = v_booking.walker_id;

  IF v_walker_user_id IS NULL THEN
    RAISE EXCEPTION 'Walker user_id not found for walker %', v_booking.walker_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Check owner balance (atomic via row lock)
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

  -- Get walker balance
  SELECT balance INTO v_walker_balance
  FROM public.user_profiles
  WHERE user_id = v_walker_user_id
  FOR UPDATE;

  -- Debit owner, credit walker (tip is 100% to walker, no commission)
  UPDATE public.user_profiles
  SET balance = balance - p_tip_amount,
      updated_at = now()
  WHERE user_id = v_booking.owner_id;

  UPDATE public.user_profiles
  SET balance = balance + p_tip_amount,
      updated_at = now()
  WHERE user_id = v_walker_user_id;

  -- Generate transaction number
  v_tx_number := 'TX-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad((floor(random() * 10000))::text, 4, '0');

  -- Insert tip transaction
  INSERT INTO public.transactions (
    user_id,
    booking_id,
    transaction_type,
    amount,
    fee_amount,
    net_amount,
    currency,
    payment_method,
    payment_gateway,
    status,
    description,
    platform_fee,
    net_earning,
    metadata
  ) VALUES (
    v_booking.owner_id,
    p_booking_id,
    'tip',
    p_tip_amount,
    0,
    p_tip_amount,
    'COP',
    'wallet',
    'platform',
    'completed',
    'Propina al paseador',
    0,
    p_tip_amount,
    jsonb_build_object('tip', true, 'walker_user_id', v_walker_user_id)
  )
  RETURNING id INTO v_tx_id;

  -- Update booking with tip
  UPDATE public.bookings
  SET tip_amount = p_tip_amount,
      tip_paid_at = now()
  WHERE id = p_booking_id;

  -- Return summary
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

-- 5. Grant execute to authenticated users (they can call it via RPC)
GRANT EXECUTE ON FUNCTION public.process_tip(uuid, integer) TO authenticated;

-- 6. Add tip to the realtime publication (so walkers see notification)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
END $$;
