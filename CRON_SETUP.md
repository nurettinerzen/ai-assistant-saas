# CRON JOB SETUP GUIDE

**Purpose**: Schedule Red Alert health checks to run automatically
**Service**: cron-job.org (free tier: 25 cron jobs)
**Alternative**: EasyCron, Vercel Cron (if using Vercel)

---

## Prerequisites

1. **CRON_SECRET**: Backend zaten `.env` dosyasında var
   ```bash
   # backend/.env
   CRON_SECRET=your-secret-here
   ```

2. **Production URL**: `https://api.telyx.ai`

---

## Setup Instructions (cron-job.org)

### Step 1: Create Account
1. Go to https://cron-job.org
2. Sign up (free tier - no credit card needed)
3. Verify email

### Step 2: Add Red Alert Health Check Job

**URL**: `https://api.telyx.ai/api/cron/red-alert-health`

**Method**: `POST`

**Headers**:
```
X-Cron-Secret: YOUR_CRON_SECRET_HERE
Content-Type: application/json
```

**Schedule**: Every 6 hours (LA Time)
- **Option 1** (Simple): `0 */6 * * *` (00:00, 06:00, 12:00, 18:00 UTC)
  - Convert to LA: UTC-8 (PST) or UTC-7 (PDT)
  - **PST**: 16:00 (4PM), 22:00 (10PM), 04:00 (4AM), 10:00 (10AM) LA time
  - **PDT**: 17:00 (5PM), 23:00 (11PM), 05:00 (5AM), 11:00 (11AM) LA time

- **Option 2** (Exact LA times - 12AM, 6AM, 12PM, 6PM LA):
  - Use cron-job.org timezone selector: "America/Los_Angeles"
  - Cron: `0 0,6,12,18 * * *`

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Health check completed: healthy",
  "healthScore": 100,
  "status": "healthy",
  "events": {
    "critical": 0,
    "high": 0,
    "total": 5
  },
  "criticalEvents": [],
  "timestamp": "2026-01-30T18:00:00.000Z"
}
```

### Step 3: Configure Notifications (Optional)

**Email on Failure**:
- cron-job.org → Job Settings → Notifications
- Enable: "Send email on failure"
- Email: nurettinerzen@gmail.com

**Failure Detection**:
- HTTP status != 200
- Response time > 30s
- Connection timeout

---

## Screenshot Guide (cron-job.org)

### Creating the Job

1. **Dashboard** → "Create cronjob"

2. **Job Configuration**:
   ```
   Title: Red Alert Health Check
   URL: https://api.telyx.ai/api/cron/red-alert-health
   Request method: POST
   Request timeout: 30 seconds
   ```

3. **Schedule**:
   ```
   Timezone: America/Los_Angeles
   Pattern: 0 0,6,12,18 * * *
   (Runs at: 12AM, 6AM, 12PM, 6PM LA time)
   ```

4. **Advanced**:
   ```
   HTTP Headers:
   X-Cron-Secret: [YOUR_SECRET]
   Content-Type: application/json
   ```

5. **Notifications**:
   ```
   ✅ Send notification on failure
   Email: nurettinerzen@gmail.com
   ```

6. **Save** → Job will start running automatically

---

## Testing the Cron Job

### Manual Test (Before Scheduling)

```bash
# Get your CRON_SECRET from backend/.env
export CRON_SECRET="your-secret-here"

# Test health check endpoint
curl -X POST https://api.telyx.ai/api/cron/red-alert-health \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json"

# Expected: {"success":true,"healthScore":100,"status":"healthy",...}
```

### Verify in cron-job.org

1. Dashboard → "Red Alert Health Check"
2. Click "Execute now" (manual trigger)
3. Check "Execution history"
4. Should see: ✅ Success (HTTP 200)

---

## Alternative: Vercel Cron (If Using Vercel)

If frontend is on Vercel, you can use Vercel Cron (Hobby plan: free):

**File**: `vercel.json` (in frontend root)
```json
{
  "crons": [{
    "path": "/api/trigger-health-check",
    "schedule": "0 0,6,12,18 * * *"
  }]
}
```

**File**: `frontend/pages/api/trigger-health-check.js`
```javascript
export default async function handler(req, res) {
  const response = await fetch('https://api.telyx.ai/api/cron/red-alert-health', {
    method: 'POST',
    headers: {
      'X-Cron-Secret': process.env.CRON_SECRET,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  res.json(data);
}
```

---

## Monitoring Cron Jobs

### Check Execution History

**cron-job.org**:
- Dashboard → Job name → "Execution history"
- Shows: timestamp, status code, response time, response body

**What to Look For**:
- ✅ All executions: HTTP 200
- ⚠️ Yellow (warning): `status: "caution"` or `status: "warning"`
- 🚨 Red (critical): `status: "critical"` → Check email immediately

### Expected Execution Log (Healthy System)

```
2026-01-30 18:00:00 | ✅ 200 OK | 450ms | {"success":true,"status":"healthy","healthScore":100}
2026-01-30 12:00:00 | ✅ 200 OK | 520ms | {"success":true,"status":"healthy","healthScore":97}
2026-01-30 06:00:00 | ✅ 200 OK | 380ms | {"success":true,"status":"caution","healthScore":91}
2026-01-30 00:00:00 | ✅ 200 OK | 610ms | {"success":true,"status":"healthy","healthScore":100}
```

### Expected Email (Critical Status)

**Subject**: `🚨 Cron Job Failed: Red Alert Health Check`

**Body**:
```
Job: Red Alert Health Check
URL: https://api.telyx.ai/api/cron/red-alert-health
Time: 2026-01-30 18:00:00 PST
Status: 200 OK
Response: {"success":true,"status":"critical","healthScore":40,"events":{"critical":6,"high":0,"total":6}}

Action Required: Check Red Alert dashboard immediately
```

---

## Troubleshooting

### Error: 401 Unauthorized

**Cause**: Missing or incorrect `X-Cron-Secret` header

**Fix**:
1. Check backend/.env for `CRON_SECRET`
2. Update cron-job.org → Job → Advanced → HTTP Headers
3. Ensure header name is exactly `X-Cron-Secret` (case-sensitive)

### Error: 429 Too Many Requests

**Cause**: Job running too frequently (cooldown: 5 minutes)

**Fix**:
1. cron-job.org → Job → Schedule
2. Change from `*/5 * * * *` (every 5 min) to `0 */6 * * *` (every 6 hours)

### Error: 503 Service Unavailable

**Cause**: Render service is down or restarting

**Fix**:
1. Check Render dashboard → Service status
2. If deploying, wait 2-3 minutes
3. cron-job.org will auto-retry (if configured)

### No Response / Timeout

**Cause**: Database query slow (>30s timeout)

**Fix**:
1. Increase timeout: cron-job.org → Job → Request timeout → 60s
2. Check Render logs for slow queries
3. Add database index on `SecurityEvent.createdAt`

---

## Summary

✅ **What You Need to Do**:
1. Go to cron-job.org
2. Create account (free)
3. Add cron job with settings above
4. Test "Execute now"
5. Enable email notifications

⏱️ **Time Required**: 5 minutes

🎯 **Result**: Automated health checks every 6 hours + email alerts on critical status

---

## Quick Copy-Paste Config

```
Title: Red Alert Health Check
URL: https://api.telyx.ai/api/cron/red-alert-health
Method: POST
Schedule: 0 0,6,12,18 * * *
Timezone: America/Los_Angeles
Timeout: 30 seconds

Headers:
X-Cron-Secret: YOUR_SECRET_HERE
Content-Type: application/json

Notifications:
✅ Email on failure: nurettinerzen@gmail.com
```

Done! 🚀
