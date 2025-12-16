-- Add RLS policy for pricing_public view to allow public read access (intentional for pricing display)
-- Note: pricing_public is a VIEW, so we need to handle it differently
-- The underlying pricing_config table already has RLS

-- Add admin SELECT policy for profiles table so admins can provide support
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::app_role));