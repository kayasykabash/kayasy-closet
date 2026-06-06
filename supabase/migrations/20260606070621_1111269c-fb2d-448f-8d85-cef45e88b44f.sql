
-- 1. product_variants table
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  design_name text NOT NULL,
  color text,
  images text[] NOT NULL DEFAULT '{}',
  stock integer NOT NULL DEFAULT 0,
  extra_price numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product variants"
  ON public.product_variants FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage product variants"
  ON public.product_variants FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_product_variants_updated
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);

-- 2. Log variant stock changes to stock_movements
CREATE OR REPLACE FUNCTION public.log_variant_stock_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.stock_movements(product_id, action, quantity_change, new_stock, reason, performed_by)
    VALUES (NEW.product_id, 'variant_created', NEW.stock, NEW.stock,
            'Variant: ' || NEW.design_name, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND OLD.stock IS DISTINCT FROM NEW.stock THEN
    INSERT INTO public.stock_movements(product_id, action, quantity_change, new_stock, reason, performed_by)
    VALUES (NEW.product_id, 'variant_updated', NEW.stock - OLD.stock, NEW.stock,
            'Variant: ' || NEW.design_name, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_variant_stock_log
  AFTER INSERT OR UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.log_variant_stock_change();

-- 3. cart_items: variant columns
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_image text;

-- 4. order_items: variant columns (snapshot)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid,
  ADD COLUMN IF NOT EXISTS variant_design text,
  ADD COLUMN IF NOT EXISTS variant_color text,
  ADD COLUMN IF NOT EXISTS variant_image text;

-- 5. Update decrement_product_stock to handle variants
CREATE OR REPLACE FUNCTION public.decrement_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_qty INTEGER;
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.product_variants
      SET stock = GREATEST(0, stock - NEW.quantity)
      WHERE id = NEW.variant_id
      RETURNING stock INTO new_qty;
    INSERT INTO public.stock_movements(product_id, action, quantity_change, new_stock, reason)
    VALUES (NEW.product_id, 'sold', -NEW.quantity, new_qty,
            'Order ' || NEW.order_id || ' (variant ' || COALESCE(NEW.variant_design,'') || ')');
  ELSE
    UPDATE public.products
      SET stock = GREATEST(0, stock - NEW.quantity)
      WHERE id = NEW.product_id
      RETURNING stock INTO new_qty;
    INSERT INTO public.stock_movements(product_id, action, quantity_change, new_stock, reason)
    VALUES (NEW.product_id, 'sold', -NEW.quantity, new_qty, 'Order ' || NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$;
