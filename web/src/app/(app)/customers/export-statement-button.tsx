"use client";

import { useState } from "react";
import { getCustomerStatementData } from "./actions";
import { printCustomerStatement } from "./statement-print";

export default function ExportStatementButton({ customerId }: { customerId: number }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const { customer, ledger, settings } = await getCustomerStatementData(customerId);
      if (!customer) throw new Error("Customer not found.");
      printCustomerStatement(
        customer,
        ledger,
        settings.store_name || "StockPro",
        settings.store_address || "",
        settings.store_phone || ""
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to export statement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
    >
      {loading ? "Preparing…" : "Export Statement"}
    </button>
  );
}
