const db = require("../config/database");
const { askAI } = require("../services/ai");
const { generateQuestionsForAssessment } = require("../services/questionGenerator");
const { evaluate } = require("../services/evaluationEngine");
const { generateAIAnalysis, deterministicAnalysis } = require("../services/aiReportGenerator");
const { ensureAptitudeSchema } = require("../services/assessmentSchema");
const { getHonesty, applyAssessment, isLocked } = require("../services/honestyService");

ensureAptitudeSchema();

// ─── Helpers ───────────────────────────────────────────────────────────────

async function resolveUserId(firebaseUid) {
  const result = await db.query("SELECT id FROM users WHERE firebase_uid = $1", [firebaseUid]);
  return result.rows.length ? result.rows[0].id : null;
}

function computeRiskLevel(violations, terminated) {
  if (terminated) return "critical";
  const count = (violations || []).length;
  if (count === 0) return "none";
  if (count <= 1) return "low";
  if (count === 2) return "medium";
  return "high";
}

function computeMalpracticeSummary(violations) {
  const summary = {};
  for (const v of violations || []) {
    const type = v.type || "unknown";
    if (!summary[type]) summary[type] = { type, label: violationLabel(type), count: 0, firstSeen: v.timestamp, lastSeen: v.timestamp };
    summary[type].count++;
    if (v.timestamp > summary[type].lastSeen) summary[type].lastSeen = v.timestamp;
  }
  return summary;
}

function violationLabel(type) {
  const labels = {
    "tab-switch": "Tab Switch", "window-blur": "Browser Lost Focus", "copy": "Copy Attempt",
    "cut": "Cut Attempt", "paste": "Paste Attempt", "right-click": "Right Click",
    "keyboard-shortcut": "Blocked Shortcut", "fullscreen-exit": "Exited Fullscreen",
    "page-refresh": "Page Refresh Attempt", "navigation": "Navigation Attempt",
  };
  return labels[type] || type;
}

function generateRemarks(violations, terminated) {
  const count = (violations || []).length;
  if (terminated) return "Repeated Academic Integrity Violations.\nAssessment terminated due to multiple examination rule violations.";
  if (count === 0) return "No malpractice detected.\nAssessment completed successfully following all examination guidelines.";
  const summary = computeMalpracticeSummary(violations);
  const lines = ["Assessment completed.", "The following violations were recorded:"];
  for (const s of Object.values(summary)) lines.push(`- ${s.label}: ${s.count} time(s)`);
  return lines.join("\n");
}

const QUESTION_COUNTS = { easy: 20, medium: 25, hard: 30 };

// ─── 1. Generate ───────────────────────────────────────────────────────────

async function generate(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    // Honesty lock: users with a low honesty score may only reattempt
    // previous assessments, not generate brand-new ones.
    if (await isLocked(userId)) {
      return res.status(403).json({
        success: false,
        message: "Interview Studio is locked due to a low honesty score. Reattempt a previous assessment without cheating to restore your score.",
      });
    }

    const { profile, difficulty } = req.body;
    const totalQuestions = QUESTION_COUNTS[difficulty] || 25;

    // Create assessment record
    const assessResult = await db.query(
      `INSERT INTO aptitude_assessments
         (user_id, difficulty, total_questions, status, questions_generated, created_at, updated_at)
       VALUES ($1, $2, $3, 'generating', 0, NOW(), NOW())
       RETURNING id`,
      [userId, difficulty, totalQuestions]
    );
    const assessmentId = assessResult.rows[0].id;

    // Start background generation (non-blocking)
    generateQuestionsForAssessment(assessmentId, profile, difficulty, totalQuestions);

    res.status(201).json({ success: true, assessmentId });
  } catch (error) {
    console.error("Generate assessment error:", error.message);
    res.status(500).json({ success: false, message: "Failed to create assessment." });
  }
}

// ─── 2. Assessment Status ──────────────────────────────────────────────────

async function getStatus(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;
    const result = await db.query(
      `SELECT status, difficulty, total_questions, questions_generated, created_at, updated_at
       FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Assessment not found." });

    res.json({ success: true, assessment: result.rows[0] });
  } catch (error) {
    console.error("Get assessment status error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch status." });
  }
}

// ─── 3. Get Assessment (with questions, excluding correct answers in progress) ──

async function getAssessment(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;

    const assessResult = await db.query(
      `SELECT * FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (assessResult.rows.length === 0) return res.status(404).json({ message: "Assessment not found." });
    const assessment = assessResult.rows[0];

    // Load questions (without correct answers if test is in progress/ready)
    const hideAnswers = ["ready", "in_progress", "failed"].includes(assessment.status);
    const questionsResult = await db.query(
      `SELECT id, question_number, type, question_text, options, topic, difficulty,
              sub_difficulty, marks, expected_time, passage, batch_number
       FROM aptitude_questions WHERE assessment_id = $1 ORDER BY question_number`,
      [id]
    );

    // Load saved answers (for resume)
    const answersResult = await db.query(
      `SELECT q.question_number, a.user_answer, a.time_spent, a.status
       FROM aptitude_answers a
       JOIN aptitude_questions q ON a.question_id = q.id
       WHERE a.assessment_id = $1 ORDER BY q.question_number`,
      [id]
    );

    // Load malpractice logs
    const malpracticeResult = await db.query(
      `SELECT * FROM aptitude_malpractice_logs WHERE assessment_id = $1 ORDER BY "timestamp"`,
      [id]
    );

    res.json({
      success: true,
      assessment: {
        id: assessment.id,
        difficulty: assessment.difficulty,
        status: assessment.status,
        totalQuestions: assessment.total_questions,
        questionsGenerated: assessment.questions_generated,
        timeLimit: assessment.time_limit,
        startedAt: assessment.started_at,
        completedAt: assessment.completed_at,
        score: assessment.score,
        correct: assessment.correct_count,
        incorrect: assessment.incorrect_count,
        accuracy: assessment.accuracy,
        terminated: assessment.terminated,
        warnings: assessment.warnings,
        riskLevel: assessment.risk_level,
        remarks: assessment.remarks,
        topicPerformance: assessment.topic_performance,
        difficultyPerformance: assessment.difficulty_performance,
        weakTopics: assessment.weak_topics,
        strongTopics: assessment.strong_topics,
        feedback: assessment.feedback,
        improvementPlan: assessment.improvement_plan,
        learningRoadmap: assessment.learning_roadmap,
      },
      questions: questionsResult.rows.map((q) => ({
        id: q.id,
        number: q.question_number,
        type: q.type,
        question: q.question_text,
        options: q.options,
        topic: q.topic,
        difficulty: q.sub_difficulty || q.difficulty,
        marks: q.marks,
        expectedTime: q.expected_time,
        passage: q.passage,
        correctAnswer: hideAnswers ? undefined : q.correct_answer,
      })),
      answers: answersResult.rows.map((a) => ({
        questionNumber: a.question_number,
        answer: a.user_answer,
        timeSpent: a.time_spent,
        status: a.status,
      })),
      malpractice: malpracticeResult.rows,
    });
  } catch (error) {
    console.error("Get assessment error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch assessment." });
  }
}

// ─── 4. Validate & Load Assessment (no status change) ─────────────────────

async function start(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;

    const assessResult = await db.query(
      `SELECT status, total_questions, difficulty FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (assessResult.rows.length === 0) return res.status(404).json({ message: "Assessment not found." });

    const { status } = assessResult.rows[0];
    if (status !== "ready" && status !== "in_progress") {
      return res.status(400).json({ message: `Assessment cannot be started. Current status: ${status}` });
    }

    // Load all questions (without correct answer)
    const questionsResult = await db.query(
      `SELECT id, question_number, type, question_text, options, topic,
              sub_difficulty, marks, expected_time, passage
       FROM aptitude_questions WHERE assessment_id = $1 ORDER BY question_number`,
      [id]
    );

    // Load saved answers (for resume)
    const answersResult = await db.query(
      `SELECT q.question_number, a.user_answer, a.time_spent, a.status
       FROM aptitude_answers a
       JOIN aptitude_questions q ON a.question_id = q.id
       WHERE a.assessment_id = $1 ORDER BY q.question_number`,
      [id]
    );

    res.json({
      success: true,
      status,
      questions: questionsResult.rows.map((q) => ({
        id: q.id,
        number: q.question_number,
        type: q.type,
        question: q.question_text,
        options: q.options,
        topic: q.topic,
        difficulty: q.sub_difficulty || q.difficulty,
        marks: q.marks,
        expectedTime: q.expected_time,
        passage: q.passage,
      })),
      answers: answersResult.rows.map((a) => ({
        questionNumber: a.question_number,
        answer: a.user_answer,
        timeSpent: a.time_spent,
        status: a.status,
      })),
    });
  } catch (error) {
    console.error("Start assessment error:", error.message);
    res.status(500).json({ success: false, message: "Failed to start assessment." });
  }
}

// ─── 4b. Begin Assessment (set IN_PROGRESS after frontend init) ───────────

async function begin(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;

    const assessResult = await db.query(
      `SELECT status FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (assessResult.rows.length === 0) return res.status(404).json({ message: "Assessment not found." });

    if (assessResult.rows[0].status === "in_progress") {
      return res.json({ success: true, message: "Already in progress." });
    }
    if (assessResult.rows[0].status !== "ready") {
      return res.status(400).json({ message: `Assessment cannot begin. Current status: ${assessResult.rows[0].status}` });
    }

    await db.query(
      `UPDATE aptitude_assessments SET status = 'in_progress', started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Begin assessment error:", error.message);
    res.status(500).json({ success: false, message: "Failed to begin assessment." });
  }
}

// ─── 5. Get Single Question ────────────────────────────────────────────────

async function getQuestion(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id, number } = req.params;

    const assessResult = await db.query(
      `SELECT status FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (assessResult.rows.length === 0) return res.status(404).json({ message: "Assessment not found." });
    if (assessResult.rows[0].status !== "in_progress") {
      return res.status(400).json({ message: "Assessment is not in progress." });
    }

    const questionResult = await db.query(
      `SELECT id, question_number AS number, type, question_text AS question, options, topic,
              sub_difficulty AS difficulty, marks, expected_time AS "expectedTime", passage
       FROM aptitude_questions WHERE assessment_id = $1 AND question_number = $2`,
      [id, number]
    );
    if (questionResult.rows.length === 0) return res.status(404).json({ message: "Question not found." });

    // Include saved answer if exists
    const answerResult = await db.query(
      `SELECT user_answer AS "userAnswer", time_spent AS "timeSpent", status
       FROM aptitude_answers WHERE assessment_id = $1 AND question_id = $2`,
      [id, questionResult.rows[0].id]
    );

    res.json({
      success: true,
      question: questionResult.rows[0],
      savedAnswer: answerResult.rows[0] || null,
    });
  } catch (error) {
    console.error("Get question error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch question." });
  }
}

// ─── 6. Save Answer (real-time) ────────────────────────────────────────────

async function saveAnswer(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;
    const { questionId, answer, timeSpent, status } = req.body;

    const assessResult = await db.query(
      `SELECT status FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (assessResult.rows.length === 0) return res.status(404).json({ message: "Assessment not found." });
    if (assessResult.rows[0].status !== "in_progress") {
      return res.status(400).json({ message: "Assessment is not in progress." });
    }

    await db.query(
      `INSERT INTO aptitude_answers (assessment_id, question_id, user_answer, time_spent, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (assessment_id, question_id)
       DO UPDATE SET user_answer = EXCLUDED.user_answer, time_spent = EXCLUDED.time_spent,
                     status = EXCLUDED.status, updated_at = NOW()`,
      [id, questionId, answer ?? null, timeSpent ?? 0, status || "answered"]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Save answer error:", error.message);
    res.status(500).json({ success: false, message: "Failed to save answer." });
  }
}

// ─── 7. Log Malpractice Event ──────────────────────────────────────────────

async function logMalpractice(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;
    const { type, severity, detail, browserInfo, questionNumber } = req.body;

    await db.query(
      `INSERT INTO aptitude_malpractice_logs (assessment_id, question_number, type, severity, detail, browser_info, "timestamp")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, questionNumber || 0, type || "unknown", severity || "low", detail || null, browserInfo ? JSON.stringify(browserInfo) : null]
    );

    // Update warnings counter on assessment
    await db.query(
      `UPDATE aptitude_assessments SET warnings = (SELECT COUNT(*) FROM aptitude_malpractice_logs WHERE assessment_id = $1), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Log malpractice error:", error.message);
    res.status(500).json({ success: false, message: "Failed to log malpractice event." });
  }
}

// ─── 8. Complete Assessment ────────────────────────────────────────────────

async function complete(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;

    const assessResult = await db.query(
      `SELECT * FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (assessResult.rows.length === 0) return res.status(404).json({ message: "Assessment not found." });
    const assessment = assessResult.rows[0];
    if (assessment.status === "completed") {
      // Already submitted — return existing result
      return res.json({ success: true, id: assessment.id, result: await formatResultFull(assessment.id, assessment) });
    }

    if (assessment.status !== "in_progress") {
      return res.status(400).json({ message: `Assessment cannot be completed. Current status: ${assessment.status}` });
    }

    // Fetch all questions and answers
    const questionsResult = await db.query(
      `SELECT * FROM aptitude_questions WHERE assessment_id = $1 ORDER BY question_number`,
      [id]
    );
    const answersResult = await db.query(
      `SELECT a.*, q.correct_answer, q.topic, q.sub_difficulty
       FROM aptitude_answers a
       JOIN aptitude_questions q ON a.question_id = q.id
       WHERE a.assessment_id = $1`,
      [id]
    );

    // Mark answers correct/incorrect first (deterministic scoring)
    for (const ans of answersResult.rows) {
      const q = questionsResult.rows.find((x) => x.id === ans.question_id);
      if (!q) continue;
      const ok = q.type === "multiple"
        ? arraysEqual(JSON.parse(ans.user_answer || "[]"), q.correct_answer)
        : String(ans.user_answer) === String(q.correct_answer);
      await db.query("UPDATE aptitude_answers SET is_correct = $1 WHERE id = $2", [ok, ans.id]);
    }

    // Fetch malpractice logs
    const malpracticeResult = await db.query(
      `SELECT * FROM aptitude_malpractice_logs WHERE assessment_id = $1 ORDER BY "timestamp"`,
      [id]
    );
    const violationList = malpracticeResult.rows.map((r) => ({
      timestamp: r.timestamp,
      type: r.type,
      severity: r.severity,
      detail: r.detail,
      questionNumber: r.question_number,
    }));
    const totalWarnings = violationList.length;

    // Determine termination status
    const terminated = assessment.status === "in_progress" && violationList.length >= 3;
    const riskLevel = computeRiskLevel(violationList, terminated);
    const malpracticeSummary = computeMalpracticeSummary(violationList);
    const remarks = generateRemarks(violationList, terminated);

    const timeTaken = assessment.time_limit
      ? Math.max(0, assessment.time_limit - (assessment.remaining_time || 0))
      : null;

    // ── Evaluation Engine (deterministic, server-side) ──────────────────
    const metrics = evaluate({
      questions: questionsResult.rows,
      answers: answersResult.rows,
      difficulty: assessment.difficulty,
      timeLimit: assessment.time_limit,
      remainingTime: assessment.remaining_time,
      violations: violationList,
    });

    // ── Persist completion FIRST so the attempt can never be left stuck in
    //    "in_progress" if the AI report below is slow or fails. ──────────
    await db.query(
      `UPDATE aptitude_assessments SET
        status = 'completed', score = $1, correct_count = $2, incorrect_count = $3,
        skipped_count = $4, accuracy = $5, time_taken = $6, warnings = $7,
        terminated = $8, risk_level = $9, remarks = $10, malpractice_summary = $11,
        violation_log = $12, topic_performance = $13, difficulty_performance = $14,
        weak_topics = $15, strong_topics = $16,
        improvement_plan = $17, learning_roadmap = $18, completed_at = NOW(), updated_at = NOW(),
        grade = $19, integrity_score = $20, percentile = $21,
        avg_time_per_question = $22, fastest_answer = $23, slowest_answer = $24,
        completion_rate = $25, thinking_efficiency = $26, risk_score = $27,
        next_suggested_test = $28, evaluation_json = $29, time_management = $30
      WHERE id = $31`,
      [
        metrics.score, metrics.correct, metrics.incorrect, metrics.skipped,
        Math.round(metrics.accuracy * 100) / 100, metrics.timeTaken, totalWarnings,
        terminated, riskLevel, remarks,
        JSON.stringify(malpracticeSummary), JSON.stringify(violationList),
        JSON.stringify(metrics.topicPerformance), JSON.stringify(metrics.difficultyPerformance),
        JSON.stringify(metrics.weakTopics), JSON.stringify(metrics.strongTopics),
        "[]", "[]",
        metrics.grade, metrics.integrityScore, metrics.percentile,
        metrics.avgTimePerQuestion, metrics.fastestAnswer, metrics.slowestAnswer,
        metrics.completionRate, metrics.thinkingEfficiency, metrics.riskScore,
        metrics.nextSuggestedTest, JSON.stringify(metrics), metrics.timeManagement,
        id,
      ]
    );

    // ── AI Report (never invents marks); bounded so it can't hang ───────
    let ai;
    try {
      ai = await Promise.race([
        generateAIAnalysis(metrics, assessment.difficulty),
        new Promise((_, reject) => setTimeout(() => reject(new Error("AI report timed out")), 60000)),
      ]);
    } catch (e) {
      console.warn("AI analysis timed out, using deterministic defaults:", e.message);
      ai = deterministicAnalysis(metrics);
    }
    const feedback = ai.feedback;
    const improvementPlan = ai.improvementPlan || [];
    const learningRoadmap = ai.learningRoadmap || [];

    await db.query(
      `UPDATE aptitude_assessments SET feedback = $1, improvement_plan = $2,
        learning_roadmap = $3, updated_at = NOW() WHERE id = $4`,
      [feedback, JSON.stringify(improvementPlan), JSON.stringify(learningRoadmap), id]
    );

    // Update the weekly honesty score based on this attempt (fire-and-forget
    // so a scoring hiccup never blocks returning the result).
    applyAssessment(userId, id).catch((err) =>
      console.error("Honesty score update failed:", err.message)
    );

    const result = {
      id: assessment.id,
      score: metrics.score,
      correct: metrics.correct,
      incorrect: metrics.incorrect,
      skipped: metrics.skipped,
      total: metrics.total,
      accuracy: Math.round(metrics.accuracy * 100) / 100,
      grade: metrics.grade,
      percentile: metrics.percentile,
      performanceCategory: metrics.performanceCategory,
      difficulty: assessment.difficulty,
      timeTaken: metrics.timeTaken,
      avgTimePerQuestion: metrics.avgTimePerQuestion,
      fastestAnswer: metrics.fastestAnswer,
      slowestAnswer: metrics.slowestAnswer,
      completionRate: metrics.completionRate,
      thinkingEfficiency: metrics.thinkingEfficiency,
      riskScore: metrics.riskScore,
      integrityScore: metrics.integrityScore,
      warnings: totalWarnings,
      violations: violationList,
      terminated,
      topicPerformance: metrics.topicPerformance,
      difficultyPerformance: metrics.difficultyPerformance,
      difficultyScore: metrics.difficultyScore,
      weakTopics: metrics.weakTopics,
      strongTopics: metrics.strongTopics,
      feedback,
      improvementPlan,
      learningRoadmap,
      strengths: ai.strengths || [],
      weaknesses: ai.weaknesses || [],
      topicsToStudy: ai.topicsToStudy || [],
      recommendedPracticeFrequency: ai.recommendedPracticeFrequency || "",
      estimatedInterviewReadiness: ai.estimatedInterviewReadiness,
      motivationalSummary: ai.motivationalSummary || "",
      nextSuggestedTest: metrics.nextSuggestedTest,
      riskLevel,
      remarks,
      malpracticeSummary,
      completedAt: new Date().toISOString(),
      status: "completed",
    };

    res.json({ success: true, id: assessment.id, result });
  } catch (error) {
    console.error("Complete assessment error:", error.message);
    res.status(500).json({ success: false, message: "Failed to complete assessment." });
  }
}

// ─── 9. Cancel Assessment ──────────────────────────────────────────────────

async function cancel(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;
    const result = await db.query(
      `UPDATE aptitude_assessments SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Assessment not found." });

    res.json({ success: true });
  } catch (error) {
    console.error("Cancel assessment error:", error.message);
    res.status(500).json({ success: false, message: "Failed to cancel assessment." });
  }
}

// ─── 9b. Delete Assessment ─────────────────────────────────────────────────

async function removeAssessment(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;
    const result = await db.query(
      `DELETE FROM aptitude_assessments WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Assessment not found." });

    res.json({ success: true });
  } catch (error) {
    console.error("Delete assessment error:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete assessment." });
  }
}

// ─── 10. History ───────────────────────────────────────────────────────────

async function getHistory(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM aptitude_assessments WHERE user_id = $1`,
      [userId]
    );

    const result = await db.query(
      `SELECT id, difficulty, score, total_questions, correct_count, accuracy,
              time_taken, warnings, terminated, grade, integrity_score, completed_at, created_at, status
       FROM aptitude_assessments
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      success: true,
      history: result.rows,
      pagination: { total: countResult.rows[0].total, limit, offset },
    });
  } catch (error) {
    console.error("Get history error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch history." });
  }
}

// ─── 11. Result ────────────────────────────────────────────────────────────

async function getResult(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;
    const result = await db.query(
      `SELECT * FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Assessment not found." });
    const assessment = result.rows[0];

    // Completed attempts use the persisted evaluation.
    if (assessment.status === "completed") {
      return res.json({ success: true, result: await formatResultFull(id, assessment) });
    }

    // Non-completed attempts (cancelled / in-progress): compute a live AI
    // analysis from whatever answers were submitted so far. This powers the
    // "Analysis" report even when the user never submitted the test.
    const questionsResult = await db.query(
      `SELECT * FROM aptitude_questions WHERE assessment_id = $1 ORDER BY question_number`,
      [id]
    );
    const answersResult = await db.query(
      `SELECT a.* FROM aptitude_answers a WHERE a.assessment_id = $1`,
      [id]
    );
    const malpracticeResult = await db.query(
      `SELECT * FROM aptitude_malpractice_logs WHERE assessment_id = $1 ORDER BY "timestamp"`,
      [id]
    );
    const violations = malpracticeResult.rows.map((r) => ({
      timestamp: r.timestamp, type: r.type, severity: r.severity,
      detail: r.detail, questionNumber: r.question_number,
    }));

    const metrics = evaluate({
      questions: questionsResult.rows,
      answers: answersResult.rows,
      difficulty: assessment.difficulty,
      timeLimit: assessment.time_limit,
      remainingTime: assessment.remaining_time,
      violations,
    });
    const ai = await generateAIAnalysis(metrics, assessment.difficulty);

    const base = formatResult({
      ...assessment,
      score: metrics.score,
      correct_count: metrics.correct,
      incorrect_count: metrics.incorrect,
      skipped_count: metrics.skipped,
      accuracy: metrics.accuracy,
      time_taken: metrics.timeTaken,
      avg_time_per_question: metrics.avgTimePerQuestion,
      fastest_answer: metrics.fastestAnswer,
      slowest_answer: metrics.slowestAnswer,
      completion_rate: metrics.completionRate,
      thinking_efficiency: metrics.thinkingEfficiency,
      time_management: metrics.timeManagement,
      risk_score: metrics.riskScore,
      integrity_score: metrics.integrityScore,
      grade: metrics.grade,
      percentile: metrics.percentile,
      next_suggested_test: metrics.nextSuggestedTest,
      topic_performance: metrics.topicPerformance,
      difficulty_performance: metrics.difficultyPerformance,
      weak_topics: metrics.weakTopics,
      strong_topics: metrics.strongTopics,
      feedback: ai.feedback,
      improvement_plan: ai.improvementPlan,
      learning_roadmap: ai.learningRoadmap,
      evaluation_json: metrics,
    });

    res.json({ success: true, result: { ...base, questions: null, completedAt: null } });
  } catch (error) {
    console.error("Get result error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch result." });
  }
}

// ─── 11b. Question Review (every question + answers + explanations) ────────

async function getReview(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;
    const assess = await db.query(
      `SELECT * FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (assess.rows.length === 0) return res.status(404).json({ success: false, message: "Assessment not found." });

    const questionsResult = await db.query(
      `SELECT * FROM aptitude_questions WHERE assessment_id = $1 ORDER BY question_number`,
      [id]
    );
    const answersResult = await db.query(
      `SELECT a.* FROM aptitude_answers a WHERE a.assessment_id = $1`,
      [id]
    );
    const answerByQuestion = {};
    for (const a of answersResult.rows) answerByQuestion[a.question_id] = a;

    const questions = questionsResult.rows.map((q) => {
      const ans = answerByQuestion[q.id];
      const userAnswer = ans ? ans.user_answer : null;
      const correct = q.type === "multiple"
        ? arraysEqual(JSON.parse(userAnswer || "[]"), q.correct_answer)
        : String(userAnswer) === String(q.correct_answer);
      return {
        id: q.id,
        number: q.question_number,
        type: q.type,
        question: q.question_text,
        options: q.options,
        correctAnswer: q.correct_answer,
        topic: q.topic,
        difficulty: q.sub_difficulty || q.difficulty,
        marks: q.marks,
        explanation: q.explanation || "",
        solution: q.solution || "",
        passage: q.passage || "",
        expectedTime: q.expected_time,
        userAnswer,
        timeSpent: ans?.time_spent || 0,
        status: ans?.status || "unanswered",
        isCorrect: correct,
      };
    });

    res.json({
      success: true,
      review: {
        id: assess.rows[0].id,
        difficulty: assess.rows[0].difficulty,
        score: assess.rows[0].score,
        grade: assess.rows[0].grade,
        questions,
      },
    });
  } catch (error) {
    console.error("Get review error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch review." });
  }
}

// ─── 11c. Reattempt — clone the EXACT question set into a new attempt ──────

async function reattempt(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;
    const src = await db.query(
      `SELECT * FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (src.rows.length === 0) return res.status(404).json({ message: "Attempt not found." });
    if (src.rows[0].status === "generating") {
      return res.status(400).json({ message: "This attempt is still generating questions. Please try again shortly." });
    }

    const source = src.rows[0];
    const client = await db.pool.connect();

    try {
      await client.query("BEGIN");

      // Only reattempt if a question set exists to clone
      const checkQuestions = await client.query(
        `SELECT COUNT(*)::int AS n FROM aptitude_questions WHERE assessment_id = $1`,
        [id]
      );
      if (checkQuestions.rows[0].n === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "This attempt has no question set to reattempt." });
      }

      const insertRes = await client.query(
        `INSERT INTO aptitude_assessments
           (user_id, difficulty, total_questions, status, questions_generated, time_limit, created_at, updated_at)
         VALUES ($1, $2, $3, 'ready', $3, $4, NOW(), NOW())
         RETURNING id`,
        [userId, source.difficulty, source.total_questions, source.time_limit]
      );
      const newId = insertRes.rows[0].id;

      // Clone every question with identical content, order, and correct answers
      const questionsResult = await client.query(
        `SELECT question_number, type, question_text, options, correct_answer, topic,
                difficulty, sub_difficulty, marks, expected_time, solution, explanation,
                learning_objective, common_mistake, passage, batch_number
         FROM aptitude_questions WHERE assessment_id = $1 ORDER BY question_number`,
        [id]
      );
      for (const q of questionsResult.rows) {
        await client.query(
          `INSERT INTO aptitude_questions
             (assessment_id, question_number, type, question_text, options, correct_answer, topic,
              difficulty, sub_difficulty, marks, expected_time, solution, explanation,
              learning_objective, common_mistake, passage, batch_number)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [newId, q.question_number, q.type, q.question_text, JSON.stringify(q.options),
           q.correct_answer, q.topic, q.difficulty, q.sub_difficulty, q.marks, q.expected_time,
           q.solution, q.explanation, q.learning_objective, q.common_mistake, q.passage, q.batch_number]
        );
      }

      await client.query("COMMIT");
      res.json({ success: true, assessmentId: newId, difficulty: source.difficulty });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Reattempt error:", error.message);
    res.status(500).json({ success: false, message: "Failed to create reattempt." });
  }
}

// ─── 12. Remarks ───────────────────────────────────────────────────────────

async function getRemarks(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const result = await db.query(
      `SELECT id, difficulty, score, accuracy, time_taken, warnings,
              terminated, risk_level, remarks, malpractice_summary,
              violation_log, completed_at, created_at
       FROM aptitude_assessments
       WHERE user_id = $1 AND status = 'completed'
       ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );

    res.json({ success: true, remarks: result.rows });
  } catch (error) {
    console.error("Get remarks error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch remarks." });
  }
}

async function getRemarkDetail(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;
    const result = await db.query(
      `SELECT * FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Remark not found." });

    const r = result.rows[0];

    // Fetch malpractice logs for detailed timeline
    const logsResult = await db.query(
      `SELECT * FROM aptitude_malpractice_logs WHERE assessment_id = $1 ORDER BY "timestamp"`,
      [id]
    );

    res.json({
      success: true,
      remark: {
        id: r.id,
        score: r.score,
        correct: r.correct_count,
        incorrect: r.incorrect_count,
        skipped: r.skipped_count,
        total: r.total_questions,
        accuracy: r.accuracy,
        difficulty: r.difficulty,
        timeTaken: r.time_taken,
        warnings: r.warnings,
        violations: logsResult.rows.map((l) => ({
          timestamp: l.timestamp,
          type: l.type,
          severity: l.severity,
          detail: l.detail,
          questionNumber: l.question_number,
        })),
        terminated: r.terminated,
        riskLevel: r.risk_level || "none",
        remarks: r.remarks || "",
        malpracticeSummary: r.malpractice_summary || {},
        violationLog: logsResult.rows,
        feedback: r.feedback || "",
        improvementPlan: r.improvement_plan || [],
        learningRoadmap: r.learning_roadmap || [],
        topicPerformance: r.topic_performance || {},
        difficultyPerformance: r.difficulty_performance || {},
        weakTopics: r.weak_topics || [],
        strongTopics: r.strong_topics || [],
        completedAt: r.completed_at,
      },
    });
  } catch (error) {
    console.error("Get remark detail error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch remark detail." });
  }
}

// ─── Format Helper ─────────────────────────────────────────────────────────

function formatResult(r) {
  const evaluation = r.evaluation_json || {};
  return {
    id: r.id,
    score: r.score,
    correct: r.correct_count,
    incorrect: r.incorrect_count,
    skipped: r.skipped_count,
    total: r.total_questions,
    accuracy: r.accuracy,
    difficulty: r.difficulty,
    timeTaken: r.time_taken,
    avgTimePerQuestion: r.avg_time_per_question,
    fastestAnswer: r.fastest_answer,
    slowestAnswer: r.slowest_answer,
    completionRate: r.completion_rate,
    thinkingEfficiency: r.thinking_efficiency,
    riskScore: r.risk_score,
    integrityScore: r.integrity_score,
    grade: r.grade,
    percentile: r.percentile,
    nextSuggestedTest: r.next_suggested_test,
    warnings: r.warnings || 0,
    violations: r.violations || [],
    terminated: r.terminated,
    topicPerformance: r.topic_performance || {},
    difficultyPerformance: r.difficulty_performance || {},
    difficultyScore: evaluation.difficultyScore || {},
    weakTopics: r.weak_topics || [],
    strongTopics: r.strong_topics || [],
    feedback: r.feedback || "",
    improvementPlan: r.improvement_plan || [],
    learningRoadmap: r.learning_roadmap || [],
    strengths: evaluation.strengths || [],
    weaknesses: evaluation.weaknesses || [],
    topicsToStudy: evaluation.topicsToStudy || [],
    recommendedPracticeFrequency: evaluation.recommendedPracticeFrequency || "",
    estimatedInterviewReadiness: evaluation.estimatedInterviewReadiness ?? null,
    motivationalSummary: evaluation.motivationalSummary || "",
    riskLevel: r.risk_level || "none",
    remarks: r.remarks || "",
    malpracticeSummary: r.malpractice_summary || {},
    completedAt: r.completed_at,
    status: r.status,
  };
}

async function formatResultFull(id, r) {
  const base = formatResult(r);
  const questionsResult = await db.query(
    `SELECT * FROM aptitude_questions WHERE assessment_id = $1 ORDER BY question_number`,
    [id]
  );
  const answersResult = await db.query(
    `SELECT a.* FROM aptitude_answers a WHERE a.assessment_id = $1`,
    [id]
  );
  const answerByQuestion = {};
  for (const a of answersResult.rows) answerByQuestion[a.question_id] = a;

  const questions = questionsResult.rows.map((q) => {
    const ans = answerByQuestion[q.id];
    const userAnswer = ans ? ans.user_answer : null;
    const correct = q.type === "multiple"
      ? arraysEqual(JSON.parse(userAnswer || "[]"), q.correct_answer)
      : String(userAnswer) === String(q.correct_answer);
    return {
      id: q.id,
      number: q.question_number,
      type: q.type,
      question: q.question_text,
      options: q.options,
      correctAnswer: q.correct_answer,
      topic: q.topic,
      difficulty: q.sub_difficulty || q.difficulty,
      marks: q.marks,
      explanation: q.explanation || "",
      solution: q.solution || "",
      passage: q.passage || "",
      expectedTime: q.expected_time,
      userAnswer,
      timeSpent: ans?.time_spent || 0,
      status: ans?.status || "unanswered",
      isCorrect: correct,
    };
  });

  return { ...base, questions };
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

// ─── 13. Honesty Score ─────────────────────────────────────────────────────

async function getHonestyScore(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const honesty = await getHonesty(userId);
    res.json({ success: true, honesty });
  } catch (error) {
    console.error("Get honesty score error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch honesty score." });
  }
}

module.exports = {
  generate,
  getStatus,
  getAssessment,
  start,
  begin,
  getQuestion,
  saveAnswer,
  logMalpractice,
  complete,
  cancel,
  removeAssessment,
  getHistory,
  getResult,
  getReview,
  reattempt,
  getRemarks,
  getRemarkDetail,
  getHonestyScore,
};
