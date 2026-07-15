import { Suspense } from "react";
import { SectionsSkeleton } from "@/components/skeletons";
import SettingsData from "./settings-data";
import GdriveStatusBanner from "./gdrive-status-banner";

export default function SettingsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <Suspense fallback={null}>
        <GdriveStatusBanner />
      </Suspense>
      <Suspense fallback={<SectionsSkeleton sections={4} />}>
        <SettingsData />
      </Suspense>
    </div>
  );
}
