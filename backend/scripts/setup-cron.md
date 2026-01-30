# Automated Daily Smoke Test - Setup Guide

## Overview

Otomatik smoke test sistemi günde 2 kez çalışır:
- **Sabah:** 09:00 Turkey Time (06:00 UTC)
- **Akşam:** 18:00 Turkey Time (15:00 UTC)

## Setup Options

### Option 1: Render.com Cron Jobs (Recommended)

Render.com'da cron job service oluştur:

1. **Create New Cron Job** (Render Dashboard)
   - Name: `telyx-smoke-test-morning`
   - Environment: Same as backend
   - Command: `node backend/scripts/daily-smoke-test.js`
   - Schedule: `0 6 * * *` (06:00 UTC = 09:00 Turkey)

2. **Create Second Cron Job**
   - Name: `telyx-smoke-test-evening`
   - Environment: Same as backend
   - Command: `node backend/scripts/daily-smoke-test.js`
   - Schedule: `0 15 * * *` (15:00 UTC = 18:00 Turkey)

3. **Environment Variables**
   ```
   TEST_ACCOUNT_A_EMAIL=nurettinerzen@gmail.com
   TEST_ACCOUNT_A_PASSWORD=***
   TEST_ACCOUNT_B_EMAIL=nurettin@selenly.co
   TEST_ACCOUNT_B_PASSWORD=***
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   API_URL=https://api.telyx.ai
   ```

### Option 2: GitHub Actions (Alternative)

`.github/workflows/daily-smoke-test.yml`:

```yaml
name: Daily Smoke Test

on:
  schedule:
    - cron: '0 6 * * *'   # 09:00 Turkey (morning)
    - cron: '0 15 * * *'  # 18:00 Turkey (evening)
  workflow_dispatch:      # Manual trigger

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd backend
          npm install
      - name: Run smoke test
        env:
          TEST_ACCOUNT_A_EMAIL: ${{ secrets.TEST_ACCOUNT_A_EMAIL }}
          TEST_ACCOUNT_A_PASSWORD: ${{ secrets.TEST_ACCOUNT_A_PASSWORD }}
          TEST_ACCOUNT_B_EMAIL: ${{ secrets.TEST_ACCOUNT_B_EMAIL }}
          TEST_ACCOUNT_B_PASSWORD: ${{ secrets.TEST_ACCOUNT_B_PASSWORD }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          API_URL: https://api.telyx.ai
        run: node backend/scripts/daily-smoke-test.js
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: smoke-test-report
          path: backend/tests/pilot/reports/*.txt
```

### Option 3: Server Crontab (If you have a server)

```bash
# SSH into your server
ssh user@your-server

# Edit crontab
crontab -e

# Add these lines:
0 6 * * * cd /path/to/ai-assistant-saas/backend && node scripts/daily-smoke-test.js >> /var/log/telyx-smoke.log 2>&1
0 15 * * * cd /path/to/ai-assistant-saas/backend && node scripts/daily-smoke-test.js >> /var/log/telyx-smoke.log 2>&1
```

## Slack Integration Setup

1. **Create Slack Incoming Webhook**
   - Go to: https://api.slack.com/messaging/webhooks
   - Create app or use existing
   - Add "Incoming Webhooks" feature
   - Create webhook for #engineering or #alerts channel
   - Copy webhook URL

2. **Add to Environment**
   ```bash
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
   ```

3. **Test Notification**
   ```bash
   curl -X POST YOUR_WEBHOOK_URL \
     -H 'Content-Type: application/json' \
     -d '{"text":"Test: Smoke test notifications working!"}'
   ```

## Email Notifications (Optional)

If you want email instead of Slack:

1. Add email service to script:
   ```javascript
   // In daily-smoke-test.js, add email function
   import nodemailer from 'nodemailer';

   async function sendEmailReport(report) {
     const transporter = nodemailer.createTransport({
       service: 'gmail',
       auth: {
         user: process.env.ALERT_EMAIL_FROM,
         pass: process.env.ALERT_EMAIL_PASSWORD
       }
     });

     await transporter.sendMail({
       from: process.env.ALERT_EMAIL_FROM,
       to: process.env.ALERT_EMAIL,
       subject: `[Telyx] Smoke Test ${report.failedTests > 0 ? 'FAILED' : 'PASSED'}`,
       text: reportText
     });
   }
   ```

2. Install nodemailer:
   ```bash
   npm install nodemailer
   ```

## Manual Testing

Test the script locally before deploying:

```bash
# Set environment variables
export TEST_ACCOUNT_A_EMAIL="nurettinerzen@gmail.com"
export TEST_ACCOUNT_A_PASSWORD="your_password"
export TEST_ACCOUNT_B_EMAIL="nurettin@selenly.co"
export TEST_ACCOUNT_B_PASSWORD="your_password"
export API_URL="https://api.telyx.ai"

# Run test
cd backend
node scripts/daily-smoke-test.js
```

## Report Storage

Reports are saved to:
```
backend/tests/pilot/reports/smoke-YYYY-MM-DD-HH.txt
```

Example:
```
backend/tests/pilot/reports/smoke-2026-01-30-09.txt  (morning)
backend/tests/pilot/reports/smoke-2026-01-30-18.txt  (evening)
```

## Monitoring the Tests

1. **Check Logs**
   - Render: Dashboard → Cron Job → Logs
   - GitHub Actions: Actions tab → Daily Smoke Test
   - Server: `tail -f /var/log/telyx-smoke.log`

2. **Slack Notifications**
   - Instant notification on test completion
   - Red alert for failures
   - Summary in #alerts channel

3. **Report Files**
   - Stored for 30 days
   - Can be reviewed for trends
   - Contains full test details

## Troubleshooting

### Test fails with "Login failed"
- Check TEST_ACCOUNT_A/B_PASSWORD in environment
- Verify accounts are active in production

### No Slack notification
- Check SLACK_WEBHOOK_URL is set
- Test webhook manually with curl
- Check Slack app permissions

### Tests timeout
- Increase timeout in axios calls (currently 10s)
- Check API performance
- Verify network connectivity

## Next Steps

1. ✅ Script created: `backend/scripts/daily-smoke-test.js`
2. ⏳ Choose deployment method (Render cron recommended)
3. ⏳ Set up Slack webhook
4. ⏳ Configure environment variables
5. ⏳ Test manually once
6. ⏳ Deploy and monitor first automated run

## Cost

- **Render Cron Jobs:** $1/month per job ($2/month total)
- **GitHub Actions:** Free for public repos, 2000 mins/month for private
- **Server Crontab:** Free (if you have a server)

**Recommendation:** Start with Render cron jobs for simplicity.
