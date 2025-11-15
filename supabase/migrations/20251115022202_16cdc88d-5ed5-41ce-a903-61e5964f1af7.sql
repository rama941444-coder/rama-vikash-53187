-- Fix security definer view issue by recreating pricing_public with security_invoker
DROP VIEW IF EXISTS public.pricing_public;

CREATE VIEW public.pricing_public 
WITH (security_invoker='true') AS
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