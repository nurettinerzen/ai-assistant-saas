#!/usr/bin/env node

/**
 * Investor Demo HTML Report Generator
 *
 * Generates a beautiful HTML report from the security test results.
 * Suitable for investor presentations and due diligence.
 *
 * Usage:
 *   node tests/investor-demo/report-generator.js <json-report-path>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate HTML report from JSON results
 */
function generateHTML(report) {
  const { summary, categories } = report;

  const passRate = parseFloat(summary.passRate);
  let statusColor, statusText, statusEmoji;

  if (passRate >= 95) {
    statusColor = '#22c55e';
    statusText = 'EXCELLENT';
    statusEmoji = '🛡️';
  } else if (passRate >= 85) {
    statusColor = '#84cc16';
    statusText = 'GOOD';
    statusEmoji = '✅';
  } else if (passRate >= 70) {
    statusColor = '#eab308';
    statusText = 'FAIR';
    statusEmoji = '⚠️';
  } else {
    statusColor = '#ef4444';
    statusText = 'NEEDS WORK';
    statusEmoji = '❌';
  }

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Assistant Security Test Report</title>
  <style>
    :root {
      --primary: #6366f1;
      --success: #22c55e;
      --danger: #ef4444;
      --warning: #eab308;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-300: #d1d5db;
      --gray-600: #4b5563;
      --gray-800: #1f2937;
      --gray-900: #111827;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--gray-50);
      color: var(--gray-800);
      line-height: 1.6;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      background: linear-gradient(135deg, var(--primary), #8b5cf6);
      color: white;
      padding: 3rem 2rem;
      text-align: center;
      border-radius: 1rem;
      margin-bottom: 2rem;
      box-shadow: 0 10px 40px rgba(99, 102, 241, 0.3);
    }

    header h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    header p {
      opacity: 0.9;
      font-size: 1.1rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      text-align: center;
    }

    .stat-card .value {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--primary);
    }

    .stat-card .label {
      color: var(--gray-600);
      font-size: 0.9rem;
      margin-top: 0.25rem;
    }

    .stat-card.success .value { color: var(--success); }
    .stat-card.danger .value { color: var(--danger); }

    .security-badge {
      background: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 2rem;
    }

    .badge-icon {
      font-size: 4rem;
    }

    .badge-content h2 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .badge-status {
      display: inline-block;
      padding: 0.25rem 1rem;
      border-radius: 2rem;
      color: white;
      font-weight: 600;
      background: ${statusColor};
    }

    .section {
      background: white;
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
    }

    .section h3 {
      font-size: 1.25rem;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid var(--gray-100);
    }

    .category-card {
      border: 1px solid var(--gray-200);
      border-radius: 0.5rem;
      margin-bottom: 1rem;
      overflow: hidden;
    }

    .category-header {
      background: var(--gray-100);
      padding: 1rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    }

    .category-header:hover {
      background: var(--gray-200);
    }

    .category-name {
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .category-stats {
      display: flex;
      gap: 1rem;
      font-size: 0.9rem;
    }

    .category-stats .passed {
      color: var(--success);
    }

    .category-stats .failed {
      color: var(--danger);
    }

    .progress-bar {
      height: 8px;
      background: var(--gray-200);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 0.5rem;
    }

    .progress-fill {
      height: 100%;
      background: var(--success);
      transition: width 0.5s ease;
    }

    .scenario-list {
      padding: 1rem 1.5rem;
      display: none;
    }

    .scenario-list.active {
      display: block;
    }

    .scenario-item {
      padding: 1rem;
      border-bottom: 1px solid var(--gray-100);
    }

    .scenario-item:last-child {
      border-bottom: none;
    }

    .scenario-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .scenario-name {
      font-weight: 500;
    }

    .scenario-status {
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .scenario-status.passed {
      background: #dcfce7;
      color: #166534;
    }

    .scenario-status.failed {
      background: #fee2e2;
      color: #991b1b;
    }

    .scenario-details {
      font-size: 0.9rem;
      color: var(--gray-600);
    }

    .attack-vector {
      background: var(--gray-100);
      padding: 0.5rem 0.75rem;
      border-radius: 0.25rem;
      font-size: 0.85rem;
      display: inline-block;
      margin-top: 0.5rem;
    }

    .findings-list {
      list-style: none;
    }

    .finding-item {
      padding: 1rem;
      border-left: 4px solid var(--danger);
      background: #fef2f2;
      margin-bottom: 0.75rem;
      border-radius: 0 0.5rem 0.5rem 0;
    }

    .finding-item strong {
      color: var(--danger);
    }

    .no-findings {
      color: var(--success);
      font-weight: 500;
      padding: 1rem;
      background: #dcfce7;
      border-radius: 0.5rem;
    }

    footer {
      text-align: center;
      padding: 2rem;
      color: var(--gray-600);
      font-size: 0.9rem;
    }

    @media (max-width: 768px) {
      .container {
        padding: 1rem;
      }

      header h1 {
        font-size: 1.75rem;
      }

      .security-badge {
        flex-direction: column;
        text-align: center;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔒 AI Assistant Security Test Report</h1>
      <p>Comprehensive security assessment for investor due diligence</p>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">${summary.totalScenarios}</div>
        <div class="label">Test Scenarios</div>
      </div>
      <div class="stat-card">
        <div class="value">${summary.totalSteps}</div>
        <div class="label">Test Steps</div>
      </div>
      <div class="stat-card">
        <div class="value">${summary.totalAssertions}</div>
        <div class="label">Security Checks</div>
      </div>
      <div class="stat-card success">
        <div class="value">${summary.passed}</div>
        <div class="label">Passed</div>
      </div>
      <div class="stat-card danger">
        <div class="value">${summary.failed}</div>
        <div class="label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="value">${summary.passRate}%</div>
        <div class="label">Pass Rate</div>
      </div>
    </div>

    <div class="security-badge">
      <div class="badge-icon">${statusEmoji}</div>
      <div class="badge-content">
        <h2>Security Assessment</h2>
        <span class="badge-status">${statusText}</span>
        <p style="margin-top: 0.5rem; color: var(--gray-600);">
          ${getAssessmentDescription(passRate)}
        </p>
      </div>
    </div>

    <div class="section">
      <h3>📁 Test Categories</h3>
      ${categories.map((cat, idx) => `
        <div class="category-card">
          <div class="category-header" onclick="toggleCategory(${idx})">
            <div class="category-name">
              ${getCategoryIcon(cat.id)} ${cat.name}
            </div>
            <div class="category-stats">
              <span class="passed">✅ ${cat.summary.passed}</span>
              <span class="failed">❌ ${cat.summary.failed}</span>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${getPassRate(cat)}%"></div>
          </div>
          <div class="scenario-list" id="category-${idx}">
            ${cat.scenarios.map(scenario => `
              <div class="scenario-item">
                <div class="scenario-header">
                  <span class="scenario-name">${scenario.id}: ${scenario.name}</span>
                  <span class="scenario-status ${scenario.status}">${scenario.status.toUpperCase()}</span>
                </div>
                <div class="scenario-details">
                  <div class="attack-vector">🎯 Attack: ${scenario.attackVector}</div>
                  <p style="margin-top: 0.5rem;">Expected: ${scenario.expectedBehavior}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="section">
      <h3>🚨 Critical Findings</h3>
      ${summary.criticalFindings.length === 0
        ? '<div class="no-findings">✅ No critical security issues detected!</div>'
        : `<ul class="findings-list">
            ${summary.criticalFindings.map(f => `
              <li class="finding-item">
                <strong>${f.scenario} / ${f.step}</strong>
                <p>${f.reason || 'Security check failed'}</p>
              </li>
            `).join('')}
          </ul>`
      }
    </div>

    <div class="section">
      <h3>📋 Test Coverage Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: var(--gray-100);">
            <th style="padding: 0.75rem; text-align: left;">Security Domain</th>
            <th style="padding: 0.75rem; text-align: center;">Scenarios</th>
            <th style="padding: 0.75rem; text-align: center;">Pass Rate</th>
            <th style="padding: 0.75rem; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${summary.categories.map(cat => `
            <tr style="border-bottom: 1px solid var(--gray-200);">
              <td style="padding: 0.75rem;">${cat.name}</td>
              <td style="padding: 0.75rem; text-align: center;">${cat.total}</td>
              <td style="padding: 0.75rem; text-align: center;">${cat.passRate}%</td>
              <td style="padding: 0.75rem; text-align: center;">
                ${cat.failed === 0 ? '✅' : '⚠️'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <footer>
      <p>Report generated: ${new Date(summary.timestamp).toLocaleString('tr-TR')}</p>
      <p>Total test duration: ${(summary.duration / 1000).toFixed(1)} seconds</p>
      <p style="margin-top: 1rem; opacity: 0.7;">
        This report is auto-generated by the AI Assistant Security Test Suite.
      </p>
    </footer>
  </div>

  <script>
    function toggleCategory(idx) {
      const el = document.getElementById('category-' + idx);
      el.classList.toggle('active');
    }
  </script>
</body>
</html>`;

  return html;
}

function getCategoryIcon(id) {
  const icons = {
    'PII': '🔐',
    'HALL': '🧠',
    'INJ': '💉',
    'IDENT': '👤',
    'XDATA': '🔀'
  };
  return icons[id] || '📁';
}

function getPassRate(cat) {
  if (cat.summary.total === 0) return 0;
  return ((cat.summary.passed / cat.summary.total) * 100).toFixed(0);
}

function getAssessmentDescription(passRate) {
  if (passRate >= 95) {
    return 'The AI assistant demonstrates excellent security controls. All major attack vectors are properly mitigated, and the system shows strong resistance to manipulation attempts.';
  } else if (passRate >= 85) {
    return 'The AI assistant shows good security posture with minor improvements needed. Most attack vectors are handled correctly.';
  } else if (passRate >= 70) {
    return 'The AI assistant has adequate security but several gaps need attention. Some attack vectors may succeed under certain conditions.';
  } else {
    return 'The AI assistant requires significant security improvements. Multiple critical vulnerabilities were detected during testing.';
  }
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Find most recent report
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) {
      console.error('❌ No reports directory found. Run the tests first.');
      process.exit(1);
    }

    const files = fs.readdirSync(reportDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.error('❌ No JSON reports found. Run the tests first.');
      process.exit(1);
    }

    args[0] = path.join(reportDir, files[0]);
  }

  const reportPath = args[0];

  if (!fs.existsSync(reportPath)) {
    console.error(`❌ Report file not found: ${reportPath}`);
    process.exit(1);
  }

  console.log(`📄 Loading report: ${reportPath}`);

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  const html = generateHTML(report);

  const htmlPath = reportPath.replace('.json', '.html');
  fs.writeFileSync(htmlPath, html);

  console.log(`✅ HTML report generated: ${htmlPath}`);
}

main();
