"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { VoiceTextareaField } from "@/components/reflection/voice-textarea-field";
import { FlagstickMotif } from "@/components/motifs/flagstick-motif";
import {
  getRoundsSnapshot,
  parseRoundsSnapshot,
  subscribeToRounds,
  upsertCompletedRoundReflection,
  type CompletedRound,
} from "@/lib/mental-game/completed-rounds";
import { requestPostRoundAnalysis } from "@/lib/mental-game/request-analysis";
import {
  getReflectionDraftSnapshot,
  parseReflectionDraftSnapshot,
  saveReflectionDraft,
  clearReflectionDraft,
  type ReflectionDraft,
} from "@/lib/reflection/reflection-draft-storage";
import { useI18n } from "@/lib/i18n/use-i18n";
import { resizePhoto } from "@/lib/photos/resize-photo";
import { saveRoundPhoto, useRoundPhotoUrl } from "@/lib/photos/photo-store";
import { RoundPhoto } from "@/components/photos/round-photo";
import { SampleBadge } from "@/components/mental-game/sample-controls";

const EMPTY_DRAFT: ReflectionDraft = { whatWorked: "", whatGotInHead: "", whatToRemember: "" };

function subscribeToNothing() {
  return () => {};
}

function getServerEmptySnapshot() {
  return "";
}

/**
 * Loads the completed round by id (the URL only carries ?id=…) and shows a
 * friendly message with a link to My Mental Game if it can't be found.
 */
export function ReflectionForm({ roundId }: { roundId: string | null }) {
  const { t } = useI18n();
  // "" on the server / during hydration = still loading.
  const rawRounds = useSyncExternalStore(subscribeToRounds, getRoundsSnapshot, getServerEmptySnapshot);
  const round = useMemo(
    () =>
      rawRounds && roundId
        ? (parseRoundsSnapshot(rawRounds).find((item) => item.id === roundId) ?? null)
        : null,
    [rawRounds, roundId],
  );

  if (!rawRounds) return null;

  if (!round) {
    return (
      <div className="relative mx-auto w-full max-w-md px-6 py-16 text-center">
        <h1 className="motion-heading text-2xl font-bold tracking-tight text-foreground">
          {t.reflection.notFoundTitle}
        </h1>
        <p className="motion-body mt-3 text-sm text-muted">{t.reflection.notFoundBody}</p>
        <Link
          href="/mental-game"
          className="motion-body mt-8 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
        >
          {t.reflection.goToMentalGame}
        </Link>
      </div>
    );
  }

  return <ReflectionFormBody key={round.id} roundData={round} roundId={round.id} />;
}

function ReflectionFormBody({
  roundData,
  roundId,
}: {
  roundData: CompletedRound;
  roundId: string;
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

  // Optional photo: resized on pick, written to IndexedDB on Save.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickedPhoto, setPickedPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [photoStatus, setPhotoStatus] = useState<"idle" | "processing" | "read-error">("idle");
  const [photoSaveFailed, setPhotoSaveFailed] = useState(false);
  const storedPhotoUrl = useRoundPhotoUrl(roundId);
  const pickedUrl = pickedPhoto?.url ?? null;

  // Free the preview's object URL when it's replaced or the page closes.
  useEffect(() => {
    if (!pickedUrl) return;
    return () => URL.revokeObjectURL(pickedUrl);
  }, [pickedUrl]);

  async function handlePhotoPicked(file: File | undefined) {
    if (!file) return;
    setPhotoStatus("processing");
    setSaved(null);
    try {
      const blob = await resizePhoto(file);
      setPickedPhoto({ blob, url: URL.createObjectURL(blob) });
      setPhotoStatus("idle");
    } catch {
      setPhotoStatus("read-error");
    }
  }

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
    const completed = upsertCompletedRoundReflection(roundId, roundData, reflection);

    if (roundId) clearReflectionDraft(roundId);
    setSaved(completed);
    void requestPostRoundAnalysis(completed);

    // The round is already saved above; the photo is a best-effort extra.
    if (pickedPhoto) {
      setPhotoSaveFailed(false);
      saveRoundPhoto(completed.id, pickedPhoto.blob)
        .then(() => setPickedPhoto(null))
        .catch(() => setPhotoSaveFailed(true));
    }
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
      {roundData.sample && <SampleBadge className="mt-2" />}
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

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handlePhotoPicked(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {pickedPhoto ? (
            <div>
              {/* A local blob: URL preview — next/image adds nothing here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pickedPhoto.url}
                alt={t.photo.alt(roundData.course)}
                className="h-40 w-full rounded-2xl border border-border object-cover"
              />
              <div className="mt-1.5 flex gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-muted underline underline-offset-2 hover:text-foreground"
                >
                  {t.photo.changePhoto}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPickedPhoto(null);
                    setSaved(null);
                  }}
                  className="text-muted underline underline-offset-2 hover:text-foreground"
                >
                  {t.photo.remove}
                </button>
              </div>
            </div>
          ) : storedPhotoUrl && roundId ? (
            <div>
              <RoundPhoto
                roundId={roundId}
                alt={t.photo.alt(roundData.course)}
                imageClassName="h-40 w-full"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 text-xs text-muted underline underline-offset-2 hover:text-foreground"
              >
                {t.photo.changePhoto}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoStatus === "processing"}
                className="inline-flex items-center justify-center rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-muted transition-colors hover:border-forest hover:text-foreground disabled:opacity-60"
              >
                {photoStatus === "processing" ? t.photo.processing : `+ ${t.photo.addPhoto}`}
              </button>
              <p className="mt-1.5 text-xs text-muted">{t.photo.hint}</p>
            </>
          )}
          {photoStatus === "read-error" && (
            <p className="mt-1.5 text-xs text-muted">{t.photo.readError}</p>
          )}
        </div>
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
          {photoSaveFailed && <p className="text-xs text-muted">{t.photo.saveFailed}</p>}
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
