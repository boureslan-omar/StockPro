import { Suspense } from "react";
import { SectionsSkeleton } from "@/components/skeletons";
import SettingsData from "./settings-data";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gdrive_connected?: string; gdrive_error?: string }>;
}) {
  const { gdrive_connected, gdrive_error } = await searchParams;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      {gdrive_connected && (
        <p className="text-sm bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 rounded-lg px-3 py-2 mb-4">
          Google Drive connected — future backups will be copied there too.
        </p>
      )}
      {gdrive_error && (
        <p className="text-sm bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 mb-4">
          Couldn&apos;t connect Google Drive: {gdrive_error}
        </p>
      )}
      <Suspense fallback={<SectionsSkeleton sections={4} />}>
        <SettingsData />
      </Suspense>
    </div>
  );
}
