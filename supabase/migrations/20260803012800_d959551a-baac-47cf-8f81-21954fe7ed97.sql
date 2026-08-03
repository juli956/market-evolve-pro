ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_type TEXT NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS production_config JSONB;