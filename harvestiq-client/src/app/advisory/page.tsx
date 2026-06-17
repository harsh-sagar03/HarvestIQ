"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { AdvisoryChat } from "@/components/AdvisoryChat";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/stores/localizationStore";

function AdvisoryPageContent() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const farm = useAuthStore((state) => state.farm);

  return (
    <AppShell
      userName={user?.name}
      pageTitle={t("advisory.pageTitle", "Advisory")}
      pageSubtitle={t("advisory.pageSubtitle", "Context-bound farm guidance powered by compiled intelligence")}
      showBack={{ href: "/", label: t("common.dashboard", "Dashboard") }}
      narrow
    >
      {farm?.farm_id ? (
        <AdvisoryChat farmId={farm.farm_id} language={user?.preferred_lang ?? "hi"} />
      ) : (
        <p className="text-sm text-slate-600">{t("advisory.completeOnboarding", "Complete onboarding to use advisory.")}</p>
      )}
    </AppShell>
  );
}

export default function AdvisoryPage() {
  return (
    <AuthGuard requireOnboarding>
      <AdvisoryPageContent />
    </AuthGuard>
  );
}
