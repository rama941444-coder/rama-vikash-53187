--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: check_trial_eligibility(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_trial_eligibility(_user_id uuid, _device_fingerprint text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  trial_count INTEGER;
BEGIN
  -- Check trials for today
  SELECT COALESCE(usage_count, 0) INTO trial_count
  FROM public.free_trials
  WHERE ((_user_id IS NOT NULL AND user_id = _user_id) OR 
         (_device_fingerprint IS NOT NULL AND device_fingerprint = _device_fingerprint))
    AND trial_date = CURRENT_DATE;
  
  RETURN trial_count < 3;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Assign default user role if not exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;


--
-- Name: increment_trial_usage(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_trial_usage(_user_id uuid, _device_fingerprint text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.free_trials (user_id, device_fingerprint, trial_date, usage_count)
  VALUES (_user_id, _device_fingerprint, CURRENT_DATE, 1)
  ON CONFLICT (user_id, trial_date)
  DO UPDATE SET usage_count = public.free_trials.usage_count + 1
  WHERE public.free_trials.user_id = _user_id;
  
  -- Handle device fingerprint conflicts
  INSERT INTO public.free_trials (user_id, device_fingerprint, trial_date, usage_count)
  VALUES (_user_id, _device_fingerprint, CURRENT_DATE, 1)
  ON CONFLICT (device_fingerprint, trial_date)
  DO UPDATE SET usage_count = public.free_trials.usage_count + 1
  WHERE public.free_trials.device_fingerprint = _device_fingerprint;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: free_trials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.free_trials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    device_fingerprint text,
    trial_date date DEFAULT CURRENT_DATE NOT NULL,
    usage_count integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pricing_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_type text NOT NULL,
    currency text NOT NULL,
    amount numeric NOT NULL,
    is_active boolean DEFAULT true,
    admin_phone text,
    admin_name text,
    admin_region text,
    upi_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pricing_config_currency_check CHECK ((currency = ANY (ARRAY['INR'::text, 'USD'::text]))),
    CONSTRAINT pricing_config_plan_type_check CHECK ((plan_type = ANY (ARRAY['monthly'::text, 'yearly'::text])))
);


--
-- Name: pricing_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pricing_public WITH (security_invoker='true') AS
 SELECT id,
    plan_type,
    amount,
    currency,
    is_active,
    created_at,
    updated_at
   FROM public.pricing_config
  WHERE (is_active = true);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    phone text,
    full_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_phone text NOT NULL,
    user_email text,
    plan_type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    transaction_id text,
    payment_screenshot_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    currency text DEFAULT 'INR'::text,
    payment_method text,
    qr_code_url text,
    CONSTRAINT check_amount_positive CHECK ((amount > (0)::numeric)),
    CONSTRAINT check_email_format CHECK (((user_email IS NULL) OR (user_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'::text))),
    CONSTRAINT check_phone_min_length CHECK (((user_phone IS NULL) OR (length(TRIM(BOTH FROM user_phone)) >= 8))),
    CONSTRAINT check_plan_type CHECK ((plan_type = ANY (ARRAY['monthly'::text, 'yearly'::text]))),
    CONSTRAINT check_transaction_length CHECK (((transaction_id IS NULL) OR ((length(transaction_id) >= 3) AND (length(transaction_id) <= 100)))),
    CONSTRAINT subscriptions_plan_type_check CHECK ((plan_type = ANY (ARRAY['monthly'::text, 'yearly'::text]))),
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: free_trials free_trials_device_fingerprint_trial_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_trials
    ADD CONSTRAINT free_trials_device_fingerprint_trial_date_key UNIQUE (device_fingerprint, trial_date);


--
-- Name: free_trials free_trials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_trials
    ADD CONSTRAINT free_trials_pkey PRIMARY KEY (id);


--
-- Name: free_trials free_trials_user_id_trial_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_trials
    ADD CONSTRAINT free_trials_user_id_trial_date_key UNIQUE (user_id, trial_date);


--
-- Name: pricing_config pricing_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_config
    ADD CONSTRAINT pricing_config_pkey PRIMARY KEY (id);


--
-- Name: pricing_config pricing_config_plan_type_currency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_config
    ADD CONSTRAINT pricing_config_plan_type_currency_key UNIQUE (plan_type, currency);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_user_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_phone_key UNIQUE (user_phone);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: free_trials free_trials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_trials
    ADD CONSTRAINT free_trials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions Admins can delete subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete subscriptions" ON public.subscriptions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: free_trials Admins can delete trials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete trials" ON public.free_trials FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pricing_config Admins can manage pricing; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage pricing" ON public.pricing_config USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions Admins can update subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update subscriptions" ON public.subscriptions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: free_trials Admins can update trials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update trials" ON public.free_trials FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions Admins can view all subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pricing_config Only admins can view full pricing config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can view full pricing config" ON public.pricing_config FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Service role can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can delete roles" ON public.user_roles FOR DELETE TO service_role USING (true);


--
-- Name: user_roles Service role can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert roles" ON public.user_roles FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: user_roles Service role can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can update roles" ON public.user_roles FOR UPDATE TO service_role USING (true) WITH CHECK (true);


--
-- Name: subscriptions Users can create own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (user_id IS NOT NULL)));


--
-- Name: subscriptions Users can delete own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own subscriptions" ON public.subscriptions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: free_trials Users can insert own trials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own trials" ON public.free_trials FOR INSERT WITH CHECK (((auth.uid() = user_id) OR (user_id IS NULL)));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: subscriptions Users can view own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: free_trials Users can view own trials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own trials" ON public.free_trials FOR SELECT USING (((auth.uid() = user_id) OR (user_id IS NULL)));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: free_trials Users cannot delete trials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users cannot delete trials" ON public.free_trials FOR DELETE USING (false);


--
-- Name: free_trials Users cannot directly update trials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users cannot directly update trials" ON public.free_trials FOR UPDATE USING (false);


--
-- Name: free_trials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.free_trials ENABLE ROW LEVEL SECURITY;

--
-- Name: pricing_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


