const db = require("../config/database");
const { askAI } = require("../services/ai");
const { generateQuestionsForAssessment } = require("../services/questionGenerator");
const { isCorrect: isAnswerCorrect, parseAnswer, isAnswerEmpty } = require("../services/evaluationEngine");
const { evaluateEnglishAssessment } = require("../services/englishEvaluationService");

// ─── Helpers ───────────────────────────────────────────────────────────────

const ASSESSMENT_TYPES = new Set(["aptitude", "general_knowledge", "english_communication"]);

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

    const { profile, difficulty, type } = req.body;
    const assessmentType = ASSESSMENT_TYPES.has(type) ? type : "aptitude";
    const totalQuestions = QUESTION_COUNTS[difficulty] || 25;

    // Create assessment record
    const assessResult = await db.query(
      `INSERT INTO aptitude_assessments
         (user_id, difficulty, total_questions, status, assessment_type, questions_generated, created_at, updated_at)
       VALUES ($1, $2, $3, 'generating', $4, 0, NOW(), NOW())
       RETURNING id`,
      [userId, difficulty, totalQuestions, assessmentType]
    );
    const assessmentId = assessResult.rows[0].id;

    // Start background generation (non-blocking)
    generateQuestionsForAssessment(assessmentId, profile, difficulty, totalQuestions, assessmentType);

    res.status(201).json({ success: true, assessmentId, type: assessmentType });
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
        type: assessment.assessment_type || "aptitude",
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
      `SELECT status, total_questions, difficulty, assessment_type FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
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
      type: assessResult.rows[0].assessment_type || "aptitude",
      difficulty: assessResult.rows[0].difficulty,
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

    // Input limits — protect AI credits and DB
    if (answer && String(answer).length > 2000) {
      return res.status(400).json({ success: false, message: "Answer exceeds 2000 character limit." });
    }
    if (answer && Buffer.byteLength(String(answer), "utf8") > 100 * 1024) {
      return res.status(413).json({ success: false, message: "Payload too large." });
    }

    const assessResult = await db.query(
      `SELECT status FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (assessResult.rows.length === 0) return res.status(404).json({ message: "Assessment not found." });
    if (assessResult.rows[0].status !== "in_progress") {
      return res.status(400).json({ message: "Assessment is not in progress." });
    }

    const questionResult = await db.query(
      `SELECT id FROM aptitude_questions WHERE id = $1 AND assessment_id = $2`,
      [questionId, id]
    );
    if (questionResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Question does not belong to this assessment." });
    }
    if (status && !["unanswered", "answered", "skipped", "reviewed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid answer status." });
    }
    if (timeSpent != null && (!Number.isFinite(Number(timeSpent)) || Number(timeSpent) < 0)) {
      return res.status(400).json({ success: false, message: "Invalid time spent value." });
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

    const assessResult = await db.query(
      `SELECT status FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (assessResult.rows.length === 0) return res.status(404).json({ message: "Assessment not found." });
    if (assessResult.rows[0].status !== "in_progress") {
      return res.status(400).json({ message: "Assessment is not in progress." });
    }
    const questionNumberValue = Number(questionNumber || 0);
    if (!Number.isInteger(questionNumberValue) || questionNumberValue < 0) {
      return res.status(400).json({ success: false, message: "Invalid question number." });
    }
    const allowedSeverities = ["low", "medium", "high", "critical"];
    if (severity && !allowedSeverities.includes(severity)) {
      return res.status(400).json({ success: false, message: "Invalid violation severity." });
    }

    await db.query(
      `INSERT INTO aptitude_malpractice_logs (assessment_id, question_number, type, severity, detail, browser_info, "timestamp")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, questionNumberValue, type || "unknown", severity || "low", detail || null, browserInfo ? JSON.stringify(browserInfo) : null]
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

    let claimedForEvaluation = false;
    let assessResult = await db.query(
      `UPDATE aptitude_assessments
       SET status = 'evaluating', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'in_progress'
       RETURNING *`,
      [id, userId]
    );
    claimedForEvaluation = assessResult.rows.length > 0;
    if (assessResult.rows.length === 0) {
      assessResult = await db.query(
        `SELECT * FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
    }
    if (assessResult.rows.length === 0) return res.status(404).json({ message: "Assessment not found." });
    const assessment = assessResult.rows[0];
    if (assessment.status === "completed") {
      // Already submitted — return existing result
      return res.json({ success: true, id: assessment.id, result: formatResult(assessment) });
    }

    if (assessment.status !== "in_progress" && !claimedForEvaluation) {
      if (assessment.status === "evaluating") {
        return res.status(409).json({ success: false, message: "Assessment submission is already being processed." });
      }
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

    // Score calculation — branched for English hybrid
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;
    let score = 0;
    let accuracy = 0;
    let topicPerformance = {};
    let difficultyPerformance = {};
    let weakTopics = [];
    let strongTopics = [];

    const totalQuestions = questions.length;
    const isEnglish = assessment.assessment_type === "english_communication";
    let hybridEvaluation = null;
    let evaluationJson = null;

    if (isEnglish) {
      // Build ordered answer array aligned to questions
      const orderedAnswers = questions.map((q) => {
        const ans = answers.find((a) => a.question_id === q.id);
        if (!ans || ans.status === "unanswered" || ans.user_answer == null || ans.user_answer === "") return "";
        return ans.user_answer;
      });
      // Map DB rows to evaluation format (options parsed, rubric)
      const evalQuestions = questions.map((q) => ({
        id: q.id,
        question_number: q.question_number,
        question: q.question_text,
        type: q.type,
        options: q.options,
        correct_answer: q.correct_answer,
        topic: q.topic,
        difficulty: q.difficulty,
        sub_difficulty: q.sub_difficulty,
        passage: q.passage,
        rubric: q.rubric ? (typeof q.rubric === "string" ? JSON.parse(q.rubric) : q.rubric) : null,
        explanation: q.explanation,
      }));
      const hybrid = await evaluateEnglishAssessment({ questions: evalQuestions, answers: orderedAnswers, difficulty: assessment.difficulty });
      hybridEvaluation = hybrid;
      evaluationJson = {
        version: 1,
        evaluator: "english-hybrid",
        categoryScores: hybrid.categoryScores || {},
        dimensionScores: hybrid.dimensionScores || {},
        details: hybrid.details || [],
        llmCalls: hybrid.llmCalls || 0,
      };
      score = hybrid.overall;
      topicPerformance = hybrid.categoryPct || {};
      // Derive difficulty performance from topic if not provided
      difficultyPerformance = { [assessment.difficulty]: score };
      weakTopics = Object.entries(topicPerformance).filter(([, p]) => p < 50).map(([t]) => t);
      strongTopics = Object.entries(topicPerformance).filter(([, p]) => p >= 80).map(([t]) => t);
      // Derive correct/incorrect/skipped for storage
      for (let i = 0; i < evalQuestions.length; i++) {
        const ans = orderedAnswers[i];
        if (!ans || ans === "") { skippedCount++; continue; }
        const d = hybrid.details[i];
        const isCorrect = d && d.score >= 60;
        if (isCorrect) correctCount++; else incorrectCount++;
        const qAns = answers.find((a) => a.question_id === evalQuestions[i].id);
        if (qAns) db.query("UPDATE aptitude_answers SET is_correct = $1 WHERE id = $2", [isCorrect, qAns.id]).catch(() => {});
      }
      accuracy = (correctCount + incorrectCount) > 0 ? Math.round((correctCount / (correctCount + incorrectCount)) * 100) : 0;
    } else {
      const topicScores = {};
      const difficultyScores = {};
      for (const q of questions) {
        const ans = answers.find((a) => a.question_id === q.id);
        if (!ans || ans.status === "unanswered" || ans.user_answer == null || ans.user_answer === "") {
          skippedCount++;
          continue;
        }
        let correct = false;
        try {
          const parsedCorrect = typeof q.correct_answer === "string" ? JSON.parse(q.correct_answer) : q.correct_answer;
          if (Array.isArray(parsedCorrect)) correct = JSON.stringify(JSON.parse(ans.user_answer || "[]")) === JSON.stringify(parsedCorrect);
          else correct = String(ans.user_answer) === String(parsedCorrect);
        } catch { correct = String(ans.user_answer) === String(q.correct_answer); }
        if (correct) {
          correctCount++;
          db.query("UPDATE aptitude_answers SET is_correct = true WHERE id = $1", [ans.id]).catch(() => {});
        } else {
          incorrectCount++;
          db.query("UPDATE aptitude_answers SET is_correct = false WHERE id = $1", [ans.id]).catch(() => {});
        }
        const topic = q.topic || "general";
        if (!topicScores[topic]) topicScores[topic] = { correct: 0, total: 0 };
        topicScores[topic].total++;
        if (correct) topicScores[topic].correct++;
        const diff = q.sub_difficulty || q.difficulty || "medium";
        if (!difficultyScores[diff]) difficultyScores[diff] = { correct: 0, total: 0 };
        difficultyScores[diff].total++;
        if (correct) difficultyScores[diff].correct++;
      }
      score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
      accuracy = (correctCount + incorrectCount) > 0 ? Math.round((correctCount / (correctCount + incorrectCount)) * 100) : 0;
      for (const [t, s] of Object.entries(topicScores)) topicPerformance[t] = Math.round((s.correct / s.total) * 100);
      for (const [d, s] of Object.entries(difficultyScores)) difficultyPerformance[d] = Math.round((s.correct / s.total) * 100);
      weakTopics = Object.entries(topicPerformance).filter(([, p]) => p < 50).map(([t]) => t);
      strongTopics = Object.entries(topicPerformance).filter(([, p]) => p >= 80).map(([t]) => t);
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

    // AI Evaluation
    let feedback = "";
    let improvementPlan = [];
    let learningRoadmap = [];

    if (isEnglish && hybridEvaluation) {
      const dimensions = hybridEvaluation.dimensionScores || {};
      const weakDimensions = Object.entries(dimensions).filter(([, value]) => value < 70).map(([key]) => key);
      const proficiency = hybridEvaluation.categoryScores?.englishProficiency ?? score;
      const communication = hybridEvaluation.categoryScores?.communication ?? score;
      feedback = `English proficiency scored ${proficiency}% and communication scored ${communication}%.`;
      if (weakDimensions.length > 0) feedback += ` Focus next on ${weakDimensions.join(", ")} for measurable improvement.`;
      improvementPlan = weakDimensions.slice(0, 4).map((key) => `Practice ${key} using short, timed workplace responses.`);
      learningRoadmap = weakDimensions.slice(0, 4).map((key) => `Review ${key} examples, then apply the skill in a professional message.`);
    } else try {
      const isGk = assessment.assessment_type === "general_knowledge";
      const isEnglish = assessment.assessment_type === "english_communication";
      const evalMessages = [
        {
          role: "system",
          content: isGk
            ? `You are a general knowledge assessment evaluator. Analyze performance and return JSON:
- feedback: 3-5 sentence constructive assessment
- improvementPlan: array of 4-5 actionable study steps
- learningRoadmap: array of 4-5 resource suggestions`
            : isEnglish
            ? `You are an English & Communication assessment evaluator. Analyze performance and return JSON:
- feedback: 3-5 sentence constructive assessment focusing on grammar, vocabulary, coherence and professionalism
- improvementPlan: array of 4-5 actionable English improvement steps
- learningRoadmap: array of 4-5 resource suggestions`
            : `You are a senior placement aptitude evaluator. Analyze performance and return JSON:
- feedback: 3-5 sentence constructive assessment
- improvementPlan: array of 4-5 actionable steps
- learningRoadmap: array of 4-5 resource suggestions`,
        },
        {
          role: "user",
          content: JSON.stringify({
            assessmentType: isGk ? "general-knowledge" : isEnglish ? "english-communication" : "aptitude",
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
        improvement_plan = $18, learning_roadmap = $19, evaluation_json = $20,
        completed_at = NOW(), updated_at = NOW()
      WHERE id = $21`,
      [
        score, correctCount, incorrectCount, skippedCount,
        Math.round(accuracy * 100) / 100, timeTaken, totalWarnings,
        terminated, riskLevel, remarks,
        JSON.stringify(malpracticeSummary), JSON.stringify(violationList),
        JSON.stringify(topicPerformance), JSON.stringify(difficultyPerformance),
        JSON.stringify(weakTopics), JSON.stringify(strongTopics),
        feedback, JSON.stringify(improvementPlan), JSON.stringify(learningRoadmap),
        evaluationJson, id,
      ]
    );

    const result = {
      id: assessment.id, type: assessment.assessment_type || "aptitude",
      score, correct: correctCount, incorrect: incorrectCount,
      total: totalQuestions, accuracy: Math.round(accuracy * 100) / 100,
      difficulty: assessment.difficulty, timeTaken, warnings: totalWarnings,
      violations: violationList, terminated,
      topicPerformance, difficultyPerformance,
      weakTopics, strongTopics, feedback, improvementPlan, learningRoadmap,
      categoryScores: hybridEvaluation?.categoryScores || {},
      dimensionScores: hybridEvaluation?.dimensionScores || {},
      details: hybridEvaluation?.details || [],
      evaluation: evaluationJson,
      riskLevel, remarks, malpracticeSummary,
    };

    res.json({ success: true, id: assessment.id, result });
  } catch (error) {
    if (req.params?.id) {
      await db.query(
        `UPDATE aptitude_assessments SET status = 'in_progress', updated_at = NOW() WHERE id = $1 AND status = 'evaluating'`,
        [req.params.id]
      ).catch(() => {});
    }
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

// ─── 10. Reattempt (clone stored questions — no LLM) ──────────────────────

async function reattempt(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;

    const srcResult = await db.query(
      `SELECT id, difficulty, assessment_type FROM aptitude_assessments
       WHERE id = $1 AND user_id = $2 AND status = 'completed'`,
      [id, userId]
    );
    const src = srcResult.rows[0];
    if (!src) return res.status(404).json({ message: "Completed assessment not found." });

    const srcQuestions = await db.query(
      `SELECT question_number, type, question_text, options, correct_answer, topic,
              difficulty, sub_difficulty, marks, expected_time,
              solution, explanation, learning_objective, common_mistake, passage, rubric, batch_number
       FROM aptitude_questions WHERE assessment_id = $1 ORDER BY question_number`,
      [id]
    );
    if (srcQuestions.rows.length === 0) {
      return res.status(400).json({ success: false, message: "No questions stored for this assessment." });
    }

    const newAssessment = await db.query(
      `INSERT INTO aptitude_assessments
         (user_id, difficulty, status, total_questions, questions_generated, assessment_type, created_at, updated_at)
       VALUES ($1, $2, 'ready', $3, $3, $4, NOW(), NOW())
       RETURNING id`,
      [userId, src.difficulty, srcQuestions.rows.length, src.assessment_type || "aptitude"]
    );
    const newId = newAssessment.rows[0].id;

    const rows = srcQuestions.rows;
    const values = [];
    const params = [];
    rows.forEach((q, i) => {
      const b = i * 18;
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13},$${b + 14},$${b + 15},$${b + 16},$${b + 17},$${b + 18})`);
      params.push(
        newId, q.question_number, q.type || "mcq", q.question_text, JSON.stringify(q.options || []), q.correct_answer,
        q.topic, q.difficulty, q.sub_difficulty || q.difficulty, q.marks != null ? q.marks : 1, q.expected_time,
        q.solution, q.explanation, q.learning_objective, q.common_mistake, q.passage, JSON.stringify(q.rubric || null), q.batch_number || 0
      );
    });
    await db.query(
      `INSERT INTO aptitude_questions
         (assessment_id, question_number, type, question_text, options, correct_answer,
          topic, difficulty, sub_difficulty, marks, expected_time,
          solution, explanation, learning_objective, common_mistake, passage, rubric, batch_number)
       VALUES ${values.join(",")}`,
      params
    );

    res.status(201).json({ success: true, assessmentId: newId });
  } catch (error) {
    console.error("Reattempt error:", error.message);
    res.status(500).json({ success: false, message: "Failed to create reattempt." });
  }
}

// ─── 11. History ───────────────────────────────────────────────────────────

async function getHistory(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { type, limit } = req.query;
    const typeFilter = ASSESSMENT_TYPES.has(type) ? type : null;
    const limitValue = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const result = typeFilter
      ? await db.query(
          `SELECT id, assessment_type, difficulty, score, total_questions, correct_count, accuracy,
                  time_taken, warnings, terminated, completed_at, created_at, status
           FROM aptitude_assessments
           WHERE user_id = $1 AND assessment_type = $2
           ORDER BY created_at DESC LIMIT $3`,
          [userId, typeFilter, limitValue]
        )
      : await db.query(
          `SELECT id, assessment_type, difficulty, score, total_questions, correct_count, accuracy,
                  time_taken, warnings, terminated, completed_at, created_at, status
           FROM aptitude_assessments
           WHERE user_id = $1
           ORDER BY created_at DESC LIMIT $2`,
          [userId, limitValue]
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

    const { type } = req.query;
    const typeFilter = ASSESSMENT_TYPES.has(type) ? type : null;

    const result = typeFilter
      ? await db.query(
          `SELECT id, assessment_type, difficulty, score, accuracy, time_taken, warnings,
                  terminated, risk_level, remarks, malpractice_summary,
                  violation_log, completed_at, created_at
           FROM aptitude_assessments
           WHERE user_id = $1 AND assessment_type = $2 AND status = 'completed'
           ORDER BY created_at DESC LIMIT 20`,
          [userId, typeFilter]
        )
      : await db.query(
          `SELECT id, assessment_type, difficulty, score, accuracy, time_taken, warnings,
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

// ─── 13. Question Review ───────────────────────────────────────────

async function getReview(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;
    const assessResult = await db.query(
      `SELECT * FROM aptitude_assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (assessResult.rows.length === 0) return res.status(404).json({ success: false, message: "Assessment not found." });
    const assessment = assessResult.rows[0];
    const storedEvaluation = assessment.evaluation_json && typeof assessment.evaluation_json === "object"
      ? assessment.evaluation_json
      : {};

    const questionsResult = await db.query(
      `SELECT q.id, q.question_number, q.type, q.question_text, q.options, q.correct_answer,
              q.topic, q.sub_difficulty, q.difficulty, q.marks, q.expected_time,
              q.solution, q.explanation, q.passage,
              a.user_answer, a.time_spent, a.status AS answer_status, a.is_correct
       FROM aptitude_questions q
       LEFT JOIN aptitude_answers a ON a.question_id = q.id
       WHERE q.assessment_id = $1
       ORDER BY q.question_number`,
      [id]
    );

    const questions = questionsResult.rows.map((q) => {
      let correctAnswer = q.correct_answer;
      try { correctAnswer = JSON.parse(q.correct_answer); } catch { /* keep raw */ }

      let userAnswer = q.user_answer;
      try { userAnswer = userAnswer == null ? null : JSON.parse(userAnswer); } catch { /* keep raw */ }

      const answerStatus = q.answer_status || "unanswered";
      const empty = isAnswerEmpty(userAnswer) || answerStatus === "unanswered" || answerStatus === "skipped";
      const hybridDetail = (storedEvaluation.details || []).find((detail) =>
        detail.questionNumber === q.question_number || String(detail.questionId) === String(q.id)
      );
      const isEnglish = assessment.assessment_type === "english_communication";
      const correct = !empty && (isEnglish
        ? Number(hybridDetail?.score || 0) >= 60
        : isAnswerCorrect({ type: q.type, correct_answer: correctAnswer }, parseAnswer(userAnswer)));

      return {
        id: q.id,
        number: q.question_number,
        type: q.type,
        question: q.question_text,
        options: q.options,
        correctAnswer,
        topic: q.topic,
        difficulty: q.sub_difficulty || q.difficulty,
        marks: q.marks,
        expectedTime: q.expected_time,
        explanation: q.explanation || q.solution || "",
        solution: q.solution || "",
        passage: q.passage,
        userAnswer: empty ? null : userAnswer,
        status: empty ? "skipped" : correct ? "answered" : "answered",
        isCorrect: correct,
        score: hybridDetail?.score ?? (correct ? 100 : 0),
        breakdown: hybridDetail?.breakdown || null,
        evaluationFeedback: hybridDetail?.feedback || "",
        timeSpent: q.time_spent || 0,
      };
    });

    res.json({
      success: true,
      review: {
        id: assessment.id,
        type: assessment.assessment_type || "aptitude",
        score: assessment.score,
        correct: assessment.correct_count,
        incorrect: assessment.incorrect_count,
        skipped: assessment.skipped_count,
        total: assessment.total_questions,
        accuracy: assessment.accuracy,
        status: assessment.status,
        categoryScores: storedEvaluation.categoryScores || {},
        dimensionScores: storedEvaluation.dimensionScores || {},
        questions,
      },
    });
  } catch (error) {
    console.error("Get review error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch review." });
  }
}

// ─── Format Helper ─────────────────────────────────────────────────────────

function formatResult(r) {
  const evaluation = r.evaluation_json && typeof r.evaluation_json === "object" ? r.evaluation_json : {};
  return {
    id: r.id,
    type: r.assessment_type || "aptitude",
    score: r.score,
    correct: r.correct_count,
    incorrect: r.incorrect_count,
    total: r.total_questions,
    accuracy: r.accuracy,
    difficulty: r.difficulty,
    timeTaken: r.time_taken,
    warnings: r.warnings || 0,
    violations: r.violations || r.violation_log || [],
    terminated: r.terminated,
    topicPerformance: r.topic_performance || {},
    difficultyPerformance: r.difficulty_performance || {},
    categoryScores: evaluation.categoryScores || {},
    dimensionScores: evaluation.dimensionScores || {},
    details: evaluation.details || [],
    evaluation,
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
  reattempt,
  getHistory,
  getResult,
  getRemarks,
  getRemarkDetail,
  getReview,
};
