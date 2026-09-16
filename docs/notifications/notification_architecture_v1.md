# Notification Architecture v1

This document outlines the architecture for DisasterSense's external notification system, added in Phase 23.

## Overview

The notification system bridges the gap between the `RiskEngine` detecting a high/critical disaster risk and the system informing relevant stakeholders via external channels (Email, SMS) in real-time.

It integrates deeply with:
1. **Risk Assessment Service:** Which evaluates the risk.
2. **Alert Service:** Which triggers standard in-app alerts.
3. **Background Tasks:** To fire external network calls asynchronously.
4. **User Preferences:** So users can opt in or out of specific channels.

## Core Components

### 1. The Dispatcher (`app/services/notifications/dispatcher.py`)
The `NotificationDispatcher` is the orchestrator. When an alert is created, its ID is sent to the dispatcher via FastAPI's `BackgroundTasks`. 
The dispatcher:
- Looks up the alert and determining its severity.
- Determines the required channels based on severity rules:
  - **HIGH:** Email
  - **CRITICAL:** Email and SMS
- Iterates over active `ADMIN` and `RESPONDER` users.
- Checks if the user is opted-in to the required channel.
- Checks if the user was already notified for this specific alert/channel combination (Deduplication).
- Delegates sending to the specific `NotificationProvider`.
- Records the attempt in the `notification_deliveries` database table.

### 2. Providers (`app/services/notifications/base.py`)
Providers handle the actual delivery to external systems. They implement the `NotificationProvider` abstract base class.
- **EmailProvider:** Uses SMTP to deliver emails.
- **SMSProvider:** Uses a generic REST interface (configurable via API Keys) to deliver SMS.

*Note:* In DisasterSense v1, providers are programmed to securely fail or ignore sending if no configuration (e.g. `SMTP_HOST` or `SMS_API_KEY`) is found in the environment, preventing noisy failures during local/demo operations.

### 3. User Preferences (`app/models/user.py`)
Users can configure their notification preferences. The `User` model has been expanded to include:
- `phone_number` (string)
- `email_enabled` (boolean)
- `sms_enabled` (boolean)

These are manageable via the `GET /users/me/preferences` and `PUT /users/me/preferences` endpoints, and a new settings modal in the Frontend's `TopBar`.

### 4. Delivery Tracking (`app/models/notification.py`)
All outgoing notifications are tracked in `NotificationDelivery`, recording:
- `alert_id`
- `user_id`
- `channel` (email, sms)
- `status` (sent, failed, not_configured)
- `failure_reason`

This ensures full auditability of what alerts were sent, to whom, and whether they succeeded.

## Database Schema
The database migration adds the `notification_deliveries` table and extends the `users` table.

```sql
ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);
ALTER TABLE users ADD COLUMN email_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN sms_enabled BOOLEAN DEFAULT FALSE;

CREATE TABLE notification_deliveries (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES alerts(id),
    user_id INTEGER REFERENCES users(id),
    channel VARCHAR NOT NULL,
    provider VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    failure_reason TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Delivery State Machine & Retries

Deliveries transition through explicit states:
- `PENDING`: Initial state during dispatch.
- `SENT`: Confirmed successful delivery from the provider.
- `FAILED`: Delivery attempt raised an exception or failed authentication.
- `NOT_CONFIGURED`: The provider credentials (e.g. `SMTP_HOST`) are missing.

### Retry Policy
Transient failures (like network timeouts) are retried with an exponential backoff.
- **Max Attempts**: 3
- **Backoff**: 2s, 4s, 8s
- Permanent failures (like invalid authentication or rejected recipients) break the retry loop immediately.

### Idempotency & Anti-Spam
To prevent duplicate notifications during repeated risk assessments for the same location, the dispatcher strictly queries for existing deliveries where `status = 'SENT'`. If a successful delivery for a specific `(alert_id, user_id, channel)` already exists, the dispatcher skips the attempt. This is enforced at the application level to allow retries of failed attempts.

## Security & Failure Guarantees
1. **Risk Assessment First:** A failure in an external notification provider (like Twilio being down) will **never** cause the primary Risk Assessment or internal Alert to fail. This is achieved by running the dispatcher as a background task.
2. **Opt-in Only for SMS:** Users must explicitly enable SMS and provide a valid E.164 phone number.
3. **No Key Leaks:** API keys and SMTP credentials exist only in backend environment variables and are never exposed to the frontend.
4. **Header Injection Protection:** Email fields (subject, recipient) are stripped of newline characters before transmission.
5. **Production Limitations:** Currently, `FastAPI.BackgroundTasks` manages dispatching. If the main server crashes mid-dispatch, pending notifications are lost. For high-scale production, this should be migrated to a durable queue (like Celery/RabbitMQ).
