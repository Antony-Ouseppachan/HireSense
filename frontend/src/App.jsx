import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Interviews from "./pages/Interviews";
import InterviewSession from "./pages/InterviewSession";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import {
  sendOtp,
  verifyOtp,
  getProfile,
  saveProfile,
  getInterviews,
  startMockInterview,
  uploadResume
} from "./services/apiService";

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("hiresense_user");
    const savedToken = localStorage.getItem("hiresense_token");
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      getProfile(token).then((data) => setProfile(data)).catch(() => setProfile(null));
      getInterviews(token).then((data) => setInterviews(data)).catch(() => setInterviews([]));
    }
  }, [token]);

  const handleSendOtp = async (email) => {
    return sendOtp(email);
  };

  const handleVerifyOtp = async (payload) => {
    const result = await verifyOtp(payload);
    if (result.token) {
      const userData = result.user;
      setUser(userData);
      setToken(result.token);
      localStorage.setItem("hiresense_user", JSON.stringify(userData));
      localStorage.setItem("hiresense_token", result.token);
    }
    return result;
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setProfile(null);
    setInterviews([]);
    localStorage.removeItem("hiresense_user");
    localStorage.removeItem("hiresense_token");
    window.location.href = "/login";
  };

  const saveProfileData = async (profileData) => {
    const saved = await saveProfile(profileData, token);
    setProfile(saved);

    if (user && !user.is_profile_complete) {
      const updatedUser = { ...user, is_profile_complete: true };
      setUser(updatedUser);
      localStorage.setItem("hiresense_user", JSON.stringify(updatedUser));
    }

    window.location.href = "/dashboard";
    return saved;
  };

  const saveResume = async (formData) => {
    return uploadResume(formData, token);
  };

  const handleStartInterview = async () => {
    if (!profile) {
      alert("Please complete your profile before starting a mock interview.");
      return null;
    }

    const session = await startMockInterview({ profile }, token);
    setInterviews((prev) => [session, ...prev]);
    return session;
  };

  return (
    <BrowserRouter>
      <Navbar user={user} onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/login" element={<Login onSendOtp={handleSendOtp} onVerifyOtp={handleVerifyOtp} />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute isAuthenticated={Boolean(token)}>
              <Dashboard user={user} interviews={interviews} profile={profile} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute isAuthenticated={Boolean(token)}>
              <Profile user={user} profile={profile} onSave={saveProfileData} onResumeUpload={saveResume} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interviews"
          element={
            <ProtectedRoute isAuthenticated={Boolean(token)}>
              <Interviews user={user} profile={profile} interviews={interviews} onStartInterview={handleStartInterview} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interviews/:id"
          element={
            <ProtectedRoute isAuthenticated={Boolean(token)}>
              <InterviewSession token={token} user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
