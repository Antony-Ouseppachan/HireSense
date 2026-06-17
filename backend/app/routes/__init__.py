from fastapi import APIRouter

from .ai import router as ai_router
from .auth import router as auth_router
from .profile import router as profile_router
from .resume import router as resume_router
from .root import router as root_router

api_router = APIRouter()
api_router.include_router(root_router)
api_router.include_router(auth_router)
api_router.include_router(profile_router)
api_router.include_router(ai_router)
api_router.include_router(resume_router)
