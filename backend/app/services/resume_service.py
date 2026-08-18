import re
from pathlib import Path
from uuid import uuid4

import fitz
from fastapi import UploadFile

BASE_DIR = Path(__file__).resolve().parents[1]
RESUME_DIRECTORY = BASE_DIR / "database" / "resumes"
RESUME_DIRECTORY.mkdir(parents=True, exist_ok=True)

DEGREE_KEYWORDS = [
    "bachelor",
    "master",
    "b.sc",
    "m.sc",
    "bs",
    "ms",
    "mba",
    "phd",
    "doctor",
    "diploma",
    "associate"
]

CERT_KEYWORDS = [
    "certif",
    "certificate",
    "certification",
    "aws",
    "google cloud",
    "azure",
    "pmp",
    "scrum",
    "cissp",
    "ccna",
    "ccnp",
    "oracle",
    "sap"
]

SKILL_SECTION_HEADERS = [
    "skills",
    "technical skills",
    "skill set",
    "programming skills"
]

PROJECT_SECTION_HEADERS = [
    "projects",
    "project experience",
    "work experience",
    "experience"
]

EDUCATION_SECTION_HEADERS = [
    "education",
    "academic qualifications",
    "qualifications"
]

CERTIFICATION_SECTION_HEADERS = [
    "certifications",
    "certification",
    "licenses"]


async def process_resume_upload(file: UploadFile) -> dict:
    saved_filename = await save_resume_file(file)
    resume_path = RESUME_DIRECTORY / saved_filename
    raw_text = extract_text_from_pdf(resume_path)
    extracted = extract_resume_fields(raw_text)

    return {
        "filename": file.filename,
        "stored_as": saved_filename,
        "skills": extracted["skills"],
        "education": extracted["education"],
        "projects": extracted["projects"],
        "certifications": extracted["certifications"]
    }


async def save_resume_file(file: UploadFile) -> str:
    filename = Path(file.filename).name
    stored_name = f"{uuid4().hex}_{filename}"
    target_path = RESUME_DIRECTORY / stored_name

    contents = await file.read()
    target_path.write_bytes(contents)
    return stored_name


def extract_text_from_pdf(path: Path) -> str:
    document = fitz.open(path)
    text_chunks = []
    for page in document:
        text_chunks.append(page.get_text())
    return "\n".join(text_chunks)


def extract_section(lines, headers):
    results = []
    header_indices = [
        i for i, line in enumerate(lines)
        if any(header in line.lower() for header in headers)
    ]

    for start in header_indices:
        for line in lines[start + 1:]:
            stripped = line.strip()
            if not stripped:
                break
            lower = stripped.lower()
            if any(h in lower for h in ["skills", "education", "project", "experience", "certifi", "license"]):
                break
            if stripped.startswith("-") or stripped.startswith("*") or stripped.startswith("•"):
                results.append(stripped.lstrip("-*• "))
            elif "," in stripped:
                results.extend([p.strip() for p in stripped.split(",") if p.strip()])
            else:
                results.append(stripped)

    return results


def extract_resume_fields(text: str) -> dict:
    normalized = text.replace("\r", "\n")
    lines = [line.strip() for line in normalized.splitlines() if line.strip()]

    skills = extract_section(lines, SKILL_SECTION_HEADERS)
    education = extract_section(lines, EDUCATION_SECTION_HEADERS)
    projects = extract_section(lines, PROJECT_SECTION_HEADERS)
    certifications = extract_section(lines, CERTIFICATION_SECTION_HEADERS)

    if not skills:
        skills = extract_keywords(text, SKILL_SECTION_HEADERS)
    if not education:
        education = extract_lines_by_keywords(lines, DEGREE_KEYWORDS)
    if not projects:
        projects = extract_lines_by_keywords(lines, ["project", "project:", "project -", "project ", "worked on"])
    if not certifications:
        certifications = extract_lines_by_keywords(lines, CERT_KEYWORDS)

    return {
        "skills": unique_list(skills),
        "education": unique_list(education),
        "projects": unique_list(projects),
        "certifications": unique_list(certifications)
    }


def extract_keywords(text: str, headers):
    lower_text = text.lower()
    matches = []
    for header in headers:
        if header in lower_text:
            section = lower_text.split(header, 1)[1]
            for line in section.splitlines():
                clean = line.strip()
                if not clean:
                    break
                if "," in clean:
                    matches.extend([item.strip() for item in clean.split(",") if item.strip()])
                elif clean.startswith("-") or clean.startswith("*") or clean.startswith("•"):
                    matches.append(clean.lstrip("-*• "))
    return matches


def extract_lines_by_keywords(lines, keywords):
    results = []
    for line in lines:
        lower = line.lower()
        if any(keyword in lower for keyword in keywords):
            cleaned = re.sub(r"^[\-\*•\s]+", "", line)
            results.append(cleaned)
    return results


def unique_list(items):
    seen = set()
    unique = []
    for item in items:
        normalized = item.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            unique.append(normalized)
    return unique
