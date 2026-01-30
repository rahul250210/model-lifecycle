"""
Authentication API endpoints
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import jwt
from typing import Optional

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Secret key for JWT (change this in production!)
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# In-memory user storage (replace with database in production)
USERS_DB = {}
TOKENS_DB = {}


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None):
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"sub": user_id, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


"""
@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    ""User login endpoint - DISABLED (commented out for testing)""
    raise HTTPException(status_code=501, detail="Auth endpoints disabled for testing")
"""

"""
@router.post("/signup", response_model=LoginResponse)
def signup(request: SignupRequest):
    ""User signup endpoint - DISABLED (commented out for testing)""
    raise HTTPException(status_code=501, detail="Auth endpoints disabled for testing")
"""


@router.post("/logout")
def logout():
    """User logout endpoint"""
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_current_user(token: str):
    """Get current user info (requires token in Authorization header)"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Find user by ID
        for user in USERS_DB.values():
            if user["id"] == user_id:
                return UserResponse(
                    id=user["id"],
                    email=user["email"],
                    first_name=user["first_name"],
                    last_name=user["last_name"]
                )
        
        raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
