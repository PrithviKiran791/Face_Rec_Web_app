# backend/routers/sessions.py
"""Scheduled sessions / periods — CRUD + per-session attendance computation.

Redis keys
----------
- ``sessions:list``  hash  session_id → JSON metadata
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone, date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from auth.dependencies import require_auth
from face_rec import r

router = APIRouter()

SESSIONS_HASH = "sessions:list"

# Day-of-week mapping
_DOW_MAP = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}


# ── Pydantic Models ───────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    name: str
    group_id: str
    day_of_week: str = "mon,tue,wed,thu,fri"  # comma-separated or "*"
    start_time: str  # "HH:MM" (24-hour)
    end_time: str    # "HH:MM"
    late_threshold_minutes: int = 15


class SessionUpdate(BaseModel):
    name: str | None = None
    group_id: str | None = None
    day_of_week: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    late_threshold_minutes: int | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_session(session_id: str) -> dict | None:
    if r is None:
        return None
    raw = r.hget(SESSIONS_HASH, session_id)
    if raw is None:
        return None
    return json.loads(raw)


def _all_sessions() -> list[dict]:
    if r is None:
        return []
    raw_map = r.hgetall(SESSIONS_HASH)
    sessions = []
    for sid, raw in raw_map.items():
        sid_str = sid.decode() if isinstance(sid, bytes) else sid
        data = json.loads(raw)
        data["id"] = sid_str
        sessions.append(data)
    return sessions


def _session_runs_on(session: dict, target_date: date_type) -> bool:
    dow = session.get("day_of_week", "*")
    if dow == "*":
        return True
    target_dow = _DOW_MAP[target_date.weekday()]
    return target_dow in [d.strip().lower() for d in dow.split(",")]


def _parse_time(time_str: str) -> tuple[int, int]:
    parts = time_str.strip().split(":")
    return int(parts[0]), int(parts[1])


def _get_attendance_logs() -> list[str]:
    """Retrieve raw attendance log strings from Redis."""
    if r is None:
        return []
    raw = r.lrange("attendance_logs", 0, -1)
    return [item.decode() if isinstance(item, bytes) else item for item in raw]


def _get_group_members(group_id: str) -> set[str]:
    if r is None:
        return set()
    members = r.smembers(f"groups:members:{group_id}")
    return {m.decode() if isinstance(m, bytes) else m for m in members}


def _get_group_name(group_id: str) -> str:
    if r is None:
        return "Unknown"
    raw = r.hget("groups:list", group_id)
    if raw is None:
        return "Unknown"
    data = json.loads(raw)
    return data.get("name", "Unknown")


# ── CRUD Endpoints ────────────────────────────────────────────────────────────

@router.get("", dependencies=[Depends(require_auth)])
async def list_sessions(group_id: str | None = Query(None)):
    sessions = _all_sessions()
    if group_id:
        sessions = [s for s in sessions if s.get("group_id") == group_id]
    # Enrich with group name
    for s in sessions:
        s["group_name"] = _get_group_name(s.get("group_id", ""))
    return {"sessions": sessions}


@router.post("", dependencies=[Depends(require_auth)])
async def create_session(body: SessionCreate):
    if r is None:
        raise HTTPException(503, "Redis unavailable")
    session_id = uuid.uuid4().hex[:12]
    payload = {
        "name": body.name,
        "group_id": body.group_id,
        "day_of_week": body.day_of_week,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "late_threshold_minutes": body.late_threshold_minutes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    r.hset(SESSIONS_HASH, session_id, json.dumps(payload))
    return {"ok": True, "session_id": session_id, **payload}


@router.put("/{session_id}", dependencies=[Depends(require_auth)])
async def update_session(session_id: str, body: SessionUpdate):
    existing = _get_session(session_id)
    if existing is None:
        raise HTTPException(404, "Session not found")
    for field in ("name", "group_id", "day_of_week", "start_time", "end_time", "late_threshold_minutes"):
        val = getattr(body, field, None)
        if val is not None:
            existing[field] = val
    r.hset(SESSIONS_HASH, session_id, json.dumps(existing))  # type: ignore[union-attr]
    return {"ok": True, **existing}


@router.delete("/{session_id}", dependencies=[Depends(require_auth)])
async def delete_session(session_id: str):
    if r is None:
        raise HTTPException(503, "Redis unavailable")
    removed = r.hdel(SESSIONS_HASH, session_id)
    if not removed:
        raise HTTPException(404, "Session not found")
    return {"ok": True, "message": f"Session {session_id} deleted"}


# ── Today's sessions ──────────────────────────────────────────────────────────

@router.get("/today", dependencies=[Depends(require_auth)])
async def get_today_sessions():
    today = date_type.today()
    sessions = [s for s in _all_sessions() if _session_runs_on(s, today)]
    for s in sessions:
        s["group_name"] = _get_group_name(s.get("group_id", ""))
    return {"sessions": sessions, "date": today.isoformat()}


# ── Per-session attendance ────────────────────────────────────────────────────

@router.get("/{session_id}/attendance", dependencies=[Depends(require_auth)])
async def get_session_attendance(session_id: str, date: str | None = Query(None)):
    session = _get_session(session_id)
    if session is None:
        raise HTTPException(404, "Session not found")

    target_date = date_type.fromisoformat(date) if date else date_type.today()

    if not _session_runs_on(session, target_date):
        return {
            "session": session,
            "date": target_date.isoformat(),
            "present": [],
            "late": [],
            "absent": [],
            "not_scheduled": True,
        }

    group_id = session.get("group_id", "")
    members = _get_group_members(group_id)
    start_h, start_m = _parse_time(session["start_time"])
    end_h, end_m = _parse_time(session["end_time"])
    late_threshold = session.get("late_threshold_minutes", 15)
    late_h, late_m = start_h, start_m + late_threshold
    if late_m >= 60:
        late_h += late_m // 60
        late_m = late_m % 60

    target_str = target_date.isoformat()

    # Parse attendance logs for the target date and time window
    logs = _get_attendance_logs()
    seen: dict[str, datetime] = {}  # identity_key → earliest timestamp

    for entry in logs:
        parts = entry.split("@")
        if len(parts) < 3:
            continue
        name, role, timestamp_str = parts[0], parts[1], parts[2].split(".")[0]
        identity_key = f"{name}@{role}"

        try:
            ts = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue

        if ts.date().isoformat() != target_str:
            continue

        # Check if within session time window (with 30 min buffer before and after)
        ts_minutes = ts.hour * 60 + ts.minute
        start_minutes = start_h * 60 + start_m - 30  # 30 min early buffer
        end_minutes = end_h * 60 + end_m + 30  # 30 min late buffer

        if ts_minutes < start_minutes or ts_minutes > end_minutes:
            continue

        if identity_key not in seen or ts < seen[identity_key]:
            seen[identity_key] = ts

    late_cutoff_minutes = late_h * 60 + late_m

    present = []
    late = []
    absent = []

    for member in members:
        name_part = member.split("@")[0] if "@" in member else member
        if member in seen:
            arrival = seen[member]
            arrival_minutes = arrival.hour * 60 + arrival.minute
            entry_data = {
                "identity": member,
                "name": name_part,
                "arrival_time": arrival.strftime("%H:%M:%S"),
            }
            if arrival_minutes > late_cutoff_minutes:
                late.append(entry_data)
            else:
                present.append(entry_data)
        else:
            absent.append({
                "identity": member,
                "name": name_part,
            })

    session["group_name"] = _get_group_name(group_id)

    return {
        "session": session,
        "session_id": session_id,
        "date": target_str,
        "present": sorted(present, key=lambda x: x["name"]),
        "late": sorted(late, key=lambda x: x["name"]),
        "absent": sorted(absent, key=lambda x: x["name"]),
        "total_members": len(members),
    }
