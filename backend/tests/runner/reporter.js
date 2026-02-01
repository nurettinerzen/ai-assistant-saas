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
        skipped: 0
      },
      gateBlocked: false,
      failures: []
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
      securityEvents: result.securityEvents || []
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
      failures: this.results.failures
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
    console.log('');

    if (report.failures.length > 0) {
      console.log('FAILURES');
      console.log('='.repeat(80));
      report.failures.forEach((failure, idx) => {
        console.log(`${idx + 1}. ${failure.name} (${failure.scenario})`);
        failure.failures.forEach(f => {
          console.log(`   - Step ${f.step}: ${f.assertion} - ${f.reason}`);
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
        });
      });
      content += '\n';
    }

    content += 'SCENARIO DETAILS\n';
    content += '='.repeat(80) + '\n';
    report.scenarios.forEach(scenario => {
      const statusIcon = scenario.status === 'passed' ? '✅' : scenario.status === 'failed' ? '❌' : '⏭️';
      content += `${statusIcon} ${scenario.id}: ${scenario.name} [${scenario.level}] (${scenario.duration}ms)\n`;
      if (scenario.failures.length > 0) {
        scenario.failures.forEach(f => {
          content += `   ❌ Step ${f.step}: ${f.assertion} - ${f.reason}\n`;
        });
      }
    });

    content += '\n' + '='.repeat(80) + '\n';

    // Write to file
    fs.writeFileSync(filepath, content, 'utf8');

    console.log(`\n📊 Report saved to: ${filepath}`);

    return filepath;
  }
}

export default Reporter;
