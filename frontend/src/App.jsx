// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
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
import AptitudeReview from "./pages/AptitudeReview";
import English from "./pages/English";
import EnglishTest from "./pages/EnglishTest";
import EnglishResults from "./pages/EnglishResults";
import EnglishHistory from "./pages/EnglishHistory";
import EnglishReview from "./pages/EnglishReview";
import Navbar from "./components/Navbar";
import SplashScreen from "./components/SplashScreen";
import ThemeAmbient from "./components/ThemeAmbient";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ExamProvider, useExam } from "./context/ExamContext";
import { SearchProvider } from "./context/SearchContext";
import SearchOverlay from "./components/SearchOverlay";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";

import "./App.css";

function ProfileRoute() {
  return <Profile />;
}

function StudioCategoryRoute() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (categoryId === "gk") navigate("/aptitude?type=general_knowledge", { replace: true });
    if (categoryId === "english") navigate("/english", { replace: true });
  }, [categoryId, navigate]);
  if (categoryId === "gk" || categoryId === "english") return null;
  return <InterviewCategory />;
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
        <SearchOverlay />
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
                  <StudioCategoryRoute />
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
            <Route
              path="/aptitude/review/:id"
              element={
                <ProtectedRoute>
                  <AptitudeReview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/english"
              element={
                <ProtectedRoute>
                  <English />
                </ProtectedRoute>
              }
            />
            <Route
              path="/english/history"
              element={
                <ProtectedRoute>
                  <EnglishHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/english/test"
              element={
                <ProtectedRoute>
                  <EnglishTest />
                </ProtectedRoute>
              }
            />
            <Route
              path="/english/results/:id"
              element={
                <ProtectedRoute>
                  <EnglishResults />
                </ProtectedRoute>
              }
            />
            <Route
              path="/english/review/:id"
              element={
                <ProtectedRoute>
                  <EnglishReview />
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
          <SearchProvider>
            <AppContent />
          </SearchProvider>
        </ExamProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
