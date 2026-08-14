-- ============================================================================
-- Migration: Honesty Score System
-- Tracks a weekly integrity score per candidate based on detected
-- malpractice during aptitude assessments. Resets every Monday.
-- ============================================================================

CREATE TABLE IF NOT EXISTS honesty_scores (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score             INTEGER NOT NULL DEFAULT 100,
  week_start        DATE NOT NULL,
  violations_count  INTEGER NOT NULL DEFAULT 0,
  clean_assessments INTEGER NOT NULL DEFAULT 0,
  total_assessments INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_hs_user_week ON honesty_scores (user_id, week_start);
