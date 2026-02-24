-- Add llm_txt_status column to tenants table
ALTER TABLE public.tenants
ADD COLUMN llm_txt_status text DEFAULT 'missing'::text CHECK (llm_txt_status IN ('missing', 'outdated', 'updated'));
