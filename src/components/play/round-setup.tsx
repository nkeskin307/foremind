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
  formatRoundDate,
  normalizeCourseName,
  type CourseHistory,
} from "@/lib/mental-game/course-history";
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
  const last = history.rounds[0];
  const topState = last.topStates[0];
  return (
    <div className="motion-fade mt-4 rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-sage">
        Last time at {history.displayName}
      </p>
      <p className="mt-1 text-xs text-muted">
        {formatRoundDate(last.date)} · {last.holes} Holes
        {history.rounds.length > 1 ? ` · ${history.rounds.length} rounds here` : ""}
      </p>
      <p className="mt-2 text-sm text-foreground">
        {last.holesScored > 0
          ? `${last.total} (${formatToPar(last.toPar)})${
              last.holesScored < last.holes
                ? ` · ${last.holesScored} of ${last.holes} holes scored`
                : ""
            }`
          : "No holes were scored."}
      </p>
      <p className="mt-1 text-sm text-foreground">
        {topState
          ? `Most common mental state: ${topState.state} (${topState.count} hole${
              topState.count === 1 ? "" : "s"
            })`
          : "No mental states logged."}
      </p>
      {last.whatToRemember ? (
        <p className="mt-2 text-sm text-foreground">
          <span className="text-muted">You wanted to remember: </span>
          &ldquo;{last.whatToRemember}&rdquo;
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">No reflection was saved for that round.</p>
      )}
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
            Unfinished round
          </h1>
          <div className="motion-body">
            <p className="mt-2 text-base text-muted">
              You have an unfinished round at {resumedRound.course || "your course"} (hole{" "}
              {resumedRound.currentHole + 1} of {resumedRound.holes}). Resume your
              unfinished round or start a new one?
            </p>
            <p className="mt-2 text-xs text-muted">
              Starting a new round discards the unfinished one and uses today&apos;s
              check-in.
            </p>

            <button
              type="button"
              onClick={handleResume}
              className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
            >
              Resume Round
            </button>
            <button
              type="button"
              onClick={handleStartNew}
              className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-forest"
            >
              Start New Round
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

        {courseSuggestions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted">Courses you&apos;ve played</p>
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
