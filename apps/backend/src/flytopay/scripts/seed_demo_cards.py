"""Idempotently create explicitly marked demo cards for configured Telegram users."""

import asyncio
from uuid import uuid4

from sqlalchemy import select

from flytopay.cards.models import CardProduct, UserCard
from flytopay.db.models import TelegramAccount, User
from flytopay.db.session import session_factory

TARGETS = (6621336241, 6499614618)


async def seed() -> None:
    async with session_factory() as db:
        product = (await db.execute(select(CardProduct).where(CardProduct.code == "demo-usd-visa"))).scalar_one_or_none()
        if product is None:
            product = CardProduct(id=uuid4(), code="demo-usd-visa", name="Demo USD Visa", scheme="visa", currency="USD", provider_code="demo", enabled=False)
            db.add(product)
            await db.flush()
        for telegram_id in TARGETS:
            account = (await db.execute(select(TelegramAccount).where(TelegramAccount.telegram_id == telegram_id))).scalar_one_or_none()
            if account is None:
                user = User(id=uuid4())
                db.add(user)
                await db.flush()
                account = TelegramAccount(user_id=user.id, telegram_id=telegram_id)
                db.add(account)
                await db.flush()
            card = (await db.execute(select(UserCard).where(UserCard.user_id == account.user_id, UserCard.is_demo.is_(True)))).scalar_one_or_none()
            if card is None:
                db.add(UserCard(user_id=account.user_id, product_id=product.id, provider_card_id=f"demo-{telegram_id}", status="active", masked_pan="•••• •••• •••• 2048", last_four="2048", balance_minor=4500, currency="USD", scale=2, is_demo=True))
        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())
