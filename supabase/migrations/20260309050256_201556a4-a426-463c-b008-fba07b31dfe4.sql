-- Allow all authenticated users to read student_progress for leaderboard
CREATE POLICY "Authenticated users can view all progress for leaderboard"
ON public.student_progress
FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to read profiles for leaderboard
CREATE POLICY "Authenticated users can view all profiles for leaderboard"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);