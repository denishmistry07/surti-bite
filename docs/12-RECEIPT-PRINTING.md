# Receipt printing

## Setup

Publish the updated frontend, including `js/receipts.js`, and update/deploy `Code.gs` for the fast receipt response and shared print-settings action. In Settings → Receipt printing, enable Show bill after saving, choose 58mm thermal, 80mm thermal or A4, choose Customer bill or Kitchen slip, and enter shop details/footer. Save print settings. The enabled flag is stored in Settings as `PrintBillEnabled` (Yes/No), default No. Other devices apply it when bootstrap reloads settings; there is no push synchronization. Paper size, receipt type and shop/address/phone/footer preferences remain browser-local. An old local enabled flag is ignored. Shared-setting saving requires the updated backend and a connection; failure is shown instead of reporting success.

## Checkout

Disabled: existing checkout flow remains. Enabled: a new order is queued/saved as before, and its receipt opens in a right-side drawer after successful server acknowledgment. The updated backend returns validated line details with its save/update response, eliminating a second request. Older deployments and duplicate acknowledgments fall back to a History lookup. History reprints use the already loaded order. The drawer offers Print bill, Continue, ×, outside-click dismissal and Escape. Printing invokes the device's browser print dialog; select the printer and matching paper size there. Save as PDF is available if the browser provides it. Cancelling the print dialog or closing the drawer does not cancel or repeat the sale.

Offline sales do not print a final receipt until synchronization succeeds. A receipt lookup failure leaves the sale saved; use Print on its History card to retry. No separate print retry submits a new sale. When several queued orders sync, previews can be queued for review. A reload can dismiss an unprinted preview; History remains the reprint route. Updated saved orders also open a receipt when enabled. Cancelled History orders do not expose Print.

## Contents

Customer bills include shop details, saved order ID/date/business date, order type/reference, items, quantity, calculated unit rate, amounts, adjustment, total, payment and dish count. Details come from a confirmed save response or saved History, not an unconfirmed browser cart. A kitchen slip omits prices, payment, adjustment-only rows and customer footer. These are ordinary receipts, not a certified GST tax-invoice implementation.

## Printer compatibility

Thermal templates use the selected width with internal padding. A4 uses a standard page layout. Thermal paper length is printer/driver-controlled; the app does not force a fixed roll length. The print dialog and printer driver must agree with the selected paper width. Disable browser-generated headers/footers if they appear on the receipt. Physical print quality, cutter behavior and margins require testing with the actual printer/device. Silent printing, ESC/POS commands, printer discovery and automatic paper cutting are not included.

## Validation

Run `node tests/receipts.test.cjs`. Before operational use, check disabled flow, enabled save, update, History reprint, offline synchronization, ₹100+₹20 adjustment=₹120, kitchen prices omitted, long names, each paper size, Print cancellation and Continue. Test on the actual operator phone/computer and printer; local rendering does not establish hardware compatibility.
