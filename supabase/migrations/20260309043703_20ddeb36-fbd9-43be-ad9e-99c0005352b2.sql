-- Add profile fields for photo, phone, country/location
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS city TEXT;

-- Create student progress table for CodeArena Pro
CREATE TABLE IF NOT EXISTS public.student_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  level TEXT NOT NULL,
  question_title TEXT NOT NULL,
  question_difficulty TEXT NOT NULL,
  language TEXT NOT NULL,
  solved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, question_title)
);

-- Create index for user queries
CREATE INDEX IF NOT EXISTS idx_student_progress_user_id ON public.student_progress(user_id);

-- Enable RLS
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;

-- Users can view their own progress
CREATE POLICY "Users can view own progress" ON public.student_progress
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert own progress" ON public.student_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own progress" ON public.student_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own progress
CREATE POLICY "Users can delete own progress" ON public.student_progress
  FOR DELETE USING (auth.uid() = user_id);