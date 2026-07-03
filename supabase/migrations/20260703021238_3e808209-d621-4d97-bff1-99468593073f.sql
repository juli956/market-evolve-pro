
ALTER TABLE public.products
  DROP COLUMN price,
  DROP COLUMN min_stock,
  DROP COLUMN category,
  ADD COLUMN provider TEXT,
  ADD COLUMN control_stock BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN history JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.sales
  DROP COLUMN note,
  ADD COLUMN notes TEXT,
  ADD COLUMN payment_method TEXT;
