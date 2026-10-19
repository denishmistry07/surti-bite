# System architecture

## Component view

```text
Operator browser
  ├─ Static UI: index.html + style.css + app.js
  ├─ API client: api.js (JSONP, matching read-request sharing, timings)
  └─ localStorage: open carts + pending-sale outbox + preferences
                 │ HTTPS script request / callback response
                 ▼
Google Apps Script web deployment
  ├─ Code.gs: routing, validation, sessions, order/expense operations
  ├─ Performance.gs: dirty-date queue, indexes, summary aggregation
  ├─ Reliability.gs: verified backups, recovery checks, operational status
  ├─ Script Properties: dirty markers, index state, operational metadata
  └─ Script Cache: short-lived response/session/menu caches
                 │
       ┌─────────┴──────────┐
       ▼                    ▼
Google Sheets             Google Drive
  Source tabs               PDF reports
  Derived tabs              Daily/monthly/manual/recovery copies
       ▲                    ▲
       └─ Scheduled Apps Script triggers ─┘
```

There is no separate application server or database. Static hosting is portable; the configured Apps Script `/exec` URL connects the frontend to the production workbook.

## Source and derived boundaries

Orders, Expenses, RequestLog, StoreSessions, Settlements, Items and Settings are authoritative. OrderIndex, DailyReports and the four visible summary tabs are derived. Reconciliation may replace derived rows but must never treat derived values as the only surviving copy of a source record.

`OrderIndex` stores one JSON record per order, sorted by creation timestamp descending. The default History path reads one page directly. Filtered History searches compact records in blocks of up to 250; it still scans the index for broad queries.

`DailyReports` stores one report JSON per business date. Month/year/all-time reports merge those daily results, retaining product, session, payment and order-type totals. This avoids repeated source-order scans on clean report reads.

## Write and refresh flow

1. New sales are durably queued in browser storage before the UI closes the cart.
2. Server-side locks coordinate source writes; RequestLog detects repeated client request IDs.
3. A completed mutation invalidates relevant caches and records affected dates in Script Properties.
4. Every-five-minute refresh batches queued dates. A History/report read also prepares pending derived data when required.
5. Refresh reads source data once into a request-local snapshot, groups by date, rebuilds affected daily reports and the History index, and writes derived tables in batches.
6. Dirty markers are cleared only after successful completion. Failures retain retry state and record an operational error.
7. Daily full reconciliation also detects direct source-sheet edits that did not enqueue a date.

This is eventual consistency for visible sheet summaries. The first request after queued writes may wait for refresh. There is no cross-sheet database transaction: derived sheets can be partially written on failure, and retry regenerates them from sources.

## Performance layers

| Layer | Optimization | Boundary |
|---|---|---|
| Browser | Reuses unchanged cart/order-tab DOM | Large product catalogues still require rendering work |
| API client | Shares matching reads already in flight | It is not an unlimited persistent response cache |
| Views | Short freshness windows | Mutations mark data stale; cross-device changes can appear later |
| History | Indexed page reads, 20 by default | Searches and custom sorts grow with index size |
| Reports | Daily report aggregation | Number of business dates and product/session detail still matters |
| Backend | Request-local source snapshots and caches | Cold refresh/reconciliation reads source records |
| Checkout | Queues derived work instead of rebuilding reports | Validation, sheet writes and idempotency checks still cost time |

## Integrity and recovery

Existing-order replacement uses one source-range write rather than deleting the original rows first. This preserves original values if that write fails in the tested failure scenario; it is not a multi-service ACID guarantee. Retained product prices use historical unit prices. Adjustments use a special zero-quantity row.

Daily backup verifies a SHA-256 fingerprint of cell values in seven source tabs. Recovery verification reads a separate copy. Neither operation overwrites production. Fingerprints do not verify deployment permissions, formatting, scripts or triggers.

## Deployment and trust

Apps Script code, web deployment and static frontend are independently versioned. Trigger execution uses the script owner's authorizations. App visibility depends on the deployment configuration; the code does not provide application-level roles. JSONP responses execute script in the browser, so the configured endpoint must be trusted. See [09](09-SECURITY-LIMITATIONS.md).
