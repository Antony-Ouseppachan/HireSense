const express = require("express");
const {
  getMyProfile,
  saveProfile
} = require("../controllers/profileController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, getMyProfile);
router.post("/", authenticateToken, saveProfile);

module.exports = router;
