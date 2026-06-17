import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login({ onSendOtp, onVerifyOtp }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("email");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await onSendOtp(email);
      if (result.success) {
        setMessage(result.message || "OTP sent to your email.");
        setStep("otp");
      } else {
        setError(result.message || "Unable to send OTP.");
      }
    } catch (err) {
      setError("Unable to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await onVerifyOtp({ email, otp });
      if (result.token) {
        if (result.status === "new_user") {
          navigate("/profile");
        } else {
          navigate("/dashboard");
        }
      } else {
        setError(result.message || "Invalid OTP.");
      }
    } catch (err) {
      setError("Unable to verify OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h1>Login with Email OTP</h1>
      <form onSubmit={step === "email" ? handleSendOtp : handleVerify} className="form-card">
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          disabled={step === "otp"}
        />

        {step === "otp" && (
          <>
            <label>OTP</label>
            <input
              type="text"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              required
              maxLength={6}
            />
          </>
        )}

        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}

        <button type="submit" disabled={loading}>
          {step === "email" ? "Send OTP" : "Verify OTP"}
        </button>
      </form>
    </div>
  );
}

export default Login;
