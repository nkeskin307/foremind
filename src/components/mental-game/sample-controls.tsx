"use client";

import { useState } from "react";
import { clearSampleData, loadSampleRounds } from "@/lib/mental-game/sample-rounds";
import { useI18n } from "@/lib/i18n/use-i18n";

/** Visible on everything built from sample rounds. */
export function SampleBadge({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-forest bg-sage-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sage ${className}`}
    >
      {t.sample.badge}
    </span>
  );
}

export function LoadSampleButton({ className = "" }: { className?: string }) {
  const { lang, t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void loadSampleRounds(t, lang).finally(() => setBusy(false));
        }}
        className="inline-flex w-full items-center justify-center rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-forest disabled:opacity-60"
      >
        {t.sample.load}
      </button>
      <p className="mt-1.5 text-center text-xs text-muted">{t.sample.loadHint}</p>
    </div>
  );
}

/** Shown at the top of My Mental Game whenever sample rounds are loaded. */
export function SampleBanner() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-6 rounded-2xl border border-forest bg-sage-soft px-4 py-3">
      <div className="flex items-start gap-2">
        <SampleBadge className="mt-0.5" />
        <p className="text-xs text-foreground">{t.sample.banner}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void clearSampleData().finally(() => setBusy(false));
        }}
        className="mt-2 text-xs font-semibold text-foreground underline underline-offset-2 disabled:opacity-60"
      >
        {t.sample.clear}
      </button>
    </div>
  );
}
