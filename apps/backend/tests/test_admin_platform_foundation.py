from flytopay.admin_platform.models import (
    AdminErrorEvent,
    AdminIdempotencyKey,
    AdminJob,
    FeatureFlag,
    SystemSetting,
)
from flytopay.admin_platform.permissions import ADMIN_PERMISSIONS


def test_foundation_models_and_permission_catalog_are_defined():
    assert FeatureFlag.__tablename__ == "feature_flags"
    assert SystemSetting.__tablename__ == "system_settings"
    assert AdminIdempotencyKey.__tablename__ == "admin_idempotency_keys"
    assert AdminJob.__tablename__ == "admin_jobs"
    assert AdminErrorEvent.__tablename__ == "admin_error_events"
    names = {name for name, _ in ADMIN_PERMISSIONS}
    assert {"admin.sales.read", "admin.prices.write", "admin.broadcasts.send"} <= names
