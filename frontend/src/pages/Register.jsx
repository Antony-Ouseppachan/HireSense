// src/pages/Register.jsx

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { checkEmailExists } from "../services/apiService";
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

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [terminalStatus, setTerminalStatus] = useState("");
  const [emailExistsStatus, setEmailExistsStatus] = useState(null);
  const [passwordFocused, setPasswordFocused] = useState(false);

  /* ---------- Password policy rules ---------- */
  const passwordRules = [
    { id: "length",    label: "At least 8 characters",          test: (p) => p.length >= 8 },
    { id: "upper",    label: "One uppercase letter (A–Z)",      test: (p) => /[A-Z]/.test(p) },
    { id: "lower",    label: "One lowercase letter (a–z)",      test: (p) => /[a-z]/.test(p) },
    { id: "number",   label: "One number (0–9)",                test: (p) => /[0-9]/.test(p) },
    { id: "special",  label: "One special character (!@#$…)",   test: (p) => /[^A-Za-z0-9]/.test(p) },
  ];

  const ruleResults  = passwordRules.map((r) => ({ ...r, passed: r.test(password) }));
  const strengthScore = ruleResults.filter((r) => r.passed).length; // 0–5
  const allRulesPassed = strengthScore === passwordRules.length;

  const navigate = useNavigate();

  const { signupWithEmail, loginWithGoogle } = useAuth();

  /* Email blur check */
  const handleEmailBlur = async () => {
    if (!email || !email.includes("@")) return;
    try {
      const result = await checkEmailExists(email);
      setEmailExistsStatus(result.exists ? "exists" : "new");
    } catch (err) {
      console.error("Email check failed:", err);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setEmailExistsStatus(null);
  };

  /* ==========================================================
     Email Registration
  ========================================================== */

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setErrorCode("");

    if (password !== confirmPassword) {
      setErrorCode("PASSWORD_MISMATCH");
      setError("Passwords do not match. Please verify your passwords.");
      return;
    }

    if (!allRulesPassed) {
      setErrorCode("WEAK_PASSWORD");
      setError("Password does not meet the security requirements. Please check the policy below.");
      setPasswordFocused(true);
      return;
    }

    try {
      setLoading(true);
      await signupWithEmail(email, password);

      // Trigger the premium success overlay!
      setShowSuccess(true);

      const statuses = [
        "GENERATING ACCESS TOKENS...",
        "ESTABLISHING DATABASE HANDSHAKE...",
        "PROVISIONING SYSTEM ACCESS...",
        "ACCESS GRANTED. REDIRECTING..."
      ];

      let delay = 0;
      statuses.forEach((status, index) => {
        setTimeout(() => {
          setTerminalStatus(status);
          if (index === statuses.length - 1) {
            setTimeout(() => {
              navigate("/dashboard");
            }, 450);
          }
        }, delay);
        delay += 350; // 0.35 seconds per step
      });

    } catch (err) {
      console.error(err);
      const rawCode = err.code || "auth/registration-failed";
      const code = rawCode.replace("auth/", "").toUpperCase().replace(/-/g, "_");
      setErrorCode(code);
      setError(getAuthErrorMessage(rawCode));
    } finally {
      setLoading(false);
    }
  };

  /* ==========================================================
     Google Signup/Login
  ========================================================== */

  const handleGoogleSignIn = async () => {
    setError("");
    setErrorCode("");
    try {
      setLoading(true);
      await loginWithGoogle();

      // Trigger the premium success overlay!
      setShowSuccess(true);

      const statuses = [
        "VERIFYING GOOGLE AUTH TOKEN...",
        "ESTABLISHING DATABASE HANDSHAKE...",
        "PROVISIONING SYSTEM ACCESS...",
        "ACCESS GRANTED. REDIRECTING..."
      ];

      let delay = 0;
      statuses.forEach((status, index) => {
        setTimeout(() => {
          setTerminalStatus(status);
          if (index === statuses.length - 1) {
            setTimeout(() => {
              navigate("/dashboard");
            }, 450);
          }
        }, delay);
        delay += 350; // 0.35 seconds per step
      });

    } catch (err) {
      console.error(err);
      const rawCode = err.code || "auth/google-sign-in-failed";
      const code = rawCode.replace("auth/", "").toUpperCase().replace(/-/g, "_");
      setErrorCode(code);
      setError(getAuthErrorMessage(rawCode));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">

        <div className="auth-header">
          <h1 className="auth-title">CREATE ACCOUNT</h1>
          <p className="auth-subtitle">JOIN THE HIRESENSE PLATFORM</p>
        </div>

        {error && (
          <div className="auth-error-banner">
            <svg className="auth-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="auth-error-details">
              <span className="auth-error-code">ERROR [{errorCode || "REGISTRATION_FAILED"}]</span>
              <p className="auth-error-msg">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">

          <div className="input-wrapper">
            <div className="input-with-icon">
              <svg
                className={`input-icon ${
                  emailExistsStatus === "exists"
                    ? "status-not-exists"
                    : emailExistsStatus === "new"
                    ? "status-exists"
                    : ""
                }`}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
                <path d="m4 8 8 6 8-6" />
              </svg>
              <input
                type="email"
                className={`auth-input ${
                  emailExistsStatus === "exists"
                    ? "status-not-exists"
                    : emailExistsStatus === "new"
                    ? "status-exists"
                    : ""
                }`}
                placeholder="Email"
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                required
                disabled={loading}
              />
            </div>
            {emailExistsStatus === "exists" && (
              <span className="input-helper-text warning">
                <svg className="helper-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Email already registered.&nbsp;<Link to="/login" className="auth-link" style={{ marginLeft: 0 }}>Login instead</Link>
              </span>
            )}
            {emailExistsStatus === "new" && (
              <span className="input-helper-text success">
                <svg className="helper-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Email available — ready to register
              </span>
            )}
          </div>

          <div className="input-wrapper">
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
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                required
                disabled={loading}
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

            {/* PASSWORD POLICY PANEL */}
            {(passwordFocused || (password.length > 0 && !allRulesPassed)) && (
              <div className="password-policy-panel">
                {/* Strength meter */}
                <div className="policy-strength-header">
                  <span className="policy-label">PASSWORD STRENGTH</span>
                  <span className={`policy-strength-tag strength-${strengthScore}`}>
                    {["NONE", "WEAK", "FAIR", "MODERATE", "STRONG", "SECURE"][strengthScore]}
                  </span>
                </div>
                <div className="policy-strength-bar">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`policy-strength-segment ${i < strengthScore ? `active-${strengthScore}` : ""}`}
                    />
                  ))}
                </div>

                {/* Rule checklist */}
                <ul className="policy-rules-list">
                  {ruleResults.map((rule) => (
                    <li key={rule.id} className={`policy-rule ${rule.passed ? "rule-passed" : "rule-failed"}`}>
                      <svg className="rule-icon" viewBox="0 0 24 24" aria-hidden="true">
                        {rule.passed ? (
                          <polyline points="20 6 9 17 4 12" />
                        ) : (
                          <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                        )}
                      </svg>
                      <span>{rule.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="input-with-icon">
            <svg className="input-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="9" width="16" height="11" rx="2" />
              <path d="M8 9V7a4 4 0 1 1 8 0v2" />
              <path d="M12 14v2" />
            </svg>
            <input
              type={showConfirmPassword ? "text" : "password"}
              className="auth-input password-input"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {showConfirmPassword ? (
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

          <button type="submit" className="auth-button auth-button-primary" disabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </button>

        </form>

        <div className="auth-divider">OR</div>

        <button onClick={handleGoogleSignIn} className="auth-button auth-button-google" disabled={loading}>
          <svg className="google-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M21.6 12.23c0-.79-.07-1.54-.2-2.27H12v4.3h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.33 2.98-7.55Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.75-5.59-4.1H3.07v2.57A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.41 13.93A6 6 0 0 1 6.41 10.07V7.5H3.07a10 10 0 0 0 0 12.86l3.34-2.43Z" />
            <path fill="#EA4335" d="M12 6.04c1.47 0 2.8.5 3.84 1.49l2.88-2.88A9.96 9.96 0 0 0 12 2 10 10 0 0 0 3.07 7.5l3.34 2.43C7.2 7.79 9.4 6.04 12 6.04Z" />
          </svg>
          Continue with Google
        </button>

        <p className="auth-footer">
          Already have an account?{" "}
          <Link to="/login" className="auth-link">Login</Link>
        </p>

        {/* SUCCESS REGISTRATION OVERLAY */}
        {showSuccess && (
          <div className="registration-success-overlay">
            <div className="success-icon-container">
              <svg className="check-animated" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '40px', height: '40px' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            
            <h2 className="success-title">ACCOUNT VERIFIED</h2>
            <p className="success-subtitle">ACCESS CLEARANCE CREATED</p>
            
            <div className="terminal-status-container">
              <span className="terminal-cursor">&gt;&nbsp;</span>
              <span className="terminal-log-text">{terminalStatus}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Register;