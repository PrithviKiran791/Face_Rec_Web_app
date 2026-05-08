"""
Notification settings and contact management.
Configure who receives what notifications and how.
"""

import json
import logging
from typing import Optional, Dict, List
from enum import Enum

logger = logging.getLogger(__name__)


class NotificationChannel(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    BOTH = "both"
    NONE = "none"


class NotificationEvent(str, Enum):
    """Types of events that can trigger notifications"""
    ABSENCE = "absence"
    LATE_ARRIVAL = "late_arrival"
    EARLY_DEPARTURE = "early_departure"
    HALF_DAY = "half_day"


class NotificationConfig:
    """Manages notification settings per organization/user"""
    
    def __init__(self):
        self.redis = None
        self.config_prefix = "notification_config:"
    
    def set_redis(self, redis_client):
        self.redis = redis_client
    
    def set_org_settings(
        self,
        org_id: str,
        enabled: bool = True,
        default_channel: NotificationChannel = NotificationChannel.EMAIL,
        events: Optional[List[str]] = None
    ) -> dict:
        """Configure organization-wide notification settings"""
        if not self.redis:
            return {"error": "Redis unavailable"}
        
        settings = {
            "org_id": org_id,
            "enabled": enabled,
            "default_channel": default_channel.value,
            "events": events or [
                NotificationEvent.ABSENCE.value,
                NotificationEvent.LATE_ARRIVAL.value,
                NotificationEvent.HALF_DAY.value
            ]
        }
        
        self.redis.hset(
            f"{self.config_prefix}orgs",
            org_id,
            json.dumps(settings)
        )
        
        return settings
    
    def get_org_settings(self, org_id: str) -> dict:
        """Get organization settings"""
        if not self.redis:
            return {}
        
        raw = self.redis.hget(f"{self.config_prefix}orgs", org_id)
        if not raw:
            # Return defaults
            return {
                "org_id": org_id,
                "enabled": True,
                "default_channel": NotificationChannel.EMAIL.value,
                "events": [
                    NotificationEvent.ABSENCE.value,
                    NotificationEvent.HALF_DAY.value
                ]
            }
        
        return json.loads(raw)
    
    def set_contact_mapping(
        self,
        user_id: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        parent_email: Optional[str] = None,
        parent_phone: Optional[str] = None,
        manager_email: Optional[str] = None,
        manager_phone: Optional[str] = None
    ) -> dict:
        """Map contacts for a user (student/employee and their parents/managers)"""
        if not self.redis:
            return {"error": "Redis unavailable"}
        
        contacts = {
            "user_id": user_id,
            "email": email,
            "phone": phone,
            "parent_email": parent_email,
            "parent_phone": parent_phone,
            "manager_email": manager_email,
            "manager_phone": manager_phone
        }
        
        # Remove None values
        contacts = {k: v for k, v in contacts.items() if v is not None}
        
        self.redis.hset(
            f"{self.config_prefix}contacts",
            user_id,
            json.dumps(contacts)
        )
        
        return contacts
    
    def get_contact_mapping(self, user_id: str) -> dict:
        """Get contacts for a user"""
        if not self.redis:
            return {}
        
        raw = self.redis.hget(f"{self.config_prefix}contacts", user_id)
        if not raw:
            return {"user_id": user_id}
        
        return json.loads(raw)
    
    def set_user_preferences(
        self,
        user_id: str,
        receive_own_notifications: bool = True,
        receive_absence_notifications: bool = True,
        notify_parents: bool = False,
        notify_managers: bool = False,
        notification_channel: NotificationChannel = NotificationChannel.EMAIL
    ) -> dict:
        """Set user notification preferences"""
        if not self.redis:
            return {"error": "Redis unavailable"}
        
        prefs = {
            "user_id": user_id,
            "receive_own": receive_own_notifications,
            "receive_absences": receive_absence_notifications,
            "notify_parents": notify_parents,
            "notify_managers": notify_managers,
            "channel": notification_channel.value
        }
        
        self.redis.hset(
            f"{self.config_prefix}preferences",
            user_id,
            json.dumps(prefs)
        )
        
        return prefs
    
    def get_user_preferences(self, user_id: str) -> dict:
        """Get user notification preferences"""
        if not self.redis:
            return {}
        
        raw = self.redis.hget(f"{self.config_prefix}preferences", user_id)
        if not raw:
            # Return defaults
            return {
                "user_id": user_id,
                "receive_own": True,
                "receive_absences": True,
                "notify_parents": False,
                "notify_managers": False,
                "channel": NotificationChannel.EMAIL.value
            }
        
        return json.loads(raw)
    
    def get_recipients_for_absence(
        self,
        person_id: str,
        person_name: str,
        org_id: str
    ) -> Dict[str, dict]:
        """Get all recipients who should be notified of an absence
        
        Returns dict with keys: 'self', 'parents', 'managers'
        """
        recipients = {"self": {}, "parents": {}, "managers": {}}
        
        org_settings = self.get_org_settings(org_id)
        if not org_settings.get("enabled"):
            return recipients
        
        user_prefs = self.get_user_preferences(person_id)
        contacts = self.get_contact_mapping(person_id)
        
        # Self notification
        if user_prefs.get("receive_own"):
            recipients["self"] = {
                "email": contacts.get("email"),
                "phone": contacts.get("phone"),
                "type": "student"
            }
        
        # Parent notification
        if user_prefs.get("notify_parents"):
            recipients["parents"] = {
                "email": contacts.get("parent_email"),
                "phone": contacts.get("parent_phone"),
                "type": "parent"
            }
        
        # Manager notification
        if user_prefs.get("notify_managers"):
            recipients["managers"] = {
                "email": contacts.get("manager_email"),
                "phone": contacts.get("manager_phone"),
                "type": "manager"
            }
        
        return recipients
    
    def get_unsubscribed(self, user_id: str) -> list:
        """Get list of notification types user is unsubscribed from"""
        if not self.redis:
            return []
        
        raw = self.redis.hget(f"{self.config_prefix}unsubscribed", user_id)
        if not raw:
            return []
        
        return json.loads(raw)
    
    def unsubscribe(self, user_id: str, event_type: str):
        """Unsubscribe from a notification type"""
        if not self.redis:
            return
        
        unsubscribed = self.get_unsubscribed(user_id)
        if event_type not in unsubscribed:
            unsubscribed.append(event_type)
        
        self.redis.hset(
            f"{self.config_prefix}unsubscribed",
            user_id,
            json.dumps(unsubscribed)
        )


# Global instance
notification_config = NotificationConfig()
