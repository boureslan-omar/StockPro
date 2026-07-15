"use client";

import { useState } from "react";
import { disconnectGoogleDrive } from "./actions";

export default function DisconnectGoogleDriveButton() {
  const [running, setRunning] = useState(false);

  return (
    <button
      type="button"
      disabled={running}
      onClick={async () => {
        if (!confirm("Disconnect Google Drive? Future backups will only be saved to built-in storage.")) return;
        setRunning(true);
        try {
          await disconnectGoogleDrive();
          window.location.reload();
        } catch (e) {
          alert(e instanceof Error ? e.message : "Failed to disconnect");
          setRunning(false);
        }
      }}
      className="rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-50 text-sm font-medium px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
    >
      {running ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
