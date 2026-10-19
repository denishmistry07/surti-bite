# API reference

## Transport and envelope

The frontend reads its endpoint from `frontend/js/config.js`. The portable client sends HTTPS GET script requests with `action`, optional query parameters, JSON-encoded `payload` for mutations, a unique `callback`, and a timestamp cache buster. Apps Script wraps JSON in the validated callback when supplied. Without callback, responses are JSON.

Success: `{"success":true,"data":{...}}`. Failure: `{"success":false,"error":"message"}`. The client resolves `data` or throws an Error. `doPost` also supports mutation actions for compatibility, but the portable frontend uses JSONP to avoid cross-origin fetch restrictions.

Default client timeout: 30 seconds. Read retries: 1. Mutation wrappers use zero automatic transport retries; new-order outbox retry is a separate mechanism. Matching reads already in flight are shared. Request timing history retains the last 40 local samples.

## Read actions

| Action | Parameters | Response purpose |
|---|---|---|
| health | None | Backend availability and configured spreadsheet ID |
| bootstrap | None | Settings, active items, image flag and current session |
| items | None | Active product catalogue |
| manageItems | None | Products including inactive entries |
| session | None | Open session or null |
| today | None | Active-business-date report |
| allTimeSales | None | All-time sales and order count |
| history | offset, limit, q, from, to, payment, orderType, status, minAmount, maxAmount, sort | Orders, total, filteredTotal, filteredSales and nextOffset |
| expenses | period: day/month/year; value or businessDate | Expense records, settlements, selected-period totals and all-time totals |
| report | type: day/month/year; value | Full period report |
| operationalStatus | None | Summary refresh, pending dates, errors, backup and recovery times |

History default limit is 20; server limit is clamped to 1–100. Sort choices are newest, oldest, amountHigh and amountLow. Dates are business dates, not browser calendar timestamps. `nextOffset: null` means pagination is complete. A read may refresh queued derived data; health/status checks do not deliberately create test sales.

## Mutation actions

| Action | Key payload fields | Behavior |
|---|---|---|
| openSession | businessDate, sessionName | Creates an open session when none exists |
| closeSession | None | Closes current session and queues summary refresh |
| saveOrder | clientRequestId, items:[{id,qty}], paymentMethod, orderType, orderFor, adjustedAmount | Validates and saves a new order; duplicate request ID returns existing order ID |
| updateOrder | orderId plus order fields | Updates existing non-cancelled order and preserves date/session and retained-product prices |
| cancelOrder | orderId | Marks source order rows Cancelled |
| deleteOrder | orderId | Removes order rows and associated request-log mappings |
| addExpense | Expense fields below | Creates expense; an supplied expenseId redirects to update behavior |
| updateExpense | expenseId plus Expense fields | Preserves original creation time |
| deleteExpense | expenseId | Removes expense using backend deletion logic |
| addSettlement | expenseId, fromPerson, toPerson, amount, paymentMethod, notes | Records linked fund return |
| saveItem | originalItemId, itemId, name, category, price, active, sortOrder, imageUrl, description, weightG | Creates/updates product |
| deleteItem | itemId | Removes product catalogue row |
| updateNavigationSettings | ShowTabToday, ShowTabReports, ShowTabHistory, ShowTabExpenses | Stores enabled flags as settings |
| updatePrintSettings | PrintBillEnabled (boolean) | Saves shared print on/off as Yes/No in Settings |
| saveReportPdf | type, value | Creates report PDF in Drive and returns file metadata/URL |
| backupData | None | Existing manual-backup workflow |

Expense fields: businessDate, expenseType, frequency, category, description, amount, paymentMethod, vendor, sessionId, notes, paidBy, settlementType, fundOwner and fundRemaining.

## New-order example

```json
{
  "clientRequestId": "REQ-example-unique-id",
  "items": [{"id": "L001", "qty": 2}],
  "paymentMethod": "Online",
  "orderType": "Dine-in",
  "orderFor": "Table 2",
  "adjustedAmount": 20
}
```

Do not call mutation examples against production for testing. The backend supplies authoritative new-sale prices; the browser does not submit a trusted payable total. Quantity validation permits positive quantities up to 999. Adjusted amount must be finite and between 0 and 100,000. New saves require an open session; saved-order corrections use the original order context.

## Retry and integration cautions

Reuse the same clientRequestId when retrying a new sale. Do not generate a new ID after an uncertain response. Updates, expenses, settlements and deletes do not share universal idempotency protection. Confirm server state after an ambiguous mutation timeout. JSONP payloads travel in the URL and may be limited by URL length or exposed in logs. Deployment access is the access boundary; a URL is not an application credential.

Editor-only administration functions include setupSystem, installPerformanceOptimizations, installReliabilityImprovements, refreshReadModels, reconcileReadModels, repairAllSummaries, runDailyBackup, testBackupRecovery and runMonthlyBackup. They are not all HTTP actions.
