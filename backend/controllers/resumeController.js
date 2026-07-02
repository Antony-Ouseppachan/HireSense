const db = require("../config/database");

async function uploadResume(req, res) {
  try {
    const userId = parseInt(req.body.userId, 10);
    if (!userId) {
      return res.status(400).json({ message: "userId is required in request body." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Resume PDF file is required." });
    }

    const resumeUrl = `/uploads/${req.file.filename}`;

    const result = await db.query(
      `INSERT INTO profiles (user_id, education, skills, experience, resume_url)
       VALUES ($1, '', '', '', $2)
       ON CONFLICT (user_id)
       DO UPDATE SET resume_url = $2
       RETURNING id, user_id, education, skills, experience, resume_url`,
      [userId, resumeUrl]
    );

    res.json({
      message: "Resume uploaded successfully.",
      profile: result.rows[0]
    });
  } catch (error) {
    console.error("Upload resume error", error);
    res.status(500).json({ message: "Failed to upload resume." });
  }
}

module.exports = {
  uploadResume
};
