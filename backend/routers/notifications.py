"""
API routes for notification configuration and webhook management.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from auth.dependencies import require_auth
from services import (
    notification_service,
    webhook_manager,
    notification_config,
    NotificationType,
    WebhookEvent
)

router = APIRouter()


# ── Pydantic Models ─────────────────────────────────────────────────────────


class ContactMappingRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    parent_email: Optional[str] = None
    parent_phone: Optional[str] = None
    manager_email: Optional[str] = None
    manager_phone: Optional[str] = None


class NotificationPreferencesRequest(BaseModel):
    receive_own_notifications: bool = True
    receive_absence_notifications: bool = True
    notify_parents: bool = False
    notify_managers: bool = False
    notification_channel: str = "email"  # email, sms, both


class WebhookCreateRequest(BaseModel):
    url: str
    secret: str
    events: List[str]  # e.g., ["absence", "attendance"]
    active: bool = True


class WebhookUpdateRequest(BaseModel):
    url: Optional[str] = None
    secret: Optional[str] = None
    events: Optional[List[str]] = None
    active: Optional[bool] = None


class NotificationTestRequest(BaseModel):
    person_name: str
    session_name: str
    group_name: str
    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    notification_type: str = "email"


# ── Contact Management ──────────────────────────────────────────────────────


@router.post("/contacts")
async def update_contact_mapping(
    request: ContactMappingRequest,
    user_id: str = Depends(require_auth)
):
    """Update contact information for the user"""
    contacts = notification_config.set_contact_mapping(
        user_id,
        email=request.email,
        phone=request.phone,
        parent_email=request.parent_email,
        parent_phone=request.parent_phone,
        manager_email=request.manager_email,
        manager_phone=request.manager_phone
    )
    return {"success": True, "contacts": contacts}


@router.get("/contacts")
async def get_contact_mapping(user_id: str = Depends(require_auth)):
    """Get contact information for the user"""
    contacts = notification_config.get_contact_mapping(user_id)
    return {"contacts": contacts}


# ── Notification Preferences ────────────────────────────────────────────────


@router.post("/preferences")
async def update_notification_preferences(
    request: NotificationPreferencesRequest,
    user_id: str = Depends(require_auth)
):
    """Update notification preferences"""
    prefs = notification_config.set_user_preferences(
        user_id,
        receive_own_notifications=request.receive_own_notifications,
        receive_absence_notifications=request.receive_absence_notifications,
        notify_parents=request.notify_parents,
        notify_managers=request.notify_managers,
        notification_channel=request.notification_channel
    )
    return {"success": True, "preferences": prefs}


@router.get("/preferences")
async def get_notification_preferences(user_id: str = Depends(require_auth)):
    """Get notification preferences"""
    prefs = notification_config.get_user_preferences(user_id)
    return {"preferences": prefs}


@router.post("/unsubscribe")
async def unsubscribe_from_notification(
    event_type: str = Query(..., description="Event type to unsubscribe from"),
    user_id: str = Depends(require_auth)
):
    """Unsubscribe from a specific notification type"""
    notification_config.unsubscribe(user_id, event_type)
    return {"success": True, "message": f"Unsubscribed from {event_type}"}


# ── Test Notifications ──────────────────────────────────────────────────────


@router.post("/test")
async def test_notification(
    request: NotificationTestRequest,
    user_id: str = Depends(require_auth)
):
    """Send a test notification"""
    notification_type = NotificationType(request.notification_type)
    
    result = await notification_service.send_absence_alert(
        recipient_email=request.recipient_email,
        recipient_phone=request.recipient_phone,
        person_name=request.person_name,
        session_name=request.session_name,
        group_name=request.group_name,
        notification_type=notification_type,
        recipient_type="student"
    )
    
    return {
        "success": all(
            v.get("success", False)
            for v in [result.get("email"), result.get("sms")]
            if v
        ),
        "results": result
    }


# ── Webhook Management ──────────────────────────────────────────────────────


@router.post("/webhooks")
async def create_webhook(
    request: WebhookCreateRequest,
    user_id: str = Depends(require_auth)
):
    """Create a new webhook"""
    webhook = webhook_manager.create_webhook(
        user_id=user_id,
        url=request.url,
        secret=request.secret,
        events=request.events,
        active=request.active
    )
    return {"success": True, "webhook": webhook}


@router.get("/webhooks")
async def list_webhooks(user_id: str = Depends(require_auth)):
    """List all webhooks for the user"""
    webhooks = webhook_manager.get_webhooks(user_id)
    return {"webhooks": webhooks}


@router.put("/webhooks/{webhook_id}")
async def update_webhook(
    webhook_id: str,
    request: WebhookUpdateRequest,
    user_id: str = Depends(require_auth)
):
    """Update a webhook"""
    # Verify ownership
    webhooks = webhook_manager.get_webhooks(user_id)
    if not any(w["id"] == webhook_id for w in webhooks):
        raise HTTPException(status_code=403, detail="Webhook not found or not owned by user")
    
    updates = {}
    if request.url:
        updates["url"] = request.url
    if request.secret:
        updates["secret"] = request.secret
    if request.events:
        updates["events"] = request.events
    if request.active is not None:
        updates["active"] = request.active
    
    webhook = webhook_manager.update_webhook(webhook_id, **updates)
    return {"success": True, "webhook": webhook}


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    user_id: str = Depends(require_auth)
):
    """Delete a webhook"""
    # Verify ownership
    webhooks = webhook_manager.get_webhooks(user_id)
    if not any(w["id"] == webhook_id for w in webhooks):
        raise HTTPException(status_code=403, detail="Webhook not found or not owned by user")
    
    success = webhook_manager.delete_webhook(webhook_id, user_id)
    return {"success": success}


@router.get("/webhooks/{webhook_id}/logs")
async def get_webhook_logs(
    webhook_id: str,
    limit: int = Query(100, le=1000),
    user_id: str = Depends(require_auth)
):
    """Get delivery logs for a webhook"""
    # Verify ownership
    webhooks = webhook_manager.get_webhooks(user_id)
    if not any(w["id"] == webhook_id for w in webhooks):
        raise HTTPException(status_code=403, detail="Webhook not found or not owned by user")
    
    logs = webhook_manager.get_delivery_logs(webhook_id, limit)
    return {"logs": logs}


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(
    webhook_id: str,
    user_id: str = Depends(require_auth)
):
    """Send a test event to a webhook"""
    # Verify ownership
    webhooks = webhook_manager.get_webhooks(user_id)
    webhook = next((w for w in webhooks if w["id"] == webhook_id), None)
    if not webhook:
        raise HTTPException(status_code=403, detail="Webhook not found or not owned by user")
    
    # Create test event
    test_event = WebhookEvent(
        event_type="test",
        data={"message": "This is a test webhook event"}
    )
    
    # Queue for delivery
    await webhook_manager.queue_event(test_event, user_id)
    
    return {
        "success": True,
        "message": "Test event queued for delivery",
        "event_id": test_event.id
    }
