from fastapi import Header, HTTPException, Cookie
from auth.auth_utils import decode_token


def require_auth(
    authorization: str | None = Header(default=None),
    attendance_token: str | None = Cookie(default=None),
) -> dict:
    # DEBUG: See exactly what header arrived
    print(f"DEBUG: Authorization Header: {authorization}")
    print(f"DEBUG: Cookie Token: {attendance_token}")

    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    elif attendance_token:
        token = attendance_token

    if not token:
        print("DEBUG: No token found in header or cookie")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    print(f"DEBUG: Attempting to decode token (first 20 chars): {token[:20]}...")
    payload = decode_token(token)
    
    if not payload:
        print("DEBUG: Token decoding failed (invalid, expired, or wrong key)")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
        
    print(f"DEBUG: Auth success! Payload: {payload}")
    return payload
