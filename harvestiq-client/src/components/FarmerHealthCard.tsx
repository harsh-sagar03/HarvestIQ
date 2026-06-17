"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, Droplets, Radar, ShieldAlert } from "lucide-react";

import { HealthScoreRing } from "@/components/charts/HealthScoreRing";
import { RiskGauge } from "@/components/charts/RiskGauge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useHealthCard } from "@/hooks/useHealthCard";
import { useTranslation } from "@/stores/localizationStore";
import {
  fsiSeverity,
  healthBandSeverity,
  riskBandSeverity,
  SEVERITY_STYLES,
} from "@/lib/dashboard-theme";
import { cn } from "@/lib/utils";

type FarmerHealthCardProps = {
  farmId?: string | null;
};

const getMomentumConfig = (t: any) => {
  return {
    RISING: { icon: ArrowUpRight, label: t("health_card.momentum.rising", "Stress rising") },
    STABLE: { icon: ArrowRight, label: t("health_card.momentum.stable", "Stable") },
    FALLING: { icon: ArrowDownRight, label: t("health_card.momentum.falling", "Stress easing") },
  };
};

export function FarmerHealthCard({ farmId }: FarmerHealthCardProps) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useHealthCard(farmId);

  if (!farmId) return null;

  if (isLoading) {
    return (
      <Card className="dashboard-card border-emerald-200">
        <CardHeader>
          <CardTitle>{t("health_card.title", "Farmer Health Intelligence")}</CardTitle>
          <CardDescription>{t("health_card.compiling", "Compiling farm health snapshot…")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>{t("health_card.title", "Farmer Health Intelligence")}</CardTitle>
          <CardDescription className="text-amber-700">
            {t("health_card.unavailable", "Farm health data unavailable — showing last cached snapshot when connectivity returns.")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const MOMENTUM_CONFIG = getMomentumConfig(t);
  const momentum = MOMENTUM_CONFIG[data.stress_momentum.direction as keyof typeof MOMENTUM_CONFIG] ?? MOMENTUM_CONFIG.STABLE;
  const MomentumIcon = momentum.icon;
  const fsiStyles = SEVERITY_STYLES[fsiSeverity(data.fsi_classification)];

  const drivers = [
    { label: t("health_card.driver.fieldStress", "Field stress"), value: t(data.fsi_classification, data.fsi_classification.replace(/_/g, " ")), severity: fsiSeverity(data.fsi_classification) },
    { label: t("health_card.driver.soilHealthIndex", "Soil health index"), value: data.soil_health_index?.toFixed(2) ?? t("health_card.driver.notRecorded", "Not recorded"), severity: "neutral" as const },
    { label: t("health_card.driver.unreadAlerts", "Unread alerts"), value: String(data.unread_alerts), severity: data.unread_alerts > 0 ? ("moderate" as const) : ("healthy" as const) },
    { label: t("health_card.driver.radarHotspots", "Radar hotspots"), value: t("health_card.driver.highNearby", "{count} HIGH nearby").replace("{count}", String(data.nearby_radar_high_count)), severity: data.nearby_radar_high_count > 0 ? ("critical" as const) : ("healthy" as const) },
  ];

  return (
    <Card className="dashboard-card overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between pb-3">
        <div>
          <p className="dashboard-section-title mb-0.5">{t("health_card.primaryIntelligence", "Primary Intelligence")}</p>
          <CardTitle className="text-base font-bold text-slate-800">{t("health_card.title", "Farmer Health Intelligence")}</CardTitle>
          <CardDescription className="text-xs text-slate-400 mt-0.5">
            {t("crop." + data.crop_type.toLowerCase(), data.crop_type)} · {data.stage}
          </CardDescription>
        </div>
        <Badge severity={healthBandSeverity(data.health_band)}>{t(data.health_band, data.health_band)}</Badge>
      </CardHeader>

      <CardContent className="pb-6">
        <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-50/80 to-white p-4">
            <HealthScoreRing score={data.health_score} band={data.health_band} size={130} strokeWidth={10} />
            <p className="max-w-[180px] text-center text-xs leading-relaxed text-slate-600">{data.explanation.summary}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className={cn("rounded-lg border p-3", fsiStyles.border, fsiStyles.bg)}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("health_card.fieldStress", "Field Stress")}</p>
                <Droplets className="h-4 w-4" style={{ color: fsiStyles.accent }} />
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">{data.fsi.toFixed(2)}</p>
              <p className={cn("text-sm font-medium", fsiStyles.text)}>{t(data.fsi_classification, data.fsi_classification.replace(/_/g, " "))}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("health_card.stressMomentum", "Stress Momentum")}</p>
                <MomentumIcon className="h-5 w-5 text-slate-600" />
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900">{t(data.stress_momentum.direction, data.stress_momentum.direction)}</p>
              <p className="text-sm text-slate-600">
                {momentum.label} · score {data.stress_momentum.momentum_score.toFixed(2)}
              </p>
              {data.stress_momentum.insufficient_history && (
                <p className="mt-1 text-xs text-amber-600">{t("health_card.limitedHistory", "Limited history available")}</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 sm:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("dashboard.yieldRisk", "Yield Risk")}</p>
                <Badge severity={riskBandSeverity(data.yield_risk.risk_band)}>{t(data.yield_risk.risk_band, data.yield_risk.risk_band)}</Badge>
              </div>
              <RiskGauge
                percent={data.yield_risk.estimated_risk_percent}
                band={data.yield_risk.risk_band}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="dashboard-section-title mb-2">{t("health_card.keyDrivers", "Key Drivers")}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {drivers.map((driver) => {
              const styles = SEVERITY_STYLES[driver.severity];
              return (
                <div
                  key={driver.label}
                  className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5", styles.border, styles.bg)}
                >
                  {driver.label.includes("Radar") || driver.label.includes("राडार") ? (
                    <Radar className="h-4 w-4 shrink-0" style={{ color: styles.accent }} />
                  ) : driver.label.includes("alert") || driver.label.includes("अलर्ट") ? (
                    <ShieldAlert className="h-4 w-4 shrink-0" style={{ color: styles.accent }} />
                  ) : (
                    <Droplets className="h-4 w-4 shrink-0" style={{ color: styles.accent }} />
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{driver.label}</p>
                    <p className={cn("truncate text-sm font-semibold", styles.text)}>{driver.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
