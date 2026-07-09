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

const A4_CSS = `
  @page { size: A4; margin: 20mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #111; max-width: 170mm; margin: 0 auto; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items th { font-size: 13px; border-bottom: 2px solid #333; padding: 6px 4px; text-align: left; }
  table.items td { font-size: 13px; padding: 6px 4px; border-bottom: 1px solid #eee; }
  .ta-r { text-align: right; } .center { text-align: center; }
  .fw-b { font-weight: bold; } .fs-lg { font-size: 20px; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  hr { border: none; border-top: 1px solid #ccc; margin: 10px 0; }
  .small { font-size: 12px; } .muted { color: #666; } .mt-1{margin-top:4px} .mt-2{margin-top:8px} .mt-3{margin-top:16px} .mb-3{margin-bottom:16px}
  .brand { color: #2d5a2d; font-size: 22px; }
`;

const THERMAL_CSS = `
  @page { size: 80mm auto; margin: 3mm 4mm; }
  body { font-family: "Courier New", Courier, monospace; font-size: 12px; width: 72mm; margin: 0; color: #000; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { font-size: 11px; border-bottom: 1px dashed #000; padding: 2px 0; text-align: left; }
  table.items td { font-size: 11px; padding: 2px 0; vertical-align: top; }
  .ta-r { text-align: right; } .center { text-align: center; }
  .fw-b { font-weight: bold; } .fs-lg { font-size: 14px; }
  .row { display: flex; justify-content: space-between; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .small { font-size: 10px; } .muted { color: #555; } .mt-1{margin-top:2px} .mt-2{margin-top:4px} .mt-3{margin-top:8px} .mb-3{margin-bottom:8px}
  .brand { color: #2d5a2d; }
`;

export function printQuotationWindow(
  quote: Quote,
  items: Item[],
  format: "thermal" | "a4",
  storeName: string,
  storeAddress: string,
  storePhone: string
) {
  const body = buildBody(quote, items, storeName, storeAddress, storePhone);
  const css = format === "thermal" ? THERMAL_CSS : A4_CSS;
  const win = window.open("", "_blank", format === "thermal" ? "width=320,height=600" : "width=800,height=1000");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Quotation ${esc(quote.quote_number)}</title>
    <style>${css}</style></head><body>${body}
    <script>window.onload=function(){window.print();}</script>
    </body></html>`);
  win.document.close();
}
