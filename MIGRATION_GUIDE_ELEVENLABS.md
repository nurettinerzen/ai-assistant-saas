# VAPI to 11Labs Conversational AI Migration Guide

## Overview

This migration replaces VAPI with 11Labs Conversational AI for the phone channel. The main benefit is significantly better Turkish voice quality - natural, non-robotic speech.

## What Changed

### New Files Created

1. **Backend Service** (`backend/src/services/elevenlabs.js`)
   - 11Labs API client for agent management
   - Phone number import (Twilio integration)
   - Conversation/call log retrieval
   - Outbound call initiation

2. **Webhook Handler** (`backend/src/routes/elevenlabs.js`)
   - `/api/elevenlabs/webhook` - Main webhook for tool calls and events
   - `/api/elevenlabs/post-call` - Post-call analysis webhook
   - `/api/elevenlabs/signed-url/:assistantId` - For web client voice calls

3. **Migration Script** (`backend/scripts/migrate-to-elevenlabs.js`)
   - Migrates existing assistants from VAPI to 11Labs
   - Run with: `node scripts/migrate-to-elevenlabs.js`
   - Add `--dry-run` flag to preview changes

4. **SQL Migration** (`backend/prisma/migrations/manual/add_elevenlabs_fields.sql`)
   - Adds `elevenLabsAgentId` and `voiceProvider` to Assistant table
   - Adds `elevenLabsPhoneId` to PhoneNumber table

### Modified Files

1. **Database Schema** (`backend/prisma/schema.prisma`)
   - Added `elevenLabsAgentId` and `voiceProvider` to Assistant model
   - Added `elevenLabsPhoneId` to PhoneNumber model
   - Added `ELEVENLABS` to PhoneProvider enum

2. **Tool System** (`backend/src/tools/index.js`)
   - Added `getActiveToolsForElevenLabs()` function
   - Converts OpenAI-format tools to 11Labs webhook format

3. **Assistant Routes** (`backend/src/routes/assistant.js`)
   - Creates 11Labs agents instead of VAPI assistants
   - Updates 11Labs agents on assistant changes
   - Test calls now use 11Labs

4. **Phone Number Routes** (`backend/src/routes/phoneNumber.js`)
   - New endpoint: `POST /:id/import-twilio` - Import Twilio number to 11Labs
   - Updated countries endpoint for 11Labs

5. **Server** (`backend/src/server.js`)
   - Added 11Labs routes and webhook handlers

6. **Frontend VoiceDemo** (`frontend/components/VoiceDemo.jsx`)
   - Uses 11Labs WebSocket connection instead of VAPI SDK

### Environment Variables

Add to `.env`:
```env
ELEVENLABS_API_KEY=your-api-key
ELEVENLABS_WEBHOOK_SECRET=your-webhook-secret

# For phone number import
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
```

## Migration Steps

### 1. Database Migration

Run the SQL migration:
```sql
-- See: backend/prisma/migrations/manual/add_elevenlabs_fields.sql
```

Or if using Prisma:
```bash
npx prisma db push
```

### 2. Set Environment Variables

Add the required 11Labs and Twilio credentials to your `.env` file.

### 3. Update Webhook URL in 11Labs Dashboard

Set your webhook URL to:
```
https://your-domain.com/api/elevenlabs/webhook
```

Set post-call webhook to:
```
https://your-domain.com/api/elevenlabs/post-call
```

### 4. Migrate Existing Assistants

Run the migration script:
```bash
# Preview changes
node backend/scripts/migrate-to-elevenlabs.js --dry-run

# Actually migrate
node backend/scripts/migrate-to-elevenlabs.js
```

### 5. Import Phone Numbers

For each phone number, call the Twilio import endpoint:
```bash
POST /api/phone-numbers/{id}/import-twilio
{
  "twilioPhoneNumber": "+1234567890",
  "twilioAccountSid": "your-sid",
  "twilioAuthToken": "your-token"
}
```

### 6. Test

1. Create a new assistant (should use 11Labs)
2. Make a test call
3. Verify tool calls work correctly
4. Check call logs are being saved

## Rollback Plan

If issues occur:

1. The old VAPI code is still in place and functional
2. Set `voiceProvider: 'vapi'` on assistants to use VAPI
3. Phone numbers with `vapiPhoneId` will still work with VAPI

## Architecture

```
[Phone Call]
    |
    v
[11Labs Conversational AI]
    |
    ├── Inbound: Webhook events to /api/elevenlabs/webhook
    |   - tool_call: Execute server-side tools
    |   - conversation.started: Log call start
    |   - conversation.ended: Log call end
    |
    └── Outbound: API calls from backend
        - createAgent: Create new voice assistant
        - updateAgent: Update assistant config
        - importPhoneNumber: Connect Twilio number
        - initiateOutboundCall: Start outbound call

[Tool Execution]
    |
    v
[Central Tool System] (/backend/src/tools/index.js)
    |
    ├── getActiveToolsForElevenLabs(): Webhook format
    └── executeTool(): Runs tool handler
```

## Key Differences from VAPI

| Feature | VAPI | 11Labs |
|---------|------|--------|
| Voice Quality | Streaming chunks (robotic) | Native TTS (natural) |
| Tool Format | OpenAI + server config | Webhook-based |
| Phone Numbers | Buy via VAPI | Import Twilio |
| Web Client | @vapi-ai/web SDK | WebSocket |
| Events | Multiple formats | Standardized |

## Support

For issues, check:
1. 11Labs dashboard for agent status
2. Webhook logs at `/api/elevenlabs/webhook`
3. Call logs in database for errors
