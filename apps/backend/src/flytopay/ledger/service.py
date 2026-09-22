from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flytopay.ledger.models import FundsReservation, LedgerEntry, Wallet


class LedgerError(ValueError):
    pass


async def get_or_create_wallet(db: AsyncSession, user_id: UUID) -> Wallet:
    result = await db.execute(select(Wallet).where(Wallet.user_id == user_id).with_for_update())
    wallet = result.scalar_one_or_none()
    if wallet is None:
        wallet = Wallet(user_id=user_id)
        db.add(wallet)
        await db.flush()
    return wallet


async def credit_wallet(db: AsyncSession, user_id: UUID, amount_minor: int, *, external_key: str, kind: str = "deposit") -> LedgerEntry:
    if amount_minor <= 0:
        raise LedgerError("Credit amount must be positive")
    wallet = await get_or_create_wallet(db, user_id)
    existing = await db.execute(select(LedgerEntry).where(LedgerEntry.external_key == external_key))
    if existing.scalar_one_or_none() is not None:
        raise LedgerError("Ledger entry already exists")
    wallet.available_minor += amount_minor
    entry = LedgerEntry(wallet_id=wallet.id, external_key=external_key, kind=kind, direction="credit", amount_minor=amount_minor, currency=wallet.currency, scale=wallet.scale, description=kind)
    db.add(entry)
    await db.flush()
    return entry


async def reserve_wallet(db: AsyncSession, user_id: UUID, amount_minor: int, *, external_key: str) -> FundsReservation:
    if amount_minor <= 0:
        raise LedgerError("Reservation amount must be positive")
    wallet = await get_or_create_wallet(db, user_id)
    if wallet.available_minor < amount_minor:
        raise LedgerError("Insufficient wallet funds")
    existing = await db.execute(select(FundsReservation).where(FundsReservation.external_key == external_key))
    if existing.scalar_one_or_none() is not None:
        raise LedgerError("Reservation already exists")
    wallet.available_minor -= amount_minor
    wallet.reserved_minor += amount_minor
    reservation = FundsReservation(wallet_id=wallet.id, external_key=external_key, amount_minor=amount_minor)
    db.add(reservation)
    await db.flush()
    return reservation


async def _active_reservation(db: AsyncSession, external_key: str) -> FundsReservation:
    result = await db.execute(select(FundsReservation).where(FundsReservation.external_key == external_key))
    reservation = result.scalar_one_or_none()
    if reservation is None:
        raise LedgerError("Reservation does not exist")
    if reservation.status != "active":
        raise LedgerError(f"Reservation is already {reservation.status}")
    return reservation


async def capture_reservation(db: AsyncSession, external_key: str, *, kind: str = "capture") -> LedgerEntry:
    """Consume an active reservation: reserved funds leave the wallet for good."""
    reservation = await _active_reservation(db, external_key)
    wallet = await db.get(Wallet, reservation.wallet_id)
    if wallet is None:
        raise LedgerError("Reservation wallet does not exist")
    if wallet.reserved_minor < reservation.amount_minor:
        raise LedgerError("Wallet reserved balance is inconsistent")
    wallet.reserved_minor -= reservation.amount_minor
    reservation.status = "captured"
    entry = LedgerEntry(
        wallet_id=wallet.id,
        external_key=f"{external_key}:capture",
        kind=kind,
        direction="debit",
        amount_minor=reservation.amount_minor,
        currency=wallet.currency,
        scale=wallet.scale,
        description=kind,
    )
    db.add(entry)
    await db.flush()
    return entry


async def release_reservation(db: AsyncSession, external_key: str) -> FundsReservation:
    """Return reserved funds to the available balance (e.g. failed operation)."""
    reservation = await _active_reservation(db, external_key)
    wallet = await db.get(Wallet, reservation.wallet_id)
    if wallet is None:
        raise LedgerError("Reservation wallet does not exist")
    if wallet.reserved_minor < reservation.amount_minor:
        raise LedgerError("Wallet reserved balance is inconsistent")
    wallet.reserved_minor -= reservation.amount_minor
    wallet.available_minor += reservation.amount_minor
    reservation.status = "released"
    await db.flush()
    return reservation


async def refund_captured(db: AsyncSession, user_id: UUID, amount_minor: int, *, external_key: str, kind: str = "refund") -> LedgerEntry:
    """Credit previously captured funds back (idempotent by external key)."""
    if amount_minor <= 0:
        raise LedgerError("Refund amount must be positive")
    existing = await db.execute(select(LedgerEntry).where(LedgerEntry.external_key == external_key))
    if existing.scalar_one_or_none() is not None:
        raise LedgerError("Refund entry already exists")
    return await credit_wallet(db, user_id, amount_minor, external_key=external_key, kind=kind)
