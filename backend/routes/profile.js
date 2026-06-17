const express = require("express");
const {
  getProfileByUserId,
  createProfile,
  updateProfileById
} = require("../controllers/profileController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/:userId", authenticateToken, getProfileByUserId);
router.post("/", authenticateToken, createProfile);
router.put("/:id", authenticateToken, updateProfileById);

module.exports = router;
