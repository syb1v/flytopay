from flytopay.marketing.models import Campaign, CampaignEvent, PromoCode, PromoGroup, PromoRedemption


def test_marketing_models_are_available():
    assert Campaign.__tablename__ == "marketing_campaigns"
    assert CampaignEvent.__tablename__ == "marketing_campaign_events"
    assert PromoCode.__tablename__ == "promo_codes"
    assert PromoGroup.__tablename__ == "promo_groups"
    assert PromoRedemption.__tablename__ == "promo_redemptions"
