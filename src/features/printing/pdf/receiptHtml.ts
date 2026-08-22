import { formatCurrency } from '@/lib/currencies';
import { receiptDate, timeLabel } from '@/lib/date';
import { orderNumberLabel } from '@/lib/format';

import { ReceiptData } from '../templates/receipt.template';

/** Minimal HTML escaping — store and product names are user-supplied. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a receipt as printable HTML for expo-print.
 *
 * This is the iOS fallback: a Classic Bluetooth printer cannot be reached from
 * iOS without MFi certification, so on those setups the receipt goes to
 * AirPrint or the share sheet instead.
 *
 * It also replaces the web app's jsPDF invoice, whose `formatCurrency` hardcodes
 * USD regardless of the store's currency, and whose download helper calls
 * `.save()` on a void return and throws — which is why every caller of it is
 * commented out.
 */
export function receiptToHtml(data: ReceiptData): string {
  const money = (amount: number) => escapeHtml(formatCurrency(amount, data.currency));

  const itemRows = data.items
    .map((item) => {
      const lineTotal = item.unitPrice * item.quantity;
      const discountRow =
        item.discount > 0
          ? `<tr class="discount"><td colspan="2">less discount</td><td class="right">-${money(item.discount)}</td></tr>`
          : '';

      return `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td class="center">${item.quantity}</td>
          <td class="right">${money(lineTotal)}</td>
        </tr>
        ${discountRow}`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    /* Sized for an 80mm roll; AirPrint scales it to whatever paper is loaded. */
    @page { margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      color: #0F172A;
      margin: 0;
      font-size: 12px;
      max-width: 320px;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    h1 { font-size: 16px; margin: 0 0 4px; letter-spacing: 0.5px; }
    .muted { color: #6B7280; font-size: 11px; }
    .rule { border-top: 1px dashed #9CA3AF; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #6B7280;
      padding-bottom: 4px;
    }
    td { padding: 3px 0; vertical-align: top; }
    tr.discount td { color: #10B77F; font-size: 11px; padding-top: 0; }
    .meta td { padding: 2px 0; }
    .meta td:first-child { color: #6B7280; }
    .total { font-size: 15px; font-weight: 700; }
    .reprint {
      font-weight: 700;
      letter-spacing: 1px;
      margin: 6px 0;
    }
    footer { margin-top: 14px; }
  </style>
</head>
<body>
  <div class="center">
    <h1>${escapeHtml(data.store.name.toUpperCase())}</h1>
    ${data.store.address ? `<div class="muted">${escapeHtml(data.store.address)}</div>` : ''}
    ${data.store.phone ? `<div class="muted">Tel: ${escapeHtml(data.store.phone)}</div>` : ''}
    ${data.isReprint ? '<div class="reprint">*** REPRINT ***</div>' : ''}
  </div>

  <div class="rule"></div>

  <table class="meta">
    <tr><td>Invoice #</td><td class="right">${escapeHtml(orderNumberLabel(data.invoiceNumber))}</td></tr>
    <tr><td>Date</td><td class="right">${receiptDate(data.date)} ${timeLabel(data.date)}</td></tr>
    <tr><td>Customer</td><td class="right">${escapeHtml(data.customerName || 'Walk-in')}</td></tr>
    <tr><td>Dispatch by</td><td class="right">${escapeHtml(data.dispatchedBy)}</td></tr>
  </table>

  <div class="rule"></div>

  <table>
    <thead>
      <tr><th>Item</th><th class="center">Qty</th><th class="right">Amount</th></tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="rule"></div>

  <table class="meta">
    <tr><td>Subtotal</td><td class="right">${money(data.rawSubtotal)}</td></tr>
    ${data.totalDiscount > 0 ? `<tr><td>Discount</td><td class="right">- ${money(data.totalDiscount)}</td></tr>` : ''}
    ${data.tax > 0 ? `<tr><td>Tax</td><td class="right">${money(data.tax)}</td></tr>` : ''}
    <tr class="total"><td>Total</td><td class="right">${money(data.total)}</td></tr>
    ${data.paymentMethod ? `<tr><td>Payment</td><td class="right">${escapeHtml(data.paymentMethod)}</td></tr>` : ''}
  </table>

  <div class="rule"></div>

  <footer class="center">
    <div><strong>** THANK YOU! **</strong></div>
    <div class="muted">Visit Again :)</div>
    <div class="muted" style="margin-top:8px">tapntrade.store</div>
  </footer>
</body>
</html>`;
}
