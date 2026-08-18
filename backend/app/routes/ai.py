from fastapi import APIRouter, Body
import json

from ..services.ai_service import generate_questions, AIGatewayError

router = APIRouter(prefix="/ai")

@router.post("/questions")
def ai_questions(profile: dict = Body(...), mode: str = "technical"):
    try:
        raw_response = generate_questions(profile, mode)

        try:
            parsed_questions = json.loads(raw_response)
            return {"success": True, "questions": parsed_questions}
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "Model returned invalid JSON",
                "raw_response": raw_response,
            }

    except AIGatewayError as e:
        return {"success": False, "error": str(e), "code": e.code}
    except Exception as e:
        return {"success": False, "error": str(e)}