/* ==========================================================
   HireSense — English Hybrid Evaluation Service
   Deterministic MCQ + NLP heuristics + single LLM per open-ended
   ========================================================== */

const { analyzeText } = require("./nlpService");
const { askAI } = require("./ai");
const { OPEN_ENDED_WEIGHTS, THRESHOLDS, INPUT_LIMITS } = require("./englishScoringConfig");

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* ── TF-IDF style overlap for semantic relevance (deterministic, 0 tokens) ── */
function relevanceScore(question, answer, rubric) {
  if (!answer || answer.trim().length < 10) return 0;
  const qTokens = new Set(question.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const aTokens = answer.toLowerCase().split(/\W+/).filter(Boolean);
  if (qTokens.size === 0) return 0.5;
  let overlap = 0;
  for (const t of qTokens) if (aTokens.includes(t)) overlap++;
  let score = overlap / qTokens.size;
  // Boost if rubric keywords present
  if (rubric && Array.isArray(rubric)) {
    const rubricTokens = rubric.join(" ").toLowerCase().split(/\W+/);
    let rbOverlap = 0;
    for (const t of rubricTokens) if (t.length > 3 && aTokens.includes(t)) rbOverlap++;
    score = Math.max(score, rbOverlap / Math.max(rubricTokens.length, 1) * 0.8 + score * 0.2);
  }
  return clamp(score, 0, 1);
}

function coherenceHeuristic(answer) {
  const sentences = answer.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length <= 1) return 0.4;
  if (sentences.length >= 3 && sentences.length <= 6) return 0.85;
  if (sentences.length > 8) return 0.6;
  return 0.65;
}

function completenessHeuristic(question, answer) {
  const len = answer.trim().length;
  if (len < 20) return 0.2;
  if (len < 60) return 0.5;
  if (len < 150) return 0.75;
  if (len < 400) return 0.9;
  if (len > 1200) return 0.6; // penalize verbosity
  return 0.85;
}

function professionalismHeuristic(answer) {
  const lower = answer.toLowerCase();
  const unprofessional = ["gonna", "wanna", "lol", "wtf", "dude", "hey guys", "idk"];
  const professionalMarkers = ["please", "regards", "sincerely", "apologize", "appreciate", "ensure", "collaborate"];
  let score = 0.65;
  for (const w of unprofessional) if (lower.includes(w)) score -= 0.15;
  for (const w of professionalMarkers) if (lower.includes(w)) score += 0.07;
  return clamp(score, 0, 1);
}

function concisenessHeuristic(answer) {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  if (words <= 12) return 0.55;
  if (words <= 80) return 0.9;
  if (words <= 140) return 0.8;
  if (words <= 220) return 0.65;
  return 0.45;
}

/* ── Single LLM evaluation per open-ended answer (compact) ── */
async function llmEvaluateOpenEnded({ question, answer, rubric }) {
  const rubricStr = rubric && rubric.length ? `Rubric: ${rubric.join("; ")}` : "";
  const messages = [
    {
      role: "system",
      content: "You are an English evaluator. Return JSON only: {relevance,grammar,vocabulary,coherence,completeness,professionalism,feedback} each 0-1, feedback one sentence. No markdown.",
    },
    {
      role: "user",
      content: `Q: ${question.slice(0, 400)}\n${rubricStr}\nAnswer: ${answer.slice(0, INPUT_LIMITS.maxAnswerLength)}\nReturn JSON.`,
    },
  ];
  try {
    const res = await askAI(messages, { temperature: 0.2, max_tokens: 400 });
    // askAI already parses JSON via parseLLMJSON; handle both object and string
    const obj = typeof res === "string" ? JSON.parse(res) : res;
    return {
      relevance: clamp(Number(obj.relevance ?? 0.5), 0, 1),
      grammar: clamp(Number(obj.grammar ?? 0.5), 0, 1),
      vocabulary: clamp(Number(obj.vocabulary ?? 0.5), 0, 1),
      coherence: clamp(Number(obj.coherence ?? 0.5), 0, 1),
      completeness: clamp(Number(obj.completeness ?? 0.5), 0, 1),
      professionalism: clamp(Number(obj.professionalism ?? 0.5), 0, 1),
      feedback: typeof obj.feedback === "string" ? obj.feedback.slice(0, 300) : "",
    };
  } catch {
    return null; // signal fallback to deterministic
  }
}

async function evaluateOpenEnded({ question, answer, rubric, difficulty, forceDeterministic = false }) {
  const trimmed = (answer || "").trim();
  if (trimmed.length === 0) {
    return { score: 0, breakdown: { relevance: 0, grammar: 0, vocabulary: 0, coherence: 0, completeness: 0, professionalism: 0, conciseness: 0 }, feedback: "No response provided.", usedLLM: false };
  }
  if (trimmed.length < 10) {
    return { score: 15, breakdown: { relevance: 0, grammar: 0.3, vocabulary: 0.3, coherence: 0.2, completeness: 0.1, professionalism: 0.4, conciseness: 0.8 }, feedback: "Response is too short to demonstrate the requested communication skill.", usedLLM: false };
  }
  if (trimmed.length > INPUT_LIMITS.maxAnswerLength) {
    // Hard cap — truncated already in prompt, but score penalized
  }

  // Deterministic pre-checks
  const nlp = analyzeText(trimmed);
  const relDet = relevanceScore(question, trimmed, rubric);
  const grammarDet = clamp(nlp.readabilityScore ? nlp.readabilityScore / 100 : 0.5, 0, 1) * 0.5 + clamp(1 - nlp.fillerWordCount / 20, 0, 1) * 0.5;
  const vocabDet = clamp(nlp.vocabularyRichness || 0.5, 0, 1);
  const cohDet = coherenceHeuristic(trimmed);
  const compDet = completenessHeuristic(question, trimmed);
  const profDet = professionalismHeuristic(trimmed);

  // Decide if LLM is warranted
  const shouldCallLLM = !forceDeterministic && trimmed.length >= THRESHOLDS.minAnswerLengthForLLM && relDet >= THRESHOLDS.minRelevanceForLLM;

  let llm = null;
  if (shouldCallLLM) {
    llm = await llmEvaluateOpenEnded({ question, answer: trimmed, rubric });
  }

  // Merge: prefer LLM where available, else deterministic
  const breakdown = {
    relevance: llm?.relevance ?? relDet,
    grammar: llm?.grammar ?? grammarDet,
    vocabulary: llm?.vocabulary ?? vocabDet,
    coherence: llm?.coherence ?? cohDet,
    completeness: llm?.completeness ?? compDet,
    professionalism: llm?.professionalism ?? profDet,
    conciseness: concisenessHeuristic(trimmed),
  };

  let weighted = 0;
  for (const [k, w] of Object.entries(OPEN_ENDED_WEIGHTS)) weighted += (breakdown[k] || 0) * w;

  // Conciseness penalty for very long rambling
  if (trimmed.length > 1200) weighted *= 0.9;

  const score = Math.round(clamp(weighted, 0, 1) * 100);
  const feedback = llm?.feedback || (score >= 70 ? "Clear and well-structured response." : score >= 40 ? "Adequate response with room for clarity and grammar improvement." : "Response needs significant improvement in relevance and structure.");

  return { score, breakdown, feedback, usedLLM: !!llm, nlp: { vocabularyRichness: nlp.vocabularyRichness, readabilityScore: nlp.readabilityScore, sentenceQuality: nlp.sentenceQuality, transitionUsage: nlp.transitionUsage, wordCount: nlp.wordCount, sentenceCount: nlp.sentenceCount, fillerWordCount: nlp.fillerWordCount } };
}

async function evaluateEnglishAssessment({ questions, answers, difficulty }) {
  let totalScore = 0;
  let maxScore = 0;
  const categoryScores = {};
  const categoryCounts = {};
  let llmCalls = 0;

  const details = [];
  let objectiveTotal = 0;
  let objectiveCount = 0;
  let communicationTotal = 0;
  let communicationCount = 0;
  const dimensionTotals = {};
  const dimensionCounts = {};

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ans = answers[i];
    const topic = q.topic || "grammar";
    if (!categoryScores[topic]) { categoryScores[topic] = 0; categoryCounts[topic] = 0; }

    let qScore = 0;
    let qMax = 100;
    let breakdown = null;
    let feedback = "";

    if (q.type === "descriptive" || q.type === "situational" || q.type === "professional") {
      // Open-ended
      if (llmCalls < THRESHOLDS.maxLLMCallsPerAssessment) {
        const rubric = Array.isArray(q.rubric)
          ? q.rubric
          : q.learning_objective
            ? [q.learning_objective]
            : [];
        llmCalls++;
        const res = await evaluateOpenEnded({ question: q.question, answer: ans || "", rubric, difficulty });
        qScore = res.score;
        breakdown = res.breakdown;
        feedback = res.feedback;
      } else {
        // Cap reached — deterministic only
        const res = await evaluateOpenEnded({ question: q.question, answer: ans || "", rubric: [], difficulty, forceDeterministic: true });
        qScore = res.score;
        breakdown = res.breakdown;
        feedback = res.feedback;
      }
    } else {
      // Deterministic MCQ/comprehension
      const userAns = ans;
      const correct = q.correct_answer;
      // correct_answer stored as JSON stringified index or string
      let isCorrect = false;
      try {
        const parsedCorrect = typeof correct === "string" ? JSON.parse(correct) : correct;
        if (Array.isArray(parsedCorrect)) isCorrect = JSON.stringify(userAns) === JSON.stringify(parsedCorrect);
        else isCorrect = String(userAns).trim().toLowerCase() === String(parsedCorrect).trim().toLowerCase();
        // Also handle options index vs text: q.options, correct is index number
        if (typeof parsedCorrect === "number" && typeof userAns === "number") isCorrect = parsedCorrect === userAns;
        if (typeof parsedCorrect === "number" && typeof userAns === "string") {
          // userAns may be option text, parsedCorrect is index
          const idx = parseInt(userAns, 10);
          if (!isNaN(idx)) isCorrect = idx === parsedCorrect;
          else {
            const opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options || "[]");
            isCorrect = opts[parsedCorrect] && String(userAns).trim().toLowerCase() === String(opts[parsedCorrect]).trim().toLowerCase();
          }
        }
      } catch { isCorrect = String(userAns).trim().toLowerCase() === String(correct).trim().toLowerCase(); }
      qScore = isCorrect ? 100 : 0;
      breakdown = { correct: isCorrect };
      feedback = isCorrect ? "Correct." : q.explanation || "Incorrect.";
    }

    if (["descriptive", "situational", "professional"].includes(q.type)) {
      communicationTotal += qScore;
      communicationCount++;
      for (const [key, value] of Object.entries(breakdown || {})) {
        if (typeof value !== "number") continue;
        dimensionTotals[key] = (dimensionTotals[key] || 0) + value;
        dimensionCounts[key] = (dimensionCounts[key] || 0) + 1;
      }
    } else {
      objectiveTotal += qScore;
      objectiveCount++;
    }

    categoryScores[topic] += qScore;
    categoryCounts[topic] += 1;
    totalScore += qScore;
    maxScore += qMax;
    details.push({ questionId: q.id || q.question_number, questionNumber: q.question_number, topic, type: q.type, score: qScore, maxScore: qMax, breakdown, feedback });
  }

  const categoryPct = {};
  for (const k of Object.keys(categoryScores)) categoryPct[k] = Math.round(categoryScores[k] / categoryCounts[k]);

  const englishProficiency = objectiveCount ? Math.round(objectiveTotal / objectiveCount) : null;
  const communication = communicationCount ? Math.round(communicationTotal / communicationCount) : null;
  const overall = englishProficiency != null && communication != null
    ? Math.round(englishProficiency * 0.4 + communication * 0.6)
    : englishProficiency ?? communication ?? 0;
  const dimensionScores = {};
  for (const key of Object.keys(dimensionTotals)) dimensionScores[key] = Math.round((dimensionTotals[key] / dimensionCounts[key]) * 100);

  return {
    overall,
    categoryPct,
    categoryScores: { englishProficiency, communication },
    dimensionScores,
    details,
    llmCalls,
  };
}

module.exports = { evaluateOpenEnded, evaluateEnglishAssessment, relevanceScore };
