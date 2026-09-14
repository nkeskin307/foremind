"use client";

import { useState, type FormEvent } from "react";
import { MentalScale } from "./mental-scale";
import { RoutinePreviewCard } from "./routine-preview-card";
import { ArrowRightIcon } from "@/components/icons";
import type { MentalCheckIn } from "@/types/check-in";

const DEFAULT_CHECK_IN: MentalCheckIn = {
  confidence: 3,
  focus: 4,
  energy: 4,
  nerves: 2,
  note: "",
};

export function CheckInCard() {
  const [checkIn, setCheckIn] = useState<MentalCheckIn>(DEFAULT_CHECK_IN);
  const [submittedCheckIn, setSubmittedCheckIn] = useState<MentalCheckIn | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof MentalCheckIn>(field: K, value: MentalCheckIn[K]) {
    setCheckIn((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (checkIn.note.trim().length === 0) {
      setError("Share a quick thought before building your routine.");
      setSubmittedCheckIn(null);
      return;
    }

    setError(null);
    setSubmittedCheckIn(checkIn);
  }

  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        1-minute mental check-in
      </h2>
      <p className="mt-0.5 text-sm text-muted">Rate each area from 1 to 5.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          <MentalScale
            label="Confidence"
            value={checkIn.confidence}
            onChange={(value) => updateField("confidence", value)}
          />
          <MentalScale
            label="Focus"
            value={checkIn.focus}
            onChange={(value) => updateField("focus", value)}
          />
          <MentalScale
            label="Energy"
            value={checkIn.energy}
            onChange={(value) => updateField("energy", value)}
          />
          <MentalScale
            label="Nerves"
            value={checkIn.nerves}
            onChange={(value) => updateField("nerves", value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pre-round-note" className="text-sm font-medium text-foreground">
            {"What's on your mind before today's round?"}
          </label>
          <textarea
            id="pre-round-note"
            rows={3}
            value={checkIn.note}
            onChange={(event) => updateField("note", event.target.value)}
            placeholder="I'm playing with better golfers today and I'm worried I'll slow them down…"
            aria-describedby={error ? "pre-round-note-error" : undefined}
            className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-light"
          />
          {error ? (
            <p id="pre-round-note-error" role="alert" className="text-sm text-red-400">
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-light focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
        >
          Build My Routine
          <ArrowRightIcon
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      </form>

      {submittedCheckIn ? <RoutinePreviewCard checkIn={submittedCheckIn} /> : null}
    </section>
  );
}
