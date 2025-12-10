# Call Recordings and Transcripts Implementation

## Overview
This implementation adds comprehensive call recordings and transcript functionality to the AI Assistant SaaS platform, including:
- Audio recordings with embedded player
- Structured transcripts with speaker labels and timestamps
- AI-powered call analysis (summary, key topics, action items, sentiment)
- Search functionality within transcripts
- Download capabilities for recordings and transcripts

## Changes Made

### 1. Database Schema Updates
**File:** `backend/prisma/schema.prisma`

Added new fields to the `CallLog` model:
- `transcript` (Json) - Structured array of messages with speaker, text, and timestamp
- `transcriptText` (String) - Plain text version for search functionality
- `recordingUrl` (String) - URL to the call recording
- `recordingDuration` (Int) - Duration of recording in seconds
- `sentimentScore` (Float) - Sentiment score from 0.0 to 1.0
- `keyTopics` (String[]) - Array of key topics detected
- `actionItems` (String[]) - Array of action items identified

**Migration Required:**
Run the SQL migration file:
```bash
psql -U your_user -d your_database -f backend/prisma/migrations/add_call_recordings_transcripts.sql
```

Or if you can install Prisma successfully:
```bash
cd backend
npx prisma migrate dev --name add_call_recordings_transcripts
npx prisma generate
```

### 2. Backend Services

#### Call Analysis Service
**File:** `backend/src/services/callAnalysis.js`

New service that uses OpenAI GPT-4o-mini to:
- Generate call summaries (1-2 sentences)
- Extract key topics from conversations
- Identify action items
- Analyze sentiment and provide a score

**Environment Variables Required:**
- `OPENAI_API_KEY` - Your OpenAI API key

#### VAPI Webhook Updates
**File:** `backend/src/routes/vapi.js`

Enhanced `handleCallEnded` function to:
- Extract recording URL from VAPI response (checks `call.recordingUrl`, `event.recordingUrl`, and `call.artifact.recordingUrl`)
- Parse transcript messages with timestamps
- Run AI analysis for PROFESSIONAL and ENTERPRISE plans
- Store structured data in database

Expected VAPI webhook format:
```json
{
  "type": "call.ended",
  "call": {
    "id": "call_123",
    "assistantId": "assistant_456",
    "duration": 125,
    "recordingUrl": "https://storage.vapi.ai/recordings/abc123.mp3",
    "messages": [
      {
        "role": "assistant",
        "content": "Hello! How can I help you today?",
        "timestamp": "2024-01-01T10:00:00Z"
      },
      {
        "role": "user",
        "content": "I want to book an appointment",
        "timestamp": "2024-01-01T10:00:05Z"
      }
    ],
    "endedReason": "completed"
  }
}
```

#### API Endpoints Updates
**File:** `backend/src/routes/callLogs.js`

Enhanced endpoints:
- `GET /api/call-logs` - Now supports `search` parameter for transcript search
- `GET /api/call-logs/:id` - Returns full call details including transcript, recording, and analysis

### 3. Frontend Components

#### TranscriptModal Component
**File:** `frontend/components/TranscriptModal.jsx`

New comprehensive modal component featuring:
- **Audio Player:**
  - Play/pause controls
  - Progress bar with seeking
  - Playback speed control (0.5x, 1x, 1.5x, 2x)
  - Volume control
  - Duration display

- **Call Summary:**
  - AI-generated summary in highlighted box
  - Sentiment badge with score
  - Key topics as badges
  - Action items list

- **Transcript Display:**
  - Chat-style interface with speaker differentiation
  - AI Assistant messages (blue, right-aligned)
  - Customer messages (white, left-aligned)
  - Timestamps for each message
  - Search functionality with highlighting

- **Download Features:**
  - Download recording audio file
  - Download transcript as .txt file

#### Enhanced Calls Page
**File:** `frontend/app/dashboard/calls/page.jsx`

Updated table with new columns:
- Phone Number
- Date & Time
- Duration
- Status
- Sentiment (color-coded badge)
- Summary (truncated with hover to see full text)
- Actions (Play recording, View transcript buttons)

New features:
- Search by phone number, call ID, or transcript content
- Filter by status
- Real-time search with debouncing (500ms)
- Click actions to open TranscriptModal

## Testing Checklist

### 1. Backend Testing

```bash
# Test VAPI webhook endpoint
curl -X POST http://localhost:3001/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "call.ended",
    "call": {
      "id": "test_call_123",
      "assistantId": "YOUR_ASSISTANT_ID",
      "duration": 120,
      "recordingUrl": "https://example.com/recording.mp3",
      "messages": [
        {
          "role": "assistant",
          "content": "Hello, how can I help you?",
          "timestamp": "2024-01-01T10:00:00Z"
        },
        {
          "role": "user",
          "content": "I need to schedule an appointment",
          "timestamp": "2024-01-01T10:00:05Z"
        }
      ],
      "endedReason": "completed"
    }
  }'

# Test search endpoint
curl "http://localhost:3001/api/call-logs?search=appointment" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test call details endpoint
curl "http://localhost:3001/api/call-logs/1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Frontend Testing

1. **Navigate to Calls Page:**
   - Go to `/dashboard/calls`
   - Verify table shows all columns correctly

2. **Test Search:**
   - Type in search box
   - Verify debounced search (waits 500ms before searching)
   - Search for phone numbers, call IDs, and transcript content

3. **Test Filters:**
   - Change status filter
   - Verify calls are filtered correctly

4. **Test Transcript Modal:**
   - Click "View Transcript" button (FileText icon)
   - Verify modal opens with call details

5. **Test Audio Player:**
   - Click play button
   - Test pause
   - Test seeking (drag progress bar)
   - Test playback speed buttons
   - Verify duration display

6. **Test Transcript Display:**
   - Verify messages are displayed with correct colors
   - AI messages should be blue, right-aligned
   - Customer messages should be white, left-aligned
   - Verify timestamps are shown

7. **Test Search in Transcript:**
   - Type in modal search box
   - Verify matching text is highlighted in yellow
   - Verify non-matching messages are filtered out

8. **Test Downloads:**
   - Click "Download" on recording - should open recording URL
   - Click "Download" on transcript - should download .txt file

9. **Test Analysis Display:**
   - Verify sentiment badge is shown with correct color
   - Verify key topics are displayed as badges
   - Verify action items are listed
   - Verify summary is shown in blue box

10. **Test Mobile Responsiveness:**
    - Open on mobile device or resize browser
    - Verify table is scrollable
    - Verify modal is responsive

## Deployment Steps

### 1. Database Migration

```bash
# Option 1: Using Prisma (if you can install it)
cd backend
npm install
npx prisma migrate dev --name add_call_recordings_transcripts
npx prisma generate

# Option 2: Direct SQL (if Prisma installation fails)
psql -U your_user -d your_database -f backend/prisma/migrations/add_call_recordings_transcripts.sql
```

### 2. Environment Variables

Ensure these are set in your `.env` file:

```env
# OpenAI API Key (required for call analysis)
OPENAI_API_KEY=sk-...

# Database connection
DATABASE_URL=postgresql://user:password@host:port/database
```

### 3. Backend Deployment

```bash
cd backend
npm install
npm run start
```

### 4. Frontend Deployment

```bash
cd frontend
npm install
npm run build
npm run start
```

## Features by Subscription Plan

- **FREE/BASIC:** Call logs stored, but no AI analysis
- **PROFESSIONAL/ENTERPRISE:**
  - AI-powered call summaries
  - Key topics extraction
  - Action items identification
  - Sentiment analysis

## Cost Considerations

- **OpenAI API:**
  - Model: GPT-4o-mini
  - Average cost per call: ~$0.001-0.002
  - Only runs for PRO+ plans
  - Fails gracefully if OpenAI is unavailable

- **Storage:**
  - Recordings stored on VAPI servers (no additional cost)
  - Transcript data stored in PostgreSQL (minimal storage impact)

## Security Considerations

1. **Authentication:**
   - All API endpoints require authentication
   - VAPI webhook is public but validates assistant IDs

2. **Data Access:**
   - Users can only access calls for their business
   - Business ID verification on all endpoints

3. **Recording URLs:**
   - Stored as-is from VAPI
   - No re-hosting of audio files
   - VAPI handles recording security

## Troubleshooting

### Prisma Installation Fails
- Use the manual SQL migration file
- File: `backend/prisma/migrations/add_call_recordings_transcripts.sql`

### OpenAI API Errors
- Verify `OPENAI_API_KEY` is set correctly
- AI analysis fails gracefully - calls are still logged
- Check OpenAI API quota and billing

### Recordings Not Showing
- Verify VAPI is sending `recordingUrl` in webhook
- Check VAPI dashboard for recording settings
- Ensure recording is enabled for the assistant

### Transcripts Not Appearing
- Verify VAPI is sending `messages` array in webhook
- Check webhook payload in server logs
- Ensure transcript generation is enabled in VAPI

### Search Not Working
- Verify `transcriptText` field is populated in database
- Check that migration ran successfully
- Ensure PostgreSQL full-text search is working

## Future Enhancements

1. **Speaker Diarization:** Better identification of multiple speakers
2. **Call Ratings:** Allow users to rate call quality
3. **Custom Tags:** Let users add custom tags to calls
4. **Analytics Dashboard:** Visualize trends in sentiment, topics, etc.
5. **Export to CSV:** Include transcript in CSV export
6. **Call Notes:** Allow users to add notes to calls
7. **Automated Follow-ups:** Trigger actions based on detected topics/sentiment

## Support

For issues or questions:
1. Check server logs for error messages
2. Verify database schema matches expected structure
3. Test API endpoints directly with curl
4. Check browser console for frontend errors
5. Verify VAPI webhook is being received

## License

This implementation is part of the AI Assistant SaaS platform.
