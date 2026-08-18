const express = require("express");
const {
  getMyProfile, saveProfile,
  addEducation, updateEducation, deleteEducation,
  addSkill, removeSkill,
  addProject, updateProject, deleteProject,
  saveLearningGoals, saveWeakAreas,
} = require("../controllers/profileController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, getMyProfile);
router.post("/", authenticateToken, saveProfile);

router.post("/education", authenticateToken, addEducation);
router.put("/education/:id", authenticateToken, updateEducation);
router.delete("/education/:id", authenticateToken, deleteEducation);

router.post("/skills", authenticateToken, addSkill);
router.delete("/skills/:skill_id", authenticateToken, removeSkill);

router.post("/projects", authenticateToken, addProject);
router.put("/projects/:id", authenticateToken, updateProject);
router.delete("/projects/:id", authenticateToken, deleteProject);

router.post("/learning-goals", authenticateToken, saveLearningGoals);
router.post("/weak-areas", authenticateToken, saveWeakAreas);

module.exports = router;
