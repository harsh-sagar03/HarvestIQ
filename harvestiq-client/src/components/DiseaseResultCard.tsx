"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DiseaseDetectResult } from "@/lib/api";
import { useTranslation } from "@/stores/localizationStore";

type DiseaseResultCardProps = {
  result: DiseaseDetectResult;
};

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-red-100 text-red-800",
  LOW_CONFIDENCE: "bg-amber-100 text-amber-800",
  REJECTED: "bg-gray-100 text-gray-800",
  UNAVAILABLE: "bg-gray-100 text-gray-800",
};

const getStatusKey = (status: string) => {
  if (status === "LOW_CONFIDENCE") return "disease.status.lowConfidence";
  return "disease.status." + status.toLowerCase();
};

export function DiseaseResultCard({ result }: DiseaseResultCardProps) {
  const { t } = useTranslation();
  const badgeClass = STATUS_STYLES[result.deterministic_status] ?? "bg-gray-100 text-gray-800";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{t("disease.resultTitle", "Disease Screening Result")}</CardTitle>
          <CardDescription>{t("disease.resultDesc", "Vision output validated by deterministic rules")}</CardDescription>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>
          {t(getStatusKey(result.deterministic_status), result.deterministic_status.replace(/_/g, " "))}
        </span>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <span className="font-medium">{t("disease.candidateLabel", "Candidate:")}</span> {result.disease === "OFFLINE_MODE" || result.deterministic_status === "UNAVAILABLE" ? t("errorBoundary.unavailable", "Unavailable") : result.disease}
        </p>
        {result.disease !== "OFFLINE_MODE" && result.deterministic_status !== "UNAVAILABLE" && (
          <>
            <p>
              <span className="font-medium">{t("disease.confidenceLabel", "Confidence:")}</span> {(result.confidence * 100).toFixed(1)}%
            </p>
            <p>
              <span className="font-medium">{t("disease.cropLabel", "Crop:")}</span> {t("crop." + result.crop_type.toLowerCase(), result.crop_type)}
            </p>
          </>
        )}
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-emerald-800">
          {result.explanation.summary}
        </div>
        {result.deterministic_status !== "CONFIRMED" && result.deterministic_status !== "UNAVAILABLE" && (
          <p className="text-amber-700">
            {t("disease.nonFinalWarning", "This vision result is not final. Confirm with a local KVK or agriculture officer before treatment.")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
