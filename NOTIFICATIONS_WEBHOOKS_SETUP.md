# Email & SMS Notifications + Webhook Integration Guide

This guide covers setting up email/SMS alerts for student absences and webhook endpoints for external system integration.

## Overview

The notification system allows organizations to:
- **Email Alerts**: Send automated emails to students/employees and their parents/managers when absences are recorded
- **SMS Alerts**: Send text message alerts via Twilio
- **Webhooks**: Pipe attendance data to external systems (HR, LMS, custom apps)
- **Configurable**: Fine-grained control over who gets notified and when

---

## Email Setup

### Option 1: SendGrid (Recommended)

SendGrid is the most reliable email service with excellent delivery rates.

**Steps:**
1. Create account at https://sendgrid.com
2. Get your API Key from Settings → API Keys → Create API Key
3. Verify sender email in SendGrid dashboard
4. Add to `.env`:
   ```
   SENDGRID_API_KEY=SG.xxxxx
   SENDGRID_FROM_EMAIL=noreply@your-domain.com
   ```

### Option 2: Resend (Modern Alternative)

Resend is great for transactional emails with beautiful templates.

**Steps:**
1. Create account at https://resend.com
2. Get your API Key from Settings → API Keys
3. Verify domain
4. Add to `.env`:
   ```
   RESEND_API_KEY=re_xxxxx
   RESEND_FROM_EMAIL=noreply@your-domain.com
   ```

### Test Email Setup

```bash
curl -X POST http://localhost:8000/api/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "person_name": "John Doe",
    "session_name": "Mathematics 101",
    "group_name": "Class A",
    "recipient_email": "john@example.com",
    "notification_type": "email"
  }'
```

---

## SMS Setup (Twilio)

### Getting Started with Twilio

**Steps:**
1. Create account at https://www.twilio.com
2. Get Account SID and Auth Token from https://console.twilio.com
3. Buy a phone number (for sending SMS)
4. Verify recipient phone numbers (or upgrade account)
5. Add to `.env`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

### Phone Number Format

Phone numbers must be in E.164 format:
- ✅ Correct: `+14155552671`, `+919876543210`
- ❌ Incorrect: `415-555-2671`, `9876543210`

### Test SMS Setup

```bash
curl -X POST http://localhost:8000/api/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "person_name": "John Doe",
    "session_name": "Mathematics 101",
    "group_name": "Class A",
    "recipient_phone": "+919876543210",
    "notification_type": "sms"
  }'
```

---

## Configuration API Endpoints

### 1. Set Contact Information

This maps email and phone numbers to student/employee and their parents/managers.

**Endpoint:** `POST /api/notifications/contacts`

```bash
curl -X POST http://localhost:8000/api/notifications/contacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "phone": "+919876543210",
    "parent_email": "parent@example.com",
    "parent_phone": "+919876543211",
    "manager_email": "manager@example.com",
    "manager_phone": "+919876543212"
  }'
```

### 2. Configure Notification Preferences

Control who gets notified about what.

**Endpoint:** `POST /api/notifications/preferences`

```bash
curl -X POST http://localhost:8000/api/notifications/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receive_own_notifications": true,
    "receive_absence_notifications": true,
    "notify_parents": true,
    "notify_managers": false,
    "notification_channel": "both"
  }'
```

**Options:**
- `notification_channel`: `"email"`, `"sms"`, `"both"`, `"none"`
- `notify_parents`: Include parents in notifications
- `notify_managers`: Include managers in notifications

### 3. Get Notification Preferences

**Endpoint:** `GET /api/notifications/preferences`

```bash
curl -X GET http://localhost:8000/api/notifications/preferences \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Unsubscribe from Notifications

Prevent specific notification types.

**Endpoint:** `POST /api/notifications/unsubscribe?event_type=absence`

```bash
curl -X POST "http://localhost:8000/api/notifications/unsubscribe?event_type=absence" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Triggering Notifications

### Manual Absence Notification

When an absence is recorded, trigger notifications:

**Endpoint:** `POST /api/absentees/notify-absence`

```bash
curl -X POST http://localhost:8000/api/absentees/notify-absence \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "person_name": "John Doe",
    "person_id": "student_123",
    "session_name": "Mathematics 101",
    "group_name": "Class A",
    "org_id": "org_123"
  }'
```

### Bulk Notify for Multiple Absences

**Endpoint:** `POST /api/absentees/notify-bulk`

```bash
curl -X POST http://localhost:8000/api/absentees/notify-bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "person_name": "John Doe",
      "person_id": "student_123",
      "session_name": "Mathematics 101",
      "group_name": "Class A",
      "org_id": "org_123"
    },
    {
      "person_name": "Jane Smith",
      "person_id": "student_124",
      "session_name": "Mathematics 101",
      "group_name": "Class A",
      "org_id": "org_123"
    }
  ]'
```

---

## Webhook Integration

### What are Webhooks?

Webhooks allow you to send real-time attendance data to external systems:
- HR/Payroll systems
- Learning Management Systems (LMS)
- Custom dashboards
- Slack/Teams notifications
- Mobile apps

### Setting Up a Webhook

**Endpoint:** `POST /api/notifications/webhooks`

```bash
curl -X POST http://localhost:8000/api/notifications/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-system.com/webhooks/attendance",
    "secret": "your_webhook_secret_key",
    "events": ["absence", "attendance"],
    "active": true
  }'
```

**Response:**
```json
{
  "success": true,
  "webhook": {
    "id": "user_123_1234567890",
    "url": "https://your-system.com/webhooks/attendance",
    "events": ["absence", "attendance"],
    "active": true,
    "created_at": "2026-05-08T10:30:00",
    "deliveries": 0,
    "failures": 0
  }
}
```

### List Your Webhooks

**Endpoint:** `GET /api/notifications/webhooks`

```bash
curl -X GET http://localhost:8000/api/notifications/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update a Webhook

**Endpoint:** `PUT /api/notifications/webhooks/{webhook_id}`

```bash
curl -X PUT http://localhost:8000/api/notifications/webhooks/user_123_1234567890 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "events": ["absence"],
    "active": true
  }'
```

### Delete a Webhook

**Endpoint:** `DELETE /api/notifications/webhooks/{webhook_id}`

```bash
curl -X DELETE http://localhost:8000/api/notifications/webhooks/user_123_1234567890 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test a Webhook

**Endpoint:** `POST /api/notifications/webhooks/{webhook_id}/test`

```bash
curl -X POST http://localhost:8000/api/notifications/webhooks/user_123_1234567890/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### View Webhook Delivery Logs

**Endpoint:** `GET /api/notifications/webhooks/{webhook_id}/logs?limit=50`

```bash
curl -X GET "http://localhost:8000/api/notifications/webhooks/user_123_1234567890/logs?limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Webhook Event Structure

### Absence Event

When someone is marked absent:

```json
{
  "id": "2026-05-08T10:30:45.123456-5682",
  "type": "absence",
  "timestamp": "2026-05-08T10:30:45.123456",
  "data": {
    "person_name": "John Doe",
    "person_id": "student_123",
    "session_name": "Mathematics 101",
    "group_name": "Class A",
    "timestamp": "2026-05-08T10:30:45.123456"
  }
}
```

### Webhook Signature Verification

Every webhook includes an `X-Webhook-Signature` header with HMAC-SHA256 signature:

```
X-Webhook-Signature: sha256=abcdef0123456789...
```

**Verify in your code:**

```python
import hmac
import hashlib

def verify_webhook(payload: str, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

# Usage
is_valid = verify_webhook(
    request.body,
    request.headers.get("X-Webhook-Signature"),
    "your_webhook_secret"
)
```

### Webhook Retry Logic

The system automatically retries failed deliveries with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: 5 seconds
- Attempt 3: 25 seconds
- Attempt 4: 125 seconds
- Attempt 5: 625 seconds
- Attempt 6: 3125 seconds (final)

---

## Example: Slack Notification Webhook

Send absence notifications to Slack:

1. Create Slack App at https://api.slack.com/apps
2. Create Incoming Webhook URL
3. Add webhook to your system:

```bash
curl -X POST http://localhost:8000/api/notifications/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "secret": "slack_webhook_secret",
    "events": ["absence"],
    "active": true
  }'
```

4. In Slack, handle the webhook:

```python
@app.post("/slack/webhook")
async def handle_slack_webhook(request: Request):
    signature = request.headers.get("X-Webhook-Signature")
    body = await request.body()
    
    # Verify signature
    if not verify_webhook(body, signature, "slack_webhook_secret"):
        return {"error": "Invalid signature"}, 401
    
    data = await request.json()
    event = data.get("data", {})
    
    # Send to Slack
    response = requests.post(
        "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
        json={
            "text": f"❌ {event['person_name']} absent from {event['session_name']}"
        }
    )
    
    return {"ok": response.status_code == 200}
```

---

## Example: Custom Integration

Integrate with your own API:

```python
# Your backend handles the webhook
@app.post("/api/webhooks/attendance")
async def handle_attendance_webhook(request: Request):
    signature = request.headers.get("X-Webhook-Signature")
    body = await request.body()
    
    # Verify it's from your attendance system
    if not verify_webhook(body, signature, "your_webhook_secret"):
        return {"error": "Invalid"}, 401
    
    event = json.loads(body)
    
    if event["type"] == "absence":
        # Log to database
        absence = Absence(
            person_id=event["data"]["person_id"],
            person_name=event["data"]["person_name"],
            session=event["data"]["session_name"],
            timestamp=event["timestamp"]
        )
        db.session.add(absence)
        db.session.commit()
        
        # Send to HR system
        hr_api.report_absence(absence)
        
        # Update grades
        grades.mark_absence(absence.person_id)
    
    return {"ok": True}
```

---

## Monitoring & Debugging

### Check Webhook Delivery Status

```bash
curl -X GET http://localhost:8000/api/notifications/webhooks/webhook_id/logs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "logs": [
    {
      "webhook_id": "user_123_1234567890",
      "event_id": "event_456",
      "status": "delivered",
      "attempts": 1,
      "last_attempt": "2026-05-08T10:30:45",
      "next_retry": null,
      "history": [
        {
          "timestamp": "2026-05-08T10:30:45",
          "status_code": 200,
          "response": "OK",
          "error": null
        }
      ]
    }
  ]
}
```

### Environment Variables Summary

```bash
# Email
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@domain.com

# SMS
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=token
TWILIO_PHONE_NUMBER=+1234567890

# Alternative Email
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@domain.com
```

---

## Security Best Practices

1. **Webhook Secrets**: Use strong, random secrets (32+ characters)
   ```bash
   openssl rand -hex 32
   ```

2. **Signature Verification**: Always verify webhook signatures
3. **HTTPS Only**: Use HTTPS for webhook URLs
4. **IP Whitelisting**: Restrict which IPs can trigger notifications
5. **Rate Limiting**: Implement rate limits to prevent abuse
6. **Sensitive Data**: Don't log email addresses or phone numbers in production

---

## Troubleshooting

### Email not sending
- Check SendGrid API key and from email is verified
- Look at test endpoint response for errors
- Check spam folder

### SMS not sending
- Verify phone number format (E.164: +1234567890)
- Check Twilio account has credits/active trial
- Verify numbers are in allowed list (non-verified accounts)

### Webhook not triggering
- Ensure webhook is active: `GET /api/notifications/webhooks`
- Check event type matches: `"absence"` vs `"attendance"`
- Verify webhook URL is publicly accessible
- Check delivery logs for errors

### Webhook delivery failed
- Check delivery logs for status codes
- 4xx errors: Fix webhook URL or signature
- 5xx errors: Check your webhook handler
- Timeouts: Check server responsiveness

---

## Next Steps

1. Install dependencies: `pip install -r requirements.txt`
2. Set up email provider (SendGrid or Resend)
3. Set up SMS provider (Twilio) - optional
4. Configure contact mappings for users
5. Set notification preferences
6. Create webhooks for external integrations
7. Test with test endpoints
8. Monitor delivery logs

For questions or issues, check the logs or contact support.
