function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type LedgerRow = {
  id: number;
  type: string;
  amount: number;
  note: string | null;
  created_at: string;
};

type Customer = {
  name: string;
  phone: string | null;
  address: string | null;
  balance: number;
};

function fmtBalance(bal: number): string {
  if (bal > 0.001) return `Credit $${bal.toFixed(2)}`;
  if (bal < -0.001) return `Debt $${Math.abs(bal).toFixed(2)}`;
  return "Settled";
}

function buildBody(customer: Customer, ledger: LedgerRow[], storeName: string, storeAddress: string, storePhone: string): string {
  const today = new Date().toLocaleDateString("en-GB");

  let running = 0;
  const rows = ledger
    .map((l) => {
      running += Number(l.amount);
      const amt = Number(l.amount);
      const charge = amt < 0 ? Math.abs(amt) : 0;
      const payment = amt > 0 ? amt : 0;
      return `<tr>
        <td>${new Date(l.created_at).toLocaleDateString("en-GB")}</td>
        <td>${esc(l.note || l.type)}</td>
        <td class="ta-r">${charge > 0 ? `$${charge.toFixed(2)}` : ""}</td>
        <td class="ta-r">${payment > 0 ? `$${payment.toFixed(2)}` : ""}</td>
        <td class="ta-r fw-b">${fmtBalance(running)}</td>
      </tr>`;
    })
    .join("");

  const totalCharges = ledger.filter((l) => Number(l.amount) < 0).reduce((s, l) => s + Math.abs(Number(l.amount)), 0);
  const totalPayments = ledger.filter((l) => Number(l.amount) > 0).reduce((s, l) => s + Number(l.amount), 0);

  return `
    <div class="center mb-3">
      <div class="fw-b fs-lg brand">${esc(storeName)}</div>
      ${storeAddress ? `<div class="muted small">${esc(storeAddress)}</div>` : ""}
      ${storePhone ? `<div class="muted small">${esc(storePhone)}</div>` : ""}
      <div class="fw-b mt-2 fs-lg">CUSTOMER STATEMENT</div>
      <div class="muted small mt-1">Generated ${today}</div>
    </div>
    <hr>
    <div class="row mt-1"><span class="fw-b">${esc(customer.name)}</span><span></span></div>
    ${customer.phone ? `<div class="row small muted"><span>${esc(customer.phone)}</span><span></span></div>` : ""}
    ${customer.address ? `<div class="row small muted"><span>${esc(customer.address)}</span><span></span></div>` : ""}
    <hr>
    <table class="items">
      <thead><tr><th>Date</th><th>Description</th><th class="ta-r">Charge</th><th class="ta-r">Payment</th><th class="ta-r">Balance</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="center muted">No transactions.</td></tr>`}</tbody>
    </table>
    <hr>
    <div class="row small"><span>Total Charges</span><span>$${totalCharges.toFixed(2)}</span></div>
    <div class="row small"><span>Total Payments</span><span>$${totalPayments.toFixed(2)}</span></div>
    <div class="row fw-b fs-lg mt-2"><span>Current Balance</span><span>${fmtBalance(Number(customer.balance))}</span></div>
  `;
}

const STATEMENT_CSS = `
  @page { margin: 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #111; max-width: 100%; margin: 0 auto; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items th { font-size: 12px; border-bottom: 1px solid #333; padding: 5px 4px; text-align: left; }
  table.items td { font-size: 12px; padding: 5px 4px; border-bottom: 1px dashed #ddd; vertical-align: top; }
  .ta-r { text-align: right; } .center { text-align: center; }
  .fw-b { font-weight: bold; } .fs-lg { font-size: 18px; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
  .small { font-size: 11px; } .muted { color: #666; } .mt-1{margin-top:4px} .mt-2{margin-top:8px} .mt-3{margin-top:16px} .mb-3{margin-bottom:12px}
  .brand { color: #2d5a2d; font-size: 20px; }
`;

export function printCustomerStatement(customer: Customer, ledger: LedgerRow[], storeName: string, storeAddress: string, storePhone: string) {
  const body = buildBody(customer, ledger, storeName, storeAddress, storePhone);
  const win = window.open("", "_blank", "width=650,height=800");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Statement — ${esc(customer.name)}</title>
    <style>${STATEMENT_CSS}</style></head><body>${body}
    <script>window.onload=function(){window.print();}</script>
    </body></html>`);
  win.document.close();
}
