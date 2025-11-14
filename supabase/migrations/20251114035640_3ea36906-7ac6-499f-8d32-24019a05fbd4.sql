-- Update pricing_public view to only show active pricing and remove admin contact fields
DROP VIEW IF EXISTS public.pricing_public;

CREATE VIEW public.pricing_public AS
SELECT 
  id,
  plan_type,
  amount,
  currency,
  is_active,
  created_at,
  updated_at
FROM public.pricing_config
WHERE is_active = true;