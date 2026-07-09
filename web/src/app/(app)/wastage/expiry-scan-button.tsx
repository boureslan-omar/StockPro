"use client";

import { useState } from "react";
import { runExpiryScanNow } from "./actions";

export default function ExpiryScanButton() {
  const [running, setRunning] = useState(false);

  return (
    <button
      type="button"
      disabled={running}
      onClick={async () => {
        setRunning(true);
        try {
          const res = await runExpiryScanNow();
          alert(res.message);
        } catch (e) {
          alert(e instanceof Error ? e.message : "Failed to run expiry scan");
        } finally {
          setRunning(false);
        }
      }}
      className="rounded-lg border border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 text-sm font-medium px-4 py-2"
    >
      {running ? "Scanning…" : "Run Expiry Scan Now"}
    </button>
  );
}
