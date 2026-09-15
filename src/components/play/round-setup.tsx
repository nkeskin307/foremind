"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ActiveRound } from "@/components/play/active-round";
import { FlagIcon } from "@/components/icons/flag-icon";
import { FlagstickMotif } from "@/components/motifs/flagstick-motif";
import type { PreRoundCheckIn } from "@/lib/play/round-data";
import {
  getActiveRoundSnapshot,
  parseActiveRoundSnapshot,
} from "@/lib/play/active-round-storage";

type HoleCount = 9 | 18;

function subscribeToNothing() {
  return () => {};
}

function getServerActiveRoundSnapshot() {
  return "";
}

export function RoundSetup({ preRound }: { preRound: PreRoundCheckIn }) {
  const [course, setCourse] = useState("");
  const [holes, setHoles] = useState<HoleCount>(18);
  const [round, setRound] = useState<{ course: string; holes: HoleCount } | null>(
    null,
  );
  const rawActiveRound = useSyncExternalStore(
    subscribeToNothing,
    getActiveRoundSnapshot,
    getServerActiveRoundSnapshot,
  );
  const resumedRound = useMemo(
    () => parseActiveRoundSnapshot(rawActiveRound),
    [rawActiveRound],
  );

  const isValid = course.trim().length > 0;

  function handleBeginRound() {
    if (!isValid) return;
    setRound({ course: course.trim(), holes });
  }

  if (resumedRound) {
    return (
      <ActiveRound
        courseName={resumedRound.course}
        totalHoles={resumedRound.holes}
        preRound={resumedRound.preRound}
        initialActiveRound={resumedRound}
      />
    );
  }

  if (round) {
    return (
      <ActiveRound
        courseName={round.course}
        totalHoles={round.holes}
        preRound={preRound}
        initialActiveRound={null}
      />
    );
  }

  return (
    <div className="relative overflow-hidden">
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -right-14 -top-12 h-[400px] w-auto opacity-[0.36]"
      />
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -bottom-14 -left-14 h-[420px] w-auto -scale-x-100 opacity-[0.3]"
      />
      <div className="relative mx-auto w-full max-w-md px-6 py-16">
      <h1 className="motion-heading flex items-center gap-2.5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        <FlagIcon className="h-6 w-6 text-sage" />
        Let&apos;s play.
      </h1>
      <div className="motion-body">
      <p className="mt-2 text-base text-muted">
        Set up your round and stay focused on the game in front of you.
      </p>

      <div className="mt-8">
        <label htmlFor="course" className="text-sm font-medium text-foreground">
          Course
        </label>
        <input
          id="course"
          type="text"
          value={course}
          onChange={(event) => setCourse(event.target.value)}
          placeholder="Enter course name"
          className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-forest focus:outline-none"
        />
      </div>

      <div className="mt-6">
        <span className="text-sm font-medium text-foreground">Holes</span>
        <div className="mt-2 flex gap-2">
          {([9, 18] as HoleCount[]).map((count) => {
            const isSelected = holes === count;
            return (
              <button
                key={count}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setHoles(count)}
                className={`flex-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? "border-forest bg-forest text-foreground"
                    : "border-border bg-surface text-muted hover:border-forest"
                }`}
              >
                {count} Holes
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleBeginRound}
        disabled={!isValid}
        className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light disabled:opacity-40 disabled:hover:bg-forest"
      >
        Begin Round →
      </button>
      </div>
      </div>
    </div>
  );
}
