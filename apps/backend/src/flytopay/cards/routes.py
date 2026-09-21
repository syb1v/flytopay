from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.auth.session import current_user_id
from flytopay.cards.models import CardProduct, Rental, UserCard
from flytopay.cards.schemas import CardResponse, ProductResponse, RentalResponse
from flytopay.db.session import get_db

router = APIRouter(prefix="/api/v1", tags=["Cards"])


@router.get("/catalog/products", response_model=list[ProductResponse])
async def products(db: Annotated[AsyncSession, Depends(get_db)]) -> list[ProductResponse]:
    # Publishing a product requires an explicit program mapping and approved tariff.
    result = await db.execute(select(CardProduct).where(CardProduct.enabled.is_(True)).order_by(CardProduct.created_at))
    return [ProductResponse.model_validate(item) for item in result.scalars()]


@router.get("/cards", response_model=list[CardResponse])
async def cards(user_id: Annotated[UUID, Depends(current_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> list[CardResponse]:
    result = await db.execute(select(UserCard).where(UserCard.user_id == user_id).order_by(UserCard.created_at.desc()))
    return [CardResponse.model_validate(item) for item in result.scalars()]


@router.get("/rentals", response_model=list[RentalResponse])
async def rentals(user_id: Annotated[UUID, Depends(current_user_id)], db: Annotated[AsyncSession, Depends(get_db)]) -> list[RentalResponse]:
    result = await db.execute(select(Rental).where(Rental.user_id == user_id).order_by(Rental.created_at.desc()))
    return [RentalResponse.model_validate(item) for item in result.scalars()]
