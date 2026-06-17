from ollama import chat

MODEL_NAME = "qwen3:8b"


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
  {
    "question": "How did you connect React and FastAPI in your project?"
  },
  {
    "question": "What challenges did you face while building HireSense?"
  },
  {
    "question": "Explain React state management."
  },
  {
    "question": "How would you optimize database queries in MySQL?"
  },
  {
    "question": "If your backend API becomes slow, how would you debug it?"
  }
]
"""

    response = chat(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return response["message"]["content"]
