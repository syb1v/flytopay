from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.auth.session import current_user_id
from flytopay.db.models import UserPreference
from flytopay.db.session import get_db
from flytopay.preferences.schemas import PreferencesPatch, PreferencesResponse

router = APIRouter(prefix="/api/v1/me/preferences", tags=["Preferences"])


@router.get("", response_model=PreferencesResponse)
async def get_preferences(user_id: Annotated[UUID, Depends(current_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> PreferencesResponse:
    result = await db.execute(select(UserPreference).where(UserPreference.user_id == user_id))
    preference = result.scalar_one_or_none()
    if preference is None:
        preference = UserPreference(user_id=user_id)
        db.add(preference)
        await db.commit()
        await db.refresh(preference)
    return PreferencesResponse.model_validate(preference)


@router.patch("", response_model=PreferencesResponse)
async def patch_preferences(payload: PreferencesPatch, user_id: Annotated[UUID, Depends(current_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> PreferencesResponse:
    result = await db.execute(select(UserPreference).where(UserPreference.user_id == user_id))
    preference = result.scalar_one_or_none() or UserPreference(user_id=user_id)
    values = payload.model_dump(exclude_none=True)
    for key, value in values.items():
        setattr(preference, key, value)
    db.add(preference)
    await db.commit()
    await db.refresh(preference)
    return PreferencesResponse.model_validate(preference)
