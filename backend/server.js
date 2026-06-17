const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const { testDbConnection } = require("./db");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const interviewsRoutes = require("./routes/interviews");
const aiRoutes = require("./routes/ai");
const resumeRoutes = require("./routes/resume");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = process.env.RESUME_UPLOAD_DIR || "uploads/resumes";
const absoluteUploadDir = path.resolve(__dirname, uploadDir);
if (!fs.existsSync(absoluteUploadDir)) {
  fs.mkdirSync(absoluteUploadDir, { recursive: true });
}

app.use("/uploads", express.static(absoluteUploadDir));

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/interviews", interviewsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/resume", resumeRoutes);

const port = process.env.PORT || 5000;

async function startServer() {
  try {
    await testDbConnection();

    app.listen(port, () => {
      console.log(`HireSense backend is running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();
