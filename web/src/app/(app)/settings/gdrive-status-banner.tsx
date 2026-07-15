"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function GdriveStatusBanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const connected = searchParams.get("gdrive_connected");
  const error = searchParams.get("gdrive_error");

  useEffect(() => {
    if (connected || error) {
      // Strip the query param once shown so a later refresh of this same
      // URL doesn't keep re-displaying a stale connect/error result.
      router.replace("/settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!connected && !error) return null;

  return connected ? (
    <p className="text-sm bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 rounded-lg px-3 py-2 mb-4">
      Google Drive connected — future backups will be copied there too.
    </p>
  ) : (
    <p className="text-sm bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 mb-4">
      Couldn&apos;t connect Google Drive: {error}
    </p>
  );
}
