-- Create audit_logs table for tracking admin actions
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_record_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- System/service role can insert audit logs (from edge functions)
CREATE POLICY "Service can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (true);

-- No one can update or delete audit logs (immutable)
CREATE POLICY "No updates allowed" 
ON public.audit_logs 
FOR UPDATE 
USING (false);

CREATE POLICY "No deletes allowed" 
ON public.audit_logs 
FOR DELETE 
USING (false);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_admin_user ON public.audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);