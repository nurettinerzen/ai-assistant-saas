#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import dns from 'dns/promises';

const TAKEOVER_FINGERPRINTS = [
  "there isn't a github pages site here",
  'no such app',
  'project not found',
  'domain is not configured',
  'the requested url was not found on this server',
];

function parseHosts() {
  const inline = String(process.env.SUBDOMAIN_ASSETS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set(inline));
}

async function probeHttp(hostname) {
  for (const protocol of ['https', 'http']) {
    const url = `${protocol}://${hostname}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'telyx-security-check/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      const body = (await response.text()).toLowerCase();
      const matchedFingerprint = TAKEOVER_FINGERPRINTS.find((fingerprint) => body.includes(fingerprint));
      return {
        reachable: true,
        protocol,
        status: response.status,
        matchedFingerprint: matchedFingerprint || null,
      };
    } catch {
      // Try next protocol.
    }
  }

  return {
    reachable: false,
    protocol: null,
    status: null,
    matchedFingerprint: null,
  };
}

async function inspectHost(hostname) {
  const report = {
    hostname,
    dnsOk: false,
    records: [],
    http: null,
    risk: 'LOW',
    findings: [],
  };

  try {
    const records = await dns.resolveAny(hostname);
    report.dnsOk = true;
    report.records = records.map((entry) => ({
      type: entry.type,
      value: entry.value || entry.address || entry.exchange || null,
    }));
  } catch (error) {
    report.findings.push(`DNS resolution failed (${error.code || 'ERR'})`);
    report.risk = 'HIGH';
    return report;
  }

  report.http = await probeHttp(hostname);
  if (!report.http.reachable) {
    report.findings.push('Host not reachable via HTTP/HTTPS');
    report.risk = 'MEDIUM';
  }

  if (report.http.matchedFingerprint) {
    report.findings.push(`Potential takeover fingerprint: "${report.http.matchedFingerprint}"`);
    report.risk = 'HIGH';
  }

  return report;
}

async function main() {
  const hosts = parseHosts();
  if (hosts.length === 0) {
    console.error('No hosts provided. Set SUBDOMAIN_ASSETS env (comma-separated).');
    process.exit(2);
  }

  const results = [];
  for (const host of hosts) {
    results.push(await inspectHost(host));
  }

  const highRisk = results.filter((result) => result.risk === 'HIGH');
  const mediumRisk = results.filter((result) => result.risk === 'MEDIUM');

  const summary = {
    generatedAt: new Date().toISOString(),
    totalHosts: results.length,
    highRiskCount: highRisk.length,
    mediumRiskCount: mediumRisk.length,
    results,
  };

  const outputDir = path.resolve(process.cwd(), 'backend/tests/reports');
  await fs.mkdir(outputDir, { recursive: true });
  const fileName = `subdomain-takeover-check-${Date.now()}.json`;
  const outputPath = path.join(outputDir, fileName);
  await fs.writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({ ...summary, outputPath }, null, 2));
  process.exit(highRisk.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('subdomain-takeover-check failed:', error);
  process.exit(1);
});
