const express = require("express");
const {
  analyzeProfile,
  evaluateInterview
} = require("../controllers/aiController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/analyze-profile", authenticateToken, analyzeProfile);
router.post("/evaluate-interview", authenticateToken, evaluateInterview);
router.post("/analyze-resume", authenticateToken, analyzeProfile);
router.post("/match-candidate", authenticateToken, evaluateInterview);

module.exports = router;
