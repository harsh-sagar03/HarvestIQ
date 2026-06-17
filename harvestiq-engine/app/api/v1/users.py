from datetime import datetime, timezone
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.database import get_database
from app.models.user_schemas import UserProfileUpdateSchema, UserPublicResponse

router = APIRouter(prefix="/users", tags=["users"])


def _to_public_user(user: dict) -> UserPublicResponse:
    return UserPublicResponse(
        id=str(user["_id"]),
        name=user["name"],
        phone=user["phone"],
        role=user["role"],
        preferred_lang=user.get("preferred_lang", "hi"),
        onboarding_completed=user.get("onboarding_completed", False),
    )


@router.get("/me", response_model=UserPublicResponse)
async def get_me(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> UserPublicResponse:
    return _to_public_user(current_user)


@router.put("/profile", response_model=UserPublicResponse)
async def update_profile(
    payload: UserProfileUpdateSchema,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> UserPublicResponse:
    updates: dict = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.preferred_lang is not None:
        updates["preferred_lang"] = payload.preferred_lang

    if not updates:
        return _to_public_user(current_user)

    updates["updated_at"] = datetime.now(timezone.utc)
    db = get_database()
    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": updates},
    )
    updated_user = await db.users.find_one({"_id": ObjectId(current_user["_id"])})
    return _to_public_user(updated_user)
