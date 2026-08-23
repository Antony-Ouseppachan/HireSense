/* ==========================================================
   HireSense — Reusable Assessment Evaluation Engine
   ----------------------------------------------------------
   Pure, deterministic scoring pipeline. Computes every metric
   server-side from question + answer data. The AI layer never
   invents marks; it only interprets the numbers produced here.
   ========================================================== */

const GRADE_BANDS = [
  { grade: "A+", min: 90 },
  { grade: "A", min: 80 },
  { grade: "B+", min: 70 },
  { grade: "B", min: 60 },
  { grade: "C", min: 50 },
  { grade: "Needs Improvement", min: 0 },
];

/* Approximate percentile mapping (normal-curve feel, no live cohort).
   Score 90+  → ~95th, 80 → ~85th, etc. Always labelled an estimate. */
function estimatePercentile(score) {
  if (score >= 95) return 99;
  if (score >= 90) return 95;
  if (score >= 85) return 90;
  if (score >= 80) return 85;
  if (score >= 75) return 78;
  if (score >= 70) return 70;
  if (score >= 65) return 62;
  if (score >= 60) return 55;
  if (score >= 55) return 47;
  if (score >= 50) return 40;
  if (score >= 45) return 32;
  if (score >= 40) return 25;
  if (score >= 30) return 15;
  if (score >= 20) return 8;
  return 3;
}

function getGrade(score) {
  const band = GRADE_BANDS.find((b) => score >= b.min) || GRADE_BANDS[GRADE_BANDS.length - 1];
  return band.grade;
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

/* Normalize an answer value for comparison (multi-select is stored
   as JSON array strings). */
function parseAnswer(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  const s = String(raw).trim();
  if (s === "") return null;
  try {
    const p = JSON.parse(s);
    if (Array.isArray(p)) return p;
    return p;
  } catch {
    return s;
  }
}

function isAnswerEmpty(answer) {
  return answer == null || answer === "" || (Array.isArray(answer) && answer.length === 0);
}

function isCorrect(question, userAnswer) {
  if (isAnswerEmpty(userAnswer)) return false;
  const correct = question.correct_answer;
  if (Array.isArray(correct)) {
    const ua = Array.isArray(userAnswer) ? userAnswer : parseAnswer(userAnswer);
    return arraysEqual(ua, correct);
  }
  return String(userAnswer) === String(correct);
}

/* ─── Core evaluation ───────────────────────────────────────────────────
   Inputs:
     questions  [{ id, question_number, type, topic, sub_difficulty,
                   difficulty, marks, expected_time, correct_answer }]
     answers    [{ question_id, question_number, user_answer, time_spent,
                   status, is_correct }]
     options    { difficulty, timeLimit, remainingTime, violations }
   Output: full metrics object (persisted as evaluation_json). */
function evaluate({ questions, answers, difficulty, timeLimit, remainingTime, violations }) {
  const answerByQuestion = {};
  for (const a of answers || []) answerByQuestion[a.question_id] = a;

  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;
  let marksGained = 0;
  let marksLost = 0;

  const topicScores = {};
  const difficultyScores = {};
  const questionAnalysis = [];
  const timeStats = [];
  let flaggedForReview = 0;

  for (const q of questions) {
    const ans = answerByQuestion[q.id];
    const userAnswer = ans ? parseAnswer(ans.user_answer) : null;
    const status = !ans || ans.status === "unanswered" || ans.status === "skipped" || isAnswerEmpty(userAnswer)
      ? "skipped"
      : isCorrect(q, userAnswer)
        ? "correct"
        : "incorrect";

    const marks = q.marks || 1;
    if (status === "correct") {
      correctCount++;
      marksGained += marks;
    } else if (status === "incorrect") {
      incorrectCount++;
      marksLost += marks;
    } else {
      skippedCount++;
    }

    const topic = q.topic || "General";
    if (!topicScores[topic]) topicScores[topic] = { correct: 0, total: 0, marks: 0 };
    topicScores[topic].total++;
    topicScores[topic].marks += marks;
    if (status === "correct") topicScores[topic].correct++;

    const diff = q.sub_difficulty || q.difficulty || "medium";
    if (!difficultyScores[diff]) difficultyScores[diff] = { correct: 0, total: 0 };
    difficultyScores[diff].total++;
    if (status === "correct") difficultyScores[diff].correct++;

    if (ans?.time_spent != null) timeStats.push({ questionNumber: q.question_number, timeSpent: ans.time_spent, status });

    questionAnalysis.push({
      questionId: q.id,
      questionNumber: q.question_number,
      topic,
      difficulty: diff,
      type: q.type,
      marks,
      userAnswer,
      correctAnswer: q.correct_answer,
      isCorrect: status === "correct",
      status,
      timeSpent: ans?.time_spent || 0,
      expectedTime: q.expected_time || 0,
    });
  }

  const totalQuestions = questions.length || 0;
  const answeredQuestions = correctCount + incorrectCount;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const accuracy = answeredQuestions > 0 ? Math.round((correctCount / answeredQuestions) * 100) : 0;

  const topicPerformance = {};
  for (const [t, s] of Object.entries(topicScores)) {
    topicPerformance[t] = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
  }

  const difficultyPerformance = {};
  for (const [d, s] of Object.entries(difficultyScores)) {
    difficultyPerformance[d] = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
  }

  // Difficulty-level score (marks per difficulty)
  const difficultyScore = {};
  for (const [d, s] of Object.entries(difficultyScores)) {
    difficultyScore[d] = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
  }

  const weakTopics = Object.entries(topicPerformance).filter(([, p]) => p < 50).map(([t]) => t);
  const strongTopics = Object.entries(topicPerformance).filter(([, p]) => p >= 80).map(([t]) => t);

  // Time analysis — only genuine recorded times count (0 / unrecorded are
  // excluded so they cannot skew fastest / average into nonsense values).
  const answeredTimeStats = timeStats.filter((t) => t.status !== "skipped" && (t.timeSpent || 0) > 0);
  const totalTimeSpent = timeStats.reduce((s, t) => s + (t.timeSpent || 0), 0);
  const avgTimePerQuestion = answeredTimeStats.length > 0
    ? Math.round(answeredTimeStats.reduce((s, t) => s + (t.timeSpent || 0), 0) / answeredTimeStats.length)
    : 0;
  const fastestAnswer = answeredTimeStats.length > 0
    ? Math.min(...answeredTimeStats.map((t) => t.timeSpent))
    : 0;
  const slowestAnswer = answeredTimeStats.length > 0
    ? Math.max(...answeredTimeStats.map((t) => t.timeSpent))
    : 0;

  const timeTaken = timeLimit && remainingTime != null
    ? Math.max(0, timeLimit - remainingTime)
    : totalTimeSpent;

  // Attempt quality
  const completionRate = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  // Time management = how well the candidate stayed within the allotted time.
  // 100 when finishing on or ahead of schedule, scaling down to 0 as the
  // overrun reaches the full time limit (i.e. 2x the limit).
  const timeManagement = timeLimit && timeLimit > 0
    ? Math.max(0, Math.min(100, Math.round((1 - Math.max(0, (timeTaken - timeLimit) / timeLimit)) * 100)))
    : null;
  const expectedAvgTime = questions.length
    ? Math.round(questions.reduce((s, q) => s + (q.expected_time || 45), 0) / questions.length)
    : 45;
  // Efficiency compares the candidate's pace against the expected pace.
  // A percentage, so it is capped at 100 — being faster than expected is 100,
  // never 150.
  const thinkingEfficiency = answeredTimeStats.length > 0 && expectedAvgTime > 0
    ? Math.round(Math.min(100, (expectedAvgTime / Math.max(avgTimePerQuestion, 1)) * 100))
    : 100;
  const flagRatio = totalQuestions > 0 ? Math.round((flaggedForReview / totalQuestions) * 100) : 0;
  const riskScore = Math.min(100, Math.round(
    (totalQuestions > 0 ? (skippedCount / totalQuestions) * 100 * 0.4 : 0) +
    (avgTimePerQuestion > 0 ? Math.max(0, (avgTimePerQuestion - expectedAvgTime) / expectedAvgTime) * 100 * 0.4 : 0) +
    flagRatio * 0.2
  ));

  // Integrity score — derived purely from logged malpractice events
  const violationCount = (violations || []).length;
  const severityPoints = { low: 5, medium: 10, high: 15, critical: 25 };
  let integrityPenalty = 0;
  for (const v of violations || []) integrityPenalty += severityPoints[v.severity] || 5;
  const integrityScore = Math.max(0, Math.min(100, 100 - integrityPenalty));

  // Performance category + grade
  const grade = getGrade(score);
  const percentileEstimate = estimatePercentile(score);

  // Next suggested test based on weakest topic family
  const nextSuggestedTest = inferNextSuggestedTest(weakTopics, strongTopics);

  return {
    // Core
    score,
    correct: correctCount,
    incorrect: incorrectCount,
    skipped: skippedCount,
    total: totalQuestions,
    accuracy,
    marksGained,
    marksLost,
    negativeMarkingApplied: false, // future-ready flag

    // Grade & rank
    grade,
    percentile: percentileEstimate,
    performanceCategory: score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Average" : "Needs Improvement",

    // Time
    timeTaken,
    avgTimePerQuestion,
    fastestAnswer,
    slowestAnswer,
    timeManagement,
    thinkingEfficiency,
    completionRate,
    riskScore,

    // Breakdowns
    topicPerformance,
    difficultyPerformance,
    difficultyScore,
    weakTopics,
    strongTopics,
    questionAnalysis,
    questionTimes: timeStats,

    // Integrity
    integrityScore,
    violationCount,

    nextSuggestedTest,
  };
}

function inferNextSuggestedTest(weakTopics, strongTopics) {
  const weak = (weakTopics || []).join(" ").toLowerCase();
  if (weak.includes("percent") || weak.includes("ratio") || weak.includes("time") || weak.includes("work") || weak.includes("speed")) {
    return "Quantitative Aptitude Drill";
  }
  if (weak.includes("reason") || weak.includes("logic") || weak.includes("seating") || weak.includes("series")) {
    return "Logical Reasoning Practice";
  }
  if (weak.includes("verbal") || weak.includes("english") || weak.includes("grammar") || weak.includes("vocab")) {
    return "Verbal Ability Practice";
  }
  if (weak.includes("data") || weak.includes("chart") || weak.includes("graph")) {
    return "Data Interpretation Drill";
  }
  if (weak.length > 0) return "Mixed Topic Review";
  return strongTopics?.length >= 3 ? "Advance to Hard Difficulty" : "Full Mock Aptitude Test";
}

module.exports = { evaluate, estimatePercentile, getGrade, arraysEqual, 
parseAnswer, isAnswerEmpty, isCorrect };
