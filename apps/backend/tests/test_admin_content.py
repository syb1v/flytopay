from flytopay.content.models import Broadcast, BroadcastDelivery, ContentDocument, MessageTemplate


def test_content_models_are_available():
    assert ContentDocument.__tablename__ == "content_documents"
    assert MessageTemplate.__tablename__ == "message_templates"
    assert Broadcast.__tablename__ == "broadcasts"
    assert BroadcastDelivery.__tablename__ == "broadcast_deliveries"
