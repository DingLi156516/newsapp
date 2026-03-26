-- Enable RLS on pipeline_runs and allow admin access
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_runs_admin_all" ON pipeline_runs
  FOR ALL USING (is_admin());
