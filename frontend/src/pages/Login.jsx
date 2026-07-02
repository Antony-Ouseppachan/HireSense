// src/pages/Login.jsx

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { checkEmailExists } from "../services/apiService";
import { forgotPassword } from "../services/authService";
import "../styles/Auth.css";

const getAuthErrorMessage = (code) => {
  switch (code) {
    case "auth/invalid-credential":
      return "Incorrect email or password. Please verify your credentials and try again.";
    case "auth/user-not-found":
      return "No account found with this email address. Please register first.";
    case "auth/wrong-password":
      return "Incorrect password. Please verify and try again.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been deactivated. Please contact support.";
    case "auth/email-already-in-use":
      return "This email is already registered. Please login instead.";
    case "auth/weak-password":
      return "Password is too weak. It must be at least 6 characters.";
    case "auth/operation-not-allowed":
      return "Operation not permitted. Please contact administration support.";
    case "auth/too-many-requests":
      return "Too many failed sign-in attempts. Access is temporarily locked. Please try again later.";
    case "auth/popup-closed-by-user":
      return "Google sign-in window was closed. Please try again.";
    default:
      return "An unexpected authentication error occurred. Please try again.";
  }
};

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [emailExists, setEmailExists] = useState(true);
  const [emailChecked, setEmailChecked] = useState(false);
  const [emailExistsStatus, setEmailExistsStatus] = useState(null);

  // Forgot password overlay
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [fpEmail, setFpEmail] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpSuccess, setFpSuccess] = useState(false);
  const [fpError, setFpError] = useState("");

  const navigate = useNavigate();

  const handleTryAgain = () => {
    setPassword("");
    setShowAccessDenied(false);
  };

  const openForgotPassword = () => {
    setFpEmail(email); // pre-fill with whatever is in the login email field
    setFpError("");
    setFpSuccess(false);
    setShowForgotPassword(true);
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setFpEmail("");
    setFpError("");
    setFpSuccess(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!fpEmail.trim()) {
      setFpError("Please enter your email address.");
      return;
    }
    setFpError("");
    setFpLoading(true);
    try {
      await forgotPassword(fpEmail.trim());
      setFpSuccess(true);
    } catch (err) {
      const code = err.code || "";
      if (code === "auth/user-not-found") {
        setFpError("No account found with this email address.");
      } else if (code === "auth/invalid-email") {
        setFpError("Please enter a valid email address.");
      } else if (code === "auth/too-many-requests") {
        setFpError("Too many requests. Please wait a moment and try again.");
      } else {
        setFpError("Failed to send reset email. Please try again.");
      }
    } finally {
      setFpLoading(false);
    }
  };

  const handleEmailBlur = async () => {
    if (!email || !email.includes("@")) return;
    try {
      const result = await checkEmailExists(email);
      if (result.exists) {
        setEmailExistsStatus("exists");
      } else {
        setEmailExistsStatus("not-exists");
      }
      setEmailChecked(true);
    } catch (err) {
      console.error("Background email check failed:", err);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setEmailChecked(false);
    setEmailExistsStatus(null);
  };

  const {
    loginWithEmail,
    loginWithGoogle,
    isAuthenticated,
  } = useAuth();

  /* ==========================================================
     Email Login
  ========================================================== */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setErrorCode("");
    setLoading(true);

    try {
      await loginWithEmail(email, password);

      // AuthContext already syncs backend user
      navigate("/dashboard");

    } catch (err) {
      console.error(err);
      const rawCode = err.code || "auth/login-failed";
      const code = rawCode.replace("auth/", "").toUpperCase().replace(/-/g, "_");
      setErrorCode(code);
      setError(getAuthErrorMessage(rawCode));

      // Check email registration state for access denied overlay
      try {
        const checkResult = await checkEmailExists(email);
        setEmailExists(checkResult.exists);
      } catch (checkErr) {
        console.error("Failed to check email exists:", checkErr);
        setEmailExists(true); // Fallback
      }
      setShowAccessDenied(true);
    } finally {
      setLoading(false);
    }
  };

  /* ==========================================================
     Google Login
  ========================================================== */

  const handleGoogleSignIn = async () => {
    setError("");
    setErrorCode("");
    setGoogleLoading(true);

    try {
      await loginWithGoogle();

      // AuthContext handles backend sync
      navigate("/dashboard");

    } catch (err) {
      console.error(err);
      const rawCode = err.code || "auth/google-login-failed";
      const code = rawCode.replace("auth/", "").toUpperCase().replace(/-/g, "_");
      setErrorCode(code);
      setError(getAuthErrorMessage(rawCode));
    } finally {
      setGoogleLoading(false);
    }
  };

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="auth-container">
      <div className="auth-card">

        <div className="auth-header">
          <h1 className="auth-title">LOGIN</h1>
          <p className="auth-subtitle">ACCESS HIRESENSE SYSTEM</p>
        </div>


        {/* FORM */}
        <form onSubmit={handleSubmit} className="auth-form">

          <div className="input-wrapper">
            <div className="input-with-icon">
              <svg className={`input-icon ${emailExistsStatus === "exists" ? "status-exists" : ""}`} viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
                <path d="m4 8 8 6 8-6" />
              </svg>
              <input
                type="email"
                className={`auth-input ${emailExistsStatus === "exists" ? "status-exists" : ""}`}
                placeholder="Email"
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                required
                disabled={loading || googleLoading}
              />
            </div>
            {emailExistsStatus === "exists" && (
              <span className="input-helper-text success">
                Registered account found.
              </span>
            )}
          </div>

          <div className="input-with-icon">
            <svg className="input-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="9" width="16" height="11" rx="2" />
              <path d="M8 9V7a4 4 0 1 1 8 0v2" />
              <path d="M12 14v2" />
            </svg>
            <input
              type={showPassword ? "text" : "password"}
              className="auth-input password-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || googleLoading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {showPassword ? (
                  <>
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6A3 3 0 0013.4 13.4" />
                    <path d="M9.3 5.3A10.9 10.9 0 0112 5c4.2 0 7.8 2.5 9.5 6a12 12 0 01-2.8 3.8" />
                    <path d="M6.8 6.8A12.4 12.4 0 002.5 11a12.3 12.3 0 003.2 4.2" />
                  </>
                ) : (
                  <>
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>

          {/* FORGOT PASSWORD LINK */}
          <div className="forgot-password-row">
            <button
              type="button"
              className="forgot-password-btn"
              onClick={openForgotPassword}
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            className="auth-button auth-button-primary"
            disabled={loading || googleLoading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="auth-divider">OR</div>

        {/* GOOGLE LOGIN */}
        <button
          onClick={handleGoogleSignIn}
          className="auth-button auth-button-google"
          disabled={loading || googleLoading}
        >
          <svg className="google-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M21.6 12.23c0-.79-.07-1.54-.2-2.27H12v4.3h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.33 2.98-7.55Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.75-5.59-4.1H3.07v2.57A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.41 13.93A6 6 0 0 1 6.41 10.07V7.5H3.07a10 10 0 0 0 0 12.86l3.34-2.43Z" />
            <path fill="#EA4335" d="M12 6.04c1.47 0 2.8.5 3.84 1.49l2.88-2.88A9.96 9.96 0 0 0 12 2 10 10 0 0 0 3.07 7.5l3.34 2.43C7.2 7.79 9.4 6.04 12 6.04Z" />
          </svg>
          {googleLoading ? "Signing in..." : "Continue with Google"}
        </button>

        {/* REGISTER LINK */}
        <p className="auth-footer">
          Don't have an account?{" "}
          <Link to="/register" className="auth-link">Register</Link>
        </p>

        {/* FORGOT PASSWORD OVERLAY */}
        {showForgotPassword && (
          <div className="fp-overlay">
            {!fpSuccess ? (
              <>
                {/* Icon */}
                <div className="fp-icon-container">
                  <svg className="fp-key-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '36px', height: '36px' }}>
                    <circle cx="7.5" cy="15.5" r="4.5" />
                    <path d="M21 2l-9.6 9.6" />
                    <path d="M15.5 7.5l3 3L22 7l-3-3" />
                  </svg>
                </div>

                <h2 className="fp-title">RESET ACCESS</h2>
                <p className="fp-subtitle">ENTER YOUR EMAIL TO RECEIVE A SECURE RESET LINK</p>

                <form onSubmit={handleForgotPassword} className="fp-form">
                  <div className="input-with-icon">
                    <svg className="input-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
                      <path d="m4 8 8 6 8-6" />
                    </svg>
                    <input
                      type="email"
                      className="auth-input"
                      placeholder="Enter your email"
                      value={fpEmail}
                      onChange={(e) => { setFpEmail(e.target.value); setFpError(""); }}
                      required
                      disabled={fpLoading}
                      autoFocus
                    />
                  </div>

                  {fpError && (
                    <div className="fp-error">
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14, flexShrink: 0, stroke: '#f87171', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{fpError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="auth-button auth-button-primary"
                    disabled={fpLoading}
                  >
                    {fpLoading ? (
                      <><span className="fp-spinner" />Sending...</>
                    ) : (
                      "Send Reset Link"
                    )}
                  </button>
                </form>

                <button type="button" className="fp-back-btn" onClick={closeForgotPassword}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14, stroke: 'currentColor', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                    <path d="M19 12H5" /><path d="M12 5l-7 7 7 7" />
                  </svg>
                  Back to Login
                </button>
              </>
            ) : (
              /* SUCCESS STATE */
              <>
                <div className="fp-success-icon-container">
                  <svg className="fp-mail-animated" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '36px', height: '36px' }}>
                    <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
                    <path d="m4 8 8 6 8-6" />
                  </svg>
                </div>
                <h2 className="fp-title" style={{ background: 'linear-gradient(135deg,#fff 0%,#34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>LINK SENT</h2>
                <p className="fp-subtitle">CHECK YOUR INBOX &amp; SPAM FOLDER</p>
                <p className="fp-success-msg">
                  A password reset link has been sent to<br />
                  <strong style={{ color: '#38bdf8' }}>{fpEmail}</strong>.<br />
                  The link expires in <strong>1 hour</strong>.
                </p>
                <button type="button" className="auth-button auth-button-primary" onClick={closeForgotPassword}>
                  Back to Login
                </button>
              </>
            )}
          </div>
        )}
        {/* ACCESS DENIED OVERLAY */}
        {showAccessDenied && (
          <div className="access-denied-overlay">
            <div className="lock-icon-container">
              <svg className="lock-animated" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '40px', height: '40px' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="denied-title">ACCESS DENIED</h2>
            <p className="denied-message">
              {emailExists ? (
                "Incorrect password. Please verify your credentials and try again."
              ) : (
                "This email address is not registered on HireSense. Would you like to create a new account?"
              )}
            </p>
            <div className="denied-actions">
              {emailExists ? (
                <>
                  <button type="button" className="auth-button auth-button-primary" onClick={handleTryAgain}>
                    Try Again
                  </button>
                  <button type="button" className="auth-button auth-button-google" onClick={openForgotPassword}>
                    Forgot Password?
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="auth-button auth-button-primary" onClick={() => navigate("/register")}>
                    Register Account
                  </button>
                  <button type="button" className="auth-button auth-button-google" onClick={handleTryAgain}>
                    Try Another Email
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Login;