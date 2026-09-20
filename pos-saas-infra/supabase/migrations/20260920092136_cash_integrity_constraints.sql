-- Prevent two concurrent open shifts for the same cashier.
CREATE UNIQUE INDEX IF NOT EXISTS shifts_one_open_per_user
  ON public.shifts (user_id)
  WHERE status = 'open';
