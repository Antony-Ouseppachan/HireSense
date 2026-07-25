// src/services/apiService.js

import API_BASE_URL from "../config/api";
import { getIdToken } from "./authService";

const API_BASE = `${API_BASE_URL}/api`;

/* ============================================================
   Helper Functions
============================================================ */

async function getHeaders(isFormData = false) {
    const headers = {};

    if (!isFormData) {
        headers["Content-Type"] = "application/json";
    }

    const token = await getIdToken();

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
}

async function apiRequest(endpoint, options = {}, isFormData = false) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            ...(await getHeaders(isFormData)),
            ...(options.headers || {}),
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

/* ============================================================
   Authentication
============================================================ */

export async function authenticateUser() {
    return apiRequest("/auth/login", {
        method: "POST",
    });
}

export async function getAuthenticatedUser() {
    return apiRequest("/auth/me");
}

export async function checkEmailExists(email) {
    return apiRequest(`/auth/check-email?email=${encodeURIComponent(email)}`);
}

/* ============================================================
   Candidate Profile
============================================================ */

export async function getProfile() {
    return apiRequest("/profile");
}

export async function saveProfile(payload) {
    return apiRequest("/profile", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

// Education
export async function addEducation(data) {
    return apiRequest("/profile/education", { method: "POST", body: JSON.stringify(data) });
}
export async function updateEducation(id, data) {
    return apiRequest(`/profile/education/${id}`, { method: "PUT", body: JSON.stringify(data) });
}
export async function deleteEducation(id) {
    return apiRequest(`/profile/education/${id}`, { method: "DELETE" });
}

// Skills
export async function addSkill(skill_id) {
    return apiRequest("/profile/skills", { method: "POST", body: JSON.stringify({ skill_id }) });
}
export async function removeSkill(skill_id) {
    return apiRequest(`/profile/skills/${skill_id}`, { method: "DELETE" });
}

// Projects
export async function addProject(data) {
    return apiRequest("/profile/projects", { method: "POST", body: JSON.stringify(data) });
}
export async function updateProject(id, data) {
    return apiRequest(`/profile/projects/${id}`, { method: "PUT", body: JSON.stringify(data) });
}
export async function deleteProject(id) {
    return apiRequest(`/profile/projects/${id}`, { method: "DELETE" });
}

// Learning Goals & Weak Areas
export async function saveLearningGoals(goals) {
    return apiRequest("/profile/learning-goals", { method: "POST", body: JSON.stringify({ goals }) });
}
export async function saveWeakAreas(weak_areas) {
    return apiRequest("/profile/weak-areas", { method: "POST", body: JSON.stringify({ weak_areas }) });
}

// Autocomplete
export async function searchRoles(q) {
    return apiRequest(`/autocomplete/roles?q=${encodeURIComponent(q)}`);
}
export async function searchSkills(q) {
    return apiRequest(`/autocomplete/skills?q=${encodeURIComponent(q)}`);
}
export async function searchDegrees(q) {
    return apiRequest(`/autocomplete/degrees?q=${encodeURIComponent(q)}`);
}
export async function searchSpecializations(q) {
    return apiRequest(`/autocomplete/specializations?q=${encodeURIComponent(q)}`);
}
export async function searchInstitutions(q) {
    return apiRequest(`/autocomplete/institutions?q=${encodeURIComponent(q)}`);
}

/* ============================================================
   Resume
============================================================ */

export async function uploadResume(formData) {
    return apiRequest(
        "/resume/upload",
        {
            method: "POST",
            body: formData,
        },
        true
    );
}

export async function deleteResume(id) {
    return apiRequest(`/resume/${id}`, {
        method: "DELETE",
    });
}

/* ============================================================
   Interviews
============================================================ */

export async function getInterviews() {
    return apiRequest("/interviews");
}

export async function getInterviewById(id) {
    return apiRequest(`/interviews/${id}`);
}

export async function startMockInterview(payload) {
    return apiRequest("/interviews/start", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function submitInterviewResponses(id, payload) {
    return apiRequest(`/interviews/submit/${id}`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/* ============================================================
   AI Services
============================================================ */

export async function analyzeProfile(payload) {
    return apiRequest("/ai/analyze-profile", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function analyzeResume(payload) {
    return apiRequest("/ai/analyze-resume", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function evaluateInterview(payload) {
    return apiRequest("/ai/evaluate-interview", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function matchCandidate(payload) {
    return apiRequest("/ai/match-candidate", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

// ─── Aptitude Assessment (Legacy) ───

export async function getAptitudeHistory() {
    return apiRequest("/aptitude/history");
}

export async function getAptitudeResult(id) {
    return apiRequest(`/aptitude/results/${id}`);
}

export async function getAptitudeRemarks() {
    return apiRequest("/aptitude/remarks");
}

export async function getAptitudeRemarkDetail(id) {
    return apiRequest(`/aptitude/remarks/${id}`);
}

// ─── Aptitude V2 (Enterprise Assessment) ────────────────────────────

export async function generateAssessment(profile, difficulty) {
    return apiRequest("/aptitude/generate", {
        method: "POST",
        body: JSON.stringify({ profile, difficulty }),
    });
}

export async function getAssessmentStatus(id) {
    return apiRequest(`/aptitude/assessment/${id}/status`);
}

export async function getAssessment(id) {
    return apiRequest(`/aptitude/assessment/${id}`);
}

export async function startAssessment(id) {
    return apiRequest(`/aptitude/assessment/${id}/start`, { method: "POST" });
}

export async function beginAssessment(id) {
    return apiRequest(`/aptitude/assessment/${id}/begin`, { method: "POST" });
}

export async function getAssessmentQuestion(id, number) {
    return apiRequest(`/aptitude/assessment/${id}/question/${number}`);
}

export async function saveAnswer(id, payload) {
    return apiRequest(`/aptitude/assessment/${id}/answer`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function logMalpractice(id, payload) {
    return apiRequest(`/aptitude/assessment/${id}/malpractice`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function completeAssessment(id) {
    return apiRequest(`/aptitude/assessment/${id}/complete`, { method: "POST" });
}

export async function cancelAssessment(id) {
    return apiRequest(`/aptitude/assessment/${id}/cancel`, { method: "POST" });
}