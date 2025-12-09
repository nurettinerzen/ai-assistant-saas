# VAPI Function Calling Integration - Testing Guide

This guide explains how to test the Google Calendar + SMS/WhatsApp notification integration for VAPI function calling.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Testing Google Calendar OAuth Flow](#testing-google-calendar-oauth-flow)
- [Testing VAPI Function Calls](#testing-vapi-function-calls)
- [Testing SMS Notifications](#testing-sms-notifications)
- [Testing WhatsApp Notifications](#testing-whatsapp-notifications)
- [Troubleshooting](#troubleshooting)

---

## Overview

The VAPI function calling integration allows AI assistants to:
1. **Create appointments** in business owners' Google Calendars
2. **Send SMS/WhatsApp notifications** to business owners when appointments are created or orders are placed

**MULTI-TENANT ARCHITECTURE:** Each business uses their own integrations (Google Calendar, WhatsApp credentials), NOT a central account.

---

## Prerequisites

### 1. Environment Variables
Ensure your `.env` file contains:

```bash
# VAPI
VAPI_API_KEY="your-vapi-api-key"

# Netgsm SMS
NETGSM_USERNAME="your_username"
NETGSM_PASSWORD="your_password"
NETGSM_MSGHEADER="TELYX"

# Google Services
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# WhatsApp Business API
WHATSAPP_BUSINESS_PHONE_ID="your-phone-number-id"
WHATSAPP_ACCESS_TOKEN="your-access-token"

# Server
BACKEND_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"
```

### 2. Database Setup
Ensure your database is running and migrations are applied:

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 3. Start the Server
```bash
cd backend
npm run dev
# Server should start on http://localhost:3001
```

---

## Testing Google Calendar OAuth Flow

### Step 1: Initiate OAuth
As an authenticated business owner, make a request to start the OAuth flow:

```bash
# Replace {businessId} with actual business ID from your database
# You need a valid JWT token from logging in

curl -X GET "http://localhost:3001/api/integrations/google-calendar/auth" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar..."
}
```

### Step 2: Complete OAuth
1. Open the `authUrl` in your browser
2. Sign in with a Google account
3. Grant calendar permissions
4. You'll be redirected to `/dashboard/integrations?success=google-calendar`

### Step 3: Verify Integration
Check the database to confirm the integration was saved:

```sql
SELECT * FROM "Integration"
WHERE "businessId" = YOUR_BUSINESS_ID
AND type = 'GOOGLE_CALENDAR';
```

Expected result:
- `connected` = `true`
- `credentials` contains `access_token` and `refresh_token`

---

## Testing VAPI Function Calls

### Test 1: Create Appointment Function

**Simulate a VAPI function call:**

```bash
curl -X POST "http://localhost:3001/api/vapi/functions" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "call": {
        "assistantId": "YOUR_VAPI_ASSISTANT_ID"
      },
      "toolCalls": [
        {
          "id": "call_123",
          "function": {
            "name": "create_appointment",
            "arguments": "{\"date\":\"2024-12-15\",\"time\":\"14:00\",\"customer_name\":\"Ahmet Yılmaz\",\"customer_phone\":\"05321234567\",\"service_type\":\"Saç Kesimi\"}"
          }
        }
      ]
    }
  }'
```

**Expected Response:**
```json
{
  "results": [
    {
      "toolCallId": "call_123",
      "result": {
        "success": true,
        "message": "Randevunuz 2024-12-15 tarihinde saat 14:00 için başarıyla oluşturuldu...",
        "appointmentId": 123,
        "calendarEventId": "google_calendar_event_id"
      }
    }
  ]
}
```

**What This Does:**
1. ✅ Finds business by `assistantId`
2. ✅ Checks if business has Google Calendar connected
3. ✅ Creates event in business's Google Calendar
4. ✅ Saves appointment to database
5. ✅ Sends SMS notification to business owner
6. ✅ Returns success message to VAPI (AI speaks this to customer)

**Verify:**
- Check Google Calendar for the event
- Check database for appointment record
- Check business owner's phone for SMS

### Test 2: Send Order Notification Function

```bash
curl -X POST "http://localhost:3001/api/vapi/functions" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "call": {
        "assistantId": "YOUR_VAPI_ASSISTANT_ID"
      },
      "toolCalls": [
        {
          "id": "call_456",
          "function": {
            "name": "send_order_notification",
            "arguments": "{\"customer_name\":\"Mehmet Demir\",\"customer_phone\":\"05339876543\",\"order_items\":\"2x Hamburger, 1x Kola\"}"
          }
        }
      ]
    }
  }'
```

**Expected Response:**
```json
{
  "results": [
    {
      "toolCallId": "call_456",
      "result": {
        "success": true,
        "message": "Siparişiniz alındı. İşletme sahibine bildirim gönderildi..."
      }
    }
  ]
}
```

**What This Does:**
1. ✅ Finds business by `assistantId`
2. ✅ Checks if business has WhatsApp integration (prefers WhatsApp over SMS)
3. ✅ Sends notification to business owner
4. ✅ Returns success message to VAPI

---

## Testing SMS Notifications

### Test Direct SMS Sending

You can test the Netgsm SMS service directly:

```javascript
// In a Node.js REPL or test file
import netgsmService from './src/services/netgsm.js';

// Send test SMS
const result = await netgsmService.sendSMS(
  '05321234567',  // Recipient phone
  'Test SMS from Telyx.ai - Appointment notification test'
);

console.log(result);
// Expected: { success: true, messageId: '00', message: 'SMS sent successfully' }
```

### Verify SMS Delivery
- Check recipient phone for SMS
- Check Netgsm dashboard for delivery status
- Check server logs for any errors

---

## Testing WhatsApp Notifications

### Prerequisites
1. Set up WhatsApp Business API account
2. Create and approve message templates
3. Store credentials in business's integration

### Test Direct WhatsApp Message

```javascript
import whatsappService from './src/services/whatsapp.js';

const result = await whatsappService.sendMessage(
  'YOUR_ACCESS_TOKEN',
  'YOUR_PHONE_NUMBER_ID',
  '905321234567',  // Recipient (must include country code)
  'Test WhatsApp notification from Telyx.ai'
);

console.log(result);
```

**Note:** WhatsApp requires the recipient to have messaged your business first, or you must use approved template messages.

---

## Testing Multi-Tenant Isolation

**CRITICAL TEST:** Verify that each business uses their own integrations.

### Setup:
1. Create two test businesses (Business A and Business B)
2. Connect Google Calendar for Business A only
3. Create VAPI assistants for both businesses

### Test:
```bash
# Try to create appointment for Business A (should succeed)
curl -X POST "http://localhost:3001/api/vapi/functions" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "call": {
        "assistantId": "BUSINESS_A_ASSISTANT_ID"
      },
      "toolCalls": [...]
    }
  }'

# Try to create appointment for Business B (should fail gracefully)
curl -X POST "http://localhost:3001/api/vapi/functions" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "call": {
        "assistantId": "BUSINESS_B_ASSISTANT_ID"
      },
      "toolCalls": [...]
    }
  }'
```

**Expected for Business B:**
- Appointment should still be saved to database
- SMS notification should still be sent
- But NO Google Calendar event created (because they haven't connected it)
- Success message should still be returned

---

## Troubleshooting

### Issue: "No assistant ID found in VAPI call data"
**Cause:** The VAPI message doesn't contain assistant ID
**Fix:** Ensure your test request includes `message.call.assistantId`

### Issue: "No business found for assistant ID"
**Cause:** Business doesn't have the VAPI assistant ID saved
**Fix:** Update business record:
```sql
UPDATE "Business"
SET "vapiAssistantId" = 'your-assistant-id'
WHERE id = YOUR_BUSINESS_ID;
```

### Issue: "Please connect Google Calendar in dashboard"
**Cause:** Business hasn't completed Google Calendar OAuth
**Fix:** Follow [Testing Google Calendar OAuth Flow](#testing-google-calendar-oauth-flow)

### Issue: SMS not sending
**Cause:** Netgsm credentials invalid or insufficient credit
**Fix:**
- Check credentials in `.env`
- Check Netgsm dashboard for account status
- Check server logs for error codes

### Issue: Google Calendar event not created
**Cause:** OAuth tokens might be expired
**Fix:**
- The service should automatically refresh tokens
- Check server logs for token refresh errors
- If needed, re-connect Google Calendar

### Issue: WhatsApp message not sending
**Cause:** Multiple possibilities
**Fix:**
- Verify WhatsApp credentials in integration
- Ensure recipient phone has country code
- Check if recipient has messaged your business first
- Use approved template messages for first contact

---

## End-to-End Test Scenario

### Scenario: Customer calls salon to book haircut appointment

1. **Customer calls:** VAPI assistant answers
2. **AI asks questions:** "What service? When? Your name and phone?"
3. **AI calls function:** `create_appointment` with collected info
4. **Backend processes:**
   - Finds salon business by assistant ID
   - Checks Google Calendar integration (connected ✅)
   - Creates event in salon owner's Google Calendar
   - Saves appointment to database
   - Sends SMS to salon owner
5. **AI confirms:** "Your appointment is confirmed for..."
6. **Customer receives:** SMS confirmation
7. **Salon owner receives:** SMS notification + Google Calendar event

### How to Test This End-to-End:
1. Set up a test business with Google Calendar connected
2. Configure VAPI assistant with the function definitions:
   ```json
   {
     "name": "create_appointment",
     "description": "Create a new appointment in the business calendar",
     "parameters": {
       "type": "object",
       "properties": {
         "date": { "type": "string", "description": "Date in YYYY-MM-DD format" },
         "time": { "type": "string", "description": "Time in HH:MM format" },
         "customer_name": { "type": "string", "description": "Customer's full name" },
         "customer_phone": { "type": "string", "description": "Customer's phone number" },
         "service_type": { "type": "string", "description": "Type of service requested" }
       },
       "required": ["date", "time", "customer_name", "customer_phone"]
     }
   }
   ```
3. Point VAPI function call URL to: `https://your-backend.com/api/vapi/functions`
4. Make a test call to your VAPI phone number
5. Have the conversation and verify all steps complete

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/integrations/google-calendar/auth` | GET | Start Google Calendar OAuth |
| `/api/integrations/google-calendar/callback` | GET | OAuth callback |
| `/api/integrations/whatsapp/connect` | POST | Connect WhatsApp Business |
| `/api/vapi/functions` | POST | Handle VAPI function calls |
| `/api/vapi/webhook` | POST | Handle VAPI call events |

---

## Database Verification Queries

```sql
-- Check if business has Google Calendar connected
SELECT * FROM "Integration"
WHERE "businessId" = 1
AND type = 'GOOGLE_CALENDAR'
AND "isActive" = true;

-- View all appointments for a business
SELECT * FROM "Appointment"
WHERE "businessId" = 1
ORDER BY "appointmentDate" DESC;

-- Check business VAPI configuration
SELECT id, name, "vapiAssistantId", "phoneNumbers", language
FROM "Business"
WHERE id = 1;
```

---

## Next Steps After Testing

1. **Production Deployment:**
   - Update `BACKEND_URL` to production URL
   - Update Google OAuth redirect URIs in Google Cloud Console
   - Update VAPI function URL to production endpoint

2. **Monitoring:**
   - Set up logging for function calls
   - Monitor SMS sending success rates
   - Track Google Calendar API errors

3. **User Documentation:**
   - Create dashboard guide for connecting Google Calendar
   - Document required permissions
   - Explain SMS notification system to business owners

---

## Support

If you encounter issues:
1. Check server logs: `npm run dev` output
2. Check database records
3. Verify environment variables
4. Review VAPI webhook logs in VAPI dashboard
5. Contact support with error messages and request details
