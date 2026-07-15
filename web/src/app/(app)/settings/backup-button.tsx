"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
      className="inline-flex items-center gap-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-70 text-white text-sm font-medium px-4 py-2"
    >
      {running && <Loader2 className="h-4 w-4 animate-spin" />}
      {running ? "Backing up…" : "Back Up Now"}
    </button>
  );
}
