const express = require("express");
const {
  listInterviews,
  startMockInterview,
  getInterviewById,
  submitInterviewResponses
} = require("../controllers/interviewsController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, listInterviews);
router.get("/:id", authenticateToken, getInterviewById);
router.post("/start", authenticateToken, startMockInterview);
router.post("/submit/:id", authenticateToken, submitInterviewResponses);

module.exports = router;
