-- ============================================================================
-- Migration: Synchronize V1 live schema to V2 backend schema
-- Transforms the existing V1 tables (created before the enterprise rewrite)
-- to match what the V2 backend code (aptitudeController.js, questionGenerator.js)
-- expects.  The backend was written against the V2 schema but the migration
-- was never applied to the production database.
-- ============================================================================

-- ── 0. Drop old migration table if it exists (prevent name collision) ──────
DROP TABLE IF EXISTS _migration_log;

-- ============================================================================
-- 1.  aptitude_assessments
-- ============================================================================

-- 1a. Rename existing columns to V2 names
ALTER TABLE aptitude_assessments RENAME COLUMN generated_questions TO questions_generated;
ALTER TABLE aptitude_assessments RENAME COLUMN duration_seconds       TO time_taken;
ALTER TABLE aptitude_assessments RENAME COLUMN submitted_at           TO completed_at;
ALTER TABLE aptitude_assessments RENAME COLUMN ai_feedback           TO feedback;

-- 1b. Fix status default: V1 used 'GENERATING' (uppercase), V2 uses lowercase
ALTER TABLE aptitude_assessments ALTER COLUMN status SET DEFAULT 'generating';

-- 1c. Add missing V2 columns  (JSONB / numeric / text)
ALTER TABLE aptitude_assessments
  ADD COLUMN IF NOT EXISTS correct_count          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incorrect_count        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_count          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_limit             INTEGER,            -- seconds
  ADD COLUMN IF NOT EXISTS remaining_time         INTEGER,
  ADD COLUMN IF NOT EXISTS risk_level             VARCHAR(20) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS violation_log          JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS malpractice_summary    JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS topic_performance      JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS difficulty_performance JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS weak_topics            JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS strong_topics          JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS improvement_plan       JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS learning_roadmap       JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 1d. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_aa_status         ON aptitude_assessments(status);
CREATE INDEX IF NOT EXISTS idx_aa_user_status    ON aptitude_assessments(user_id, status);

-- ============================================================================
-- 2.  aptitude_questions  — V1 has: question_order, question, option_a/b/c/d,
--     correct_option (char), expected_time_seconds, category, ai_model
--     V2 wants: question_number, question_text, type, options (JSONB),
--     correct_answer, sub_difficulty, expected_time, solution, explanation,
--     learning_objective, common_mistake, passage, batch_number
-- ============================================================================

-- 2a. Rename compatible columns
ALTER TABLE aptitude_questions RENAME COLUMN question_order      TO question_number;
ALTER TABLE aptitude_questions RENAME COLUMN question            TO question_text;
ALTER TABLE aptitude_questions RENAME COLUMN expected_time_seconds TO expected_time;

-- 2b. Add new V2 columns (nullable so existing rows aren't broken)
ALTER TABLE aptitude_questions
  ADD COLUMN IF NOT EXISTS type              VARCHAR(20) DEFAULT 'mcq',
  ADD COLUMN IF NOT EXISTS options           JSONB,
  ADD COLUMN IF NOT EXISTS correct_answer    TEXT,
  ADD COLUMN IF NOT EXISTS sub_difficulty    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS solution          TEXT,
  ADD COLUMN IF NOT EXISTS explanation       TEXT,
  ADD COLUMN IF NOT EXISTS learning_objective TEXT,
  ADD COLUMN IF NOT EXISTS common_mistake    TEXT,
  ADD COLUMN IF NOT EXISTS passage           TEXT,
  ADD COLUMN IF NOT EXISTS batch_number      INTEGER DEFAULT 1;

-- 2c. Populate options JSONB from the 4 separate option columns (existing data)
UPDATE aptitude_questions
  SET options = jsonb_build_array(option_a, option_b, option_c, option_d)
  WHERE options IS NULL AND option_a IS NOT NULL;

-- 2d. Populate correct_answer from correct_option
UPDATE aptitude_questions
  SET correct_answer = correct_option
  WHERE correct_answer IS NULL AND correct_option IS NOT NULL;

-- 2e. Add UNIQUE constraint for ON CONFLICT / question ordering
DELETE FROM aptitude_questions a
  USING aptitude_questions b
  WHERE a.id > b.id
    AND a.assessment_id = b.assessment_id
    AND a.question_number = b.question_number;

ALTER TABLE aptitude_questions
  ADD CONSTRAINT uq_aptitude_questions_assessment_number
  UNIQUE (assessment_id, question_number);

-- 2f. Indexes
CREATE INDEX IF NOT EXISTS idx_aq_assessment   ON aptitude_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_aq_topic        ON aptitude_questions(topic);
CREATE INDEX IF NOT EXISTS idx_aq_difficulty   ON aptitude_questions(sub_difficulty);

-- ============================================================================
-- 3.  aptitude_answers
--     V1 has: selected_option (char), time_taken_seconds (int), answered_at
--     V2 wants: user_answer (text), time_spent (int), status, created_at, updated_at
-- ============================================================================

-- 3a. Rename columns
ALTER TABLE aptitude_answers RENAME COLUMN selected_option     TO user_answer;
ALTER TABLE aptitude_answers RENAME COLUMN time_taken_seconds  TO time_spent;
ALTER TABLE aptitude_answers RENAME COLUMN answered_at         TO created_at;

-- 3b. Add missing V2 columns
ALTER TABLE aptitude_answers
  ADD COLUMN IF NOT EXISTS status     VARCHAR(20) DEFAULT 'unanswered',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 3c. Ensure UNIQUE constraint for ON CONFLICT (assessment_id, question_id)
DELETE FROM aptitude_answers a
  USING aptitude_answers b
  WHERE a.id > b.id
    AND a.assessment_id = b.assessment_id
    AND a.question_id = b.question_id;

ALTER TABLE aptitude_answers
  ADD CONSTRAINT uq_aptitude_answers_assessment_question
  UNIQUE (assessment_id, question_id);

-- 3d. Indexes
CREATE INDEX IF NOT EXISTS idx_aa_assessment ON aptitude_answers(assessment_id);
CREATE INDEX IF NOT EXISTS idx_aa_question   ON aptitude_answers(question_id);

-- ============================================================================
-- 4.  aptitude_malpractice_logs
--     V1 has: violation_type, details, created_at, warning_number, user_id
--     V2 wants: type, detail, "timestamp", created_at, browser_info (JSONB)
-- ============================================================================

-- 4a. Change browser_info type from TEXT to JSONB
-- First rename old column, then add new JSONB column and migrate data
ALTER TABLE aptitude_malpractice_logs RENAME COLUMN browser_info TO browser_info_old;
ALTER TABLE aptitude_malpractice_logs
  ADD COLUMN IF NOT EXISTS browser_info JSONB;

UPDATE aptitude_malpractice_logs
  SET browser_info = browser_info_old::jsonb
  WHERE browser_info_old IS NOT NULL
    AND browser_info_old ~ '^[{[]';

-- 4b. Rename violation_type -> type
ALTER TABLE aptitude_malpractice_logs RENAME COLUMN violation_type TO type;

-- 4c. Rename details -> detail
ALTER TABLE aptitude_malpractice_logs RENAME COLUMN details TO detail;

-- 4d. Add "timestamp" column (V2 uses this for ordering; V1 used created_at)
ALTER TABLE aptitude_malpractice_logs
  ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Copy existing created_at values into timestamp
UPDATE aptitude_malpractice_logs
  SET "timestamp" = created_at
  WHERE "timestamp" IS NULL;

-- 4e. Add created_at if missing (V2 has both timestamp and created_at)
ALTER TABLE aptitude_malpractice_logs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Drop the old browser_info_old column
ALTER TABLE aptitude_malpractice_logs DROP COLUMN IF EXISTS browser_info_old;

-- 4f. Indexes
CREATE INDEX IF NOT EXISTS idx_aml_assessment ON aptitude_malpractice_logs(assessment_id);

-- ============================================================================
-- 5.  Foreign Keys (ensure all V2 FKs exist)
-- ============================================================================

-- aptitude_assessments -> users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_aptitude_assessments_user'
  ) THEN
    ALTER TABLE aptitude_assessments
      ADD CONSTRAINT fk_aptitude_assessments_user
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
END $$;

-- aptitude_questions -> aptitude_assessments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_aptitude_questions_assessment'
  ) THEN
    ALTER TABLE aptitude_questions
      ADD CONSTRAINT fk_aptitude_questions_assessment
      FOREIGN KEY (assessment_id) REFERENCES aptitude_assessments(id);
  END IF;
END $$;

-- aptitude_answers -> aptitude_assessments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_aptitude_answers_assessment'
  ) THEN
    ALTER TABLE aptitude_answers
      ADD CONSTRAINT fk_aptitude_answers_assessment
      FOREIGN KEY (assessment_id) REFERENCES aptitude_assessments(id);
  END IF;
END $$;

-- aptitude_answers -> aptitude_questions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_aptitude_answers_question'
  ) THEN
    ALTER TABLE aptitude_answers
      ADD CONSTRAINT fk_aptitude_answers_question
      FOREIGN KEY (question_id) REFERENCES aptitude_questions(id);
  END IF;
END $$;

-- ============================================================================
-- 6.  Validate
-- ============================================================================
DO $$
DECLARE
  missing text;
BEGIN
  -- Check aptitude_assessments
  SELECT string_agg(c.column_name, ', ') INTO missing
    FROM (VALUES ('questions_generated'),('time_taken'),('completed_at'),('feedback'),
                 ('correct_count'),('incorrect_count'),('skipped_count'),('risk_level'),
                 ('violation_log'),('malpractice_summary'),('topic_performance'),
                 ('difficulty_performance'),('weak_topics'),('strong_topics'),
                 ('improvement_plan'),('learning_roadmap'),('updated_at')) AS want(col)
    LEFT JOIN information_schema.columns c
      ON c.table_name = 'aptitude_assessments' AND c.column_name = want.col
    WHERE c.column_name IS NULL;
  IF missing IS NOT NULL THEN
    RAISE WARNING 'aptitude_assessments still missing: %', missing;
  ELSE
    RAISE NOTICE 'aptitude_assessments: OK';
  END IF;

  -- Check aptitude_questions
  SELECT string_agg(c.column_name, ', ') INTO missing
    FROM (VALUES ('question_number'),('question_text'),('type'),('options'),
                 ('correct_answer'),('sub_difficulty'),('expected_time'),
                 ('solution'),('explanation'),('learning_objective'),
                 ('common_mistake'),('passage'),('batch_number')) AS want(col)
    LEFT JOIN information_schema.columns c
      ON c.table_name = 'aptitude_questions' AND c.column_name = want.col
    WHERE c.column_name IS NULL;
  IF missing IS NOT NULL THEN
    RAISE WARNING 'aptitude_questions still missing: %', missing;
  ELSE
    RAISE NOTICE 'aptitude_questions: OK';
  END IF;

  -- Check aptitude_answers
  SELECT string_agg(c.column_name, ', ') INTO missing
    FROM (VALUES ('user_answer'),('time_spent'),('status'),('created_at'),('updated_at')) AS want(col)
    LEFT JOIN information_schema.columns c
      ON c.table_name = 'aptitude_answers' AND c.column_name = want.col
    WHERE c.column_name IS NULL;
  IF missing IS NOT NULL THEN
    RAISE WARNING 'aptitude_answers still missing: %', missing;
  ELSE
    RAISE NOTICE 'aptitude_answers: OK';
  END IF;

  -- Check aptitude_malpractice_logs
  SELECT string_agg(c.column_name, ', ') INTO missing
    FROM (VALUES ('type'),('detail'),('browser_info'),('timestamp'),('created_at')) AS want(col)
    LEFT JOIN information_schema.columns c
      ON c.table_name = 'aptitude_malpractice_logs' AND c.column_name = want.col
    WHERE c.column_name IS NULL;
  IF missing IS NOT NULL THEN
    RAISE WARNING 'aptitude_malpractice_logs still missing: %', missing;
  ELSE
    RAISE NOTICE 'aptitude_malpractice_logs: OK';
  END IF;
END $$;
