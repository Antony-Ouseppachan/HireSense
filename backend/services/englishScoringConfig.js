/* ==========================================================
   HireSense — English Scoring Configuration (Centralized)
   Single source of truth for weights, thresholds, limits.
   ========================================================== */

const DIFFICULTY_QUESTION_COUNTS = { easy: 20, medium: 25, hard: 30 };

const TIME_LIMITS = {
  english_communication: { easy: 1200, medium: 1800, hard: 2400 }, // 20/30/40 min
};

const INPUT_LIMITS = {
  maxAnswerLength: 2000,
  maxPayloadSize: 100 * 1024, // 100KB per submission
  maxQuestions: 30,
};

// Hybrid scoring weights — must sum to 1.0 per open-ended evaluation
const OPEN_ENDED_WEIGHTS = {
  relevance: 0.25,
  grammar: 0.20,
  vocabulary: 0.15,
  coherence: 0.15,
  completeness: 0.15,
  professionalism: 0.05,
  conciseness: 0.05,
};

// Deterministic thresholds
const THRESHOLDS = {
  minAnswerLengthForLLM: 30,
  minRelevanceForLLM: 0.15, // below this, skip LLM — clearly off-topic
  maxLLMCallsPerAssessment: 10, // cap to control credits (descriptive questions only)
  passingScore: 40,
};

// Category mapping for topicPerformance
const TOPIC_CATEGORIES = ["grammar", "vocabulary", "comprehension", "sentence", "situational", "professional"];

module.exports = {
  DIFFICULTY_QUESTION_COUNTS,
  TIME_LIMITS,
  INPUT_LIMITS,
  OPEN_ENDED_WEIGHTS,
  THRESHOLDS,
  TOPIC_CATEGORIES,
};
