const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  generate,
  getStatus,
  getAssessment,
  start,
  begin,
  getQuestion,
  saveAnswer,
  logMalpractice,
  complete,
  cancel,
  reattempt,
  getHistory,
  getResult,
  getRemarks,
  getRemarkDetail,
  getReview,
} = require("../controllers/aptitudeController");

// ─── Assessment Lifecycle ──────────────────────────────────────────────────
router.post("/generate",            authenticateToken, generate);
router.get("/assessment/:id/status", authenticateToken, getStatus);
router.get("/assessment/:id",        authenticateToken, getAssessment);
router.post("/assessment/:id/start", authenticateToken, start);
router.post("/assessment/:id/begin", authenticateToken, begin);
router.get("/assessment/:id/question/:number", authenticateToken, getQuestion);
router.post("/assessment/:id/answer", authenticateToken, saveAnswer);
router.post("/assessment/:id/malpractice", authenticateToken, logMalpractice);
router.post("/assessment/:id/complete", authenticateToken, complete);
router.post("/assessment/:id/cancel",  authenticateToken, cancel);
router.post("/assessment/:id/reattempt", authenticateToken, reattempt);
router.get("/assessment/:id/review",   authenticateToken, getReview);

// ─── Legacy / Existing ─────────────────────────────────────────────────────
router.get("/history",              authenticateToken, getHistory);
router.get("/results/:id",          authenticateToken, getResult);
router.get("/remarks",              authenticateToken, getRemarks);
router.get("/remarks/:id",          authenticateToken, getRemarkDetail);

module.exports = router;
