"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VoiceTextareaField } from "@/components/reflection/voice-textarea-field";
import { FlagstickMotif } from "@/components/motifs/flagstick-motif";
import type { RoundData } from "@/lib/play/round-data";
import {
  createCompletedRoundId,
  upsertCompletedRoundReflection,
  updateCompletedRoundAnalysis,
  type CompletedRound,
} from "@/lib/mental-game/completed-rounds";
import {
  loadReflectionDraft,
  saveReflectionDraft,
  clearReflectionDraft,
} from "@/lib/reflection/reflection-draft-storage";

// Fire-and-forget: runs after the reflection is saved so the "Round
// complete." confirmation never waits on the AI call. The route always
// returns an analysis (falling back to a data-only summary if Gemini
// fails), so this just persists whatever comes back.
async function generatePostRoundAnalysis(round: CompletedRound): Promise<void> {
  try {
    const res = await fetch("/api/post-round-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ round }),
    });
    const data = await res.json();
    if (data && data.analysis) {
      updateCompletedRoundAnalysis(round.id, data.analysis);
    }
  } catch {
    // Best-effort background analysis — a failed request just means My
    // Mental Game won't have an analysis for this round yet.
  }
}

export function ReflectionForm({
  roundData,
  roundId,
}: {
  roundData: RoundData;
  roundId: string | null;
}) {
  const [whatWorked, setWhatWorked] = useState(
    () => (roundId ? loadReflectionDraft(roundId) : null)?.whatWorked ?? "",
  );
  const [whatGotInHead, setWhatGotInHead] = useState(
    () => (roundId ? loadReflectionDraft(roundId) : null)?.whatGotInHead ?? "",
  );
  const [whatToRemember, setWhatToRemember] = useState(
    () => (roundId ? loadReflectionDraft(roundId) : null)?.whatToRemember ?? "",
  );
  const [saved, setSaved] = useState<CompletedRound | null>(null);

  const isValid =
    whatWorked.trim().length > 0 &&
    whatGotInHead.trim().length > 0 &&
    whatToRemember.trim().length > 0;

  // Autosave so answers typed but not yet submitted survive navigating away
  // (e.g. Back) and back again — mirrors the active-round autosave pattern.
  useEffect(() => {
    if (!roundId) return;
    saveReflectionDraft(roundId, { whatWorked, whatGotInHead, whatToRemember });
  }, [roundId, whatWorked, whatGotInHead, whatToRemember]);

  function handleSave() {
    if (!isValid) return;

    const reflection = {
      whatWorked: whatWorked.trim(),
      whatGotInHead: whatGotInHead.trim(),
      whatToRemember: whatToRemember.trim(),
    };

    // The normal path: the round was already saved into completed-round
    // history when "Finish Round" was clicked, so this just fills in its
    // reflection — never a duplicate. Only if that round can't be found
    // (e.g. a hand-edited URL missing the id) does this create one fresh.
    const completed = upsertCompletedRoundReflection(
      roundId ?? createCompletedRoundId(),
      roundData,
      reflection,
    );

    if (roundId) clearReflectionDraft(roundId);
    setSaved(completed);
    void generatePostRoundAnalysis(completed);
  }

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
        Reflect on your round
      </h1>
      <div className="motion-body">
      <p className="mt-2 text-base text-muted">
        Take a minute to understand what helped — and what got in your way.
      </p>

      <div className="mt-8 space-y-6">
        <VoiceTextareaField
          id="what-worked"
          label="What worked well mentally today?"
          value={whatWorked}
          onChange={(value) => {
            setWhatWorked(value);
            setSaved(null);
          }}
        />

        <VoiceTextareaField
          id="what-got-in-head"
          label="What got in your head?"
          value={whatGotInHead}
          onChange={(value) => {
            setWhatGotInHead(value);
            setSaved(null);
          }}
        />

        <VoiceTextareaField
          id="what-to-remember"
          label="What do you want to remember next round?"
          value={whatToRemember}
          onChange={(value) => {
            setWhatToRemember(value);
            setSaved(null);
          }}
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!isValid}
        className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light disabled:opacity-40 disabled:hover:bg-forest"
      >
        Save Reflection
      </button>

      {saved && (
        <div className="motion-fade mt-4 space-y-4 text-center">
          <p className="text-sm text-sage">Round complete.</p>
          <Link
            href="/mental-game"
            className="inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
          >
            View My Mental Game →
          </Link>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
