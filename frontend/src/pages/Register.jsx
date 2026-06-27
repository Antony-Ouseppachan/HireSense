// src/pages/Register.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Auth.css";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const navigate = useNavigate();
  const { signupWithEmail, loginWithGoogle } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setErrorCode("");

    if (password !== confirmPassword) {
      setErrorCode("VALIDATION_ERROR");
      setError("Passphrases do not match. Please re-enter.");
      return;
    }

    if (password.length < 6) {
      setErrorCode("VALIDATION_ERROR");
      setError("Passphrase must contain at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await signupWithEmail(email, password);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      const code = err.code ? err.code.replace("auth/", "").toUpperCase().replace(/-/g, "_") : "PROVISION_FAILED";
      setErrorCode(code);
      setError(err.message || "Registration failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setErrorCode("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      const code = err.code ? err.code.replace("auth/", "").toUpperCase().replace(/-/g, "_") : "OAUTH_FAILED";
      setErrorCode(code);
      setError(err.message || "Google OAuth authentication failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-scanner" />
        
        <div className="auth-header">
          <div className="auth-icon-wrapper">
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="16" y1="11" x2="22" y2="11" />
            </svg>
          </div>
          <h1 className="auth-title">NODE REGISTRATION</h1>
          <p className="auth-subtitle">PROVISION NEW HIRESENSE INTELLIGENCE AGENT</p>
        </div>

        {error && (
          <div className="auth-error-banner">
            <svg className="auth-error-icon" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="auth-error-details">
              <span className="auth-error-code">ERROR: [{errorCode}]</span>
              <span className="auth-error-msg">{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-wrapper">
            <label htmlFor="email-input">NODE SYSTEM IDENTITY (EMAIL)</label>
            <div className="input-group">
              <input
                id="email-input"
                type="email"
                className="auth-input"
                placeholder="identity@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || googleLoading}
              />
              <svg className="input-icon" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
          </div>

          <div className="input-wrapper">
            <label htmlFor="password-input">NODE ACCESS PASSPHRASE</label>
            <div className="input-group">
              <input
                id="password-input"
                type={showPassword ? "text" : "password"}
                className="auth-input password-input"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || googleLoading}
              />
              <svg className="input-icon" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="input-wrapper">
            <label htmlFor="confirm-password-input">CONFIRM ACCESS PASSPHRASE</label>
            <div className="input-group">
              <input
                id="confirm-password-input"
                type={showConfirmPassword ? "text" : "password"}
                className="auth-input password-input"
                placeholder="Repeat passphrase"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading || googleLoading}
              />
              <svg className="input-icon" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex="-1"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="auth-button auth-button-primary btn-primary"
            disabled={loading || googleLoading}
          >
            {loading ? (
              <span className="terminal-status">
                INITIALIZING CONFIG
                <span className="loading-dots">
                  <span></span><span></span><span></span>
                </span>
              </span>
            ) : (
              "PROVISION PROFILE REGISTER"
            )}
          </button>
        </form>

        <div className="auth-divider">OR AUTOMATED OAUTH</div>

        <button 
          type="button" 
          className="auth-button auth-button-google btn-secondary"
          onClick={handleGoogleSignIn}
          disabled={loading || googleLoading}
        >
          {googleLoading ? (
            <span className="terminal-status">
              ESTABLISHING OAUTH
              <span className="loading-dots">
                <span></span><span></span><span></span>
              </span>
            </span>
          ) : (
            <>
              <svg className="google-icon-svg" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.67 0 3.2.58 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.89 3.02C6.22 7.71 8.89 5.04 12 5.04z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.28 1.48-1.12 2.74-2.38 3.58l3.7 2.87c2.16-1.99 3.41-4.91 3.41-8.6z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.58c-.24-.71-.38-1.47-.38-2.26s.14-1.55.38-2.26L1.39 7.04C.5 8.82 0 10.83 0 12.92s.5 4.1 1.39 5.88l3.89-3.22z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.97-1.08 7.96-2.92l-3.7-2.87c-1.03.69-2.35 1.11-4.26 1.11-3.11 0-5.78-2.67-6.72-5.54l-3.89 3.02C3.37 20.33 7.35 23 12 23z"
                />
              </svg>
              <span>REGISTER WITH GOOGLE</span>
            </>
          )}
        </button>

        <div className="auth-footer">
          <span>ALREADY REGULATED AGENT?</span>
          <Link to="/login" className="auth-link">LOGIN ACCESS</Link>
        </div>
      </div>
    </div>
  );
}

export default Register;
