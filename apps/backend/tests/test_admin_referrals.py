from flytopay.referrals.models import PayoutRequest, ReferralLedgerEntry, ReferralLink, ReferralSetting


def test_referral_models_are_available():
    assert ReferralSetting.__tablename__ == "referral_settings"
    assert ReferralLink.__tablename__ == "referral_links"
    assert ReferralLedgerEntry.__tablename__ == "referral_ledger"
    assert PayoutRequest.__tablename__ == "referral_payout_requests"
