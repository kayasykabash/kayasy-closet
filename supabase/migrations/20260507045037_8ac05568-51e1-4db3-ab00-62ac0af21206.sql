CREATE TABLE IF NOT EXISTS public.credit_repayments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'transfer',
  transaction_reference TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  remaining_after NUMERIC NOT NULL DEFAULT 0,
  fully_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_repayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own repayments" ON public.credit_repayments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins manage repayments" ON public.credit_repayments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert repayments" ON public.credit_repayments
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_credit_repayments_user ON public.credit_repayments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_repayments_order ON public.credit_repayments(order_id);

-- Update repayment RPC to log into history
CREATE OR REPLACE FUNCTION public.repay_credit_order(_order_id uuid, _amount numeric, _method text DEFAULT 'transfer'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o RECORD;
  new_due NUMERIC;
  uid UUID := auth.uid();
  ref TEXT;
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
  ref := 'TXN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));

  UPDATE public.profiles
    SET credit_balance = GREATEST(0, COALESCE(credit_balance,0) - _amount)
    WHERE user_id = o.user_id;

  IF new_due <= 0 THEN
    UPDATE public.orders
      SET amount_due = 0,
          payment_status = 'paid',
          is_overdue = false,
          payment_reference = COALESCE(payment_reference,'') || ' | repaid:' || _method || ':' || ref
      WHERE id = _order_id;
  ELSE
    UPDATE public.orders
      SET amount_due = new_due,
          payment_reference = COALESCE(payment_reference,'') || ' | partial:' || _method || ':' || _amount || ':' || ref
      WHERE id = _order_id;
  END IF;

  INSERT INTO public.credit_repayments(user_id, order_id, amount, payment_method, transaction_reference, status, remaining_after, fully_paid)
  VALUES (o.user_id, o.id, _amount, _method, ref, 'success', GREATEST(0,new_due), new_due <= 0);

  INSERT INTO public.notification_logs(user_id, order_id, type, message)
  VALUES (o.user_id, o.id, 'payment',
    CASE WHEN new_due <= 0
      THEN 'Payment received. Order #' || substr(o.id::text,1,8) || ' marked as fully paid.'
      ELSE 'Partial payment of ₦' || _amount || ' received for order #' || substr(o.id::text,1,8) || '. Outstanding: ₦' || new_due || '.'
    END);

  RETURN jsonb_build_object('order_id', o.id, 'amount_paid', _amount, 'remaining', new_due, 'fully_paid', new_due <= 0, 'reference', ref);
END;
$function$;