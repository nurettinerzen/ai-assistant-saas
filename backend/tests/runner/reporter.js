/**
 * Test Reporter
 * Formats and saves test results
 */

import fs from 'fs';
import path from 'path';
import CONFIG from './config.js';

export class Reporter {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.startTime = new Date();
    this.results = {
      scenarios: [],
      stats: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        infraErrors: 0
      },
      gateBlocked: false,
      failures: [],
      infraErrors: []
    };
  }

  /**
   * Record scenario result
   */
  recordScenario(scenario, result) {
    this.results.scenarios.push({
      id: scenario.id,
      name: scenario.name,
      level: scenario.level,
      status: result.status,
      duration: result.duration,
      steps: result.steps,
      failures: result.failures || [],
      warnings: result.warnings || [],
      infraErrors: result.infraErrors || [],
      securityEvents: result.securityEvents || [],
      skipReason: result.skipReason || null
    });

    this.results.stats.total++;
    if (result.status === 'passed') {
      this.results.stats.passed++;
    } else if (result.status === 'failed') {
      this.results.stats.failed++;
      this.results.failures.push({
        scenario: scenario.id,
        name: scenario.name,
        failures: result.failures
      });

      // Gate failure blocks deployment
      if (scenario.level === 'gate') {
        this.results.gateBlocked = true;
      }
    } else if (result.status === 'skipped') {
      this.results.stats.skipped++;
    }

    // Track INFRA_ERRORs separately
    if (result.infraErrors && result.infraErrors.length > 0) {
      this.results.stats.infraErrors += result.infraErrors.length;
      this.results.infraErrors.push({
        scenario: scenario.id,
        name: scenario.name,
        errors: result.infraErrors
      });
    }
  }

  /**
   * Generate final report
   */
  generateReport() {
    const endTime = new Date();
    const duration = ((endTime - this.startTime) / 1000).toFixed(2);

    const report = {
      suiteName: this.suiteName,
      testLevel: CONFIG.TEST_LEVEL,
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: `${duration}s`,
      apiUrl: CONFIG.API_URL,
      deploymentStatus: this.results.gateBlocked ? '🚨 BLOCKED' : '✅ READY',
      blockReason: this.results.gateBlocked ? `Gate test failures: ${this.results.failures.filter(f => this.results.scenarios.find(s => s.id === f.scenario && s.level === 'gate')).map(f => f.name).join(', ')}` : null,
      stats: this.results.stats,
      scenarios: this.results.scenarios,
      failures: this.results.failures,
      infraErrors: this.results.infraErrors
    };

    return report;
  }

  /**
   * Print summary to console
   */
  printSummary() {
    const report = this.generateReport();

    console.log('\n' + '='.repeat(80));
    console.log(`TELYX ASSISTANT TEST REPORT - ${report.suiteName}`);
    console.log('='.repeat(80));
    console.log(`Start Time: ${report.startTime}`);
    console.log(`End Time:   ${report.endTime}`);
    console.log(`Duration:   ${report.duration}`);
    console.log(`API URL:    ${report.apiUrl}`);
    console.log(`Test Level: ${report.testLevel.toUpperCase()}`);
    console.log('');

    console.log('DEPLOYMENT STATUS');
    console.log('='.repeat(80));
    console.log(report.deploymentStatus);
    if (report.blockReason) {
      console.log(`Reason: ${report.blockReason}`);
    }
    console.log('');

    console.log('TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`Total:   ${report.stats.total}`);
    console.log(`✅ Pass:   ${report.stats.passed}`);
    console.log(`❌ Fail:   ${report.stats.failed}`);
    console.log(`⏭️  Skip:   ${report.stats.skipped}`);
    if (report.stats.infraErrors > 0) {
      console.log(`🔧 Infra:  ${report.stats.infraErrors} (not counted as failures)`);
    }
    console.log('');

    if (report.failures.length > 0) {
      console.log('FAILURES');
      console.log('='.repeat(80));
      report.failures.forEach((failure, idx) => {
        console.log(`${idx + 1}. ${failure.name} (${failure.scenario})`);
        failure.failures.forEach(f => {
          console.log(`   - Step ${f.step}: ${f.assertion} - ${f.reason}`);
          const diag = [];
          if (f.validationExpectation) diag.push(`validation=${f.validationExpectation}`);
          if (f.outcome) diag.push(`outcome=${f.outcome}`);
          if (f.messageType) diag.push(`messageType=${f.messageType}`);
          if (diag.length > 0) {
            console.log(`     ↳ ${diag.join(' ')}`);
          }
        });
      });
      console.log('');
    }

    const skippedWithReason = report.scenarios.filter(s => s.status === 'skipped' && s.skipReason);
    if (skippedWithReason.length > 0) {
      console.log('SKIPPED SCENARIOS');
      console.log('='.repeat(80));
      skippedWithReason.forEach((scenario, idx) => {
        console.log(`${idx + 1}. ${scenario.name} (${scenario.id}) - ${scenario.skipReason}`);
      });
      console.log('');
    }

    if (report.infraErrors && report.infraErrors.length > 0) {
      console.log('INFRASTRUCTURE ERRORS (not failures)');
      console.log('='.repeat(80));
      console.log('⚠️  These are infrastructure issues, not test failures.');
      console.log('    If >5% of steps hit INFRA_ERROR, investigate infra health.\n');
      report.infraErrors.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.name} (${item.scenario})`);
        item.errors.forEach(e => {
          console.log(`   🔧 Step ${e.step}: ${e.statusCode || 'timeout'} - ${e.error}`);
          console.log(`      requestId: ${e.requestId || 'N/A'}, retryAfterMs: ${e.retryAfterMs || 'N/A'}`);
        });
      });
      console.log('');
    }

    console.log('SCENARIOS BY LEVEL');
    console.log('='.repeat(80));
    const byLevel = {};
    report.scenarios.forEach(s => {
      if (!byLevel[s.level]) byLevel[s.level] = { passed: 0, failed: 0, skipped: 0 };
      byLevel[s.level][s.status]++;
    });

    Object.entries(byLevel).forEach(([level, stats]) => {
      console.log(`${level.toUpperCase()}:`);
      console.log(`  ✅ ${stats.passed}  ❌ ${stats.failed}  ⏭️  ${stats.skipped}`);
    });

    console.log('\n' + '='.repeat(80));

    return report;
  }

  /**
   * Save report to file
   */
  async saveReport(filename = null) {
    const report = this.generateReport();

    // Ensure output directory exists
    const outputDir = path.resolve(CONFIG.REPORT.OUTPUT_DIR);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours().toString().padStart(2, '0');
    const defaultFilename = `assistant-test-${timestamp}-${hour}.txt`;
    const filepath = path.join(outputDir, filename || defaultFilename);

    // Format report as text
    let content = '';
    content += 'TELYX ASSISTANT TEST REPORT\n';
    content += '='.repeat(80) + '\n';
    content += `Start Time: ${report.startTime}\n`;
    content += `End Time:   ${report.endTime}\n`;
    content += `Duration:   ${report.duration}\n`;
    content += `API URL:    ${report.apiUrl}\n`;
    content += `Test Level: ${report.testLevel.toUpperCase()}\n\n`;

    content += 'DEPLOYMENT STATUS\n';
    content += '='.repeat(80) + '\n';
    content += report.deploymentStatus + '\n';
    if (report.blockReason) {
      content += `Reason: ${report.blockReason}\n`;
    }
    content += '\n';

    content += 'TEST RESULTS\n';
    content += '='.repeat(80) + '\n';
    content += `Total:   ${report.stats.total}\n`;
    content += `✅ Pass:   ${report.stats.passed}\n`;
    content += `❌ Fail:   ${report.stats.failed}\n`;
    content += `⏭️  Skip:   ${report.stats.skipped}\n\n`;

    if (report.failures.length > 0) {
      content += 'FAILURES\n';
      content += '='.repeat(80) + '\n';
      report.failures.forEach((failure, idx) => {
        content += `${idx + 1}. ${failure.name} (${failure.scenario})\n`;
        failure.failures.forEach(f => {
          content += `   - Step ${f.step}: ${f.assertion} - ${f.reason}\n`;
          const diag = [];
          if (f.validationExpectation) diag.push(`validation=${f.validationExpectation}`);
          if (f.outcome) diag.push(`outcome=${f.outcome}`);
          if (f.messageType) diag.push(`messageType=${f.messageType}`);
          if (diag.length > 0) {
            content += `     ↳ ${diag.join(' ')}\n`;
          }
        });
      });
      content += '\n';
    }

    const skippedWithReason = report.scenarios.filter(s => s.status === 'skipped' && s.skipReason);
    if (skippedWithReason.length > 0) {
      content += 'SKIPPED SCENARIOS\n';
      content += '='.repeat(80) + '\n';
      skippedWithReason.forEach((scenario, idx) => {
        content += `${idx + 1}. ${scenario.name} (${scenario.id}) - ${scenario.skipReason}\n`;
      });
      content += '\n';
    }

    content += 'SCENARIO DETAILS\n';
    content += '='.repeat(80) + '\n';
    report.scenarios.forEach(scenario => {
      const statusIcon = scenario.status === 'passed' ? '✅' : scenario.status === 'failed' ? '❌' : '⏭️';
      content += `${statusIcon} ${scenario.id}: ${scenario.name} [${scenario.level}] (${scenario.duration}ms)\n`;
      if (scenario.status === 'skipped' && scenario.skipReason) {
        content += `   ⏭️ reason: ${scenario.skipReason}\n`;
      }
      if (scenario.failures.length > 0) {
        scenario.failures.forEach(f => {
          content += `   ❌ Step ${f.step}: ${f.assertion} - ${f.reason}\n`;
        });
      }
      // Print guardrail telemetry for failed steps
      if (scenario.status === 'failed' && scenario.steps) {
        scenario.steps.forEach(step => {
          if (step.outcomeTelemetry) {
            const ot = step.outcomeTelemetry;
            content += `   🧪 outcome=${ot.outcome || 'unknown'} tool_outcome=${ot.toolOutcome || 'unknown'} messageType=${ot.messageType || 'unknown'}\n`;
          }
          if (step.guardrailTelemetry) {
            const gt = step.guardrailTelemetry;
            content += `   🛡️ guardrailAction=${gt.guardrailAction} guardrailReason=${gt.guardrailReason || 'none'} messageType=${gt.messageType || 'unknown'}\n`;
            if (gt.leakFilterDebug) {
              content += `   🔍 leakFilter: ruleId=${gt.leakFilterDebug.ruleId || 'none'} triggerType=${gt.leakFilterDebug.triggerType || 'none'}\n`;
            }
          }
        });
      }
    });

    content += '\n' + '='.repeat(80) + '\n';

    // Write to file
    fs.writeFileSync(filepath, content, 'utf8');

    console.log(`\n📊 Report saved to: ${filepath}`);

    return filepath;
  }

  /**
   * Get all warnings (brand violations) from all scenarios
   * Used for brand drift tracking
   */
  getAllWarnings() {
    const allWarnings = [];
    for (const scenario of this.results.scenarios) {
      if (scenario.warnings && scenario.warnings.length > 0) {
        for (const warning of scenario.warnings) {
          allWarnings.push({
            scenario: scenario.id,
            step: warning.step,
            assertion: warning.assertion,
            reason: warning.reason,
            brandViolation: warning.brandViolation || false
          });
        }
      }
    }
    return allWarnings;
  }
}

export default Reporter;
