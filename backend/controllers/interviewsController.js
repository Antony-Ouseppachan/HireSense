const db = require("../config/database");

function generateQuestionsFromProfile(profile) {
  const baseSkills = profile.skills ? profile.skills.split(",").map((skill) => skill.trim()) : [];
  const targetRole = profile.role || "candidate";

  const questions = [
    { question: `Tell me about a project where you used ${baseSkills[0] || "your primary skill"}.` },
    { question: `How did you prepare for the role of ${targetRole}?` },
    { question: "Describe a challenge you faced on a technical task and how you solved it." },
    { question: "What steps do you take to stay calm under interview pressure?" },
    { question: "How would you explain one of your recent projects to a non-technical interviewer?" }
  ];

  return questions;
}

async function listInterviews(req, res) {
  try {
    const userId = req.user.userId;
    const result = await db.query(
      "SELECT id, user_id, questions, responses, score, feedback, created_at FROM mock_interviews WHERE user_id = $1 ORDER BY created_at DESC",
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
    const userId = req.user.userId;
    const { profile } = req.body;
    if (!profile) {
      return res.status(400).json({ message: "Profile data is required to generate interview questions." });
    }

    const questions = generateQuestionsFromProfile(profile);
    const result = await db.query(
      `INSERT INTO mock_interviews (user_id, questions, responses, score, feedback, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, user_id, questions, responses, score, feedback, created_at`,
      [userId, JSON.stringify(questions), JSON.stringify([]), null, JSON.stringify({}),]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Start mock interview error", error);
    res.status(500).json({ message: "Failed to start mock interview." });
  }
}

async function getInterviewById(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const result = await db.query(
      "SELECT id, user_id, questions, responses, score, feedback, created_at FROM mock_interviews WHERE id = $1 AND user_id = $2",
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
    const userId = req.user.userId;
    const { id } = req.params;
    const { responses } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ message: "Responses missing or invalid." });
    }

    const score = Math.min(100, 50 + Math.round(Math.random() * 50));
    const feedback = responses.map((response, index) => ({
      questionIndex: index,
      comment: response.answer
        ? "Good structure. Add a clearer conclusion next time."
        : "No response provided. Practice concise answers to each prompt.",
      rating: response.answer ? Math.min(5, Math.max(1, Math.round(response.answer.length / 60))) : 2
    }));

    const result = await db.query(
      `UPDATE mock_interviews
       SET responses = $1,
           score = $2,
           feedback = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, questions, responses, score, feedback, created_at`,
      [JSON.stringify(responses), score, JSON.stringify(feedback), id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Mock interview session not found." });
    }

    res.json(result.rows[0]);
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
