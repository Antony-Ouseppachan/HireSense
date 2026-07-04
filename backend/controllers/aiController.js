const axios = require("axios");
const { baseUrl } = require("../config/ai");

const pythonClient = axios.create({
  baseURL: baseUrl,
  timeout: 65000,
});

function buildProfileText(profile, text) {
  const fields = [];
  if (profile) {
    if (profile.education) fields.push(profile.education);
    if (profile.skills) fields.push(profile.skills);
    if (profile.experience) fields.push(profile.experience);
  }
  if (text) fields.push(text);
  return fields.join(" ");
}

async function analyzeProfile(req, res) {
  try {
    const { profile, text } = req.body;
    const content = buildProfileText(profile, text);
    const score = Math.round(55 + Math.min(45, content.length / 10));
    res.json({
      score,
      summary: "Profile analysis complete. Your experience appears well-structured for mock interviews.",
      recommendations: [
        "Focus on delivering examples with measurable outcomes.",
        "Use concise storytelling for technical achievements.",
        "Practice framing your experience around interview questions."
      ]
    });
  } catch (error) {
    console.error("AI analyze profile error", error);
    res.status(500).json({ message: "Failed to analyze profile." });
  }
}

async function evaluateInterview(req, res) {
  try {
    const { responses, audioMetrics } = req.body;
    const hasResponses = Array.isArray(responses) && responses.length > 0;
    const score = hasResponses
      ? Math.min(100, 50 + Math.round(responses.reduce((sum, response) => sum + Math.min(20, response.answer?.length || 0) / 5, 0)))
      : 55;

    const feedback = hasResponses
      ? responses.map((response, index) => ({
          questionIndex: index,
          comment: response.answer
            ? "Good structure. Add a clearer conclusion next time."
            : "No response provided. Practice concise answers to each prompt.",
          rating: response.answer ? Math.min(5, Math.max(1, Math.round(response.answer.length / 60))) : 2
        }))
      : [];

    const audioSummary = audioMetrics || {
      clarity: "not provided",
      pace: "not provided",
      confidence: "not provided"
    };

    res.json({
      score,
      summary: "Interview evaluation complete.",
      feedback,
      strengths: ["Clear structured answers", "Use real examples to support your points"],
      improvements: ["Increase pace consistency", "Provide stronger closing statements"],
      audioMetrics: audioSummary
    });
  } catch (error) {
    console.error("AI evaluate interview error", error);
    res.status(500).json({ message: "Failed to evaluate interview." });
  }
}

/**
 * Calls the Python AI service (/ai/questions), which in turn calls the
 * AI Gateway. Node never talks to the gateway or Ollama directly.
 */
async function generateQuestions(req, res) {
  try {
    const { profile, mode } = req.body;

    if (!profile || typeof profile !== "object") {
      return res.status(400).json({ success: false, message: "profile is required." });
    }

    const { data } = await pythonClient.post("/ai/questions", profile, {
      params: mode ? { mode } : undefined,
    });

    if (!data.success) {
      return res.status(502).json({
        success: false,
        message: data.error || "Failed to generate questions.",
      });
    }

    res.json({ success: true, questions: data.questions });
  } catch (error) {
    console.error("AI generate questions error:", error.message);
    res.status(502).json({ success: false, message: "AI service is unavailable." });
  }
}

module.exports = {
  analyzeProfile,
  evaluateInterview,
  generateQuestions
};