#!/usr/bin/env node

import { buildSecurityConfigDigest, compareBaselineDigest } from '../src/security/configIntegrity.js';

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const failOnMismatch = args.includes('--fail-on-mismatch');
  const baselineArg = args.find((arg) => arg.startsWith('--baseline='));
  const baseline = baselineArg
    ? baselineArg.slice('--baseline='.length)
    : process.env.SECURITY_CONFIG_BASELINE_SHA256;

  const result = await buildSecurityConfigDigest();
  const compare = compareBaselineDigest(result.digest, baseline);

  const output = {
    digest: result.digest,
    baseline: baseline || null,
    baselineStatus: compare.reason,
    envKeys: result.envKeys,
    filePaths: result.filePaths,
    generatedAt: result.payload.generatedAt,
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`Security config digest: ${output.digest}`);
    console.log(`Baseline status: ${output.baselineStatus}`);
    if (output.baseline) {
      console.log(`Baseline digest: ${output.baseline}`);
    } else {
      console.log('Baseline digest: <unset>');
    }
  }

  if (failOnMismatch && !compare.matches) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('security-config-integrity failed:', error);
  process.exit(1);
});
