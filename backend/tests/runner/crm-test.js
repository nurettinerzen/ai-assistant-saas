#!/usr/bin/env node
/**
 * CRM Integration Test Runner
 *
 * Dedicated runner for CRM integration tests
 * Uses REAL production data from Business 1 (nurettinerzen@gmail.com)
 *
 * Usage:
 *   node tests/runner/crm-test.js                    # Run all CRM tests
 *   node tests/runner/crm-test.js --scenario=CRM1   # Run specific scenario
 *   node tests/runner/crm-test.js --verbose         # Show conversation details
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import CONFIG, { validateConfig } from './config.js';
import { loginUser, sendConversationTurn } from './http.js';
import Reporter from './reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI args
const args = process.argv.slice(2);
const scenarioFilter = args.find(a => a.startsWith('--scenario='))?.split('=')[1];
const verbose = args.includes('--verbose') || process.env.VERBOSE === 'true';

/**
 * Load CRM scenarios
 */
async function loadCrmScenarios() {
  const scenariosDir = path.join(__dirname, '..', 'scenarios', 'crm-integration');

  if (!fs.existsSync(scenariosDir)) {
    console.error('❌ CRM scenarios directory not found');
    return [];
  }

  const files = fs.readdirSync(scenariosDir).filter(f => f.endsWith('.js'));
  const scenarios = [];

  for (const file of files) {
    const modulePath = path.join(scenariosDir, file);
    const module = await import(`file://${modulePath}`);
    if (module.scenario) {
      // Apply filter if specified
      if (scenarioFilter && !module.scenario.id.startsWith(scenarioFilter)) {
        continue;
      }
      scenarios.push(module.scenario);
    }
  }

  return scenarios;
}

/**
 * Run a single scenario
 */
async function runScenario(scenario, token, assistantId) {
  console.log(`\n▶️  Running ${scenario.id}: ${scenario.name}`);

  const result = {
    status: 'passed',
    duration: 0,
    steps: [],
    failures: [],
    warnings: []
  };

  const startTime = Date.now();
  let conversationId = null;
  const scenarioSessionId = `crm-test-${scenario.id}-${startTime}`;
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

      // Send conversation turn
      const response = await sendConversationTurn(
        assistantId,
        step.userMessage,
        token,
        conversationId,
        { sessionId: scenarioSessionId }
      );

      if (verbose) {
        console.log(`    📤 User: ${step.userMessage}`);
        console.log(`    📥 Bot: ${response.reply?.substring(0, 100)}...`);
      }

      if (!response.success) {
        const isInfraError = response.errorType === 'INFRA_ERROR';

        if (isInfraError) {
          console.log(`    ⚠️  INFRA_ERROR: ${response.error} (skipping)`);
          stepResult.status = 'skipped';
          stepResult.error = response.error;
          result.steps.push(stepResult);
          continue;
        }

        stepResult.status = 'failed';
        stepResult.error = response.error;
        result.failures.push({
          step: step.id,
          assertion: 'api_call',
          reason: `API call failed: ${response.error}`
        });
        result.status = 'failed';
        result.steps.push(stepResult);
        continue;
      }

      // Update conversationId for multi-turn
      if (response.conversationId) {
        conversationId = response.conversationId;
      }

      scenarioContext.previousReplies[step.id] = response.reply;

      // Run assertions
      for (const assertionConfig of step.assertions) {
        try {
          const assertionResult = await assertionConfig.assert(response, scenarioContext);
          const isCritical = assertionConfig.critical !== false;

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
            } else {
              result.warnings.push({
                step: step.id,
                assertion: assertionConfig.name,
                reason: assertionResult.reason || 'Warning'
              });
              console.log(`    ⚠️  ${assertionConfig.name}: ${assertionResult.reason}`);
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

      // Stop on failure if configured
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
  console.log('🧪 CRM Integration Test Runner\n');
  console.log('='.repeat(80));

  // Validate config
  try {
    validateConfig();
  } catch (error) {
    console.error('❌ Configuration error:', error.message);
    process.exit(1);
  }

  // Note: Using real production data from Business 1, no seeding needed

  // Login
  console.log(`\n🔐 Logging in as ${CONFIG.ACCOUNT_A.email}...`);
  let token;
  try {
    token = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);
    console.log('✅ Login successful');
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    process.exit(1);
  }

  // Get assistant
  console.log('\n🤖 Fetching assistant...');
  let assistantId;
  try {
    const response = await axios.get(`${CONFIG.API_URL}/api/assistants`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.data.assistants?.length > 0) {
      assistantId = response.data.assistants[0].id;
      console.log(`✅ Using assistant: ${response.data.assistants[0].name}`);
    } else {
      throw new Error('No assistants found');
    }
  } catch (error) {
    console.error('❌ Failed to fetch assistant:', error.message);
    process.exit(1);
  }

  // Load scenarios
  console.log('\n📂 Loading CRM scenarios...');
  const scenarios = await loadCrmScenarios();

  if (scenarios.length === 0) {
    console.log('⚠️  No scenarios found');
    process.exit(0);
  }

  console.log(`   Found ${scenarios.length} scenario(s)`);
  scenarios.forEach(s => console.log(`   - ${s.id}: ${s.name}`));

  // Run scenarios
  console.log('\n' + '='.repeat(80));
  console.log(`\n🚀 Running ${scenarios.length} CRM test scenarios...\n`);

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    skipped: 0,
    scenarios: []
  };

  const startTime = Date.now();

  for (const scenario of scenarios) {
    const result = await runScenario(scenario, token, assistantId);
    results.scenarios.push({ scenario, result });

    if (result.status === 'passed') {
      results.passed++;
    } else {
      results.failed++;
    }

    results.warnings += (result.warnings?.length || 0);

    // Small delay between scenarios
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const totalDuration = Date.now() - startTime;

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 CRM Test Summary\n');
  console.log(`   Total Scenarios: ${scenarios.length}`);
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   ⚠️  Warnings: ${results.warnings}`);
  console.log(`   ⏱️  Duration: ${(totalDuration / 1000).toFixed(1)}s`);

  // List failures
  if (results.failed > 0) {
    console.log('\n❌ Failed Scenarios:');
    results.scenarios
      .filter(r => r.result.status === 'failed')
      .forEach(({ scenario, result }) => {
        console.log(`\n   ${scenario.id}: ${scenario.name}`);
        result.failures.forEach(f => {
          console.log(`     - [${f.step}] ${f.assertion}: ${f.reason}`);
        });
      });
  }

  // Save report
  const reportDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportFile = path.join(reportDir, `crm-test-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(reportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    duration: totalDuration,
    summary: {
      total: scenarios.length,
      passed: results.passed,
      failed: results.failed,
      warnings: results.warnings
    },
    scenarios: results.scenarios.map(({ scenario, result }) => ({
      id: scenario.id,
      name: scenario.name,
      status: result.status,
      duration: result.duration,
      failures: result.failures,
      warnings: result.warnings
    }))
  }, null, 2));

  console.log(`\n📄 Report saved to: ${reportFile}`);
  console.log('\n' + '='.repeat(80));

  // Exit code
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
