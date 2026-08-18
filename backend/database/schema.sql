CREATE SCHEMA "public";
CREATE TABLE "applications" (
	"id" bigserial PRIMARY KEY,
	"job_id" bigint NOT NULL UNIQUE,
	"candidate_id" bigint NOT NULL UNIQUE,
	"resume_id" bigint,
	"status" varchar(30) DEFAULT 'Applied',
	"applied_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "applications_job_id_candidate_id_key" UNIQUE("job_id","candidate_id")
);
CREATE TABLE "candidate_profiles" (
	"id" bigserial PRIMARY KEY,
	"user_id" bigint NOT NULL CONSTRAINT "candidate_profiles_user_id_key" UNIQUE,
	"phone" varchar(20),
	"location" varchar(255),
	"bio" text,
	"education" text,
	"experience_years" integer DEFAULT 0,
	"github_url" text,
	"linkedin_url" text,
	"portfolio_url" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "candidate_skills" (
	"candidate_id" bigint,
	"skill_id" bigint,
	CONSTRAINT "candidate_skills_pkey" PRIMARY KEY("candidate_id","skill_id")
);
CREATE TABLE "companies" (
	"id" bigserial PRIMARY KEY,
	"owner_id" bigint NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"industry" varchar(120),
	"website" text,
	"logo_url" text,
	"description" text,
	"location" varchar(255),
	"company_size" varchar(50),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "interview_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"question_id" uuid NOT NULL,
	"answer" text,
	"score" integer,
	"feedback" text
);
CREATE TABLE "interview_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"session_id" uuid NOT NULL,
	"question" text NOT NULL,
	"difficulty" varchar(100)
);
CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" bigint NOT NULL,
	"mode" varchar(100) DEFAULT 'standard' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
CREATE TABLE "interviews" (
	"id" bigserial PRIMARY KEY,
	"application_id" bigint CONSTRAINT "interviews_application_id_key" UNIQUE,
	"interview_date" timestamp,
	"mode" varchar(30),
	"meeting_link" text,
	"notes" text,
	"status" varchar(30)
);
CREATE TABLE "job_skills" (
	"job_id" bigint,
	"skill_id" bigint,
	CONSTRAINT "job_skills_pkey" PRIMARY KEY("job_id","skill_id")
);
CREATE TABLE "jobs" (
	"id" bigserial PRIMARY KEY,
	"company_id" bigint NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"location" varchar(255),
	"employment_type" varchar(30),
	"experience_required" integer DEFAULT 0,
	"salary_min" numeric(10, 2),
	"salary_max" numeric(10, 2),
	"is_remote" boolean DEFAULT false,
	"status" varchar(20) DEFAULT 'open',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY,
	"user_id" bigint,
	"title" varchar(255),
	"message" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "profiles" (
	"id" bigserial PRIMARY KEY,
	"user_id" bigint NOT NULL CONSTRAINT "profiles_user_id_key" UNIQUE,
	"name" varchar(255),
	"education" text,
	"skills" text,
	"experience" text,
	"projects" text,
	"target_role" varchar(255)
);
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"session_id" uuid NOT NULL CONSTRAINT "reports_session_id_key" UNIQUE,
	"technical_score" integer,
	"communication_score" integer,
	"confidence_score" integer,
	"overall_score" integer,
	"report_json" jsonb
);
CREATE TABLE "resume_analysis" (
	"id" bigserial PRIMARY KEY,
	"resume_id" bigint NOT NULL CONSTRAINT "resume_analysis_resume_id_key" UNIQUE,
	"ats_score" numeric(5, 2),
	"analysis" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "resumes" (
	"id" bigserial PRIMARY KEY,
	"user_id" bigint NOT NULL,
	"uploaded_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"file_id" text NOT NULL,
	"file_url" text NOT NULL,
	"storage_provider" varchar(30) DEFAULT 'cloudinary' NOT NULL,
	"original_filename" varchar(255),
	"file_size" bigint,
	"mime_type" varchar(100),
	"uploaded_by" bigint
);
CREATE TABLE "saved_jobs" (
	"user_id" bigint,
	"job_id" bigint,
	"saved_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "saved_jobs_pkey" PRIMARY KEY("user_id","job_id")
);
CREATE TABLE "skills" (
	"id" bigserial PRIMARY KEY,
	"name" varchar(100) NOT NULL CONSTRAINT "skills_name_key" UNIQUE
);
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY,
	"firebase_uid" varchar(255) NOT NULL CONSTRAINT "users_firebase_uid_key" UNIQUE,
	"email" varchar(255) NOT NULL CONSTRAINT "users_email_key" UNIQUE,
	"full_name" varchar(150) NOT NULL,
	"role" varchar(20) NOT NULL,
	"profile_picture_url" text,
	"is_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"last_login" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "users_role_check" CHECK (((role)::text = ANY ((ARRAY['candidate'::character varying, 'recruiter'::character varying, 'admin'::character varying])::text[])))
);
CREATE UNIQUE INDEX "applications_job_id_candidate_id_key" ON "applications" ("job_id","candidate_id");
CREATE UNIQUE INDEX "applications_pkey" ON "applications" ("id");
CREATE INDEX "idx_apps_candidate" ON "applications" ("candidate_id");
CREATE INDEX "idx_apps_job" ON "applications" ("job_id");
CREATE UNIQUE INDEX "candidate_profiles_pkey" ON "candidate_profiles" ("id");
CREATE UNIQUE INDEX "candidate_profiles_user_id_key" ON "candidate_profiles" ("user_id");
CREATE UNIQUE INDEX "candidate_skills_pkey" ON "candidate_skills" ("candidate_id","skill_id");
CREATE UNIQUE INDEX "companies_pkey" ON "companies" ("id");
CREATE UNIQUE INDEX "interview_answers_pkey" ON "interview_answers" ("id");
CREATE UNIQUE INDEX "interview_questions_pkey" ON "interview_questions" ("id");
CREATE UNIQUE INDEX "interview_sessions_pkey" ON "interview_sessions" ("id");
CREATE UNIQUE INDEX "interviews_application_id_key" ON "interviews" ("application_id");
CREATE UNIQUE INDEX "interviews_pkey" ON "interviews" ("id");
CREATE UNIQUE INDEX "job_skills_pkey" ON "job_skills" ("job_id","skill_id");
CREATE INDEX "idx_jobs_company" ON "jobs" ("company_id");
CREATE INDEX "idx_jobs_title" ON "jobs" ("title");
CREATE UNIQUE INDEX "jobs_pkey" ON "jobs" ("id");
CREATE INDEX "idx_notif_user" ON "notifications" ("user_id");
CREATE UNIQUE INDEX "notifications_pkey" ON "notifications" ("id");
CREATE UNIQUE INDEX "profiles_pkey" ON "profiles" ("id");
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles" ("user_id");
CREATE UNIQUE INDEX "reports_pkey" ON "reports" ("id");
CREATE UNIQUE INDEX "reports_session_id_key" ON "reports" ("session_id");
CREATE UNIQUE INDEX "resume_analysis_pkey" ON "resume_analysis" ("id");
CREATE UNIQUE INDEX "resume_analysis_resume_id_key" ON "resume_analysis" ("resume_id");
CREATE INDEX "idx_resume_user" ON "resumes" ("user_id");
CREATE UNIQUE INDEX "resumes_pkey" ON "resumes" ("id");
CREATE UNIQUE INDEX "saved_jobs_pkey" ON "saved_jobs" ("user_id","job_id");
CREATE UNIQUE INDEX "skills_name_key" ON "skills" ("name");
CREATE UNIQUE INDEX "skills_pkey" ON "skills" ("id");
CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users" ("firebase_uid");
CREATE UNIQUE INDEX "users_pkey" ON "users" ("id");
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL;
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE;
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "interview_questions"("id") ON DELETE CASCADE;
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE;
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE;
ALTER TABLE "resume_analysis" ADD CONSTRAINT "resume_analysis_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE;
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;