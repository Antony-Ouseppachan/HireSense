const { analyzeText, analyzeResponses } = require("../services/nlpService");

function analyzeNLP(req, res) {
  try {
    const { text, responses } = req.body || {};

    if (typeof text === "string") {
      if (!text.trim()) {
        return res.status(400).json({ success: false, message: "text is required." });
      }
      return res.json({ success: true, ...analyzeText(text) });
    }

    if (Array.isArray(responses)) {
      return res.json({ success: true, ...analyzeResponses(responses) });
    }

    return res.status(400).json({
      success: false,
      message: "Provide either a text string or a responses array."
    });
  } catch (error) {
    console.error("NLP analysis error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to analyze text."
    });
  }
}

module.exports = { analyzeNLP };
