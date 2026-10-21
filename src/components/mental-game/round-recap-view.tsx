"use client";

import type { ReactNode } from "react";
import { SparkleIcon } from "@/components/icons/sparkle-icon";
import type { CompletedRound, PostRoundAnalysis } from "@/lib/mental-game/completed-rounds";
import { computeRecapGlance } from "@/lib/mental-game/round-recap";
import { formatToPar } from "@/lib/play/round-data";
import { useI18n } from "@/lib/i18n/use-i18n";

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

function GlanceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <p className="text-sm font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{label}</p>
    </div>
  );
}

/** Round Recap: AI (or fallback) story sections around an at-a-glance block computed in code. */
export function RoundRecapView({ round, recap }: { round: CompletedRound; recap: PostRoundAnalysis }) {
  const { t } = useI18n();
  const r = t.recap;
  const glance = computeRecapGlance(round);
  const dash = "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sage">
        <SparkleIcon className="h-3 w-3" />
        {r.title}
      </div>

      {recap.headline && <p className="text-base font-semibold text-foreground">{recap.headline}</p>}

      <div>
        <p className="text-xs font-medium text-muted">{t.glance.title}</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <GlanceItem
            label={t.dashboard.scoreVsPar}
            value={
              glance.toPar === null
                ? dash
                : `${formatToPar(glance.toPar)}${
                    glance.holesScored < glance.holes
                      ? ` · ${t.dashboard.partialHoles(glance.holesScored, glance.holes)}`
                      : ""
                  }`
            }
          />
          <GlanceItem
            label={r.bestStretch}
            value={
              glance.bestStretch
                ? r.rangeValue(glance.bestStretch.first, glance.bestStretch.last, formatToPar(glance.bestStretch.toPar))
                : dash
            }
          />
          <GlanceItem
            label={r.toughestHole}
            value={
              glance.toughestHole
                ? r.holeValue(glance.toughestHole.hole, formatToPar(glance.toughestHole.toPar))
                : dash
            }
          />
          <GlanceItem
            label={`${r.moodsLogged} · ${r.resetCards}`}
            value={`${glance.moodsLogged} · ${glance.resetCards}`}
          />
        </div>
      </div>

      {recap.turningPoint && (
        <Section label={recap.turningPoint.hole ? `${r.turningPoint} · ${t.common.hole(recap.turningPoint.hole)}` : r.turningPoint}>
          {recap.turningPoint.text}
        </Section>
      )}

      {recap.whatWorked.length > 0 && (
        <Section label={r.whatWorked}>
          <ul className="list-disc space-y-1 pl-4">
            {recap.whatWorked.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Section>
      )}

      {recap.tryThis && (
        <div className="rounded-xl border border-forest bg-sage-soft px-3 py-2.5">
          <p className="text-xs font-semibold text-sage">{r.tryThis}</p>
          <p className="mt-1 text-sm text-foreground">{recap.tryThis}</p>
        </div>
      )}

      {recap.patternWatch && <Section label={r.patternWatch}>{recap.patternWatch}</Section>}
    </div>
  );
}
