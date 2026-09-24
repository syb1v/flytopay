from flytopay.finance_admin.models import RefundRequest


def test_refund_request_model_is_separate_from_ledger():
    assert RefundRequest.__tablename__ == "refund_requests"
    assert "payment_attempt_id" in RefundRequest.__table__.columns
