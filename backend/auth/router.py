# backend/auth/router.py
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie
from pydantic import BaseModel
from datetime import timedelta
from .auth_utils import authenticate_user, create_access_token, decode_token, load_config
from .dependencies import require_auth

router = APIRouter()

_COOKIE_NAME = load_config()["cookie"]["name"]
_COOKIE_MAX_AGE = load_config()["cookie"].get("expiry_days", 30) * 24 * 3600

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login")
def login(body: LoginRequest, response: Response):
    user = authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    token = create_access_token({"sub": user["username"], "name": user["name"]})

    # Set path="/" so the cookie is visible to the dashboard and middleware
    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,
        path="/",
        max_age=_COOKIE_MAX_AGE,
    )
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user["username"],
        "name": user["name"],
    }

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(_COOKIE_NAME, path="/")
    return {"message": "Logged out"}

@router.get("/me")
def get_me(user: dict = Depends(require_auth)):
    return user

@router.get("/ws-token")
def get_ws_token(user: dict = Depends(require_auth)):
    # Create a short-lived token (5 mins) for WS handshake
    # Clerk uses "sub" for the user ID; we use it as a fallback for name
    token = create_access_token(
        {"sub": user["sub"], "name": user.get("name", user["sub"])}, 
        expires_delta=timedelta(minutes=5)
    )
    return {"ws_token": token}
