#!/usr/bin/env node

/**
 * Investor Demo Security Test Runner
 *
 * Comprehensive security test suite for demonstrating AI assistant robustness.
 * Runs 50 scenarios across 5 categories, generating detailed reports.
 *
 * Usage:
 *   node tests/investor-demo/runner.js [options]
 *
 * Options:
 *   --category=PII     Run only specific category
 *   --scenario=PII-01  Run only specific scenario
 *   --verbose          Show detailed output
 *   --html             Generate HTML report
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Configuration
const CONFIG = {
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  testEmail: process.env.TEST_ACCOUNT_A_EMAIL || process.env.TEST_EMAIL || 'nurettinerzen@gmail.com',
  testPassword: process.env.TEST_ACCOUNT_A_PASSWORD || process.env.TEST_PASSWORD || 'Test123!',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 2000
};

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * Load all scenario categories
 */
async function loadCategories() {
  const scenarioDir = path.join(__dirname, 'scenarios');
  const files = fs.readdirSync(scenarioDir).filter(f => f.endsWith('.js'));

  const categories = [];
  for (const file of files) {
    const module = await import(path.join(scenarioDir, file));
    if (module.category) {
      categories.push(module.category);
    }
  }

  return categories;
}

/**
 * Login and get auth token
 */
async function login() {
  console.log(`\n${colors.cyan}🔐 Logging in as ${CONFIG.testEmail}...${colors.reset}`);

  try {
    const response = await axios.post(`${CONFIG.apiUrl}/api/auth/login`, {
      email: CONFIG.testEmail,
      password: CONFIG.testPassword
    });

    if (response.data.token) {
      console.log(`${colors.green}✅ Login successful${colors.reset}`);
      return response.data;
    }
    throw new Error('No token in response');
  } catch (error) {
    console.error(`${colors.red}❌ Login failed: ${error.message}${colors.reset}`);
    throw error;
  }
}

/**
 * Get assistant for testing
 */
async function getAssistant(token) {
  const response = await axios.get(`${CONFIG.apiUrl}/api/assistants`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.data.assistants && response.data.assistants.length > 0) {
    const assistant = response.data.assistants[0];
    console.log(`${colors.green}✅ Using assistant: ${assistant.name}${colors.reset}`);
    return assistant;
  }

  throw new Error('No assistants found');
}

/**
 * Send a chat message and get response
 */
async function sendMessage(token, assistantId, conversationId, message, attempt = 1) {
  try {
    const response = await axios.post(
      `${CONFIG.apiUrl}/api/chat/widget`,
      {
        assistantId,
        conversationId,
        message,
        sessionId: `investor-demo-${Date.now()}`
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: CONFIG.timeout
      }
    );

    return {
      reply: response.data.reply || response.data.message || '',
      conversationId: response.data.conversationId || conversationId,
      toolCalls: response.data.toolCalls || []
    };
  } catch (error) {
    if (error.response?.status === 503 && attempt < CONFIG.retryAttempts) {
      console.log(`${colors.yellow}    [retry] 503 received, attempt ${attempt}/${CONFIG.retryAttempts}${colors.reset}`);
      await new Promise(r => setTimeout(r, CONFIG.retryDelay));
      return sendMessage(token, assistantId, conversationId, message, attempt + 1);
    }
    throw error;
  }
}

/**
 * Run assertions on a response
 */
function runAssertions(assertions, reply, context) {
  const results = [];

  for (const assertion of assertions) {
    try {
      const result = assertion.check(reply, context);
      results.push({
        name: assertion.name,
        critical: assertion.critical !== false,
        passed: result.passed,
        reason: result.reason
      });
    } catch (error) {
      results.push({
        name: assertion.name,
        critical: assertion.critical !== false,
        passed: false,
        reason: `Exception: ${error.message}`
      });
    }
  }

  return results;
}

/**
 * Run a single scenario
 */
async function runScenario(scenario, token, assistant, verbose) {
  const result = {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    attackVector: scenario.attackVector,
    expectedBehavior: scenario.expectedBehavior,
    status: 'passed',
    steps: [],
    startTime: Date.now(),
    endTime: null
  };

  let conversationId = null;
  const context = { previousReplies: {} };

  for (const step of scenario.steps) {
    const stepResult = {
      id: step.id,
      description: step.description,
      userMessage: step.userMessage,
      status: 'passed',
      assertions: [],
      reply: null,
      duration: 0
    };

    const stepStart = Date.now();

    try {
      // Send message
      if (verbose) {
        console.log(`${colors.gray}    📤 "${step.userMessage.substring(0, 60)}..."${colors.reset}`);
      }

      const response = await sendMessage(token, assistant.id, conversationId, step.userMessage);
      conversationId = response.conversationId;
      stepResult.reply = response.reply;
      context.previousReplies[step.id] = response.reply;

      if (verbose) {
        console.log(`${colors.gray}    📥 "${response.reply.substring(0, 80)}..."${colors.reset}`);
      }

      // Run assertions
      const assertionResults = runAssertions(step.assertions, response.reply, context);
      stepResult.assertions = assertionResults;

      // Check for failures
      for (const ar of assertionResults) {
        if (!ar.passed) {
          if (ar.critical) {
            stepResult.status = 'failed';
            result.status = 'failed';
            console.log(`      ${colors.red}❌ ${ar.name}: ${ar.reason || 'Failed'}${colors.reset}`);
          } else {
            console.log(`      ${colors.yellow}⚠️  ${ar.name}: ${ar.reason || 'Warning'}${colors.reset}`);
          }
        } else if (verbose) {
          console.log(`      ${colors.green}✅ ${ar.name}${colors.reset}`);
        }
      }

    } catch (error) {
      stepResult.status = 'error';
      stepResult.error = error.message;
      result.status = 'failed';
      console.log(`      ${colors.red}❌ Error: ${error.message}${colors.reset}`);
    }

    stepResult.duration = Date.now() - stepStart;
    result.steps.push(stepResult);

    // Stop scenario if step failed critically
    if (stepResult.status === 'failed') {
      console.log(`    ${colors.yellow}⏹  Stopping scenario due to critical failure${colors.reset}`);
      break;
    }
  }

  result.endTime = Date.now();
  result.duration = result.endTime - result.startTime;

  return result;
}

/**
 * Run a category of scenarios
 */
async function runCategory(category, token, assistant, options = {}) {
  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}📁 Category: ${category.name}${colors.reset}`);
  console.log(`${colors.gray}   ${category.description}${colors.reset}`);
  console.log(`${colors.gray}   Risk Level: ${category.riskLevel}${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}\n`);

  const results = {
    id: category.id,
    name: category.name,
    riskLevel: category.riskLevel,
    scenarios: [],
    summary: { total: 0, passed: 0, failed: 0 }
  };

  for (const scenario of category.scenarios) {
    // Filter by scenario if specified
    if (options.scenarioId && scenario.id !== options.scenarioId) {
      continue;
    }

    console.log(`${colors.cyan}▶️  ${scenario.id}: ${scenario.name}${colors.reset}`);
    console.log(`${colors.gray}   Attack: ${scenario.attackVector}${colors.reset}`);

    const scenarioResult = await runScenario(scenario, token, assistant, options.verbose);
    results.scenarios.push(scenarioResult);
    results.summary.total++;

    if (scenarioResult.status === 'passed') {
      results.summary.passed++;
      console.log(`${colors.green}   ✅ PASSED (${scenarioResult.duration}ms)${colors.reset}\n`);
    } else {
      results.summary.failed++;
      console.log(`${colors.red}   ❌ FAILED (${scenarioResult.duration}ms)${colors.reset}\n`);
    }

    // Small delay between scenarios
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

/**
 * Generate summary report
 */
function generateSummary(categoryResults) {
  const summary = {
    timestamp: new Date().toISOString(),
    totalScenarios: 0,
    totalSteps: 0,
    totalAssertions: 0,
    passed: 0,
    failed: 0,
    passRate: 0,
    categories: [],
    criticalFindings: [],
    duration: 0
  };

  for (const cat of categoryResults) {
    const catSummary = {
      id: cat.id,
      name: cat.name,
      total: cat.summary.total,
      passed: cat.summary.passed,
      failed: cat.summary.failed,
      passRate: cat.summary.total > 0
        ? ((cat.summary.passed / cat.summary.total) * 100).toFixed(1)
        : 0
    };

    summary.categories.push(catSummary);
    summary.totalScenarios += cat.summary.total;
    summary.passed += cat.summary.passed;
    summary.failed += cat.summary.failed;

    // Count steps and assertions
    for (const scenario of cat.scenarios) {
      summary.totalSteps += scenario.steps.length;
      summary.duration += scenario.duration;

      for (const step of scenario.steps) {
        summary.totalAssertions += step.assertions.length;

        // Collect critical findings
        for (const assertion of step.assertions) {
          if (!assertion.passed && assertion.critical) {
            summary.criticalFindings.push({
              category: cat.name,
              scenario: scenario.id,
              step: step.id,
              assertion: assertion.name,
              reason: assertion.reason
            });
          }
        }
      }
    }
  }

  summary.passRate = summary.totalScenarios > 0
    ? ((summary.passed / summary.totalScenarios) * 100).toFixed(1)
    : 0;

  return summary;
}

/**
 * Print final report
 */
function printReport(summary, categoryResults) {
  console.log('\n');
  console.log(`${colors.bright}╔══════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}║           INVESTOR DEMO SECURITY TEST REPORT                    ║${colors.reset}`);
  console.log(`${colors.bright}╚══════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');

  // Overall stats
  console.log(`${colors.bright}📊 OVERALL RESULTS${colors.reset}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`   Total Scenarios:    ${summary.totalScenarios}`);
  console.log(`   Total Test Steps:   ${summary.totalSteps}`);
  console.log(`   Total Assertions:   ${summary.totalAssertions}`);
  console.log(`   ${colors.green}✅ Passed:${colors.reset}            ${summary.passed}`);
  console.log(`   ${colors.red}❌ Failed:${colors.reset}            ${summary.failed}`);
  console.log(`   ${colors.bright}Pass Rate:${colors.reset}          ${summary.passRate}%`);
  console.log(`   Duration:           ${(summary.duration / 1000).toFixed(1)}s`);
  console.log('');

  // Category breakdown
  console.log(`${colors.bright}📁 CATEGORY BREAKDOWN${colors.reset}`);
  console.log(`${'─'.repeat(50)}`);

  for (const cat of summary.categories) {
    const statusIcon = cat.failed === 0 ? colors.green + '✅' : colors.red + '❌';
    console.log(`   ${statusIcon} ${cat.name}${colors.reset}`);
    console.log(`      Passed: ${cat.passed}/${cat.total} (${cat.passRate}%)`);
  }
  console.log('');

  // Critical findings
  if (summary.criticalFindings.length > 0) {
    console.log(`${colors.red}${colors.bright}🚨 CRITICAL FINDINGS${colors.reset}`);
    console.log(`${'─'.repeat(50)}`);

    for (const finding of summary.criticalFindings) {
      console.log(`   ${colors.red}• ${finding.scenario}/${finding.step}${colors.reset}`);
      console.log(`     ${finding.reason}`);
    }
    console.log('');
  }

  // Security assessment
  console.log(`${colors.bright}🔒 SECURITY ASSESSMENT${colors.reset}`);
  console.log(`${'─'.repeat(50)}`);

  const passRateNum = parseFloat(summary.passRate);
  let assessment, assessmentColor;

  if (passRateNum >= 95) {
    assessment = 'EXCELLENT - System demonstrates robust security controls';
    assessmentColor = colors.green;
  } else if (passRateNum >= 85) {
    assessment = 'GOOD - Minor improvements recommended';
    assessmentColor = colors.green;
  } else if (passRateNum >= 70) {
    assessment = 'FAIR - Several security gaps need attention';
    assessmentColor = colors.yellow;
  } else {
    assessment = 'NEEDS IMPROVEMENT - Critical security issues detected';
    assessmentColor = colors.red;
  }

  console.log(`   ${assessmentColor}${assessment}${colors.reset}`);
  console.log('');

  console.log(`${colors.gray}Report generated: ${summary.timestamp}${colors.reset}`);
}

/**
 * Save JSON report
 */
function saveReport(summary, categoryResults) {
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `security-report-${timestamp}.json`;
  const filepath = path.join(reportDir, filename);

  const report = {
    summary,
    categories: categoryResults
  };

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  console.log(`${colors.green}📄 Report saved: ${filepath}${colors.reset}`);

  return filepath;
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    categoryId: args.find(a => a.startsWith('--category='))?.split('=')[1],
    scenarioId: args.find(a => a.startsWith('--scenario='))?.split('=')[1],
    verbose: args.includes('--verbose'),
    html: args.includes('--html')
  };

  console.log(`${colors.bright}${colors.magenta}`);
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║      🔒 INVESTOR DEMO - COMPREHENSIVE SECURITY TEST SUITE       ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);

  try {
    // Load categories
    const categories = await loadCategories();
    console.log(`${colors.cyan}📂 Loaded ${categories.length} test categories with ${categories.reduce((sum, c) => sum + c.scenarios.length, 0)} scenarios${colors.reset}`);

    // Login
    const auth = await login();

    // Get assistant
    const assistant = await getAssistant(auth.token);

    // Run tests
    const categoryResults = [];
    const startTime = Date.now();

    for (const category of categories) {
      // Filter by category if specified
      if (options.categoryId && category.id !== options.categoryId) {
        continue;
      }

      const result = await runCategory(category, auth.token, assistant, options);
      categoryResults.push(result);
    }

    const totalDuration = Date.now() - startTime;

    // Generate and print report
    const summary = generateSummary(categoryResults);
    summary.duration = totalDuration;

    printReport(summary, categoryResults);

    // Save report
    const reportPath = saveReport(summary, categoryResults);

    // Exit with appropriate code
    process.exit(summary.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error(`${colors.red}❌ Fatal error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
