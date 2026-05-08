# backend/routers/absentees.py
"""Aggregated absentee view — "who isn't here today and which class are they missing?"

Combines all of today's scheduled sessions and returns a unified absentee report.
"""

from __future__ import annotations

import json
from datetime import datetime, date as date_type

from fastapi import APIRouter, Depends, Query

from auth.dependencies import require_auth
from face_rec import r

router = APIRouter()


def _get_attendance_logs() -> list[str]:
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


_DOW_MAP = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}


def _session_runs_on(session: dict, target_date: date_type) -> bool:
    dow = session.get("day_of_week", "*")
    if dow == "*":
        return True
    target_dow = _DOW_MAP[target_date.weekday()]
    return target_dow in [d.strip().lower() for d in dow.split(",")]


def _parse_time(time_str: str) -> tuple[int, int]:
    parts = time_str.strip().split(":")
    return int(parts[0]), int(parts[1])


@router.get("/today", dependencies=[Depends(require_auth)])
async def get_today_absentees(
    group_id: str | None = Query(None),
    session_id: str | None = Query(None),
):
    """Return absentees across all (or filtered) sessions scheduled today."""
    if r is None:
        return {"absentees": [], "sessions": []}

    today = date_type.today()
    today_str = today.isoformat()

    # Load all sessions
    raw_sessions = r.hgetall("sessions:list")
    all_sessions: list[dict] = []
    for sid, raw in raw_sessions.items():
        sid_str = sid.decode() if isinstance(sid, bytes) else sid
        data = json.loads(raw)
        data["id"] = sid_str
        all_sessions.append(data)

    # Filter to today's sessions
    today_sessions = [s for s in all_sessions if _session_runs_on(s, today)]

    # Apply optional filters
    if group_id:
        today_sessions = [s for s in today_sessions if s.get("group_id") == group_id]
    if session_id:
        today_sessions = [s for s in today_sessions if s.get("id") == session_id]

    # Parse today's attendance logs once
    logs = _get_attendance_logs()
    today_seen: set[str] = set()  # identity keys seen today

    for entry in logs:
        parts = entry.split("@")
        if len(parts) < 3:
            continue
        name, role, timestamp_str = parts[0], parts[1], parts[2].split(".")[0]
        try:
            ts = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
        if ts.date().isoformat() != today_str:
            continue
        today_seen.add(f"{name}@{role}")

    # Build per-session absentee data
    session_results = []
    all_absentees: list[dict] = []  # flat list for convenience

    for session in today_sessions:
        gid = session.get("group_id", "")
        members = _get_group_members(gid)
        group_name = _get_group_name(gid)

        start_h, start_m = _parse_time(session.get("start_time", "00:00"))
        end_h, end_m = _parse_time(session.get("end_time", "23:59"))

        # Determine session status
        now = datetime.now()
        now_minutes = now.hour * 60 + now.minute
        start_minutes = start_h * 60 + start_m
        end_minutes = end_h * 60 + end_m

        if now_minutes < start_minutes:
            status = "upcoming"
        elif now_minutes > end_minutes:
            status = "completed"
        else:
            status = "active"

        absent_members = []
        present_count = 0
        for member in members:
            if member in today_seen:
                present_count += 1
            else:
                name_part = member.split("@")[0] if "@" in member else member
                absent_entry = {
                    "identity": member,
                    "name": name_part,
                    "session_id": session["id"],
                    "session_name": session.get("name", ""),
                    "group_name": group_name,
                    "time_range": f"{session.get('start_time', '')} – {session.get('end_time', '')}",
                }
                absent_members.append(absent_entry)
                all_absentees.append(absent_entry)

        session_results.append({
            "session_id": session["id"],
            "session_name": session.get("name", ""),
            "group_id": gid,
            "group_name": group_name,
            "start_time": session.get("start_time", ""),
            "end_time": session.get("end_time", ""),
            "status": status,
            "total_members": len(members),
            "present_count": present_count,
            "absent_count": len(absent_members),
            "absent_members": sorted(absent_members, key=lambda x: x["name"]),
        })

    return {
        "date": today_str,
        "sessions": session_results,
        "total_absent": len(all_absentees),
        "absentees": all_absentees,
    }
