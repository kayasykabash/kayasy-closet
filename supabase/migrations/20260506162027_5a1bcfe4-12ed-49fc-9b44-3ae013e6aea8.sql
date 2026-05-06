-- Update credit order trigger: 7-day due date + block on overdue debts
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
  overdue_count INTEGER;
BEGIN
  IF NEW.payment_method = 'credit' THEN
    -- Block if user has any unpaid overdue orders
    SELECT COUNT(*) INTO overdue_count
    FROM public.orders
    WHERE user_id = NEW.user_id
      AND is_overdue = true
      AND payment_status != 'paid';
    IF overdue_count > 0 THEN
      RAISE EXCEPTION 'You have overdue payments. Please settle your debt before placing new orders.';
    END IF;

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
    NEW.due_date := COALESCE(NEW.due_date, now() + INTERVAL '7 days');
    NEW.payment_status := 'pending';
  END IF;
  RETURN NEW;
END;
$function$;

-- Make sure trigger exists on orders
DROP TRIGGER IF EXISTS trg_apply_credit_on_order ON public.orders;
CREATE TRIGGER trg_apply_credit_on_order
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.apply_credit_on_order();

DROP TRIGGER IF EXISTS trg_adjust_credit_score_on_payment ON public.orders;
CREATE TRIGGER trg_adjust_credit_score_on_payment
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.adjust_credit_score_on_payment();

-- Enable extensions for cron job
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;