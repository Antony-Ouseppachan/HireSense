// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import InterviewStudio from "./pages/InterviewStudio";
import InterviewCategory from "./pages/InterviewCategory";
import InterviewSession from "./pages/InterviewSession";
import Navbar from "./components/Navbar";
import SplashScreen from "./components/SplashScreen";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";

import "./App.css";

function ProfileRoute() {
  return <Profile />;
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
                    <InterviewStudio />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/studio/:categoryId"
                element={
                  <ProtectedRoute>
                    <InterviewCategory />
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
