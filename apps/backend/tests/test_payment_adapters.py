import base64
import hashlib
import hmac

from flytopay.payments.pay2328 import Pay2328Client


def test_pay2328_signature_matches_provider_algorithm(monkeypatch) -> None:
    monkeypatch.setenv("PAY2328_API_KEY", "secret")
    monkeypatch.setenv("PAY2328_PROJECT_UUID", "project")
    from flytopay.config import get_settings
    get_settings.cache_clear()
    client = Pay2328Client()
    body = '{"uuid":"payment-1"}'
    expected = hmac.new(b"secret", base64.b64encode(body.encode()), hashlib.sha256).hexdigest()
    assert client.sign_body(body) == expected


def test_pay2328_webhook_rejects_tampering(monkeypatch) -> None:
    monkeypatch.setenv("PAY2328_API_KEY", "secret")
    monkeypatch.setenv("PAY2328_PROJECT_UUID", "project")
    from flytopay.config import get_settings
    get_settings.cache_clear()
    client = Pay2328Client()
    assert client.verify_webhook({"uuid": "payment-1", "status": "paid", "sign": "bad"}) is False
