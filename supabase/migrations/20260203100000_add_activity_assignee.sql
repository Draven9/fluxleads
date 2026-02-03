-- Add assignee_id to activities table for delegation
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES public.profiles(id);

-- Index for filtering by assignee
CREATE INDEX IF NOT EXISTS idx_activities_assignee_id ON public.activities(assignee_id);
