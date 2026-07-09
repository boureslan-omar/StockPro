import { fmtUSD, fmtLBP } from "@/lib/format";

type ReceiptItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  products: { units_per_box: number } | null;
};

type ReceiptSale = {
  receipt_no: string;
  sale_date: string;
  subtotal: number;
  discount: number;
  credit_used: number;
  total: number;
  paid_usd: number;
  paid_lbp: number;
  change_usd: number;
  change_lbp: number;
  exchange_rate_used: number;
  is_void: boolean;
  customers: { name: string } | null;
};

function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function itemsRows(items: ReceiptItem[]): string {
  return items
    .map((it) => {
      const upb = it.products?.units_per_box ?? 1;
      const priceCell =
        upb > 1
          ? `$${Number(it.unit_price).toFixed(2)}/u | $${(Number(it.unit_price) * upb).toFixed(2)}/b`
          : `$${Number(it.unit_price).toFixed(2)}`;
      return `<tr>
        <td>${esc(it.product_name)}</td>
        <td class="ta-r">${Number(it.quantity)}</td>
        <td class="ta-r">${priceCell}</td>
        <td class="ta-r fw-b">$${Number(it.total).toFixed(2)}</td>
      </tr>`;
    })
    .join("");
}

function buildBody(sale: ReceiptSale, items: ReceiptItem[], storeName: string, storeAddress: string, storePhone: string): string {
  const rate = Number(sale.exchange_rate_used) || 1;
  const date = new Date(sale.sale_date);
  const dateStr = date.toLocaleDateString("en-GB") + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return `
    <div class="center mb-3">
      <div class="fw-b fs-lg brand">${esc(storeName)}</div>
      ${storeAddress ? `<div class="muted small">${esc(storeAddress)}</div>` : ""}
      ${storePhone ? `<div class="muted small">${esc(storePhone)}</div>` : ""}
      <div class="muted small mt-1">${dateStr}</div>
      <div class="fw-b mt-1">Invoice: ${esc(sale.receipt_no)}</div>
      ${sale.customers?.name ? `<div class="small">Customer: <strong>${esc(sale.customers.name)}</strong></div>` : ""}
      ${sale.is_void ? '<div class="badge">VOIDED</div>' : ""}
    </div>
    <hr>
    <table class="items">
      <thead><tr><th>Item</th><th class="ta-r">Qty</th><th class="ta-r">Price</th><th class="ta-r">Total</th></tr></thead>
      <tbody>${itemsRows(items)}</tbody>
    </table>
    <hr>
    <div class="row"><span>Subtotal</span><span>$${Number(sale.subtotal).toFixed(2)}</span></div>
    ${Number(sale.discount) > 0 ? `<div class="row muted"><span>Discount</span><span>-$${Number(sale.discount).toFixed(2)}</span></div>` : ""}
    ${Number(sale.credit_used) > 0 ? `<div class="row muted"><span>Credit Applied</span><span>-$${Number(sale.credit_used).toFixed(2)}</span></div>` : ""}
    <div class="row fw-b fs-lg mt-2"><span>TOTAL</span><span>$${Number(sale.total).toFixed(2)}</span></div>
    <div class="row small muted"><span></span><span>${fmtLBP(Number(sale.total) * rate)}</span></div>
    ${Number(sale.paid_usd) > 0 ? `<div class="row small mt-1"><span>Paid (USD)</span><span>${fmtUSD(sale.paid_usd)}</span></div>` : ""}
    ${Number(sale.paid_lbp) > 0 ? `<div class="row small"><span>Paid (LBP)</span><span>${fmtLBP(sale.paid_lbp)}</span></div>` : ""}
    ${Number(sale.change_usd) > 0 ? `<div class="row fw-b" style="color:#16a34a"><span>Change (USD)</span><span>${fmtUSD(sale.change_usd)}</span></div>` : ""}
    ${Number(sale.change_lbp) > 0 ? `<div class="row fw-b" style="color:#16a34a"><span>Change (LBP)</span><span>${fmtLBP(sale.change_lbp)}</span></div>` : ""}
    <div class="center small muted mt-3">Thank you!</div>
  `;
}

const THERMAL_CSS = `
  @page { size: 80mm auto; margin: 3mm 4mm; }
  body { font-family: "Courier New", Courier, monospace; font-size: 12px; width: 72mm; margin: 0; color: #000; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { font-size: 11px; border-bottom: 1px dashed #000; padding: 2px 0; text-align: left; }
  table.items td { font-size: 11px; padding: 2px 0; vertical-align: top; }
  .ta-r { text-align: right; } .center { text-align: center; }
  .fw-b { font-weight: bold; } .fs-lg { font-size: 14px; }
  .row { display: flex; justify-content: space-between; }
  .badge { display: inline-block; border: 1px solid #000; padding: 1px 6px; font-weight: bold; font-size: 11px; margin-top: 4px; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .small { font-size: 10px; } .muted { color: #555; } .mt-1{margin-top:2px} .mt-2{margin-top:4px} .mt-3{margin-top:8px} .mb-3{margin-bottom:8px}
  .brand { color: #2d5a2d; }
`;

const A4_CSS = `
  @page { size: A4; margin: 20mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #111; max-width: 170mm; margin: 0 auto; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items th { font-size: 13px; border-bottom: 2px solid #333; padding: 6px 4px; text-align: left; }
  table.items td { font-size: 13px; padding: 6px 4px; border-bottom: 1px solid #eee; }
  .ta-r { text-align: right; } .center { text-align: center; }
  .fw-b { font-weight: bold; } .fs-lg { font-size: 20px; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .badge { display: inline-block; border: 2px solid #c00; color: #c00; padding: 2px 10px; font-weight: bold; margin-top: 6px; }
  hr { border: none; border-top: 1px solid #ccc; margin: 10px 0; }
  .small { font-size: 12px; } .muted { color: #666; } .mt-1{margin-top:4px} .mt-2{margin-top:8px} .mt-3{margin-top:16px} .mb-3{margin-bottom:16px}
  .brand { color: #2d5a2d; font-size: 22px; }
`;

export function printReceiptWindow(
  sale: ReceiptSale,
  items: ReceiptItem[],
  format: "thermal" | "a4",
  storeName: string,
  storeAddress: string,
  storePhone: string
) {
  const body = buildBody(sale, items, storeName, storeAddress, storePhone);
  const css = format === "thermal" ? THERMAL_CSS : A4_CSS;
  const win = window.open("", "_blank", format === "thermal" ? "width=320,height=600" : "width=800,height=1000");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${esc(sale.receipt_no)}</title>
    <style>${css}</style></head><body>${body}
    <script>window.onload=function(){window.print();}</script>
    </body></html>`);
  win.document.close();
}
