"use client";

import { useState } from "react";
import { runBackupNow } from "./actions";

export default function BackupButton() {
  const [running, setRunning] = useState(false);

  return (
    <button
      type="button"
      disabled={running}
      onClick={async () => {
        setRunning(true);
        try {
          const res = await runBackupNow();
          alert(res.message);
          window.location.reload();
        } catch (e) {
          alert(e instanceof Error ? e.message : "Backup failed");
        } finally {
          setRunning(false);
        }
      }}
      className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
    >
      {running ? "Backing up…" : "Back Up Now"}
    </button>
  );
}
