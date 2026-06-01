ALTER TABLE public.walkers ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT true;
