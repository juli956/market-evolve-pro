CREATE TABLE public.stock_state (
  user_id uuid PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_state TO authenticated;
GRANT ALL ON public.stock_state TO service_role;
ALTER TABLE public.stock_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stock_state" ON public.stock_state FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER stock_state_touch BEFORE UPDATE ON public.stock_state FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();