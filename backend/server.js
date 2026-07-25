const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const { testDbConnection } = require("./config/database");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const interviewsRoutes = require("./routes/interviews");
const aiRoutes = require("./routes/ai");
const resumeRoutes = require("./routes/resume");
const autocompleteRoutes = require("./routes/autocomplete");
const aptitudeRoutes = require("./routes/aptitude");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads folder if it doesn't exist
const uploadDir = process.env.RESUME_UPLOAD_DIR || "uploads/resumes";
const absoluteUploadDir = path.resolve(__dirname, uploadDir);

if (!fs.existsSync(absoluteUploadDir)) {
  fs.mkdirSync(absoluteUploadDir, { recursive: true });
}

// Serve uploaded files
app.use("/uploads", express.static(absoluteUploadDir));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/interviews", interviewsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/autocomplete", autocompleteRoutes);
app.use("/api/aptitude", aptitudeRoutes);

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await testDbConnection();

    app.listen(PORT, () => {
      console.log(`HireSense backend is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("!!!Failed to start server:", error);
    process.exit(1);
  }
}

startServer();