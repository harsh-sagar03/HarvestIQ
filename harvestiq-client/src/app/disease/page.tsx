"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { DiseaseCapture } from "@/components/DiseaseCapture";
import { AppShell } from "@/components/layout/AppShell";
import { RadarMap } from "@/components/RadarMap";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/stores/localizationStore";

function DiseasePageContent() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const farm = useAuthStore((state) => state.farm);

  return (
    <AppShell
      userName={user?.name}
      pageTitle={t("disease.pageTitle", "Disease Detection")}
      pageSubtitle={t("disease.pageSubtitle", "Vision screening with deterministic validation and outbreak radar")}
      showBack={{ href: "/", label: t("common.dashboard", "Dashboard") }}
      narrow
    >
      {farm?.farm_id ? (
        <div className="space-y-4">
          <DiseaseCapture farmId={farm.farm_id} />
          <RadarMap farmId={farm.farm_id} cropType={farm.crop_type} />
        </div>
      ) : (
        <p className="text-sm text-slate-600">{t("disease.completeOnboarding", "Complete onboarding to use disease detection.")}</p>
      )}
    </AppShell>
  );
}

export default function DiseasePage() {
  return (
    <AuthGuard requireOnboarding>
      <DiseasePageContent />
    </AuthGuard>
  );
}
