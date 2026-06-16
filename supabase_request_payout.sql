-- =========================================================================
-- Migration 5: Security + Audit Fixes
-- =========================================================================
-- Adds server-side auth checks to prevent unauthorized RPC calls, creates
-- admin_verify_walker RPC, and fixes profile role override bug.
-- =========================================================================

-- =========================================================================
-- 1. request_payout (updated): verify caller owns the walker
-- =========================================================================
CREATE OR REPLACE FUNCTION public.request_payout(
  p_walker_id uuid,
  p_amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
BEGIN
  -- Validate amount
  IF p_amount IS NULL OR p_amount < 50000 THEN
    RAISE EXCEPTION 'El monto mínimo para retirar es $50.000'
      USING ERRCODE = '22023';
  END IF;

  -- Get walker user_id + bank account
  SELECT w.user_id, p.bank_account_type, p.bank_account_number
    INTO v_walker_user_id, v_bank_type, v_bank_number
  FROM public.walkers w
  LEFT JOIN public.user_profiles p ON p.user_id = w.user_id
  WHERE w.id = p_walker_id;

  IF v_walker_user_id IS NULL THEN
    RAISE EXCEPTION 'Paseador no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  -- SECURITY: verify caller owns this walker
  IF v_walker_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'No autorizado'
      USING ERRCODE = '42501';
  END IF;

  IF v_bank_number IS NULL OR TRIM(v_bank_number) = '' THEN
    RAISE EXCEPTION 'Necesitás registrar tu cuenta bancaria antes de retirar. Editá tu perfil.'
      USING ERRCODE = '23514';
  END IF;

  -- Lock balance row (prevents concurrent withdrawals)
  SELECT balance INTO v_walker_balance
  FROM public.user_profiles
  WHERE user_id = v_walker_user_id
  FOR UPDATE;

  -- Subtract any already-pending withdrawals from available balance
  SELECT COALESCE(SUM(amount), 0) INTO v_pending_sum
  FROM public.payouts
  WHERE walker_id = p_walker_id
    AND status = 'pending';

  v_available := v_walker_balance - v_pending_sum;

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponible para retirar: %', v_available
      USING ERRCODE = '23514';
  END IF;

  -- Debit balance immediately (refunded if admin rejects)
  UPDATE public.user_profiles
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE user_id = v_walker_user_id;

  -- Generate payout reference
  v_payout_number := 'PO-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad((floor(random() * 10000))::text, 4, '0');

  -- Create payout with pending status
  INSERT INTO public.payouts (
    walker_id, amount, status, payout_date, notes
  ) VALUES (
    p_walker_id, p_amount, 'pending', CURRENT_DATE,
    'Solicitud #' || v_payout_number ||
    ' | Banco: ' || COALESCE(v_bank_type, 'Nequi') ||
    ' | Cuenta: ' || v_bank_number
  )
  RETURNING id INTO v_payout_id;

  -- Insert pending transaction (visible in walker's wallet history)
  INSERT INTO public.transactions (
    user_id, transaction_type, amount, fee_amount, net_amount,
    currency, payment_method, status, description, metadata
  ) VALUES (
    v_walker_user_id, 'withdrawal', p_amount, 0, p_amount,
    'COP', 'wallet', 'pending', 'Retiro solicitado #' || v_payout_number,
    jsonb_build_object('payout_id', v_payout_id, 'payout_number', v_payout_number, 'status', 'pending')
  );

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'payout_number', v_payout_number,
    'amount', p_amount,
    'balance_after', v_walker_balance - p_amount,
    'available_after', v_available - p_amount,
    'bank_type', v_bank_type,
    'bank_number', v_bank_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_payout(uuid, integer) TO authenticated;

-- =========================================================================
-- 2. process_payout (updated): verify caller is admin via auth.uid()
-- =========================================================================
CREATE OR REPLACE FUNCTION public.process_payout(
  p_payout_id uuid,
  p_admin_user_id uuid,
  p_action text,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payout public.payouts%ROWTYPE;
  v_walker_user_id uuid;
  v_new_status text;
  v_is_admin boolean;
BEGIN
  -- SECURITY: verify caller is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: solo administradores'
      USING ERRCODE = '42501';
  END IF;

  -- Validate action
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Acción inválida: %. Use "approve" o "reject"', p_action
      USING ERRCODE = '22023';
  END IF;

  -- Lock payout row
  SELECT * INTO v_payout
  FROM public.payouts
  WHERE id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Retiro no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_payout.status <> 'pending' THEN
    RAISE EXCEPTION 'Este retiro ya fue procesado (estado actual: %)', v_payout.status
      USING ERRCODE = '23514';
  END IF;

  -- Get walker user_id
  SELECT user_id INTO v_walker_user_id
  FROM public.walkers
  WHERE id = v_payout.walker_id;

  IF v_walker_user_id IS NULL THEN
    RAISE EXCEPTION 'Paseador no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'approve' THEN
    v_new_status := 'completed';

    UPDATE public.payouts
    SET status = v_new_status,
        payout_date = CURRENT_DATE,
        notes = COALESCE(v_payout.notes, '') ||
                E'\n✅ Aprobado y pagado por admin ' || COALESCE(p_admin_user_id, auth.uid())::text ||
                COALESCE(' | ' || p_admin_note, '')
    WHERE id = p_payout_id;

    UPDATE public.transactions
    SET status = 'completed',
        description = description || ' (Pagado)',
        updated_at = now()
    WHERE metadata->>'payout_id' = p_payout_id::text
      AND status = 'pending';

  ELSE  -- reject
    v_new_status := 'rejected';

    -- Refund the walker's balance (the original debit is reversed)
    UPDATE public.user_profiles
    SET balance = balance + v_payout.amount,
        updated_at = now()
    WHERE user_id = v_walker_user_id;

    UPDATE public.payouts
    SET status = v_new_status,
        notes = COALESCE(v_payout.notes, '') ||
                E'\n❌ Rechazado por admin ' || COALESCE(p_admin_user_id, auth.uid())::text ||
                COALESCE(' | Motivo: ' || p_admin_note, '')
    WHERE id = p_payout_id;

    UPDATE public.transactions
    SET status = 'cancelled',
        description = description || ' (Rechazado - saldo devuelto)',
        updated_at = now()
    WHERE metadata->>'payout_id' = p_payout_id::text
      AND status = 'pending';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.process_payout(uuid, uuid, text, text) TO authenticated;

-- =========================================================================
-- 3. admin_verify_walker: approve/reject walker verification with audit
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_verify_walker(
  p_walker_id uuid,
  p_status text,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_walker_user_id uuid;
BEGIN
  -- SECURITY: verify caller is admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'No autorizado: solo administradores'
      USING ERRCODE = '42501';
  END IF;

  -- Validate status
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Estado inválido: %. Use "approved" o "rejected"', p_status
      USING ERRCODE = '22023';
  END IF;

  -- Get walker's user_id
  SELECT user_id INTO v_walker_user_id
  FROM public.walkers
  WHERE id = p_walker_id;

  IF v_walker_user_id IS NULL THEN
    RAISE EXCEPTION 'Paseador no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  -- Update walker verification with audit trail
  UPDATE public.walkers
  SET overall_verification_status = p_status,
      id_verification_status = CASE WHEN p_status = 'approved' THEN 'approved' ELSE id_verification_status END,
      background_check_status = CASE WHEN p_status = 'approved' THEN 'approved' ELSE background_check_status END,
      verified_by_admin_id = auth.uid(),
      verified_at = now(),
      rejection_reason = CASE WHEN p_status = 'rejected' THEN COALESCE(p_admin_note, 'Sin motivo especificado') ELSE rejection_reason END,
      verification_notes = CASE WHEN p_status = 'rejected' THEN COALESCE(p_admin_note, 'Sin motivo especificado') ELSE verification_notes END
  WHERE id = p_walker_id;

  -- Notify the walker
  IF p_status = 'approved' THEN
    INSERT INTO public.notifications (user_id, title, body, link_to)
    VALUES (
      v_walker_user_id,
      '✅ Verificación Aprobada',
      'Tu perfil de paseador fue verificado. Ya podés recibir paseos.',
      '/walker-home'
    );
  ELSE
    INSERT INTO public.notifications (user_id, title, body, link_to)
    VALUES (
      v_walker_user_id,
      '❌ Verificación Rechazada',
      'Tu verificación fue rechazada. Motivo: ' || COALESCE(p_admin_note, 'Sin especificar') || '. Corregí los documentos y volvé a intentar.',
      '/onboarding-walker'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'walker_id', p_walker_id,
    'new_status', p_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_verify_walker(uuid, text, text) TO authenticated;
