/* ==========================================================
   HireSense — Groq AI Report Generator
   ----------------------------------------------------------
   Receives pre-computed metrics (never raw question marks to
   invent) and asks Groq to write a coaching narrative:
   strengths, weaknesses, roadmap, topics, practice frequency,
   estimated readiness, motivational summary.
   ========================================================== */

const { askAI } = require("./ai");

async function generateAIAnalysis(metrics, difficulty) {
  const payload = {
    difficulty,
    score: metrics.score,
    correct: metrics.correct,
    incorrect: metrics.incorrect,
    skipped: metrics.skipped,
    total: metrics.total,
    accuracy: metrics.accuracy,
    grade: metrics.grade,
    percentileEstimate: metrics.percentile,
    avgTimePerQuestion: metrics.avgTimePerQuestion,
    fastestAnswer: metrics.fastestAnswer,
    slowestAnswer: metrics.slowestAnswer,
    completionRate: metrics.completionRate,
    topicPerformance: metrics.topicPerformance,
    difficultyPerformance: metrics.difficultyPerformance,
    weakTopics: metrics.weakTopics,
    strongTopics: metrics.strongTopics,
    timeTaken: metrics.timeTaken,
    integrityScore: metrics.integrityScore,
    violationCount: metrics.violationCount,
  };

  const messages = [
    {
      role: "system",
      content: [
        "You are a senior placement aptitude coach at HireSense.",
        "You receive an exact, pre-computed performance snapshot — DO NOT invent or recompute any marks, counts, or percentages.",
        "Return valid JSON only, with exactly these keys:",
        "- strengths: array of 2-4 strings (e.g. 'Excellent logical reasoning with strong quantitative aptitude')",
        "- weaknesses: array of 2-4 strings (e.g. 'Needs improvement in probability and seating arrangement questions')",
        "- learningRoadmap: array of 4-6 topic strings to study, prioritized by weakness",
        "- topicsToStudy: array of 2-4 specific topic names",
        "- recommendedPracticeFrequency: string (e.g. 'Practice 30 minutes daily, 5 days per week')",
        "- estimatedInterviewReadiness: integer 0-100 based ONLY on the given score, accuracy, and completionRate",
        "- motivationalSummary: 2-3 sentence encouraging summary referencing the user's strengths",
        "Keep every string concise and actionable.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(payload),
    },
  ];

  try {
    const analysis = await askAI(messages, { temperature: 0.4, max_tokens: 1600 });
    return {
      feedback: (analysis.strengths || []).join(" ") ||
        "Performance evaluated. See topic breakdown for detailed insights.",
      strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
      weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
      improvementPlan: [
        ...(Array.isArray(analysis.weaknesses) ? analysis.weaknesses : []),
        ...(Array.isArray(analysis.topicsToStudy) ? analysis.topicsToStudy : []),
      ],
      learningRoadmap: Array.isArray(analysis.learningRoadmap) ? analysis.learningRoadmap : [],
      topicsToStudy: Array.isArray(analysis.topicsToStudy) ? analysis.topicsToStudy : [],
      recommendedPracticeFrequency: analysis.recommendedPracticeFrequency || "",
      estimatedInterviewReadiness: Number.isFinite(analysis.estimatedInterviewReadiness)
        ? Math.max(0, Math.min(100, analysis.estimatedInterviewReadiness))
        : null,
      motivationalSummary: analysis.motivationalSummary || "",
    };
  } catch (e) {
    console.warn("AI analysis failed, using deterministic defaults:", e.message);
    return deterministicAnalysis(metrics);
  }
}

function deterministicAnalysis(metrics) {
  return {
    feedback:
      `You answered ${metrics.correct} of ${metrics.total} questions correctly (${metrics.score}%, ${metrics.grade}). ` +
      `Accuracy on attempted questions was ${metrics.accuracy}%.` +
      (metrics.weakTopics?.length ? ` Focus on ${metrics.weakTopics.slice(0, 3).join(", ")}.` : ""),
    strengths: metrics.strongTopics?.length ? metrics.strongTopics.slice(0, 4) : ["Consistent effort across topics"],
    weaknesses: metrics.weakTopics?.length ? metrics.weakTopics.slice(0, 4) : [],
    improvementPlan: (metrics.weakTopics?.slice(0, 4) || []).map((t) => `Revise ${t} fundamentals and practice graded questions.`),
    learningRoadmap: (metrics.weakTopics?.slice(0, 4) || []).map((t) => `Study ${t} — concepts, shortcuts, then timed drills.`),
    topicsToStudy: (metrics.weakTopics?.slice(0, 3) || []),
    recommendedPracticeFrequency: "Practice 30 minutes daily, 5 days per week.",
    estimatedInterviewReadiness: metrics.score,
    motivationalSummary:
      "Every attempt is a step forward. Your strengths are noted — keep sharpening your weak areas and your readiness will climb quickly.",
  };
}

module.exports = { generateAIAnalysis, deterministicAnalysis };
