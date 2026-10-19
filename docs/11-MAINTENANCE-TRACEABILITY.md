# Maintenance and requirement traceability

## File ownership map

| File | Responsibility |
|---|---|
| frontend/index.html | Screen structure and cache-version references |
| frontend/css/style.css | Responsive layout, selection, operational and sync status styling |
| frontend/js/app.js | Browser state, controls, render paths, open orders and outbox orchestration |
| frontend/js/api.js | JSONP client, request sharing, errors and timing samples |
| frontend/js/storage.js | Browser persistence wrapper |
| frontend/js/config.js | Deployed endpoint and client limits |
| apps-script/Code.gs | Domain operations, source schema, reports and HTTP routes |
| apps-script/Performance.gs | Index preparation, aggregate reports, reconciliation and schedules |
| apps-script/Reliability.gs | Fingerprints, daily backup/retention, recovery tests and status |
| tests/ | Automated and live read-only checks |

## Requirement mapping

| Requirements | Implementation anchors | Evidence |
|---|---|---|
| BR-01 | openSession_, closeSession_, getOpenSession_ | Session UAT |
| BR-02/03 | renderItems, renderCart, newOpenOrderRecord, persistCart | Cart/open-order UAT |
| BR-04 | adjustedAmount, ADJUSTMENT handling | backend-performance, read-models |
| BR-05 | editSavedOrder, updateOrder_ | backend-performance + staging edit UAT |
| BR-06 | processOrderOutbox, saveOrder_, RequestLog | sync-status + offline/retry UAT |
| BR-07 | saveExpenseRow_, addSettlement_, calcExpenseTotals_ | Expense/settlement UAT |
| BR-08/11 | getHistory_, readIndexedHistory_, combineDailyReports_ | read-models, live-read-check |
| BR-09 | applyNavigationSettings, saveNavigationSettings | Navigation UAT |
| BR-10 | formatWeight, Items.WeightG | Weight UAT |
| BR-12 | runDailyBackup, testBackupRecovery, replaceDerivedRows_ | reliability, read-models |
| BR-13 | renderOrderSyncStatus, loadOperationalStatus, getOperationalStatus_ | sync-status + Settings UAT |

## Change checklist

1. Identify affected requirements, source fields and derived fields.
2. Preserve a recoverable source copy before migrations; never silently rewrite historical business data.
3. Update validation and client/server calculations together. Test cancellation, adjustment, historical pricing and multi-order cases.
4. For source mutations, enqueue every affected business date, including old/new dates on an expense move. Keep new-sale request IDs stable across retries.
5. For derived-schema changes, assess READ_MODEL_VERSION and a full reconciliation. Preserve source tabs and fail rather than truncate oversized records.
6. Add focused regression tests, run the suite, then complete relevant staging UAT.
7. Update docs, frontend asset versions and the deployment record. Publish backend and frontend independently as required.
8. Verify schedules, operational status, source reconciliation and rollback path after release.

## Known follow-up decisions

The owner should set named operational responsibilities, access audience, recovery objectives and a measured mobile performance target. Application-level authentication, comprehensive mutation audit history, staging deployment automation and full device UI automation are not implemented in this baseline. They must not be inferred from generic role descriptions or passing unit tests.

## Documentation maintenance

Update this pack whenever schema, actions, business formulas, schedules, retention or recovery behavior changes. Keep the baseline date/version in docs/README.md current. Record actual deployment/test evidence separately from planned acceptance criteria.
