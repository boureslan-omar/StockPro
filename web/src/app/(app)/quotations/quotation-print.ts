function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Item = { product_name: string; quantity: number; unit_price: number; total: number; unit: string | null };
type Quote = {
  quote_number: string;
  created_at: string;
  valid_until: string | null;
  customer_name: string | null;
  note: string | null;
};

function buildBody(quote: Quote, items: Item[], storeName: string, storeAddress: string, storePhone: string): string {
  const date = new Date(quote.created_at);
  const total = items.reduce((s, it) => s + Number(it.total), 0);

  const rows = items
    .map(
      (it) => `<tr>
        <td>${esc(it.product_name)}</td>
        <td class="ta-r">${Number(it.quantity)} ${esc(it.unit || "")}</td>
        <td class="ta-r">$${Number(it.unit_price).toFixed(2)}</td>
        <td class="ta-r fw-b">$${Number(it.total).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
    <div class="center mb-3">
      <div class="fw-b fs-lg brand">${esc(storeName)}</div>
      ${storeAddress ? `<div class="muted small">${esc(storeAddress)}</div>` : ""}
      ${storePhone ? `<div class="muted small">${esc(storePhone)}</div>` : ""}
      <div class="fw-b mt-2 fs-lg">QUOTATION</div>
      <div class="fw-b mt-1">${esc(quote.quote_number)}</div>
      <div class="small muted">${date.toLocaleDateString("en-GB")}</div>
      ${quote.customer_name ? `<div class="small mt-1">For: <strong>${esc(quote.customer_name)}</strong></div>` : ""}
      ${quote.valid_until ? `<div class="small muted">Valid until: ${esc(quote.valid_until)}</div>` : ""}
    </div>
    <hr>
    <table class="items">
      <thead><tr><th>Item</th><th class="ta-r">Qty</th><th class="ta-r">Price</th><th class="ta-r">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <hr>
    <div class="row fw-b fs-lg mt-2"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>
    ${quote.note ? `<div class="small muted mt-2">Note: ${esc(quote.note)}</div>` : ""}
    <div class="center small muted mt-3">This is an estimate, not an invoice. Prices may change.</div>
  `;
}

const QUOTATION_CSS = `
  @page { margin: 10mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #111; max-width: 100%; margin: 0 auto; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items th { font-size: 12px; border-bottom: 1px solid #333; padding: 4px 2px; text-align: left; }
  table.items td { font-size: 12px; padding: 4px 2px; border-bottom: 1px dashed #ddd; vertical-align: top; }
  .ta-r { text-align: right; } .center { text-align: center; }
  .fw-b { font-weight: bold; } .fs-lg { font-size: 18px; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
  .small { font-size: 11px; } .muted { color: #666; } .mt-1{margin-top:4px} .mt-2{margin-top:8px} .mt-3{margin-top:16px} .mb-3{margin-bottom:12px}
  .brand { color: #2d5a2d; font-size: 20px; }
`;

export function printQuotationWindow(quote: Quote, items: Item[], storeName: string, storeAddress: string, storePhone: string) {
  const body = buildBody(quote, items, storeName, storeAddress, storePhone);
  const win = window.open("", "_blank", "width=480,height=700");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Quotation ${esc(quote.quote_number)}</title>
    <style>${QUOTATION_CSS}</style></head><body>${body}
    <script>window.onload=function(){window.print();}</script>
    </body></html>`);
  win.document.close();
}
