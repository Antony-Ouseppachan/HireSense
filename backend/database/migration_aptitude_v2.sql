-- ============================================================================
-- Migration: Enterprise Aptitude Assessment Schema (v2)
-- Adds normalized tables for batched generation, real-time answers,
-- malpractice logging, and assessment lifecycle management.
-- ============================================================================

-- ── 1. Add lifecycle columns to existing aptitude_assessments ──────────────
ALTER TABLE aptitude_assessments
  ADD COLUMN IF NOT EXISTS status          VARCHAR(20) NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS questions_generated INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN aptitude_assessments.status IS 'generating | ready | in_progress | completed | cancelled';
COMMENT ON COLUMN aptitude_assessments.questions_generated IS 'Number of questions successfully generated so far';

-- Existing rows get 'completed' status so they remain visible in history.
-- New assessments move through: generating → ready → in_progress → completed

-- ── 2. aptitude_questions: individual question bank ────────────────────────
CREATE TABLE IF NOT EXISTS aptitude_questions (
  id                SERIAL PRIMARY KEY,
  assessment_id     INTEGER NOT NULL REFERENCES aptitude_assessments(id) ON DELETE CASCADE,
  question_number   INTEGER NOT NULL,
  type              VARCHAR(20) NOT NULL CHECK (type IN ('mcq','multiple','numerical','boolean','comprehension')),
  question_text     TEXT NOT NULL,
  options           JSONB,
  correct_answer    TEXT NOT NULL,
  topic             VARCHAR(100) NOT NULL,
  difficulty        VARCHAR(20) NOT NULL,
  sub_difficulty    VARCHAR(20),
  marks             INTEGER DEFAULT 1,
  expected_time     INTEGER,          -- seconds
  solution          TEXT,              -- step-by-step solution
  explanation       TEXT,              -- short explanation
  learning_objective TEXT,
  common_mistake    TEXT,
  passage           TEXT,
  batch_number      INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (assessment_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_aq_assessment   ON aptitude_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_aq_topic        ON aptitude_questions(topic);
CREATE INDEX IF NOT EXISTS idx_aq_difficulty   ON aptitude_questions(sub_difficulty);

COMMENT ON TABLE  aptitude_questions IS 'Normalized question bank per assessment. One row per question.';
COMMENT ON COLUMN aptitude_questions.correct_answer IS 'Stored as JSON-encoded value (index for mcq, array for multiple, numeric string, etc.)';

-- ── 3. aptitude_answers: real-time user responses ─────────────────────────
CREATE TABLE IF NOT EXISTS aptitude_answers (
  id              SERIAL PRIMARY KEY,
  assessment_id   INTEGER NOT NULL REFERENCES aptitude_assessments(id) ON DELETE CASCADE,
  question_id     INTEGER NOT NULL REFERENCES aptitude_questions(id) ON DELETE CASCADE,
  user_answer     TEXT,
  is_correct      BOOLEAN,
  time_spent      INTEGER DEFAULT 0,   -- seconds spent on this question
  status          VARCHAR(20) NOT NULL DEFAULT 'unanswered'
                    CHECK (status IN ('unanswered','answered','skipped','reviewed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (assessment_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_aa_assessment ON aptitude_answers(assessment_id);
CREATE INDEX IF NOT EXISTS idx_aa_question   ON aptitude_answers(question_id);

COMMENT ON TABLE aptitude_answers IS 'Real-time user answers stored during test. Enables resume.';

-- ── 4. aptitude_malpractice_logs: individual violation events ─────────────
CREATE TABLE IF NOT EXISTS aptitude_malpractice_logs (
  id              SERIAL PRIMARY KEY,
  assessment_id   INTEGER NOT NULL REFERENCES aptitude_assessments(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  type            VARCHAR(50) NOT NULL,
  severity        VARCHAR(20) NOT NULL DEFAULT 'low'
                    CHECK (severity IN ('low','medium','high','critical')),
  detail          TEXT,
  browser_info    JSONB,
  "timestamp"     TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aml_assessment ON aptitude_malpractice_logs(assessment_id);

COMMENT ON TABLE aptitude_malpractice_logs IS 'Granular malpractice/violation events. One row per event.';

-- ── 5. Additional performance indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_aa_status      ON aptitude_assessments(status);
CREATE INDEX IF NOT EXISTS idx_aa_user_status ON aptitude_assessments(user_id, status);
