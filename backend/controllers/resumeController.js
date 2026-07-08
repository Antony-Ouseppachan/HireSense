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
    if (!userId) return res.status(404).json({ message: "User not found." });

    if (!req.file) return res.status(400).json({ message: "Resume PDF file is required." });

    const localPath = req.file.path;

    let cloudinaryUrl;
    let publicId;

    try {
      const uploadRes = await cloudinary.uploader.upload(localPath, {
        resource_type: "raw",
        use_filename: true,
        unique_filename: false,
        folder: "hiresense/resumes",
      });
      cloudinaryUrl = uploadRes.secure_url || uploadRes.url;
      publicId = uploadRes.public_id;
      try { fs.unlinkSync(localPath); } catch (e) { /* ignore */ }
    } catch (cloudErr) {
      console.error("Cloudinary upload failed:", cloudErr);
      try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch (e) { /* ignore */ }
      return res.status(500).json({ message: "Upload failed: internal error" });
    }

    const result = await db.query(
      `INSERT INTO resumes (candidate_id, file_name, cloudinary_url, cloudinary_public_id, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, cloudinary_url`,
      [userId, req.file.originalname, cloudinaryUrl, publicId, req.file.size, req.file.mimetype]
    );

    res.json({
      message: "Resume uploaded successfully.",
      profile: { resume_url: result.rows[0].cloudinary_url, resume_id: result.rows[0].id },
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
    if (!userId) return res.status(404).json({ message: "User not found." });

    const q = await db.query(
      "SELECT id, candidate_id, cloudinary_public_id FROM resumes WHERE id = $1", [resumeId]
    );

    if (q.rows.length === 0) return res.status(404).json({ message: "Resume not found." });

    const resume = q.rows[0];

    if (resume.candidate_id !== userId) return res.status(403).json({ message: "Forbidden." });

    if (resume.cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(resume.cloudinary_public_id, { resource_type: "raw" });
      } catch (cloudErr) {
        console.error("Cloudinary delete failed:", cloudErr);
        return res.status(500).json({ message: "Failed to delete resume from storage." });
      }
    }

    await db.query("DELETE FROM resumes WHERE id = $1", [resumeId]);
    return res.json({ message: "Resume deleted." });
  } catch (error) {
    console.error("Delete resume error", error);
    return res.status(500).json({ message: "Failed to delete resume." });
  }
}

module.exports = { uploadResume, deleteResume };
