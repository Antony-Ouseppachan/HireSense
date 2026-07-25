ALTER TABLE aptitude_assessments
  ADD COLUMN IF NOT EXISTS violation_log JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS remarks TEXT,
  ADD COLUMN IF NOT EXISTS malpractice_summary JSONB DEFAULT '{}'::jsonb;
