-- Fix the vulnerable RLS policy on free_trials that allows authenticated users to view ALL anonymous trials
-- The old policy had: ((auth.uid() = user_id) OR (user_id IS NULL)) which exposed anonymous trial data

-- Drop the vulnerable policy
DROP POLICY IF EXISTS "Users can view own trials" ON public.free_trials;

-- Create the fixed policy - users can ONLY view their own trials (not anonymous ones)
CREATE POLICY "Users can view own trials" ON public.free_trials 
FOR SELECT USING (
  (auth.uid() = user_id) AND (user_id IS NOT NULL)
);