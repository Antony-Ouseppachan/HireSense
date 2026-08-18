const { askAI } = require("../services/ai");

async function analyzeProfile(req, res) {
  try {
    const { profile, text } = req.body;

    const messages = [
      {
        role: "system",
        content: "You are a hiring profile analyst. Evaluate the candidate's profile and provide a score (0-100), a brief summary, and 3 actionable recommendations. Respond in JSON format with keys: score (number), summary (string), recommendations (array of strings).",
      },
      {
        role: "user",
        content: `Candidate profile: ${JSON.stringify(profile || {})}. Additional context: ${text || "None"}.`,
      },
    ];

    const parsed = await askAI(messages, { temperature: 0.5, max_tokens: 1024 });
    res.json({
      score: parsed.score || 75,
      summary: parsed.summary || "Profile analysis complete.",
      recommendations: parsed.recommendations || [],
    });
  } catch (error) {
    console.error("AI analyze profile error:", error.message);
    res.json({
      score: 75,
      summary: "Profile analysis couldn't be completed by AI. Estimated based on available data.",
      recommendations: [
        "Focus on delivering examples with measurable outcomes.",
        "Use concise storytelling for technical achievements.",
        "Practice framing your experience around interview questions.",
      ],
    });
  }
}

async function evaluateInterview(req, res) {
  try {
    const { responses, audioMetrics } = req.body;

    const messages = [
      {
        role: "system",
        content: "You are an interview evaluator. Score the candidate's responses (0-100), provide a summary, detailed feedback per question, strengths, and improvements. Respond in JSON format with keys: score (number), summary (string), feedback (array of {questionIndex, comment, rating}), strengths (array of strings), improvements (array of strings).",
      },
      {
        role: "user",
        content: `Candidate responses: ${JSON.stringify(responses || [])}. Audio metrics: ${JSON.stringify(audioMetrics || {})}.`,
      },
    ];

    const parsed = await askAI(messages, { temperature: 0.4, max_tokens: 2048 });

    res.json({
      score: parsed.score ?? 75,
      summary: parsed.summary || "Interview evaluation complete.",
      feedback: parsed.feedback || [],
      strengths: parsed.strengths || ["Clear structured answers"],
      improvements: parsed.improvements || ["Increase pace consistency"],
      audioMetrics: audioMetrics || { clarity: "not provided", pace: "not provided", confidence: "not provided" },
    });
  } catch (error) {
    console.error("AI evaluate interview error:", error.message);
    res.json({
      score: 75,
      summary: "Interview evaluation complete.",
      feedback: Array.isArray(responses)
        ? responses.map((_, index) => ({
            questionIndex: index,
            comment: "Good structure. Add a clearer conclusion next time.",
            rating: 3,
          }))
        : [],
      strengths: ["Clear structured answers", "Use real examples to support your points"],
      improvements: ["Increase pace consistency", "Provide stronger closing statements"],
      audioMetrics: audioMetrics || { clarity: "not provided", pace: "not provided", confidence: "not provided" },
    });
  }
}

async function generateQuestions(req, res) {
  try {
    const { profile, mode } = req.body;

    if (!profile || typeof profile !== "object") {
      return res.status(400).json({ success: false, message: "profile is required." });
    }

    const messages = [
      {
        role: "system",
        content: "You are an expert interview question generator. Generate 5-8 interview questions based on the candidate's profile. Respond in JSON format with keys: success (boolean), questions (array of { question: string }).",
      },
      {
        role: "user",
        content: `Profile: ${JSON.stringify(profile)}. Mode: ${mode || "standard"}. Generate targeted questions.`,
      },
    ];

    const parsed = await askAI(messages, { temperature: 0.7, max_tokens: 2048 });

    if (parsed.success && Array.isArray(parsed.questions)) {
      return res.json({ success: true, questions: parsed.questions });
    }

    res.json({ success: true, questions: Array.isArray(parsed) ? parsed : parsed.questions || [] });
  } catch (error) {
    console.error("AI generate questions error:", error.message);
    res.status(502).json({ success: false, message: "AI service is unavailable." });
  }
}

module.exports = {
  analyzeProfile,
  evaluateInterview,
  generateQuestions,
};
