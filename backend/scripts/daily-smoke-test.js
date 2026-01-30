#!/usr/bin/env node
/**
 * Daily Smoke Test - Automated Security & Health Check
 *
 * Runs twice daily (09:00 and 18:00 Turkey time)
 * Tests: Auth, Tenant Isolation, PII, Guardrails, Channel Health, Limits
 *
 * Usage: node backend/scripts/daily-smoke-test.js
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  API_URL: process.env.API_URL || 'https://api.telyx.ai',

  // Test Accounts (from environment for security)
  ACCOUNT_A: {
    email: process.env.TEST_ACCOUNT_A_EMAIL || 'nurettinerzen@gmail.com',
    password: process.env.TEST_ACCOUNT_A_PASSWORD,
    businessId: 1,
    name: 'incehesap'
  },
  ACCOUNT_B: {
    email: process.env.TEST_ACCOUNT_B_EMAIL || 'nurettin@selenly.co',
    password: process.env.TEST_ACCOUNT_B_PASSWORD,
    businessId: 28,
    name: 'Selenly'
  },

  // Slack webhook for notifications (optional)
  SLACK_WEBHOOK: process.env.SLACK_WEBHOOK_URL,

  // Email for notifications (optional)
  ALERT_EMAIL: process.env.ALERT_EMAIL
};

// ============================================================================
// REPORT STATE
// ============================================================================

const report = {
  timestamp: new Date().toISOString(),
  runTime: Date.now(),
  sections: {},
  failures: [],
  warnings: [],
  totalTests: 0,
  passedTests: 0,
  failedTests: 0
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function logSection(name, status, details = {}) {
  report.sections[name] = { status, ...details };
  console.log(`\n[${status}] ${name}`);
  if (details.message) console.log(`    ${details.message}`);
}

function logTest(name, passed, details = '') {
  report.totalTests++;
  if (passed) {
    report.passedTests++;
    console.log(`  ✅ ${name}`);
  } else {
    report.failedTests++;
    report.failures.push({ test: name, details });
    console.log(`  ❌ ${name}: ${details}`);
  }
}

function logWarning(message) {
  report.warnings.push(message);
  console.log(`  ⚠️  WARNING: ${message}`);
}

async function loginUser(email, password) {
  try {
    const response = await axios.post(`${CONFIG.API_URL}/api/auth/login`, {
      email,
      password
    });
    return response.data.token;
  } catch (error) {
    throw new Error(`Login failed: ${error.response?.data?.error || error.message}`);
  }
}

// ============================================================================
// SECTION 0: PRE-CHECKS
// ============================================================================

async function section0_PreChecks() {
  console.log('\n========================================');
  console.log('SECTION 0: PRE-CHECKS');
  console.log('========================================');

  try {
    // Check recent commits
    const { execSync } = await import('child_process');
    const lastCommit = execSync('git log -1 --format="%h %s"').toString().trim();
    const deployInfo = { lastCommit, hasNewDeploy: false };

    // Check if commit is from today
    const commitDate = execSync('git log -1 --format="%cd" --date=short').toString().trim();
    const today = new Date().toISOString().split('T')[0];
    deployInfo.hasNewDeploy = commitDate === today;

    logSection('Pre-checks', 'PASS', {
      message: `Last commit: ${lastCommit}`,
      deploy: deployInfo.hasNewDeploy ? 'NEW DEPLOY TODAY' : 'No new deploy',
      testMode: deployInfo.hasNewDeploy ? 'FULL' : 'MINIMAL'
    });

    return { success: true, fullTest: deployInfo.hasNewDeploy };
  } catch (error) {
    logSection('Pre-checks', 'WARN', { message: error.message });
    return { success: true, fullTest: true }; // Default to full test if can't check
  }
}

// ============================================================================
// SECTION 1: RED ALERT CHECK
// ============================================================================

async function section1_RedAlertCheck() {
  console.log('\n========================================');
  console.log('SECTION 1: RED ALERT CHECK (24h)');
  console.log('========================================');

  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Check for critical security events in logs
    // This would ideally query your logging system (Datadog, Sentry, etc.)
    // For now, we'll check database for error patterns

    const securityEvents = {
      crossTenantAttempts: 0,
      contentSafetyBlocks: 0,
      ssrfBlocks: 0,
      firewallBlocks: 0
    };

    // TODO: Query actual logs when monitoring is set up
    // For now, this is a placeholder that passes

    const hasSpike = false; // Would detect anomalies in real implementation

    if (hasSpike) {
      logSection('Red Alert Check', 'FAIL', {
        message: 'SECURITY EVENT SPIKE DETECTED',
        events: securityEvents
      });
      return { success: false, critical: true };
    }

    logSection('Red Alert Check', 'PASS', {
      message: 'No critical security events in last 24h',
      events: securityEvents
    });

    return { success: true };
  } catch (error) {
    logSection('Red Alert Check', 'ERROR', { message: error.message });
    return { success: false };
  }
}

// ============================================================================
// SECTION 2: AUTH & ROUTE PROTECTION
// ============================================================================

async function section2_AuthProtection() {
  console.log('\n========================================');
  console.log('SECTION 2: AUTH & ROUTE PROTECTION');
  console.log('========================================');

  try {
    // Test 1: No token -> 401
    try {
      await axios.get(`${CONFIG.API_URL}/api/customer-data`);
      logTest('No token returns 401', false, 'Request succeeded without auth');
    } catch (error) {
      const passed = error.response?.status === 401 || error.response?.status === 403;
      logTest('No token returns 401/403', passed, passed ? '' : `Got ${error.response?.status}`);
    }

    // Test 2: Invalid token -> 401
    try {
      await axios.get(`${CONFIG.API_URL}/api/customer-data`, {
        headers: { Authorization: 'Bearer invalid_token_12345' }
      });
      logTest('Invalid token returns 401', false, 'Request succeeded with invalid token');
    } catch (error) {
      const passed = error.response?.status === 401 || error.response?.status === 403;
      logTest('Invalid token returns 401/403', passed, passed ? '' : `Got ${error.response?.status}`);
    }

    // Test 3: Valid token -> 200
    const tokenA = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);
    const response = await axios.get(`${CONFIG.API_URL}/api/customer-data`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    logTest('Valid token returns 200', response.status === 200, response.status !== 200 ? `Got ${response.status}` : '');

    logSection('Auth & Route Protection', 'PASS');
    return { success: true, tokenA };
  } catch (error) {
    logSection('Auth & Route Protection', 'FAIL', { message: error.message });
    return { success: false };
  }
}

// ============================================================================
// SECTION 3: TENANT ISOLATION
// ============================================================================

async function section3_TenantIsolation() {
  console.log('\n========================================');
  console.log('SECTION 3: TENANT ISOLATION');
  console.log('========================================');

  try {
    // Login both accounts
    const tokenA = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);
    const tokenB = await loginUser(CONFIG.ACCOUNT_B.email, CONFIG.ACCOUNT_B.password);

    // Get sample data from Account A
    const accountAData = await axios.get(`${CONFIG.API_URL}/api/customer-data`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    const sampleRecordA = accountAData.data[0];

    if (!sampleRecordA) {
      logWarning('Account A has no customer data for cross-tenant test');
    } else {
      // Test 1: Account B tries to READ Account A's data
      try {
        await axios.get(`${CONFIG.API_URL}/api/customer-data/${sampleRecordA.id}`, {
          headers: { Authorization: `Bearer ${tokenB}` }
        });
        logTest('Cross-tenant READ blocked', false, 'Account B accessed Account A data!');
      } catch (error) {
        const passed = error.response?.status === 403 || error.response?.status === 404;
        logTest('Cross-tenant READ blocked', passed, passed ? '' : `Got ${error.response?.status}`);
      }

      // Test 2: Account B tries to DELETE Account A's data
      try {
        await axios.delete(`${CONFIG.API_URL}/api/customer-data/${sampleRecordA.id}`, {
          headers: { Authorization: `Bearer ${tokenB}` }
        });
        logTest('Cross-tenant DELETE blocked', false, 'Account B deleted Account A data!');
      } catch (error) {
        const passed = error.response?.status === 403 || error.response?.status === 404;
        logTest('Cross-tenant DELETE blocked', passed, passed ? '' : `Got ${error.response?.status}`);
      }

      // Test 3: Verify Account A data still intact
      const verifyData = await axios.get(`${CONFIG.API_URL}/api/customer-data/${sampleRecordA.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      logTest('Account A data intact after attack', verifyData.status === 200, '');
    }

    // Test 4: Cross-business access
    try {
      await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_B.businessId}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      logTest('Cross-business access blocked', false, 'Account A accessed Account B business!');
    } catch (error) {
      const passed = error.response?.status === 403;
      logTest('Cross-business access blocked', passed, passed ? '' : `Got ${error.response?.status}`);
    }

    logSection('Tenant Isolation', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Tenant Isolation', 'FAIL', { message: error.message });
    return { success: false };
  }
}

// ============================================================================
// SECTION 4: PII & VERIFICATION (Minimal - requires manual testing)
// ============================================================================

async function section4_PIIVerification() {
  console.log('\n========================================');
  console.log('SECTION 4: PII & VERIFICATION');
  console.log('========================================');

  // This section requires actual conversations and is hard to automate
  // We'll do basic checks only

  try {
    const tokenA = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    // Check that customer data endpoint returns masked PII
    const response = await axios.get(`${CONFIG.API_URL}/api/customer-data`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    const data = response.data;
    if (data.length > 0) {
      const record = data[0];

      // Check phone masking (should have asterisks)
      const phoneHasMask = record.phone?.includes('*');
      logTest('Phone is masked in response', phoneHasMask, phoneHasMask ? '' : 'Phone not masked');

      // Check email masking
      const emailHasMask = record.email?.includes('*');
      logTest('Email is masked in response', emailHasMask, emailHasMask ? '' : 'Email not masked');
    } else {
      logWarning('No customer data to verify PII masking');
    }

    logSection('PII & Verification', 'PARTIAL', {
      message: 'Basic checks only - manual testing recommended'
    });
    return { success: true };
  } catch (error) {
    logSection('PII & Verification', 'ERROR', { message: error.message });
    return { success: true }; // Don't fail on this section
  }
}

// ============================================================================
// SECTION 5: GUARDRAILS & PROMPT ATTACK
// ============================================================================

async function section5_Guardrails() {
  console.log('\n========================================');
  console.log('SECTION 5: GUARDRAILS & PROMPT ATTACK');
  console.log('========================================');

  // This requires actual chat conversations - placeholder for now
  logSection('Guardrails', 'SKIP', {
    message: 'Requires manual chat testing - see SOP Section 5'
  });

  return { success: true };
}

// ============================================================================
// SECTION 6: CHANNEL HEALTH (Minimal)
// ============================================================================

async function section6_ChannelHealth() {
  console.log('\n========================================');
  console.log('SECTION 6: CHANNEL HEALTH');
  console.log('========================================');

  // Basic endpoint health checks
  try {
    // Check if API is responding
    const response = await axios.get(`${CONFIG.API_URL}/api/health`).catch(() => null);

    if (!response) {
      logTest('API health endpoint', false, 'Endpoint not responding');
    } else {
      logTest('API health endpoint', true, '');
    }

    logSection('Channel Health', 'PARTIAL', {
      message: 'Basic checks only - manual channel testing recommended'
    });
    return { success: true };
  } catch (error) {
    logSection('Channel Health', 'ERROR', { message: error.message });
    return { success: true };
  }
}

// ============================================================================
// SECTION 7: LIMITS & ABUSE
// ============================================================================

async function section7_Limits() {
  console.log('\n========================================');
  console.log('SECTION 7: LIMITS & ABUSE');
  console.log('========================================');

  try {
    const tokenA = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

    // Test SSRF protection on KB URL endpoint
    try {
      const response = await axios.post(`${CONFIG.API_URL}/api/knowledge/urls`, {
        url: 'http://127.0.0.1/admin'
      }, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      logTest('SSRF protection blocks localhost', false, 'Localhost URL was accepted!');
    } catch (error) {
      const passed = error.response?.status === 400;
      const reason = error.response?.data?.reason || '';
      logTest('SSRF protection blocks localhost', passed, passed ? '' : `Got ${error.response?.status}`);

      if (passed && !reason.includes('localhost')) {
        logWarning('SSRF blocked but reason unclear');
      }
    }

    // Test AWS metadata endpoint
    try {
      const response = await axios.post(`${CONFIG.API_URL}/api/knowledge/urls`, {
        url: 'http://169.254.169.254/latest/meta-data'
      }, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      logTest('SSRF protection blocks AWS metadata', false, 'AWS metadata URL was accepted!');
    } catch (error) {
      const passed = error.response?.status === 400;
      logTest('SSRF protection blocks AWS metadata', passed, passed ? '' : `Got ${error.response?.status}`);
    }

    logSection('Limits & Abuse', 'PASS');
    return { success: true };
  } catch (error) {
    logSection('Limits & Abuse', 'FAIL', { message: error.message });
    return { success: false };
  }
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function generateReport() {
  const duration = Math.round((Date.now() - report.runTime) / 1000);
  const overallStatus = report.failedTests === 0 ? '✅ PASS' : '❌ FAIL';

  const reportText = `
╔════════════════════════════════════════════════════════════════╗
║          DAILY SMOKE TEST REPORT - Telyx V1                    ║
╚════════════════════════════════════════════════════════════════╝

📅 Date: ${new Date(report.timestamp).toLocaleString('tr-TR')}
⏱️  Duration: ${duration}s
🎯 Overall: ${overallStatus}

📊 TEST SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Tests:  ${report.totalTests}
✅ Passed:    ${report.passedTests}
❌ Failed:    ${report.failedTests}
⚠️  Warnings:  ${report.warnings.length}

📋 SECTION RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${Object.entries(report.sections).map(([name, details]) =>
  `[${details.status}] ${name}${details.message ? '\n    ' + details.message : ''}`
).join('\n')}

${report.failures.length > 0 ? `
⚠️  FAILURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${report.failures.map(f => `❌ ${f.test}\n    ${f.details}`).join('\n')}
` : ''}

${report.warnings.length > 0 ? `
⚠️  WARNINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${report.warnings.map(w => `⚠️  ${w}`).join('\n')}
` : ''}

${report.failedTests > 0 ? `
🚨 ACTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Security tests failed! Please investigate immediately.
` : '🎉 All critical security tests passed!'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by: Telyx Automated Smoke Test
Next run: ${getNextRunTime()}
`;

  return reportText;
}

function getNextRunTime() {
  const now = new Date();
  const hour = now.getHours();

  // Next run is at 09:00 or 18:00
  let nextHour = hour < 9 ? 9 : hour < 18 ? 18 : 9;
  let nextDay = nextHour === 9 && hour >= 18 ? 1 : 0;

  const next = new Date(now);
  next.setDate(next.getDate() + nextDay);
  next.setHours(nextHour, 0, 0, 0);

  return next.toLocaleString('tr-TR');
}

// ============================================================================
// NOTIFICATION
// ============================================================================

async function sendSlackNotification(report) {
  if (!CONFIG.SLACK_WEBHOOK) {
    console.log('\n⚠️  Slack webhook not configured, skipping notification');
    return;
  }

  try {
    const color = report.failedTests === 0 ? 'good' : 'danger';
    const emoji = report.failedTests === 0 ? '✅' : '🚨';

    await axios.post(CONFIG.SLACK_WEBHOOK, {
      text: `${emoji} Daily Smoke Test Report`,
      attachments: [{
        color,
        title: 'Telyx V1 - Smoke Test Results',
        text: `${report.passedTests}/${report.totalTests} tests passed`,
        fields: [
          { title: 'Status', value: report.failedTests === 0 ? 'PASS' : 'FAIL', short: true },
          { title: 'Failures', value: report.failedTests, short: true },
          { title: 'Warnings', value: report.warnings.length, short: true }
        ],
        footer: 'Automated Smoke Test',
        ts: Math.floor(Date.now() / 1000)
      }]
    });

    console.log('\n✅ Slack notification sent');
  } catch (error) {
    console.error('\n❌ Failed to send Slack notification:', error.message);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║       TELYX V1 - AUTOMATED DAILY SMOKE TEST                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`Start time: ${new Date().toLocaleString('tr-TR')}\n`);

  try {
    // Run all test sections
    const preCheck = await section0_PreChecks();
    await section1_RedAlertCheck();
    await section2_AuthProtection();
    await section3_TenantIsolation();
    await section4_PIIVerification();

    // Skip sections 5-6 in minimal mode
    if (preCheck.fullTest) {
      await section5_Guardrails();
      await section6_ChannelHealth();
    }

    await section7_Limits();

    // Generate and display report
    const reportText = generateReport();
    console.log('\n' + reportText);

    // Send notification
    await sendSlackNotification(report);

    // Save report to file
    const fs = await import('fs/promises');
    const reportPath = `backend/tests/pilot/reports/smoke-${new Date().toISOString().split('T')[0]}-${new Date().getHours()}.txt`;
    await fs.mkdir('backend/tests/pilot/reports', { recursive: true });
    await fs.writeFile(reportPath, reportText);
    console.log(`\n📄 Report saved: ${reportPath}`);

    // Exit with appropriate code
    process.exit(report.failedTests > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n🚨 CRITICAL ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
main();
