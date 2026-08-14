/* One-time backfill: recompute stored time/performance metrics for all
   completed aptitude assessments using the corrected evaluation logic.
   AI-generated fields (feedback, improvement_plan, learning_roadmap) are
   left untouched — only deterministic metric columns are rewritten. */

const db = require("../config/database");
const { evaluate } = require("../services/evaluationEngine");

async function run() {
  const list = await db.query(
    `SELECT id FROM aptitude_assessments WHERE status = 'completed' ORDER BY id`
  );
  let updated = 0;
  let skipped = 0;

  for (const row of list.rows) {
    const id = row.id;

    const q = await db.query(
      `SELECT * FROM aptitude_questions WHERE assessment_id = $1 ORDER BY question_number`,
      [id]
    );
    const a = await db.query(
      `SELECT * FROM aptitude_answers WHERE assessment_id = $1`,
      [id]
    );
    const m = await db.query(
      `SELECT * FROM aptitude_malpractice_logs WHERE assessment_id = $1 ORDER BY "timestamp"`,
      [id]
    );
    const assess = await db.query(
      `SELECT difficulty, time_limit, remaining_time FROM aptitude_assessments WHERE id = $1`,
      [id]
    );

    if (q.rows.length === 0) { skipped++; continue; }

    const violations = m.rows.map((r) => ({
      timestamp: r.timestamp, type: r.type, severity: r.severity,
      detail: r.detail, questionNumber: r.question_number,
    }));

    const metrics = evaluate({
      questions: q.rows,
      answers: a.rows,
      difficulty: assess.rows[0].difficulty,
      timeLimit: assess.rows[0].time_limit,
      remainingTime: assess.rows[0].remaining_time,
      violations,
    });

    await db.query(
      `UPDATE aptitude_assessments SET
        score = $1, correct_count = $2, incorrect_count = $3,
        skipped_count = $4, accuracy = $5, time_taken = $6,
        topic_performance = $7, difficulty_performance = $8,
        weak_topics = $9, strong_topics = $10,
        grade = $11, integrity_score = $12, percentile = $13,
        avg_time_per_question = $14, fastest_answer = $15, slowest_answer = $16,
        completion_rate = $17, thinking_efficiency = $18, risk_score = $19,
        next_suggested_test = $20, evaluation_json = $21, time_management = $22
      WHERE id = $23`,
      [
        metrics.score, metrics.correct, metrics.incorrect, metrics.skipped,
        Math.round(metrics.accuracy * 100) / 100, metrics.timeTaken,
        JSON.stringify(metrics.topicPerformance), JSON.stringify(metrics.difficultyPerformance),
        JSON.stringify(metrics.weakTopics), JSON.stringify(metrics.strongTopics),
        metrics.grade, metrics.integrityScore, metrics.percentile,
        metrics.avgTimePerQuestion, metrics.fastestAnswer, metrics.slowestAnswer,
        metrics.completionRate, metrics.thinkingEfficiency, metrics.riskScore,
        metrics.nextSuggestedTest, JSON.stringify(metrics), metrics.timeManagement,
        id,
      ]
    );
    updated++;
    console.log(`[backfill] assessment ${id}: thinkingEff=${metrics.thinkingEfficiency}% timeMgmt=${metrics.timeManagement}% avg=${metrics.avgTimePerQuestion}s fastest=${metrics.fastestAnswer}s slowest=${metrics.slowestAnswer}s`);
  }

  console.log(`[backfill] done: ${updated} updated, ${skipped} skipped (no questions).`);
  process.exit(0);
}

run().catch((e) => { console.error("[backfill] failed:", e); process.exit(1); });
