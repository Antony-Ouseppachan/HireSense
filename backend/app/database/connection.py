import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

raw_database_url = os.getenv("DATABASE_URL")
if not raw_database_url:
    raise RuntimeError("DATABASE_URL must be set in backend/.env")

from urllib.parse import quote_plus, urlsplit, urlunsplit

parsed_url = urlsplit(raw_database_url)
if parsed_url.password and "@" in parsed_url.password:
    quoted_password = quote_plus(parsed_url.password)
    netloc = f"{parsed_url.username}:{quoted_password}@{parsed_url.hostname}"
    if parsed_url.port:
        netloc += f":{parsed_url.port}"
    DATABASE_URL = urlunsplit((parsed_url.scheme, netloc, parsed_url.path, parsed_url.query, parsed_url.fragment))
else:
    DATABASE_URL = raw_database_url

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
