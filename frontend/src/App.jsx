// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import InterviewStudio from "./pages/InterviewStudio";
import InterviewCategory from "./pages/InterviewCategory";
import InterviewSession from "./pages/InterviewSession";
import Aptitude from "./pages/Aptitude";
import AptitudeTest from "./pages/AptitudeTest";
import AptitudeResults from "./pages/AptitudeResults";
import AptitudeHistory from "./pages/AptitudeHistory";
import Navbar from "./components/Navbar";
import SplashScreen from "./components/SplashScreen";
import ThemeAmbient from "./components/ThemeAmbient";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ExamProvider, useExam } from "./context/ExamContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";

import "./App.css";

function ProfileRoute() {
  return <Profile />;
}

function AppContent() {
  const { loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const { isExamMode } = useExam();

  if (showSplash) {
    return <SplashScreen ready={!loading} onComplete={() => setShowSplash(false)} />;
  }

  return (
    <BrowserRouter>
      <div className={`app-cyber-container${isExamMode ? " exam-mode-active" : ""}`}>
        {!isExamMode && <div className="tech-grid" />}
        {!isExamMode && <ThemeAmbient />}
        {!isExamMode && <Navbar />}
        <main className={`app-main-content${isExamMode ? " exam-mode" : ""}`}>
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
            <Route
              path="/aptitude"
              element={
                <ProtectedRoute>
                  <Aptitude />
                </ProtectedRoute>
              }
            />
            <Route
              path="/aptitude/history"
              element={
                <ProtectedRoute>
                  <AptitudeHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/aptitude/test"
              element={
                <ProtectedRoute>
                  <AptitudeTest />
                </ProtectedRoute>
              }
            />
            <Route
              path="/aptitude/results/:id"
              element={
                <ProtectedRoute>
                  <AptitudeResults />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ExamProvider>
          <AppContent />
        </ExamProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
