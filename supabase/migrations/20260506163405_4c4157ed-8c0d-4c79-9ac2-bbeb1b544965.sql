
-- Notification logs
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  order_id UUID,
  type TEXT NOT NULL CHECK (type IN ('reminder','overdue','info','payment')),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notification_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notification_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage notifications" ON public.notification_logs
  FOR ALL USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "System can insert notifications" ON public.notification_logs
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notif_user_read ON public.notification_logs(user_id, is_read, created_at DESC);

-- Repayment RPC
CREATE OR REPLACE FUNCTION public.repay_credit_order(
  _order_id UUID,
  _amount NUMERIC,
  _method TEXT DEFAULT 'transfer'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
  new_due NUMERIC;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.user_id <> uid AND NOT public.has_role(uid,'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF o.payment_method <> 'credit' THEN RAISE EXCEPTION 'Order is not a credit order'; END IF;
  IF o.payment_status = 'paid' THEN RAISE EXCEPTION 'Order is already paid'; END IF;
  IF _amount > COALESCE(o.amount_due, o.total) THEN RAISE EXCEPTION 'Amount exceeds outstanding balance'; END IF;

  new_due := COALESCE(o.amount_due, o.total) - _amount;

  -- Reduce user's credit balance
  UPDATE public.profiles
    SET credit_balance = GREATEST(0, COALESCE(credit_balance,0) - _amount)
    WHERE user_id = o.user_id;

  IF new_due <= 0 THEN
    -- Fully paid (existing trigger adjust_credit_score_on_payment will bump score)
    UPDATE public.orders
      SET amount_due = 0,
          payment_status = 'paid',
          is_overdue = false,
          payment_reference = COALESCE(payment_reference,'') || ' | repaid:' || _method
      WHERE id = _order_id;
  ELSE
    UPDATE public.orders
      SET amount_due = new_due,
          payment_reference = COALESCE(payment_reference,'') || ' | partial:' || _method || ':' || _amount
      WHERE id = _order_id;
  END IF;

  INSERT INTO public.notification_logs(user_id, order_id, type, message)
  VALUES (o.user_id, o.id, 'payment',
    CASE WHEN new_due <= 0
      THEN 'Payment received. Order #' || substr(o.id::text,1,8) || ' marked as fully paid.'
      ELSE 'Partial payment of ₦' || _amount || ' received for order #' || substr(o.id::text,1,8) || '. Outstanding: ₦' || new_due || '.'
    END);

  RETURN jsonb_build_object('order_id', o.id, 'amount_paid', _amount, 'remaining', new_due, 'fully_paid', new_due <= 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.repay_credit_order(UUID, NUMERIC, TEXT) TO authenticated;

-- Reminder generator
CREATE OR REPLACE FUNCTION public.generate_credit_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted INTEGER := 0;
  r RECORD;
BEGIN
  -- Upcoming (due within 2 days, not overdue, not paid)
  FOR r IN
    SELECT o.id, o.user_id, o.due_date, COALESCE(o.amount_due,o.total) AS amt
    FROM public.orders o
    WHERE o.payment_method = 'credit'
      AND o.payment_status != 'paid'
      AND o.is_overdue = false
      AND o.due_date IS NOT NULL
      AND o.due_date <= now() + INTERVAL '2 days'
      AND o.due_date >= now()
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notification_logs n
      WHERE n.order_id = r.id AND n.type = 'reminder'
        AND n.created_at > now() - INTERVAL '20 hours'
    ) THEN
      INSERT INTO public.notification_logs(user_id, order_id, type, message)
      VALUES (r.user_id, r.id, 'reminder',
        'Payment due soon. Order #' || substr(r.id::text,1,8) || ' (₦' || r.amt || ') is due on ' || to_char(r.due_date,'YYYY-MM-DD') || '. Please complete payment before the due date.');
      inserted := inserted + 1;
    END IF;
  END LOOP;

  -- Overdue notifications
  FOR r IN
    SELECT o.id, o.user_id, o.due_date, COALESCE(o.amount_due,o.total) AS amt
    FROM public.orders o
    WHERE o.payment_method = 'credit'
      AND o.payment_status != 'paid'
      AND o.is_overdue = true
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notification_logs n
      WHERE n.order_id = r.id AND n.type = 'overdue'
        AND n.created_at > now() - INTERVAL '20 hours'
    ) THEN
      INSERT INTO public.notification_logs(user_id, order_id, type, message)
      VALUES (r.user_id, r.id, 'overdue',
        'Your payment is overdue. Order #' || substr(r.id::text,1,8) || ' (₦' || r.amt || ') was due on ' || to_char(r.due_date,'YYYY-MM-DD') || '. Please settle your balance immediately.');
      inserted := inserted + 1;
    END IF;
  END LOOP;

  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_credit_reminders() TO authenticated, anon;

-- Schedule a daily job (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('credit-daily-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='credit-daily-reminders');
    PERFORM cron.schedule('credit-daily-reminders','0 8 * * *', $cron$
      SELECT public.mark_overdue_orders();
      SELECT public.generate_credit_reminders();
    $cron$);
  END IF;
END $$;
