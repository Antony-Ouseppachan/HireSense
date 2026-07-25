# Software Requirement Specification — HireSense

**Version:** 2.0  
**Domain:** AI-Powered Placement Preparation Platform  
**Frontend:** React 19 + Vite 5.4.19  
**Backend:** Node.js / Express  
**Database:** PostgreSQL (Neon)  
**Auth:** Firebase Authentication  
**AI:** Groq SDK (llama-3.3-70b-versatile)  
**Storage:** Cloudinary  

---

## 1. Introduction

### 1.1 Purpose
HireSense is an AI-first placement preparation platform for students and job seekers. It provides personalized mock interviews, aptitude tests, coding challenges, and learning recommendations powered by a large language model. The system collects only AI-relevant profile data — no recruiter-facing fields — and uses it to tailor every assessment to the individual.

### 1.2 Scope
The platform covers:
- User registration and authentication (Firebase)
- AI-relevant profile management (education, target role, skills, projects, resume, learning goals, weak areas)
- Reference data autocomplete (roles, skills with categories, degrees, specializations, institutions)
- Interview Studio with 15 category modules
- AI-driven question generation via Groq (llama-3.3-70b-versatile)
- Resume upload, preview, and deletion (Cloudinary)
- Profile completion scoring and module unlock logic
- Performance dashboard with score tracking

### 1.3 Definitions & Acronyms
| Term | Definition |
|---|---|
| **Candidate** | End-user (student / job seeker) |
| **Module** | Unlockable interview/assessment category in the Studio |
| **Gateway** | External AI API provider (Groq) |
| **PRD v2** | Product Requirements Document version 2 — the current design spec |
| **ATS** | Applicant Tracking System (explicitly out of scope) |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)               │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Auth UI │ │ Profile  │ │ Studio   │ │ Dashboard  │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └──────┬─────┘  │
│       │           │            │               │        │
│       └───────┬───┴─────┬──────┴───────────────┘        │
│           Firebase    API Service Layer                  │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP (Bearer Token)
┌───────────────────────────┴─────────────────────────────┐
│                    Backend (Express)                      │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Auth    │ │ Profile  │ │Interviews│ │ Resume     │  │
│  │ Routes  │ │ Routes   │ │ Routes   │ │ Routes     │  │
│  ├─────────┤ ├──────────┤ ├──────────┤ ├────────────┤  │
│  │AuthCtrl │ │ProfileCtrl│ │Interview │ │ResumeCtrl  │  │
│  │         │ │          │ │ Ctrl     │ │            │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └──────┬─────┘  │
│       │           │            │               │        │
│  ┌────┴───────────┴────────────┴───────────────┴────┐   │
│  │              askAI() — Groq SDK                   │   │
│  │              Database — Neon PostgreSQL            │   │
│  │              Cloudinary SDK                        │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.1 Frontend Stack
- **React 19** with hooks (no class components)
- **Vite 5.4.19** for build and dev server
- **react-router-dom v6** for client-side routing
- **Custom CSS** — no UI library, no Tailwind
- **Firebase Client SDK** (v9+ modular) for auth

### 2.2 Backend Stack
- **Express 4** REST API on port 5000
- **pg** (node-postgres) for database access
- **Firebase Admin SDK** for token verification
- **Groq SDK** for AI chat completions
- **Cloudinary SDK** for resume PDF storage
- **Multer** for file upload handling

### 2.3 Database (Neon PostgreSQL)
Schema managed via SQL migration files. Key tables:
- `users` — Firebase UID sync
- `candidate_profiles` — minimal AI-relevant fields only
- `candidate_education` — degree, specialization, institution (autocomplete)
- `candidate_skills` — junction to `skills` (multi-select, categorized)
- `candidate_projects` + `candidate_project_skills`
- `resumes` — Cloudinary URL, metadata
- `mock_interviews` — questions, responses, score, feedback
- `candidate_learning_goals`, `candidate_weak_areas` — checkboxes
- Reference tables: `roles`, `skills`, `skill_categories`, `degrees`, `specializations`, `institutions`

---

## 3. Functional Requirements

### FR-1 — Authentication
| ID | Description | Priority |
|---|---|---|
| FR-1.1 | User shall register with email + password via Firebase | High |
| FR-1.2 | User shall log in with email/password or Google OAuth | High |
| FR-1.3 | User session shall persist via Firebase `onAuthStateChanged` | High |
| FR-1.4 | Backend shall verify Firebase ID token on every protected route | High |
| FR-1.5 | Email verification flow shall be supported | Medium |
| FR-1.6 | Password reset flow shall be supported | Medium |

### FR-2 — Profile Management (PRD v2)
| ID | Description | Priority |
|---|---|---|
| FR-2.1 | User shall set first name and last name | High |
| FR-2.2 | User shall set target role via mandatory autocomplete (predefined roles only) | High |
| FR-2.3 | User shall set experience level via dropdown | High |
| FR-2.4 | User shall add 1+ education entries with degree, specialization, institution autocomplete | High |
| FR-2.5 | User shall select skills via multi-select chips (max 50, categorized, no free-text) | High |
| FR-2.6 | User shall add projects with name, description, URLs, and tech stack autocomplete | High |
| FR-2.7 | User shall upload resume (PDF only, Cloudinary stored) | High |
| FR-2.8 | User shall select learning goals via checkboxes | High |
| FR-2.9 | User shall select weak areas via checkboxes | High |
| FR-2.10 | Profile completion percentage shall be calculated server-side | High |
| FR-2.11 | Module unlock status shall be determined server-side | High |
| FR-2.12 | Profile picture URL shall be settable | Low |

### FR-3 — Interview Studio
| ID | Description | Priority |
|---|---|---|
| FR-3.1 | Studio shall display 15 interview categories as cards | High |
| FR-3.2 | Categories shall show lock/unlock status based on profile completeness | High |
| FR-3.3 | Unlock requirements: resume, tech_stack, profile, advanced | High |
| FR-3.4 | Quick stats shall show readiness score, recommendations, goals | Medium |
| FR-3.5 | Performance snapshot shows completed count, avg score, best score | Medium |
| FR-3.6 | Recent activity list shows past sessions | Medium |
| FR-3.7 | Setup CTA shall guide incomplete profiles | High |

**Interview Categories (15):**
1. Aptitude Tests (always unlocked)
2. General Knowledge (always unlocked)
3. English & Communication (always unlocked)
4. Technical Interview (skill-gated)
5. Resume Interview (resume-gated)
6. Coding Challenge (skill-gated)
7. HR Interview (profile-gated)
8. Behavioral Interview (profile-gated)
9. Role-Specific (skill-gated)
10. Company-Specific (resume-gated)
11. System Design (advanced-gated)
12. Domain Knowledge (profile-gated)
13. Case Study (profile-gated)
14. AI Voice Interview (profile-gated)
15. Mixed Interview (skill-gated)

### FR-4 — Category Session
| ID | Description | Priority |
|---|---|---|
| FR-4.1 | User shall select difficulty, duration, and mode for a category | High |
| FR-4.2 | System shall generate questions via Groq AI | High |
| FR-4.3 | System shall fall back to hardcoded question pool if AI fails | High |
| FR-4.4 | Smooth loading animation shall display during question generation | High |
| FR-4.5 | Questions shall be stored as JSONB in `mock_interviews` | High |
| FR-4.6 | User shall navigate to session page after generation | High |

### FR-5 — Interview Session
| ID | Description | Priority |
|---|---|---|
| FR-5.1 | User shall view each question in a text-area form | High |
| FR-5.2 | User shall submit responses | High |
| FR-5.3 | System shall calculate a score and generate feedback | High |
| FR-5.4 | Score and feedback shall be displayed after submission | High |
| FR-5.5 | Existing sessions shall be reviewable | Medium |

### FR-6 — Resume
| ID | Description | Priority |
|---|---|---|
| FR-6.1 | User shall upload a PDF resume | High |
| FR-6.2 | Resume shall be uploaded to Cloudinary under `hiresense/resumes/` | High |
| FR-6.3 | Uploaded resume shall be viewable in an in-page modal via iframe | High |
| FR-6.4 | User shall replace an existing resume | High |
| FR-6.5 | User shall delete a resume (Cloudinary + DB) with confirmation | High |

### FR-7 — Dashboard
| ID | Description | Priority |
|---|---|---|
| FR-7.1 | Dashboard shall show welcome message with user name | Medium |
| FR-7.2 | Stats cards: interview count, profile completion, latest score | Medium |
| FR-7.3 | Recent interviews list with scores and dates | Medium |
| FR-7.4 | Profile overview with key fields | Medium |
| FR-7.5 | Navigation to profile and interview studio | Medium |

---

## 4. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-1 | **Performance** — AI question generation shall complete within 30s | < 30s |
| NFR-2 | **Availability** — Backend uptime | 99.9% |
| NFR-3 | **Security** — All API routes (except auth) require Bearer token | Pass |
| NFR-4 | **Security** — Firebase token verified on every request | Pass |
| NFR-5 | **Security** — Resume access gated by candidate_id ownership | Pass |
| NFR-6 | **Storage** — PDFs stored in Cloudinary only (no local persistence) | Pass |
| NFR-7 | **Scalability** — Serverless-ready (Neon + stateless Express) | Pass |
| NFR-8 | **Maintainability** — Self-contained page components, centralized API service | Pass |
| NFR-9 | **Error Handling** — AI failures fall back to hardcoded questions | Pass |

---

## 5. API Endpoints

### 5.1 Authentication
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Bearer | Login/Register (Firebase sync) |
| GET | `/api/auth/me` | Bearer | Get current user |
| GET | `/api/auth/check-email` | No | Check email existence |

### 5.2 Profile
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/profile` | Bearer | Get full profile (all sections) |
| POST | `/api/profile` | Bearer | Save basic info |
| POST | `/api/profile/education` | Bearer | Add education |
| PUT | `/api/profile/education/:id` | Bearer | Update education |
| DELETE | `/api/profile/education/:id` | Bearer | Delete education |
| POST | `/api/profile/skills` | Bearer | Add skill |
| DELETE | `/api/profile/skills/:skillId` | Bearer | Remove skill |
| POST | `/api/profile/projects` | Bearer | Add project |
| PUT | `/api/profile/projects/:id` | Bearer | Update project |
| DELETE | `/api/profile/projects/:id` | Bearer | Delete project |
| POST | `/api/profile/learning-goals` | Bearer | Save learning goals |
| POST | `/api/profile/weak-areas` | Bearer | Save weak areas |

### 5.3 Resume
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/resume/upload` | Bearer | Upload PDF (multer + Cloudinary) |
| DELETE | `/api/resume/:id` | Bearer | Delete resume (Cloudinary + DB) |

### 5.4 Interviews
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/interviews` | Bearer | List past sessions |
| POST | `/api/interviews/start` | Bearer | Start new session (AI-generated questions) |
| GET | `/api/interviews/:id` | Bearer | Get session by ID |
| POST | `/api/interviews/submit/:id` | Bearer | Submit responses |

### 5.5 Autocomplete
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/autocomplete/roles?q=` | Bearer | Search roles |
| GET | `/api/autocomplete/skills?q=` | Bearer | Search skills |
| GET | `/api/autocomplete/degrees?q=` | Bearer | Search degrees |
| GET | `/api/autocomplete/specializations?q=` | Bearer | Search specializations |
| GET | `/api/autocomplete/institutions?q=` | Bearer | Search institutions |

### 5.6 AI
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/ai/analyze-profile` | Bearer | Analyze profile via Groq |
| POST | `/api/ai/evaluate-interview` | Bearer | Evaluate responses via Groq |
| POST | `/api/ai/generate-questions` | Bearer | Generate interview questions via Groq |

---

## 6. Data Model

### 6.1 users
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL PK | |
| firebase_uid | VARCHAR(255) UNIQUE | |
| email | VARCHAR(255) UNIQUE | |
| full_name | VARCHAR(150) | |
| role | VARCHAR(20) | candidate / recruiter / admin |
| profile_picture_url | TEXT | |
| is_verified | BOOLEAN | |
| created_at / updated_at / last_login | TIMESTAMP | |

### 6.2 candidate_profiles
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL PK | |
| user_id | BIGINT FK → users | UNIQUE |
| first_name | VARCHAR(150) | |
| last_name | VARCHAR(150) | |
| profile_picture_url | TEXT | |
| target_role_id | INT FK → roles | |
| experience_level | VARCHAR(50) | Student / Fresher / etc. |

### 6.3 candidate_education
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| user_id | BIGINT FK → users | |
| degree_id | INT FK → degrees | |
| specialization_id | INT FK → specializations | |
| institution_id | INT FK → institutions | |
| current_year | VARCHAR(50) | |
| graduation_year | INTEGER | |
| cgpa | DECIMAL(4,2) | |

### 6.4 skills + candidate_skills
- `skills`: id, name, category_id → skill_categories
- `candidate_skills`: user_id, skill_id (composite PK)

### 6.5 candidate_projects + candidate_project_skills
- `candidate_projects`: id, user_id, project_name, description, github_url, live_demo, start_date, end_date
- `candidate_project_skills`: project_id, skill_id (composite PK)

### 6.6 resumes
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL PK | |
| candidate_id | BIGINT FK → users | |
| file_name | VARCHAR(255) | Original filename |
| cloudinary_url | TEXT | Secure URL |
| cloudinary_public_id | TEXT | For deletion |
| file_size | BIGINT | |
| mime_type | VARCHAR(100) | |
| uploaded_at | TIMESTAMP | |
| is_primary | BOOLEAN | |

### 6.7 mock_interviews
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| user_id | BIGINT FK → users | |
| questions | JSONB | AI-generated question array |
| responses | JSONB | User responses |
| score | INTEGER | 0-100 |
| feedback | JSONB | Per-question feedback |
| category | VARCHAR(100) | aptitude, technical, etc. |
| difficulty | VARCHAR(50) | |
| duration | INTEGER | Minutes |
| mode | VARCHAR(50) | Practice / Exam / Voice |
| created_at | TIMESTAMP | |

### 6.8 Reference Tables
- `roles` — 25 predefined roles
- `skill_categories` — 12 categories
- `skills` — 74 skills with category_id
- `degrees` — 16 degrees
- `specializations` — 17 specializations
- `institutions` — 25 institutions

---

## 7. AI Integration

### 7.1 Provider
**Groq** with `llama-3.3-70b-versatile`

### 7.2 Service Layer
Single reusable function in `backend/services/ai.js`:
```
askAI(messages, options?) → Promise<string>
```
- `messages`: Array of `{ role, content }` (OpenAI-compatible format)
- `options.temperature` (default 0.7)
- `options.max_tokens` (default 2048)

### 7.3 Question Generation Flow
1. User configures category, difficulty, duration, mode
2. Frontend shows `<QuestionLoader />` animation
3. Backend `startMockInterview` builds a structured prompt with profile context
4. Calls `askAI()` → Groq Chat Completions API
5. Parses JSON array from response (`question`, `options`, `answer`, `explanation`)
6. Falls back to hardcoded pool if AI fails

### 7.4 Evaluation Flow
1. User submits responses
2. Backend `submitInterviewResponses` calls `askAI()` with responses
3. Groq returns score, per-question feedback, strengths, improvements
4. Falls back to heuristic scoring if AI fails

---

## 8. Unlock Logic

Modules unlock based on profile completeness:

| Requirement | Check | Effect |
|---|---|---|
| None | Always true | Aptitude, GK, English always open |
| `resume` | `profile.resume_url` truthy | Resume, Company-Specific |
| `tech_stack` | `profile.skills.length > 0` | Technical, Coding, Role-Specific, Mixed |
| `profile` | `profile.target_role_name` truthy | HR, Behavioral, Domain, Case Study, Voice |
| `advanced` | Has either tech_stack or profile | System Design |

---

## 9. Environment Variables

### Frontend (`frontend/.env`)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_BASE_URL=http://localhost:5000
```

### Backend (`backend/.env`)
```
DATABASE_URL=
JWT_SECRET=
PORT=5000
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

---

## 10. Constraints & Assumptions

- No TypeScript — plain JavaScript only
- No UI library — hand-written CSS
- No recruiter fields (phone, address, salary, notice period, social URLs, certifications, languages, experience with years/companies)
- No Tailwind CSS
- No Python backend in active use (FastAPI app is legacy)
- AI gateway is Groq only (not Ollama, not custom endpoints)
- Resume stored exclusively in Cloudinary (not locally)
- All autocomplete data is seeded, not user-creatable

---

## 11. Future Scope

- AI Voice Interview mode (Web Speech API integration)
- Coding challenge with in-browser code editor
- Company-specific question banks
- Advanced analytics and progress tracking
- Peer comparison and leaderboards
- Mobile app (React Native)

---

*Document generated from codebase analysis — July 2026*
