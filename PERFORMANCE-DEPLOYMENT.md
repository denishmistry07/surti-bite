# Activate the Google Sheets performance upgrade

The local code is ready, but editing these files does not update an existing Apps Script deployment.

## Installation

1. Open the Apps Script project currently serving the web app.
2. Update `Code.gs` from `apps-script/Code.gs` and add a second script file named `Performance.gs` from `apps-script/Performance.gs`. Both files are required.
3. In the editor, run `installPerformanceOptimizations` once and approve the project's requested permissions. It first creates a uniquely named backup copy in the existing backup folder. It does not replace or trash previous backups.
4. Check the execution result for `ready: true` and the backup URL. Confirm that `OrderIndex` and `DailyReports` now exist, and the Triggers page lists `refreshReadModels` every five minutes and `reconcileReadModels` daily around 03:00 Asia/Kolkata.
5. Update the existing web-app deployment to a new version, retaining its deployment URL. Publish the current `frontend` directory to the existing host.
6. Open History and verify the newest orders, Load more, date/search filters, and day/month/year reports. Check the same totals against Orders and Expenses.

Do not rerun `setupSystem` for this upgrade. Do not delete or move Orders, Expenses, RequestLog, StoreSessions, or Settlements.

## What changes

- Saving queues affected business dates in Script Properties instead of rebuilding three reports during checkout.
- A five-minute job batches queued changes. Opening History or a report also processes pending changes, so the next read includes completed app saves. That first read can take longer when there is queued work.
- Default History reads only one page of `OrderIndex`: 20 complete order records. Search, date filters and custom sorting read the compact index in blocks of at most 250 records; broad searches still grow with history size.
- Month/year and all-time totals aggregate daily reports instead of rescanning source Orders. Sessions, order-type totals, cancellations and adjusted amounts are retained.
- The daily job reconciles all source records to pick up manual spreadsheet changes. Manual edits can remain invisible in derived reports until this job runs; run `reconcileReadModels` manually for immediate reconciliation.
- Derived visible summary tabs update in batches. A failed refresh retains dirty markers, and the next refresh retries. Source records are never written by the new index/reconciliation code.
- Installation is idempotent for triggers; rerunning it makes another dated backup but does not install duplicate schedules.

## Data protection and limits

Orders and Expenses remain the source of truth. The upgrade does not archive or delete them. Reconciliation can regenerate the two indexes and four visible summary tabs; do not store unique manual data in those derived tabs. Existing dated zero-sales rows in DailySummary are retained.

This is still Google Sheets and Apps Script: filtered searches, reconciliation and first-time index creation scale with dataset size and remain subject to runtime and cell-size limits. If an index entry exceeds the configured size limit, refresh stops and retains the source data and retry state. No unlimited-speed or zero-risk guarantee is implied.

To roll back, restore the previous Apps Script deployment and remove only the two new scheduled triggers. Leave source data and backup copies intact. The older code can ignore the derived tabs.

## Local verification

Run with Node 20 or newer from the project directory:

```sh
node tests/backend-performance.test.cjs
node tests/read-models.test.cjs
node tests/reliability.test.cjs
```

## Sync visibility, daily backups and operational status

Add `apps-script/Reliability.gs` as a third file named `Reliability.gs`, update Code.gs and Performance.gs, and run `installReliabilityImprovements` once. This creates and verifies a daily backup, verifies a separate recovery copy, and installs a daily backup trigger around 02:00 Asia/Kolkata. Keep the existing performance triggers. Deploy the new Apps Script version and publish the updated frontend.

Only verified backups created by `runDailyBackup` with the internal daily-backup marker are moved to Drive Trash after 30 days, and only after a new backup passes verification. Manual, monthly, pre-upgrade and recovery copies are excluded. Trashed files remain subject to Google Drive's trash lifecycle. A failed verification retains the created copy and does not purge prior copies. Fingerprints cover cell values in the seven source tabs; they do not certify permissions, formatting, bound scripts or triggers.

Settings now displays last summary refresh, pending business dates, recorded refresh/backup errors, verified backup and recovery-check times, and recent request timings. Tap Refresh to obtain current status; it does not continuously poll. Timings are stored only in this browser (last 40 requests) and are not a simulated mobile benchmark.

Pending or failed locally queued orders display a persistent banner with Retry. Keep the browser's storage intact while orders are pending; closing or reloading the tab preserves its existing outbox. Live order creation/editing should be exercised on a staging spreadsheet, not by inserting synthetic sales into production.

For a read-only live backend check:

```sh
node tests/live-read-check.cjs
```

This checks health, History pagination/search and report arithmetic. It does not measure mobile rendering, inspect deployment settings/triggers, or save/edit production orders.

Checks cover failed order replacements, original prices, report reconciliation, cancellations and adjustments, bounded History reads, failed-refresh retries, manual edits and preservation of source Orders.
