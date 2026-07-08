// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Interviews from "./pages/Interviews";
import InterviewSession from "./pages/InterviewSession";
import Navbar from "./components/Navbar";
import SplashScreen from "./components/SplashScreen";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { getProfile, saveProfile, uploadResume, deleteResume } from "./services/apiService";
import "./App.css";

/**
 * Loads the current user's profile and wires the Save / resume-upload
 * handlers into the presentational <Profile /> page.
 */
function ProfileRoute() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let active = true;
    getProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((error) => console.error("Failed to load profile:", error));
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (form) => {
    const saved = await saveProfile(form);
    if (saved) setProfile(saved);
    return saved;
  };

  const handleResumeUpload = async (formData) => {
    return uploadResume(formData);
  };

  const handleResumeDelete = async (resumeId) => {
    const result = await deleteResume(resumeId);
    // Re-fetch profile after deletion
    const refreshed = await getProfile();
    setProfile(refreshed);
    return result;
  };

  return (
    <Profile
      user={user}
      profile={profile}
      onSave={handleSave}
      onResumeUpload={handleResumeUpload}
      onResumeDelete={handleResumeDelete}
    />
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-cyber-container">
          <div className="tech-grid" />
          <Navbar />
          <main className="app-main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfileRoute />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interviews"
                element={
                  <ProtectedRoute>
                    <Interviews />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interviews/:id"
                element={
                  <ProtectedRoute>
                    <InterviewSession />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
