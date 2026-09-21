from typing import Literal

from pydantic import BaseModel, ConfigDict

Language = Literal["ru", "en"]
DisplayCurrency = Literal["USD", "RUB"]


class PreferencesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    language: Language
    display_currency: DisplayCurrency
    telegram_notifications_enabled: bool
    payment_notifications_enabled: bool
    rental_notifications_enabled: bool


class PreferencesPatch(BaseModel):
    language: Language | None = None
    display_currency: DisplayCurrency | None = None
    telegram_notifications_enabled: bool | None = None
    payment_notifications_enabled: bool | None = None
    rental_notifications_enabled: bool | None = None
