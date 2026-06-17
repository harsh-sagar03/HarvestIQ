"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { AuthGuard } from "@/components/AuthGuard";
import { AlertsPanel } from "@/components/AlertsPanel";
import { BriefingCard } from "@/components/BriefingCard";
import { BRAND } from "@/components/branding/HarvestIQLogo";
import { CropStageProgress } from "@/components/CropStageProgress";
import { IntelligenceCharts } from "@/components/dashboard/IntelligenceCharts";
import { FarmerHealthCard } from "@/components/FarmerHealthCard";
import { InputWindowCard } from "@/components/InputWindowCard";
import { AppShell } from "@/components/layout/AppShell";
import { MarketPriceCard } from "@/components/MarketPriceCard";
import { RadarMap } from "@/components/RadarMap";
import { SchemesCard } from "@/components/SchemesCard";
import { SoilHealthCard } from "@/components/SoilHealthCard";
import { StressIndexCard } from "@/components/StressIndexCard";
import { WeatherCard } from "@/components/WeatherCard";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CropCycleProfitCard } from "@/components/dashboard/CropCycleProfitCard";
import { FarmProfitSummaryCard } from "@/components/dashboard/FarmProfitSummaryCard";
import { BestWorstCropWidget } from "@/components/dashboard/BestWorstCropWidget";
import { SeasonComparisonWidget } from "@/components/dashboard/SeasonComparisonWidget";
import { ClipboardList, MessageSquare, Microscope, SlidersHorizontal, AlertTriangle, BellOff } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useLocalizationStore, useTranslation } from "@/stores/localizationStore";
import { useHealthCard } from "@/hooks/useHealthCard";
import { useWeather } from "@/hooks/useWeather";
import { useAlerts } from "@/hooks/useAlerts";
import { HealthScoreRing } from "@/components/charts/HealthScoreRing";
import { RiskGauge } from "@/components/charts/RiskGauge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { SosButton } from "@/components/SosButton";
import { cn } from "@/lib/utils";

function DashboardContent() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const farm = useAuthStore((state) => state.farm);

  // Load metrics data for Row 1
  const { data: health } = useHealthCard(farm?.farm_id);
  const { data: weather } = useWeather(farm?.farm_id);
  const { data: alerts } = useAlerts(farm?.farm_id);

  const preferredLang = useLocalizationStore((state) => state.preferredLang);
  const setLanguage = useLocalizationStore((state) => state.setLanguage);

  // Sync user profile preference with localization store preference
  useEffect(() => {
    if (user?.preferred_lang && user.preferred_lang !== preferredLang) {
      void setLanguage(user.preferred_lang);
    }
  }, [user?.preferred_lang, preferredLang, setLanguage]);

  return (
    <AppShell userName={user?.name}>
      {farm ? (
        <div className="space-y-6">
          {/* TOP SECTION (above the fold) */}
          
          {/* Row 1: Health Score, Yield Risk, Active Alerts, Weather */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Health Score */}
            <Card className="dashboard-card flex flex-col justify-between border-emerald-100/50 bg-white h-full">
              <CardHeader className="compact-card-header pb-1">
                <CardDescription className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">{t("dashboard.primaryHealth", "Primary Health")}</CardDescription>
                <CardTitle className="text-sm font-bold text-slate-800">{t("dashboard.healthScore", "Health Score")}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between px-4 py-3 flex-grow gap-2">
                {health ? (
                  <>
                    <div className="flex flex-col justify-center">
                      <div className="flex items-baseline">
                        <span className="text-3xl font-extrabold text-slate-900 leading-none">{Math.round(health.health_score)}</span>
                        <span className="text-slate-400 text-xs ml-1 font-medium">/100</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 leading-none">
                        <span className={cn(
                          "text-xs font-bold",
                          health.health_band.toUpperCase() === "GOOD" || health.health_band === "अच्छा" ? "text-emerald-600" :
                          health.health_band.toUpperCase() === "MODERATE" || health.health_band === "सामान्य" ? "text-amber-600" : "text-red-600"
                        )}>
                          {t(health.health_band, health.health_band)}
                        </span>
                        <span className="text-slate-300 select-none text-xs">·</span>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1 py-0.5 rounded leading-none select-none">
                          FSI {health.fsi.toFixed(2)}
                        </span>
                      </div>
                      <span className="text-[9px] mt-1.5 text-slate-500 font-medium flex items-center gap-0.5 leading-none">
                        {health.stress_momentum.direction === "FALLING" ? (
                          <span className="text-emerald-600 font-bold">{t("dashboard.improving", "▲ Improving")}</span>
                        ) : health.stress_momentum.direction === "RISING" ? (
                          <span className="text-red-500 font-bold">{t("dashboard.worsening", "▼ Worsening")}</span>
                        ) : (
                          <span className="text-slate-400">{t("dashboard.stable", "Stable")}</span>
                        )}
                        <span className="text-slate-300 select-none">·</span>
                        <span className="text-slate-400 font-semibold">Δ {Math.abs(health.stress_momentum.fsi_delta).toFixed(2)}</span>
                      </span>
                    </div>
                    <div className="shrink-0 flex items-center justify-center">
                      <HealthScoreRing score={health.health_score} band={health.health_band} size={76} strokeWidth={6} compact />
                    </div>
                  </>
                ) : (
                  <EmptyState message={t("dashboard.noHealthData", "No health data available")} />
                )}
              </CardContent>
            </Card>

            {/* Yield Risk */}
            <Card className="dashboard-card flex flex-col justify-between border-emerald-100/50 bg-white h-full">
              <CardHeader className="compact-card-header pb-1">
                <CardDescription className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">{t("dashboard.harvestEstimate", "Harvest Estimate")}</CardDescription>
                <CardTitle className="text-sm font-bold text-slate-800">{t("dashboard.yieldRisk", "Yield Risk")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col justify-center px-4 py-3 flex-grow">
                {health ? (
                  <RiskGauge percent={health.yield_risk.estimated_risk_percent} band={health.yield_risk.risk_band} />
                ) : (
                  <EmptyState message={t("dashboard.noYieldRiskData", "No yield risk data")} />
                )}
              </CardContent>
            </Card>

            {/* Active Alerts */}
            <Card className="dashboard-card flex flex-col justify-between border-emerald-100/50 bg-white h-full">
              <CardHeader className="compact-card-header pb-1">
                <CardDescription className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">{t("dashboard.thresholdMonitoring", "Threshold Monitoring")}</CardDescription>
                <CardTitle className="text-sm font-bold text-slate-800">{t("dashboard.activeAlerts", "Active Alerts")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col justify-center px-4 py-3 flex-grow">
                {alerts ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-extrabold text-slate-900 leading-none">{alerts.alerts.length}</span>
                      {alerts.unread_count > 0 && (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold text-white leading-none">
                          {t("alerts.newAlerts", "{count} new").replace("{count}", String(alerts.unread_count))}
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      "text-xs mt-1.5 font-semibold truncate leading-none",
                      alerts.alerts.length > 0 ? "text-amber-600" : "text-emerald-600"
                    )}>
                      {alerts.alerts.length > 0 ? t(alerts.alerts[0].title, alerts.alerts[0].title) : t("dashboard.allSystemsClear", "All monitoring systems clear")}
                    </p>
                  </div>
                ) : (
                  <EmptyState message={t("dashboard.noAlertsData", "No active alerts data")} icon={BellOff} />
                )}
              </CardContent>
            </Card>

            {/* Weather */}
            <Card className="dashboard-card flex flex-col justify-between border-emerald-100/50 bg-white h-full">
              <CardHeader className="compact-card-header pb-1">
                <CardDescription className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">{t("dashboard.fieldConditions", "Field Conditions")}</CardDescription>
                <CardTitle className="text-sm font-bold text-slate-800">{t("dashboard.weather", "Weather")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col justify-center px-4 py-3 flex-grow">
                {weather ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-extrabold text-slate-900 leading-none">{weather.current.temp.toFixed(1)}°C</span>
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider leading-none">
                        {weather.source === "CACHE_HIT" ? t("dashboard.cached", "Cached") : t("dashboard.live", "Live")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1.5 leading-none">
                      {weather.current.humidity.toFixed(0)}% RH <span className="text-slate-300 select-none">·</span> {weather.current.wind_speed.toFixed(0)} km/h
                    </p>
                  </div>
                ) : (
                  <EmptyState message={t("dashboard.noWeatherData", "No weather data available")} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Daily Briefing (full-width prominent card) */}
          <div className="w-full">
            <ErrorBoundary fallbackTitle={t("errorBoundary.title.healthIntelligence", "Farmer Health Intelligence")}>
              <BriefingCard farmId={farm.farm_id} language={preferredLang} />
            </ErrorBoundary>
          </div>

          {/* Row 3: Quick Actions (Advisory, Disease Detection, Simulator, Operations, SOS) */}
          <div>
            <p className="dashboard-section-title mb-2">{t("dashboard.quickActions", "Quick Actions")}</p>
            <div className="grid grid-cols-2 gap-3">
              {/* 1. Advisory */}
              <Link
                href="/advisory"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-[#10b981]/35 transition-all duration-200 group w-full"
              >
                <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600 shrink-0">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">{t("dashboard.advisoryLabel", "Advisory")}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-none truncate">{t("dashboard.advisoryDesc", "Get AI advice")}</p>
                </div>
              </Link>

              {/* 2. Disease Detection */}
              <Link
                href="/disease"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 group w-full"
              >
                <div className="rounded-lg bg-blue-50 p-1.5 text-blue-600 shrink-0">
                  <Microscope className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">{t("dashboard.diseaseLabel", "Disease Detection")}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-none truncate">{t("dashboard.diseaseDesc", "Scan crop health")}</p>
                </div>
              </Link>

              {/* 3. Simulator */}
              <Link
                href="/simulator"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-purple-200 transition-all duration-200 group w-full"
              >
                <div className="rounded-lg bg-purple-50 p-1.5 text-purple-600 shrink-0">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">{t("dashboard.simulatorLabel", "Simulator")}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-none truncate">{t("dashboard.simulatorDesc", "Run what-if tests")}</p>
                </div>
              </Link>

              {/* 4. Operations */}
              <Link
                href="/operations"
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-amber-200 transition-all duration-200 group w-full"
              >
                <div className="rounded-lg bg-amber-50 p-1.5 text-amber-600 shrink-0">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">{t("dashboard.operationsLabel", "Operations")}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-none truncate">{t("dashboard.operationsDesc", "Track farm records")}</p>
                </div>
              </Link>

              {/* 5. SOS (Spans both columns) */}
              <SosButton farmId={farm.farm_id} variant="quickaction" />
            </div>
          </div>

          {/* BELOW THE FOLD - ADVANCED INTELLIGENCE */}
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{t("dashboard.advancedIntelligence", "Advanced Intelligence")}</h3>
            
            <div className="space-y-6">
              {/* Row 1: Charts & Map */}
              <div className="grid gap-4 xl:grid-cols-12">
                <div className="xl:col-span-8 space-y-4">
                  <ErrorBoundary fallbackTitle={t("errorBoundary.title.healthIntelligence", "Farmer Health Intelligence")}>
                    <FarmerHealthCard farmId={farm.farm_id} />
                  </ErrorBoundary>
                  <ErrorBoundary fallbackTitle={t("errorBoundary.title.intelligenceCharts", "Intelligence Charts")}>
                    <IntelligenceCharts farmId={farm.farm_id} />
                  </ErrorBoundary>
                </div>
                <div className="xl:col-span-4">
                  <ErrorBoundary fallbackTitle={t("errorBoundary.title.alerts", "Alerts & Notifications")}>
                    <AlertsPanel farmId={farm.farm_id} />
                  </ErrorBoundary>
                </div>
              </div>

              {/* Map */}
              <ErrorBoundary fallbackTitle={t("errorBoundary.title.radarMap", "Satellite & Radar Map")}>
                <RadarMap farmId={farm.farm_id} cropType={farm.crop_type ?? undefined} />
              </ErrorBoundary>

              {/* Forecast & Soil */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ErrorBoundary fallbackTitle={t("errorBoundary.title.stressIndex", "Field Stress Index")}>
                  <StressIndexCard farmId={farm.farm_id} />
                </ErrorBoundary>
                <ErrorBoundary fallbackTitle={t("errorBoundary.title.weatherForecast", "Weather Forecast")}>
                  <WeatherCard farmId={farm.farm_id} />
                </ErrorBoundary>
                <ErrorBoundary fallbackTitle={t("errorBoundary.title.cropStage", "Crop Stage Progress")}>
                  <CropStageProgress cycleId={farm.crop_cycle_id} />
                </ErrorBoundary>
                <ErrorBoundary fallbackTitle={t("errorBoundary.title.soilHealth", "Soil Health Intelligence")}>
                  <SoilHealthCard farmId={farm.farm_id} />
                </ErrorBoundary>
              </div>

              {/* Financials */}
              <div>
                <p className="dashboard-section-title mb-2">{t("dashboard.financialPerformance", "Financial Performance & Analytics")}</p>
                <ErrorBoundary fallbackTitle={t("errorBoundary.title.profitSummary", "Farm Profitability Summary")}>
                  <FarmProfitSummaryCard farmId={farm.farm_id} className="mb-4" />
                </ErrorBoundary>
                <div className="grid gap-4 md:grid-cols-3">
                  <ErrorBoundary fallbackTitle={t("errorBoundary.title.cycleProfit", "Crop Cycle Profitability")}>
                    <CropCycleProfitCard cycleId={farm.crop_cycle_id} />
                  </ErrorBoundary>
                  <ErrorBoundary fallbackTitle={t("errorBoundary.title.cropLeaderboard", "Crop Performance Leaderboard")}>
                    <BestWorstCropWidget farmId={farm.farm_id} />
                  </ErrorBoundary>
                  <ErrorBoundary fallbackTitle={t("errorBoundary.title.seasonalComparison", "Seasonal Performance Comparison")}>
                    <SeasonComparisonWidget farmId={farm.farm_id} />
                  </ErrorBoundary>
                </div>
              </div>

              {/* Recommendations & Market */}
              <div>
                <p className="dashboard-section-title mb-2">{t("dashboard.operationsAndMarket", "Operations & Market")}</p>
                <div className="grid gap-4 md:grid-cols-3">
                  <ErrorBoundary fallbackTitle={t("errorBoundary.title.inputRecommendations", "Input Recommendations")}>
                    <InputWindowCard farmId={farm.farm_id} />
                  </ErrorBoundary>
                  <ErrorBoundary fallbackTitle={t("errorBoundary.title.marketPrices", "Market Prices")}>
                    <MarketPriceCard farmId={farm.farm_id} />
                  </ErrorBoundary>
                  <ErrorBoundary fallbackTitle={t("errorBoundary.title.govSchemes", "Government Schemes")}>
                    <SchemesCard farmId={farm.farm_id} />
                  </ErrorBoundary>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-white py-16 text-center p-6">
          <Image src={BRAND.icon} alt="HarvestIQ" width={64} height={64} className="mb-3 rounded-full" />
          <p className="font-semibold text-slate-800">{t("dashboard.noFarmProfile", "No farm profile loaded")}</p>
          <p className="mt-1 text-sm text-slate-500 max-w-sm">{t("dashboard.noFarmProfileDesc", "Complete onboarding or set up your farm database to view your dashboard.")}</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button onClick={() => router.push("/onboarding")} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 py-2">
              {t("dashboard.onboardingForm", "Onboarding Form")}
            </Button>
            <Button onClick={() => router.push("/farm-setup")} variant="outline" className="border-emerald-200 text-emerald-800 rounded-xl px-6 py-2">
              {t("dashboard.farmDbWizard", "Farm DB Wizard")}
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function HomePage() {
  return (
    <AuthGuard requireOnboarding>
      <DashboardContent />
    </AuthGuard>
  );
}

