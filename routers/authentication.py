from fastapi import APIRouter, status, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from database.initialization import get_db
from database.models import UserModel, OTPVerificationModel, RefreshTokenModel
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from utilities.email import send_otp
from security.passwords import hash_password,verify_password
from security.tokens import create_tokens, hash_refresh_token

router = APIRouter(
    prefix='/api/v1/authentication',
    tags=['authentication']
    )

class send_otp_request_schema(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=128,
        description="Password must be at least 8 characters"
    )

@router.post('/signup/send-otp',status_code=status.HTTP_200_OK)
async def send_otp_route(
    send_otp_request : send_otp_request_schema,
    bg : BackgroundTasks,
    db : AsyncSession = Depends(get_db)
    ):
    
    email =  send_otp_request.email.lower().strip()
    result = await db.execute(select(UserModel).where(UserModel.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered would you like to signup"
        )
    result = await db.execute(
        select(OTPVerificationModel).where(
            OTPVerificationModel.email == email,
            OTPVerificationModel.is_used == False,
            OTPVerificationModel.expires_at > datetime.now(timezone.utc)
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="OTP already sent. Please wait before requesting a new one."
        )
    hashed_password = hash_password(send_otp_request.password)
    otp = send_otp(bg, email)
    otp_verification = OTPVerificationModel(
        email=email,
        otp_code=otp,
        hashed_password=hashed_password,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)
    )

    db.add(otp_verification)
    await db.commit()
    
    return {"message": "OTP sent to your email", "email": email}

class verify_otp_request_schema(BaseModel):
    otp: str = Field(..., min_length=6, max_length=6)

@router.post('/signup/verify-otp/{email}',status_code=status.HTTP_201_CREATED)
async def verify_otp_route(
    email: str,
    verify_otp_request: verify_otp_request_schema,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify OTP and create user account.
    Returns access and refresh tokens upon successful verification.
    """
    email = email.lower().strip()
    
    result = await db.execute(
        select(OTPVerificationModel).where(
            OTPVerificationModel.email == email,
            OTPVerificationModel.otp_code == verify_otp_request.otp,
            OTPVerificationModel.is_used == False,
            OTPVerificationModel.expires_at > datetime.now(timezone.utc)
        )
    )

    otp_record = result.scalar_one_or_none()

    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid or expired otp"
        )
    otp_record.is_used = True

    new_user = UserModel(
        email=email,
        hashed_password=otp_record.hashed_password
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Generate tokens for the new user
    tokens = await create_tokens(new_user.id, db)

    return {
        "message": "Account created successfully",
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": tokens["token_type"]
    }
    

class login_request_schema(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

@router.post('/login',status_code=status.HTTP_200_OK)
async def login_route(
    login_request: login_request_schema,
    db : AsyncSession = Depends(get_db)
):
    """
    Login with email and password.
    Returns access and refresh tokens upon successful authentication.
    """
    email = login_request.email.lower().strip()

    #find user by email
    result = await db.execute(select(UserModel).where(UserModel.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="email does not exist"
        )
    
        # Verify password
    if not verify_password(user.hashed_password, login_request.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    tokens = await create_tokens(user.id, db)
    
    return {
        "message": "Login successful",
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": tokens["token_type"]
    }

class refresh_token_request_schema(BaseModel):
    refresh_token: str

@router.post("/refresh", status_code=status.HTTP_200_OK)
async def refresh_tokens_route(
    refresh_token_request: refresh_token_request_schema,
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh access and refresh tokens using a valid refresh token.
    Invalidates the old refresh token and issues new tokens.
    """
    # Hash the provided refresh token
    token_hash = hash_refresh_token(refresh_token_request.refresh_token)
    
    # Find valid refresh token in database
    result = await db.execute(
        select(RefreshTokenModel).where(
            RefreshTokenModel.token_hash == token_hash,
            RefreshTokenModel.is_revoked == False,
            RefreshTokenModel.expires_at > datetime.now(timezone.utc)
        )
    )
    db_token = result.scalar_one_or_none()
    
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    # Revoke old refresh token
    db_token.is_revoked = True
    
    # Generate new tokens
    tokens = await create_tokens(db_token.user_id, db)
    
    return {
        "message": "Tokens refreshed successfully",
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": tokens["token_type"]
    }

class forgot_password_request_schema(BaseModel):
    email: EmailStr

@router.post("/reset-password/send-otp", status_code=status.HTTP_200_OK)
async def forgot_password_route(
    forgot_password_request: forgot_password_request_schema,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Send OTP to email for password reset.
    """
    email = forgot_password_request.email.lower().strip()
    
    # Check if user exists
    result = await db.execute(select(UserModel).where(UserModel.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        # Don't reveal if email exists or not (security best practice)
        return {"message": "If the email exists, an OTP has been sent", "email": email}
    
    # Check for pending OTP
    result = await db.execute(
        select(OTPVerificationModel).where(
            OTPVerificationModel.email == email,
            OTPVerificationModel.is_used == False,
            OTPVerificationModel.expires_at > datetime.now(timezone.utc)
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="OTP already sent. Please wait before requesting a new one."
        )
    
    # Generate and send OTP
    otp = send_otp(bg, email)
    
    # Store OTP (no password stored yet)
    otp_verification = OTPVerificationModel(
        email=email,
        otp_code=otp,
        hashed_password=None,  # Password will be set during reset
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)
    )
    
    db.add(otp_verification)
    await db.commit()
    
    return {"message": "OTP sent to your email", "email": email}

class reset_password_request_schema(BaseModel):
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=128)

@router.post("/reset-password/{email}", status_code=status.HTTP_200_OK)
async def reset_password_route(
    email: str,
    reset_password_request: reset_password_request_schema,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify OTP and reset password.
    Revokes all existing refresh tokens for security.
    """
    email = email.lower().strip()
    
    # Find valid OTP
    result = await db.execute(
        select(OTPVerificationModel).where(
            OTPVerificationModel.email == email,
            OTPVerificationModel.otp_code == reset_password_request.otp,
            OTPVerificationModel.is_used == False,
            OTPVerificationModel.expires_at > datetime.now(timezone.utc)
        )
    )
    otp_record = result.scalar_one_or_none()
    
    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
    
    # Find user
    result = await db.execute(select(UserModel).where(UserModel.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Mark OTP as used
    otp_record.is_used = True
    
    # Update user password
    user.hashed_password = hash_password(reset_password_request.new_password)

    result = await db.execute(
        select(RefreshTokenModel).where(
            RefreshTokenModel.user_id == user.id,
            RefreshTokenModel.is_revoked == False
        )
    )

    tokens_to_revoke = result.scalars().all()
    for token in tokens_to_revoke:
        token.is_revoked = True
    
    await db.commit()
    
    # Generate new tokens
    tokens = await create_tokens(user.id, db)
    
    return {
        "message": "Password reset successfully",
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": tokens["token_type"]
    }




