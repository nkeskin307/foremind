"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ActiveRound } from "@/components/play/active-round";
import { FlagIcon } from "@/components/icons/flag-icon";
import { FlagstickMotif } from "@/components/motifs/flagstick-motif";
import { formatToPar, type PreRoundCheckIn } from "@/lib/play/round-data";
import { getRoundsSnapshot, parseRoundsSnapshot } from "@/lib/mental-game/completed-rounds";
import {
  buildCourseHistories,
  findCourseHistory,
  normalizeCourseName,
  type CourseHistory,
} from "@/lib/mental-game/course-history";
import { useI18n } from "@/lib/i18n/use-i18n";
import { stateLabel } from "@/lib/i18n";
import { formatDate } from "@/lib/i18n/format";
import { RoundPhoto } from "@/components/photos/round-photo";
import {
  clearActiveRound,
  getActiveRoundSnapshot,
  parseActiveRoundSnapshot,
} from "@/lib/play/active-round-storage";
import {
  getLatestCheckInSnapshot,
  markLatestCheckInHandled,
  parseLatestCheckInSnapshot,
} from "@/lib/prepare/latest-check-in-storage";

type HoleCount = 9 | 18;

function subscribeToNothing() {
  return () => {};
}

function getServerEmptySnapshot() {
  return "";
}

function getServerRoundsSnapshot() {
  return "[]";
}

const MAX_COURSE_SUGGESTIONS = 5;

function LastTimeCard({ history }: { history: CourseHistory }) {
  const { lang, t } = useI18n();
  const last = history.rounds[0];
  const topState = last.topStates[0];
  return (
    <div className="motion-fade mt-4 rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-sage">
        {t.setup.lastTimeAt(history.displayName)}
      </p>
      <p className="mt-1 text-xs text-muted">
        {formatDate(last.date, lang, t.common.unknownDate)} · {t.common.holesCount(last.holes)}
        {history.rounds.length > 1 ? ` · ${t.setup.roundsHere(history.rounds.length)}` : ""}
      </p>
      <p className="mt-2 text-sm text-foreground">
        {last.holesScored > 0
          ? `${last.total} (${formatToPar(last.toPar)})${
              last.holesScored < last.holes
                ? ` · ${t.setup.holesScoredOf(last.holesScored, last.holes)}`
                : ""
            }`
          : t.setup.noHolesScored}
      </p>
      <p className="mt-1 text-sm text-foreground">
        {topState
          ? t.setup.mostCommonState(stateLabel(t, topState.state), topState.count)
          : t.setup.noStates}
      </p>
      {last.whatToRemember ? (
        <p className="mt-2 text-sm text-foreground">
          <span className="text-muted">{t.setup.rememberLabel} </span>
          &ldquo;{last.whatToRemember}&rdquo;
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">{t.setup.noReflection}</p>
      )}
      <RoundPhoto
        roundId={last.id}
        alt={t.photo.alt(history.displayName)}
        imageClassName="h-32 w-full"
        className="mt-3"
      />
    </div>
  );
}

function hasCheckInData(checkIn: PreRoundCheckIn): boolean {
  return (
    checkIn.focus !== null ||
    checkIn.energy !== null ||
    checkIn.confidence !== null ||
    checkIn.note.trim().length > 0
  );
}

export function RoundSetup({ preRound }: { preRound: PreRoundCheckIn }) {
  const { t } = useI18n();
  const [course, setCourse] = useState("");
  const [holes, setHoles] = useState<HoleCount>(18);
  const [round, setRound] = useState<{ course: string; holes: HoleCount } | null>(
    null,
  );
  const [resumeChoice, setResumeChoice] = useState<"resume" | "new" | null>(null);
  const rawActiveRound = useSyncExternalStore(
    subscribeToNothing,
    getActiveRoundSnapshot,
    getServerEmptySnapshot,
  );
  const activeRound = useMemo(
    () => parseActiveRoundSnapshot(rawActiveRound),
    [rawActiveRound],
  );
  const rawLatestCheckIn = useSyncExternalStore(
    subscribeToNothing,
    getLatestCheckInSnapshot,
    getServerEmptySnapshot,
  );
  const latestCheckIn = useMemo(
    () => parseLatestCheckInSnapshot(rawLatestCheckIn),
    [rawLatestCheckIn],
  );

  // The URL carries the check-in on the normal prepare → routine → play
  // path. When it's missing (Restart Round, "Start a Round" from My Mental
  // Game), fall back to the latest submitted check-in.
  const roundPreRound = useMemo<PreRoundCheckIn>(() => {
    if (hasCheckInData(preRound) || !latestCheckIn) return preRound;
    return {
      focus: latestCheckIn.focus,
      energy: latestCheckIn.energy,
      confidence: latestCheckIn.confidence,
      note: latestCheckIn.note,
    };
  }, [preRound, latestCheckIn]);

  const resumedRound = resumeChoice === "new" ? null : activeRound;

  // A check-in submitted after the unfinished round started, and not yet
  // acted on, means the golfer is starting a new session — ask first.
  const newCheckInArrived =
    resumedRound !== null &&
    latestCheckIn !== null &&
    !latestCheckIn.handled &&
    new Date(latestCheckIn.submittedAt).getTime() > new Date(resumedRound.date).getTime();

  const rawRounds = useSyncExternalStore(
    subscribeToNothing,
    getRoundsSnapshot,
    getServerRoundsSnapshot,
  );
  const courseHistories = useMemo(
    () => buildCourseHistories(parseRoundsSnapshot(rawRounds)),
    [rawRounds],
  );
  const matchedHistory = findCourseHistory(courseHistories, course);
  const typedKey = normalizeCourseName(course);
  const courseSuggestions = courseHistories
    .filter((history) => history.key !== typedKey && history.key.includes(typedKey))
    .slice(0, MAX_COURSE_SUGGESTIONS);

  const isValid = course.trim().length > 0;

  function handleBeginRound() {
    if (!isValid) return;
    markLatestCheckInHandled();
    // Reuse the saved spelling for a course played before, so history
    // stays grouped under one name.
    setRound({ course: matchedHistory?.displayName ?? course.trim(), holes });
  }

  function handleResume() {
    markLatestCheckInHandled();
    setResumeChoice("resume");
  }

  function handleStartNew() {
    clearActiveRound();
    setResumeChoice("new");
  }

  if (resumedRound && newCheckInArrived && resumeChoice === null) {
    return (
      <div className="relative overflow-hidden">
        <FlagstickMotif
          className="motif-flag-glow pointer-events-none absolute -right-14 -top-12 h-[400px] w-auto opacity-[0.36]"
        />
        <div className="relative mx-auto w-full max-w-md px-6 py-16">
          <h1 className="motion-heading flex items-center gap-2.5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            <FlagIcon className="h-6 w-6 text-sage" />
            {t.setup.unfinishedTitle}
          </h1>
          <div className="motion-body">
            <p className="mt-2 text-base text-muted">
              {t.setup.unfinishedBody(
                resumedRound.course || t.setup.yourCourse,
                resumedRound.currentHole + 1,
                resumedRound.holes,
              )}
            </p>
            <p className="mt-2 text-xs text-muted">
              {t.setup.unfinishedNote}
            </p>

            <button
              type="button"
              onClick={handleResume}
              className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
            >
              {t.setup.resume}
            </button>
            <button
              type="button"
              onClick={handleStartNew}
              className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-forest"
            >
              {t.setup.startNew}
            </button>
          </div>
        </div>
      </div>
    );
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
        preRound={roundPreRound}
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
        {t.setup.title}
      </h1>
      <div className="motion-body">
      <p className="mt-2 text-base text-muted">
        {t.setup.subtitle}
      </p>

      <div className="mt-8">
        <label htmlFor="course" className="text-sm font-medium text-foreground">
          {t.setup.course}
        </label>
        <input
          id="course"
          type="text"
          value={course}
          onChange={(event) => setCourse(event.target.value)}
          placeholder={t.setup.coursePlaceholder}
          className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-forest focus:outline-none"
        />

        {courseSuggestions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted">{t.setup.coursesPlayed}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {courseSuggestions.map((history) => (
                <button
                  key={history.key}
                  type="button"
                  onClick={() => setCourse(history.displayName)}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-forest hover:text-foreground"
                >
                  {history.displayName}
                </button>
              ))}
            </div>
          </div>
        )}

        {matchedHistory && <LastTimeCard history={matchedHistory} />}
      </div>

      <div className="mt-6">
        <span className="text-sm font-medium text-foreground">{t.setup.holes}</span>
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
                {t.common.holesCount(count)}
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
        {t.setup.begin}
      </button>
      </div>
      </div>
    </div>
  );
}
