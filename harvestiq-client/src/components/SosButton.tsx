"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDemoMode } from "@/hooks/useDemoMode";
import { api, type SosTriggerResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useHealthCard } from "@/hooks/useHealthCard";
import { useCropStage } from "@/hooks/useCropStage";
import { AlertTriangle, User, MapPin, Activity, HelpCircle, PhoneCall } from "lucide-react";
import { useTranslation } from "@/stores/localizationStore";

type SosButtonProps = {
  farmId?: string | null;
  variant?: "default" | "sidebar" | "quickaction";
};

const EMERGENCY_TYPES = ["GENERAL", "FLOOD", "FROST", "HEATWAVE"] as const;

export function SosButton({ farmId, variant = "default" }: SosButtonProps) {
  const { demoMode } = useDemoMode();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SosTriggerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude?: number; longitude?: number } | null>(null);

  const user = useAuthStore((state) => state.user);
  const farm = useAuthStore((state) => state.farm);
  const { data: health } = useHealthCard(farmId);
  const { data: stage } = useCropStage(farm?.crop_cycle_id ?? null);
  const stageLabel = health?.stage ?? stage?.stage ?? "—";

  if (!farmId) return null;

  const trigger = async (emergencyType: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (!demoMode && navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          setCoords({ latitude, longitude });
        } catch (gpsErr) {
          console.warn("Geolocation capture failed or timed out:", gpsErr);
        }
      }
      const response = await api.triggerSos({
        farm_id: farmId,
        emergency_type: emergencyType,
        latitude,
        longitude,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sos.dispatchError", "SOS trigger failed"));
    } finally {
      setLoading(false);
    }
  };

  const getEmergencyTypeLabel = (type: string) => {
    if (type === "GENERAL") return t("sos.type.general", "GENERAL");
    if (type === "FLOOD") return t("sos.type.flood", "FLOOD");
    if (type === "FROST") return t("sos.type.frost", "FROST");
    if (type === "HEATWAVE") return t("sos.type.heatwave", "HEATWAVE");
    return type;
  };

  const renderTriggerButton = () => {
    if (variant === "sidebar") {
      return (
        <button
          onClick={() => {
            setResult(null);
            setError(null);
            setOpen(true);
          }}
          className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-xl text-slate-650 hover:bg-slate-50 hover:text-slate-900 transition-colors w-full cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span>SOS</span>
          </div>
          <span className="text-[8px] font-bold text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full select-none leading-none shrink-0">
            {t("sos.worksOffline", "Works offline")}
          </span>
        </button>
      );
    }

    if (variant === "quickaction") {
      return (
        <button
          onClick={() => {
            setResult(null);
            setError(null);
            setOpen(true);
          }}
          className="col-span-2 flex items-center justify-between gap-3 p-3 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md transition-all duration-200 min-h-[58px] text-left cursor-pointer w-full"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-lg bg-red-500/30 p-2 text-white shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold leading-none">{t("sos.emergencySos", "Emergency SOS")}</span>
                <span className="text-[8px] font-bold text-white bg-red-500 border border-red-400 px-1.5 py-0.5 rounded-full select-none leading-none shrink-0">
                  {t("sos.worksOffline", "Works offline")}
                </span>
              </div>
              <span className="text-[10px] text-red-150 mt-0.5 leading-tight block truncate">
                {t("sos.quickActionDesc", "Press to view context and trigger dispatch")}
              </span>
            </div>
          </div>
          <div className="shrink-0 font-bold text-xs uppercase bg-white/20 px-3 py-1.5 rounded-lg select-none leading-none">
            {t("sos.open", "Open")}
          </div>
        </button>
      );
    }

    return (
      <Button
        variant="default"
        size="sm"
        disabled={loading || demoMode}
        title={demoMode ? t("sos.disabledInDemo", "SOS disabled in demo mode") : t("sos.emergencySos", "Emergency SOS")}
        className="bg-red-600 text-white hover:bg-red-700 min-h-[44px] min-w-[64px]"
        onClick={() => {
          setResult(null);
          setError(null);
          setOpen(true);
        }}
      >
        SOS
      </Button>
    );
  };

  return (
    <>
      {renderTriggerButton()}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setOpen(false)} />

          {/* Modal Container */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100 z-50 animate-in fade-in-50 zoom-in-95 duration-155">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
                  <span>{t("sos.modalTitle", "Emergency SOS Dispatch")}</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {t("sos.modalSubtitle", "Deterministic checklist & emergency contacts from field intelligence")}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm text-slate-600">
              {/* Grid for Farmer Info and Current Situation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Section 1: Farmer Information */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-4 w-4 text-slate-500" />
                    {t("sos.farmerInfo", "Farmer Information")}
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">{t("sos.farmerName", "Farmer Name:")}</span>
                      <span className="font-semibold text-slate-800">{user?.name || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">{t("sos.farmName", "Farm Name:")}</span>
                      <span className="font-semibold text-slate-800">{farm?.farm_name || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">{t("sos.district", "District:")}</span>
                      <span className="font-semibold text-slate-800">{farm?.district || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">{t("sos.state", "State:")}</span>
                      <span className="font-semibold text-slate-800">{farm?.state || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Current Situation */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-slate-500" />
                    {t("sos.currentSituation", "Current Situation")}
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">{t("sos.healthScoreLabel", "Health Score:")}</span>
                      <span className="font-semibold text-slate-800">{health ? `${Math.round(health.health_score)}/100 (${t(health.health_band, health.health_band)})` : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">{t("sos.fsiLabel", "FSI:")}</span>
                      <span className="font-semibold text-slate-800">{health ? health.fsi.toFixed(2) : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">{t("sos.yieldRiskLabel", "Yield Risk:")}</span>
                      <span className="font-semibold text-slate-800">{health ? `${t(health.yield_risk.risk_band, health.yield_risk.risk_band)} (${health.yield_risk.estimated_risk_percent}%)` : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">{t("sos.cropStageLabel", "Crop Stage:")}</span>
                      <span className="font-semibold text-slate-800">{stageLabel || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Location */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  {t("sos.locationDetails", "Location Details")}
                </h4>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    {coords ? (
                      <p className="font-semibold text-slate-800">
                        {t("sos.gpsCoordinates", "GPS Coordinates:")} {coords.latitude?.toFixed(6)}, {coords.longitude?.toFixed(6)}
                      </p>
                    ) : (
                      <p className="text-slate-400 font-medium">{t("sos.gpsPending", "GPS Coordinates: Pending dispatch request")}</p>
                    )}
                  </div>
                  {coords?.latitude && coords?.longitude && (
                    <a
                      href={`https://maps.google.com/?q=${coords.latitude},${coords.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-bold underline shrink-0 cursor-pointer"
                    >
                      {t("sos.openMaps", "Open in Google Maps")}
                    </a>
                  )}
                </div>
              </div>

              {/* Section 4: Recommended Actions */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4 text-slate-500" />
                  {t("sos.recommendedActions", "Recommended Actions")}
                </h4>
                {result ? (
                  <ul className="list-disc space-y-1.5 pl-5 text-xs text-slate-700">
                    {result.checklist.map((step, idx) => (
                      <li key={idx} className="font-medium">{step}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 font-medium italic">
                    {t("sos.noActionsTriggered", "Trigger the SOS emergency alert below to generate custom agricultural actions.")}
                  </p>
                )}
              </div>

              {/* Section 5: Emergency Contacts */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <PhoneCall className="h-4 w-4 text-slate-500" />
                  {t("sos.emergencyContacts", "Emergency Contacts")}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2 border border-slate-100 bg-white rounded-lg">
                    <p className="font-semibold text-slate-500">{t("sos.helpline", "Helpline")}</p>
                    <p className="font-bold text-slate-800 mt-0.5">1800-180-1551</p>
                    <p className="text-[9px] text-slate-400">{t("sos.kisanCallCentre", "Kisan Call Centre")}</p>
                  </div>
                  <div className="p-2 border border-slate-100 bg-white rounded-lg">
                    <p className="font-semibold text-slate-500">{t("sos.nearestKvk", "Nearest KVK")}</p>
                    <p className="font-bold text-[#10b981] mt-0.5">{t("sos.krishiVigyanKendra", "Krishi Vigyan Kendra")}</p>
                    <p className="text-[9px] text-slate-400">{t("sos.kvkSubtitle", "Agricultural Science Center")}</p>
                  </div>
                  <div className="p-2 border border-slate-100 bg-white rounded-lg">
                    <p className="font-semibold text-slate-500">{t("sos.localOffice", "Local Office")}</p>
                    <p className="font-bold text-slate-800 mt-0.5">{t("sos.districtDept", "District Agr. Dept.")}</p>
                    <p className="text-[9px] text-slate-400">{t("sos.officerSubtitle", "Tehsildar / Extension officer")}</p>
                  </div>
                </div>
              </div>

              {/* Status details & output message */}
              {result && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 space-y-1">
                  <p className="font-semibold">{t("sos.statusSent", "Status: Sent / Saved Offline")}</p>
                  <p className="text-[11px] leading-normal">{result.plain_text_message}</p>
                  <p className="text-[9px] text-emerald-600 font-medium mt-1">
                    {t("sos.delivery", "Delivery:")} {result.delivery_status} · snapshot {result.intelligence_snapshot_version}
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-800">
                  <p className="font-bold">{t("sos.dispatchError", "Dispatch Error")}</p>
                  <p className="mt-0.5">{error}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-left">
                {demoMode ? (
                  <p className="text-[10px] text-amber-600 font-semibold">
                    {t("sos.disabledInDemo", "SOS disabled in demo mode")}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 font-medium">
                    {t("sos.willQueue", "Will queue request locally if offline")}
                  </p>
                )}
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                {!result && (
                  <div className="flex flex-wrap gap-1.5 mr-2 items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t("sos.type", "Type:")}</span>
                    {EMERGENCY_TYPES.map((type) => (
                      <Button
                        key={type}
                        size="sm"
                        variant="outline"
                        disabled={demoMode || loading}
                        onClick={() => void trigger(type)}
                        className="text-[9px] h-7 px-2 font-bold bg-white cursor-pointer"
                      >
                        {getEmergencyTypeLabel(type)}
                      </Button>
                    ))}
                  </div>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="text-xs h-9 px-4 cursor-pointer bg-white"
                >
                  {t("sos.close", "Close")}
                </Button>
                
                {!result && (
                  <button
                    disabled={loading || demoMode}
                    onClick={() => void trigger("GENERAL")}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold h-9 px-4 rounded-md disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center min-h-[36px]"
                  >
                    {loading ? t("sos.sending", "Sending...") : t("sos.sendSos", "Send SOS")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
