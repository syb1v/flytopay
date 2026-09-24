from flytopay.catalog.models import FeePolicy, ProductPrice


def test_catalog_pricing_models_are_versioned():
    assert ProductPrice.__tablename__ == "product_prices"
    assert FeePolicy.__tablename__ == "fee_policies"
    assert "effective_from" in {column.name for column in ProductPrice.__table__.columns}
