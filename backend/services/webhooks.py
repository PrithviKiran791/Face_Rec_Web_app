"""
Webhook service for piping attendance data to external systems.
Supports multiple webhook endpoints with retry logic and signing.
"""

import os
import json
import hmac
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional, Any
import asyncio

logger = logging.getLogger(__name__)


class WebhookEvent:
    """Represents a webhook event"""
    
    ABSENCE = "absence"
    ATTENDANCE = "attendance"
    SESSION_START = "session.started"
    SESSION_END = "session.ended"
    
    def __init__(
        self,
        event_type: str,
        data: dict,
        webhook_id: Optional[str] = None
    ):
        self.id = f"{datetime.now().isoformat()}-{hash(str(data)) % 10000}"
        self.event_type = event_type
        self.data = data
        self.timestamp = datetime.now().isoformat()
        self.webhook_id = webhook_id
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.event_type,
            "timestamp": self.timestamp,
            "data": self.data
        }


class WebhookDeliveryLog:
    """Tracks webhook delivery attempts"""
    
    def __init__(self, webhook_id: str, event_id: str):
        self.webhook_id = webhook_id
        self.event_id = event_id
        self.attempts = []
        self.last_attempt = None
        self.next_retry = None
        self.status = "pending"  # pending, delivered, failed, cancelled
    
    def add_attempt(self, status_code: int, response: str, error: Optional[str] = None):
        """Record a delivery attempt"""
        self.attempts.append({
            "timestamp": datetime.now().isoformat(),
            "status_code": status_code,
            "response": response[:500],  # Limit response size
            "error": error
        })
        self.last_attempt = datetime.now()
        
        if status_code >= 200 and status_code < 300:
            self.status = "delivered"
        elif len(self.attempts) < 5:  # Max 5 retries
            # Exponential backoff: 5s, 25s, 125s, 625s, 3125s
            retry_count = len(self.attempts) - 1
            delay_seconds = 5 * (5 ** retry_count)
            self.next_retry = self.last_attempt + timedelta(seconds=delay_seconds)
            self.status = "pending_retry"
        else:
            self.status = "failed"
    
    def to_dict(self) -> dict:
        return {
            "webhook_id": self.webhook_id,
            "event_id": self.event_id,
            "status": self.status,
            "attempts": len(self.attempts),
            "last_attempt": self.last_attempt.isoformat() if self.last_attempt else None,
            "next_retry": self.next_retry.isoformat() if self.next_retry else None,
            "history": self.attempts
        }


class WebhookManager:
    """Manages webhooks and deliveries"""
    
    def __init__(self):
        self.redis = None
        self.webhooks_prefix = "webhooks:"
        self.delivery_logs_prefix = "webhook_logs:"
        self.events_queue = "webhook_events"
    
    def set_redis(self, redis_client):
        """Set Redis client"""
        self.redis = redis_client
    
    def create_webhook(
        self,
        user_id: str,
        url: str,
        secret: str,
        events: list[str],
        active: bool = True
    ) -> dict:
        """Create a new webhook"""
        if not self.redis:
            return {"error": "Redis unavailable"}
        
        webhook_id = f"{user_id}_{datetime.now().timestamp()}".replace(".", "_")
        
        webhook = {
            "id": webhook_id,
            "user_id": user_id,
            "url": url,
            "secret": secret,
            "events": events,
            "active": active,
            "created_at": datetime.now().isoformat(),
            "deliveries": 0,
            "failures": 0,
            "last_delivery": None
        }
        
        self.redis.hset(
            f"{self.webhooks_prefix}list",
            webhook_id,
            json.dumps(webhook)
        )
        
        # Index by user for quick lookup
        self.redis.sadd(f"{self.webhooks_prefix}user:{user_id}", webhook_id)
        
        logger.info(f"Created webhook {webhook_id} for user {user_id}")
        return webhook
    
    def get_webhooks(self, user_id: str) -> list[dict]:
        """Get all webhooks for a user"""
        if not self.redis:
            return []
        
        webhook_ids = self.redis.smembers(f"{self.webhooks_prefix}user:{user_id}")
        webhooks = []
        
        for webhook_id in webhook_ids:
            wid = webhook_id.decode() if isinstance(webhook_id, bytes) else webhook_id
            raw = self.redis.hget(f"{self.webhooks_prefix}list", wid)
            if raw:
                webhooks.append(json.loads(raw))
        
        return webhooks
    
    def update_webhook(self, webhook_id: str, **kwargs) -> Optional[dict]:
        """Update webhook configuration"""
        if not self.redis:
            return None
        
        raw = self.redis.hget(f"{self.webhooks_prefix}list", webhook_id)
        if not raw:
            return None
        
        webhook = json.loads(raw)
        webhook.update(kwargs)
        
        self.redis.hset(
            f"{self.webhooks_prefix}list",
            webhook_id,
            json.dumps(webhook)
        )
        
        return webhook
    
    def delete_webhook(self, webhook_id: str, user_id: str) -> bool:
        """Delete a webhook"""
        if not self.redis:
            return False
        
        self.redis.hdel(f"{self.webhooks_prefix}list", webhook_id)
        self.redis.srem(f"{self.webhooks_prefix}user:{user_id}", webhook_id)
        
        logger.info(f"Deleted webhook {webhook_id}")
        return True
    
    async def queue_event(self, event: WebhookEvent, user_id: str):
        """Queue an event for delivery"""
        if not self.redis:
            return
        
        # Find webhooks that should receive this event
        webhooks = self.get_webhooks(user_id)
        
        for webhook in webhooks:
            if not webhook.get("active"):
                continue
            
            if event.event_type not in webhook.get("events", []):
                continue
            
            # Queue for delivery
            event.webhook_id = webhook["id"]
            queue_entry = {
                "webhook_id": webhook["id"],
                "event": event.to_dict(),
                "url": webhook["url"],
                "secret": webhook["secret"],
                "queued_at": datetime.now().isoformat()
            }
            
            self.redis.rpush(
                self.events_queue,
                json.dumps(queue_entry)
            )
            
            logger.info(f"Queued event {event.id} for webhook {webhook['id']}")
    
    async def deliver_webhook(
        self,
        webhook_url: str,
        webhook_secret: str,
        event: dict,
        delivery_log: WebhookDeliveryLog
    ) -> bool:
        """Deliver a webhook with signature"""
        try:
            import httpx
            
            # Create signature
            payload = json.dumps(event)
            signature = hmac.new(
                webhook_secret.encode(),
                payload.encode(),
                hashlib.sha256
            ).hexdigest()
            
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    webhook_url,
                    json=event,
                    headers={
                        "X-Webhook-Signature": f"sha256={signature}",
                        "X-Webhook-ID": delivery_log.event_id,
                        "Content-Type": "application/json"
                    }
                )
                
                delivery_log.add_attempt(
                    response.status_code,
                    response.text
                )
                
                return response.status_code >= 200 and response.status_code < 300
                
        except Exception as e:
            logger.error(f"Webhook delivery error: {str(e)}")
            delivery_log.add_attempt(0, "", str(e))
            return False
    
    def get_delivery_logs(self, webhook_id: str, limit: int = 100) -> list[dict]:
        """Get recent delivery logs for a webhook"""
        if not self.redis:
            return []
        
        raw_logs = self.redis.lrange(
            f"{self.delivery_logs_prefix}{webhook_id}",
            -limit,
            -1
        )
        
        logs = []
        for raw in raw_logs:
            try:
                logs.append(json.loads(raw))
            except:
                pass
        
        return logs
    
    def log_delivery(self, webhook_id: str, delivery_log: WebhookDeliveryLog):
        """Log a webhook delivery"""
        if not self.redis:
            return
        
        self.redis.rpush(
            f"{self.delivery_logs_prefix}{webhook_id}",
            json.dumps(delivery_log.to_dict())
        )
        
        # Keep only last 500 logs per webhook
        self.redis.ltrim(
            f"{self.delivery_logs_prefix}{webhook_id}",
            -500,
            -1
        )


# Global instance
webhook_manager = WebhookManager()
