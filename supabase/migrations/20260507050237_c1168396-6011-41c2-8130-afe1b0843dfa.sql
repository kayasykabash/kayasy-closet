
-- Extend orders with admin credit management fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Extend profiles with suspension controls
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credit_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Admin: update credit order status (with automatic effects)
CREATE OR REPLACE FUNCTION public.admin_update_credit_order(
  _order_id UUID,
  _status TEXT,
  _amount_due NUMERIC DEFAULT NULL,
  _due_date TIMESTAMPTZ DEFAULT NULL,
  _admin_notes TEXT DEFAULT NULL,
  _confirm_payment BOOLEAN DEFAULT false,
  _payment_reference TEXT DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
  uid UUID := auth.uid();
  diff NUMERIC;
BEGIN
  IF NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  -- normalize status
  IF _status NOT IN ('pending','partial','paid','overdue','suspended','cleared') THEN
    RAISE EXCEPTION 'Invalid status: %', _status;
  END IF;

  -- Apply changes
  IF _status IN ('paid','cleared') THEN
    diff := COALESCE(o.amount_due, o.total);
    UPDATE public.profiles
      SET credit_balance = GREATEST(0, COALESCE(credit_balance,0) - diff),
          credit_suspended = CASE WHEN _status = 'cleared' THEN false ELSE credit_suspended END
      WHERE user_id = o.user_id;
    UPDATE public.orders
      SET amount_due = 0,
          payment_status = 'paid',
          is_overdue = false,
          payment_confirmed = true,
          confirmed_by = uid,
          confirmed_at = now(),
          admin_notes = COALESCE(_admin_notes, admin_notes),
          due_date = COALESCE(_due_date, due_date),
          payment_reference = COALESCE(NULLIF(_payment_reference,''), payment_reference)
      WHERE id = _order_id;
    INSERT INTO public.credit_repayments(user_id, order_id, amount, payment_method, transaction_reference, status, remaining_after, fully_paid)
    VALUES (o.user_id, o.id, diff, 'admin_confirmed',
            'ADM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
            'success', 0, true);
    INSERT INTO public.notification_logs(user_id, order_id, type, message)
    VALUES (o.user_id, o.id, 'payment',
      'Admin confirmed payment. Order #' || substr(o.id::text,1,8) || ' marked as ' || _status || '.');
  ELSIF _status = 'partial' THEN
    IF _amount_due IS NULL THEN RAISE EXCEPTION 'amount_due required for partial'; END IF;
    diff := COALESCE(o.amount_due, o.total) - _amount_due;
    IF diff > 0 THEN
      UPDATE public.profiles
        SET credit_balance = GREATEST(0, COALESCE(credit_balance,0) - diff)
        WHERE user_id = o.user_id;
      INSERT INTO public.credit_repayments(user_id, order_id, amount, payment_method, transaction_reference, status, remaining_after, fully_paid)
      VALUES (o.user_id, o.id, diff, 'admin_confirmed',
              'ADM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
              'success', _amount_due, false);
    END IF;
    UPDATE public.orders
      SET amount_due = _amount_due,
          payment_status = 'pending',
          payment_confirmed = COALESCE(_confirm_payment, payment_confirmed),
          confirmed_by = CASE WHEN _confirm_payment THEN uid ELSE confirmed_by END,
          confirmed_at = CASE WHEN _confirm_payment THEN now() ELSE confirmed_at END,
          admin_notes = COALESCE(_admin_notes, admin_notes),
          due_date = COALESCE(_due_date, due_date),
          payment_reference = COALESCE(NULLIF(_payment_reference,''), payment_reference)
      WHERE id = _order_id;
  ELSIF _status = 'overdue' THEN
    UPDATE public.orders
      SET is_overdue = true,
          payment_status = CASE WHEN payment_status = 'paid' THEN 'pending' ELSE payment_status END,
          admin_notes = COALESCE(_admin_notes, admin_notes),
          due_date = COALESCE(_due_date, due_date)
      WHERE id = _order_id;
  ELSIF _status = 'suspended' THEN
    UPDATE public.profiles
      SET credit_suspended = true,
          suspension_reason = COALESCE(_admin_notes, suspension_reason)
      WHERE user_id = o.user_id;
    UPDATE public.orders
      SET admin_notes = COALESCE(_admin_notes, admin_notes)
      WHERE id = _order_id;
  ELSE -- pending
    UPDATE public.orders
      SET payment_status = 'pending',
          is_overdue = false,
          admin_notes = COALESCE(_admin_notes, admin_notes),
          due_date = COALESCE(_due_date, due_date),
          amount_due = COALESCE(_amount_due, amount_due)
      WHERE id = _order_id;
  END IF;

  RETURN jsonb_build_object('order_id', _order_id, 'status', _status);
END;
$$;

-- Admin: toggle suspension on a customer
CREATE OR REPLACE FUNCTION public.admin_set_credit_suspension(
  _user_id UUID,
  _suspended BOOLEAN,
  _reason TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  UPDATE public.profiles
    SET credit_suspended = _suspended,
        suspension_reason = CASE WHEN _suspended THEN _reason ELSE NULL END
    WHERE user_id = _user_id;
  INSERT INTO public.notification_logs(user_id, type, message)
  VALUES (_user_id, 'credit_status',
    CASE WHEN _suspended THEN 'Your credit access has been suspended.' || COALESCE(' Reason: ' || _reason, '')
         ELSE 'Your credit access has been restored.' END);
END;
$$;

-- Update apply_credit_on_order to also block suspended users
CREATE OR REPLACE FUNCTION public.apply_credit_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prof_credit_limit NUMERIC;
  prof_credit_balance NUMERIC;
  prof_credit_approved BOOLEAN;
  prof_credit_score INTEGER;
  prof_suspended BOOLEAN;
  overdue_count INTEGER;
BEGIN
  IF NEW.payment_method = 'credit' THEN
    SELECT COUNT(*) INTO overdue_count
    FROM public.orders
    WHERE user_id = NEW.user_id
      AND is_overdue = true
      AND payment_status != 'paid';
    IF overdue_count > 0 THEN
      RAISE EXCEPTION 'You have overdue payments. Please settle your debt before placing new orders.';
    END IF;

    SELECT credit_limit, credit_balance, credit_approved, credit_score, credit_suspended
      INTO prof_credit_limit, prof_credit_balance, prof_credit_approved, prof_credit_score, prof_suspended
    FROM public.profiles WHERE user_id = NEW.user_id;

    IF COALESCE(prof_suspended, false) THEN
      RAISE EXCEPTION 'Your credit access is suspended. Please contact support.';
    END IF;
    IF NOT COALESCE(prof_credit_approved, false) THEN
      RAISE EXCEPTION 'Credit not approved for this account';
    END IF;
    IF COALESCE(prof_credit_score, 100) < 50 THEN
      RAISE EXCEPTION 'Credit score too low. Please pay outstanding balances.';
    END IF;
    IF (COALESCE(prof_credit_balance, 0) + NEW.total) > COALESCE(prof_credit_limit, 0) THEN
      RAISE EXCEPTION 'Credit limit exceeded';
    END IF;

    UPDATE public.profiles
      SET credit_balance = COALESCE(credit_balance, 0) + NEW.total
      WHERE user_id = NEW.user_id;

    NEW.amount_due := NEW.total;
    NEW.due_date := COALESCE(NEW.due_date, now() + INTERVAL '7 days');
    NEW.payment_status := 'pending';
  END IF;
  RETURN NEW;
END;
$function$;
