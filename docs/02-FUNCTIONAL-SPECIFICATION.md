# Functional specification

## Startup and navigation

The browser loads static HTML, CSS and JavaScript, binds controls, restores local open orders, and requests bootstrap data. Bootstrap supplies settings, active products and the current session. Optional navigation buttons start hidden and are revealed according to saved settings. A view loader indicates remote work. Order, Menu and Settings are always available.

## Order entry

Staff open a store session, select products by category or search, and change quantity through steppers. Grid/list presentation is stored on the device. Selected cards have a green border/background; product weight is shown in a prominent badge and updates with quantity. An unselected weighted card shows the per-portion weight.

The expandable cart displays selected items, quantities, line totals, an adjusted-amount field, total dishes and payable amount. The compact save area continues to show payable amount when details are collapsed. Staff select Online/Offline payment and Dine-in/Takeaway. A reference field is available only when configured.

Multiple open orders are device-local. Each keeps its own cart, adjustment, payment, type and reference. Discarding a populated open order asks for confirmation. Clearing the active cart resets its adjustment.

### Save and synchronization

1. Validate that the order has products and a session is open.
2. Generate a client request ID and write the pending payload to the browser outbox.
3. Close the local open order and begin synchronization.
4. The server validates products and writes line rows plus a request-log mapping.
5. On success the client removes the matching queued payload. On failure it keeps the payload and schedules retry.

A local-save notification is not server confirmation. The persistent sync banner identifies pending, offline, syncing and failed states and offers Retry. Browser storage must remain intact until synchronization completes.

## Saved orders and History

History supports paging, free-text query, business-date range, payment, type, status, amount bounds and sorting. Default pages contain 20 complete orders. Cancelled cards are identified visually. A cancellation changes status; deletion removes source rows and associated request-log entries.

Edit opens a separate local editable cart and preserves the current open orders. It loads retained products at original prices and carries the adjustment. Update order submits directly to the backend; it does not use the new-sale offline outbox. Errors keep the editable cart available. Cancelled orders cannot be edited. Products no longer active can prevent editing and require administrator review.

## Menu administration

Staff can add/edit/delete menu items, including ID, name, category, price, active flag, sort order, image URL, description and weight in grams. Category suggestions come from managed menu items. Deactivating a product removes it from the ordering catalogue. Menu changes do not rewrite historical sales.

## Expenses and advances

Expenses contain business date, Operating/Investment classification, frequency, category, description, amount, payment and optional vendor/notes. Funding details include payer, settlement type, fund owner and remaining funds. Expense edit preserves creation time; moving the business date invalidates both affected periods. Settlements link a return amount and parties to an expense. They are not counted as a second purchase expense in report formulas.

## Reports

Today and day/month/year reports show sales, orders, dishes, product performance, payment splits, sessions, order types, expense categories and profit calculations. Reports exclude cancelled orders and include adjusted amounts in sales. PDF export generates a Drive file. All-time totals are available in the expense view. Manual changes to source tabs are reconciled by the daily job or a manual reconciliation.

## Settings and operational status

Settings controls Today, Reports, History and Expenses visibility. The operational card shows last summary refresh, queued dates, recorded errors, verified backup time and recovery-check time. Refresh explicitly requests new status; the UI does not continuously poll. Recent request timing samples remain in the browser.

## Error handling boundaries

Remote reads can time out or fail. New queued sales retry; saved-order edits and other mutations require explicit retry after reviewing the result. Idempotency protection is implemented for new-order requests, not universally for all mutation actions. Local storage quota/private browsing/device loss can affect unsynced orders.
