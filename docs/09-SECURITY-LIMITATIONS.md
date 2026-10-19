# Security, privacy and implementation limits

## Access boundary

The frontend contains the Apps Script endpoint; it is visible to anyone who can load the app. The current backend has no application-level login, role checks or mutation authorization token. Actual access depends on Apps Script deployment audience, execution identity and Google account permissions. Hiding a navigation tab changes the UI, not authorization. Do not distribute the app as if cashier/admin roles are enforced.

The owner must review the deployed audience and who can call write actions. Public deployment can expose order/expense data and destructive actions. This pack documents the current design; it does not certify public deployment as secure.

## Transport and browser data

JSONP loads a callback as executable JavaScript from the configured endpoint. Use only the trusted project URL. Mutation payloads are URL-encoded JSON, so references and other values can appear in request logs and encounter URL length limits. HTTPS protects transport but does not provide per-action authorization.

Pending orders and open carts are stored in browser localStorage without application encryption. They are tied to the browser profile and origin, not a shared logged-in account. Clearing site data, private browsing restrictions, quota failure, device loss or malicious scripts can affect them. Do not store payment credentials or unnecessary personal information in references/notes.

Operational status and request timings provide diagnostics, not proactive independent monitoring. Local timing history contains action, duration, success and timestamp, not order payloads, and retains 40 samples.

## Integrity guarantees and boundaries

The code validates item existence, quantities, payment/type choices, adjustment limits, session state and settlement bounds. Script locks coordinate application writes; direct spreadsheet editing does not use these locks. RequestLog reduces duplicate new sales but there is no universal transaction or idempotency framework across all mutations.

Index rebuilding writes derived sheets in separate calls. Failure retains retry state, but partial derived results may exist until a successful retry. Source records remain the rebuild basis. An order replacement is a single range write, not a multi-system transaction. Backups reduce recovery risk but do not make zero loss possible.

Current limits include full source scans during refresh/reconciliation, index scans for broad History search, Google execution/service limits, long JSONP URLs and guarded JSON-cell sizes. No automatic source archiving is installed. Scaling claims should be based on measured dataset sizes.

## Backup and export access

Google Drive sharing determines access to backups and PDFs. A copy should not be assumed private or shared correctly without checking its permissions. Backup value fingerprints exclude formatting, protections, scripts, triggers and deployment state. Daily retention applies only to internally marked copies; Drive Trash has its own lifecycle.

## Review checklist

- Confirm app audience, execution identity and spreadsheet/Drive permissions.
- Preserve raw source tabs and request-log IDs during incident handling.
- Limit free-text personal data and control access to copied workbooks.
- Review operational errors and failed scheduled executions.
- Do not equate a passing local test with a complete security audit.
- Revisit authentication/authorization before granting broader access; no access changes are performed by these documents.
