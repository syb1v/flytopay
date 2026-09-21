from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status

from flytopay.preferences.schemas import PreferencesPatch, PreferencesResponse

router = APIRouter(prefix="/api/v1/me/preferences", tags=["Preferences"])


async def current_user_id(x_user_id: str | None = Header(default=None)) -> UUID:
    if not x_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        return UUID(x_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session") from exc


@router.get("", response_model=PreferencesResponse)
async def get_preferences(user_id: Annotated[UUID, Depends(current_user_id)]) -> PreferencesResponse:
    return PreferencesResponse(language="ru", display_currency="USD", telegram_notifications_enabled=True, payment_notifications_enabled=True, rental_notifications_enabled=True)


@router.patch("", response_model=PreferencesResponse)
async def patch_preferences(payload: PreferencesPatch, user_id: Annotated[UUID, Depends(current_user_id)]) -> PreferencesResponse:
    values = payload.model_dump(exclude_none=True)
    return PreferencesResponse(language=values.get("language", "ru"), display_currency=values.get("display_currency", "USD"), telegram_notifications_enabled=values.get("telegram_notifications_enabled", True), payment_notifications_enabled=values.get("payment_notifications_enabled", True), rental_notifications_enabled=values.get("rental_notifications_enabled", True))
