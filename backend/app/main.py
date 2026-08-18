from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models import User, Profile, Resume, InterviewSession, InterviewQuestion, InterviewAnswer, Report
from .routes import api_router

app = FastAPI(title="HireSense API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)