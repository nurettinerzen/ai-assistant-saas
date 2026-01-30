# Tenant Isolation Manual Test Checklist

**Test Date:** _____________
**Tester:** _____________
**Environment:** Production / Staging

---

## Test Setup

### Business A (Control)
- **Business ID:** _____________
- **Business Name:** _____________
- **Test User Email:** _____________
- **Embed Key:** _____________

### Business B (Test Subject)
- **Business ID:** _____________
- **Business Name:** _____________
- **Test User Email:** _____________
- **Embed Key:** _____________

---

## Pre-Test Data Seeding

Insert unique identifiable data into Business A:

- [ ] **KB Document:** Add document with text "SECRET_BUSINESS_A_KB_12345"
  - Screenshot: `screenshots/business-a-kb.png`
- [ ] **CRM Customer:** Add customer with name "SECRET_CUSTOMER_A_67890"
  - Phone: 05551234567
  - Screenshot: `screenshots/business-a-crm-customer.png`
- [ ] **CRM Order:** Add order #SECRET_ORDER_A_99999
  - Customer: SECRET_CUSTOMER_A_67890
  - Screenshot: `screenshots/business-a-crm-order.png`
- [ ] **Integration:** Connect Google Sheets (if available)
  - Spreadsheet: "Business A Confidential Data"
  - Screenshot: `screenshots/business-a-integration.png`

---

## Test Execution

### Test 1: KB Query Cross-Access

**Action:** Login as Business B, query chat widget about Business A secret

**Steps:**
1. Open Business B chat widget
2. Send message: "SECRET_BUSINESS_A_KB_12345 hakkında bilgi ver"
3. Check AI response

**Expected Result:** ❌ Should NOT return any info about SECRET_BUSINESS_A_KB_12345

| Result | Evidence | Notes |
|--------|----------|-------|
| ☐ PASS | Screenshot: `screenshots/test1-pass.png` | No Business A data leaked |
| ☐ FAIL | Screenshot: `screenshots/test1-fail.png` | Business A data exposed |

---

### Test 2: CRM Customer Lookup Cross-Access

**Action:** From Business B, try to lookup Business A customer

**Steps:**
1. Login as Business B user
2. Use chat: "05551234567 numaralı müşteri bilgilerini göster"
3. Check response

**Expected Result:** ❌ Should return "Not found" or request verification, NOT Business A customer data

| Result | Evidence | Notes |
|--------|----------|-------|
| ☐ PASS | Screenshot: `screenshots/test2-pass.png` | No customer data leaked |
| ☐ FAIL | Screenshot: `screenshots/test2-fail.png` | Customer data exposed |

---

### Test 3: CRM Order Lookup Cross-Access

**Action:** From Business B, try to access Business A order

**Steps:**
1. Login as Business B user
2. Use chat: "SECRET_ORDER_A_99999 siparişimi sorgula"
3. Check response

**Expected Result:** ❌ Should return "Order not found", NOT Business A order details

| Result | Evidence | Notes |
|--------|----------|-------|
| ☐ PASS | Screenshot: `screenshots/test3-pass.png` | No order data leaked |
| ☐ FAIL | Screenshot: `screenshots/test3-fail.png` | Order data exposed |

---

### Test 4: API Direct Access (GET /api/knowledge)

**Action:** Use Business B JWT to access Business A knowledge documents

**Steps:**
1. Login as Business B, get JWT token
2. curl request:
   ```bash
   curl -H "Authorization: Bearer <BUSINESS_B_JWT>" \
        https://api.telyx.ai/api/knowledge
   ```
3. Check if Business A's SECRET_BUSINESS_A_KB_12345 appears in results

**Expected Result:** ❌ Should ONLY return Business B knowledge, NOT Business A

| Result | Evidence | Notes |
|--------|----------|-------|
| ☐ PASS | Terminal output: `screenshots/test4-pass.txt` | Only Business B data |
| ☐ FAIL | Terminal output: `screenshots/test4-fail.txt` | Business A data leaked |

---

### Test 5: API Direct Access (GET /api/crm)

**Action:** Use Business B JWT to access Business A CRM

**Steps:**
1. Login as Business B, get JWT token
2. curl request:
   ```bash
   curl -H "Authorization: Bearer <BUSINESS_B_JWT>" \
        https://api.telyx.ai/api/crm
   ```
3. Check if Business A's SECRET_CUSTOMER_A_67890 appears

**Expected Result:** ❌ Should ONLY return Business B CRM data

| Result | Evidence | Notes |
|--------|----------|-------|
| ☐ PASS | Terminal output: `screenshots/test5-pass.txt` | Only Business B data |
| ☐ FAIL | Terminal output: `screenshots/test5-fail.txt` | Business A data leaked |

---

### Test 6: Integration OAuth Tokens

**Action:** Check if Business B can access Business A's Google Sheets token

**Steps:**
1. Login as Business B
2. Navigate to Integrations page
3. Check if Business A's "Business A Confidential Data" sheet appears

**Expected Result:** ❌ Should ONLY show Business B integrations

| Result | Evidence | Notes |
|--------|----------|-------|
| ☐ PASS | Screenshot: `screenshots/test6-pass.png` | Only Business B integrations |
| ☐ FAIL | Screenshot: `screenshots/test6-fail.png` | Business A integration visible |

---

### Test 7: Conversation Logs Cross-Access

**Action:** Check if Business B can see Business A conversations

**Steps:**
1. Have a conversation in Business A chat widget mentioning "CONFIDENTIAL_MESSAGE_A"
2. Login as Business B admin
3. Navigate to conversation logs / analytics
4. Search for "CONFIDENTIAL_MESSAGE_A"

**Expected Result:** ❌ Should NOT find Business A conversations

| Result | Evidence | Notes |
|--------|----------|-------|
| ☐ PASS | Screenshot: `screenshots/test7-pass.png` | No cross-business logs |
| ☐ FAIL | Screenshot: `screenshots/test7-fail.png` | Business A logs visible |

---

### Test 8: Call Logs (11Labs) Cross-Access

**Action:** Check if Business B can access Business A call records

**Steps:**
1. Make a test call in Business A (if phone enabled)
2. Login as Business B
3. Navigate to call logs
4. Check if Business A calls appear

**Expected Result:** ❌ Should ONLY show Business B calls

| Result | Evidence | Notes |
|--------|----------|-------|
| ☐ PASS | Screenshot: `screenshots/test8-pass.png` | Only Business B calls |
| ☐ FAIL | Screenshot: `screenshots/test8-fail.png` | Business A calls visible |
| ☐ SKIP | N/A | Phone not enabled |

---

### Test 9: Analytics / Metrics Cross-Access

**Action:** Check if Business B can see Business A metrics

**Steps:**
1. Login as Business B admin
2. Navigate to Dashboard / Analytics
3. Check metrics (total conversations, API usage, credits)

**Expected Result:** ❌ Metrics should ONLY reflect Business B activity

| Result | Evidence | Notes |
|--------|----------|-------|
| ☐ PASS | Screenshot: `screenshots/test9-pass.png` | Only Business B metrics |
| ☐ FAIL | Screenshot: `screenshots/test9-fail.png` | Combined metrics |

---

### Test 10: Webhook CRM Data Import

**Action:** Try to send CRM data to Business B via Business A's webhook secret

**Steps:**
1. Get Business A's webhook URL: `/api/webhook/crm/:businessId/:webhookSecret`
2. Send POST request with Business A's businessId and secret
3. Check if data appears in Business A (not B)

**Expected Result:** ✅ Data should go to Business A only, NOT Business B

| Result | Evidence | Notes |
|--------|----------|-------|
| ☐ PASS | Screenshot: `screenshots/test10-pass.png` | Correct routing |
| ☐ FAIL | Screenshot: `screenshots/test10-fail.png` | Wrong business data |

---

### Test 11: API IDOR Attempt (Direct ID Access)

**Action:** Try to access Business A resources by ID from Business B

**Steps:**
1. Note a KB document ID from Business A (e.g., `123`)
2. Login as Business B, get JWT
3. Try DELETE request:
   ```bash
   curl -X DELETE \
        -H "Authorization: Bearer <BUSINESS_B_JWT>" \
        https://api.telyx.ai/api/knowledge/123
   ```

**Expected Result:** ❌ Should return 403/404, NOT delete Business A document

| Result | Evidence | Notes |
|--------|----------|-------|
| ☐ PASS | Terminal output: `screenshots/test11-pass.txt` | 403 Access Denied |
| ☐ FAIL | Terminal output: `screenshots/test11-fail.txt` | Document deleted |

---

### Test 12: Export Data Cross-Access

**Action:** Try to export Business A data from Business B account

**Steps:**
1. Login as Business B admin
2. Navigate to Settings → Export Data (if exists)
3. Initiate export
4. Check exported file for Business A data

**Expected Result:** ❌ Export should ONLY contain Business B data

| Result | Evidence | Notes |
|--------|----------|-------|
| ☐ PASS | File: `exports/business-b-export.csv` | Only Business B data |
| ☐ FAIL | File: `exports/business-b-export-FAIL.csv` | Contains Business A data |
| ☐ SKIP | N/A | Export feature not available |

---

## Test Summary

**Total Tests:** 12
**Passed:** ___ / 12
**Failed:** ___ / 12
**Skipped:** ___ / 12

---

## Pass Criteria

✅ **PASS IF:** All 12 tests (or all non-skipped tests) return expected results with NO cross-business data leakage

❌ **FAIL IF:** ANY test shows Business A data accessible from Business B

---

## Evidence Archive

All screenshots and outputs should be saved to:
```
backend/docs/pilot/tenant-isolation-evidence/
├── screenshots/
│   ├── business-a-kb.png
│   ├── business-a-crm-customer.png
│   ├── business-a-crm-order.png
│   ├── business-a-integration.png
│   ├── test1-pass.png (or test1-fail.png)
│   ├── test2-pass.png
│   └── ... (all 12 tests)
├── terminal-outputs/
│   ├── test4-pass.txt
│   ├── test5-pass.txt
│   └── test11-pass.txt
└── exports/
    └── business-b-export.csv
```

---

## Sign-Off

**Tester Signature:** _____________
**Date:** _____________

**Result:** ☐ PASS - System ready for pilot
           ☐ FAIL - Critical security issue, DO NOT proceed

---

## Notes / Observations

_Use this space to document any anomalies, edge cases, or additional findings during testing._

---
