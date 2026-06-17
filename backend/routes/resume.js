const express = require("express");
const multer = require("multer");
const path = require("path");
const { uploadResume } = require("../controllers/resumeController");
const { authenticateToken } = require("../middleware/authMiddleware");

const uploadDir = process.env.RESUME_UPLOAD_DIR || "uploads/resumes";
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const uniqueName = `${timestamp}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF files are allowed"), false);
    } else {
      cb(null, true);
    }
  }
});

const router = express.Router();

router.post("/upload", authenticateToken, upload.single("resume"), uploadResume);

module.exports = router;
