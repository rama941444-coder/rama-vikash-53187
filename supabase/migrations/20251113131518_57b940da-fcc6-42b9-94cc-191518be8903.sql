-- Fix: Restrict free_trials SELECT policy to prevent anonymous trial pattern exposure
-- Drop the overly permissive policy
DROP POLICY "Users can view own trials" ON public.free_trials;

-- Create new policy that only allows users to see their own trials
CREATE POLICY "Users can view own trials" 
ON public.free_trials
FOR SELECT 
USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Add admin policy to view all trials
CREATE POLICY "Admins can view all trials" 
ON public.free_trials
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));