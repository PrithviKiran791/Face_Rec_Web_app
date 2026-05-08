import os
import sys
from unittest.mock import MagicMock

# Force headless mode
os.environ["MPLBACKEND"] = "Agg"

# Mock the specific insightface module that imports matplotlib
# This prevents insightface from ever trying to load matplotlib.pyplot
sys.modules["insightface.thirdparty.face3d.mesh.vis"] = MagicMock()

# Disable Albumentations version check to avoid timeout warnings
os.environ["ALBUMENTATIONS_DISABLE_VERSION_CHECK"] = "1"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import register, attendance, websocket, groups, sessions, absentees
from auth.router import router as auth_router

app = FastAPI(title="Face Attendance API")

import os

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"http://192\.168\.\d+\.\d+:3000",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,   # ← REQUIRED: allows cookies to be sent cross-origin
)

# ── Public routes (no auth needed) ────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])

# ── Protected routes (require valid JWT cookie) ────────────────────────────────
app.include_router(register.router,   prefix="/api/register",   tags=["Register"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])
app.include_router(groups.router,     prefix="/api/groups",     tags=["Groups"])
app.include_router(sessions.router,   prefix="/api/sessions",   tags=["Sessions"])
app.include_router(absentees.router,  prefix="/api/absentees",  tags=["Absentees"])
app.include_router(websocket.router,  prefix="/ws",             tags=["WebSocket"])


@app.get("/api/health")
def health():
    from face_rec import r
    return {"api": "ok", "redis": "connected" if r else "disconnected"}