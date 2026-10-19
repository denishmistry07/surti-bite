# Test plan and release acceptance

## Test environments and data

Use Node 20+ for automated checks. Use a separate spreadsheet, Apps Script project/deployment and browser origin for write UAT. Test fixtures are synthetic. Never create sample sales or exercise delete against production to prove a release. Snapshot source tabs before migration/recovery exercises.

## Automated suite

```sh
node tests/backend-performance.test.cjs
node tests/read-models.test.cjs
node tests/reliability.test.cjs
node tests/sync-status.test.cjs
node tests/live-read-check.cjs
```

The last command calls the endpoint in frontend/js/config.js. It checks health, History pagination/search and day/month/year report arithmetic; it does not perform production order mutations. Request reads can prepare pending derived data.

| Test file | Covered behavior |
|---|---|
| backend-performance | Replacement-write failure, historical prices, adjustment/dish totals, original metadata, request-local reads, report reconciliation |
| read-models | 501-order fixture, 20-record page reads, last/empty pages, bounded search, daily aggregation, cancellations/deletions, retry markers, manual corrections, source protection |
| reliability | Backup verification, scoped retention, failed-backup protection, recovery-copy check, status |
| sync-status | Empty/pending/offline/failed/syncing display, retry availability, shared-read timings, 40-sample limit |
| live-read-check | Real endpoint availability, nonoverlapping History pages, search and report arithmetic |

Mocks test intended behavior but do not reproduce Google permissions, trigger timing, quota exhaustion, every network failure, mobile rendering or the active hosting deployment.

## Manual UAT checklist

| ID | Scenario | Expected result |
|---|---|---|
| UAT-01 | Open a session, cross midnight | Correct session business date stays attached to sales |
| UAT-02 | Two ₹50 items + ₹20 adjustment | ₹120 payable; two dishes |
| UAT-03 | Add 1, 2, 10 portions at 120g | 120g, 240g, 1.2kg |
| UAT-04 | Switch two local open orders | Independent items/payment/type/reference/adjustment |
| UAT-05 | Queue a new sale offline, reload, reconnect | Outbox retained, clear sync state, one server order after retry |
| UAT-06 | Retry the same client request ID | No duplicate sale |
| UAT-07 | Change menu price then edit prior order | Retained line keeps prior price; newly added item uses current price |
| UAT-08 | Update saved order with failed connection | Editable cart preserved; no false success |
| UAT-09 | Cancel and delete on staging | Report totals update; History status/removal matches action |
| UAT-10 | Add/edit/move expense date; add settlement | Correct expense/payment/period/funding values; no double-counted purchase |
| UAT-11 | Hide optional tabs and reload slowly | Hidden tabs do not flash; remaining tabs remain selectable |
| UAT-12 | History next page, query/date/amount filters | Complete orders, no duplicated pages, correct filter totals |
| UAT-13 | Compare day/month/year against source | Cancelled sales excluded; adjustment revenue included |
| UAT-14 | Manual source correction then reconciliation | Derived History/reports reflect correction |
| UAT-15 | Daily backup and separate recovery check | Matching values; production unchanged; URLs retained |
| UAT-16 | Mobile Settings/cart/navigation | No horizontal overflow, readable controls, input accessible with keyboard |
| UAT-17 | Publish deployment and refresh assets | UI/backend versions agree; operational status available |

## Performance measurement

Measure on the actual operator phone/network, both cold and warm. Record device/browser, network, source order count, pending refresh state, request action and elapsed time. Separately measure visible rendering and user tap response; the Settings average measures successful request duration only. Compare median and slow cases over repeated runs, without inventing a contractual target from one measurement.

Prior live smoke checks observed roughly 1.8–2.6 seconds per request from the test environment. This is historical evidence, not a mobile benchmark or future guarantee. Re-run after deployment; do not treat these docs as a fresh execution result.

## Release gate

Require passing automated tests, staging write UAT, source-total reconciliation, verified backup/recovery copy, matching deployed versions and confirmed schedules. Record evidence, approver, date and unresolved limitations. Save/edit production flows and real-device rendering are not certified by the read-only suite.
