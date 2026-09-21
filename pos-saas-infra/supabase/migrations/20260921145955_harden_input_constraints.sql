-- Input invariants for the operational schema.
-- API validation improves feedback; these constraints remain the final guard.

ALTER TABLE public.categories
  ADD CONSTRAINT categories_name_not_blank CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  ADD CONSTRAINT categories_sort_order_range CHECK (sort_order BETWEEN 0 AND 9999);

ALTER TABLE public.products
  ADD CONSTRAINT products_name_not_blank CHECK (length(btrim(name)) BETWEEN 1 AND 150),
  ADD CONSTRAINT products_price_nonnegative CHECK (price >= 0),
  ADD CONSTRAINT products_prep_time_range CHECK (prep_time_minutes BETWEEN 0 AND 999),
  ADD CONSTRAINT products_description_length CHECK (description IS NULL OR length(description) <= 1000);

ALTER TABLE public.tables_restaurant
  ADD CONSTRAINT tables_name_not_blank CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  ADD CONSTRAINT tables_capacity_range CHECK (capacity BETWEEN 1 AND 999);

ALTER TABLE public.orders
  ADD CONSTRAINT orders_total_nonnegative CHECK (total_amount >= 0),
  ADD CONSTRAINT orders_tax_nonnegative CHECK (tax_amount >= 0),
  ADD CONSTRAINT orders_discount_nonnegative CHECK (discount_amount >= 0),
  ADD CONSTRAINT orders_guests_range CHECK (guests BETWEEN 1 AND 999),
  ADD CONSTRAINT orders_notes_length CHECK (notes IS NULL OR length(notes) <= 1000);

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_quantity_range CHECK (quantity BETWEEN 1 AND 999),
  ADD CONSTRAINT order_items_unit_price_nonnegative CHECK (unit_price >= 0),
  ADD CONSTRAINT order_items_subtotal_nonnegative CHECK (subtotal >= 0),
  ADD CONSTRAINT order_items_notes_length CHECK (notes IS NULL OR length(notes) <= 500);

ALTER TABLE public.payments
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT payments_change_nonnegative CHECK (change_amount >= 0),
  ADD CONSTRAINT payments_reference_length CHECK (reference IS NULL OR length(reference) <= 200);

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_opening_nonnegative CHECK (opening_amount >= 0),
  ADD CONSTRAINT shifts_closing_nonnegative CHECK (closing_amount IS NULL OR closing_amount >= 0),
  ADD CONSTRAINT shifts_closed_at_consistent CHECK (
    (status = 'open' AND closed_at IS NULL) OR (status = 'closed' AND closed_at IS NOT NULL)
  );

ALTER TABLE public.cash_movements
  ADD CONSTRAINT cash_movements_amount_nonnegative CHECK (amount >= 0),
  ADD CONSTRAINT cash_movements_description_length CHECK (
    description IS NULL OR length(description) <= 500
  );

ALTER TABLE public.order_discounts
  ADD CONSTRAINT order_discounts_value_nonnegative CHECK (value >= 0),
  ADD CONSTRAINT order_discounts_amount_nonnegative CHECK (amount >= 0);

ALTER TABLE public.refunds
  ADD CONSTRAINT refunds_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT refunds_reason_not_blank CHECK (length(btrim(reason)) BETWEEN 1 AND 1000);

ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_stock_nonnegative CHECK (current_stock >= 0),
  ADD CONSTRAINT inventory_items_minimum_stock_nonnegative CHECK (minimum_stock >= 0),
  ADD CONSTRAINT inventory_items_cost_nonnegative CHECK (cost_per_unit >= 0);

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_total_nonnegative CHECK (total_amount >= 0),
  ADD CONSTRAINT purchase_orders_notes_length CHECK (notes IS NULL OR length(notes) <= 1000);

ALTER TABLE public.purchase_order_items
  ADD CONSTRAINT purchase_order_items_quantity_positive CHECK (quantity > 0),
  ADD CONSTRAINT purchase_order_items_unit_cost_nonnegative CHECK (unit_cost >= 0),
  ADD CONSTRAINT purchase_order_items_total_nonnegative CHECK (total_cost >= 0);

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_quantity_positive CHECK (quantity > 0),
  ADD CONSTRAINT stock_movements_unit_cost_nonnegative CHECK (unit_cost >= 0),
  ADD CONSTRAINT stock_movements_description_length CHECK (
    description IS NULL OR length(description) <= 300
  );

COMMENT ON CONSTRAINT products_prep_time_range ON public.products IS 'Tiempo de preparación entre 0 y 999 minutos';
COMMENT ON CONSTRAINT orders_guests_range ON public.orders IS 'Número de invitados entre 1 y 999';
COMMENT ON CONSTRAINT payments_amount_positive ON public.payments IS 'Los pagos deben ser positivos';
COMMENT ON CONSTRAINT shifts_closed_at_consistent ON public.shifts IS 'Una caja abierta no puede tener fecha de cierre y viceversa';
