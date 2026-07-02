
-- HireSense Professional Schema (v1)
CREATE TABLE users(
 id BIGSERIAL PRIMARY KEY,
 firebase_uid VARCHAR(255) UNIQUE NOT NULL,
 email VARCHAR(255) UNIQUE NOT NULL,
 full_name VARCHAR(150) NOT NULL,
 role VARCHAR(20) NOT NULL CHECK(role IN ('candidate','recruiter','admin')),
 profile_picture_url TEXT,
 is_verified BOOLEAN DEFAULT FALSE,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidate_profiles(
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 phone VARCHAR(20),
 location VARCHAR(255),
 bio TEXT,
 education TEXT,
 experience_years INT DEFAULT 0,
 github_url TEXT,
 linkedin_url TEXT,
 portfolio_url TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE companies(
 id BIGSERIAL PRIMARY KEY,
 owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 company_name VARCHAR(255) NOT NULL,
 industry VARCHAR(120),
 website TEXT,
 logo_url TEXT,
 description TEXT,
 location VARCHAR(255),
 company_size VARCHAR(50),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE jobs(
 id BIGSERIAL PRIMARY KEY,
 company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 title VARCHAR(255) NOT NULL,
 description TEXT NOT NULL,
 location VARCHAR(255),
 employment_type VARCHAR(30),
 experience_required INT DEFAULT 0,
 salary_min NUMERIC(10,2),
 salary_max NUMERIC(10,2),
 is_remote BOOLEAN DEFAULT FALSE,
 status VARCHAR(20) DEFAULT 'open',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE resumes(
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 firebase_file_path TEXT NOT NULL,
 download_url TEXT,
 uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE resume_analysis(
 id BIGSERIAL PRIMARY KEY,
 resume_id BIGINT UNIQUE NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
 ats_score NUMERIC(5,2),
 analysis JSONB,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE skills(
 id BIGSERIAL PRIMARY KEY,
 name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE candidate_skills(
 candidate_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
 skill_id BIGINT REFERENCES skills(id) ON DELETE CASCADE,
 PRIMARY KEY(candidate_id,skill_id)
);

CREATE TABLE job_skills(
 job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
 skill_id BIGINT REFERENCES skills(id) ON DELETE CASCADE,
 PRIMARY KEY(job_id,skill_id)
);

CREATE TABLE applications(
 id BIGSERIAL PRIMARY KEY,
 job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 candidate_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 resume_id BIGINT REFERENCES resumes(id) ON DELETE SET NULL,
 status VARCHAR(30) DEFAULT 'Applied',
 applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(job_id,candidate_id)
);

CREATE TABLE interviews(
 id BIGSERIAL PRIMARY KEY,
 application_id BIGINT UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
 interview_date TIMESTAMP,
 mode VARCHAR(30),
 meeting_link TEXT,
 notes TEXT,
 status VARCHAR(30)
);

CREATE TABLE saved_jobs(
 user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
 job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
 saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,job_id)
);

CREATE TABLE notifications(
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
 title VARCHAR(255),
 message TEXT,
 is_read BOOLEAN DEFAULT FALSE,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_title ON jobs(title);
CREATE INDEX idx_apps_candidate ON applications(candidate_id);
CREATE INDEX idx_apps_job ON applications(job_id);
CREATE INDEX idx_resume_user ON resumes(user_id);
CREATE INDEX idx_notif_user ON notifications(user_id);

-- Updates

ALTER TABLE resumes
DROP COLUMN firebase_file_path,
DROP COLUMN download_url;

ALTER TABLE resumes
ADD COLUMN cloudinary_public_id TEXT NOT NULL,
ADD COLUMN cloudinary_url TEXT NOT NULL;

ALTER TABLE resumes
RENAME COLUMN cloudinary_public_id TO file_id;

ALTER TABLE resumes
RENAME COLUMN cloudinary_url TO file_url;

ALTER TABLE resumes
ADD COLUMN storage_provider VARCHAR(30) NOT NULL DEFAULT 'cloudinary';

ALTER TABLE resumes
ADD COLUMN original_filename VARCHAR(255),
ADD COLUMN file_size BIGINT,
ADD COLUMN mime_type VARCHAR(100),
ADD COLUMN uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
ADD COLUMN last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP;