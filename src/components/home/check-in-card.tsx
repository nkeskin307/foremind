"use client";

import { useState, type FormEvent } from "react";
import { MentalSlider } from "./mental-slider";
import { RoutinePreviewCard } from "./routine-preview-card";
import type { MentalCheckIn } from "@/types/check-in";

const DEFAULT_CHECK_IN: MentalCheckIn = {
  confidence: 6,
  focus: 7,
  energy: 7,
  nerves: 4,
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
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold text-charcoal">{"How's your head today?"}</h2>

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <MentalSlider
            id="confidence"
            label="Confidence"
            value={checkIn.confidence}
            onChange={(value) => updateField("confidence", value)}
          />
          <MentalSlider
            id="focus"
            label="Focus"
            value={checkIn.focus}
            onChange={(value) => updateField("focus", value)}
          />
          <MentalSlider
            id="energy"
            label="Energy"
            value={checkIn.energy}
            onChange={(value) => updateField("energy", value)}
          />
          <MentalSlider
            id="nerves"
            label="Nerves"
            value={checkIn.nerves}
            onChange={(value) => updateField("nerves", value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="pre-round-note" className="text-sm font-medium text-charcoal">
            {"What's on your mind before today's round?"}
          </label>
          <textarea
            id="pre-round-note"
            rows={4}
            value={checkIn.note}
            onChange={(event) => updateField("note", event.target.value)}
            placeholder="I'm playing with better golfers today and I'm worried I'll slow them down…"
            aria-describedby={error ? "pre-round-note-error" : undefined}
            className="w-full resize-none rounded-2xl border border-border bg-cream/60 px-4 py-3 text-sm text-charcoal placeholder:text-charcoal-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
          />
          {error ? (
            <p id="pre-round-note-error" role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:w-auto"
        >
          Build My Pre-Round Routine
        </button>
      </form>

      {submittedCheckIn ? <RoutinePreviewCard checkIn={submittedCheckIn} /> : null}
    </div>
  );
}
