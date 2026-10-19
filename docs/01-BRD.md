# Business requirements document

## Purpose and business need

Surti Bite supports counter sales of Locho and related products using a mobile-friendly web interface and Google Sheets as the system of record. Staff need fast order entry, multiple open orders, reliable payment totals, expense tracking, and recoverable business data without introducing a separate database.

## Stakeholders

| Stakeholder | Responsibility |
|---|---|
| Business owner | Pricing, menu, financial review, acceptance and access decisions |
| Operator/cashier | Sessions, order entry, corrections, payment selection |
| Expense operator | Purchases, expense classification, advances and settlements |
| Administrator | Deployments, permissions, triggers, backups and recovery |
| Maintainer | Code changes, testing, documentation and incident diagnosis |

These are business responsibilities, not implemented login roles. The current application does not enforce different permissions for these groups.

## Objectives

1. Record sales accurately while keeping checkout responsive.
2. Preserve pending orders on the same browser through reloads and temporary connectivity loss.
3. Correct saved orders without creating another sale or repricing unchanged products.
4. Distinguish operating expenses, investment expenses and payment methods.
5. Provide daily, monthly, yearly and all-time views that reconcile with source records.
6. Keep data in Google Sheets, with rebuildable indexes and verified backup copies.

## Scope and acceptance criteria

| ID | Requirement | Acceptance criterion |
|---|---|---|
| BR-01 | Session management | Staff can open/close a session; new sales require an open session and use its business date. |
| BR-02 | Menu ordering | Active products can be searched, filtered and added; totals change with quantity. |
| BR-03 | Multiple open orders | Switching orders preserves each cart, payment, type, reference and adjustment locally. |
| BR-04 | Custom amount add-on | Two ₹50 portions plus ₹20 adjustment total ₹120 with dish count 2. |
| BR-05 | Saved-order correction | Edit preserves order ID, original date/session and historical prices of retained products. |
| BR-06 | Offline queue | New sales are queued locally and retried using the same client request ID; duplicate submission does not create another order. |
| BR-07 | Expenses and settlements | Expense records include funding information; returns are linked to expenses and cannot exceed the allowed remainder. |
| BR-08 | Reports and History | History pages contain complete orders; cancellation excludes sales from reports; period totals reconcile with source data. |
| BR-09 | Navigation preferences | Optional tabs follow saved settings; Order, Menu and Settings remain available. |
| BR-10 | Weight display | A 120g portion shows 240g at quantity 2 and 1.2kg at quantity 10; weight does not change price. |
| BR-11 | Performance | Default History reads a bounded page; clean month/year reports read daily derived data instead of source Orders. |
| BR-12 | Data protection | Reconciliation writes only derived tabs; verified backups and a separate recovery-copy check are available. |
| BR-13 | Operational visibility | Pending syncs, refresh errors, backup dates and local request timings can be inspected. |

## Business rules

- Currency display is INR. Payment is recorded as Online or Offline; the application does not process a payment transaction.
- Order types are Dine-in and Takeaway. Optional references are controlled by configuration.
- The session business date is distinct from the calendar timestamp, allowing a session to continue past midnight.
- Adjusted amount is a non-negative order-level add-on. It increases sales but not dish or bestseller quantity.
- New menu prices apply to new sales. Existing product prices are preserved during saved-order editing; newly added products use current prices.
- Operating profit = sales − operating expenses. Net cash profit = sales − all recorded expenses. These are application calculations, not a complete accounting ledger.
- Cancelled orders remain visible but contribute no sales to reports. Delete is a separate destructive operation.
- Weights are stored as grams per product. Quantities multiply weight; values at or above 1,000g are formatted as kg.

## Exclusions and constraints

No database migration, automatic archiving, inventory depletion, payroll, tax filing, refunds workflow, payment gateway, or role-based login is included. The app depends on the selected host, browser storage, Apps Script permissions/runtime and Google services. No fixed response-time SLA or zero-data-loss guarantee is specified.

## Acceptance and ownership

The owner should approve the UAT checklist in [08](08-TEST-PLAN-ACCEPTANCE.md), define who may access the deployed app, and assign backup/recovery responsibility. Formal approval, named owners, target load and business recovery objectives are not recorded in the repository and must not be assumed.
