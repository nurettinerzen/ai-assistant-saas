#!/usr/bin/env node
/**
 * Replay Runner
 *
 * Deterministically replays production conversations in staging.
 * Reads JSON test cases (conforming to replay.schema.json),
 * sends each turn through the real orchestrator, and validates
 * responses against declarative check rules.
 *
 * Usage:
 *   node tests/replay/replayRunner.js                         # Run all cases
 *   node tests/replay/replayRunner.js --file=my-cases.json    # Specific file
 *   node tests/replay/replayRunner.js --case=R001             # Single case
 *   node tests/replay/replayRunner.js --tag=injection         # Filter by tag
 *   VERBOSE=true node tests/replay/replayRunner.js            # Verbose
 *
 * Prerequisites:
 *   - Server running (API_URL)
 *   - Test account credentials in .env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import runner infrastructure
const runnerDir = path.join(__dirname, '..', 'runner');

// Dynamic imports to use existing infrastructure
let CONFIG, validateConfig, loginUser, sendConversationTurn, cleanupTestAssistants;

async function loadDependencies() {
  const configModule = await import(`file://${path.join(runnerDir, 'config.js')}`);
  CONFIG = configModule.CONFIG || configModule.default;
  validateConfig = configModule.validateConfig;

  const httpModule = await import(`file://${path.join(runnerDir, 'http.js')}`);
  loginUser = httpModule.loginUser;
  sendConversationTurn = httpModule.sendConversationTurn;
  cleanupTestAssistants = httpModule.cleanupTestAssistants;
}

// Import assertions
let assertNoPIILeak, assertNoUngroundedClaims;

async function loadAssertions() {
  const noLeakModule = await import(`file://${path.join(__dirname, '..', 'assertions', 'no-leak.js')}`);
  assertNoPIILeak = noLeakModule.assertNoPIILeak;

  const groundingModule = await import(`file://${path.join(__dirname, '..', 'assertions', 'grounding.js')}`);
  assertNoUngroundedClaims = groundingModule.assertNoUngroundedClaims;
}

// CLI args
const args = process.argv.slice(2);
const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1];
const caseFilter = args.find(a => a.startsWith('--case='))?.split('=')[1];
const tagFilter = args.find(a => a.startsWith('--tag='))?.split('=')[1];
const verbose = process.env.VERBOSE === 'true' || args.includes('--verbose');

/**
 * Load replay cases from JSON file
 */
function loadCases(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Replay file not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let cases;

  try {
    cases = JSON.parse(content);
  } catch (e) {
    console.error(`❌ Invalid JSON in ${filePath}: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(cases)) {
    console.error(`❌ Replay file must be a JSON array of test cases`);
    process.exit(1);
  }

  return cases;
}

/**
 * Validate a response against declarative checks
 */
function validateChecks(reply, response, checks) {
  const failures = [];

  // mustNotContain — regex patterns that must NOT appear
  if (checks.mustNotContain) {
    for (const pattern of checks.mustNotContain) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(reply)) {
        const match = reply.match(regex)?.[0]?.substring(0, 50);
        failures.push({
          check: 'mustNotContain',
          pattern,
          reason: `Forbidden pattern found: "${match}"`
        });
      }
    }
  }

  // mustContain — regex patterns that MUST appear
  if (checks.mustContain) {
    for (const pattern of checks.mustContain) {
      const regex = new RegExp(pattern, 'i');
      if (!regex.test(reply)) {
        failures.push({
          check: 'mustContain',
          pattern,
          reason: `Required pattern not found: ${pattern}`
        });
      }
    }
  }

  // mustNotContainPII
  if (checks.mustNotContainPII !== false) { // Default true
    const piiResult = assertNoPIILeak(reply);
    if (!piiResult.passed) {
      failures.push({
        check: 'mustNotContainPII',
        reason: piiResult.reason
      });
    }
  }

  // mustNotHaveUngroundedClaims
  if (checks.mustNotHaveUngroundedClaims) {
    const toolsCalled = response.toolCalls || response.rawResponse?.toolsCalled || [];
    const groundingResult = assertNoUngroundedClaims(reply, toolsCalled);
    if (!groundingResult.passed) {
      failures.push({
        check: 'mustNotHaveUngroundedClaims',
        reason: groundingResult.reason
      });
    }
  }

  // outcomeIn
  if (checks.outcomeIn && checks.outcomeIn.length > 0) {
    const outcome = response.outcome || response.rawResponse?.outcome;
    if (outcome && !checks.outcomeIn.includes(outcome)) {
      failures.push({
        check: 'outcomeIn',
        reason: `Outcome "${outcome}" not in allowed: [${checks.outcomeIn.join(', ')}]`
      });
    }
  }

  // maxLengthChars
  if (checks.maxLengthChars && reply.length > checks.maxLengthChars) {
    failures.push({
      check: 'maxLengthChars',
      reason: `Response too long: ${reply.length} chars > max ${checks.maxLengthChars}`
    });
  }

  // noSpecFabrication
  if (checks.noSpecFabrication) {
    const specPatterns = [
      { name: 'BATTERY_MAH', regex: /\d{3,5}\s*mAh/i },
      { name: 'CAMERA_MP', regex: /\d{1,3}\s*MP/i },
      { name: 'PROCESSOR_GHZ', regex: /\d+[.,]\d+\s*GHz/i },
    ];

    for (const spec of specPatterns) {
      if (spec.regex.test(reply)) {
        failures.push({
          check: 'noSpecFabrication',
          reason: `Fabricated ${spec.name} spec detected`
        });
      }
    }
  }

  // custom JS expression
  if (checks.custom) {
    try {
      const customFn = new Function('reply', 'response', `return ${checks.custom}`);
      const result = customFn(reply, response);
      if (!result) {
        failures.push({
          check: 'custom',
          reason: `Custom check failed: ${checks.custom}`
        });
      }
    } catch (e) {
      failures.push({
        check: 'custom',
        reason: `Custom check error: ${e.message}`
      });
    }
  }

  return failures;
}

/**
 * Run a single replay case
 */
async function runCase(testCase, token, assistantId) {
  console.log(`\n▶️  ${testCase.id}: ${testCase.name}`);
  if (verbose) {
    console.log(`   Source: ${testCase.source.type} | Severity: ${testCase.severity}`);
    console.log(`   Tags: ${(testCase.tags || []).join(', ')}`);
    console.log(`   Turns: ${testCase.turns.length}`);
  }

  const result = {
    id: testCase.id,
    name: testCase.name,
    severity: testCase.severity,
    status: 'passed',
    turns: [],
    failures: [],
    duration: 0
  };

  const startTime = Date.now();
  let conversationId = null;
  const sessionId = `replay-${testCase.id}-${startTime}`;

  for (let i = 0; i < testCase.turns.length; i++) {
    const turn = testCase.turns[i];
    const turnNum = i + 1;

    console.log(`  Turn ${turnNum}/${testCase.turns.length}: ${turn.description || turn.userMessage.substring(0, 60)}`);

    const turnResult = {
      turn: turnNum,
      status: 'passed',
      failures: []
    };

    try {
      const response = await sendConversationTurn(
        assistantId,
        turn.userMessage,
        token,
        conversationId,
        { sessionId }
      );

      if (!response.success) {
        const isInfraError = response.errorType === 'INFRA_ERROR';
        if (isInfraError) {
          console.log(`    ⚠️  INFRA_ERROR: ${response.error} (skipping turn)`);
          turnResult.status = 'skipped';
          result.turns.push(turnResult);
          continue;
        }

        turnResult.status = 'failed';
        turnResult.failures.push({
          check: 'api_call',
          reason: `API failed: ${response.error}`
        });
        result.failures.push(...turnResult.failures.map(f => ({ ...f, turn: turnNum })));
        result.status = 'failed';
        result.turns.push(turnResult);
        break; // Stop on API failure
      }

      // Track conversation
      if (response.conversationId) {
        conversationId = response.conversationId;
      }

      const reply = response.reply || '';

      if (verbose) {
        console.log(`    Reply: ${reply.substring(0, 120)}`);
        console.log(`    Outcome: ${response.outcome}`);
      }

      // Run checks
      const checkFailures = validateChecks(reply, response, turn.checks || {});

      if (checkFailures.length > 0) {
        turnResult.status = 'failed';
        turnResult.failures = checkFailures;
        result.failures.push(...checkFailures.map(f => ({ ...f, turn: turnNum })));
        result.status = 'failed';

        for (const f of checkFailures) {
          console.log(`    ❌ ${f.check}: ${f.reason}`);
        }
      } else {
        console.log(`    ✅ All checks passed`);
      }

    } catch (error) {
      turnResult.status = 'failed';
      turnResult.failures.push({
        check: 'execution',
        reason: `Exception: ${error.message}`
      });
      result.failures.push({ check: 'execution', reason: error.message, turn: turnNum });
      result.status = 'failed';
      console.log(`    ❌ Exception: ${error.message}`);
    }

    result.turns.push(turnResult);
  }

  result.duration = Date.now() - startTime;

  const icon = result.status === 'passed' ? '✅' : '❌';
  console.log(`${icon} ${testCase.id} completed in ${result.duration}ms`);

  return result;
}

/**
 * Main
 */
async function main() {
  console.log('🔄 Telyx Replay Runner\n');

  // Load dependencies
  await loadDependencies();
  await loadAssertions();

  console.log(`   API: ${CONFIG.API_URL}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  if (caseFilter) console.log(`   Case filter: ${caseFilter}`);
  if (tagFilter) console.log(`   Tag filter: ${tagFilter}`);
  console.log('');

  // Validate
  try {
    validateConfig();
  } catch (error) {
    console.error('❌ Configuration error:', error.message);
    process.exit(1);
  }

  // Login
  console.log(`🔐 Logging in as ${CONFIG.ACCOUNT_A.email}...`);
  let token;
  try {
    token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);
    console.log('✅ Login successful\n');
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    process.exit(1);
  }

  let exitCode = 0;

  try {
    // Fetch assistant
    const { default: axios } = await import('axios');
    console.log('🤖 Fetching assistant...');
    let assistantId;
    try {
      const response = await axios.get(`${CONFIG.API_URL}/api/assistants`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.assistants?.length > 0) {
        assistantId = response.data.assistants[0].id;
        console.log(`✅ Using assistant: ${response.data.assistants[0].name} (${assistantId})\n`);
      } else {
        console.error('❌ No assistants found');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to fetch assistant:', error.message);
      process.exit(1);
    }

    // Load cases
    const casesFile = fileArg
      ? path.resolve(fileArg)
      : path.join(__dirname, 'sample-prod-regression.json');

    let cases = loadCases(casesFile);
    console.log(`📂 Loaded ${cases.length} replay case(s) from ${path.basename(casesFile)}`);

    // Apply filters
    if (caseFilter) {
      cases = cases.filter(c => c.id === caseFilter);
    }
    if (tagFilter) {
      cases = cases.filter(c => (c.tags || []).includes(tagFilter));
    }

    if (cases.length === 0) {
      console.log('⚠️  No cases match the filter');
      process.exit(0);
    }

    console.log(`🚀 Running ${cases.length} replay case(s)...\n`);
    console.log('='.repeat(80));

    // Run cases
    const allResults = [];
    for (const testCase of cases) {
      const result = await runCase(testCase, token, assistantId);
      allResults.push(result);
    }

    // Summary
    const passed = allResults.filter(r => r.status === 'passed').length;
    const failed = allResults.filter(r => r.status === 'failed').length;
    const criticalFailed = allResults.filter(r => r.status === 'failed' && r.severity === 'critical').length;

    console.log('\n' + '═'.repeat(60));
    console.log('  REPLAY RUNNER SUMMARY');
    console.log('═'.repeat(60));

    for (const result of allResults) {
      const icon = result.status === 'passed' ? '✅' : '❌';
      const sev = result.severity === 'critical' ? '🔴' : result.severity === 'high' ? '🟠' : '🟡';
      console.log(`  ${icon} ${sev} ${result.id}: ${result.name} (${result.duration}ms)`);
      if (result.failures.length > 0) {
        for (const f of result.failures.slice(0, 3)) { // Max 3 failures shown
          console.log(`     ❌ Turn ${f.turn || '?'} → ${f.check}: ${f.reason}`);
        }
        if (result.failures.length > 3) {
          console.log(`     ... and ${result.failures.length - 3} more`);
        }
      }
    }

    console.log('═'.repeat(60));
    console.log(`  Result: ${passed}/${allResults.length} passed`);
    if (criticalFailed > 0) {
      console.log(`  🔴 ${criticalFailed} CRITICAL failure(s) — deployment blocked`);
    }
    console.log('═'.repeat(60));

    // Save report
    const reportDir = path.join(__dirname, '..', 'runner', 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    const reportPath = path.join(reportDir, `replay-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      source: path.basename(casesFile),
      total: allResults.length,
      passed,
      failed,
      criticalFailed,
      results: allResults
    }, null, 2));
    console.log(`\n📊 Report saved: ${reportPath}`);

    // Exit code: critical failures block
    if (criticalFailed > 0) {
      exitCode = 1;
    }

  } finally {
    await cleanupTestAssistants(token);
  }

  process.exit(exitCode);
}

// Run
main().catch(async (error) => {
  console.error('❌ Fatal error:', error);
  try { await cleanupTestAssistants(null); } catch {}
  process.exit(1);
});
