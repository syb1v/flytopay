"""Idempotently create demo cards, wallet balance, and transactions for admin users."""

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select

from flytopay.cards.models import CardProduct, UserCard
from flytopay.cards.transactions import CardTransactionRecord
from flytopay.db.models import TelegramAccount, User
from flytopay.db.session import session_factory
from flytopay.ledger.models import Wallet

TARGETS = (6621336241, 6499614618)
WALLET_BALANCE_MINOR = 250_00

DEMO_PRODUCTS = (
    {"code": "demo-premium", "name": "Premium", "scheme": "visa", "suffix": "8820", "balance": 150_00},
    {"code": "demo-travel", "name": "Travel", "scheme": "mastercard", "suffix": "6051", "balance": 320_50},
    {"code": "demo-subs", "name": "Subscriptions", "scheme": "visa", "suffix": "2048", "balance": 45_00},
)
TRANSACTION_TEMPLATES = (
    (
        ("settlement", "completed", 2143, 25, "OPENAI *CHATGPT SUBSCR", None, "US"),
        ("settlement", "declined", 2203, 0, "ANTHROPIC* CLAUDE SUB", "insufficient_funds", "US"),
        ("topup", "completed", 5000, 0, None, None, None),
    ),
    (
        ("settlement", "completed", 899, 30, "BOOKING.COM LISBON", None, "PT"),
        ("settlement", "completed", 2450, 35, "UBER *TRIP HELP.UBER", None, "PT"),
        ("refund", "completed", 899, 0, "BOOKING.COM LISBON", None, "PT"),
    ),
    (
        ("settlement", "completed", 599, 0, "SPOTIFY USA", None, "US"),
        ("settlement", "completed", 1399, 0, "NETFLIX.COM", None, "US"),
        ("settlement", "declined", 2299, 0, "APPLE.COM/BILL", "do_not_honor", "US"),
        ("topup", "completed", 1300, 0, None, None, None),
    ),
)


def _occurred(days_ago: int, hour: int) -> datetime:
    return datetime.now(UTC) - timedelta(days=days_ago) + timedelta(hours=hour)


async def _ensure_products(db) -> dict[str, CardProduct]:
    products: dict[str, CardProduct] = {}
    for template in DEMO_PRODUCTS:
        product = (await db.execute(select(CardProduct).where(CardProduct.code == template["code"]))).scalar_one_or_none()
        if product is None:
            product = CardProduct(id=uuid4(), code=template["code"], name=template["name"], scheme=template["scheme"], currency="USD", provider_code="demo", enabled=True)
            db.add(product)
            await db.flush()
        products[template["code"]] = product
    return products


async def _ensure_user(db, telegram_id: int):
    account = (await db.execute(select(TelegramAccount).where(TelegramAccount.telegram_id == telegram_id))).scalar_one_or_none()
    if account is None:
        user = User(id=uuid4())
        db.add(user)
        await db.flush()
        account = TelegramAccount(user_id=user.id, telegram_id=telegram_id)
        db.add(account)
        await db.flush()
    return account


async def seed() -> None:
    async with session_factory() as db:
        products = await _ensure_products(db)
        for telegram_id in TARGETS:
            account = await _ensure_user(db, telegram_id)

            wallet = (await db.execute(select(Wallet).where(Wallet.user_id == account.user_id))).scalar_one_or_none()
            if wallet is None:
                wallet = Wallet(user_id=account.user_id, available_minor=WALLET_BALANCE_MINOR)
                db.add(wallet)
            else:
                wallet.available_minor = WALLET_BALANCE_MINOR

            for index, template in enumerate(DEMO_PRODUCTS):
                product = products[template["code"]]
                card = (
                    await db.execute(
                        select(UserCard).where(UserCard.user_id == account.user_id, UserCard.is_demo.is_(True), UserCard.last_four == template["suffix"])
                    )
                ).scalar_one_or_none()
                if card is None:
                    card = UserCard(
                        user_id=account.user_id,
                        product_id=product.id,
                        provider_card_id=f"demo-{telegram_id}-{template['code']}",
                        status="active",
                        masked_pan=f"•••• •••• •••• {template['suffix']}",
                        last_four=template["suffix"],
                        balance_minor=template["balance"],
                        currency="USD",
                        scale=2,
                        is_demo=True,
                    )
                    db.add(card)
                    await db.flush()
                else:
                    card.balance_minor = template["balance"]
                    card.status = "active"

                existing_tx = (
                    await db.execute(select(CardTransactionRecord).where(CardTransactionRecord.card_id == card.id).limit(1))
                ).scalar_one_or_none()
                if existing_tx is None:
                    templates = TRANSACTION_TEMPLATES[index]
                    for position, (tx_type, status, amount, fee, merchant, decline, country) in enumerate(templates):
                        db.add(
                            CardTransactionRecord(
                                card_id=card.id,
                                type=tx_type,
                                status=status,
                                amount_minor=amount,
                                fee_minor=fee,
                                merchant_name=merchant,
                                merchant_country=country,
                                decline_code=decline,
                                occurred_at=_occurred(days_ago=30 - position * 7, hour=9 + position),
                            )
                        )
        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())
