const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const axios = require("axios");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const PYTHON_API_BASE = process.env.PYTHON_API_BASE || "http://localhost:8000";

async function sendOtp(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    // Call Python backend to send OTP
    try {
      await axios.post(`${PYTHON_API_BASE}/auth/send-otp`, { email });
      res.json({ success: true, message: "OTP sent to your email." });
    } catch (pythonError) {
      console.error("Python OTP error:", pythonError.response?.data || pythonError.message);
      res.status(500).json({ message: "Failed to send OTP. Please check your email configuration." });
    }
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ message: "Failed to send OTP." });
  }
}

async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    // Call Python backend to verify OTP
    try {
      const otpResponse = await axios.post(`${PYTHON_API_BASE}/auth/verify-otp`, { email, otp });
      if (!otpResponse.data.verified) {
        return res.status(401).json({ message: "Invalid OTP." });
      }

      // Check if user exists
      const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      let user = userResult.rows[0];
      let isNewUser = false;

      if (!user) {
        // Create new user
        const result = await pool.query(
          "INSERT INTO users (name, email, role, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, name, email, role, is_profile_complete",
          [email.split("@")[0], email, "candidate"]
        );
        user = result.rows[0];
        isNewUser = true;
      }

      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          is_profile_complete: user.is_profile_complete
        },
        status: isNewUser ? "new_user" : "existing_user"
      });
    } catch (pythonError) {
      console.error("Python verify OTP error:", pythonError.response?.data || pythonError.message);
      res.status(401).json({ message: "Invalid OTP or verification failed." });
    }
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ message: "Failed to verify OTP." });
  }
}

async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required." });
    }

    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password, role, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, name, email, role",
      [name, email, hashedPassword, role]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });

    res.status(201).json({ user, token });
  } catch (error) {
    console.error("Register error", error);
    res.status(500).json({ message: "Failed to register user." });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const result = await pool.query("SELECT id, name, email, password, role FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
    delete user.password;

    res.json({ user, token });
  } catch (error) {
    console.error("Login error", error);
    res.status(500).json({ message: "Failed to login." });
  }
}

module.exports = {
  register,
  login,
  sendOtp,
  verifyOtp
};
