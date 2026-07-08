const db = require("../config/database");
const path = require("path");
const fs = require("fs");
const cloudinary = require("../config/cloudinary");

async function resolveUserId(firebaseUid) {
  const result = await db.query("SELECT id FROM users WHERE firebase_uid = $1", [firebaseUid]);
  return result.rows.length ? result.rows[0].id : null;
}

async function uploadResume(req, res) {
  try {
    const userId = await resolveUserId(req.user.uid);
    if (!userId) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Resume PDF file is required." });
    }

    const localPath = path.join(process.cwd(), req.file.path || req.file.filename);

    // Try uploading to Cloudinary (use raw resource_type for PDFs). If it fails,
    // fall back to storing locally and record a local URL.
    let fileUrl;
    let fileId;
    let storageProvider = "local";

    try {
      const uploadRes = await cloudinary.uploader.upload(localPath, {
        resource_type: "auto",
        use_filename: true,
        unique_filename: false,
      });

      fileUrl = uploadRes.secure_url || uploadRes.url;
      fileId = uploadRes.public_id;
      storageProvider = "cloudinary";

      // remove local file after successful cloud upload
      try {
        fs.unlinkSync(localPath);
      } catch (e) {
        // ignore cleanup errors
      }
    } catch (cloudErr) {
      console.error("Cloudinary upload failed:", cloudErr);
      // remove any local file we created during upload
      try {
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      } catch (e) {
        console.error("Failed to remove local file after Cloudinary failure:", e);
      }

      return res.status(500).json({ message: "Upload failed: internal error" });
    }

    const result = await db.query(
      `INSERT INTO resumes
         (user_id, file_id, file_url, storage_provider, original_filename, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $1)
       RETURNING id, user_id, file_url`,
      [
        userId,
        fileId,
        fileUrl,
        storageProvider,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
      ]
    );

    res.json({
      message: "Resume uploaded successfully.",
      profile: { resume_url: result.rows[0].file_url },
    });
  } catch (error) {
    console.error("Upload resume error", error);
    res.status(500).json({ message: "Failed to upload resume." });
  }
}

async function deleteResume(req, res) {
  try {
    const resumeId = parseInt(req.params.id, 10);
    if (!resumeId) return res.status(400).json({ message: "Invalid resume id." });

    const userId = await resolveUserId(req.user.uid);
    if (!userId) {
      return res.status(404).json({ message: "User not found." });
    }

    const q = await db.query(
      `SELECT id, user_id, file_id, storage_provider, uploaded_by FROM resumes WHERE id = $1`,
      [resumeId]
    );

    if (q.rows.length === 0) {
      return res.status(404).json({ message: "Resume not found." });
    }

    const resume = q.rows[0];

    // Only the owner/uploader may delete the resume
    if (resume.user_id !== userId && resume.uploaded_by !== userId) {
      return res.status(403).json({ message: "Forbidden." });
    }

    // If stored in Cloudinary, remove the remote file first
    if (resume.storage_provider === "cloudinary") {
      try {
        await cloudinary.uploader.destroy(resume.file_id, { resource_type: "raw" });
      } catch (cloudErr) {
        console.error("Cloudinary delete failed for resume id", resumeId, "file_id", resume.file_id, cloudErr);
        return res.status(500).json({ message: "Failed to delete resume from storage." });
      }
    }

    // Remove DB record
    await db.query(`DELETE FROM resumes WHERE id = $1`, [resumeId]);

    return res.json({ message: "Resume deleted." });
  } catch (error) {
    console.error("Delete resume error", error);
    return res.status(500).json({ message: "Failed to delete resume." });
  }
}

module.exports = {
  uploadResume,
  deleteResume,
};
