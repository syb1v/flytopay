"""Optional database-backed idempotency records for lifecycle operations."""

import hashlib
import json
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, UniqueConstraint, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from flytopay.db.base import Base


class CaaSOperationRecord(Base):
    __tablename__ = "caas_operation_records"
    __table_args__ = (UniqueConstraint("operation_key", name="uq_caas_operation_key"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    operation_key: Mapped[str] = mapped_column(String(255), nullable=False)
    operation_kind: Mapped[str] = mapped_column(String(48), nullable=False)
    request_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="processing")
    provider_order_id: Mapped[str | None] = mapped_column(String(128))
    provider_card_id: Mapped[str | None] = mapped_column(String(128))
    response: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)
    updated_at: Mapped[Any] = mapped_column(DateTime(timezone=True), server_default="now()", onupdate=func.now(), nullable=False)


class IdempotencyConflict(ValueError):
    pass


def request_fingerprint(kind: str, path: str, payload: dict[str, Any]) -> str:
    raw = json.dumps({"kind": kind, "path": path, "payload": payload}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


async def get_or_create_operation(
    db: AsyncSession,
    *,
    operation_key: str,
    operation_kind: str,
    path: str,
    payload: dict[str, Any],
) -> CaaSOperationRecord:
    fingerprint = request_fingerprint(operation_kind, path, payload)
    result = await db.execute(select(CaaSOperationRecord).where(CaaSOperationRecord.operation_key == operation_key))
    record = result.scalar_one_or_none()
    if record:
        if record.request_fingerprint != fingerprint:
            raise IdempotencyConflict("CaaS idempotency key was reused with a different operation")
        return record
    record = CaaSOperationRecord(
        operation_key=operation_key,
        operation_kind=operation_kind,
        request_fingerprint=fingerprint,
    )
    db.add(record)
    await db.flush()
    return record


async def save_operation_response(db: AsyncSession, record: CaaSOperationRecord, *, status: str, response: dict[str, Any]) -> None:
    record.status = status
    record.response = response
    record.provider_order_id = response.get("orderId")
    record.provider_card_id = response.get("cardId")
    await db.flush()
