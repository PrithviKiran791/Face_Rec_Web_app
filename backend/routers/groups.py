# backend/routers/groups.py
"""Group / Class management — CRUD + member assignment.

Redis keys
----------
- ``groups:list``               hash   group_id → JSON metadata
- ``groups:members:{group_id}`` set    identity keys ("Name@Role")
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth.dependencies import require_auth
from face_rec import r

router = APIRouter()


# ── Pydantic Models ───────────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    name: str
    description: str = ""


class GroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class MemberPayload(BaseModel):
    identities: list[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

GROUPS_HASH = "groups:list"


def _members_key(group_id: str) -> str:
    return f"groups:members:{group_id}"


def _get_group(group_id: str) -> dict | None:
    if r is None:
        return None
    raw = r.hget(GROUPS_HASH, group_id)
    if raw is None:
        return None
    return json.loads(raw)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", dependencies=[Depends(require_auth)])
async def list_groups():
    if r is None:
        return {"groups": []}
    raw_map = r.hgetall(GROUPS_HASH)
    groups = []
    for gid, raw in raw_map.items():
        gid_str = gid.decode() if isinstance(gid, bytes) else gid
        data = json.loads(raw)
        data["id"] = gid_str
        data["member_count"] = r.scard(_members_key(gid_str))
        groups.append(data)
    return {"groups": groups}


@router.post("", dependencies=[Depends(require_auth)])
async def create_group(body: GroupCreate):
    if r is None:
        raise HTTPException(503, "Redis unavailable")
    group_id = uuid.uuid4().hex[:12]
    payload = {
        "name": body.name,
        "description": body.description,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    r.hset(GROUPS_HASH, group_id, json.dumps(payload))
    return {"ok": True, "group_id": group_id, **payload}


@router.put("/{group_id}", dependencies=[Depends(require_auth)])
async def update_group(group_id: str, body: GroupUpdate):
    existing = _get_group(group_id)
    if existing is None:
        raise HTTPException(404, "Group not found")
    if body.name is not None:
        existing["name"] = body.name
    if body.description is not None:
        existing["description"] = body.description
    r.hset(GROUPS_HASH, group_id, json.dumps(existing))  # type: ignore[union-attr]
    return {"ok": True, **existing}


@router.delete("/{group_id}", dependencies=[Depends(require_auth)])
async def delete_group(group_id: str):
    if r is None:
        raise HTTPException(503, "Redis unavailable")
    removed = r.hdel(GROUPS_HASH, group_id)
    r.delete(_members_key(group_id))
    if not removed:
        raise HTTPException(404, "Group not found")
    return {"ok": True, "message": f"Group {group_id} deleted"}


# ── Member management ─────────────────────────────────────────────────────────

@router.get("/{group_id}/members", dependencies=[Depends(require_auth)])
async def get_members(group_id: str):
    if r is None:
        return {"members": []}
    if _get_group(group_id) is None:
        raise HTTPException(404, "Group not found")
    members = [m.decode() if isinstance(m, bytes) else m for m in r.smembers(_members_key(group_id))]
    return {"members": sorted(members)}


@router.post("/{group_id}/members", dependencies=[Depends(require_auth)])
async def add_members(group_id: str, body: MemberPayload):
    if r is None:
        raise HTTPException(503, "Redis unavailable")
    if _get_group(group_id) is None:
        raise HTTPException(404, "Group not found")
    if body.identities:
        r.sadd(_members_key(group_id), *body.identities)
    return {"ok": True, "added": len(body.identities)}


@router.delete("/{group_id}/members", dependencies=[Depends(require_auth)])
async def remove_members(group_id: str, body: MemberPayload):
    if r is None:
        raise HTTPException(503, "Redis unavailable")
    if _get_group(group_id) is None:
        raise HTTPException(404, "Group not found")
    if body.identities:
        r.srem(_members_key(group_id), *body.identities)
    return {"ok": True, "removed": len(body.identities)}
