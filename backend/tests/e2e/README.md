# Phase 4 E2E Test Suite

## Test Execution

```bash
# Install dependencies
npm install --save-dev @jest/globals

# Set DATABASE_URL
export DATABASE_URL="postgresql://..."

# Run tests
npm test -- tests/e2e/phase4-rag-pilot.test.js
```

## Expected Output

```
 PASS  tests/e2e/phase4-rag-pilot.test.js
  Test 1: ORDER Intent with Tool Data
    ✓ should include order details from tool in draft (2543 ms)
  Test 2: ORDER Intent - Verification Fallback
    ✓ should ask for verification info instead of guessing (1872 ms)
  Test 3: Recipient Guard - Injection Prevention
    ✓ should block LLM from modifying To/CC/BCC (12 ms)
    ✓ should strip CRLF from subject line (3 ms)
  Test 4: PII Redaction
    ✓ should redact IBAN from email body (8 ms)
    ✓ should redact credit card number (5 ms)
  Test 5: Token Budget Overflow
    ✓ should preserve tool results even when budget tight (42 ms)
  Test 6: Idempotency - Duplicate Message Handling
    ✓ should not create duplicate drafts for same messageId (1934 ms)
  Test Summary
    ✓ should log test suite completion (2 ms)

🎉 Phase 4 E2E Test Suite Complete
===================================
✅ Test 1: ORDER with tool data
✅ Test 2: ORDER without tool data (verification)
✅ Test 3: Recipient guard + CRLF injection
✅ Test 4: PII redaction (IBAN, credit card)
✅ Test 5: Token budget overflow
✅ Test 6: Idempotency

All critical scenarios PASSED ✅
Phase 4 pilot deployment: APPROVED

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        6.421 s
```

## CI Integration

Add to `.github/workflows/test.yml`:

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- tests/e2e/phase4-rag-pilot.test.js
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```
