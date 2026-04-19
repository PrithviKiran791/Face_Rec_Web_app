# backend/routers/attendance.py
from fastapi import APIRouter, Depends
from face_rec import r
import pandas as pd
from auth.dependencies import require_auth

router = APIRouter()

@router.get("/logs", dependencies=[Depends(require_auth)])
async def get_logs():
    if r is None:
        return {"logs": []}
    raw = r.lrange("attendance_logs", 0, -1)
    logs = [item.decode() for item in raw]
    return {"logs": logs}

@router.delete("/clear-logs", dependencies=[Depends(require_auth)])
async def clear_logs():
    if r is None:
        return {"ok": False, "message": "Redis unavailable"}
    r.delete("attendance_logs")
    return {"ok": True, "message": "All logs cleared successfully"}


@router.get("/report", dependencies=[Depends(require_auth)])
async def get_report():
    if r is None:
        return {"report": []}
    raw = r.lrange("attendance_logs", 0, -1)
    records = []
    for item in raw:
        parts = item.decode().split("@")
        if len(parts) >= 3:
            records.append({
                "Name": parts[0], "Role": parts[1],
                "TimeStamp": parts[2].split(".")[0]
            })
    if not records:
        return {"report": []}
    df = pd.DataFrame(records)
    df["TimeStamp"] = pd.to_datetime(df["TimeStamp"], errors="coerce")
    df = df.dropna(subset=["TimeStamp"])
    df["Date"] = df["TimeStamp"].dt.date.astype(str)
    report = df.groupby(["Date","Name","Role"]).agg(
        In_time=("TimeStamp","min"),
        Out_time=("TimeStamp","max")
    ).reset_index()
    report["Duration_hours"] = (
        report["Out_time"] - report["In_time"]
    ).dt.total_seconds() / 3600
    def status(h):
        if pd.isna(h): return "Absent"
        if h < 1:  return "Absent (less than 1h)"
        if h < 4:  return "Half Day"
        return "Present"
    report["Status"] = report["Duration_hours"].apply(status)
    report["In_time"]  = report["In_time"].dt.strftime("%H:%M:%S")
    report["Out_time"] = report["Out_time"].dt.strftime("%H:%M:%S")
    return {"report": report.to_dict(orient="records")}