"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { HistoryIcon } from "@/components/icons/history-icon";
import { FlagstickMotif } from "@/components/motifs/flagstick-motif";
import {
  getCaddieLogSnapshot,
  parseCaddieLogSnapshot,
} from "@/lib/caddie/caddie-log-storage";
import { useI18n } from "@/lib/i18n/use-i18n";
import { formatDateTime } from "@/lib/i18n/format";

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getServerCaddieLogSnapshot() {
  return "[]";
}

export function CaddieLogPage() {
  const { lang, t } = useI18n();
  const rawLog = useSyncExternalStore(
    subscribeToStorage,
    getCaddieLogSnapshot,
    getServerCaddieLogSnapshot,
  );
  const entries = useMemo(() => parseCaddieLogSnapshot(rawLog), [rawLog]);

  return (
    <div className="relative overflow-hidden">
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -right-14 -top-12 h-[400px] w-auto opacity-[0.32]"
      />
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -bottom-14 -left-14 h-[420px] w-auto -scale-x-100 opacity-[0.36]"
      />
      <div className="relative mx-auto w-full max-w-md px-6 py-16">
      <h1 className="motion-heading flex items-center gap-2.5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        <HistoryIcon className="h-6 w-6 text-sage" />
        {t.caddieLog.title}
      </h1>
      <div className="motion-body">
      <p className="mt-2 text-base text-muted">
        {t.caddieLog.subtitle}
      </p>

      {entries.length === 0 ? (
        <p className="mt-12 text-sm text-muted">
          {t.caddieLog.empty}
        </p>
      ) : (
        <div className="mt-8 space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-border bg-surface px-4 py-3"
            >
              <p className="text-xs text-muted">{formatDateTime(entry.timestamp, lang, t.common.unknownDate, true)}</p>
              <p className="mt-1.5 text-sm text-foreground">{entry.message}</p>
              <p className="mt-1.5 text-sm text-sage">{entry.response}</p>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/mental-game"
        className="mt-8 inline-flex w-full items-center justify-center rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-forest"
      >
        {t.caddieLog.back}
      </Link>
      </div>
      </div>
    </div>
  );
}
