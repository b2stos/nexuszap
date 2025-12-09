-- Create table for per-user UAZAPI configuration
CREATE TABLE public.uazapi_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  base_url text NOT NULL,
  instance_token text NOT NULL,
  instance_name text,
  is_active boolean DEFAULT true,
  last_connected_at timestamptz,
  phone_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.uazapi_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own uazapi config" ON public.uazapi_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own uazapi config" ON public.uazapi_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own uazapi config" ON public.uazapi_config
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own uazapi config" ON public.uazapi_config
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_uazapi_config_updated_at
  BEFORE UPDATE ON public.uazapi_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();