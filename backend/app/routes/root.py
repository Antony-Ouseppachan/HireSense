from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def home():
    return {
        "message": "HireSense Backend Running 🚀"
    }

@router.get("/health")
def health():
    return {
        "status": "ok"
    }
