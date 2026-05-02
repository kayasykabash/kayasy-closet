-- ===== Products: cost price for profit tracking =====
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price NUMERIC NOT NULL DEFAULT 0;

-- ===== Profiles: credit score =====
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credit_score INTEGER NOT NULL DEFAULT 100;

-- ===== Orders: overdue + delivery zone =====
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_zone_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC NOT NULL DEFAULT 0;

-- ===== Delivery zones =====
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  state TEXT,
  city TEXT,
  fee NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active zones" ON public.delivery_zones FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage zones" ON public.delivery_zones FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ===== Stock movements =====
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'sold', 'restocked', 'adjusted'
  quantity_change INTEGER NOT NULL DEFAULT 0,
  new_stock INTEGER,
  reason TEXT,
  performed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view stock movements" ON public.stock_movements FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System can insert stock movements" ON public.stock_movements FOR INSERT WITH CHECK (true);

-- ===== User addresses =====
CREATE TABLE IF NOT EXISTS public.user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own addresses" ON public.user_addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own addresses" ON public.user_addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own addresses" ON public.user_addresses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own addresses" ON public.user_addresses FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_user_addresses_updated_at BEFORE UPDATE ON public.user_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Return requests =====
CREATE TABLE IF NOT EXISTS public.return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, refunded
  refund_method TEXT, -- 'manual', 'credit'
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own returns" ON public.return_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own returns" ON public.return_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage returns" ON public.return_requests FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_return_requests_updated_at BEFORE UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Stock movement logger trigger =====
CREATE OR REPLACE FUNCTION public.log_product_stock_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.stock_movements(product_id, action, quantity_change, new_stock, performed_by)
    VALUES (NEW.id, 'created', NEW.stock, NEW.stock, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND OLD.stock IS DISTINCT FROM NEW.stock THEN
    INSERT INTO public.stock_movements(product_id, action, quantity_change, new_stock, performed_by)
    VALUES (NEW.id, 'updated', NEW.stock - OLD.stock, NEW.stock, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_product_stock_change ON public.products;
CREATE TRIGGER trg_log_product_stock_change AFTER INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.log_product_stock_change();

-- ===== Update sold-stock decrement to also log =====
CREATE OR REPLACE FUNCTION public.decrement_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_qty INTEGER;
BEGIN
  UPDATE public.products
    SET stock = GREATEST(0, stock - NEW.quantity)
    WHERE id = NEW.product_id
    RETURNING stock INTO new_qty;
  INSERT INTO public.stock_movements(product_id, action, quantity_change, new_stock, reason)
  VALUES (NEW.product_id, 'sold', -NEW.quantity, new_qty, 'Order ' || NEW.order_id);
  RETURN NEW;
END;
$$;

-- Ensure the sold-trigger exists on order_items
DROP TRIGGER IF EXISTS trg_decrement_product_stock ON public.order_items;
CREATE TRIGGER trg_decrement_product_stock AFTER INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.decrement_product_stock();

-- ===== Credit-score block: tighten apply_credit_on_order =====
CREATE OR REPLACE FUNCTION public.apply_credit_on_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prof_credit_limit NUMERIC;
  prof_credit_balance NUMERIC;
  prof_credit_approved BOOLEAN;
  prof_credit_score INTEGER;
BEGIN
  IF NEW.payment_method = 'credit' THEN
    SELECT credit_limit, credit_balance, credit_approved, credit_score
      INTO prof_credit_limit, prof_credit_balance, prof_credit_approved, prof_credit_score
    FROM public.profiles WHERE user_id = NEW.user_id;

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
    NEW.due_date := COALESCE(NEW.due_date, now() + INTERVAL '30 days');
    NEW.payment_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure credit trigger exists on orders
DROP TRIGGER IF EXISTS trg_apply_credit_on_order ON public.orders;
CREATE TRIGGER trg_apply_credit_on_order BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.apply_credit_on_order();

-- ===== Credit score adjustment when paid =====
CREATE OR REPLACE FUNCTION public.adjust_credit_score_on_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid' AND NEW.payment_method = 'credit' THEN
    -- reduce balance
    UPDATE public.profiles
      SET credit_balance = GREATEST(0, COALESCE(credit_balance, 0) - NEW.total),
          credit_score = LEAST(100, GREATEST(0,
            COALESCE(credit_score, 100) +
            CASE WHEN NEW.due_date IS NULL OR now() <= NEW.due_date THEN 2 ELSE -10 END
          ))
      WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_adjust_credit_score_on_payment ON public.orders;
CREATE TRIGGER trg_adjust_credit_score_on_payment AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.adjust_credit_score_on_payment();

-- ===== Mark overdue orders (callable by app/cron) =====
CREATE OR REPLACE FUNCTION public.mark_overdue_orders()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cnt INTEGER;
BEGIN
  UPDATE public.orders
    SET is_overdue = true
    WHERE due_date IS NOT NULL
      AND due_date < now()
      AND payment_status != 'paid'
      AND is_overdue = false;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  -- penalize score for each newly overdue user (-5)
  UPDATE public.profiles p
    SET credit_score = GREATEST(0, credit_score - 5)
    WHERE EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.user_id = p.user_id
        AND o.is_overdue = true
        AND o.payment_status != 'paid'
        AND o.updated_at > now() - INTERVAL '1 minute'
    );
  RETURN cnt;
END;
$$;
