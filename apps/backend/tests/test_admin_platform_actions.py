"""Unit guards for admin platform control-plane logic."""

import re

from flytopay.admin_platform.operations import SECRET_LIKE
from flytopay.admin_platform.permissions import ADMIN_PERMISSIONS
from flytopay.api.maintenance import ALLOWED_PREFIXES
from flytopay.content.broadcasts import SEGMENTS, normalize_audience
from flytopay.finance_admin.routes import REFUND_TRANSITIONS


def test_permission_catalog_is_unique_and_stable():
    names = [name for name, _ in ADMIN_PERMISSIONS]
    assert len(names) == len(set(names))
    assert "admin.broadcasts.send" in names
    assert "admin.refunds.write" in names


def test_refund_transitions_form_a_linear_flow():
    assert REFUND_TRANSITIONS["approve"] == ("pending", "approved")
    assert REFUND_TRANSITIONS["reject"] == ("pending", "rejected")
    assert REFUND_TRANSITIONS["process"] == ("approved", "processing")
    assert REFUND_TRANSITIONS["complete"] == ("processing", "completed")


def test_secret_like_setting_keys_are_rejected():
    assert SECRET_LIKE.search("platega_secret")
    assert SECRET_LIKE.search("CAAS_API_KEY")
    assert SECRET_LIKE.search("webhook_token")
    assert not SECRET_LIKE.search("commission_rate")
    assert not SECRET_LIKE.search("default_currency")


def test_broadcast_audience_normalization_clamps_unknown_segments():
    assert normalize_audience(None) == {"segment": "all"}
    assert normalize_audience({"segment": "active"}) == {"segment": "active"}
    assert normalize_audience({"segment": "hacked"}) == {"segment": "all"}
    assert SEGMENTS == {"all", "active", "blocked"}


def test_maintenance_prefixes_keep_control_plane_reachable():
    for prefix in ("/health", "/api/v1/admin", "/api/v1/auth", "/api/v1/webhooks"):
        assert any(prefix.startswith(allowed) or allowed.startswith(prefix) for allowed in ALLOWED_PREFIXES)


def test_feature_flag_key_pattern_accepts_domain_keys():
    pattern = re.compile(r"[a-z0-9_.-]{2,128}")
    assert pattern.fullmatch("cards.demo")
    assert pattern.fullmatch("payments.new-provider")
    assert not pattern.fullmatch("Bad Key")
