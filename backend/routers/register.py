# backend/routers/register.py
from typing import Annotated
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import Response
import numpy as np, tempfile, os, base64
from face_rec import RegistrationForm, r
from auth.dependencies import require_auth

router = APIRouter()
form_store = {}  # keyed by session_id, holds RegistrationForm instances

PROFILE_PICS_HASH = "profile_pics"


@router.post("/submit", dependencies=[Depends(require_auth)])
async def submit_registration(
    name: Annotated[str, Form(...)],
    role: Annotated[str, Form(...)],
    session_id: Annotated[str, Form(...)],
    profile_pic: Annotated[str, Form()] = "",
):
    reg = form_store.get(session_id)
    if not reg:
        return {"ok": False, "message": "No session found."}
    ok, msg = reg.save_to_redis(name=name, role=role)
    if ok:
        del form_store[session_id]
        # Save profile picture if provided
        if profile_pic and r is not None:
            identity_key = f"{name}@{role}"
            r.hset(PROFILE_PICS_HASH, identity_key, profile_pic)
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


# ── Profile Picture endpoints ─────────────────────────────────────────────────

@router.get("/profile-pic/{identity_key}", dependencies=[Depends(require_auth)])
async def get_profile_pic(identity_key: str):
    """Return the profile picture for an identity (base64 data URL string)."""
    if r is None:
        raise HTTPException(404, "Redis unavailable")
    raw = r.hget(PROFILE_PICS_HASH, identity_key)
    if raw is None:
        raise HTTPException(404, "No profile picture found")
    pic_str = raw.decode() if isinstance(raw, bytes) else raw
    return {"identity": identity_key, "profile_pic": pic_str}


@router.post("/profile-pic/{identity_key}", dependencies=[Depends(require_auth)])
async def set_profile_pic(identity_key: str, profile_pic: Annotated[str, Form(...)]):
    """Set or update the profile picture for an identity."""
    if r is None:
        raise HTTPException(503, "Redis unavailable")
    r.hset(PROFILE_PICS_HASH, identity_key, profile_pic)
    return {"ok": True, "message": "Profile picture saved"}


@router.get("/profile-pics", dependencies=[Depends(require_auth)])
async def get_all_profile_pics():
    """Return all profile pictures as a dict of identity_key → base64 data URL."""
    if r is None:
        return {"pics": {}}
    raw_map = r.hgetall(PROFILE_PICS_HASH)
    pics = {}
    for k, v in raw_map.items():
        key_str = k.decode() if isinstance(k, bytes) else k
        val_str = v.decode() if isinstance(v, bytes) else v
        pics[key_str] = val_str
    return {"pics": pics}