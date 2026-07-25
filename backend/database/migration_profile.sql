-- Profile Schema Migration (PRD v2)
-- Reference tables
CREATE TABLE IF NOT EXISTS skill_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category_id INTEGER REFERENCES skill_categories(id),
  UNIQUE(name)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'category_id') THEN
    ALTER TABLE skills ADD COLUMN category_id INTEGER REFERENCES skill_categories(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS degrees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS specializations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS institutions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

-- Extend candidate_profiles with minimal AI-relevant fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_profiles' AND column_name = 'first_name') THEN
    ALTER TABLE candidate_profiles ADD COLUMN first_name VARCHAR(150) DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_profiles' AND column_name = 'last_name') THEN
    ALTER TABLE candidate_profiles ADD COLUMN last_name VARCHAR(150) DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_profiles' AND column_name = 'profile_picture_url') THEN
    ALTER TABLE candidate_profiles ADD COLUMN profile_picture_url TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_profiles' AND column_name = 'target_role_id') THEN
    ALTER TABLE candidate_profiles ADD COLUMN target_role_id INTEGER REFERENCES roles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'candidate_profiles' AND column_name = 'experience_level') THEN
    ALTER TABLE candidate_profiles ADD COLUMN experience_level VARCHAR(50) DEFAULT '';
  END IF;
END $$;

-- Drop old tables that conflict with PRD v2 schema
DROP TABLE IF EXISTS candidate_certifications CASCADE;
DROP TABLE IF EXISTS candidate_languages CASCADE;
DROP TABLE IF EXISTS candidate_experience CASCADE;
DROP TABLE IF EXISTS candidate_project_skills CASCADE;
DROP TABLE IF EXISTS candidate_projects CASCADE;
DROP TABLE IF EXISTS candidate_education CASCADE;

-- Education (PRD v2: current_year, graduation_year)
CREATE TABLE candidate_education (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  degree_id INTEGER REFERENCES degrees(id),
  specialization_id INTEGER REFERENCES specializations(id),
  institution_id INTEGER REFERENCES institutions(id),
  current_year VARCHAR(50) DEFAULT '',
  graduation_year INTEGER,
  cgpa DECIMAL(4,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects
CREATE TABLE candidate_projects (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  github_url TEXT DEFAULT '',
  live_demo TEXT DEFAULT '',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project skills junction
CREATE TABLE candidate_project_skills (
  project_id INTEGER REFERENCES candidate_projects(id) ON DELETE CASCADE,
  skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, skill_id)
);

-- Skills junction
DROP TABLE IF EXISTS candidate_skills CASCADE;
CREATE TABLE candidate_skills (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, skill_id)
);

-- Learning goals
DROP TABLE IF EXISTS candidate_learning_goals CASCADE;
CREATE TABLE candidate_learning_goals (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal VARCHAR(100) NOT NULL,
  UNIQUE(user_id, goal)
);

-- Weak areas
DROP TABLE IF EXISTS candidate_weak_areas CASCADE;
CREATE TABLE candidate_weak_areas (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weak_area VARCHAR(100) NOT NULL,
  UNIQUE(user_id, weak_area)
);

-- Mock interviews for Interview Studio
CREATE TABLE IF NOT EXISTS mock_interviews (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  questions JSONB DEFAULT '[]',
  responses JSONB DEFAULT '[]',
  score INTEGER,
  feedback JSONB DEFAULT '{}',
  category VARCHAR(100) DEFAULT '',
  difficulty VARCHAR(50) DEFAULT '',
  duration INTEGER DEFAULT 0,
  mode VARCHAR(50) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
