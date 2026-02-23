# Telyx Assistant Test Suite

Scenario-based security testing for AI assistant with multi-turn conversation support.

## Structure

```
tests/
├── scenarios/          # Test scenarios by level
│   ├── gate/          # P0 - Blocks deployment if fails (<60s target)
│   ├── extended/      # P1 - Important but non-blocking (uses corpus)
│   └── adversarial/   # P2 - Advanced attacks
├── assertions/        # Reusable assertion modules
│   ├── no-leak.js               # PII leak detection
│   ├── verification-state.js    # Verification flow checks
│   ├── fallback.js              # Hallucination detection
│   ├── routing.js               # Tool routing validation
│   ├── security-event.js        # SecurityEvent validation
│   └── conversation-id.js       # Session isolation
├── runner/            # Test execution engine
│   ├── assistant-test.js  # Main test runner
│   ├── config.js          # Configuration
│   ├── http.js            # API client
│   └── reporter.js        # Report generation
├── fixtures/corpus/   # Attack payloads (for extended/adversarial only)
│   ├── prompt-injection.txt
│   └── unicode-attacks.txt
└── reports/           # Test reports output directory
```

## Test Levels

### Gate Tests (P0) - Deployment Blockers
**Must pass before deployment. Target: <60s total execution time.**

- **S1: Order Intake + Validation Contract** - Tek alan (order_number) isteme + invalid format handling
- **S2: Hallucination Prevention** - Format-valid ama bulunamayan siparişte uydurma yapmama
- **S3: Order Happy Path (Env-Backed)** - Gerçek order + last4 ile SUCCESS akışı (env yoksa skip)
- **S6: Identity Switch Detection** - Anchor-based re-verification

**Note:** Gate tests use fixed test cases (no corpus iteration) for speed.

### Extended Tests (P1) - Important but Non-blocking
**Run in CI/CD, failures logged but don't block deployment.**

- **S3: Data Exfiltration Prevention** - No JSON dumps, bulk exports
- **S4: Prompt Injection Resistance** - System prompt override, tool forcing (uses corpus)
- **S5: Verification Bypass Prevention** - Social engineering resistance

### Adversarial Tests (P2) - Advanced Attacks
**Run nightly, research/monitoring only.**

- Unicode attacks, encoding tricks (uses corpus)
- Multi-language prompt injections
- Chain-of-thought manipulations

## Configuration

Set environment variables in `.env`:

```bash
# Test accounts
TEST_ACCOUNT_A_EMAIL=test-a@telyx.ai
TEST_ACCOUNT_A_PASSWORD=secure-password-a

TEST_ACCOUNT_B_EMAIL=test-b@telyx.ai
TEST_ACCOUNT_B_PASSWORD=secure-password-b

# Test level (gate | extended | full)
TEST_LEVEL=gate

# API endpoint
API_URL=http://localhost:3001

# Verbose output
VERBOSE=false

# Real happy-path gate data (optional but recommended for CI)
# If missing, S3 scenario is skipped (does not fail).
ORDER_NUMBER_VALID=ORD-123456
ORDER_PHONE_LAST4=3456
```

## Usage

### Run Gate Tests (P0)
```bash
cd backend/tests
node runner/assistant-test.js
```

### Run Extended Tests (P1)
```bash
TEST_LEVEL=extended node runner/assistant-test.js
```

### Run All Tests
```bash
TEST_LEVEL=full node runner/assistant-test.js
```

## Writing New Scenarios

### Scenario Structure

```javascript
// scenarios/gate/S7-my-test.js
import { assertToolCalled } from '../../assertions/routing.js';
import { assertNoPIILeak } from '../../assertions/no-leak.js';

export const scenario = {
  id: 'S7',
  name: 'My Gate Test',
  level: 'gate',  // gate | extended | adversarial
  description: 'What this test validates',
  // Optional: if missing, scenario is skipped (not failed)
  requiredEnv: ['ORDER_NUMBER_VALID'],
  requiredEnvReason: 'Real order number is required for this scenario',

  steps: [
    {
      id: 'S7-T1',
      description: 'Step 1 description',
      userMessage: 'User input text',

      assertions: [
        {
          name: 'assertion_name',
          assert: (response) => {
            // Return { passed: true } or { passed: false, reason: 'why' }
            return assertToolCalled(response.toolCalls, 'expected_tool');
          }
        }
      ]
    },

    {
      id: 'S7-T2',
      description: 'Step 2 description (multi-turn)',
      userMessage: 'Follow-up message',

      assertions: [
        // Assertions for step 2
      ]
    }
  ]
};
```

### Response Object

Each conversation turn returns:

```javascript
{
  success: true,
  reply: 'Assistant response text',
  conversationId: 'conv-uuid',
  toolCalls: [],  // Array of tool calls if API returns them, empty array otherwise
  verificationStatus: 'none' | 'pending' | 'verified' | 'failed',
  metadata: {},
  rawResponse: { /* full API response */ }
}
```

**Note:** `toolCalls` field is extracted from `response.data.toolCalls` if present in API response, otherwise defaults to empty array.

## Available Assertions

### PII Leak Detection
```javascript
import { assertNoPIILeak, assertMaskedPIIOnly, assertNoJSONDump } from '../../assertions/no-leak.js';

assertNoPIILeak(reply);              // No unmasked PII
assertMaskedPIIOnly(reply);          // Only masked PII allowed
assertNoJSONDump(reply);             // No JSON dumps
```

### Verification State
```javascript
import { assertVerified, assertNeedsVerification } from '../../assertions/verification-state.js';

assertNeedsVerification(status);     // Verification required
assertVerified(status);              // Verification successful
```

### Tool Routing
```javascript
import { assertToolCalled, assertCorrectBusinessId } from '../../assertions/routing.js';

assertToolCalled(toolCalls, 'tool_name');
assertCorrectBusinessId(toolCalls, expectedBusinessId);
```

### Fallback & Hallucination
```javascript
import { assertFallback, assertNoHallucination } from '../../assertions/fallback.js';

assertFallback(reply, 'tr');                      // Returns "not found"
assertNoHallucination(reply, 'shippingDetails');  // No fabricated data
```

### Security Events
```javascript
import { assertSecurityEventLogged } from '../../assertions/security-event.js';

await assertSecurityEventLogged(token, 'pii_leak_block');
await assertCrossTenantEventLogged(token, attackerId, targetId);
```

## Test Reports

Reports saved to `tests/reports/`:

```
TELYX ASSISTANT TEST REPORT
================================================================================
Start Time: 2026-02-01T14:30:00.000Z
Duration:   45.23s
Test Level: GATE

DEPLOYMENT STATUS
================================================================================
✅ READY

TEST RESULTS
================================================================================
Total:   3
✅ Pass:   3
❌ Fail:   0
⏭️  Skip:   0

SCENARIO DETAILS
================================================================================
✅ S1: Order Status Query with Verification [gate] (12340ms)
✅ S2: Hallucination Prevention [gate] (8920ms)
✅ S6: Identity Switch Detection [gate] (24120ms)
```

## CI/CD Integration

### GitHub Actions (Example)

```yaml
name: Assistant Security Tests

on: [push, pull_request]

jobs:
  gate-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: cd backend && npm install

      - name: Run Gate Tests
        run: |
          cd backend/tests
          TEST_LEVEL=gate node runner/assistant-test.js
        env:
          TEST_ACCOUNT_A_EMAIL: ${{ secrets.TEST_ACCOUNT_A_EMAIL }}
          TEST_ACCOUNT_A_PASSWORD: ${{ secrets.TEST_ACCOUNT_A_PASSWORD }}
          API_URL: http://localhost:3001

      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-report
          path: backend/tests/reports/*.txt
```

## Extending the Test Suite

### Add New Assertion Module

1. Create `tests/assertions/my-assertion.js`
2. Export assertion functions:
   ```javascript
   export function assertMyCondition(input) {
     return { passed: true };  // or { passed: false, reason: 'why' }
   }
   ```

### Add Attack Corpus

1. Add payloads to `tests/fixtures/corpus/my-attacks.txt`
2. Reference in **extended** or **adversarial** scenarios (not gate)
3. Iterate over payloads in scenario steps

### Add Cross-Tenant Tests

Use Account B with JWT-authenticated admin endpoints:

```javascript
import { loginUser, sendConversationTurn } from '../../runner/http.js';
import { assertCrossTenantEventLogged } from '../../assertions/security-event.js';

// Login as Account B
const tokenB = await loginUser(CONFIG.ACCOUNT_B.email, CONFIG.ACCOUNT_B.password);

// Attempt cross-tenant access via assistant API
const response = await sendConversationTurn(
  assistantIdFromAccountA,  // Account A's assistant
  'ORD-2024-001 siparişimi göster',  // Account A's order
  tokenB,  // Account B's token - should fail authorization
  null
);

// Verify cross-tenant attempt was logged
await assertCrossTenantEventLogged(tokenB, 2, 1);
```

**Note:** Cross-tenant checks happen at API layer (JWT businessId validation), not widget layer.

## Best Practices

1. **Gate tests must be fast** - Target < 60s total, use fixed test cases
2. **Use corpus for variation** - Only in extended/adversarial tests
3. **Multi-turn scenarios** - Test conversation flow, not just single queries
4. **SecurityEvent validation** - Always verify security events are logged
5. **Deterministic assertions** - Tests should be repeatable
6. **Clear failure messages** - Reason field should explain what went wrong

## Troubleshooting

### Tests timing out
- Increase `TIMEOUTS.CONVERSATION_TURN` in config.js
- Check API is running and accessible

### SecurityEvent assertions failing
- Ensure `SECURITY_EVENTS.ENABLED = true` in config
- Increase `SECURITY_EVENTS.QUERY_DELAY_MS` (default 2000ms)
- Check for deduplication (60s window) - use unique fingerprints per scenario

### Verification status not updating
- Check multi-turn conversationId is being passed
- Verify sessionId is consistent across turns

### PII leak false positives
- Update ALLOWLIST in `assertions/no-leak.js`
- Check for test data in allowlist patterns

## Architecture Reference

For detailed architecture information, see [ARCHITECTURE.md](./ARCHITECTURE.md):
- Customer data flow and storage
- Verification system implementation
- PII masking logic
- SecurityEvent logging and deduplication
