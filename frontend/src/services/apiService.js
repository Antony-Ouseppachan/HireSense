const API_BASE = "http://localhost:5000";

function getHeaders() {
  return {
    "Content-Type": "application/json"
  };
}

export async function getProfile() {
  const response = await fetch(`${API_BASE}/profile`, {
    headers: getHeaders()
  });
  return response.json();
}

export async function saveProfile(payload) {
  const response = await fetch(`${API_BASE}/profile`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  return response.json();
}

export async function getInterviews() {
  const response = await fetch(`${API_BASE}/interviews`, {
    headers: getHeaders()
  });
  return response.json();
}

export async function getInterviewById(id) {
  const response = await fetch(`${API_BASE}/interviews/${id}`, {
    headers: getHeaders()
  });
  return response.json();
}

export async function startMockInterview(payload) {
  const response = await fetch(`${API_BASE}/interviews/start`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  return response.json();
}

export async function submitInterviewResponses(id, payload) {
  const response = await fetch(`${API_BASE}/interviews/submit/${id}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  return response.json();
}

export async function uploadResume(formData) {
  const response = await fetch(`${API_BASE}/resume/upload`, {
    method: "POST",
    body: formData
  });
  return response.json();
}

export async function analyzeProfile(payload) {
  const response = await fetch(`${API_BASE}/ai/analyze-profile`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  return response.json();
}

export async function evaluateInterview(payload) {
  const response = await fetch(`${API_BASE}/ai/evaluate-interview`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  return response.json();
}

export async function analyzeResume(payload) {
  return analyzeProfile(payload);
}

export async function matchCandidate(payload) {
  return evaluateInterview(payload);
}
