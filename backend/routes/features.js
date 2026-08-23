const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const db = require("../config/database");

const router = express.Router();

router.post("/", authenticateToken, async (req, res) => {
  try {
    const { module_name, description } = req.body;
    const firebaseUid = req.user.uid;

    if (!module_name || !module_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Module name is required.",
      });
    }

    // Fetch candidate DB integer ID matching their Firebase UID
    const userRes = await db.query("SELECT id FROM users WHERE firebase_uid = $1", [firebaseUid]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User account not found in database.",
      });
    }
    const userId = userRes.rows[0].id;

    // Write request to Neon database
    const insertRes = await db.query(
      `INSERT INTO feature_requests (user_id, module_name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, module_name.trim(), (description || "").trim()]
    );

    return res.status(201).json({
      success: true,
      message: "Module request submitted successfully.",
      data: insertRes.rows[0],
    });
  } catch (error) {
    console.error("!!! Error submitting feature request:", error);
    return res.status(500).json({
      success: false,
      message: "An internal database error occurred while saving your request.",
    });
  }
});

module.exports = router;
