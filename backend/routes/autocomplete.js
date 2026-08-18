const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { searchRoles, searchSkills, searchDegrees, searchSpecializations, searchInstitutions } = require("../controllers/autocompleteController");

const router = express.Router();

router.get("/roles", authenticateToken, searchRoles);
router.get("/skills", authenticateToken, searchSkills);
router.get("/degrees", authenticateToken, searchDegrees);
router.get("/specializations", authenticateToken, searchSpecializations);
router.get("/institutions", authenticateToken, searchInstitutions);

module.exports = router;
