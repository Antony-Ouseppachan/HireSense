const express = require("express");
const { analyzeNLP } = require("../controllers/nlpController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/analyze", authenticateToken, analyzeNLP);

module.exports = router;
