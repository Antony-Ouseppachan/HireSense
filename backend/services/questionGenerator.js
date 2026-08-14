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
  system: `You are an expert campus placement aptitude question generator.

Generate original, high-quality ${difficulty} multiple-choice aptitude questions similar in style to modern campus recruitment assessments (SHL, AMCAT, CoCubes, Mercer Mettl, HackerRank Aptitude, eLitmus and similar platforms).

Generate ONLY aptitude questions covering:
• Quantitative Aptitude
• Logical Reasoning
• Analytical Reasoning

Do NOT generate:
• General Knowledge
• Current Affairs
• English
• Programming
• Computer Fundamentals
• Science
• Theory or memorization questions

Requirements:
- Questions must require reasoning or calculation.
- Match ${difficulty} difficulty.
- Average solve time: ${solveTime}.
- Exactly one correct answer.
- Exactly four unique, meaningful options.
- Distractors should reflect common candidate mistakes.
- Avoid repeated concepts and values.
- Return ONLY valid JSON matching the required schema.
- No markdown.
- No commentary.`,

  user: `Generate ${batchSize} placement aptitude MCQs.

Role: ${targetRole}
Experience: ${experienceLevel}
Difficulty: ${difficulty}
Weak Areas: ${weakAreas}
Learning Goals: ${learningGoals}

Return this exact JSON structure:

{
  "questions":[
    {
      "question":"...",
      "options":["...","...","...","..."],
      "correctAnswer":0,
      "explanation":{
        "correct":"Step-by-step solution.",
        "option0":"Reason.",
        "option1":"Reason.",
        "option2":"Reason.",
        "option3":"Reason."
      },
      "topic":"...",
      "difficulty":"${difficulty}",
      "type":"mcq",
      "estimatedTime":${solveTime}
    }
  ]
}

Rules:
- Complete questions only.
- End every question with '?' or ':'.
- No duplicate or empty options.
- correctAnswer must be 0-3.
- Every option explanation is mandatory.
- Return JSON only.`,
};
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

// ─── Self-healing repair pipeline ─────────────────────────────────

const TIME_DEFAULTS = { easy: 60, medium: 90, hard: 150 };

/**
 * Auto-repair missing/partial fields, then validate.
 * Returns { valid, errors, repairs }.
 */
function repairAndValidate(q, expectedDifficulty) {
  const repairs = [];

  // Sanitize question text
  if (q.question && typeof q.question === "string") {
    q.question = q.question.trim();
  }

  // Sanitize option values (trim whitespace; drop placeholder-only tokens)
  if (Array.isArray(q.options)) {
    q.options = q.options.map((o) => (typeof o === "string" ? o.trim() : o));
  }

  if (!q.topic || typeof q.topic !== "string" || q.topic.trim().length < 2) {
    q.topic = inferTopic(q.question || "");
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

  const answerText = (q.options && q.options[q.correctAnswer]) ? q.options[q.correctAnswer] : `option ${(q.correctAnswer || 0) + 1}`;

  if (!q.explanation) {
    q.explanation = `Option '${answerText}' is the correct answer because it satisfies the conditions described in the question, while the remaining options do not.`;
    repairs.push("explanation");
  } else if (typeof q.explanation === "object" && !Array.isArray(q.explanation)) {
    if (typeof q.explanation.correct !== "string" || q.explanation.correct.trim().length < 1) {
      q.explanation.correct = `Option '${answerText}' is the correct answer because it satisfies the conditions described in the question, while the remaining options do not.`;
      repairs.push("explanation.correct");
    }
    (q.options || []).forEach((_, i) => {
      const key = "option" + i;
      if (q.explanation[key] == null || typeof q.explanation[key] !== "string") {
        q.explanation[key] = "";
        repairs.push(key);
      }
    });
  }

  if (!q.shortExplanation) {
    q.shortExplanation = typeof q.explanation === "object" && !Array.isArray(q.explanation)
      ? q.explanation.correct
      : q.explanation;
    repairs.push("shortExplanation");
  }

  if (q.solution != null && (typeof q.solution !== "string" || q.solution.trim().length < 5)) {
    q.solution = typeof q.explanation === "object" && !Array.isArray(q.explanation)
      ? q.explanation.correct
      : q.explanation;
    repairs.push("solution");
  }

  if (!q.type || !["mcq", "multiple", "numerical", "boolean", "comprehension"].includes(q.type)) {
    q.type = "mcq";
    repairs.push("type");
  }

  const result = validateQuestion(q, null, expectedDifficulty);
  return { ...result, repairs };
}

// ─── Database helpers ──────────────────────────────────────────────

/**
 * Save one question (upsert so resume never fails on duplicates).
 */
async function saveQuestionToDb(assessmentId, q, batchNumber) {
  const qn = parseInt((q.id || "").replace("q", "") || "0", 10);
  const explanationValue = (() => {
    const e = q.explanation;
    if (e == null) return q.shortExplanation || null;
    if (typeof e === "object" && !Array.isArray(e)) return JSON.stringify(e);
    return typeof e === "string" ? e : null;
  })();
  await db.query(
    `INSERT INTO aptitude_questions
       (assessment_id, question_number, type, question_text, options, correct_answer,
        topic, difficulty, sub_difficulty, marks, expected_time,
        solution, explanation, learning_objective, common_mistake, passage, batch_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (assessment_id, question_number) DO UPDATE
       SET question_text = EXCLUDED.question_text, options = EXCLUDED.options,
           correct_answer = EXCLUDED.correct_answer, topic = EXCLUDED.topic,
           difficulty = EXCLUDED.difficulty, sub_difficulty = EXCLUDED.sub_difficulty,
           marks = EXCLUDED.marks, expected_time = EXCLUDED.expected_time,
           solution = EXCLUDED.solution, explanation = EXCLUDED.explanation,
           learning_objective = EXCLUDED.learning_objective,
           common_mistake = EXCLUDED.common_mistake, passage = EXCLUDED.passage,
           batch_number = EXCLUDED.batch_number`,
    [
      assessmentId, qn, q.type, q.question,
      JSON.stringify(q.options || []), JSON.stringify(q.correctAnswer),
      q.topic, q.difficulty, q.subDifficulty || q.difficulty,
      q.marks || 1, q.estimatedTime || null,
      q.solution || null, explanationValue,
      q.learningObjective || null, q.commonMistake || null,
      q.passage || null, batchNumber,
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

async function generateSingle(assessmentId, profile, difficulty, questionNumber, existingQuestions, retryCount, lastErrors = []) {
  if (retryCount > 0) monitor.recordRetry();
  if (retryCount >= MAX_RETRIES) {
    console.warn(`[questionGenerator] Q${questionNumber}: exhausted ${MAX_RETRIES} retries`);
    return null;
  }

  const prompt = buildBatchPrompt(profile, difficulty, 1, questionNumber);
  const failHint = lastErrors.length > 0
    ? `\n\nIMPORTANT: Your previous attempt was REJECTED. Fix ALL of these issues and return ONLY valid JSON with complete, non-empty option values:\n- ${lastErrors.join("\n- ")}`
    : "\n\nIMPORTANT: Previous attempt failed. Return ONLY valid JSON with all required fields.";
  const msg = prompt.user + failHint;
  let parsed;
  try {
    parsed = await askAI(
      [{ role: "system", content: prompt.system }, { role: "user", content: msg }],
      { temperature: 0.7, max_tokens: 1500, assessmentId, questionNumber, difficulty }
    );
  } catch {
    return generateSingle(assessmentId, profile, difficulty, questionNumber, existingQuestions, retryCount + 1, lastErrors);
  }

  const questions = parsed?.questions || [];
  if (questions.length === 0) {
    return generateSingle(assessmentId, profile, difficulty, questionNumber, existingQuestions, retryCount + 1, lastErrors);
  }

  const q = questions[0];
  q.id = `q${questionNumber}`;

  const { valid, errors } = repairAndValidate(q, difficulty);
  const dup = existingQuestions.some((eq) => isDuplicate(eq, q));

  if (valid && !dup) return q;

  console.log(`[questionGenerator] Q${questionNumber} retry ${retryCount + 1}/${MAX_RETRIES}: ${errors.join("; ")}`);
  return generateSingle(assessmentId, profile, difficulty, questionNumber, existingQuestions, retryCount + 1, errors);
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
async function generateQuestionsForAssessment(assessmentId, profile, difficulty, totalCount) {
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

  let batchNumber = 0;
  let consecutiveFailures = 0;

  try {
    while (generated < totalCount) {
      batchNumber++;
      const remaining = totalCount - generated;
      const batchSize = Math.min(BATCH_SIZE, remaining);
      const startNumber = generated + 1;

      // ── 1. Generate batch ───────────────────────────────────────
      const prompt = buildBatchPrompt(profile, difficulty, batchSize, startNumber);
      let parsed;
      try {
        parsed = await askAI(
          [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
          { temperature: 0.7, max_tokens: 1500, assessmentId, questionNumber: startNumber, difficulty }
        );
      } catch (err) {
        console.warn(`[questionGenerator] Batch ${batchNumber} LLM error: ${err.message}`);
        for (let i = 0; i < batchSize; i++) {
          const q = await generateSingle(assessmentId, profile, difficulty, startNumber + i, allQuestions, 0);
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

      let llmQuestions = parsed?.questions || [];
      if (!Array.isArray(llmQuestions) || llmQuestions.length === 0) {
        console.warn(`[questionGenerator] Batch ${batchNumber}: empty response, retrying one-by-one`);
        for (let i = 0; i < batchSize; i++) {
          const q = await generateSingle(assessmentId, profile, difficulty, startNumber + i, allQuestions, 0);
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

        const { valid, errors, repairs } = repairAndValidate(q, difficulty);
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
          const retryQ = await generateSingle(assessmentId, profile, difficulty, qn, allQuestions, 0, errors);
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

module.exports = { generateQuestionsForAssessment };
