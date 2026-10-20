-- Least-privilege RLS, server-side pricing, and idempotent Mercado Pago settlement.
-- Idempotent: safe to re-run. Does not DROP public.vehiculo.
-- Compatible with the production hotfix already applied by Mary:
--   * policy allow_admin_update_balance already dropped
--   * protect_profile_fields() + BEFORE UPDATE trigger already exist (replaced here)
--   * storage policies "...109cf73_0" SELECT/DELETE true already dropped
--   * "Ver fotos de mascotas" and "Borrar mis fotos de mascotas" recreated below

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.caller_walker_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.walkers WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Avoids RLS recursion between bookings and walkers.
CREATE OR REPLACE FUNCTION public.walker_can_access_booking(
  p_walker_id uuid,
  p_is_paid boolean,
  p_status text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.walkers w
    WHERE w.user_id = auth.uid()
      AND (
        (p_walker_id IS NOT NULL AND w.id = p_walker_id AND (COALESCE(p_is_paid, false) = true OR p_status IS DISTINCT FROM 'pending'))
        OR (
          p_walker_id IS NULL
          AND COALESCE(p_is_paid, false) = true
          AND p_status IN ('pending', 'confirmed')
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.owner_has_booking_with_walker(p_walker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.walker_id = p_walker_id
      AND b.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.caller_can_read_location(p_booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.bookings b
    LEFT JOIN public.walkers w ON w.id = b.walker_id
    WHERE b.id = p_booking_id
      AND (b.user_id = auth.uid() OR w.user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.caller_can_insert_location(
  p_booking_id uuid,
  p_walker_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.walkers w ON w.id = b.walker_id
    WHERE b.id = p_booking_id
      AND b.status = 'in_progress'
      AND w.user_id = auth.uid()
      AND w.id = p_walker_id
  );
$$;

CREATE OR REPLACE FUNCTION public.walker_cares_for_owner(p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.walkers w ON w.id = b.walker_id
    WHERE b.user_id = p_owner_id
      AND w.user_id = auth.uid()
      AND b.status IS DISTINCT FROM 'cancelled'
  );
$$;

CREATE OR REPLACE FUNCTION public.caller_can_read_profile(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE (c.participant_one_id = auth.uid() AND c.participant_two_id = p_user_id)
         OR (c.participant_two_id = auth.uid() AND c.participant_one_id = p_user_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.bookings b
      LEFT JOIN public.walkers w ON w.id = b.walker_id
      WHERE (b.user_id = auth.uid() AND w.user_id = p_user_id)
         OR (w.user_id = auth.uid() AND b.user_id = p_user_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.caller_can_notify(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.bookings b
      LEFT JOIN public.walkers w ON w.id = b.walker_id
      WHERE (b.user_id = auth.uid() AND w.user_id = p_user_id)
         OR (w.user_id = auth.uid() AND b.user_id = p_user_id)
    )
    OR (
      EXISTS (SELECT 1 FROM public.walkers w WHERE w.user_id = p_user_id)
      AND EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.user_id = auth.uid()
          AND b.created_at > now() - interval '30 minutes'
          AND b.status IN ('pending', 'confirmed', 'accepted')
      )
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.user_profiles p
        WHERE p.user_id = p_user_id AND p.role = 'admin'
      )
      AND EXISTS (SELECT 1 FROM public.walkers w WHERE w.user_id = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.availability_visible(p_walker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.walkers w
    WHERE w.id = p_walker_id
      AND (
        w.user_id = auth.uid()
        OR w.overall_verification_status = 'approved'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.caller_is_booking_participant(p_booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.bookings b
    LEFT JOIN public.walkers w ON w.id = b.walker_id
    WHERE b.id = p_booking_id
      AND (b.user_id = auth.uid() OR w.user_id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.caller_walker_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.walker_can_access_booking(uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_has_booking_with_walker(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.caller_can_read_location(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.caller_can_insert_location(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.walker_cares_for_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.caller_can_read_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.caller_can_notify(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.availability_visible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.caller_is_booking_participant(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.caller_walker_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.walker_can_access_booking(uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_has_booking_with_walker(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.caller_can_read_location(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.caller_can_insert_location(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.walker_cares_for_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.caller_can_read_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.caller_can_notify(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.availability_visible(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.caller_is_booking_participant(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Profile role/balance guard (replaces Mary's function; trigger name kept)
-- Clients may move owner -> walker during onboarding. Never admin, never balance.
-- security invoker on purpose: current_user distinguishes service_role / definer.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.role IS NULL OR NEW.role NOT IN ('owner', 'walker') THEN
        RAISE EXCEPTION 'Rol no permitido'
          USING ERRCODE = '42501';
      END IF;
      NEW.balance := 0;
      RETURN NEW;
    END IF;

    IF NEW.balance IS DISTINCT FROM OLD.balance THEN
      RAISE EXCEPTION 'No puedes modificar el saldo'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role
       AND NOT (OLD.role = 'owner' AND NEW.role = 'walker') THEN
      RAISE EXCEPTION 'No puedes modificar el rol'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields ON public.user_profiles;
CREATE TRIGGER protect_profile_fields
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

DROP TRIGGER IF EXISTS protect_profile_fields_insert ON public.user_profiles;
CREATE TRIGGER protect_profile_fields_insert
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

CREATE OR REPLACE FUNCTION public.protect_booking_money_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_paid := false;
      NEW.payment_completed_at := NULL;
      NEW.mercadopago_preference_id := NULL;
      IF NEW.status IS DISTINCT FROM 'pending' THEN
        NEW.status := 'pending';
      END IF;
      RETURN NEW;
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.total_price IS DISTINCT FROM OLD.total_price
       OR NEW.is_paid IS DISTINCT FROM OLD.is_paid
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.payment_completed_at IS DISTINCT FROM OLD.payment_completed_at
       OR NEW.mercadopago_preference_id IS DISTINCT FROM OLD.mercadopago_preference_id
       OR NEW.commission_applied_at IS DISTINCT FROM OLD.commission_applied_at
       OR NEW.commission_reversed_at IS DISTINCT FROM OLD.commission_reversed_at
       OR NEW.commission_walker_amount IS DISTINCT FROM OLD.commission_walker_amount
       OR NEW.commission_platform_amount IS DISTINCT FROM OLD.commission_platform_amount
       OR NEW.commission_gateway_amount IS DISTINCT FROM OLD.commission_gateway_amount
    THEN
      RAISE EXCEPTION 'No puedes modificar campos de pago'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.status IN ('completed', 'cancelled')
       AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Completar o cancelar solo se hace por las funciones del servidor'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.walker_id IS DISTINCT FROM OLD.walker_id THEN
      IF OLD.walker_id IS NOT NULL
         OR NEW.walker_id IS DISTINCT FROM public.caller_walker_id() THEN
        RAISE EXCEPTION 'No puedes reasignar el paseador'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_walker_verification_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.overall_verification_status := 'pending';
      NEW.id_verification_status := 'pending';
      NEW.background_check_status := 'pending';
      NEW.verification_status := 'pending';
      NEW.is_verified := false;
      NEW.verified_by_admin_id := NULL;
      NEW.verified_at := NULL;
      NEW.bank_account_verified := false;
      RETURN NEW;
    END IF;

    IF NEW.overall_verification_status IS DISTINCT FROM OLD.overall_verification_status
       OR NEW.id_verification_status IS DISTINCT FROM OLD.id_verification_status
       OR NEW.background_check_status IS DISTINCT FROM OLD.background_check_status
       OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
       OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.verified_by_admin_id IS DISTINCT FROM OLD.verified_by_admin_id
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
       OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
       OR NEW.verification_notes IS DISTINCT FROM OLD.verification_notes
       OR NEW.bank_account_verified IS DISTINCT FROM OLD.bank_account_verified
    THEN
      RAISE EXCEPTION 'No puedes modificar el estado de verificación'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Commission: 76% walker / 20% platform / 4% gateway, integer COP.
-- Remainder of truncating division stays with the walker so the parts sum
-- to the paid amount exactly. Applied once per booking.
-- ---------------------------------------------------------------------------

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS commission_applied_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS commission_reversed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS commission_walker_amount integer,
  ADD COLUMN IF NOT EXISTS commission_platform_amount integer,
  ADD COLUMN IF NOT EXISTS commission_gateway_amount integer;

CREATE OR REPLACE FUNCTION public.split_booking_commission(p_amount integer)
RETURNS TABLE (
  walker_amount integer,
  platform_amount integer,
  gateway_amount integer
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Monto inválido' USING ERRCODE = '22023';
  END IF;
  gateway_amount := (p_amount * 4) / 100;
  platform_amount := (p_amount * 20) / 100;
  walker_amount := p_amount - platform_amount - gateway_amount;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_booking_price(
  p_duration text,
  p_pet_count integer,
  p_walker_id uuid
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours integer;
  v_hourly integer;
BEGIN
  v_hours := CASE p_duration
    WHEN '1h' THEN 1
    WHEN '2h' THEN 2
    WHEN '3h' THEN 3
    ELSE NULL
  END;
  IF v_hours IS NULL THEN
    RAISE EXCEPTION 'Duración inválida' USING ERRCODE = '22023';
  END IF;
  IF p_pet_count IS NULL OR p_pet_count < 1 THEN
    RAISE EXCEPTION 'Selecciona al menos una mascota' USING ERRCODE = '22023';
  END IF;

  v_hourly := 30000;
  IF p_walker_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(round(w.price)::integer, 0), 30000)
      INTO v_hourly
    FROM public.walkers w
    WHERE w.id = p_walker_id
      AND w.overall_verification_status = 'approved';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Paseador no disponible' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN v_hourly * v_hours + (10000 * (p_pet_count - 1));
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_walker_balance(
  walker_user_id uuid,
  amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET balance = COALESCE(balance, 0) + COALESCE(amount, 0),
      updated_at = now()
  WHERE user_id = walker_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_booking_commission(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_paid integer;
  v_tx_id uuid;
  v_walker_user uuid;
  v_split record;
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.commission_applied_at IS NOT NULL OR v_booking.commission_reversed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'applied', false,
      'reason', 'already_settled',
      'walker_amount', v_booking.commission_walker_amount,
      'platform_amount', v_booking.commission_platform_amount,
      'gateway_amount', v_booking.commission_gateway_amount
    );
  END IF;

  IF v_booking.walker_id IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'no_walker');
  END IF;

  SELECT t.id, t.amount
    INTO v_tx_id, v_paid
  FROM public.transactions t
  WHERE t.booking_id = p_booking_id
    AND t.transaction_type = 'payment'
    AND t.status = 'completed'
  ORDER BY t.created_at
  LIMIT 1
  FOR UPDATE;

  IF v_tx_id IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'no_payment');
  END IF;

  SELECT user_id INTO v_walker_user
  FROM public.walkers
  WHERE id = v_booking.walker_id;

  IF v_walker_user IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'walker_missing');
  END IF;

  SELECT * INTO v_split FROM public.split_booking_commission(v_paid);

  PERFORM public.increment_walker_balance(v_walker_user, v_split.walker_amount);

  UPDATE public.transactions
  SET platform_fee = v_split.platform_amount,
      gateway_fee = v_split.gateway_amount,
      net_earning = v_split.walker_amount,
      net_amount = v_split.walker_amount,
      updated_at = now()
  WHERE id = v_tx_id;

  UPDATE public.bookings
  SET commission_applied_at = now(),
      commission_walker_amount = v_split.walker_amount,
      commission_platform_amount = v_split.platform_amount,
      commission_gateway_amount = v_split.gateway_amount,
      updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'applied', true,
    'paid_amount', v_paid,
    'walker_amount', v_split.walker_amount,
    'platform_amount', v_split.platform_amount,
    'gateway_amount', v_split.gateway_amount,
    'walker_user_id', v_walker_user
  );
END;
$$;

-- Disambiguate duplicate gateway ids so the unique index can be created.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY gateway_transaction_id
           ORDER BY CASE WHEN status = 'completed' THEN 0 ELSE 1 END, created_at
         ) AS rn
  FROM public.transactions
  WHERE gateway_transaction_id IS NOT NULL
)
UPDATE public.transactions t
SET gateway_transaction_id = t.gateway_transaction_id || ':dup:' || t.id::text,
    updated_at = now()
FROM ranked r
WHERE t.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_gateway_transaction_id_unique
  ON public.transactions (gateway_transaction_id)
  WHERE gateway_transaction_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.service_create_pending_booking(uuid, uuid[], text, text, double precision, double precision, text, text, uuid);

CREATE OR REPLACE FUNCTION public.service_create_pending_booking(
  p_user_id uuid,
  p_pet_ids text[],
  p_duration text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_scheduled_date text,
  p_scheduled_time text,
  p_walker_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price integer;
  v_booking_id uuid;
  v_count integer;
  v_pet_ids_type text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario requerido' USING ERRCODE = '22023';
  END IF;
  IF p_address IS NULL OR length(trim(p_address)) = 0 THEN
    RAISE EXCEPTION 'Dirección requerida' USING ERRCODE = '22023';
  END IF;
  IF p_pet_ids IS NULL OR cardinality(p_pet_ids) < 1 THEN
    RAISE EXCEPTION 'Selecciona al menos una mascota' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.pets
  WHERE id = ANY (p_pet_ids::uuid[])
    AND owner_id = p_user_id;

  IF v_count <> cardinality(p_pet_ids) THEN
    RAISE EXCEPTION 'Una o más mascotas no pertenecen al usuario' USING ERRCODE = '42501';
  END IF;

  v_price := public.compute_booking_price(p_duration, cardinality(p_pet_ids), p_walker_id);

  SELECT format_type(a.atttypid, a.atttypmod) INTO v_pet_ids_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.bookings'::regclass
    AND a.attname = 'pet_ids'
    AND NOT a.attisdropped;

  IF v_pet_ids_type = 'uuid[]' THEN
    INSERT INTO public.bookings (
      user_id, address, lat, lng, duration, total_price, status,
      walker_id, scheduled_date, scheduled_time, pet_ids,
      is_paid, payment_method
    ) VALUES (
      p_user_id, p_address, p_lat, p_lng, p_duration, v_price, 'pending',
      p_walker_id, p_scheduled_date, p_scheduled_time, p_pet_ids::uuid[],
      false, NULL
    )
    RETURNING id INTO v_booking_id;
  ELSIF v_pet_ids_type = 'text[]' THEN
    INSERT INTO public.bookings (
      user_id, address, lat, lng, duration, total_price, status,
      walker_id, scheduled_date, scheduled_time, pet_ids,
      is_paid, payment_method
    ) VALUES (
      p_user_id, p_address, p_lat, p_lng, p_duration, v_price, 'pending',
      p_walker_id, p_scheduled_date, p_scheduled_time, p_pet_ids,
      false, NULL
    )
    RETURNING id INTO v_booking_id;
  ELSE
    RAISE EXCEPTION 'Tipo de bookings.pet_ids no soportado: %', COALESCE(v_pet_ids_type, 'columna ausente')
      USING ERRCODE = '42804';
  END IF;

  RETURN jsonb_build_object('booking_id', v_booking_id, 'amount', v_price);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_create_pending_topup(
  p_user_id uuid,
  p_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario requerido' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 5000 OR p_amount > 5000000 THEN
    RAISE EXCEPTION 'Monto de recarga inválido' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Perfil no encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.transactions (
    user_id, transaction_type, amount, net_amount, currency,
    payment_method, payment_gateway, status, description
  ) VALUES (
    p_user_id, 'deposit', p_amount, p_amount, 'COP',
    'credit_card', 'mercadopago', 'pending', 'Recarga de billetera via MercadoPago'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('transaction_id', v_id, 'amount', p_amount, 'user_id', p_user_id);
END;
$$;

-- Single transactional settlement for the Mercado Pago webhook.
-- Retries with the same gateway_transaction_id never credit twice.
CREATE OR REPLACE FUNCTION public.process_mercadopago_payment(
  p_payment_id text,
  p_status text,
  p_amount numeric,
  p_external_reference text,
  p_currency text DEFAULT 'COP'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.transactions%ROWTYPE;
  v_amount integer;
  v_booking public.bookings%ROWTYPE;
  v_expected integer;
  v_topup public.transactions%ROWTYPE;
  v_new_balance numeric;
  v_commission jsonb;
  v_walker_user uuid;
BEGIN
  IF p_payment_id IS NULL OR length(trim(p_payment_id)) = 0 THEN
    RAISE EXCEPTION 'payment id requerido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.transactions
  WHERE gateway_transaction_id = p_payment_id
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'idempotent', true,
      'status', v_existing.status,
      'transaction_id', v_existing.id
    );
  END IF;

  v_amount := round(COALESCE(p_amount, 0))::integer;

  IF coalesce(p_status, '') <> 'approved' OR coalesce(p_currency, 'COP') <> 'COP' THEN
    RETURN jsonb_build_object('processed', false, 'reason', 'not_approved');
  END IF;

  IF p_external_reference IS NULL OR p_external_reference !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN jsonb_build_object('processed', false, 'reason', 'bad_reference');
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_external_reference::uuid
  FOR UPDATE;

  IF FOUND THEN
    IF COALESCE(v_booking.is_paid, false) OR v_booking.status = 'cancelled' THEN
      INSERT INTO public.transactions (
        user_id, booking_id, transaction_type, amount, currency,
        payment_method, payment_gateway, gateway_transaction_id,
        status, description, metadata
      ) VALUES (
        v_booking.user_id, v_booking.id, 'payment', v_amount, 'COP',
        'credit_card', 'mercadopago', p_payment_id,
        'failed', 'Pago recibido para una reserva ya pagada o cancelada',
        jsonb_build_object('booking_status', v_booking.status, 'is_paid', v_booking.is_paid)
      );
      RETURN jsonb_build_object(
        'processed', false,
        'reason', CASE WHEN v_booking.status = 'cancelled' THEN 'booking_cancelled' ELSE 'already_paid' END
      );
    END IF;

    v_expected := round(COALESCE(v_booking.total_price, 0))::integer;
    IF v_amount <> v_expected THEN
      INSERT INTO public.transactions (
        user_id, booking_id, transaction_type, amount, currency,
        payment_method, payment_gateway, gateway_transaction_id,
        status, description, metadata
      ) VALUES (
        v_booking.user_id, v_booking.id, 'payment', v_amount, 'COP',
        'credit_card', 'mercadopago', p_payment_id,
        'failed', 'Monto de Mercado Pago no coincide con el precio de la reserva',
        jsonb_build_object('expected', v_expected, 'received', v_amount)
      );
      RETURN jsonb_build_object('processed', false, 'reason', 'amount_mismatch', 'expected', v_expected);
    END IF;

    INSERT INTO public.transactions (
      user_id, booking_id, transaction_type, amount, net_amount, currency,
      payment_method, payment_gateway, gateway_transaction_id,
      status, description
    ) VALUES (
      v_booking.user_id, v_booking.id, 'payment', v_amount, v_amount, 'COP',
      'credit_card', 'mercadopago', p_payment_id,
      'completed', 'Pago de paseo ' || coalesce(v_booking.duration, '')
    );

    UPDATE public.bookings
    SET is_paid = true,
        payment_method = 'credit_card',
        payment_completed_at = now(),
        status = CASE
          WHEN status = 'pending' AND walker_id IS NOT NULL THEN 'accepted'
          WHEN status = 'pending' THEN 'confirmed'
          ELSE status
        END,
        updated_at = now()
    WHERE id = v_booking.id;

    v_commission := public.apply_booking_commission(v_booking.id);

    SELECT user_id INTO v_walker_user FROM public.walkers WHERE id = v_booking.walker_id;

    INSERT INTO public.notifications (user_id, title, body, link_to)
    VALUES (
      v_booking.user_id,
      'Reserva confirmada',
      'Tu pago fue aprobado. Te avisaremos cuando un paseador tome el paseo.',
      '/booking-details?id=' || v_booking.id::text
    );

    IF v_walker_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, link_to)
      VALUES (
        v_walker_user,
        'Nuevo paseo asignado',
        'Tienes un paseo pago programado.',
        '/walker-home'
      );
    END IF;

    RETURN jsonb_build_object(
      'processed', true,
      'kind', 'booking',
      'booking_id', v_booking.id,
      'commission', v_commission
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = p_external_reference::uuid
  ) THEN
    RETURN jsonb_build_object('processed', false, 'reason', 'unknown_reference');
  END IF;

  SELECT * INTO v_topup
  FROM public.transactions
  WHERE user_id = p_external_reference::uuid
    AND transaction_type = 'deposit'
    AND status = 'pending'
    AND amount = v_amount
    AND gateway_transaction_id IS NULL
    AND payment_gateway = 'mercadopago'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('processed', false, 'reason', 'no_matching_topup');
  END IF;

  UPDATE public.transactions
  SET status = 'completed',
      gateway_transaction_id = p_payment_id,
      payment_method = 'credit_card',
      updated_at = now()
  WHERE id = v_topup.id;

  UPDATE public.user_profiles
  SET balance = COALESCE(balance, 0) + v_amount,
      updated_at = now()
  WHERE user_id = v_topup.user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.notifications (user_id, title, body, link_to)
  VALUES (
    v_topup.user_id,
    'Recarga exitosa',
    'Tu recarga fue procesada.',
    '/wallet'
  );

  RETURN jsonb_build_object(
    'processed', true,
    'kind', 'topup',
    'transaction_id', v_topup.id,
    'balance', v_new_balance
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('idempotent', true, 'reason', 'unique_gateway_transaction_id');
END;
$$;

DROP FUNCTION IF EXISTS public.pay_booking_with_wallet(text, uuid[], text, double precision, double precision, text, text, uuid);

CREATE OR REPLACE FUNCTION public.pay_booking_with_wallet(
  p_duration text,
  p_pet_ids text[],
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_scheduled_date text,
  p_scheduled_time text,
  p_walker_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_price integer;
  v_balance numeric;
  v_booking_id uuid;
  v_count integer;
  v_status text;
  v_walker_user uuid;
  v_pet_ids_type text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_address IS NULL OR length(trim(p_address)) = 0 THEN
    RAISE EXCEPTION 'Dirección requerida' USING ERRCODE = '22023';
  END IF;
  IF p_pet_ids IS NULL OR cardinality(p_pet_ids) < 1 THEN
    RAISE EXCEPTION 'Selecciona al menos una mascota' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.pets
  WHERE id = ANY (p_pet_ids::uuid[]) AND owner_id = v_user;
  IF v_count <> cardinality(p_pet_ids) THEN
    RAISE EXCEPTION 'Una o más mascotas no te pertenecen' USING ERRCODE = '42501';
  END IF;

  v_price := public.compute_booking_price(p_duration, cardinality(p_pet_ids), p_walker_id);

  SELECT balance INTO v_balance
  FROM public.user_profiles
  WHERE user_id = v_user
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Perfil no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_balance < v_price THEN
    RAISE EXCEPTION 'Saldo insuficiente' USING ERRCODE = '23514';
  END IF;

  IF p_walker_id IS NOT NULL THEN
    SELECT user_id INTO v_walker_user FROM public.walkers WHERE id = p_walker_id;
    v_status := 'accepted';
  ELSE
    v_status := 'confirmed';
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod) INTO v_pet_ids_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.bookings'::regclass
    AND a.attname = 'pet_ids'
    AND NOT a.attisdropped;

  IF v_pet_ids_type = 'uuid[]' THEN
    INSERT INTO public.bookings (
      user_id, address, lat, lng, duration, total_price, status,
      walker_id, scheduled_date, scheduled_time, pet_ids,
      is_paid, payment_method, payment_completed_at
    ) VALUES (
      v_user, p_address, p_lat, p_lng, p_duration, v_price, v_status,
      p_walker_id, p_scheduled_date, p_scheduled_time, p_pet_ids::uuid[],
      true, 'wallet', now()
    )
    RETURNING id INTO v_booking_id;
  ELSIF v_pet_ids_type = 'text[]' THEN
    INSERT INTO public.bookings (
      user_id, address, lat, lng, duration, total_price, status,
      walker_id, scheduled_date, scheduled_time, pet_ids,
      is_paid, payment_method, payment_completed_at
    ) VALUES (
      v_user, p_address, p_lat, p_lng, p_duration, v_price, v_status,
      p_walker_id, p_scheduled_date, p_scheduled_time, p_pet_ids,
      true, 'wallet', now()
    )
    RETURNING id INTO v_booking_id;
  ELSE
    RAISE EXCEPTION 'Tipo de bookings.pet_ids no soportado: %', COALESCE(v_pet_ids_type, 'columna ausente')
      USING ERRCODE = '42804';
  END IF;

  UPDATE public.user_profiles
  SET balance = balance - v_price,
      updated_at = now()
  WHERE user_id = v_user;

  INSERT INTO public.transactions (
    user_id, booking_id, transaction_type, amount, net_amount, currency,
    payment_method, status, description
  ) VALUES (
    v_user, v_booking_id, 'payment', v_price, v_price, 'COP',
    'wallet', 'completed', 'Paseo ' || p_duration || ' - pago con saldo'
  );

  RETURN jsonb_build_object(
    'booking_id', v_booking_id,
    'amount', v_price,
    'walker_user_id', v_walker_user,
    'status', v_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_walker_user uuid;
  v_commission jsonb;
  v_allowed boolean;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT user_id INTO v_walker_user FROM public.walkers WHERE id = v_booking.walker_id;

  v_allowed := coalesce(auth.role(), '') = 'service_role'
    OR public.is_admin()
    OR (v_walker_user IS NOT NULL AND v_walker_user = auth.uid());
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status = 'completed' THEN
    RETURN jsonb_build_object(
      'idempotent', true,
      'walker_amount', v_booking.commission_walker_amount
    );
  END IF;

  IF v_booking.status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'El paseo no está en curso' USING ERRCODE = '23514';
  END IF;

  UPDATE public.bookings
  SET status = 'completed',
      walk_end_time = now(),
      updated_at = now()
  WHERE id = p_booking_id;

  v_commission := public.apply_booking_commission(p_booking_id);

  IF v_booking.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link_to)
    VALUES (
      v_booking.user_id,
      'Paseo completado',
      'El paseo terminó. Tu mascota está de vuelta.',
      '/home'
    );
  END IF;

  RETURN v_commission || jsonb_build_object('booking_id', p_booking_id, 'status', 'completed');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_walker_user uuid;
  v_tx public.transactions%ROWTYPE;
  v_allowed boolean;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT user_id INTO v_walker_user FROM public.walkers WHERE id = v_booking.walker_id;

  v_allowed := coalesce(auth.role(), '') = 'service_role'
    OR public.is_admin()
    OR v_booking.user_id = auth.uid()
    OR (v_walker_user IS NOT NULL AND v_walker_user = auth.uid());
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status = 'cancelled' THEN
    RETURN jsonb_build_object('idempotent', true, 'status', 'cancelled');
  END IF;
  IF v_booking.status = 'completed' THEN
    RAISE EXCEPTION 'No se puede cancelar un paseo completado' USING ERRCODE = '23514';
  END IF;

  IF v_booking.commission_applied_at IS NOT NULL
     AND v_booking.commission_reversed_at IS NULL
     AND v_walker_user IS NOT NULL
     AND COALESCE(v_booking.commission_walker_amount, 0) <> 0 THEN
    PERFORM public.increment_walker_balance(v_walker_user, -v_booking.commission_walker_amount);
    UPDATE public.bookings
    SET commission_reversed_at = now()
    WHERE id = p_booking_id;
  END IF;

  SELECT * INTO v_tx
  FROM public.transactions
  WHERE booking_id = p_booking_id
    AND transaction_type = 'payment'
    AND status = 'completed'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND NOT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE booking_id = p_booking_id AND transaction_type = 'refund'
  ) THEN
    IF v_tx.payment_method = 'wallet' THEN
      UPDATE public.user_profiles
      SET balance = COALESCE(balance, 0) + v_tx.amount,
          updated_at = now()
      WHERE user_id = v_booking.user_id;

      INSERT INTO public.transactions (
        user_id, booking_id, transaction_type, amount, net_amount, currency,
        payment_method, status, description
      ) VALUES (
        v_booking.user_id, p_booking_id, 'refund', v_tx.amount, v_tx.amount, 'COP',
        'wallet', 'completed', 'Reembolso por cancelación'
      );
    ELSE
      INSERT INTO public.transactions (
        user_id, booking_id, transaction_type, amount, currency,
        payment_method, payment_gateway, status, description
      ) VALUES (
        v_booking.user_id, p_booking_id, 'refund', v_tx.amount, 'COP',
        'credit_card', 'mercadopago', 'pending',
        'Reembolso pendiente - requiere procesamiento manual en Mercado Pago'
      );
    END IF;
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_booking_id;

  IF auth.uid() IS NOT NULL AND auth.uid() = v_walker_user AND v_booking.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link_to)
    VALUES (v_booking.user_id, 'Paseo cancelado', 'El paseador canceló el paseo.', '/home');
  ELSIF auth.uid() IS NOT NULL AND auth.uid() = v_booking.user_id AND v_walker_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link_to)
    VALUES (v_walker_user, 'Reserva cancelada', 'El dueño canceló la reserva.', '/walker-home');
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'cancelled', 'booking_id', p_booking_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Payouts (moved from supabase_request_payout.sql) + admin verification
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_payout(
  p_walker_id uuid,
  p_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_walker_user_id uuid;
  v_walker_balance numeric;
  v_pending_sum numeric;
  v_available numeric;
  v_payout_id uuid;
  v_payout_number text;
  v_bank_type text;
  v_bank_number text;
  v_admin record;
BEGIN
  IF p_amount IS NULL OR p_amount < 50000 THEN
    RAISE EXCEPTION 'El monto mínimo para retirar es $50.000' USING ERRCODE = '22023';
  END IF;

  SELECT w.user_id, p.bank_account_type, p.bank_account_number
    INTO v_walker_user_id, v_bank_type, v_bank_number
  FROM public.walkers w
  LEFT JOIN public.user_profiles p ON p.user_id = w.user_id
  WHERE w.id = p_walker_id;

  IF v_walker_user_id IS NULL THEN
    RAISE EXCEPTION 'Paseador no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_walker_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF v_bank_number IS NULL OR trim(v_bank_number) = '' THEN
    RAISE EXCEPTION 'Necesitás registrar tu cuenta bancaria antes de retirar.' USING ERRCODE = '23514';
  END IF;

  SELECT balance INTO v_walker_balance
  FROM public.user_profiles
  WHERE user_id = v_walker_user_id
  FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_sum
  FROM public.payouts
  WHERE walker_id = p_walker_id AND status = 'pending';

  v_available := v_walker_balance - v_pending_sum;
  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponible para retirar: %', v_available USING ERRCODE = '23514';
  END IF;

  UPDATE public.user_profiles
  SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = v_walker_user_id;

  v_payout_number := 'PO-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random() * 10000))::text, 4, '0');

  INSERT INTO public.payouts (walker_id, amount, status, payout_date, notes)
  VALUES (
    p_walker_id, p_amount, 'pending', CURRENT_DATE,
    'Solicitud #' || v_payout_number ||
    ' | Banco: ' || COALESCE(v_bank_type, 'Nequi') ||
    ' | Cuenta: ' || v_bank_number
  )
  RETURNING id INTO v_payout_id;

  INSERT INTO public.transactions (
    user_id, transaction_type, amount, fee_amount, net_amount,
    currency, payment_method, status, description, metadata
  ) VALUES (
    v_walker_user_id, 'withdrawal', p_amount, 0, p_amount,
    'COP', 'wallet', 'pending', 'Retiro solicitado #' || v_payout_number,
    jsonb_build_object('payout_id', v_payout_id, 'payout_number', v_payout_number, 'status', 'pending')
  );

  INSERT INTO public.notifications (user_id, title, body, link_to)
  VALUES (
    v_walker_user_id,
    'Solicitud de retiro enviada',
    'Tu solicitud de retiro está siendo procesada.',
    '/walker-balance'
  );

  FOR v_admin IN
    SELECT user_id FROM public.user_profiles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, body, link_to)
    VALUES (
      v_admin.user_id,
      'Nuevo retiro pendiente',
      'Un paseador solicitó un retiro. Revisá los datos y transferí.',
      '/admin/payouts'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'payout_number', v_payout_number,
    'amount', p_amount,
    'balance_after', v_walker_balance - p_amount,
    'bank_type', v_bank_type,
    'bank_number', v_bank_number
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_payout(
  p_payout_id uuid,
  p_admin_user_id uuid,
  p_action text,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout public.payouts%ROWTYPE;
  v_walker_user_id uuid;
  v_new_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado: solo administradores' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Acción inválida. Use approve o reject' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_payout FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Retiro no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_payout.status <> 'pending' THEN
    RAISE EXCEPTION 'Este retiro ya fue procesado (estado actual: %)', v_payout.status USING ERRCODE = '23514';
  END IF;

  SELECT user_id INTO v_walker_user_id FROM public.walkers WHERE id = v_payout.walker_id;
  IF v_walker_user_id IS NULL THEN
    RAISE EXCEPTION 'Paseador no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'approve' THEN
    v_new_status := 'completed';
    UPDATE public.payouts
    SET status = v_new_status,
        payout_date = CURRENT_DATE,
        notes = COALESCE(v_payout.notes, '') ||
                E'\nAprobado por admin ' || COALESCE(p_admin_user_id, auth.uid())::text ||
                COALESCE(' | ' || p_admin_note, '')
    WHERE id = p_payout_id;

    UPDATE public.transactions
    SET status = 'completed',
        description = description || ' (Pagado)',
        updated_at = now()
    WHERE metadata->>'payout_id' = p_payout_id::text
      AND status = 'pending';
  ELSE
    v_new_status := 'rejected';
    UPDATE public.user_profiles
    SET balance = balance + v_payout.amount, updated_at = now()
    WHERE user_id = v_walker_user_id;

    UPDATE public.payouts
    SET status = v_new_status,
        notes = COALESCE(v_payout.notes, '') ||
                E'\nRechazado por admin ' || COALESCE(p_admin_user_id, auth.uid())::text ||
                COALESCE(' | Motivo: ' || p_admin_note, '')
    WHERE id = p_payout_id;

    UPDATE public.transactions
    SET status = 'cancelled',
        description = description || ' (Rechazado - saldo devuelto)',
        updated_at = now()
    WHERE metadata->>'payout_id' = p_payout_id::text
      AND status = 'pending';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link_to)
  VALUES (
    v_walker_user_id,
    CASE WHEN v_new_status = 'completed' THEN 'Retiro aprobado' ELSE 'Retiro rechazado' END,
    CASE WHEN v_new_status = 'completed'
      THEN 'Tu retiro fue procesado.'
      ELSE 'Tu solicitud de retiro fue rechazada y el saldo volvió a tu cuenta.'
    END,
    '/walker-balance'
  );

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', p_payout_id,
    'new_status', v_new_status,
    'walker_user_id', v_walker_user_id,
    'amount', v_payout.amount,
    'action', p_action
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_verify_walker(
  p_walker_id uuid,
  p_status text,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_walker_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado: solo administradores' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Estado inválido' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_walker_user_id FROM public.walkers WHERE id = p_walker_id;
  IF v_walker_user_id IS NULL THEN
    RAISE EXCEPTION 'Paseador no encontrado' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.walkers
  SET overall_verification_status = p_status,
      id_verification_status = CASE WHEN p_status = 'approved' THEN 'approved' ELSE id_verification_status END,
      background_check_status = CASE WHEN p_status = 'approved' THEN 'approved' ELSE background_check_status END,
      verification_status = p_status,
      is_verified = (p_status = 'approved'),
      verified_by_admin_id = auth.uid(),
      verified_at = now(),
      rejection_reason = CASE WHEN p_status = 'rejected' THEN COALESCE(p_admin_note, 'Sin motivo especificado') ELSE rejection_reason END,
      verification_notes = CASE WHEN p_status = 'rejected' THEN COALESCE(p_admin_note, 'Sin motivo especificado') ELSE verification_notes END
  WHERE id = p_walker_id;

  INSERT INTO public.notifications (user_id, title, body, link_to)
  VALUES (
    v_walker_user_id,
    CASE WHEN p_status = 'approved' THEN 'Verificación aprobada' ELSE 'Verificación rechazada' END,
    CASE WHEN p_status = 'approved'
      THEN 'Tu perfil de paseador fue verificado.'
      ELSE 'Tu verificación fue rechazada. Motivo: ' || COALESCE(p_admin_note, 'Sin especificar')
    END,
    CASE WHEN p_status = 'approved' THEN '/walker-home' ELSE '/onboarding-walker' END
  );

  RETURN jsonb_build_object('success', true, 'walker_id', p_walker_id, 'new_status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.split_booking_commission(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_booking_price(text, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_walker_balance(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_booking_commission(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_create_pending_booking(uuid, text[], text, text, double precision, double precision, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_create_pending_topup(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_mercadopago_payment(text, text, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pay_booking_with_wallet(text, text[], text, double precision, double precision, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_booking(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_booking(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_payout(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_payout(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_verify_walker(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.split_booking_commission(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compute_booking_price(text, integer, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_walker_balance(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_booking_commission(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_create_pending_booking(uuid, text[], text, text, double precision, double precision, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_create_pending_topup(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_mercadopago_payment(text, text, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pay_booking_with_wallet(text, text[], text, double precision, double precision, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_booking(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_payout(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_payout(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_walker(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Public walker directory (safe columns only). security_invoker = false so
-- discovery does not depend on opening the walkers table.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.walker_directory;
CREATE VIEW public.walker_directory
WITH (security_invoker = false) AS
SELECT
  w.id,
  w.user_id,
  w.name,
  w.location,
  w.rating,
  w.reviews,
  w.price,
  w.img,
  w.service_latitude,
  w.service_longitude,
  w.service_radius_km,
  w.is_online,
  w.bio,
  w.overall_verification_status,
  p.first_name,
  p.last_name,
  p.profile_photo_url
FROM public.walkers w
LEFT JOIN public.user_profiles p ON p.user_id = w.user_id
WHERE w.overall_verification_status = 'approved';

REVOKE ALL ON public.walker_directory FROM PUBLIC, anon;
GRANT SELECT ON public.walker_directory TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS (already true in prod; kept so a replay is explicit)
-- vehiculo and walker_certifications stay deny-all: no client uses them.
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walkers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.walker_availability ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.walker_certifications') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.walker_certifications ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.vehiculo') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.vehiculo ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DROP TRIGGER IF EXISTS protect_booking_money_fields ON public.bookings;
CREATE TRIGGER protect_booking_money_fields
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_booking_money_fields();

DROP TRIGGER IF EXISTS protect_walker_verification_fields ON public.walkers;
CREATE TRIGGER protect_walker_verification_fields
  BEFORE INSERT OR UPDATE ON public.walkers
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_walker_verification_fields();

-- Drop every existing policy on the tables that were wide open, then recreate.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'user_profiles', 'bookings', 'payouts', 'transactions', 'locations',
        'booking_reviews', 'notifications', 'pets', 'walkers', 'walker_availability'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Explicit names from the production pg_policies dump (no-op if the loop already dropped them).
DROP POLICY IF EXISTS "allow_admin_update_balance" ON public.user_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.user_profiles;
DROP POLICY IF EXISTS "Perfiles visibles para todos" ON public.user_profiles;
DROP POLICY IF EXISTS "Ver perfiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "allow_walker_update_booking" ON public.bookings;
DROP POLICY IF EXISTS "Allow walker update" ON public.bookings;
DROP POLICY IF EXISTS "allow_walker_select_bookings" ON public.bookings;
DROP POLICY IF EXISTS "allow_update_payouts" ON public.payouts;
DROP POLICY IF EXISTS "allow_insert_payouts" ON public.payouts;
DROP POLICY IF EXISTS "allow_select_payouts" ON public.payouts;
DROP POLICY IF EXISTS "allow_select_transactions" ON public.transactions;
DROP POLICY IF EXISTS "allow_insert_transactions" ON public.transactions;
DROP POLICY IF EXISTS "allow_insert_locations" ON public.locations;
DROP POLICY IF EXISTS "Allow location insert" ON public.locations;
DROP POLICY IF EXISTS "allow_select_reviews" ON public.booking_reviews;
DROP POLICY IF EXISTS "allow_insert_reviews" ON public.booking_reviews;
DROP POLICY IF EXISTS "Users can view their own reviews" ON public.booking_reviews;
DROP POLICY IF EXISTS "Users can create reviews for their bookings" ON public.booking_reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.booking_reviews;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Walkers can view own profile" ON public.walkers;
DROP POLICY IF EXISTS "Admin VIP total walkers" ON public.walkers;

-- user_profiles
CREATE POLICY user_profiles_select ON public.user_profiles
  FOR SELECT TO authenticated
  USING (public.caller_can_read_profile(user_id));

CREATE POLICY user_profiles_insert ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role IN ('owner', 'walker') AND COALESCE(balance, 0) = 0);

CREATE POLICY user_profiles_update ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY user_profiles_delete ON public.user_profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- bookings: no client INSERT (money fields). Owners read their rows.
-- Walkers read paid unassigned bookings and their own paid assignments.
CREATE POLICY bookings_select ON public.bookings
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.walker_can_access_booking(walker_id, is_paid, status)
  );

CREATE POLICY bookings_update ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.walker_can_access_booking(walker_id, is_paid, status)
    OR (
      walker_id IS NULL
      AND COALESCE(is_paid, false) = true
      AND public.caller_walker_id() IS NOT NULL
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_admin()
    OR walker_id = public.caller_walker_id()
  );

-- pets
CREATE POLICY pets_select ON public.pets
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_admin()
    OR public.walker_cares_for_owner(owner_id)
  );

CREATE POLICY pets_insert ON public.pets
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY pets_update ON public.pets
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY pets_delete ON public.pets
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());

-- notifications
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.caller_can_notify(user_id));

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- walkers: own row, admin, or the owner of a booking assigned to this walker.
-- Discovery of other walkers goes through walker_directory.
CREATE POLICY walkers_select ON public.walkers
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.owner_has_booking_with_walker(id)
  );

CREATE POLICY walkers_insert ON public.walkers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY walkers_update ON public.walkers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- walker_availability
CREATE POLICY walker_availability_select ON public.walker_availability
  FOR SELECT TO authenticated
  USING (public.availability_visible(walker_id));

CREATE POLICY walker_availability_insert ON public.walker_availability
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.walkers w
      WHERE w.id = walker_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY walker_availability_update ON public.walker_availability
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.walkers w WHERE w.id = walker_id AND w.user_id = auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.walkers w WHERE w.id = walker_id AND w.user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY walker_availability_delete ON public.walker_availability
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.walkers w WHERE w.id = walker_id AND w.user_id = auth.uid())
    OR public.is_admin()
  );

-- locations: owner + assigned walker can read; only the assigned walker inserts during the walk.
CREATE POLICY locations_select ON public.locations
  FOR SELECT TO authenticated
  USING (public.caller_can_read_location(booking_id));

CREATE POLICY locations_insert ON public.locations
  FOR INSERT TO authenticated
  WITH CHECK (public.caller_can_insert_location(booking_id, walker_id));

-- reviews: only booking participants, and only after the walk is completed.
CREATE POLICY booking_reviews_select ON public.booking_reviews
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR reviewer_id = auth.uid()
    OR reviewee_id = auth.uid()
    OR public.caller_is_booking_participant(booking_id)
  );

CREATE POLICY booking_reviews_insert ON public.booking_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      LEFT JOIN public.walkers w ON w.id = b.walker_id
      WHERE b.id = booking_id
        AND b.status = 'completed'
        AND (b.user_id = auth.uid() OR w.user_id = auth.uid())
    )
  );

CREATE POLICY booking_reviews_update ON public.booking_reviews
  FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid() OR public.is_admin())
  WITH CHECK (reviewer_id = auth.uid() OR public.is_admin());

-- payouts / transactions: read own rows. Writes only through SECURITY DEFINER RPCs or service_role.
CREATE POLICY payouts_select ON public.payouts
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.walkers w
      WHERE w.id = payouts.walker_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY transactions_select ON public.transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage
-- Mary's hotfix removed the SELECT/DELETE policies that were `true` for every
-- bucket. Avatars and walker_documents reads therefore depend on the policies
-- created here (and on whatever bucket-scoped policies remain until this runs).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.storage_owned_by_caller(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND object_name IS NOT NULL
    AND (
      (storage.foldername(object_name))[1] = auth.uid()::text
      OR object_name LIKE (auth.uid()::text || '/%')
      OR object_name LIKE (auth.uid()::text || '-%')
      OR object_name LIKE (auth.uid()::text || '_%')
      OR object_name LIKE ('avatars/' || auth.uid()::text || '%')
    );
$$;

REVOKE ALL ON FUNCTION public.storage_owned_by_caller(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_owned_by_caller(text) TO authenticated, service_role;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        btrim(coalesce(qual, ''), '() ') = 'true'
        OR btrim(coalesce(with_check, ''), '() ') = 'true'
        OR coalesce(qual, '') ILIKE '%mari.99.mca@gmail.com%'
        OR coalesce(with_check, '') ILIKE '%mari.99.mca@gmail.com%'
        OR policyname ILIKE '%109cf73%'
        OR policyname ILIKE '%mascota%'
        OR policyname ILIKE '%avatar%'
        OR policyname ILIKE '%pet photo%'
        OR policyname ILIKE '%walker document%'
        OR coalesce(qual, '') ILIKE '%walker_documents%'
        OR coalesce(with_check, '') ILIKE '%walker_documents%'
        OR coalesce(qual, '') ILIKE '%pet-photos%'
        OR coalesce(with_check, '') ILIKE '%pet-photos%'
        OR coalesce(qual, '') ILIKE '%avatars%'
        OR coalesce(with_check, '') ILIKE '%avatars%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Allow authenticated users to view pet photos 109cf73_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view pet photos 2 109cf73_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view pet photos 3 109cf73_0" ON storage.objects;
DROP POLICY IF EXISTS "Ver fotos de mascotas" ON storage.objects;
DROP POLICY IF EXISTS "Borrar mis fotos de mascotas" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
DROP POLICY IF EXISTS "pet_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "pet_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "walker_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "walker_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "walker_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "walker_documents_delete" ON storage.objects;

-- Pet photos stay readable inside the bucket (walkers see the dogs they walk).
-- Writes and deletes are limited to the owner's folder / legacy own prefix.
CREATE POLICY "Ver fotos de mascotas" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pet-photos');

CREATE POLICY "Borrar mis fotos de mascotas" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pet-photos' AND public.storage_owned_by_caller(name));

CREATE POLICY pet_photos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pet-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY pet_photos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'pet-photos' AND public.storage_owned_by_caller(name))
  WITH CHECK (
    bucket_id = 'pet-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY avatars_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY avatars_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY avatars_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND public.storage_owned_by_caller(name))
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY avatars_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND public.storage_owned_by_caller(name));

CREATE POLICY walker_documents_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'walker_documents'
    AND (public.storage_owned_by_caller(name) OR public.is_admin())
  );

CREATE POLICY walker_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'walker_documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY walker_documents_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'walker_documents'
    AND (public.storage_owned_by_caller(name) OR public.is_admin())
  )
  WITH CHECK (
    bucket_id = 'walker_documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY walker_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'walker_documents'
    AND (public.storage_owned_by_caller(name) OR public.is_admin())
  );
