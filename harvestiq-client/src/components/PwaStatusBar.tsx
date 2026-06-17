"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Wifi } from "lucide-react";

import { useDemoMode } from "@/hooks/useDemoMode";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { OfflineBanner } from "@/components/OfflineBanner";
import { readOutbox } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/stores/localizationStore";

export function PwaStatusBar() {
  const online = useOnlineStatus();
  const { demoMode } = useDemoMode();
  const [pendingSync, setPendingSync] = useState(0);
  const [justReconnected, setJustReconnected] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const refresh = async () => {
      const entries = await readOutbox();
      setPendingSync(entries.length);
    };
    void refresh();
    window.addEventListener("outbox-updated", refresh);
    const id = setInterval(() => void refresh(), 5000);
    return () => {
      window.removeEventListener("outbox-updated", refresh);
      clearInterval(id);
    };
  }, [online]);

  useEffect(() => {
    if (!online) return;
    setJustReconnected(true);
    const t = setTimeout(() => setJustReconnected(false), 4000);
    return () => clearTimeout(t);
  }, [online]);

  const showBar = !online || justReconnected || pendingSync > 0 || demoMode;

  if (!showBar) return null;

  return (
    <div className="space-y-2">
      {!online && <OfflineBanner />}

      {online && justReconnected && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Wifi className="h-4 w-4 shrink-0" />
          <span className="font-medium">{t("pwa.statusBar.backOnline", "Back online")}</span>
          {pendingSync > 0 && (
            <span className="flex items-center gap-1 text-xs text-emerald-700">
              <RefreshCw className="h-3 w-3 animate-spin" />
              {t("pwa.statusBar.syncing", "Syncing {count} queued action(s)…").replace("{count}", String(pendingSync))}
            </span>
          )}
        </div>
      )}

      {online && !justReconnected && pendingSync > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          <RefreshCw className="h-3.5 w-3.5" />
          {t("pwa.statusBar.waitingToSync", "{count} action(s) waiting to sync").replace("{count}", String(pendingSync))}
        </div>
      )}

      {demoMode && online && (
        <div className={cn("rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800")}>
          {t("pwa.statusBar.demoMode", "Demo mode — presentation fixtures enabled")}
        </div>
      )}
    </div>
  );
}

