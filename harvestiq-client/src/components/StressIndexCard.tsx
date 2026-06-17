"use client";

import { Activity } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useStressIndex } from "@/hooks/useStressIndex";
import { fsiSeverity, SEVERITY_STYLES } from "@/lib/dashboard-theme";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/stores/localizationStore";

type StressIndexCardProps = {
  farmId?: string | null;
};

export function StressIndexCard({ farmId }: StressIndexCardProps) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useStressIndex(farmId);

  if (!farmId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>{t("errorBoundary.title.stressIndex", "Field Stress Index")}</CardTitle>
          <CardDescription>{t("stress.calculating", "Calculating stress…")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>{t("errorBoundary.title.stressIndex", "Field Stress Index")}</CardTitle>
          <CardDescription className="text-amber-700">
            {t("stress.unavailable", "Stress index unavailable — last calculated values shown when cached.")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const severity = fsiSeverity(data.classification);
  const styles = SEVERITY_STYLES[severity];
  const components = [
    { label: t("stress.thermal", "Thermal"), value: data.components.temp_stress, color: "#f59e0b" },
    { label: t("stress.moisture", "Moisture"), value: data.components.rainfall_deficit, color: "#0ea5e9" },
    { label: "GDD", value: data.components.gdd_scale, color: "#10b981" },
  ];

  return (
    <Card className="dashboard-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <p className="dashboard-section-title mb-1">{t("stress.analytics", "Stress Analytics")}</p>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Activity className="h-5 w-5" style={{ color: styles.accent }} />
            {t("errorBoundary.title.stressIndex", "Field Stress Index")}
          </CardTitle>
          <CardDescription>
            {t("crop." + data.crop_type.toLowerCase(), data.crop_type)} · {data.stage}
          </CardDescription>
        </div>
        <Badge severity={severity}>{t(data.classification, data.classification.replace(/_/g, " "))}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <span className="text-5xl font-bold tracking-tight text-slate-900">{data.fsi.toFixed(2)}</span>
          <span className="pb-2 text-sm font-medium text-slate-500">/ 1.00 FSI</span>
          <div className="mb-2 ml-auto h-3 flex-1 max-w-[200px] overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${data.fsi * 100}%`, backgroundColor: styles.accent }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {components.map((comp) => (
            <div key={comp.label} className="rounded-xl border border-slate-100 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{comp.label}</p>
                <span className="text-sm font-bold text-slate-900">{comp.value.toFixed(2)}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${comp.value * 100}%`, backgroundColor: comp.color }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className={cn("rounded-xl border p-4 text-sm", styles.border, styles.bg)}>
          <p className="font-semibold text-slate-900">{t("stress.whyThisScore", "Why this score?")}</p>
          <p className="mt-1 text-slate-700">{data.explanation.summary}</p>
        </div>
      </CardContent>
    </Card>
  );
}
