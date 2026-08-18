const db = require("../config/database");
const { askAI } = require("../services/ai");
const { generateQuestionsForAssessment } = require("../services/questionGenerator");

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
      return res.json({ success: true, id: assessment.id, result: formatResult(assessment) });
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

    const questions = questionsResult.rows;
    const answers = answersResult.rows;

    // Score calculation
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;
    const topicScores = {};
    const difficultyScores = {};

    for (const q of questions) {
      const ans = answers.find((a) => a.question_id === q.id);
      if (!ans || ans.status === "unanswered" || ans.user_answer == null || ans.user_answer === "") {
        skippedCount++;
        continue;
      }

      const correct = Array.isArray(q.correct_answer)
        ? arraysEqual(JSON.parse(ans.user_answer || "[]"), q.correct_answer)
        : String(ans.user_answer) === String(q.correct_answer);

      if (correct) {
        correctCount++;
        // Update answer is_correct
        db.query("UPDATE aptitude_answers SET is_correct = true WHERE id = $1", [ans.id]).catch(() => {});
      } else {
        incorrectCount++;
        db.query("UPDATE aptitude_answers SET is_correct = false WHERE id = $1", [ans.id]).catch(() => {});
      }

      // Topic tracking
      const topic = q.topic || "general";
      if (!topicScores[topic]) topicScores[topic] = { correct: 0, total: 0 };
      topicScores[topic].total++;
      if (correct) topicScores[topic].correct++;

      // Difficulty tracking
      const diff = q.sub_difficulty || q.difficulty || "medium";
      if (!difficultyScores[diff]) difficultyScores[diff] = { correct: 0, total: 0 };
      difficultyScores[diff].total++;
      if (correct) difficultyScores[diff].correct++;
    }

    const totalQuestions = questions.length;
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const accuracy = (correctCount + incorrectCount) > 0
      ? Math.round((correctCount / (correctCount + incorrectCount)) * 100)
      : 0;

    const topicPerformance = {};
    for (const [t, s] of Object.entries(topicScores)) topicPerformance[t] = Math.round((s.correct / s.total) * 100);

    const difficultyPerformance = {};
    for (const [d, s] of Object.entries(difficultyScores)) difficultyPerformance[d] = Math.round((s.correct / s.total) * 100);

    const weakTopics = Object.entries(topicPerformance).filter(([, p]) => p < 50).map(([t]) => t);
    const strongTopics = Object.entries(topicPerformance).filter(([, p]) => p >= 80).map(([t]) => t);

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

    // AI Evaluation
    let feedback = "";
    let improvementPlan = [];
    let learningRoadmap = [];

    try {
      const evalMessages = [
        {
          role: "system",
          content: `You are a senior placement aptitude evaluator. Analyze performance and return JSON:
- feedback: 3-5 sentence constructive assessment
- improvementPlan: array of 4-5 actionable steps
- learningRoadmap: array of 4-5 resource suggestions`,
        },
        {
          role: "user",
          content: JSON.stringify({
            difficulty: assessment.difficulty,
            score,
            correctCount,
            incorrectCount,
            totalQuestions,
            topicPerformance,
            difficultyPerformance,
            timeTaken,
            malpractice: { violations: violationList.length, terminated },
          }),
        },
      ];

      const evaluation = await askAI(evalMessages, { temperature: 0.3, max_tokens: 2048 });
      feedback = evaluation.feedback || "";
      improvementPlan = evaluation.improvementPlan || [];
      learningRoadmap = evaluation.learningRoadmap || [];
    } catch (e) {
      console.warn("AI evaluation failed, using defaults:", e.message);
    }

    // Update assessment record
    await db.query(
      `UPDATE aptitude_assessments SET
        status = 'completed', score = $1, correct_count = $2, incorrect_count = $3,
        skipped_count = $4, accuracy = $5, time_taken = $6, warnings = $7,
        terminated = $8, risk_level = $9, remarks = $10, malpractice_summary = $11,
        violation_log = $12, topic_performance = $13, difficulty_performance = $14,
        weak_topics = $15, strong_topics = $16, feedback = $17,
        improvement_plan = $18, learning_roadmap = $19, completed_at = NOW(), updated_at = NOW()
      WHERE id = $20`,
      [
        id, score, correctCount, incorrectCount, skippedCount,
        Math.round(accuracy * 100) / 100, timeTaken, totalWarnings,
        terminated, riskLevel, remarks,
        JSON.stringify(malpracticeSummary), JSON.stringify(violationList),
        JSON.stringify(topicPerformance), JSON.stringify(difficultyPerformance),
        JSON.stringify(weakTopics), JSON.stringify(strongTopics),
        feedback, JSON.stringify(improvementPlan), JSON.stringify(learningRoadmap),
      ]
    );

    const result = {
      id: assessment.id,
      score, correct: correctCount, incorrect: incorrectCount,
      total: totalQuestions, accuracy: Math.round(accuracy * 100) / 100,
      difficulty: assessment.difficulty, timeTaken, warnings: totalWarnings,
      violations: violationList, terminated,
      topicPerformance, difficultyPerformance,
      weakTopics, strongTopics, feedback, improvementPlan, learningRoadmap,
      riskLevel, remarks, malpracticeSummary,
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

// ─── 10. History ───────────────────────────────────────────────────────────

async function getHistory(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const result = await db.query(
      `SELECT id, difficulty, score, total_questions, correct_count, accuracy,
              time_taken, warnings, terminated, completed_at, created_at, status
       FROM aptitude_assessments
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    res.json({ success: true, history: result.rows });
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

    res.json({ success: true, result: formatResult(result.rows[0]) });
  } catch (error) {
    console.error("Get result error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch result." });
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
  return {
    id: r.id,
    score: r.score,
    correct: r.correct_count,
    incorrect: r.incorrect_count,
    total: r.total_questions,
    accuracy: r.accuracy,
    difficulty: r.difficulty,
    timeTaken: r.time_taken,
    warnings: r.warnings || 0,
    violations: r.violations || [],
    terminated: r.terminated,
    topicPerformance: r.topic_performance || {},
    difficultyPerformance: r.difficulty_performance || {},
    weakTopics: r.weak_topics || [],
    strongTopics: r.strong_topics || [],
    feedback: r.feedback || "",
    improvementPlan: r.improvement_plan || [],
    learningRoadmap: r.learning_roadmap || [],
    riskLevel: r.risk_level || "none",
    remarks: r.remarks || "",
    malpracticeSummary: r.malpractice_summary || {},
    completedAt: r.completed_at,
    status: r.status,
  };
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
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
  getHistory,
  getResult,
  getRemarks,
  getRemarkDetail,
};
