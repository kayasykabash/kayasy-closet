-- Walk-in sales table
CREATE TABLE public.walkin_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC NOT NULL CHECK (total_price >= 0),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  customer_name TEXT,
  notes TEXT,
  sold_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.walkin_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage walkin sales"
ON public.walkin_sales
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_walkin_sales_created_at ON public.walkin_sales(created_at DESC);
CREATE INDEX idx_walkin_sales_product ON public.walkin_sales(product_id);

-- Stock deduction trigger (with insufficient stock guard)
CREATE OR REPLACE FUNCTION public.handle_walkin_sale_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_stock INTEGER;
  new_qty INTEGER;
BEGIN
  SELECT stock INTO current_stock FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  IF current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %', current_stock;
  END IF;

  UPDATE public.products
    SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id
    RETURNING stock INTO new_qty;

  INSERT INTO public.stock_movements(product_id, action, quantity_change, new_stock, reason, performed_by)
  VALUES (NEW.product_id, 'walkin_sale', -NEW.quantity, new_qty, 'Walk-in sale ' || NEW.id, NEW.sold_by);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_walkin_sale_stock
BEFORE INSERT ON public.walkin_sales
FOR EACH ROW EXECUTE FUNCTION public.handle_walkin_sale_stock();

-- Restore stock if a walk-in sale is deleted
CREATE OR REPLACE FUNCTION public.restore_walkin_sale_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_qty INTEGER;
BEGIN
  UPDATE public.products
    SET stock = stock + OLD.quantity
    WHERE id = OLD.product_id
    RETURNING stock INTO new_qty;

  INSERT INTO public.stock_movements(product_id, action, quantity_change, new_stock, reason, performed_by)
  VALUES (OLD.product_id, 'walkin_sale_reversed', OLD.quantity, new_qty, 'Walk-in sale reversed ' || OLD.id, auth.uid());

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_walkin_sale_restore
AFTER DELETE ON public.walkin_sales
FOR EACH ROW EXECUTE FUNCTION public.restore_walkin_sale_stock();