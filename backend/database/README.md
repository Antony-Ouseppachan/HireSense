
# HireSense Database

## Stack
- Authentication: Firebase Authentication
- Database: Neon PostgreSQL
- File Storage: Firebase Storage

## Design Goals
- Optimized for Neon free tier (50 MB).
- Store only structured relational data in PostgreSQL.
- Store PDFs/images in Firebase Storage.
- Keep AI output in JSONB (`resume_analysis.analysis`).

## Setup
1. Create a Neon project.
2. Open SQL Editor.
3. Run `schema.sql`.
4. Configure `DATABASE_URL` in `.env`.
5. Start the backend.

## Core Tables
- users
- candidate_profiles
- companies
- jobs
- resumes
- resume_analysis
- skills
- candidate_skills
- job_skills
- applications
- interviews
- saved_jobs
- notifications

## Storage Strategy
- PostgreSQL: metadata, relationships, AI analysis.
- Firebase Storage: resumes, images, logos.
- Firebase Authentication: user identity.
