"""
Notification service for sending email and SMS alerts about absences.
Supports SendGrid, Resend (email), and Twilio (SMS).
"""

import os
import json
import logging
from enum import Enum
from typing import Optional
from datetime import datetime
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class NotificationType(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    BOTH = "both"


class NotificationProvider(ABC):
    """Base class for notification providers"""
    
    @abstractmethod
    async def send(self, recipient: str, subject: str, message: str) -> dict:
        """Send notification. Returns success dict with message_id or error."""
        pass


class SendGridProvider(NotificationProvider):
    """SendGrid email provider"""
    
    def __init__(self):
        self.api_key = os.getenv("SENDGRID_API_KEY")
        self.from_email = os.getenv("SENDGRID_FROM_EMAIL", "noreply@attendance-system.com")
        self.client = None
        
        if self.api_key:
            try:
                from sendgrid import SendGridAPIClient
                from sendgrid.helpers.mail import Mail
                self.SendGridAPIClient = SendGridAPIClient
                self.Mail = Mail
                self.client = SendGridAPIClient(self.api_key)
            except ImportError:
                logger.warning("SendGrid package not installed")
    
    async def send(self, recipient: str, subject: str, message: str) -> dict:
        """Send email via SendGrid"""
        if not self.client:
            return {"success": False, "error": "SendGrid not configured"}
        
        try:
            mail = self.Mail(
                from_email=self.from_email,
                to_emails=recipient,
                subject=subject,
                html_content=message
            )
            response = self.client.send(mail)
            return {
                "success": True,
                "message_id": response.headers.get("X-Message-ID", "unknown"),
                "status_code": response.status_code
            }
        except Exception as e:
            logger.error(f"SendGrid error: {str(e)}")
            return {"success": False, "error": str(e)}


class ResendProvider(NotificationProvider):
    """Resend email provider"""
    
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY")
        self.from_email = os.getenv("RESEND_FROM_EMAIL", "noreply@attendance-system.com")
        self.client = None
        
        if self.api_key:
            try:
                import httpx
                self.httpx = httpx
                self.client = httpx.AsyncClient()
            except ImportError:
                logger.warning("httpx package not installed for Resend")
    
    async def send(self, recipient: str, subject: str, message: str) -> dict:
        """Send email via Resend"""
        if not self.client or not self.api_key:
            return {"success": False, "error": "Resend not configured"}
        
        try:
            response = await self.client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "from": self.from_email,
                    "to": recipient,
                    "subject": subject,
                    "html": message
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "message_id": data.get("id"),
                    "status_code": response.status_code
                }
            else:
                return {
                    "success": False,
                    "error": response.text,
                    "status_code": response.status_code
                }
        except Exception as e:
            logger.error(f"Resend error: {str(e)}")
            return {"success": False, "error": str(e)}


class TwilioProvider(NotificationProvider):
    """Twilio SMS provider"""
    
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.from_number = os.getenv("TWILIO_PHONE_NUMBER")
        self.client = None
        
        if self.account_sid and self.auth_token:
            try:
                from twilio.rest import Client
                self.client = Client(self.account_sid, self.auth_token)
            except ImportError:
                logger.warning("Twilio package not installed")
    
    async def send(self, recipient: str, subject: str, message: str) -> dict:
        """Send SMS via Twilio"""
        if not self.client:
            return {"success": False, "error": "Twilio not configured"}
        
        try:
            # subject parameter is ignored for SMS, use message only
            sms_message = self.client.messages.create(
                body=message[:160],  # SMS limit
                from_=self.from_number,
                to=recipient
            )
            return {
                "success": True,
                "message_id": sms_message.sid,
                "status": sms_message.status
            }
        except Exception as e:
            logger.error(f"Twilio error: {str(e)}")
            return {"success": False, "error": str(e)}


class NotificationService:
    """Main notification service"""
    
    def __init__(self):
        self.sendgrid = SendGridProvider()
        self.resend = ResendProvider()
        self.twilio = TwilioProvider()
        self.redis = None
    
    def set_redis(self, redis_client):
        """Set Redis client for logging"""
        self.redis = redis_client
    
    async def send_absence_alert(
        self,
        recipient_email: Optional[str],
        recipient_phone: Optional[str],
        person_name: str,
        session_name: str,
        group_name: str,
        notification_type: NotificationType = NotificationType.EMAIL,
        recipient_type: str = "student"  # student, parent, employee, manager
    ) -> dict:
        """Send absence notification to student/employee or their contact"""
        
        results = {"email": None, "sms": None}
        
        # Email notification
        if notification_type in [NotificationType.EMAIL, NotificationType.BOTH]:
            if recipient_email:
                email_result = await self._send_absence_email(
                    recipient_email, person_name, session_name, group_name, recipient_type
                )
                results["email"] = email_result
        
        # SMS notification
        if notification_type in [NotificationType.SMS, NotificationType.BOTH]:
            if recipient_phone:
                sms_result = await self._send_absence_sms(
                    recipient_phone, person_name, session_name, group_name, recipient_type
                )
                results["sms"] = sms_result
        
        # Log to Redis if available
        if self.redis:
            self._log_notification(person_name, session_name, results)
        
        return results
    
    async def _send_absence_email(
        self,
        email: str,
        person_name: str,
        session_name: str,
        group_name: str,
        recipient_type: str
    ) -> dict:
        """Send absence email"""
        
        # Template for different recipient types
        if recipient_type in ["parent", "manager"]:
            subject = f"Absence Alert: {person_name}"
            body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #ef4444;">Absence Notification</h2>
                        <p>Dear Guardian/Manager,</p>
                        <p><strong>{person_name}</strong> was marked <span style="color: #ef4444; font-weight: bold;">ABSENT</span> during:</p>
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <p><strong>Session:</strong> {session_name}</p>
                            <p><strong>Group:</strong> {group_name}</p>
                            <p><strong>Date:</strong> {datetime.now().strftime('%Y-%m-%d')}</p>
                            <p><strong>Time:</strong> {datetime.now().strftime('%H:%M:%S')}</p>
                        </div>
                        <p>Please follow up if this is unexpected.</p>
                        <p>Best regards,<br>Attendance System</p>
                    </div>
                </body>
            </html>
            """
        else:  # student/employee
            subject = f"You were marked absent in {session_name}"
            body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #0ea5e9;">Attendance Update</h2>
                        <p>Hi {person_name},</p>
                        <p>You were marked <span style="color: #ef4444; font-weight: bold;">ABSENT</span> during:</p>
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <p><strong>Session:</strong> {session_name}</p>
                            <p><strong>Group:</strong> {group_name}</p>
                            <p><strong>Date:</strong> {datetime.now().strftime('%Y-%m-%d')}</p>
                        </div>
                        <p>If you believe this is incorrect, please contact your administrator.</p>
                        <p>Best regards,<br>Attendance System</p>
                    </div>
                </body>
            </html>
            """
        
        # Try SendGrid first, fallback to Resend
        result = await self.sendgrid.send(email, subject, body)
        if not result.get("success") and self.resend.client:
            result = await self.resend.send(email, subject, body)
        
        return result
    
    async def _send_absence_sms(
        self,
        phone: str,
        person_name: str,
        session_name: str,
        group_name: str,
        recipient_type: str
    ) -> dict:
        """Send absence SMS"""
        
        if recipient_type in ["parent", "manager"]:
            message = f"Alert: {person_name} was marked ABSENT in {session_name} ({group_name}). Check the app for details."
        else:
            message = f"You were marked ABSENT in {session_name}. If incorrect, contact admin."
        
        return await self.twilio.send(phone, "", message)
    
    def _log_notification(self, person_name: str, session_name: str, results: dict):
        """Log notification attempt to Redis"""
        try:
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "person": person_name,
                "session": session_name,
                "email": results.get("email", {}).get("success", False),
                "sms": results.get("sms", {}).get("success", False)
            }
            self.redis.rpush(
                "notification_logs",
                json.dumps(log_entry)
            )
            # Keep only last 1000 logs
            self.redis.ltrim("notification_logs", -1000, -1)
        except Exception as e:
            logger.error(f"Failed to log notification: {str(e)}")


# Global instance
notification_service = NotificationService()
