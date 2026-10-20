"use client";

import Link from "next/link";
import { FlagstickMotif } from "@/components/motifs/flagstick-motif";
import { generateRoutine } from "@/lib/prepare/generate-routine";
import { checkInToQueryString, type CheckInQueryData } from "@/lib/prepare/check-in-params";
import { useI18n } from "@/lib/i18n/use-i18n";

export function RoutineView({ checkIn }: { checkIn: CheckInQueryData }) {
  const { t } = useI18n();
  const routine = generateRoutine(
    { focus: checkIn.focus, energy: checkIn.energy, confidence: checkIn.confidence },
    checkIn.note,
    t,
  );
  const forwardedQuery = checkInToQueryString(checkIn);
  const playHref = forwardedQuery ? `/play?${forwardedQuery}` : "/play";

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
        <div className="motion-body">
          <p className="mt-2 text-base text-muted">{t.routine.subtitle}</p>

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
            href={playHref}
            className="mt-10 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
          >
            {t.routine.start}
          </Link>
        </div>
      </div>
    </div>
  );
}
