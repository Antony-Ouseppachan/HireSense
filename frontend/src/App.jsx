import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Interviews from "./pages/Interviews";
import InterviewSession from "./pages/InterviewSession";
import Navbar from "./components/Navbar";
import SplashScreen from "./components/SplashScreen";
import {
  getProfile,
  saveProfile,
  getInterviews,
  startMockInterview,
  uploadResume
} from "./services/apiService";
import "./App.css";

function App() {
  const [user] = useState({ id: 1, name: "User", email: "user@example.com", role: "candidate" });
  const [interviews, setInterviews] = useState([]);
  const [profile, setProfile] = useState(null);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const saveProfileData = async (profileData) => {
    const saved = await saveProfile(profileData);
    setProfile(saved);
    window.location.href = "/dashboard";
    return saved;
  };

  const saveResume = async (formData) => {
    return uploadResume(formData);
  };

  const handleStartInterview = async () => {
    if (!profile) {
      alert("Please complete your profile before starting a mock interview.");
      return null;
    }

    const session = await startMockInterview({ profile });
    setInterviews((prev) => [session, ...prev]);
    return session;
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <BrowserRouter>
      <Navbar user={user} />
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/dashboard" element={<Dashboard user={user} interviews={interviews} profile={profile} />} />
        <Route path="/profile" element={<Profile user={user} profile={profile} onSave={saveProfileData} onResumeUpload={saveResume} />} />
        <Route path="/interviews" element={<Interviews user={user} profile={profile} interviews={interviews} onStartInterview={handleStartInterview} />} />
        <Route path="/interviews/:id" element={<InterviewSession user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
