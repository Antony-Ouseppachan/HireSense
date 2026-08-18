const express = require("express");
const router = express.Router();

const {
    login,
    getCurrentUser,
    checkEmail,
} = require("../controllers/authController");

const {
    authenticateUser,
} = require("../middleware/auth");

/**
 * @route   POST /api/auth/login
 * @desc    Login/Register user using Firebase Authentication
 * @access  Private
 */
router.post(
    "/login",
    authenticateUser,
    login
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get(
    "/me",
    authenticateUser,
    getCurrentUser
);

/**
 * @route   GET /api/auth/check-email
 * @desc    Check if email exists in database
 * @access  Public
 */
router.get(
    "/check-email",
    checkEmail
);

module.exports = router;