const API_BASE = "http://localhost:5000";

function getHeaders(token) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export async function sendOtp(email) {
  const response = await fetch(`${API_BASE}/auth/send-otp`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ email })
  });
  return response.json();
}

export async function verifyOtp(payload) {
  const response = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  return response.json();
}

export async function getProfile(token) {
  const response = await fetch(`${API_BASE}/profile`, {
    headers: getHeaders(token)
  });
  return response.json();
}

export async function saveProfile(payload, token) {
  const response = await fetch(`${API_BASE}/profile`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(payload)
  });
  return response.json();
}

export async function getInterviews(token) {
  const response = await fetch(`${API_BASE}/interviews`, {
    headers: getHeaders(token)
  });
  return response.json();
}

export async function getInterviewById(id, token) {
  const response = await fetch(`${API_BASE}/interviews/${id}`, {
    headers: getHeaders(token)
  });
  return response.json();
}

export async function startMockInterview(payload, token) {
  const response = await fetch(`${API_BASE}/interviews/start`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(payload)
  });
  return response.json();
}

export async function submitInterviewResponses(id, payload, token) {
  const response = await fetch(`${API_BASE}/interviews/submit/${id}`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(payload)
  });
  return response.json();
}

export async function uploadResume(formData, token) {
  const response = await fetch(`${API_BASE}/resume/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });
  return response.json();
}

export async function analyzeProfile(payload, token) {
  const response = await fetch(`${API_BASE}/ai/analyze-profile`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(payload)
  });
  return response.json();
}

export async function evaluateInterview(payload, token) {
  const response = await fetch(`${API_BASE}/ai/evaluate-interview`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(payload)
  });
  return response.json();
}

export async function analyzeResume(payload, token) {
  return analyzeProfile(payload, token);
}

export async function matchCandidate(payload, token) {
  return evaluateInterview(payload, token);
}
