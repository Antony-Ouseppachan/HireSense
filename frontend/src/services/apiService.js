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
    const data = await apiRequest("/profile");
    const profile = data?.profile ?? null;
    if (!profile) return null;

    // Backend stores the target role as `target_role`; the UI uses `role`.
    return { ...profile, role: profile.target_role ?? "" };
}

export async function saveProfile(payload) {
    const { role, resume_url, ...rest } = payload;

    const data = await apiRequest("/profile", {
        method: "POST",
        body: JSON.stringify({ ...rest, target_role: role ?? "" }),
    });

    const profile = data?.profile ?? null;
    if (!profile) return null;

    return { ...profile, role: profile.target_role ?? "" };
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