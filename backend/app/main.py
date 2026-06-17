from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .database import Base, engine
from .models import User, Profile, Resume, InterviewSession, InterviewQuestion, InterviewAnswer, Report
from .routes import api_router

app = FastAPI(title="HireSense API")


def ensure_schema():
    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        columns = [column["name"] for column in inspector.get_columns("users")]
        
        # Add is_profile_complete if missing
        if "is_profile_complete" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE users ADD COLUMN is_profile_complete boolean NOT NULL DEFAULT FALSE"
                    )
                )
        
        # Make name nullable if it exists and is currently not nullable
        if "name" in columns:
            column_info = [col for col in inspector.get_columns("users") if col["name"] == "name"][0]
            if not column_info["nullable"]:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ALTER COLUMN name DROP NOT NULL"))


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    ensure_schema()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
