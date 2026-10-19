# Data dictionary and relationships

## General conventions

Rows start with headers. IDs are stored as strings; monetary values and quantities are numeric. Business dates are normalized as `YYYY-MM-DD`; month/year keys use `YYYY-MM`/`YYYY`. Sheet cells may contain native dates, which Apps Script formats in Asia/Kolkata. Display timestamps are presentation values, not sort keys.

## Authoritative tabs

| Tab | Columns in stored order |
|---|---|
| Items | ItemID, ItemName, Category, Price, Active, SortOrder, ImageURL, Description, WeightG |
| Orders | OrderID, DateTime, ItemID, ItemName, Qty, UnitPrice, Total, Status, PaymentMethod, BusinessDate, SaleTime, SessionID, OrderType, OrderFor |
| Settings | Key, Value |
| RequestLog | ClientRequestID, OrderID, CreatedAt |
| StoreSessions | SessionID, BusinessDate, SessionName, OpenTime, CloseTime, Status |
| Expenses | ExpenseID, DateTime, BusinessDate, ExpenseType, Frequency, Category, Description, Amount, PaymentMethod, Vendor, SessionID, Notes, PaidBy, SettlementType, FundOwner, FundRemaining |
| Settlements | SettlementID, DateTime, BusinessDate, ExpenseID, FromPerson, ToPerson, Amount, PaymentMethod, Notes |

### Important field rules

- Items.ItemID identifies a menu item; Active is Yes/No. WeightG is grams per portion; empty/zero suppresses its weight badge. No inventory deduction is implemented.
- Orders contains multiple rows per OrderID. Do not count rows as orders. Product names/prices are captured with the sale.
- Normal line Total is Qty × UnitPrice. The `ADJUSTMENT` row has name `Adjusted amount`, Qty 0, and Total equal to the add-on. Its UnitPrice also carries that amount.
- New orders use Closed status. Imported records can contain Completed. Reports exclude status Cancelled; all other stored statuses are currently treated as sales.
- Online/Offline are payment labels, not proof of settlement through a bank or gateway.
- StoreSessions links sales to a business day and shift. Current session choices are Morning, Evening and Other. An open session older than 18 hours is flagged stale.
- Expenses classifications are Operating/Investment. Funding fields track the recorded payer/owner/advance state; purchase cost remains Amount.
- Settlements.ExpenseID links a return to its expense. RequestLog.ClientRequestID maps retries to the same saved order.

## Relationships

```text
Items.ItemID          → Orders.ItemID (historical snapshot; adjustments are special)
StoreSessions.SessionID → Orders.SessionID / Expenses.SessionID
Orders.OrderID        ← RequestLog.OrderID
Expenses.ExpenseID    ← Settlements.ExpenseID
BusinessDate          → daily report and summary keys
```

These are application relationships, not enforced relational foreign keys. Direct sheet edits can violate them. Avoid changing IDs or column order manually.

## Derived tabs

| Tab | Columns / meaning |
|---|---|
| OrderIndex | OrderID, OrderJSON — one full History order per row |
| DailyReports | BusinessDate, ReportJSON — report details for one date |
| DailySummary | Date, Orders, Dishes, Sales, BestSeller, ItemJSON, UpdatedAt, OnlineSales, OfflineSales |
| MonthlySummary | Month, Orders, Dishes, Sales, BestSeller, ItemJSON, UpdatedAt, OnlineSales, OfflineSales |
| YearlySummary | Year, Orders, Dishes, Sales, BestSeller, ItemJSON, UpdatedAt, OnlineSales, OfflineSales |
| ExpenseSummary | Period, Sales, OperatingExpense, InvestmentExpense, TotalExpense, OperatingProfit, NetCashProfit, OnlineExpense, OfflineExpense |

Do not store unique manual information in derived rows. Refresh can rewrite/clear stale rows. An individual JSON payload larger than the configured 45,000-character guard stops refresh rather than truncating data.

## Calculations

Sales sum non-cancelled Orders.Total, including adjustment rows. Orders count distinct non-cancelled OrderID. Dishes sum Qty. Bestseller ranks product quantity, then product sales, excluding ADJUSTMENT. Total expense sums Expenses.Amount; operating/investment and payment splits follow the corresponding stored labels. Profit formulas are in [01](01-BRD.md).

## State outside the workbook

| Store | Main contents |
|---|---|
| Script Properties | `dirty-day-YYYY-MM-DD`, read-model version/update/error, History index count/sales, backup/recovery status, order sequence counters |
| Script Cache | Menu, settings, open session, response caches and read-cache version |
| Browser localStorage | `sb.cart`, `sb.openOrders`, `sb.activeOrderId`, `sb.payment`, `sb.itemView`, `sb.orderOutbox`, `sb.requestTimings` |

Browser state is device/origin-specific. Read models and cache can be regenerated; an unsynced browser outbox cannot be recovered from the production workbook because its sale has not reached the server yet.
