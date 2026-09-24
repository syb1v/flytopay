"""Alembic environment for Flytopay."""

import os

from alembic import context
from sqlalchemy import engine_from_config, pool

from flytopay.admin_security import models as admin_security_models  # noqa: F401
from flytopay.cards import models as card_models  # noqa: F401
from flytopay.db import models  # noqa: F401
from flytopay.db.base import Base
from flytopay.integrations.caas2328.persistence import CaaSOperationRecord  # noqa: F401
from flytopay.issuance import models as issuance_models  # noqa: F401
from flytopay.admin_platform import models as admin_platform_models  # noqa: F401
from flytopay.catalog import models as catalog_models  # noqa: F401
from flytopay.content import models as content_models  # noqa: F401
from flytopay.ledger import models as ledger_models  # noqa: F401
from flytopay.marketing import models as marketing_models  # noqa: F401
from flytopay.payments import models as payment_models  # noqa: F401

config = context.config
if os.getenv("DATABASE_URL"):
    config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"].replace("postgresql+asyncpg:", "postgresql+psycopg:").replace("%", "%%"))
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
