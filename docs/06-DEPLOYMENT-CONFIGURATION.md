# Deployment and configuration

## Deliverables

- Static frontend: publish the complete `frontend/` directory.
- Backend: upload `Code.gs`, `Performance.gs` and `Reliability.gs` from `apps-script/` into the same Apps Script project.
- Tests: Node 20+ for local verification; not required to serve the frontend.
- Data: production Google Sheet; reports and backups use the script owner's configured Drive folders.

## Configuration points

| Location | Settings |
|---|---|
| frontend/js/config.js | APPS_SCRIPT_URL, TIMEOUT_MS=30000, RETRIES=1, HISTORY_LIMIT=20 |
| apps-script/Code.gs APP | SPREADSHEET_ID, TZ=Asia/Kolkata, CACHE_SECONDS=300, folder names, stale-session threshold |
| Settings tab | ShopName, currency fields, Timezone, OrderPrefix, DriveParentFolderName, FileNamePrefix, image/description/reference flags, optional navigation flags |

Changing the Settings Timezone value alone does not replace the backend APP.TZ constant. Keep the script timezone and intended business timezone consistent.

## New installation

1. Use a separate staging spreadsheet and script project first. Set the backend spreadsheet ID and verify ownership/access.
2. Upload all three backend files. Run setupSystem only for initial installation or an intentionally reviewed schema repair. It creates/repairs headers, validations and defaults and seeds items when appropriate.
3. Run installPerformanceOptimizations. It makes a pre-upgrade copy, builds derived tabs and installs refresh/reconciliation schedules.
4. Run installReliabilityImprovements. It makes/verifies a daily backup, verifies a separate recovery copy and installs daily backups.
5. Review script authorizations, execution identity and web-app audience. These are owner decisions; do not assume public access is suitable.
6. Deploy as a web app and set the resulting `/exec` URL in frontend/js/config.js.
7. Publish frontend and complete staging UAT before using the production spreadsheet.

## Upgrade an existing installation

Preserve the workbook and deployment URL. Follow [the detailed activation checklist](../PERFORMANCE-DEPLOYMENT.md). Update all three script files; run installers only when introducing their features or repairing schedules. Repeated installer runs can create additional dated copies. Do not rerun setupSystem merely to publish an upgrade.

Apps Script: Deploy → Manage deployments → Edit existing deployment → New version → Deploy. Retain the same URL so the frontend configuration stays valid. Static host: publish the current frontend directory including HTML, CSS, JS and assets. Version query strings in HTML help invalidate cached assets but do not publish files by themselves.

## Local use

Use `frontend/serve-local.sh` on macOS or `frontend/serve-local.bat` on Windows. These scripts use a local HTTP server; see their runtime requirements. Do not rely on opening index.html through file://. Local frontend requests still reach the configured backend, which can be production: use staging configuration for write tests.

## Deployment verification

Confirm health, bootstrap/session, newest History page, second page without overlap, search, date filters, day/month/year totals, Settings operational status and trigger records. Live save/edit tests should use staging. The backend live-read test intentionally performs no order mutations.

## Rollback

Restore the previous Apps Script web deployment version and matching static files. Remove/disable only newly introduced schedules if incompatible with the rollback. Keep source tabs, pending outboxes and backup copies intact. Derived tabs can remain when ignored by older code. A workbook restore is a separate recovery procedure and must not be used as a routine code rollback.

## Release record template

Record release date, frontend revision, Apps Script version/deployment ID, endpoint, spreadsheet ID, backup URL, installer outcomes, trigger list, test results, approver and rollback version. The repository is not evidence that a specific remote deployment has been updated.
