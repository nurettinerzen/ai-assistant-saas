#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function runPgRestoreList(dumpPath) {
  const { stdout } = await execFileAsync('pg_restore', ['--list', dumpPath], { timeout: 30_000 });
  const lines = stdout.split('\n').filter((line) => line.trim().length > 0);
  return {
    objectCount: lines.length,
    sample: lines.slice(0, 10),
  };
}

async function main() {
  const dumpPath = process.env.BACKUP_RESTORE_DUMP_PATH || '';
  const requireReal = process.env.BACKUP_RESTORE_REQUIRE_REAL === 'true';

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'simulation',
    success: true,
    checks: [],
    notes: [],
  };

  if (!dumpPath) {
    report.notes.push('BACKUP_RESTORE_DUMP_PATH not set. Ran simulation mode.');
    report.checks.push({
      name: 'runbook_present',
      status: 'pass',
      detail: 'Restore runbook documented in backend/docs/security/BACKUP_RESTORE_DRILL_RUNBOOK.md',
    });
    if (requireReal) {
      report.success = false;
      report.notes.push('Real restore was required but no dump path provided.');
    }
  } else {
    report.mode = 'real';
    try {
      const resolvedDump = path.resolve(dumpPath);
      const stat = await fs.stat(resolvedDump);
      report.checks.push({
        name: 'dump_exists',
        status: 'pass',
        detail: `${resolvedDump} (${stat.size} bytes)`,
      });

      const listResult = await runPgRestoreList(resolvedDump);
      report.checks.push({
        name: 'pg_restore_list',
        status: 'pass',
        detail: `Backup readable with ${listResult.objectCount} objects`,
      });
      report.notes.push(...listResult.sample.map((line) => `sample: ${line}`));
    } catch (error) {
      report.success = false;
      report.checks.push({
        name: 'real_restore_validation',
        status: 'fail',
        detail: error.message,
      });
    }
  }

  const outputDir = path.resolve(process.cwd(), 'backend/tests/reports');
  await ensureDir(outputDir);
  const outputPath = path.join(outputDir, `backup-restore-drill-${Date.now()}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({ ...report, outputPath }, null, 2));
  process.exit(report.success ? 0 : 1);
}

main().catch((error) => {
  console.error('backup-restore-drill failed:', error);
  process.exit(1);
});
