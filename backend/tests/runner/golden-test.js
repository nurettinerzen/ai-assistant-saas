#!/usr/bin/env node
/**
 * Golden Suite Test Runner
 *
 * Runs G1–G5 golden scenarios against the REAL orchestrator pipeline.
 * Golden tests are fundamental grounding + security checks that must
 * ALWAYS pass — failure = deploy block.
 *
 * Architecture:
 * - Uses /api/chat/widget endpoint (same as production chat)
 * - TEST_MOCK_TOOLS=1 scenarios inject fixture data via state._mockToolOutputs
 * - Non-mock scenarios run through the full pipeline (real LLM, no tool mocking)
 * - Reports to console + text file in tests/runner/reports/
 *
 * Usage:
 *   node tests/runner/golden-test.js                  # Run all golden tests
 *   node tests/runner/golden-test.js --scenario=G1    # Run single scenario
 *   VERBOSE=true node tests/runner/golden-test.js     # Verbose output
 *
 * Prerequisites:
 *   - Server running: npm start (or API_URL pointing to remote)
 *   - Business with KB content (embedKey configured)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CONFIG, { validateConfig } from './config.js';
import { loginUser, sendConversationTurn, cleanupTestAssistants } from './http.js';
import Reporter from './reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI args
const args = process.argv.slice(2);
const scenarioFilter = args.find(a => a.startsWith('--scenario='))?.split('=')[1];
const verbose = process.env.VERBOSE === 'true' || args.includes('--verbose');

/**
 * Load golden scenarios from directory
 */
async function loadGoldenScenarios() {
  const scenariosDir = path.join(__dirname, '..', 'scenarios', 'golden');

  if (!fs.existsSync(scenariosDir)) {
    console.error(`❌ Golden scenarios directory not found: ${scenariosDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(scenariosDir)
    .filter(f => f.endsWith('.js'))
    .sort(); // G1, G2, G3, G4, G5 order

  const scenarios = [];

  for (const file of files) {
    const modulePath = path.join(scenariosDir, file);
    const module = await import(`file://${modulePath}`);
    if (module.scenario) {
      // Override level to 'golden' (deploy blocker)
      module.scenario.level = 'golden';
      scenarios.push(module.scenario);
    }
  }

  return scenarios;
}

/**
 * Load mock fixture data
 */
async function loadFixtures() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'golden', 'tool-outputs.json');

  if (!fs.existsSync(fixturesPath)) {
    console.warn('⚠️  Golden fixtures not found — mock scenarios will fail');
    return {};
  }

  const content = fs.readFileSync(fixturesPath, 'utf8');
  return JSON.parse(content);
}

/**
 * Run a single golden scenario
 */
async function runGoldenScenario(scenario, token, assistantId, fixtures) {
  console.log(`\n▶️  Running ${scenario.id}: ${scenario.name}`);

  // Skip mock-dependent scenarios when TEST_MOCK_TOOLS is not enabled
  if (scenario.mockTools && process.env.TEST_MOCK_TOOLS !== '1') {
    console.log(`  ⏭️  Skipping (mockTools=true but TEST_MOCK_TOOLS not set)`);
    return { status: 'skipped', duration: 0, steps: [], failures: [], warnings: [] };
  }

  if (verbose) {
    console.log(`   Description: ${scenario.description}`);
    console.log(`   MockTools: ${scenario.mockTools}`);
    console.log(`   Steps: ${scenario.steps.length}`);
  }

  const result = {
    status: 'passed',
    duration: 0,
    steps: [],
    failures: [],
    warnings: []
  };

  const startTime = Date.now();
  let conversationId = null;
  const scenarioSessionId = `golden-${scenario.id}-${startTime}`;

  // Context object for cross-step assertions
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

      // Build send options
      const sendOptions = {
        sessionId: scenarioSessionId
      };

      // If step needs mock tool outputs, inject via conversation metadata
      // The runner sends the mock fixture name as part of the session context,
      // and the TEST_MOCK_TOOLS hook in toolLoop picks it up from state._mockToolOutputs
      if (scenario.mockTools && step.mockFixture) {
        const fixtureData = fixtures[step.mockFixture];
        if (!fixtureData) {
          console.log(`    ❌ Fixture not found: ${step.mockFixture}`);
          stepResult.status = 'failed';
          result.failures.push({
            step: step.id,
            assertion: 'fixture_load',
            reason: `Mock fixture not found: ${step.mockFixture}`,
            critical: true
          });
          result.status = 'failed';
          result.steps.push(stepResult);
          continue;
        }

        // Inject mock tool outputs via metadata
        // The widget endpoint passes this to the orchestrator via state
        sendOptions.mockToolOutputs = {
          [fixtureData.name]: fixtureData
        };
      }

      // Send conversation turn
      const response = await sendConversationTurn(
        assistantId,
        step.userMessage,
        token,
        conversationId,
        sendOptions
      );

      if (verbose) {
        console.log(`    Reply: ${(response.reply || '').substring(0, 150)}`);
        console.log(`    Outcome: ${response.outcome}`);
        console.log(`    Tools: ${JSON.stringify(response.toolCalls || [])}`);
        console.log(`    GuardrailAction: ${response.metadata?.guardrailAction || 'PASS'}`);
        console.log(`    GuardrailReason: ${response.metadata?.guardrailReason || 'none'}`);
        console.log(`    MessageType: ${response.metadata?.messageType || 'unknown'}`);
      }

      if (!response.success) {
        const isInfraError = response.errorType === 'INFRA_ERROR';

        if (isInfraError) {
          console.log(`    ⚠️  INFRA_ERROR: ${response.error}`);
          stepResult.status = 'skipped';
          stepResult.error = `INFRA_ERROR: ${response.error}`;
          result.steps.push(stepResult);
          continue;
        }

        // Golden tests: non-infra failure = test failure
        stepResult.status = 'failed';
        stepResult.error = response.error;
        result.failures.push({
          step: step.id,
          assertion: 'api_call',
          reason: `API call failed: ${response.error}`,
          critical: true
        });
        result.status = 'failed';
        result.steps.push(stepResult);
        continue;
      }

      // Update conversationId for multi-turn
      if (response.conversationId) {
        conversationId = response.conversationId;
      }

      // Store reply for cross-step context
      scenarioContext.previousReplies[step.id] = response.reply;

      // Capture guardrail telemetry for debugging
      stepResult.guardrailTelemetry = {
        guardrailAction: response.metadata?.guardrailAction || 'PASS',
        guardrailReason: response.metadata?.guardrailReason || null,
        messageType: response.metadata?.messageType || 'assistant_claim',
        leakFilterDebug: response.metadata?.leakFilterDebug || null
      };

      // Prepare response with additional fields for assertion access
      const enrichedResponse = {
        ...response,
        toolsCalled: response.toolCalls || response.rawResponse?.toolsCalled || [],
        toolOutputs: response.rawResponse?.toolOutputs || [],
        rawResponse: response.rawResponse || {}
      };

      // Run assertions
      for (const assertionConfig of (step.assertions || [])) {
        try {
          const assertionResult = await assertionConfig.assert(enrichedResponse, scenarioContext);
          const isCritical = assertionConfig.critical !== false; // Default to critical

          stepResult.assertions.push({
            name: assertionConfig.name,
            passed: assertionResult.passed,
            reason: assertionResult.reason,
            critical: isCritical
          });

          if (!assertionResult.passed) {
            if (isCritical) {
              stepResult.status = 'failed';
              result.failures.push({
                step: step.id,
                assertion: assertionConfig.name,
                reason: assertionResult.reason || 'Assertion failed',
                critical: true
              });
              result.status = 'failed';
              console.log(`    ❌ ${assertionConfig.name}: ${assertionResult.reason}`);
              console.log(`       🛡️ action=${response.metadata?.guardrailAction || 'PASS'} reason=${response.metadata?.guardrailReason || 'none'} type=${response.metadata?.messageType || 'unknown'}`);
            } else {
              result.warnings.push({
                step: step.id,
                assertion: assertionConfig.name,
                reason: assertionResult.reason || 'Warning'
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
          console.log(`    ❌ ${assertionConfig.name}: Exception — ${error.message}`);
        }
      }

      result.steps.push(stepResult);

      // Stop on failure (golden tests fail fast)
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
 * Main execution
 */
async function main() {
  console.log('🏆 Telyx Golden Suite Test Runner\n');
  console.log(`   API: ${CONFIG.API_URL}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  if (scenarioFilter) console.log(`   Filter: ${scenarioFilter}`);
  console.log('');

  // Validate configuration
  try {
    validateConfig();
  } catch (error) {
    console.error('❌ Configuration error:', error.message);
    process.exit(1);
  }

  const reporter = new Reporter('Golden Suite');

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
      if (response.data.assistants && response.data.assistants.length > 0) {
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

    // Load scenarios & fixtures
    const [allScenarios, fixtures] = await Promise.all([
      loadGoldenScenarios(),
      loadFixtures()
    ]);

    // Apply filter
    let scenarios = allScenarios;
    if (scenarioFilter) {
      scenarios = allScenarios.filter(s => s.id === scenarioFilter);
      if (scenarios.length === 0) {
        console.error(`❌ Scenario not found: ${scenarioFilter}`);
        console.log(`   Available: ${allScenarios.map(s => s.id).join(', ')}`);
        process.exit(1);
      }
    }

    console.log(`📂 Loaded ${scenarios.length} golden scenario(s): ${scenarios.map(s => s.id).join(', ')}`);
    console.log(`📦 Loaded ${Object.keys(fixtures).filter(k => k !== '_doc').length} fixture(s)`);
    console.log(`\n🚀 Running golden suite...\n`);
    console.log('='.repeat(80));

    // Run scenarios
    for (const scenario of scenarios) {
      const result = await runGoldenScenario(scenario, token, assistantId, fixtures);
      reporter.recordScenario(scenario, result);

      if (result.status === 'failed') {
        console.log('\n🚨 GOLDEN TEST FAILED — DEPLOYMENT BLOCKED');
      }
    }

    // Generate report
    console.log('\n' + '='.repeat(80));
    const report = reporter.printSummary();
    await reporter.saveReport(`golden-test-${new Date().toISOString().split('T')[0]}.txt`);

    // Golden failures always block
    if (report.stats.failed > 0) {
      exitCode = 1;
      console.log('\n🚨 GOLDEN SUITE FAILED — DEPLOYMENT BLOCKED');
      console.log('   Fix all golden test failures before deploying.');
    } else {
      console.log('\n✅ GOLDEN SUITE PASSED — Deployment allowed');
    }

    // Print summary table
    console.log('\n' + '═'.repeat(60));
    console.log('  GOLDEN SUITE SUMMARY');
    console.log('═'.repeat(60));
    for (const scenario of report.scenarios) {
      const icon = scenario.status === 'passed' ? '✅' : scenario.status === 'skipped' ? '⏭️' : '❌';
      console.log(`  ${icon} ${scenario.id}: ${scenario.name} (${scenario.duration}ms)`);
      if (scenario.failures.length > 0) {
        for (const f of scenario.failures) {
          console.log(`     ❌ ${f.step} → ${f.assertion}: ${f.reason}`);
        }
      }
    }
    console.log('═'.repeat(60));
    console.log(`  Result: ${report.stats.passed}/${report.stats.total} passed`);
    console.log('═'.repeat(60));

  } finally {
    await cleanupTestAssistants(token);
  }

  process.exit(exitCode);
}

// Run
main().catch(async (error) => {
  console.error('❌ Fatal error:', error);
  try {
    await cleanupTestAssistants(null);
  } catch (cleanupError) {
    console.error('⚠️  Emergency cleanup failed:', cleanupError.message);
  }
  process.exit(1);
});
