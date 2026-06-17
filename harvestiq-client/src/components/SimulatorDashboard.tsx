"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Droplets,
  Minus,
  Thermometer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Sparkline } from "@/components/charts/Sparkline";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSimulator } from "@/hooks/useSimulator";
import { CropIcon } from "@/lib/agri-identity";
import { riskBandSeverity } from "@/lib/dashboard-theme";
import {
  computeDelta,
  deltaSeverity,
  estimateHealthScore,
  formatDelta,
} from "@/lib/simulator-ui";
import type { SimulatorSnapshotData } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/stores/localizationStore";

type SimulatorDashboardProps = {
  farmId?: string | null;
  cropType?: string | null;
};

export function SimulatorDashboard({ farmId, cropType }: SimulatorDashboardProps) {
  const { t } = useTranslation();
  const [tempDelta, setTempDelta] = useState(0);
  const [irrigationDelta, setIrrigationDelta] = useState(0);
  const [nitrogenDelta, setNitrogenDelta] = useState(0);
  const mutation = useSimulator(farmId);

  useEffect(() => {
    if (!farmId) return;
    const timer = setTimeout(() => {
      mutation.mutate({
        temp_delta: tempDelta,
        irrigation_delta: irrigationDelta,
        nitrogen_delta: nitrogenDelta,
      });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, tempDelta, irrigationDelta, nitrogenDelta]);

  if (!farmId) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>{t("simulator.title", "Scenario Simulator")}</CardTitle>
          <CardDescription>{t("simulator.selectFarm", "Select a farm to run scenarios.")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const result = mutation.data;
  const baselineHealth = result ? estimateHealthScore(result.baseline) : 0;
  const projectedHealth = result ? estimateHealthScore(result.projected) : 0;
  const healthDelta = result ? computeDelta(baselineHealth, projectedHealth) : 0;
  const fsiDelta = result ? computeDelta(result.baseline.fsi, result.projected.fsi) : 0;
  const riskDelta = result
    ? computeDelta(
        result.baseline.yield_risk.estimated_risk_percent,
        result.projected.yield_risk.estimated_risk_percent,
      )
    : 0;
  const yieldDelta = result ? computeDelta(result.baseline.yield_factor, result.projected.yield_factor) : 0;

  return (
    <div className="space-y-4">
      <Card className="dashboard-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-600" />
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <CropIcon cropType={cropType} size="md" />
            <div>
              <p className="dashboard-section-title">{t("simulator.whatIfAnalysis", "What-If Analysis")}</p>
              <CardTitle className="text-lg">{t("simulator.scenarioControls", "Scenario Controls")}</CardTitle>
              <CardDescription>{t("simulator.adjustConditions", "Adjust conditions — projections update automatically")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <SliderField
            icon={Thermometer}
            label={t("simulator.tempShift", "Temperature shift")}
            unit="°C"
            value={tempDelta}
            min={-10}
            max={10}
            step={0.5}
            onChange={setTempDelta}
          />
          <SliderField
            icon={Droplets}
            label={t("simulator.irrigationChange", "Irrigation change")}
            unit=""
            value={irrigationDelta}
            min={-1}
            max={1}
            step={0.1}
            onChange={setIrrigationDelta}
          />
          <SliderField
            icon={Activity}
            label={t("simulator.nitrogenChange", "Nitrogen change")}
            unit=" kg/ha"
            value={nitrogenDelta}
            min={-100}
            max={100}
            step={5}
            onChange={setNitrogenDelta}
          />
        </CardContent>
      </Card>

      {mutation.isPending && (
        <p className="text-xs font-medium text-slate-500">{t("simulator.running", "Running deterministic simulation…")}</p>
      )}

      {result && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ImpactCard
              label={t("simulator.healthScore", "Health Score")}
              delta={healthDelta}
              unit=""
              current={baselineHealth}
              projected={projectedHealth}
              invert
            />
            <ImpactCard
              label={t("simulator.fsi", "Field Stress (FSI)")}
              delta={fsiDelta}
              unit=""
              current={result.baseline.fsi}
              projected={result.projected.fsi}
              decimals={2}
            />
            <ImpactCard
              label={t("simulator.yieldRisk", "Yield Risk")}
              delta={riskDelta}
              unit="%"
              current={result.baseline.yield_risk.estimated_risk_percent}
              projected={result.projected.yield_risk.estimated_risk_percent}
            />
            <ImpactCard
              label={t("simulator.yieldFactor", "Yield Factor")}
              delta={yieldDelta}
              unit=""
              current={result.baseline.yield_factor}
              projected={result.projected.yield_factor}
              decimals={2}
              invert
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ComparisonPanel title={t("simulator.currentBaseline", "Current Baseline")} snapshot={result.baseline} variant="baseline" />
            <ComparisonPanel title={t("simulator.projectedScenario", "Projected Scenario")} snapshot={result.projected} variant="projected" />
          </div>

          <Card className="dashboard-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("simulator.fsiTrajectory", "FSI Trajectory")}</CardTitle>
              <CardDescription>{t("simulator.stressCurve", "Stress curve under scenario inputs")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Sparkline
                values={result.projected.fsi_curve}
                color={result.projected.fsi > 0.6 ? "#ef4444" : "#10b981"}
                height={72}
                labels={result.projected.fsi_curve.map((_, i) => `T${i + 1}`)}
                smooth
              />
            </CardContent>
          </Card>

          <Card className="dashboard-card border-slate-200 bg-slate-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("simulator.deterministicExplanation", "Deterministic Explanation")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-slate-700">
              {result.explanation.summary}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SliderField({
  icon: Icon,
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Icon className="h-3.5 w-3.5 text-slate-500" />
          {label}
        </span>
        <span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-slate-900">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-indigo-600"
      />
    </div>
  );
}

function ImpactCard({
  label,
  delta,
  unit,
  current,
  projected,
  decimals = 0,
  invert = false,
}: {
  label: string;
  delta: number;
  unit: string;
  current: number;
  projected: number;
  decimals?: number;
  invert?: boolean;
}) {
  const severity = deltaSeverity(delta, invert);
  const isPositive = delta > 0;
  const DeltaIcon = isPositive ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  const colors = {
    healthy: "border-emerald-200 bg-emerald-50",
    moderate: "border-amber-200 bg-amber-50",
    critical: "border-red-200 bg-red-50",
    neutral: "border-slate-200 bg-white",
  };

  return (
    <div className={cn("rounded-xl border p-3", colors[severity])}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <DeltaIcon className="h-4 w-4 text-slate-600" />
        <span className="text-xl font-bold tabular-nums text-slate-900">
          {formatDelta(delta, unit, decimals)}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        {current.toFixed(decimals)} → {projected.toFixed(decimals)}
        {unit}
      </p>
    </div>
  );
}

function ComparisonPanel({
  title,
  snapshot,
  variant,
}: {
  title: string;
  snapshot: SimulatorSnapshotData;
  variant: "baseline" | "projected";
}) {
  const { t } = useTranslation();
  const health = estimateHealthScore(snapshot);
  const border = variant === "baseline" ? "border-slate-200" : "border-indigo-200";
  const accent = variant === "baseline" ? "bg-slate-100" : "bg-indigo-50";

  return (
    <Card className={cn("dashboard-card", border)}>
      <CardHeader className={cn("pb-2", accent)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {variant === "projected" ? (
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 pt-3 text-sm">
        <Metric label={t("simulator.metric.health", "Health (est.)")} value={String(health)} />
        <Metric label={t("simulator.metric.fsi", "FSI")} value={snapshot.fsi.toFixed(2)} />
        <Metric label={t("simulator.metric.momentum", "Momentum")} value={t(snapshot.stress_momentum.direction, snapshot.stress_momentum.direction)} />
        <Metric
          label={t("simulator.metric.yieldRisk", "Yield risk")}
          value={`${snapshot.yield_risk.estimated_risk_percent}%`}
          badge={t(snapshot.yield_risk.risk_band, snapshot.yield_risk.risk_band)}
        />
        <Metric label={t("simulator.metric.yieldFactor", "Yield factor")} value={snapshot.yield_factor.toFixed(2)} />
        <Metric label={t("simulator.metric.momentumScore", "Momentum score")} value={snapshot.stress_momentum.momentum_score.toFixed(2)} />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <p className="font-bold text-slate-900">{value}</p>
        {badge && <Badge severity={riskBandSeverity(badge)}>{badge}</Badge>}
      </div>
    </div>
  );
}
