# Post-Merge Observation Metrics

**Branch**: new-branch-codex
**Date**: 2026-02-06

Monitor these metrics for 48 hours after merge. Alert thresholds noted.

---

## 1. Leak Filter Triggered Rate

**What**: `leakFilterViolation` in Step7 metrics
**Log pattern**: `[SecurityGateway] Verification required`
**Expected baseline**: ~5-10% of customer data queries (unverified users)
**Alert if**: > 30% (possible false positive regression)
**Alert if**: 0% (possible filter bypass)

```bash
grep "SecurityGateway.*Verification required" logs | wc -l
grep "SecurityGateway.*Leak filter passed" logs | wc -l
```

---

## 2. Verification Pending -> Verified Conversion Rate

**What**: Sessions that go from `pending` to `verified`
**Log pattern**: `[ToolLoop] Applied outcome events: [ 'verification.passed' ]`
**Expected baseline**: > 60% of sessions that enter pending
**Alert if**: < 30% (possible stateEvents pipeline issue)
**Alert if**: Conversion drops vs. pre-merge baseline

```bash
grep "verification.required" logs | wc -l  # denominator
grep "verification.passed" logs | wc -l    # numerator
```

---

## 3. NOT_FOUND Counts

**What**: Tool outcomes with NOT_FOUND
**Log pattern**: `[ToolLoop] NOT_FOUND terminal state`
**Expected baseline**: ~20-30% of customer_data_lookup calls
**Alert if**: > 50% (possible DB issue or normalization regression)

```bash
grep "NOT_FOUND terminal state" logs | wc -l
grep "Calling tool: customer_data_lookup" logs | wc -l
```

---

## 4. Session Lock / Enumeration Blocks

**What**: Sessions blocked due to enumeration attack detection
**Log pattern**: `[Enumeration] Session blocked after`
**Expected baseline**: < 1% of sessions
**Alert if**: > 5% (possible false positive in enumeration detection)

```bash
grep "Enumeration.*Session blocked" logs | wc -l
```

---

## 5. Action Claim Block Count

**What**: LLM responses blocked for false action claims
**Log pattern**: `[ToolFail] LLM made action claim without tool success`
**Expected baseline**: < 2% of responses
**Alert if**: > 10% (lexicon too aggressive) or 0% (lexicon not loading)

```bash
grep "ToolFail.*action claim" logs | wc -l
grep "Guardrails.*All policies applied" logs | wc -l
```

---

## 6. Route Firewall Telemetry Misses

**What**: Cases where route firewall catches something Step7 missed
**Log pattern**: Route-level `logFirewallViolation` when Step7 passed
**Expected baseline**: 0 (Step7 should catch everything)
**Alert if**: > 0 (indicates Step7 gap, consider switching to enforce mode)

```bash
grep "FIREWALL.*SECURITY VIOLATION" logs | wc -l
```

---

## Rollback Procedure

If critical issues detected:

### Quick: Revert to double enforcement
```bash
export FEATURE_ROUTE_FIREWALL_MODE=enforce
# Restart server
```

### Quick: Revert stateEvents pipeline
```bash
export FEATURE_USE_STATE_EVENTS=false
# Restart server - tools will use legacy direct state mutation
```

### Full: Revert merge
```bash
git revert <commit-C-hash>  # Most risky changes
# Monitor
git revert <commit-B-hash>  # If still issues
git revert <commit-A-hash>  # Nuclear option
```
