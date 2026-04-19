import yaml
from pathlib import Path
import bcrypt
import os
import json
import urllib.request
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Load .env
load_dotenv()

# ── Load config.yaml ──────────────────────────────────────────────────────────
CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"

def load_config() -> dict:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)

# ── Clerk JWT Setup ───────────────────────────────────────────────────────────
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL")
_jwks_cache = None
_jwks_last_fetch = None

def get_jwks():
    global _jwks_cache, _jwks_last_fetch
    now = datetime.now()
    if _jwks_cache and _jwks_last_fetch and (now - _jwks_last_fetch).total_seconds() < 3600:
        return _jwks_cache
    
    print(f"DEBUG: Fetching JWKS from Clerk: {CLERK_JWKS_URL}")
    if not CLERK_JWKS_URL:
        print("ERROR: CLERK_JWKS_URL is not set in environment!")
        return None

    try:
        req = urllib.request.Request(CLERK_JWKS_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            _jwks_cache = json.loads(response.read().decode())
            _jwks_last_fetch = now
            print("DEBUG: Successfully fetched JWKS")
            return _jwks_cache
    except Exception as e:
        print(f"ERROR: Failed to fetch JWKS from {CLERK_JWKS_URL}: {e}")
        return None

# ── Crypto setup (Legacy support for WS tokens) ──────────────────────────────
ALGORITHM = "HS256"

def _secret_key() -> str:
    return load_config()["cookie"]["key"]

def _expire_days() -> int:
    return int(load_config()["cookie"].get("expiry_days", 30))

# ── Password helpers (Direct bcrypt usage) ────────────────────────────────────
def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def authenticate_user(username: str, password: str) -> dict | None:
    config = load_config()
    users = config.get("credentials", {}).get("usernames", {})
    user = users.get(username)
    
    if not user or not verify_password(password, user["password"]):
        return None
    return {
        "username": username,
        "name": user["name"],
        "email": user["email"],
    }

# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Used for short-lived WebSocket tokens."""
    payload = data.copy()
    if expires_delta:
        payload["exp"] = datetime.now(timezone.utc) + expires_delta
    else:
        payload["exp"] = datetime.now(timezone.utc) + timedelta(days=_expire_days())
    return jwt.encode(payload, _secret_key(), algorithm=ALGORITHM)

def decode_token(token: str) -> dict | None:
    """Decodes either a Clerk RS256 token or a legacy HS256 token."""
    try:
        # 1. Try Clerk Verification (RS256)
        jwks = get_jwks()
        if jwks:
            try:
                # Clerk tokens are RS256
                return jwt.decode(token, jwks, algorithms=["RS256"], options={"verify_aud": False})
            except Exception as e:
                print(f"DEBUG: RS256 decoding failed: {e}")
                # If RS256 fails, fall back to HS256
                pass
        
        # 2. Fallback to Legacy HS256 (for internal WS tokens)
        return jwt.decode(token, _secret_key(), algorithms=[ALGORITHM])
    except JWTError:
        return None
