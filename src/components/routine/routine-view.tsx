"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { FlagstickMotif } from "@/components/motifs/flagstick-motif";
import { generateRoutine, personalRoutineLine } from "@/lib/prepare/generate-routine";
import { EMPTY_CHECK_IN } from "@/lib/prepare/check-in-params";
import {
  getLatestCheckInSnapshot,
  parseLatestCheckInSnapshot,
} from "@/lib/prepare/latest-check-in-storage";
import { useI18n } from "@/lib/i18n/use-i18n";

const SERVER_SNAPSHOT = "__server__";

function subscribeToNothing() {
  return () => {};
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

export function RoutineView() {
  const { t } = useI18n();
  // The check-in comes from localStorage (saved on submit), not the URL.
  const rawCheckIn = useSyncExternalStore(
    subscribeToNothing,
    getLatestCheckInSnapshot,
    getServerSnapshot,
  );
  const isServer = rawCheckIn === SERVER_SNAPSHOT;
  const checkIn = useMemo(
    () => (isServer ? null : parseLatestCheckInSnapshot(rawCheckIn)) ?? EMPTY_CHECK_IN,
    [isServer, rawCheckIn],
  );

  const ratings = { focus: checkIn.focus, energy: checkIn.energy, confidence: checkIn.confidence };
  const routine = generateRoutine(ratings, checkIn.note, t);
  const personalLine = personalRoutineLine(ratings, checkIn.note, t);

  const sections = [
    { title: t.routine.focusToday, text: routine.focusMindset },
    { title: t.routine.beforeFirstTee, text: routine.teePrep },
    { title: t.routine.physicalReset, text: routine.physicalReset },
    { title: t.routine.ifWrong, text: routine.reset },
  ];

  return (
    <div className="relative overflow-hidden">
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -right-14 -top-12 h-[400px] w-auto opacity-[0.32]"
      />
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -bottom-14 -left-14 h-[420px] w-auto -scale-x-100 opacity-[0.36]"
      />
      <div className="relative mx-auto w-full max-w-md px-6 py-16">
        <h1 className="motion-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t.routine.title}
        </h1>
        {/* Wait for the saved check-in so the routine never flashes a generic version. */}
        {!isServer && (
          <div className="motion-body">
            <p className="mt-2 text-base text-muted">{t.routine.subtitle}</p>

            {personalLine && (
              <p className="mt-6 rounded-2xl border border-forest bg-sage-soft px-4 py-3 text-sm text-foreground">
                {personalLine}
              </p>
            )}

            <div className="mt-8 space-y-6">
              {sections.map((section) => (
                <section key={section.title}>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-sage">
                    {section.title}
                  </h2>
                  <p className="mt-2 text-sm text-foreground">{section.text}</p>
                </section>
              ))}
            </div>

            <Link
              href="/play"
              className="mt-10 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
            >
              {t.routine.start}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
