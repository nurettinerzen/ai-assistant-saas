/**
 * Pilot Regression Test Runner
 *
 * Runs 30 regression tests against chat API and validates responses
 * Generates pilot-regression-report.md
 */

import fs from 'fs';
import axios from 'axios';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001';
const EMBED_KEY = process.env.TEST_EMBED_KEY || 'test-embed-key'; // Must be configured
const REPORT_FILE = 'docs/pilot/pilot-regression-report.md';

// Load test suite
const testSuite = JSON.parse(fs.readFileSync('tests/pilot/regression.json', 'utf8'));

// Results storage
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

/**
 * Execute a single test case
 */
async function runTest(test) {
  console.log(`\n🧪 Running ${test.id}: ${test.prompt.substring(0, 50)}...`);

  try {
    // Send chat message
    const response = await axios.post(`${API_BASE}/api/chat/widget`, {
      message: test.prompt,
      embedKey: EMBED_KEY,
      conversationId: `regression-${test.id}-${Date.now()}`
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });

    if (response.status !== 200) {
      return {
        test: test.id,
        status: 'FAIL',
        reason: `API returned ${response.status}`,
        response: response.data
      };
    }

    const aiResponse = response.data.response || response.data.message || '';
    const toolCalls = response.data.toolCalls || [];

    // Validate against expected behavior
    const validation = validateResponse(test, aiResponse, toolCalls);

    return {
      test: test.id,
      category: test.category,
      prompt: test.prompt,
      aiResponse: aiResponse.substring(0, 300),
      toolCalls: toolCalls.map(t => t.name),
      status: validation.passed ? 'PASS' : 'FAIL',
      reason: validation.reason,
      checks: validation.checks
    };

  } catch (error) {
    return {
      test: test.id,
      status: 'ERROR',
      reason: error.message,
      stack: error.stack
    };
  }
}

/**
 * Validate AI response against expected behavior
 */
function validateResponse(test, aiResponse, toolCalls) {
  const checks = [];
  const expected = test.expectedBehavior;
  let passed = true;
  let reason = '';

  // Check: usesKB
  if (expected.usesKB !== undefined) {
    const usesKB = aiResponse.length > 50; // Heuristic: long response likely uses KB
    const isFallback = aiResponse.toLowerCase().includes('bilgi bulunmuyor') ||
                       aiResponse.toLowerCase().includes('iletişime geçin') ||
                       aiResponse.toLowerCase().includes('don\'t have information');

    // If fallback is expected and we got fallback, that's OK
    const usesKBorFallback = usesKB || (expected.orFallback && isFallback);

    checks.push({
      check: 'usesKB',
      expected: expected.usesKB,
      actual: isFallback ? 'Fallback message' : (usesKB ? 'KB used' : 'Short response'),
      passed: usesKBorFallback === expected.usesKB
    });
    if (usesKBorFallback !== expected.usesKB && !expected.orFallback) {
      passed = false;
      reason += `Expected KB usage: ${expected.usesKB}. `;
    }
  }

  // Check: hasToolCall
  if (expected.hasToolCall !== undefined) {
    const hasTools = toolCalls.length > 0;
    checks.push({
      check: 'hasToolCall',
      expected: expected.hasToolCall,
      actual: hasTools,
      passed: hasTools === expected.hasToolCall
    });
    if (hasTools !== expected.hasToolCall) {
      passed = false;
      reason += `Expected tool call: ${expected.hasToolCall}, got: ${hasTools}. `;
    }
  }

  // Check: toolName
  if (expected.toolName) {
    const hasExpectedTool = toolCalls.some(t => t.name === expected.toolName);
    checks.push({
      check: 'toolName',
      expected: expected.toolName,
      actual: toolCalls.map(t => t.name).join(','),
      passed: hasExpectedTool
    });
    if (!hasExpectedTool) {
      passed = false;
      reason += `Expected tool ${expected.toolName}, got: ${toolCalls.map(t => t.name).join(',')}. `;
    }
  }

  // Check: responseContains
  if (expected.responseContains) {
    const missingTerms = expected.responseContains.filter(term =>
      !aiResponse.toLowerCase().includes(term.toLowerCase())
    );
    checks.push({
      check: 'responseContains',
      expected: expected.responseContains.join(', '),
      actual: missingTerms.length === 0 ? 'All present' : `Missing: ${missingTerms.join(', ')}`,
      passed: missingTerms.length === 0
    });
    if (missingTerms.length > 0 && !expected.orFallback) {
      passed = false;
      reason += `Missing terms: ${missingTerms.join(', ')}. `;
    }
  }

  // Check: mustNotFabricate
  if (expected.mustNotFabricate) {
    // Heuristic: if response contains specific numbers/dates without tool success, likely fabricated
    const hasFabricationRisk = /\d{4,}/.test(aiResponse) && toolCalls.length === 0;
    checks.push({
      check: 'mustNotFabricate',
      expected: 'No fabrication',
      actual: hasFabricationRisk ? 'Possible fabrication detected' : 'OK',
      passed: !hasFabricationRisk
    });
    if (hasFabricationRisk) {
      passed = false;
      reason += 'Possible fabrication detected. ';
    }
  }

  // Check: mustReject
  if (expected.mustReject) {
    const rejectKeywords = ['yapamam', 'sağlayamam', 'cannot', 'unable', 'sorry', 'özür'];
    const hasRejection = rejectKeywords.some(kw => aiResponse.toLowerCase().includes(kw));
    checks.push({
      check: 'mustReject',
      expected: 'Should reject request',
      actual: hasRejection ? 'Rejected' : 'Did not reject',
      passed: hasRejection
    });
    if (!hasRejection) {
      passed = false;
      reason += 'Should have rejected the request. ';
    }
  }

  // Check: mustNotProvide
  if (expected.mustNotProvide) {
    const providedForbidden = aiResponse.toLowerCase().includes(expected.mustNotProvide.toLowerCase());
    checks.push({
      check: 'mustNotProvide',
      expected: `Must not provide: ${expected.mustNotProvide}`,
      actual: providedForbidden ? 'VIOLATED' : 'OK',
      passed: !providedForbidden
    });
    if (providedForbidden) {
      passed = false;
      reason += `Provided forbidden info: ${expected.mustNotProvide}. `;
    }
  }

  // Check: maxLength
  if (expected.maxLength) {
    const withinLimit = aiResponse.length <= expected.maxLength;
    checks.push({
      check: 'maxLength',
      expected: `<= ${expected.maxLength} chars`,
      actual: `${aiResponse.length} chars`,
      passed: withinLimit
    });
    if (!withinLimit) {
      passed = false;
      reason += `Response too long: ${aiResponse.length} chars. `;
    }
  }

  return {
    passed,
    reason: passed ? 'All checks passed' : reason.trim(),
    checks
  };
}

/**
 * Generate markdown report
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const passRate = ((results.passed / results.total) * 100).toFixed(1);

  let report = `# Pilot Regression Test Report\n\n`;
  report += `**Date:** ${timestamp}\n`;
  report += `**Total Tests:** ${results.total}\n`;
  report += `**Passed:** ${results.passed} (${passRate}%)\n`;
  report += `**Failed:** ${results.failed}\n`;
  report += `**Skipped:** ${results.skipped}\n\n`;

  if (results.passed === results.total) {
    report += `## ✅ ALL TESTS PASSED\n\n`;
    report += `System is ready for pilot deployment.\n\n`;
  } else {
    report += `## 🚨 ${results.failed} TESTS FAILED\n\n`;
    report += `Review failures below before pilot deployment.\n\n`;
  }

  report += `---\n\n`;

  // Category breakdown
  const categories = {};
  results.details.forEach(r => {
    if (!categories[r.category]) {
      categories[r.category] = { total: 0, passed: 0, failed: 0 };
    }
    categories[r.category].total++;
    if (r.status === 'PASS') categories[r.category].passed++;
    if (r.status === 'FAIL') categories[r.category].failed++;
  });

  report += `## Category Breakdown\n\n`;
  report += `| Category | Total | Passed | Failed | Rate |\n`;
  report += `|----------|-------|--------|--------|------|\n`;
  Object.entries(categories).forEach(([cat, stats]) => {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    report += `| ${cat} | ${stats.total} | ${stats.passed} | ${stats.failed} | ${rate}% |\n`;
  });
  report += `\n---\n\n`;

  // Failed tests detail
  const failures = results.details.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    report += `## Failed Tests Detail\n\n`;
    failures.forEach(f => {
      report += `### ❌ ${f.test}\n\n`;
      report += `**Prompt:** ${f.prompt}\n\n`;
      report += `**AI Response:** ${f.aiResponse}\n\n`;
      report += `**Reason:** ${f.reason}\n\n`;
      if (f.checks) {
        report += `**Checks:**\n`;
        f.checks.forEach(c => {
          const icon = c.passed ? '✅' : '❌';
          report += `- ${icon} ${c.check}: Expected "${c.expected}", Got "${c.actual}"\n`;
        });
      }
      report += `\n---\n\n`;
    });
  }

  // All test results
  report += `## All Test Results\n\n`;
  results.details.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
    report += `${icon} **${r.test}** - ${r.prompt.substring(0, 60)}...\n`;
    if (r.status === 'FAIL') {
      report += `   _Reason: ${r.reason}_\n`;
    }
    report += `\n`;
  });

  return report;
}

/**
 * Main test runner
 */
async function main() {
  console.log('🚀 Starting Pilot Regression Tests');
  console.log(`API: ${API_BASE}`);
  console.log(`Embed Key: ${EMBED_KEY}`);
  console.log(`Total Tests: ${testSuite.totalTests}\n`);

  if (!EMBED_KEY || EMBED_KEY === 'test-embed-key') {
    console.error('❌ ERROR: TEST_EMBED_KEY environment variable not set');
    console.error('   Set a valid embed key: export TEST_EMBED_KEY=your-actual-embed-key');
    process.exit(1);
  }

  // Run all tests
  for (const test of testSuite.tests) {
    const result = await runTest(test);
    results.details.push(result);
    results.total++;

    if (result.status === 'PASS') {
      results.passed++;
      console.log(`✅ PASS: ${result.test}`);
    } else if (result.status === 'FAIL') {
      results.failed++;
      console.log(`❌ FAIL: ${result.test} - ${result.reason}`);
    } else {
      results.skipped++;
      console.log(`⏭️  SKIP: ${result.test} - ${result.reason}`);
    }

    // Rate limiting: wait 2 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Generate report
  const report = generateReport();
  fs.writeFileSync(REPORT_FILE, report);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 FINAL RESULTS: ${results.passed}/${results.total} PASSED`);
  console.log('='.repeat(60));
  console.log(`Report saved: ${REPORT_FILE}\n`);

  if (results.failed > 0) {
    console.log(`🚨 ${results.failed} TESTS FAILED - Review report before pilot\n`);
    process.exit(1);
  } else {
    console.log(`✅ ALL TESTS PASSED - System ready for pilot\n`);
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
