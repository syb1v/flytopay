from flytopay.telegram.admin import is_admin


def test_admin_allowlist_rejects_unknown_id(monkeypatch):
    monkeypatch.setenv("TELEGRAM_ADMIN_IDS", "6621336241,6499614618")
    from flytopay.config import get_settings
    get_settings.cache_clear()
    assert is_admin(6621336241)
    assert is_admin(6499614618)
    assert not is_admin(1)
    assert not is_admin(None)
