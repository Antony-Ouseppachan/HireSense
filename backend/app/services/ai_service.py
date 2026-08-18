import os
import requests
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

AI_GATEWAY_URL = os.getenv("AI_GATEWAY_URL")
AI_GATEWAY_API_KEY = os.getenv("AI_GATEWAY_API_KEY")

if not AI_GATEWAY_URL or not AI_GATEWAY_API_KEY:
    raise RuntimeError("AI_GATEWAY_URL and AI_GATEWAY_API_KEY must be set in backend/.env")

GATEWAY_TIMEOUT_SECONDS = 65


class AIGatewayError(Exception):
    def __init__(self, message, status_code=502, code="GATEWAY_ERROR"):
        super().__init__(message)
        self.status_code = status_code
        self.code = code


def _call_gateway(prompt: str) -> str:
    try:
        response = requests.post(
            f"{AI_GATEWAY_URL}/api/chat",
            json={"message": prompt},
            headers={
                "x-api-key": AI_GATEWAY_API_KEY,
                "ngrok-skip-browser-warning": "true",  # harmless to leave in, remove once off ngrok
                "Content-Type": "application/json",
            },
            timeout=GATEWAY_TIMEOUT_SECONDS,
        )
    except requests.exceptions.Timeout:
        raise AIGatewayError("AI gateway timed out", 504, "GATEWAY_TIMEOUT")
    except requests.exceptions.ConnectionError:
        raise AIGatewayError("AI gateway is unreachable", 503, "GATEWAY_UNREACHABLE")

    try:
        body = response.json()
    except ValueError:
        raise AIGatewayError("AI gateway returned a non-JSON response", 502, "GATEWAY_BAD_RESPONSE")

    if not response.ok or not body.get("success"):
        error = body.get("error", {})
        raise AIGatewayError(
            error.get("message", "AI gateway request failed"),
            response.status_code,
            error.get("code", "GATEWAY_ERROR"),
        )

    return body["reply"]


def generate_questions(profile, mode="technical"):
    prompt = f"""
You are an expert interviewer.

Candidate Profile:

Name: {profile.get('name', '')}
Role: {profile.get('role', '')}
Education: {profile.get('education', '')}
Skills: {profile.get('skills', '')}
Experience: {profile.get('experience', '')}
Projects: {profile.get('projects', '')}

IMPORTANT RULES:

1. Generate exactly 5 interview questions.
2. Questions must be tailored to this candidate.
3. Use their skills and projects heavily.
4. Match the difficulty to their experience level.
5. If the candidate is a student/fresher, avoid advanced system design questions.
6. Include:
   - 2 skill-based questions
   - 2 project-based questions
   - 1 practical problem-solving question
7. Return ONLY valid JSON.
8. Do NOT use markdown.
9. Do NOT add explanations.

Example output:

[
  {{"question": "How did you connect React and FastAPI in your project?"}},
  {{"question": "What challenges did you face while building HireSense?"}},
  {{"question": "Explain React state management."}},
  {{"question": "How would you optimize database queries in MySQL?"}},
  {{"question": "If your backend API becomes slow, how would you debug it?"}}
]
"""
    return _call_gateway(prompt)