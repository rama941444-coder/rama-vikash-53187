-- 1. Remove anon (and PUBLIC) discoverability / access on all public objects
REVOKE ALL ON public.profiles FROM anon, PUBLIC;
REVOKE ALL ON public.student_progress FROM anon, PUBLIC;
REVOKE ALL ON public.subscriptions FROM anon, PUBLIC;
REVOKE ALL ON public.free_trials FROM anon, PUBLIC;
REVOKE ALL ON public.user_roles FROM anon, PUBLIC;
REVOKE ALL ON public.audit_logs FROM anon, PUBLIC;
REVOKE ALL ON public.pricing_config FROM anon, PUBLIC;
REVOKE ALL ON public.pricing_public FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_progress TO authenticated;
GRANT ALL ON public.student_progress TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
GRANT SELECT, INSERT ON public.free_trials TO authenticated;
GRANT ALL ON public.free_trials TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_config TO authenticated;
GRANT ALL ON public.pricing_config TO service_role;
GRANT SELECT ON public.pricing_public TO authenticated;
GRANT ALL ON public.pricing_public TO service_role;

-- 2. SECURITY DEFINER functions: not callable by anon; trigger-only helpers callable by nobody
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_trial_eligibility(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.increment_trial_usage(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_trial_eligibility(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_trial_usage(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

-- 3. Stop exposing every user's email/phone to all signed-in users
DROP POLICY IF EXISTS "Authenticated users can view all profiles for leaderboard" ON public.profiles;

CREATE OR REPLACE VIEW public.leaderboard_profiles
WITH (security_invoker = off) AS
SELECT id, full_name, avatar_url, country, city
FROM public.profiles;

REVOKE ALL ON public.leaderboard_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.leaderboard_profiles TO authenticated;
GRANT ALL ON public.leaderboard_profiles TO service_role;