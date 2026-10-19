# Operations, backup and recovery runbook

## Routine checks

At opening: verify internet, active session/business date, pending sync count and menu. Before closing a browser/device: ensure the outbox is empty. At day end: close the session, inspect sales/payment/expense totals and review Settings → Sync & backups. An empty sync banner means this browser has no queued orders; it does not certify all other devices.

## Schedule register

| Handler | Installed by | Intended schedule |
|---|---|---|
| refreshReadModels | installPerformanceOptimizations | Every five minutes; exits when no queued work |
| reconcileReadModels | installPerformanceOptimizations | Daily around 03:00 Asia/Kolkata |
| runDailyBackup | installReliabilityImprovements | Daily around 02:00 Asia/Kolkata |
| runMonthlyBackup | setupSystem / backup-trigger installer | First day of month around 02:00, previous-month copy |

Time-based trigger execution is approximate. Confirm handler names in Apps Script Triggers and inspect Executions after installation or account changes. UI status reports recorded timestamps/errors; it is not an independent alerting service and does not prove that a trigger still exists.

## Backup policies

- Daily backups are uniquely named, verified by source-value fingerprint, and marked internally. After a new backup passes, only marked daily copies older than 30 days are moved to Drive Trash. Manual/monthly/pre-upgrade/recovery copies are excluded from this policy.
- Failure to verify the new daily copy retains it for inspection and prevents that run's retention cleanup.
- Monthly backup keeps a named prior-month snapshot; no automatic monthly retention limit is implemented.
- The manual backupData workflow replaces same-day manual copies by moving older matching copies to Trash. This differs from daily backups. Report-PDF export similarly replaces matching period filenames.
- Backup and recovery fingerprints cover cell values in Orders, Expenses, RequestLog, StoreSessions, Settlements, Items and Settings. They do not certify permissions, formats, deployment configuration, triggers or local browser outboxes.

## Safe recovery exercise

Run runDailyBackup, then testBackupRecovery in the editor. The test copies the verified backup to a separate Recovery Test workbook and checks its fingerprint against the backup. It never writes the production workbook. Keep the returned URL and execution evidence. This proves copied source values match; it is not a full running-application failover exercise.

## Production incident recovery

1. Stop new writes and preserve pending browser outboxes. Do not clear browser storage or delete RequestLog.
2. Make a dated copy of the current production workbook, even if damaged, and record the active deployment configuration.
3. Select a verified backup from before the incident. Restore it into a separate workbook first; verify source values, row counts, dates, amounts and access.
4. Identify sales/expenses/settlements created after that backup. Reconcile them from the retained current workbook and pending device queues before cutover. Old restored RequestLog data can affect duplicate handling.
5. Agree a cutover with the owner. Either point a reviewed backend deployment to the recovered workbook or perform a controlled restore. Do not automatically overwrite production from this runbook.
6. Rebuild derived data, install/verify required triggers, authorize the correct account and run staging/read checks against the recovered configuration.
7. Resume operators only after totals and pending-order handling are approved. Record any unrecoverable gap explicitly.

Daily backup timing defines exposure since the last successful copy; no formal recovery point/time objective is guaranteed. Unsynced orders exist only on their originating browser.

## Incident table

| Symptom | Check | Action |
|---|---|---|
| Pending/failed sync | Internet, endpoint, deployment access, server execution error | Keep storage intact; use Retry; do not recreate the same sale with a new request ID |
| Wrong summaries | Dirty dates, refresh error, manual source edits | Run reconcileReadModels; compare source totals; do not hand-edit derived JSON |
| Slow first report | Queued refresh or initial index build | Inspect Executions and timings; allow refresh to finish before repeated requests |
| Missing backup timestamp | Reliability installer, owner authorization, Drive access, trigger failure | Review Executions; run verified backup manually; preserve previous copies |
| Wrong prices during edit | Source historical UnitPrice and local editable order | Preserve source copy; investigate rather than bulk repricing historical rows |
| Status unavailable | Published frontend/backend version mismatch | Deploy matching files; confirm operationalStatus route exists |
| Recovery mismatch | Source values, date/time conversion, concurrent changes | Retain both copies; do not replace production; investigate failed verification |

Escalation owner/contact is not configured in code; the business owner must assign it.
