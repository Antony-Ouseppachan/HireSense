from fastapi import APIRouter, UploadFile, File, HTTPException

from ..services.resume_service import process_resume_upload

router = APIRouter(prefix="/resume")

@router.post("/upload")
async def upload_resume(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    result = await process_resume_upload(file)
    return result
