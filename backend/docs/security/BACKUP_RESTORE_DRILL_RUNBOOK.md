# Backup Restore Drill Runbook

## Objective
Demonstrate that backups can be validated and restore readiness can be proven on a recurring basis.

## Automation
- Script: `backend/scripts/backup-restore-drill.js`
- NPM command: `npm --prefix backend run ops:backup-restore-drill`
- Scheduled in: `.github/workflows/security-ops-controls.yml`

## Modes
- `Simulation mode`:
  - Runs when `BACKUP_RESTORE_DUMP_PATH` is not provided.
  - Produces an auditable JSON report and verifies runbook/script execution path.
- `Real validation mode`:
  - Runs when `BACKUP_RESTORE_DUMP_PATH` is provided.
  - Checks dump existence and attempts `pg_restore --list`.
  - Fails drill if dump is unreadable.

## Required Environment Variables
- `BACKUP_RESTORE_DUMP_PATH` (optional for simulation, required for real drill)
- `BACKUP_RESTORE_REQUIRE_REAL=true` (optional strict mode)

## Procedure
1. Export/provide path to current encrypted backup dump.
2. Run drill command.
3. Review generated report under `backend/tests/reports/backup-restore-drill-*.json`.
4. Investigate and remediate any failed check before production release.

## Success Criteria
- Script exits `0`.
- Report indicates `success: true`.
- In real mode: `dump_exists` and `pg_restore_list` checks are `pass`.
