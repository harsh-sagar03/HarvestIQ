"use client";

import { useEffect, useRef } from "react";
import { Bell, BellOff } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

import { AlertSeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAlerts, useTriggerAlerts } from "@/hooks/useAlerts";
import { alertSeverity, SEVERITY_STYLES } from "@/lib/dashboard-theme";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/stores/localizationStore";

type AlertsPanelProps = {
  farmId?: string | null;
};

export function AlertsPanel({ farmId }: AlertsPanelProps) {
  const { data, isLoading, error } = useAlerts(farmId);
  const triggerAlerts = useTriggerAlerts(farmId);
  const hasTriggered = useRef(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!farmId || hasTriggered.current) {
      return;
    }
    hasTriggered.current = true;
    triggerAlerts.mutate();
  }, [farmId, triggerAlerts]);

  if (!farmId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>{t("alerts.fieldAlerts", "Field Alerts")}</CardTitle>
          <CardDescription>{t("alerts.loading", "Loading alerts…")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    // Offline or error — show empty state instead of a red error card
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BellOff className="h-5 w-5 text-emerald-500" />
            {t("alerts.fieldAlerts", "Field Alerts")}
          </CardTitle>
          <CardDescription>{t("alerts.unavailableOffline", "Alert evaluation unavailable offline.")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const alerts = data?.alerts ?? [];
  const unreadCount = data?.unread_count ?? 0;

  return (
    <Card className="dashboard-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <p className="dashboard-section-title mb-1">{t("alerts.thresholdMonitoring", "Threshold Monitoring")}</p>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
            {alerts.length > 0 ? (
              <Bell className="h-5 w-5 text-amber-500" />
            ) : (
              <BellOff className="h-5 w-5 text-emerald-500" />
            )}
            {t("alerts.fieldAlerts", "Field Alerts")}
          </CardTitle>
          <CardDescription>{t("alerts.deterministicAlerts", "Deterministic threshold alerts for your farm")}</CardDescription>
        </div>
        {unreadCount > 0 && (
          <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            {t("alerts.newAlerts", "{count} new").replace("{count}", String(unreadCount))}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <EmptyState
            message={t("alerts.allClearMsg", "All monitoring parameters are within safe ranges. No active alerts found.")}
            title={t("alerts.allClearTitle", "All Clear")}
            icon={BellOff}
          />
        ) : (
          alerts.map((alert) => {
            const severity = alertSeverity(alert.severity);
            const styles = SEVERITY_STYLES[severity];
            return (
              <div
                key={alert.id}
                className={cn(
                  "relative overflow-hidden rounded-xl border p-4 transition-shadow hover:shadow-sm",
                  styles.border,
                  styles.bg,
                )}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: styles.accent }}
                />
                <div className="flex items-start justify-between gap-2 pl-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{alert.title}</p>
                      <AlertSeverityBadge severity={alert.severity} />
                      {!alert.read && (
                        <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          {t("alerts.new", "New")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-slate-700">{alert.message}</p>
                    <p className="mt-2 text-xs text-slate-500">{alert.explanation.summary}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={triggerAlerts.isPending}
          onClick={() => triggerAlerts.mutate()}
        >
          {triggerAlerts.isPending ? t("alerts.evaluating", "Evaluating…") : t("alerts.reEvaluate", "Re-evaluate alerts")}
        </Button>
      </CardContent>
    </Card>
  );
}
