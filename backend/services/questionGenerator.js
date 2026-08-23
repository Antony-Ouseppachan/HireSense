/**
 * questionGenerator.js
 * Production-grade self-healing question generation pipeline.
 *
 * Features:
 * - Auto-repairs missing/partial fields (explanation, topic, difficulty, time)
 * - Saves each question immediately (never loses progress)
 * - Resume support — restarts from where it left off after a crash
 * - Per-question retry (never regenerates already-saved questions)
 * - Consecutive-failure circuit breaker
 */

const db = require("../config/database");
const { askAI } = require("./ai");
const { validateQuestion, isDuplicate } = require("./questionValidator");
const monitor = require("./llmUsageMonitor");
const { getDeterministicQuestions } = require("./englishQuestionBank");

const BATCH_SIZE = 5;
const MAX_RETRIES = 3;
const MAX_CONSECUTIVE_FAILURES = 5;

// ─── Prompt builder ────────────────────────────────────────────────

function buildBatchPrompt(profile, difficulty, batchSize, startNumber) {
  const targetRole = profile?.target_role_name || profile?.target_role_id || "Software Engineer";
  const experienceLevel = profile?.experience_level || "Student";
  const weakAreas = (profile?.weak_areas || []).slice(0, 3).join(", ") || "General";
  const learningGoals = (profile?.learning_goals || []).slice(0, 2).join(", ") || "Placement Preparation";
  const timeMap = { easy: "30-60s", medium: "60-120s", hard: "120-300s" };
  const solveTime = timeMap[difficulty] || "60s";

  return {
    system: `You are a placement aptitude test generator. Generate ${difficulty} MCQs for campus recruitment.

Each question must test reasoning, analytical thinking, quantitative aptitude, or logical deduction.

Rules: No trivia, no memorization, no GK, no school-level questions. Solve time ~${solveTime}. Distractors must be plausible (common errors).

Return ONLY valid JSON:
{"questions":[{"question":"","options":["A","B","C","D"],"correctAnswer":0,"explanation":"","topic":"","difficulty":"${difficulty}","type":"mcq","estimatedTime":60}]}

correctAnswer is 0-based index (0-3). No markdown, no extra text, only JSON.`,
    user: `Role: ${targetRole}
Experience: ${experienceLevel}
Difficulty: ${difficulty}
Questions: ${batchSize}
Weak Areas: ${weakAreas}
Goals: ${learningGoals}`,
  };
}

/**
 * General Knowledge prompt builder — generates ONE question per request.
 *
 * Token-economy design (vs. aptitude prompt):
 *  1. Compact single-line system prompt.
 *  2. Short user payload with the spec's exact requirements.
 *  3. No profile/resume payload — GK is topic-driven, not candidate-driven.
 *  4. correctAnswer is the option TEXT (normalized to an index before saving).
 *  5. Low max_tokens — one MCQ per request, never a full question set.
 */
function buildGKPrompt(difficulty) {
  const topicPrefs = (difficulty === "medium" || difficulty === "hard")
    ? `For MEDIUM/HARD, prefer:
- Indian and international current affairs
- science and technology
- economics
- business
- geography
- history
- government and institutions
- computer/IT awareness
- environment
- space
- important organizations
- business and corporate awareness
`
    : "";

  return {
    system: "You generate professional General Knowledge MCQs for a competitive employment aptitude assessment.",
    user: `Generate ONE ${difficulty} General Knowledge MCQ.

Requirements:
- 4 options
- exactly 1 correct answer
- objective and unambiguous
- factually correct
- suitable for job-placement assessments
- test knowledge, not trivia guessing
- no duplicate questions
- no "capital of France" style trivial questions for MEDIUM/HARD
- difficulty must genuinely match ${difficulty}
- avoid political persuasion, opinions, and controversial framing
- avoid outdated facts unless the question explicitly concerns history
- explanation must briefly justify the correct answer

${topicPrefs}
Do NOT invent facts.

Return ONLY valid JSON:
{
  "question": "...",
  "options": ["...", "...", "...", "..."],
  "correctAnswer": "...",
  "explanation": "...",
  "category": "..."
}`,
  };
}

/**
 * English & Communication prompt — batched, JSON-only, compact.
 * Objective types use 4-option MCQ; open-ended types request rubric.
 */
function buildEnglishPrompt(difficulty, batchSize, startNumber) {
  const need = `Generate ${batchSize} English & Communication questions, difficulty ${difficulty} (Q${startNumber}-${startNumber + batchSize - 1}).
The deterministic question bank already supplies the objective foundation. For these remaining slots, prioritize descriptive, situational and professional communication questions so the complete assessment is approximately 40% objective and 60% descriptive.
Use realistic workplace communication tasks, short-answer prompts, and professional writing scenarios rather than generic essays.
Mix only when needed: grammar, vocabulary, sentence construction, comprehension (with passage), situational and professional communication.
For MCQ/comprehension: 4 options, exactly 1 correct answer.
For open-ended (situational/professional): no options, provide rubric keywords array.
Return ONLY valid JSON:
{"questions":[{"question":"","type":"mcq|comprehension|descriptive","options":["A","B","C","D"],"correctAnswer":0,"explanation":"","topic":"","difficulty":"${difficulty}","passage":"optional","rubric":["keyword1","keyword2"]}]}`;
  return {
    system: "You generate professional English & Communication assessments for recruitment. Return JSON only, no markdown, no explanations, no duplicates, clear answerability, professional English.",
    user: need,
  };
}

function buildPromptForType(assessmentType, profile, difficulty, batchSize, startNumber) {
  if (assessmentType === "general_knowledge") return buildGKPrompt(difficulty);
  if (assessmentType === "english_communication") return buildEnglishPrompt(difficulty, batchSize, startNumber);
  return buildBatchPrompt(profile, difficulty, batchSize, startNumber);
}

/**
 * Normalize the LLM response into an array of question objects.
 * Aptitude returns { questions: [...] } (batched); GK returns a single object.
 * @param {*} parsed
 * @param {string} assessmentType
 * @returns {Array}
 */
function extractGeneratedQuestions(parsed, assessmentType) {
  if (assessmentType === "general_knowledge") {
    if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) return parsed.questions.slice(0, 1);
    if (parsed && typeof parsed === "object" && parsed.question) return [parsed];
    return [];
  }
  return Array.isArray(parsed?.questions) ? parsed.questions : [];
}

// ─── Topic inference (keyword-based, no AI call) ──────────────────

const TOPIC_KEYWORDS = {
  percent: "Percentages", "profit": "Profit & Loss", "loss": "Profit & Loss",
  interest: "Simple & Compound Interest", ratio: "Ratio & Proportion",
  speed: "Time Speed Distance", distance: "Time Speed Distance",
  time: "Time & Work", work: "Time & Work",
  probability: "Probability", permutation: "Permutations & Combinations",
  combination: "Permutations & Combinations",
  blood: "Blood Relations", relation: "Blood Relations",
  coding: "Coding-Decoding", decode: "Coding-Decoding",
  direction: "Direction Sense", clock: "Clocks & Calendars",
  calendar: "Clocks & Calendars",
  average: "Averages", mixture: "Mixtures & Alligations",
  alligation: "Mixtures & Alligations",
  train: "Problems on Trains", boat: "Boats & Streams",
  stream: "Boats & Streams",
  age: "Ages", number: "Number System",
  series: "Number Series", pattern: "Pattern Recognition",
  syllogism: "Syllogisms", statement: "Statement & Conclusion",
  assumption: "Statement & Assumption",
  data: "Data Interpretation", chart: "Data Interpretation",
  graph: "Data Interpretation", table: "Data Interpretation",
  venn: "Venn Diagrams",
  geometry: "Geometry", area: "Mensuration",
  volume: "Mensuration",
  inequality: "Inequalities",
  algebra: "Algebra", equation: "Algebraic Equations",
};

function inferTopic(questionText) {
  const lower = (questionText || "").toLowerCase();
  for (const [keyword, topic] of Object.entries(TOPIC_KEYWORDS)) {
    if (lower.includes(keyword)) return topic;
  }
  return "Quantitative Aptitude";
}

// ─── GK topic inference (keyword-based, no AI call) ────────────────

const GK_TOPIC_KEYWORDS = {
  history: "History", ancient: "History", medieval: "History", "independence": "History",
  mughal: "History", empire: "History", "freedom": "History", "partition": "History",
  dynasty: "History", king: "History", gandhi: "History", nehru: "History", "world war": "History",
  geography: "Geography", river: "Geography", mountain: "Geography", desert: "Geography",
  climate: "Geography", latitude: "Geography", longitude: "Geography", "tropical": "Geography",
  continent: "Geography", ocean: "Geography", "island": "Geography", "hemisphere": "Geography",
  polity: "Indian Polity", constitution: "Indian Polity", president: "Indian Polity",
  parliament: "Indian Polity", amendment: "Indian Polity", "supreme court": "Indian Polity",
  election: "Indian Polity", "fundamental right": "Indian Polity", "prime minister": "Indian Polity",
  economy: "Economy", gdp: "Economy", budget: "Economy", bank: "Economy", inflation: "Economy",
  finance: "Economy", tax: "Economy", gst: "Economy", "stock": "Economy", "reserve bank": "Economy",
  rupee: "Economy", "sebi": "Economy", "exchange": "Economy", "export": "Economy", "import": "Economy",
  science: "Science & Tech", physics: "Science & Tech", chemistry: "Science & Tech",
  biology: "Science & Tech", planet: "Science & Tech", "solar": "Science & Tech",
  "discovery": "Science & Tech", "inventor": "Science & Tech", "element": "Science & Tech",
  space: "Science & Tech", isro: "Science & Tech", nasa: "Science & Tech", satellite: "Science & Tech",
  mission: "Science & Tech", quantum: "Science & Tech", semiconductor: "Science & Tech",
  cyber: "Computer/IT Awareness", internet: "Computer/IT Awareness", software: "Computer/IT Awareness",
  ai: "Computer/IT Awareness", algorithm: "Computer/IT Awareness", "cpu": "Computer/IT Awareness",
  "programming": "Computer/IT Awareness", "computer": "Computer/IT Awareness", "database": "Computer/IT Awareness",
  sports: "Sports", olympic: "Sports", cricket: "Sports", player: "Sports", trophy: "Sports",
  "world cup": "Sports", "chess": "Sports", "hockey": "Sports", "badminton": "Sports",
  book: "Books & Authors", author: "Books & Authors", novel: "Books & Authors", "written by": "Books & Authors",
  poet: "Books & Authors", "literature": "Books & Authors", "nobel": "Books & Authors",
  culture: "Art & Culture", dance: "Art & Culture", temple: "Art & Culture", festival: "Art & Culture",
  environment: "Environment", climate: "Environment", emissions: "Environment", wildlife: "Environment",
  "national park": "Environment", renewable: "Environment", ecosystem: "Environment",
  organization: "Important Organizations", "headquarters": "Important Organizations",
  "united nations": "Important Organizations", who: "Important Organizations",
  wto: "Important Organizations", imf: "Important Organizations", "world bank": "Important Organizations",
  business: "Business Awareness", corporate: "Business Awareness", company: "Business Awareness",
  ceo: "Business Awareness", startup: "Business Awareness", fintech: "Business Awareness",
  "current affairs": "Current Affairs", summit: "Current Affairs", accord: "Current Affairs",
  treaty: "Current Affairs",
};

function inferGkTopic(questionText) {
  const lower = (questionText || "").toLowerCase();
  for (const [keyword, topic] of Object.entries(GK_TOPIC_KEYWORDS)) {
    if (lower.includes(keyword)) return topic;
  }
  return "General Knowledge";
}

const ENGLISH_TOPIC_KEYWORDS = {
  grammar: "grammar", tense: "grammar", article: "grammar", preposition: "grammar", verb: "grammar", error: "grammar", punctuation: "grammar",
  vocabulary: "vocabulary", synonym: "vocabulary", antonym: "vocabulary", spelling: "vocabulary", word: "vocabulary",
  comprehension: "comprehension", passage: "comprehension", inference: "comprehension", "main idea": "comprehension",
  sentence: "sentence", ordering: "sentence", correction: "sentence", completion: "sentence",
  situational: "situational", teammate: "situational", deadline: "situational", communication: "situational",
  professional: "professional", client: "professional", email: "professional", workplace: "professional",
};

function inferEnglishTopic(questionText) {
  const lower = (questionText || "").toLowerCase();
  for (const [keyword, topic] of Object.entries(ENGLISH_TOPIC_KEYWORDS)) {
    if (lower.includes(keyword)) return topic;
  }
  return "grammar";
}

function inferTopicForType(assessmentType, questionText) {
  if (assessmentType === "general_knowledge") return inferGkTopic(questionText);
  if (assessmentType === "english_communication") return inferEnglishTopic(questionText);
  return inferTopic(questionText);
}

// ─── Self-healing repair pipeline ─────────────────────────────────

const TIME_DEFAULTS = { easy: 60, medium: 90, hard: 150 };

const ENGLISH_FALLBACK_PROMPTS = [
  { type: "situational", topic: "situational", question: "Your teammate has missed an important deadline. Write a professional message asking about the delay and agreeing on the next step.", rubric: ["respectful tone", "clear request", "next step"] },
  { type: "professional", topic: "professional", question: "A client will receive a feature one day later than planned. Write a concise professional email explaining the change and the revised delivery plan.", rubric: ["clear explanation", "ownership", "revised plan"] },
  { type: "descriptive", topic: "communication", question: "Describe a difficult project problem you encountered and explain how you worked with others to solve it.", rubric: ["context", "collaboration", "outcome"] },
  { type: "situational", topic: "situational", question: "Your manager asks why a project is behind schedule. Explain the situation and the actions you would take next.", rubric: ["cause", "action plan", "professional tone"] },
  { type: "professional", topic: "professional", question: "Write a short update to your team explaining a change in project priorities and how responsibilities will be adjusted.", rubric: ["context", "clarity", "responsibilities"] },
  { type: "descriptive", topic: "sentence", question: "Explain a technical idea to a non-technical stakeholder using clear, concise language and one practical example.", rubric: ["clear structure", "accessible language", "example"] },
  { type: "situational", topic: "situational", question: "A colleague disagrees with your proposed solution during a meeting. Write how you would respond constructively.", rubric: ["respect", "reasoning", "collaboration"] },
  { type: "professional", topic: "professional", question: "Write a concise follow-up email summarizing a meeting decision, assigned owners, and the next deadline.", rubric: ["summary", "ownership", "deadline"] },
];

function deterministicEnglishFallback(questionNumber, difficulty) {
  const prompt = ENGLISH_FALLBACK_PROMPTS[(questionNumber - 1) % ENGLISH_FALLBACK_PROMPTS.length];
  return {
    id: `q${questionNumber}`,
    type: prompt.type,
    question: prompt.question,
    options: [],
    correctAnswer: null,
    explanation: "Evaluate the response for language quality and communication effectiveness.",
    topic: prompt.topic,
    difficulty,
    subDifficulty: difficulty,
    marks: 1,
    estimatedTime: 120,
    rubric: prompt.rubric,
  };
}

/**
 * Auto-repair missing/partial fields, then validate.
 * Returns { valid, errors, repairs }.
 */
function repairAndValidate(q, expectedDifficulty, assessmentType) {
  const repairs = [];
  const isGk = assessmentType === "general_knowledge";
  const isEnglish = assessmentType === "english_communication";

  // ── GK normalization (per GK generation contract) ──────────────────
  if (isGk && q && typeof q === "object") {
    // correctAnswer is the option TEXT from the LLM → convert to 0-based index
    if (typeof q.correctAnswer === "string" && Array.isArray(q.options)) {
      const idx = q.options.findIndex(
        (o) => String(o).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()
      );
      if (idx >= 0) q.correctAnswer = idx;
    }
    // category → topic (stored in the shared `topic` column)
    if ((!q.topic || typeof q.topic !== "string" || q.topic.trim().length < 2) && q.category) {
      q.topic = q.category;
    }
    // GK prompt does not emit difficulty — enforce the assessment difficulty
    q.difficulty = expectedDifficulty;
  }

  // ── English normalization ──────────────────────────────────────────
  if (isEnglish && q && typeof q === "object") {
    if (!q.topic || typeof q.topic !== "string" || q.topic.trim().length < 2) {
      q.topic = inferEnglishTopic(q.question || "");
    }
    if (!q.type) q.type = q.options && q.options.length === 4 ? "mcq" : "descriptive";
    if (q.type === "descriptive" || q.type === "situational" || q.type === "professional") {
      if (!q.rubric || !Array.isArray(q.rubric)) q.rubric = q.topic ? [q.topic, expectedDifficulty] : ["communication"];
      if (q.correctAnswer === undefined) q.correctAnswer = null;
      if (q.options && q.options.length > 0 && !q.correctAnswer) q.correctAnswer = null;
    }
    if (q.type === "comprehension" && (!q.passage || q.passage.trim().length < 20)) {
      // Leave invalid to trigger regeneration
    }
  }

  if (!q.topic || typeof q.topic !== "string" || q.topic.trim().length < 2) {
    q.topic = inferTopicForType(assessmentType, q.question || "");
    repairs.push("topic");
  }

  if (!q.difficulty || !["easy", "medium", "hard"].includes(q.difficulty)) {
    q.difficulty = expectedDifficulty;
    repairs.push("difficulty");
  }

  if (!q.subDifficulty) {
    q.subDifficulty = q.difficulty || expectedDifficulty;
    repairs.push("subDifficulty");
  }

  if (!q.estimatedTime || typeof q.estimatedTime !== "number") {
    q.estimatedTime = TIME_DEFAULTS[expectedDifficulty] || 60;
    repairs.push("estimatedTime");
  }

  if (!q.marks || typeof q.marks !== "number") {
    q.marks = 1;
    repairs.push("marks");
  }

  const minExplLen = isGk ? 5 : 1;
  if (!q.explanation || typeof q.explanation !== "string" || q.explanation.trim().length < minExplLen) {
    if (isGk) {
      // Never fabricate a factual GK explanation — leave invalid so the question is regenerated.
    } else {
      const answerText = (q.options && q.options[q.correctAnswer]) ? q.options[q.correctAnswer] : `option ${(q.correctAnswer || 0) + 1}`;
      q.explanation = `Option '${answerText}' is the correct answer because it satisfies the conditions described in the question, while the remaining options do not.`;
      repairs.push("explanation");
    }
  }

  if (!q.shortExplanation) {
    q.shortExplanation = q.explanation;
    repairs.push("shortExplanation");
  }

  if (q.solution != null && (typeof q.solution !== "string" || q.solution.trim().length < 5)) {
    q.solution = q.explanation;
    repairs.push("solution");
  }

  if (!q.type || !["mcq", "multiple", "numerical", "boolean", "comprehension", "descriptive", "situational", "professional"].includes(q.type)) {
    q.type = isEnglish && (!q.options || q.options.length === 0) ? "descriptive" : "mcq";
    repairs.push("type");
  }

  // English descriptive/comprehension overrides for explanation
  const effectiveMinExpl = isEnglish && ["descriptive", "situational", "professional"].includes(q.type) ? 1 : minExplLen;
  if (isEnglish && ["descriptive", "situational", "professional"].includes(q.type) && (!q.explanation || q.explanation.trim().length < 1)) {
    q.explanation = q.rubric ? `Rubric: ${q.rubric.join("; ")}` : "Open-ended communication question.";
    repairs.push("explanation");
  }

  const result = validateQuestion(q, null, expectedDifficulty, { minExplanationLength: isEnglish && ["descriptive", "situational", "professional"].includes(q.type) ? 1 : minExplLen });
  return { ...result, repairs };
}

// ─── Database helpers ──────────────────────────────────────────────

/**
 * Save one question (upsert so resume never fails on duplicates).
 */
async function saveQuestionToDb(assessmentId, q, batchNumber) {
  const qn = parseInt((q.id || "").replace("q", "") || "0", 10);
  await db.query(
    `INSERT INTO aptitude_questions
        (assessment_id, question_number, type, question_text, options, correct_answer,
         topic, difficulty, sub_difficulty, marks, expected_time,
         solution, explanation, learning_objective, common_mistake, passage, batch_number, rubric)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (assessment_id, question_number) DO UPDATE
        SET question_text = EXCLUDED.question_text, options = EXCLUDED.options,
            correct_answer = EXCLUDED.correct_answer, topic = EXCLUDED.topic,
            difficulty = EXCLUDED.difficulty, sub_difficulty = EXCLUDED.sub_difficulty,
            marks = EXCLUDED.marks, expected_time = EXCLUDED.expected_time,
            solution = EXCLUDED.solution, explanation = EXCLUDED.explanation,
            learning_objective = EXCLUDED.learning_objective,
            common_mistake = EXCLUDED.common_mistake, passage = EXCLUDED.passage,
            batch_number = EXCLUDED.batch_number, rubric = EXCLUDED.rubric`,
    [
      assessmentId, qn, q.type, q.question,
      JSON.stringify(q.options || []), JSON.stringify(q.correctAnswer),
      q.topic, q.difficulty, q.subDifficulty || q.difficulty,
      q.marks || 1, q.estimatedTime || null,
      q.solution || null, q.shortExplanation || q.explanation || null,
      q.learningObjective || null, q.commonMistake || null,
      q.passage || null, batchNumber, JSON.stringify(q.rubric || null),
    ]
  );
}

async function updateProgress(assessmentId, count) {
  await db.query(
    `UPDATE aptitude_assessments SET questions_generated = $1, updated_at = NOW() WHERE id = $2`,
    [count, assessmentId]
  );
}

async function loadExistingQuestions(assessmentId) {
  const loaded = await db.query(
    `SELECT question_number, question_text, topic, type, difficulty
     FROM aptitude_questions WHERE assessment_id = $1 ORDER BY question_number`,
    [assessmentId]
  );
  return loaded.rows.map((r) => ({
    question: r.question_text, topic: r.topic, type: r.type, difficulty: r.difficulty,
  }));
}

// ─── Single-question generator with retry ─────────────────────────

async function generateSingle(assessmentId, profile, difficulty, questionNumber, existingQuestions, retryCount, assessmentType) {
  if (retryCount > 0) monitor.recordRetry();
  if (retryCount >= MAX_RETRIES) {
    console.warn(`[questionGenerator] Q${questionNumber}: exhausted ${MAX_RETRIES} retries`);
    return null;
  }

  const prompt = buildPromptForType(assessmentType, profile, difficulty, 1, questionNumber);
  const msg = prompt.user + "\n\nIMPORTANT: Previous attempt failed. Return ONLY valid JSON with all required fields.";
  const isGk = assessmentType === "general_knowledge";
  let parsed;
  try {
    parsed = await askAI(
      [{ role: "system", content: prompt.system }, { role: "user", content: msg }],
      {
        temperature: isGk ? 0.6 : 0.7,
        max_tokens: isGk ? 600 : 1500,
        assessmentId,
        questionNumber,
        difficulty,
      }
    );
  } catch {
    return generateSingle(assessmentId, profile, difficulty, questionNumber, existingQuestions, retryCount + 1, assessmentType);
  }

  const questions = extractGeneratedQuestions(parsed, assessmentType);
  if (questions.length === 0) {
    return generateSingle(assessmentId, profile, difficulty, questionNumber, existingQuestions, retryCount + 1, assessmentType);
  }

  const q = questions[0];
  q.id = `q${questionNumber}`;

  const { valid, errors } = repairAndValidate(q, difficulty, assessmentType);
  const dup = existingQuestions.some((eq) => isDuplicate(eq, q));

  if (valid && !dup) return q;

  console.log(`[questionGenerator] Q${questionNumber} retry ${retryCount + 1}/${MAX_RETRIES}: ${errors.join("; ")}`);
  return generateSingle(assessmentId, profile, difficulty, questionNumber, existingQuestions, retryCount + 1, assessmentType);
}

// ─── Main entry point ─────────────────────────────────────────────

/**
 * Generate questions for an assessment with a self-healing pipeline.
 *
 * Flow per batch:
 *   1. Generate 5 questions (1 API call)
 *   2. For each: auto-repair missing fields → validate
 *   3. Valid questions → save immediately
 *   4. Invalid → regenerate individually with retries
 *   5. After each save → update progress (savepoint)
 *
 * On server restart, resumes from the last saved question_number.
 */
async function generateQuestionsForAssessment(assessmentId, profile, difficulty, totalCount, assessmentType = "aptitude") {
  // ─── Start monitoring ──────────────────────────────────────────
  monitor.startAssessment(assessmentId);

  // ─── Resume: count existing questions ───────────────────────────
  const existing = await db.query(
    `SELECT COUNT(*)::int AS count FROM aptitude_questions WHERE assessment_id = $1`,
    [assessmentId]
  );
  let generated = parseInt(existing.rows[0]?.count || "0", 10);
  const allQuestions = generated > 0 ? await loadExistingQuestions(assessmentId) : [];

  if (generated > 0) {
    console.log(`[questionGenerator] Resuming assessment ${assessmentId} — Q${generated + 1}/${totalCount}`);
  }

  // ── English deterministic bank pre-fill (Priority 1, 0 tokens) ──
  if (assessmentType === "english_communication" && generated < totalCount) {
    const neededFromBank = Math.min(totalCount - generated, Math.ceil(totalCount * 0.4));
    if (neededFromBank > 0) {
      const bankQs = getDeterministicQuestions({ difficulty, count: neededFromBank, excludeIds: new Set(allQuestions.map((q) => q.question)) });
      for (const q of bankQs) {
        if (generated >= totalCount) break;
        q.id = `q${generated + 1}`;
        const { valid } = repairAndValidate(q, difficulty, assessmentType);
        if (!valid) continue;
        await saveQuestionToDb(assessmentId, q, 0);
        allQuestions.push({ question: q.question, topic: q.topic, type: q.type, difficulty: q.difficulty });
        generated++;
        monitor.incrementQuestionCount();
        await updateProgress(assessmentId, generated);
      }
      if (generated >= totalCount) {
        await db.query(`UPDATE aptitude_assessments SET status = 'ready', questions_generated = $1, updated_at = NOW() WHERE id = $2`, [generated, assessmentId]);
        monitor.endAssessment(difficulty);
        return { success: true, totalGenerated: generated };
      }
    }
  }

  let batchNumber = 0;
  let consecutiveFailures = 0;

  try {
    while (generated < totalCount) {
      batchNumber++;
      const remaining = totalCount - generated;
      const isGk = assessmentType === "general_knowledge";
      const isEnglish = assessmentType === "english_communication";
      // GK: 1 per request, English: batched 5 (token-optimized), Aptitude: 5
      const batchSize = Math.min(isGk ? 1 : BATCH_SIZE, remaining);
      const startNumber = generated + 1;
      const maxTokens = isGk ? 600 : isEnglish ? 1200 : 1500;
      const temperature = isGk ? 0.6 : isEnglish ? 0.4 : 0.7;

      // ── 1. Generate batch ───────────────────────────────────────
      const prompt = buildPromptForType(assessmentType, profile, difficulty, batchSize, startNumber);
      let parsed;
      try {
        parsed = await askAI(
          [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
          { temperature, max_tokens: maxTokens, assessmentId, questionNumber: startNumber, difficulty }
        );
      } catch (err) {
        console.warn(`[questionGenerator] Batch ${batchNumber} LLM error: ${err.message}`);
        for (let i = 0; i < batchSize; i++) {
          const q = isEnglish
            ? deterministicEnglishFallback(startNumber + i, difficulty)
            : await generateSingle(assessmentId, profile, difficulty, startNumber + i, allQuestions, 0, assessmentType);
          if (q) {
            await saveQuestionToDb(assessmentId, q, batchNumber);
            allQuestions.push({ question: q.question, topic: q.topic, type: q.type, difficulty: q.difficulty });
            generated++;
            monitor.incrementQuestionCount();
            await updateProgress(assessmentId, generated);
            consecutiveFailures = 0;
          } else {
            consecutiveFailures++;
            monitor.recordFailure();
          }
        }
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          throw new Error(`${MAX_CONSECUTIVE_FAILURES} consecutive failures — aborting`);
        }
        continue;
      }

      let llmQuestions = extractGeneratedQuestions(parsed, assessmentType);
      if (!Array.isArray(llmQuestions) || llmQuestions.length === 0) {
        console.warn(`[questionGenerator] Batch ${batchNumber}: empty response, retrying one-by-one`);
        for (let i = 0; i < batchSize; i++) {
          const q = isEnglish
            ? deterministicEnglishFallback(startNumber + i, difficulty)
            : await generateSingle(assessmentId, profile, difficulty, startNumber + i, allQuestions, 0, assessmentType);
          if (q) {
            await saveQuestionToDb(assessmentId, q, batchNumber);
            allQuestions.push({ question: q.question, topic: q.topic, type: q.type, difficulty: q.difficulty });
            generated++;
            monitor.incrementQuestionCount();
            await updateProgress(assessmentId, generated);
            consecutiveFailures = 0;
          } else {
            consecutiveFailures++;
            monitor.recordFailure();
          }
        }
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          throw new Error(`${MAX_CONSECUTIVE_FAILURES} consecutive failures — aborting`);
        }
        continue;
      }

      if (llmQuestions.length > batchSize) llmQuestions = llmQuestions.slice(0, batchSize);

      // ── 2–4. Process each question: repair → validate → save → retry if needed ──
      for (let i = 0; i < llmQuestions.length; i++) {
        const q = llmQuestions[i];
        const qn = startNumber + i;
        q.id = `q${qn}`;

        const { valid, errors, repairs } = repairAndValidate(q, difficulty, assessmentType);
        const dup = allQuestions.some((eq) => isDuplicate(eq, q));
        const isOk = valid && !dup;

        if (isOk) {
          for (const r of repairs) monitor.recordRepair();

          await saveQuestionToDb(assessmentId, q, batchNumber);
          allQuestions.push({ question: q.question, topic: q.topic, type: q.type, difficulty: q.difficulty });
          generated++;
          monitor.incrementQuestionCount();
          await updateProgress(assessmentId, generated);
          consecutiveFailures = 0;
          const repairInfo = repairs.length > 0 ? ` (repaired: ${repairs.join(", ")})` : "";
          console.log(`[questionGenerator] Q${qn}/${totalCount}: saved${repairInfo}`);
        } else {
          console.log(`[questionGenerator] Q${qn}: invalid — ${errors.join("; ")}, regenerating`);
          const retryQ = isEnglish
            ? deterministicEnglishFallback(qn, difficulty)
            : await generateSingle(assessmentId, profile, difficulty, qn, allQuestions, 0, assessmentType);
          if (retryQ) {
            await saveQuestionToDb(assessmentId, retryQ, batchNumber);
            allQuestions.push({ question: retryQ.question, topic: retryQ.topic, type: retryQ.type, difficulty: retryQ.difficulty });
            generated++;
            monitor.incrementQuestionCount();
            await updateProgress(assessmentId, generated);
            consecutiveFailures = 0;
            console.log(`[questionGenerator] Q${qn}/${totalCount}: saved after regeneration`);
          } else {
            consecutiveFailures++;
            monitor.recordFailure();
            console.warn(`[questionGenerator] Q${qn}/${totalCount}: failed — skipping`);
          }
        }
      }

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new Error(`${MAX_CONSECUTIVE_FAILURES} consecutive failures — aborting`);
      }
    }

    // ── Mark assessment READY ─────────────────────────────────────
    await db.query(
      `UPDATE aptitude_assessments SET status = 'ready', questions_generated = $1, updated_at = NOW() WHERE id = $2`,
      [generated, assessmentId]
    );
    console.log(`[questionGenerator] Assessment ${assessmentId} complete: ${generated}/${totalCount} ready`);

    // ── Log assessment summary via monitor ────────────────────────
    monitor.endAssessment(difficulty);

    return { success: true, totalGenerated: generated };
  } catch (error) {
    console.error(`[questionGenerator] Assessment ${assessmentId} failed:`, error.message);
    await db.query(
      `UPDATE aptitude_assessments SET status = 'failed', updated_at = NOW() WHERE id = $1`,
      [assessmentId]
    );
    return { success: false, error: error.message, totalGenerated: generated };
  }
}

module.exports = { generateQuestionsForAssessment, generateSingle };
