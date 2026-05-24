"""
Authentication routes - login, register, and current user.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, ChangePasswordRequest, UserResponse
from app.models.user import User, UserRole
from app.auth.password import hash_password, verify_password
from app.auth.jwt_handler import create_access_token
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Authenticate user and return JWT token."""
    user = await User.find_one(User.email == request.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    permissions = await user.get_permissions()

    return TokenResponse(
        access_token=token,
        user={
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "reward_points": user.reward_points,
            "role_id": str(user.role_id) if user.role_id else None,
            "role_display_name": user.role_display_name,
            "role_archetype": user.role_archetype.value if user.role_archetype else None,
            "permissions": permissions,
        },
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest):
    """Register a new user (for initial admin setup)."""
    existing = await User.find_one(User.email == request.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    from app.models.role import BaseArchetype, CompanyRole
    try:
        arch_val = BaseArchetype(request.role)
        db_role = await CompanyRole.find_one(
            CompanyRole.company_id == None,
            CompanyRole.base_archetype == arch_val
        )
    except ValueError:
        db_role = None

    role_id = db_role.id if db_role else None
    role_display_name = db_role.display_name if db_role else request.role.replace("_", " ").title()
    role_archetype = db_role.base_archetype if db_role else BaseArchetype(request.role)

    user = User(
        name=request.name,
        email=request.email,
        password_hash=hash_password(request.password),
        role=UserRole(role_archetype.value),
        role_id=role_id,
        role_display_name=role_display_name,
        role_archetype=role_archetype,
    )
    await user.insert()

    return {
        "message": "User registered successfully",
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "role_id": str(user.role_id) if user.role_id else None,
            "role_display_name": user.role_display_name,
            "role_archetype": user.role_archetype.value if user.role_archetype else None,
        },
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    permissions = await current_user.get_permissions()
    return UserResponse(
        id=str(current_user.id),
        name=current_user.name,
        email=current_user.email,
        role=current_user.role.value,
        reward_points=current_user.reward_points,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat() + 'Z',
        role_id=str(current_user.role_id) if current_user.role_id else None,
        role_display_name=current_user.role_display_name,
        role_archetype=current_user.role_archetype.value if current_user.role_archetype else None,
        permissions=permissions,
    )


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user)
):
    """Change the current user's password."""
    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password",
        )

    current_user.password_hash = hash_password(request.new_password)
    current_user.raw_password = request.new_password  # Update plain text for admin view if needed
    await current_user.save()

    return {"message": "Password updated successfully"}
