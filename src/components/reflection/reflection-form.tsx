"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  getReflectionDraftSnapshot,
  parseReflectionDraftSnapshot,
  saveReflectionDraft,
  clearReflectionDraft,
  type ReflectionDraft,
} from "@/lib/reflection/reflection-draft-storage";
import { useI18n } from "@/lib/i18n/use-i18n";
import { getLanguageSnapshot } from "@/lib/i18n/language-store";

const EMPTY_DRAFT: ReflectionDraft = { whatWorked: "", whatGotInHead: "", whatToRemember: "" };

function subscribeToNothing() {
  return () => {};
}

function getServerEmptySnapshot() {
  return "";
}

// Fire-and-forget: runs after the reflection is saved so the "Round
// complete." confirmation never waits on the AI call. The route always
// returns an analysis (falling back to a data-only summary if Gemini
// fails), so this just persists whatever comes back.
async function generatePostRoundAnalysis(round: CompletedRound): Promise<void> {
  try {
    const res = await fetch("/api/post-round-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The analysis is written in the app language chosen at save time.
      body: JSON.stringify({ round, language: getLanguageSnapshot() }),
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
  const { t } = useI18n();
  // Read the draft after mount (server + hydration render see ""), so the
  // saved answers never cause a hydration mismatch.
  const rawDraft = useSyncExternalStore(
    subscribeToNothing,
    () => (roundId ? getReflectionDraftSnapshot(roundId) : ""),
    getServerEmptySnapshot,
  );
  const savedDraft = useMemo(
    () => parseReflectionDraftSnapshot(rawDraft) ?? EMPTY_DRAFT,
    [rawDraft],
  );
  // null until the golfer types; until then the saved draft shows.
  const [edits, setEdits] = useState<ReflectionDraft | null>(null);
  const { whatWorked, whatGotInHead, whatToRemember } = edits ?? savedDraft;
  const [saved, setSaved] = useState<CompletedRound | null>(null);

  function updateField(field: keyof ReflectionDraft, value: string) {
    setEdits((prev) => ({ ...(prev ?? savedDraft), [field]: value }));
    setSaved(null);
  }

  const isValid =
    whatWorked.trim().length > 0 &&
    whatGotInHead.trim().length > 0 &&
    whatToRemember.trim().length > 0;

  // Autosave so answers typed but not yet submitted survive navigating away
  // (e.g. Back) and back again — mirrors the active-round autosave pattern.
  useEffect(() => {
    if (!roundId || !edits) return;
    saveReflectionDraft(roundId, edits);
  }, [roundId, edits]);

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
        {t.reflection.title}
      </h1>
      <div className="motion-body">
      <p className="mt-2 text-base text-muted">
        {t.reflection.subtitle}
      </p>

      <div className="mt-8 space-y-6">
        <VoiceTextareaField
          id="what-worked"
          label={t.reflection.whatWorked}
          value={whatWorked}
          onChange={(value) => updateField("whatWorked", value)}
        />

        <VoiceTextareaField
          id="what-got-in-head"
          label={t.reflection.whatGotInHead}
          value={whatGotInHead}
          onChange={(value) => updateField("whatGotInHead", value)}
        />

        <VoiceTextareaField
          id="what-to-remember"
          label={t.reflection.whatToRemember}
          value={whatToRemember}
          onChange={(value) => updateField("whatToRemember", value)}
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!isValid}
        className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light disabled:opacity-40 disabled:hover:bg-forest"
      >
        {t.reflection.save}
      </button>

      {saved && (
        <div className="motion-fade mt-4 space-y-4 text-center">
          <p className="text-sm text-sage">{t.reflection.complete}</p>
          <Link
            href="/mental-game"
            className="inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
          >
            {t.reflection.viewMentalGame}
          </Link>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
