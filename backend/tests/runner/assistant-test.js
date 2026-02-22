#!/usr/bin/env node
/**
 * Telyx Assistant Test Runner
 * Multi-turn scenario-based testing engine
 *
 * Usage:
 *   node assistant-test.js                    # Run gate tests
 *   TEST_LEVEL=extended node assistant-test.js # Run extended tests
 *   TEST_LEVEL=full node assistant-test.js     # Run all tests
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import CONFIG, { validateConfig } from './config.js';
import { loginUser, sendConversationTurn, cleanupTestAssistants } from './http.js';
import Reporter from './reporter.js';
import { recordBrandViolations } from './brand-metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load scenarios from directory
 */
async function loadScenarios(level) {
  const scenariosDir = path.join(__dirname, '..', 'scenarios', level);

  if (!fs.existsSync(scenariosDir)) {
    return [];
  }

  const files = fs.readdirSync(scenariosDir).filter(f => f.endsWith('.js'));
  const scenarios = [];

  for (const file of files) {
    const modulePath = path.join(scenariosDir, file);
    const module = await import(`file://${modulePath}`);
    if (module.scenario) {
      scenarios.push(module.scenario);
    }
  }

  return scenarios;
}

/**
 * Run a single scenario
 */
async function runScenario(scenario, token, assistantId, businessId) {
  console.log(`\n▶️  Running ${scenario.id}: ${scenario.name}`);

  const result = {
    status: 'passed',
    duration: 0,
    steps: [],
    failures: [],
    securityEvents: []
  };

  const startTime = Date.now();
  let conversationId = null;

  // Generate sessionId ONCE per scenario (not per step)
  const scenarioSessionId = `test-${scenario.id}-${startTime}`;

  // Context object for cross-step assertions (e.g., consistency checks)
  const scenarioContext = {
    previousReplies: {},
    meta: {}
  };

  try {
    for (const step of scenario.steps) {
      console.log(`  ⏸  Step ${step.id}: ${step.description}`);

      const stepResult = {
        id: step.id,
        description: step.description,
        status: 'passed',
        assertions: []
      };

      // Send conversation turn with consistent sessionId
      const response = await sendConversationTurn(
        assistantId,
        step.userMessage,
        token,
        conversationId,
        { sessionId: scenarioSessionId }
      );

      // Debug log for session continuity verification
      if (process.env.VERBOSE === 'true') {
        console.log(`    [debug] scenario=${scenario.id} step=${step.id} sessionId=${scenarioSessionId} conversationId=${response.conversationId} verificationStatus=${response.verificationStatus}`);
      }

      if (!response.success) {
        // Steps with allowFailedResponse: true expect error responses
        // (e.g., error-path leak tests). Run assertions on the error response.
        if (step.allowFailedResponse) {
          console.log(`    ⚡ Step allows failed response (error-path test) — running assertions on error`);
          // Fall through to assertion loop below
        } else {
          // INFRA_ERROR in extended tests: skip (not fail)
          // Gate tests still fail on INFRA_ERROR (infrastructure must be stable)
          const isInfraError = response.errorType === 'INFRA_ERROR';
          const isExtended = scenario.level === 'extended' || scenario.level === 'adversarial';

          if (isInfraError && isExtended) {
            console.log(`    ⚠️  INFRA_ERROR: ${response.error} (skipping step, not failing)`);
            console.log(`       requestId=${response.requestId}, statusCode=${response.statusCode}, retryAfterMs=${response.retryAfterMs || 'N/A'}`);
            stepResult.status = 'skipped';
            stepResult.error = `INFRA_ERROR: ${response.error}`;
            result.infraErrors = result.infraErrors || [];
            result.infraErrors.push({
              step: step.id,
              error: response.error,
              statusCode: response.statusCode,
              requestId: response.requestId,
              retryAfterMs: response.retryAfterMs
            });
            continue;
          }

          // GATE tests: INFRA_ERROR is still a failure (infra must be stable for gate)
          if (isInfraError && scenario.level === 'gate') {
            console.log(`    ❌ INFRA_ERROR in GATE test: ${response.error} (counts as failure!)`);
            console.log(`       requestId=${response.requestId}, statusCode=${response.statusCode}`);
          }

          // Regular failure
          stepResult.status = 'failed';
          stepResult.error = response.error;
          result.failures.push({
            step: step.id,
            assertion: 'api_call',
            reason: `API call failed: ${response.error}`
          });
          result.status = 'failed';
          continue;
        }
      }

      // Update conversationId for multi-turn
      if (response.conversationId) {
        conversationId = response.conversationId;
      }

      // Store reply for cross-step consistency checks
      scenarioContext.previousReplies[step.id] = response.reply;

      // Capture guardrail telemetry for debugging
      stepResult.guardrailTelemetry = {
        guardrailAction: response.metadata?.guardrailAction || 'PASS',
        guardrailReason: response.metadata?.guardrailReason || null,
        messageType: response.metadata?.messageType || 'assistant_claim',
        leakFilterDebug: response.metadata?.leakFilterDebug || null
      };

      // Run assertions
      for (const assertionConfig of step.assertions) {
        try {
          const assertionResult = await assertionConfig.assert(response, scenarioContext);
          const isCritical = assertionConfig.critical !== false; // Default to critical

          stepResult.assertions.push({
            name: assertionConfig.name,
            passed: assertionResult.passed,
            reason: assertionResult.reason,
            critical: isCritical,
            brandViolation: assertionResult.brandViolation || false
          });

          if (!assertionResult.passed) {
            if (isCritical) {
              // Critical failure - blocks deployment
              stepResult.status = 'failed';
              result.failures.push({
                step: step.id,
                assertion: assertionConfig.name,
                reason: assertionResult.reason || 'Assertion failed',
                critical: true
              });
              result.status = 'failed';
              console.log(`    ❌ ${assertionConfig.name}: ${assertionResult.reason}`);
            } else {
              // Non-critical warning - log but don't fail
              // Only mark as brandViolation if explicitly set in assertion config
              const isBrandViolation = assertionConfig.brandViolation === true;
              result.warnings = result.warnings || [];
              result.warnings.push({
                step: step.id,
                assertion: assertionConfig.name,
                reason: assertionResult.reason || 'Warning',
                brandViolation: isBrandViolation
              });
              console.log(`    ⚠️  ${assertionConfig.name}: ${assertionResult.reason} (warning)`);
            }
          } else {
            console.log(`    ✅ ${assertionConfig.name}`);
          }
        } catch (error) {
          stepResult.status = 'failed';
          result.failures.push({
            step: step.id,
            assertion: assertionConfig.name,
            reason: `Exception: ${error.message}`,
            critical: true
          });
          result.status = 'failed';

          console.log(`    ❌ ${assertionConfig.name}: Exception - ${error.message}`);
        }
      }

      result.steps.push(stepResult);

      // Stop scenario on step failure (optional - configurable per scenario)
      if (stepResult.status === 'failed' && scenario.stopOnFailure !== false) {
        console.log(`  ⏹  Stopping scenario due to step failure`);
        break;
      }
    }
  } catch (error) {
    result.status = 'failed';
    result.failures.push({
      step: 'scenario',
      assertion: 'execution',
      reason: `Scenario exception: ${error.message}`
    });

    console.log(`  ❌ Scenario failed: ${error.message}`);
  }

  result.duration = Date.now() - startTime;

  const statusIcon = result.status === 'passed' ? '✅' : '❌';
  console.log(`${statusIcon} ${scenario.id} completed in ${result.duration}ms`);

  return result;
}

/**
 * Main test execution
 */
async function main() {
  console.log('🧪 Telyx Assistant Test Runner\n');

  // Validate configuration
  try {
    validateConfig();
  } catch (error) {
    console.error('❌ Configuration error:', error.message);
    process.exit(1);
  }

  const reporter = new Reporter(`Telyx Assistant Test - ${CONFIG.TEST_LEVEL.toUpperCase()}`);

  // Login as Account A
  console.log(`🔐 Logging in as ${CONFIG.ACCOUNT_A.email}...`);
  let token;
  try {
    token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);
    console.log('✅ Login successful\n');
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    process.exit(1);
  }

  // Wrap test execution in try/finally to guarantee cleanup even on crash
  let exitCode = 0;
  try {
    // Fetch first active assistant
    console.log('🤖 Fetching assistant...');
    let assistantId;
    try {
      const response = await axios.get(`${CONFIG.API_URL}/api/assistants`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.assistants && response.data.assistants.length > 0) {
        assistantId = response.data.assistants[0].id;
        console.log(`✅ Using assistant: ${response.data.assistants[0].name} (${assistantId})\n`);
      } else {
        console.error('❌ No assistants found for this account');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to fetch assistant:', error.message);
      process.exit(1);
    }

    // Load scenarios based on test level
    // 'customer-regression' is ALWAYS loaded (P0/P1 fixes must never regress)
    const levels = ['gate', 'customer-regression'];
    if (CONFIG.TEST_LEVEL === 'extended' || CONFIG.TEST_LEVEL === 'full') {
      levels.push('extended');
    }
    if (CONFIG.TEST_LEVEL === 'full') {
      levels.push('adversarial');
    }

    let allScenarios = [];
    for (const level of levels) {
      const scenarios = await loadScenarios(level);
      allScenarios = allScenarios.concat(scenarios);
      console.log(`📂 Loaded ${scenarios.length} ${level} scenarios`);
    }

    if (allScenarios.length === 0) {
      console.log('⚠️  No scenarios found');
      process.exit(0);
    }

    console.log(`\n🚀 Running ${allScenarios.length} scenarios...\n`);
    console.log('='.repeat(80));

    // Run scenarios
    for (const scenario of allScenarios) {
      const result = await runScenario(
        scenario,
        token,
        assistantId,
        CONFIG.ACCOUNT_A.businessId
      );

      reporter.recordScenario(scenario, result);

      // Gate failure blocks deployment
      if (result.status === 'failed' && scenario.level === 'gate') {
        console.log('\n🚨 GATE TEST FAILED - DEPLOYMENT BLOCKED');
      }
    }

    // Generate report
    console.log('\n' + '='.repeat(80));
    const report = reporter.printSummary();
    await reporter.saveReport();

    // Check brand drift metrics
    const allWarnings = reporter.getAllWarnings ? reporter.getAllWarnings() : [];
    const brandMetrics = recordBrandViolations(allWarnings);

    if (brandMetrics.message) {
      console.log('\n' + brandMetrics.message);
    }

    // Exit with appropriate code
    // Gate failures OR brand drift (>2 in 20 runs) = exit 1
    if (report.stats.failed > 0) {
      exitCode = 1;
    } else if (brandMetrics.shouldFail) {
      console.log('🚨 Brand drift threshold exceeded - marking as FAIL');
      exitCode = 1;
    }
  } finally {
    // CLEANUP GUARANTEE: Always runs even on crash/exception
    // Prevents test assistants from accumulating in the database
    await cleanupTestAssistants(token);
  }

  process.exit(exitCode);
}

// Run tests
main().catch(async (error) => {
  console.error('❌ Fatal error:', error);
  // Emergency cleanup attempt
  try {
    await cleanupTestAssistants(null);
  } catch (cleanupError) {
    console.error('⚠️  Emergency cleanup failed:', cleanupError.message);
  }
  process.exit(1);
});
