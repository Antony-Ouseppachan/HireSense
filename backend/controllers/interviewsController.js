const db = require("../config/database");
const { askAI } = require("../services/ai");
const { analyzeResponses } = require("../services/nlpService");

async function resolveUserId(firebaseUid) {
  const result = await db.query("SELECT id FROM users WHERE firebase_uid = $1", [firebaseUid]);
  return result.rows.length ? result.rows[0].id : null;
}

/* ─── Fallback hardcoded questions ─── */
function generateFallbackQuestions(profile, category) {
  const skills = Array.isArray(profile.skills) ? profile.skills : [];
  const skillNames = skills.map(s => (typeof s === "string" ? s : s.name || "")).filter(Boolean);
  const role = profile.target_role_name || "candidate";

  const pools = {
    aptitude: [
      { question: "If 15 workers can build a wall in 20 days, how many workers are needed to build the same wall in 12 days?", options: ["22", "25", "28", "30"], answer: "25", explanation: "Work = 15 × 20 = 300 worker-days. Workers needed = 300 / 12 = 25." },
      { question: "What is the next number: 2, 6, 18, 54, ?", options: ["108", "162", "216", "72"], answer: "162", explanation: "Each term is multiplied by 3. 54 × 3 = 162." },
      { question: "A train 150m long passes a pole in 15 seconds. What is its speed in km/h?", options: ["36", "42", "48", "54"], answer: "36", explanation: "Speed = 150/15 = 10 m/s = 10 × 18/5 = 36 km/h." },
      { question: "If LOGIC is coded as BDFHJ, how is POWER coded?", options: ["MNQDG", "MNPCH", "MORVH", "NPSWF"], answer: "MNPCH", explanation: "Each letter is replaced by the letter two positions before it in the alphabet." },
      { question: "A bag contains 4 red, 3 blue, and 5 green balls. What is the probability of drawing a blue ball?", options: ["1/4", "3/12", "1/3", "3/4"], answer: "1/4", explanation: "Total balls = 12. Blue balls = 3. Probability = 3/12 = 1/4." },
    ],
    gk: [
      { question: "Which planet has the most moons in our solar system?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], answer: "Saturn", explanation: "Saturn has 146 known moons, the most of any planet." },
      { question: "What is the chemical symbol for Tungsten?", options: ["Tu", "Tn", "W", "Tg"], answer: "W", explanation: "W comes from Wolfram, the original name for Tungsten." },
      { question: "Who developed the Python programming language?", options: ["Dennis Ritchie", "Guido van Rossum", "James Gosling", "Bjarne Stroustrup"], answer: "Guido van Rossum", explanation: "Python was created by Guido van Rossum and first released in 1991." },
      { question: "What is the SI unit of electric current?", options: ["Volt", "Ohm", "Ampere", "Watt"], answer: "Ampere", explanation: "The ampere (A) is the SI base unit of electric current." },
      { question: "In which year did India launch its first satellite?", options: ["1972", "1975", "1978", "1980"], answer: "1975", explanation: "Aryabhata, India's first satellite, was launched on April 19, 1975." },
    ],
    english: [
      { question: "Choose the correct spelling:", options: ["Accomodate", "Acommodate", "Accommodate", "Acomodate"], answer: "Accommodate", explanation: "Accommodate has double c and double m." },
      { question: "What is the synonym of 'Ubiquitous'?", options: ["Rare", "Omnipresent", "Unique", "Absent"], answer: "Omnipresent", explanation: "Ubiquitous means present everywhere, synonymous with omnipresent." },
      { question: "Identify the error: 'Neither the manager nor his team were present.'", options: ["Neither", "Nor", "Were", "No error"], answer: "Were", explanation: "With 'neither...nor', the verb agrees with the nearest subject. 'Team' is singular, so 'was' is correct." },
      { question: "Change to passive voice: 'She writes a letter.'", options: ["A letter is written by her.", "A letter was written.", "A letter is being written.", "She is writing a letter."], answer: "A letter is written by her.", explanation: "Passive: object + is/am/are + past participle + by + subject." },
      { question: "What figure of speech is 'The world is a stage'?", options: ["Simile", "Metaphor", "Personification", "Hyperbole"], answer: "Metaphor", explanation: "A direct comparison without 'like' or 'as' is a metaphor." },
    ],
  };

  const pool = pools[category] || pools.aptitude;
  return pool.slice(0, 5);
}

/* ─── AI question generation via Groq ─── */
async function generateAIQuestions(profile, category, difficulty, duration, mode) {
  const role = profile?.target_role_name || "candidate";
  const skills = Array.isArray(profile?.skills) ? profile.skills.map(s => s.name || s).join(", ") : "general";
  const skillText = skills !== "general" ? `The candidate has skills in: ${skills}. ` : "";

  const categoryDescriptions = {
    aptitude: "Generate MCQ aptitude questions covering quantitative aptitude, logical reasoning, data interpretation, and analytical reasoning. Include 4 options per question with the correct answer and explanation.",
    gk: "Generate MCQ general knowledge questions covering current affairs, science, technology, computer basics, and business. Include 4 options per question with the correct answer and explanation.",
    english: "Generate MCQ English language questions covering grammar, vocabulary, reading comprehension, and verbal ability. Include 4 options per question with the correct answer and explanation.",
    technical: "Generate technical interview questions based on the candidate's tech stack. Each question should test depth of knowledge.",
    resume: "Generate interview questions personalized to the candidate's projects and experience as described in their resume.",
    coding: "Generate coding challenge questions with problem descriptions and expected solution approaches.",
    hr: "Generate HR interview questions covering self-introduction, career goals, strengths, weaknesses, and situational responses.",
    behavioral: "Generate behavioral interview questions using the STAR method format covering leadership, teamwork, and problem-solving.",
    role_specific: `Generate role-specific interview questions for a ${role} position, tailored to the skills mentioned.`,
    company_specific: "Generate company-specific interview questions mimicking top companies' interview styles.",
    system_design: "Generate system design questions covering scalability, architecture, microservices, and distributed systems.",
    domain_knowledge: "Generate domain-specific knowledge questions relevant to the candidate's field.",
    case_study: "Generate case study scenarios requiring business and technical problem-solving.",
    voice: "Generate interview questions suitable for voice-based responses focusing on communication and clarity.",
    mixed: "Generate a mix of technical, HR, behavioral, and aptitude questions in a single session.",
  };

  const prompt = categoryDescriptions[category] || categoryDescriptions.aptitude;
  const questionCount = duration ? Math.min(Math.max(Math.round(duration / 6), 3), 10) : 5;

  const messages = [
    {
      role: "system",
      content: "You are an expert interview question generator. Generate questions in valid JSON array format. Each question object must have keys: question (string), options (array of 4 strings for MCQ or empty array for non-MCQ), answer (string), explanation (string). Respond with ONLY the JSON array, no other text.",
    },
    {
      role: "user",
      content: `Target Role: ${role}. ${skillText}Difficulty: ${difficulty || "Medium"}. Duration: ${duration || 30} minutes. Mode: ${mode || "Practice"}.\n\n${prompt}\n\nGenerate exactly ${questionCount} questions in JSON array format.`,
    },
  ];

  try {
    const content = await askAI(messages, { temperature: 0.7, max_tokens: 4096 });
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    throw new Error("Could not parse questions from AI response");
  } catch (err) {
    console.error("AI question generation failed:", err.message);
    return null;
  }
}

/* ─── Route handlers ─── */
async function listInterviews(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const result = await db.query(
      "SELECT id, user_id, questions, responses, score, feedback, category, difficulty, duration, mode, created_at FROM mock_interviews WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("List interviews error", error);
    res.status(500).json({ message: "Failed to list interview sessions." });
  }
}

async function startMockInterview(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { profile, category, difficulty, duration, mode } = req.body;

    let questions = await generateAIQuestions(profile || {}, category || "", difficulty, duration, mode);
    if (!questions || questions.length === 0) {
      questions = generateFallbackQuestions(profile || {}, category || "");
    }

    const result = await db.query(
      `INSERT INTO mock_interviews (user_id, questions, responses, score, feedback, category, difficulty, duration, mode, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id, user_id, questions, responses, score, feedback, category, difficulty, duration, mode, created_at`,
      [userId, JSON.stringify(questions), JSON.stringify([]), null, JSON.stringify({}), category || "", difficulty || "", duration || 0, mode || ""]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Start mock interview error", error);
    res.status(500).json({ message: "Failed to start mock interview." });
  }
}

async function getInterviewById(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;
    const result = await db.query(
      "SELECT id, user_id, questions, responses, score, feedback, category, difficulty, duration, mode, created_at FROM mock_interviews WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Mock interview session not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get interview session error", error);
    res.status(500).json({ message: "Failed to retrieve interview session." });
  }
}

async function submitInterviewResponses(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) return res.status(404).json({ message: "User not found." });

    const { id } = req.params;
    const { responses } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ message: "Responses missing or invalid." });
    }

    const nlpAnalysis = analyzeResponses(responses);

    // Keep the existing interview score behavior stable while enriching each
    // response with deterministic NLP/fluency metrics.
    const score = Math.min(100, 50 + Math.round(Math.random() * 50));
    const feedback = responses.map((response, index) => {
      const nlp = nlpAnalysis.analyzedResponses[index];
      return {
        questionIndex: index,
        comment: response.answer
          ? "Good structure. Review the fluency suggestions below to make the answer clearer."
          : "No response provided. Practice concise answers to each prompt.",
        rating: response.answer ? Math.min(5, Math.max(1, Math.round(response.answer.length / 60))) : 2,
        fluency: {
          score: nlp.fluencyScore,
          level: nlp.level,
          wordCount: nlp.wordCount,
          sentenceCount: nlp.sentenceCount,
          averageSentenceLength: nlp.averageSentenceLength,
          vocabularyRichness: nlp.vocabularyRichness,
          readabilityScore: nlp.readabilityScore,
          fillerWordCount: nlp.fillerWordCount,
          fillerWords: nlp.fillerWords,
          repetition: nlp.repetition,
          transitionUsage: nlp.transitionUsage,
          sentenceQuality: nlp.sentenceQuality,
          feedback: nlp.feedback
        }
      };
    });

    const result = await db.query(
      `UPDATE mock_interviews
       SET responses = $1,
           score = $2,
           feedback = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, questions, responses, score, feedback, category, difficulty, duration, mode, created_at`,
      [JSON.stringify(responses), score, JSON.stringify(feedback), id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Mock interview session not found." });
    }

    res.json({
      ...result.rows[0],
      fluency: {
        overallScore: nlpAnalysis.overallFluencyScore,
        answeredCount: nlpAnalysis.answeredCount,
        totalQuestions: nlpAnalysis.totalQuestions,
      },
    });
  } catch (error) {
    console.error("Submit interview responses error", error);
    res.status(500).json({ message: "Failed to submit interview responses." });
  }
}

module.exports = {
  listInterviews,
  startMockInterview,
  getInterviewById,
  submitInterviewResponses
};
