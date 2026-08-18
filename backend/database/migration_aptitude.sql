CREATE TABLE IF NOT EXISTS aptitude_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  difficulty VARCHAR(20) NOT NULL,
  questions JSONB NOT NULL,
  answers JSONB,
  correct_answers JSONB,
  score INTEGER DEFAULT 0,
  total_questions INTEGER NOT NULL,
  correct_count INTEGER DEFAULT 0,
  incorrect_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  accuracy NUMERIC(5,2) DEFAULT 0,
  time_taken INTEGER DEFAULT 0,
  warnings INTEGER DEFAULT 0,
  violations JSONB DEFAULT '[]'::jsonb,
  terminated BOOLEAN DEFAULT false,
  topic_performance JSONB DEFAULT '{}'::jsonb,
  difficulty_performance JSONB DEFAULT '{}'::jsonb,
  weak_topics JSONB DEFAULT '[]'::jsonb,
  strong_topics JSONB DEFAULT '[]'::jsonb,
  feedback TEXT,
  improvement_plan JSONB DEFAULT '[]'::jsonb,
  learning_roadmap JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aptitude_user_id ON aptitude_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_aptitude_created_at ON aptitude_assessments(created_at DESC);
