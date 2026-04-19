# backend/routers/register.py
from typing import Annotated
from fastapi import APIRouter, UploadFile, File, Form, Depends
import numpy as np, tempfile, os
from face_rec import RegistrationForm, r
from auth.dependencies import require_auth

router = APIRouter()
form_store = {}  # keyed by session_id, holds RegistrationForm instances

@router.post("/submit", dependencies=[Depends(require_auth)])
async def submit_registration(
    name: Annotated[str, Form(...)],
    role: Annotated[str, Form(...)],
    session_id: Annotated[str, Form(...)]
):
    reg = form_store.get(session_id)
    if not reg:
        return {"ok": False, "message": "No session found."}
    ok, msg = reg.save_to_redis(name=name, role=role)
    if ok:
        del form_store[session_id]
    return {"ok": ok, "message": msg}

@router.post("/upload-embedding", dependencies=[Depends(require_auth)])
async def upload_embedding(
    file: Annotated[UploadFile, File(...)],
    fallback_name: Annotated[str, Form()] = "",
    fallback_role: Annotated[str, Form()] = "Student"
):
    filename = file.filename or "upload_embedding.npz"
    suffix = os.path.splitext(filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    reg = RegistrationForm()
    ok, msg = reg.push_local_embedding_to_redis(
        tmp_path, default_name=fallback_name, default_role=fallback_role
    )
    os.remove(tmp_path)
    return {"ok": ok, "message": msg}

@router.get("/identities", dependencies=[Depends(require_auth)])
async def list_identities():
    if r is None:
        return {"identities": []}
    keys = [k.decode() for k in r.hkeys("academy:register")]
    return {"identities": keys}