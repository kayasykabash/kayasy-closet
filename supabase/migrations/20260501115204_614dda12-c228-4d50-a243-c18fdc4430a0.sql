
-- Product variations
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS colors TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS designs TEXT[] DEFAULT '{}'::text[];

-- Cart variations
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS design TEXT;

-- Order items variations
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS design TEXT;

-- Order payment method + credit fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS amount_due NUMERIC DEFAULT 0;

-- Profile credit fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credit_balance NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_approved BOOLEAN NOT NULL DEFAULT false;

-- Stock decrement trigger: when an order_item is inserted, decrement product stock
CREATE OR REPLACE FUNCTION public.decrement_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET stock = GREATEST(0, stock - NEW.quantity)
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_stock ON public.order_items;
CREATE TRIGGER trg_decrement_stock
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.decrement_product_stock();

-- Credit deduction trigger: when order with payment_method=credit is created, increase user credit_balance
CREATE OR REPLACE FUNCTION public.apply_credit_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof_credit_limit NUMERIC;
  prof_credit_balance NUMERIC;
  prof_credit_approved BOOLEAN;
BEGIN
  IF NEW.payment_method = 'credit' THEN
    SELECT credit_limit, credit_balance, credit_approved
      INTO prof_credit_limit, prof_credit_balance, prof_credit_approved
    FROM public.profiles WHERE user_id = NEW.user_id;

    IF NOT COALESCE(prof_credit_approved, false) THEN
      RAISE EXCEPTION 'Credit not approved for this account';
    END IF;
    IF (COALESCE(prof_credit_balance, 0) + NEW.total) > COALESCE(prof_credit_limit, 0) THEN
      RAISE EXCEPTION 'Credit limit exceeded';
    END IF;

    UPDATE public.profiles
    SET credit_balance = COALESCE(credit_balance, 0) + NEW.total
    WHERE user_id = NEW.user_id;

    NEW.amount_due := NEW.total;
    NEW.due_date := COALESCE(NEW.due_date, now() + INTERVAL '30 days');
    NEW.payment_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_credit ON public.orders;
CREATE TRIGGER trg_apply_credit
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.apply_credit_on_order();
