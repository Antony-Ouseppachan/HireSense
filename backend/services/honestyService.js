/* ==========================================================
   HireSense — Honesty Score Service
   ----------------------------------------------------------
   A weekly "integrity" score per candidate computed from the
   malpractice events detected during aptitude assessments.

   Rules:
     - Every week starts fresh at 100 (Monday → Sunday).
     - Each detected violation deducts points by severity:
         low -5 · medium -10 · high -15 · critical -20
     - A terminated assessment adds a further -15.
     - A clean assessment (0 violations, not terminated) adds +10
       so retaking honestly recovers the score.
     - Score is clamped to 0–100.
   ========================================================== */

const db = require("../config/database");

const SEVERITY_PENALTY = { low: 5, medium: 10, high: 15, critical: 20 };
const TERMINATED_PENALTY = 15;
const CLEAN_BONUS = 10;

const WARNING_THRESHOLD = 80; // below this → navbar warning
const LOCK_THRESHOLD = 75;    // at or below this → interview studio locked

function getWeekStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(weekStart) {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

async function ensureTable() {
  const { readFileSync } = require("fs");
  const path = require("path");
  const sql = readFileSync(path.join(__dirname, "../database/migration_honesty.sql"), "utf8");
  await db.query(sql);
}

async function recomputeWeek(userId, weekStart) {
  const start = getWeekStart(weekStart);
  const end = getWeekEnd(start);

  const result = await db.query(
    `SELECT id, terminated, warnings FROM aptitude_assessments
     WHERE user_id = $1 AND status = 'completed' AND created_at >= $2 AND created_at < $3`,
    [userId, start.toISOString(), end.toISOString()]
  );
  const assessments = result.rows;

  let score = 100;
  let violationsCount = 0;
  let cleanAssessments = 0;

  for (const a of assessments) {
    const logs = await db.query(
      `SELECT severity FROM aptitude_malpractice_logs WHERE assessment_id = $1`,
      [a.id]
    );
    const violationCount = logs.rows.length;
    violationsCount += violationCount;

    let delta = 0;
    for (const l of logs.rows) {
      delta -= SEVERITY_PENALTY[l.severity] ?? SEVERITY_PENALTY.low;
    }
    if (a.terminated) {
      delta -= TERMINATED_PENALTY;
    }
    if (violationCount === 0 && !a.terminated) {
      delta += CLEAN_BONUS;
      cleanAssessments += 1;
    }

    score += delta;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  await db.query(
    `INSERT INTO honesty_scores (user_id, score, week_start, violations_count, clean_assessments, total_assessments, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id, week_start)
     DO UPDATE SET score = EXCLUDED.score,
                   violations_count = EXCLUDED.violations_count,
                   clean_assessments = EXCLUDED.clean_assessments,
                   total_assessments = EXCLUDED.total_assessments,
                   updated_at = NOW()`,
    [userId, score, start.toISOString().slice(0, 10), violationsCount, cleanAssessments, assessments.length]
  );

  return buildHonesty(userId, score, start, violationsCount, cleanAssessments, assessments.length);
}

function buildHonesty(userId, score, weekStart, violationsCount, cleanAssessments, totalAssessments) {
  const start = weekStart instanceof Date ? weekStart : new Date(weekStart);
  const end = getWeekEnd(start);
  return {
    score,
    locked: score <= LOCK_THRESHOLD,
    warning: score < WARNING_THRESHOLD,
    status: score > 95 ? "excellent" : score >= WARNING_THRESHOLD ? "good" : score > LOCK_THRESHOLD ? "warning" : "locked",
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    weekRangeLabel: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " – " + new Date(end.getTime() - 1).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    violationsCount,
    cleanAssessments,
    totalAssessments,
  };
}

async function getHonesty(userId) {
  try {
    await ensureTable();
  } catch (err) {
    console.error("Honesty schema ensure failed:", err.message);
  }

  const weekStart = getWeekStart();
  const weekStartDate = weekStart.toISOString().slice(0, 10);

  const existing = await db.query(
    `SELECT score, violations_count, clean_assessments, total_assessments
     FROM honesty_scores WHERE user_id = $1 AND week_start = $2`,
    [userId, weekStartDate]
  );

  if (existing.rows.length > 0) {
    const r = existing.rows[0];
    return buildHonesty(
      userId,
      r.score,
      weekStart,
      r.violations_count,
      r.clean_assessments,
      r.total_assessments
    );
  }

  return recomputeWeek(userId, weekStart);
}

async function applyAssessment(userId, assessmentId) {
  // Recompute the current week from scratch — idempotent, so calling it
  // again for the same assessment (e.g. duplicate complete calls) is safe.
  return recomputeWeek(userId, new Date());
}

async function isLocked(userId) {
  try {
    const honesty = await getHonesty(userId);
    return honesty.locked;
  } catch (err) {
    console.error("Honesty lock check failed:", err.message);
    return false;
  }
}

module.exports = {
  getHonesty,
  applyAssessment,
  isLocked,
  getWeekStart,
  WARNING_THRESHOLD,
  LOCK_THRESHOLD,
};
