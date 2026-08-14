/* ==========================================================
   HireSense — Idempotent aptitude schema migration
   ----------------------------------------------------------
   Adds enterprise-assessment columns to aptitude_assessments.
   Safe to run on every server boot (ADD COLUMN IF NOT EXISTS).
   ========================================================== */

const db = require("../config/database");

const MIGRATIONS = [
  `ALTER TABLE aptitude_assessments
     ADD COLUMN IF NOT EXISTS grade VARCHAR(30) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS integrity_score INTEGER DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS percentile NUMERIC(5,2) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS avg_time_per_question INTEGER DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS fastest_answer INTEGER DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS slowest_answer INTEGER DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS completion_rate INTEGER DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS thinking_efficiency INTEGER DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS time_management INTEGER DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS next_suggested_test VARCHAR(120) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS evaluation_json JSONB DEFAULT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_aa_status_completed
     ON aptitude_assessments (user_id, status, created_at DESC)`,
];

async function ensureAptitudeSchema() {
  for (const sql of MIGRATIONS) {
    try {
      await db.query(sql);
    } catch (err) {
      console.error("Aptitude schema migration failed:", err.message);
    }
  }
}

module.exports = { ensureAptitudeSchema };
