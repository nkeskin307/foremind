"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ScorecardIcon } from "@/components/icons/scorecard-icon";
import { SparkleIcon } from "@/components/icons/sparkle-icon";
import { HistoryIcon } from "@/components/icons/history-icon";
import { FlagstickMotif } from "@/components/motifs/flagstick-motif";
import {
  getRoundsSnapshot,
  parseRoundsSnapshot,
  type CompletedRound,
  type PostRoundAnalysis,
} from "@/lib/mental-game/completed-rounds";
import { formatToPar, summarizeScores } from "@/lib/play/round-data";
import {
  getCaddieLogSnapshot,
  parseCaddieLogSnapshot,
} from "@/lib/caddie/caddie-log-storage";

const RECENT_WINDOW = 5;

const DIFFICULT_STATES = ["Frustrated", "Rushed", "Overthinking"];

const FOCUS_HEADLINES: Record<string, string> = {
  Frustrated: "Reset faster after mistakes.",
  Rushed: "Slow your pace between shots.",
  Overthinking: "Simplify your pre-shot routine.",
};

const THEME_KEYWORDS = [
  "frustrat",
  "rush",
  "compar",
  "nervous",
  "distract",
  "overthink",
  "tempo",
  "breath",
  "patien",
  "calm",
  "confiden",
  "trust",
  "tension",
  "putt",
  "bunker",
  "reset",
  "target",
  "slow down",
  "routine",
];

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getServerRoundsSnapshot() {
  return "[]";
}

function getServerCaddieLogSnapshot() {
  return "[]";
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const value = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Number.isFinite(value) ? value : null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRoundCountLabel(count: number, total: number): string {
  return `${count} of your last ${total} round${total === 1 ? "" : "s"}`;
}

function computeStateRoundCounts(rounds: CompletedRound[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const round of rounds) {
    const statesInRound = new Set(
      round.mentalNotes.filter((state): state is string => Boolean(state)),
    );
    for (const state of statesInRound) {
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
  }
  return counts;
}

function topEntry(counts: Map<string, number>): { state: string; roundCount: number } | null {
  let top: { state: string; roundCount: number } | null = null;
  for (const [state, roundCount] of counts) {
    if (!top || roundCount > top.roundCount) top = { state, roundCount };
  }
  return top;
}

function mostCommonStateInRound(round: CompletedRound): string | null {
  const counts = new Map<string, number>();
  for (const state of round.mentalNotes) {
    if (state) counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  return topEntry(counts)?.state ?? null;
}

type ThemeMatch = { keyword: string; roundCount: number; example: string };

function findRepeatedThemes(
  rounds: CompletedRound[],
  getFields: (round: CompletedRound) => string[],
): ThemeMatch[] {
  const roundsByKeyword = new Map<string, Set<string>>();
  const exampleByKeyword = new Map<string, string>();

  for (const round of rounds) {
    const fields = getFields(round).filter(Boolean);
    if (fields.length === 0) continue;
    const combined = fields.join(" ").toLowerCase();

    for (const keyword of THEME_KEYWORDS) {
      if (combined.includes(keyword)) {
        const ids = roundsByKeyword.get(keyword) ?? new Set<string>();
        ids.add(round.id);
        roundsByKeyword.set(keyword, ids);
        if (!exampleByKeyword.has(keyword)) {
          const source = fields.find((field) => field.toLowerCase().includes(keyword));
          if (source) exampleByKeyword.set(keyword, source);
        }
      }
    }
  }

  return [...roundsByKeyword.entries()]
    .filter(([, ids]) => ids.size >= 2)
    .sort((a, b) => b[1].size - a[1].size)
    .map(([keyword, ids]) => ({
      keyword,
      roundCount: ids.size,
      example: exampleByKeyword.get(keyword) ?? "",
    }))
    .filter((match) => match.example);
}

type Takeaway = { text: string; recurring: boolean };

// Both the fallback analysis and Gemini itself can legitimately say "not
// enough data" for a section when a round is sparse. That's the right call
// for the analysis text itself, but it reads as a confusing non-answer if
// surfaced as if it were a personalized takeaway — so filter it out here.
const NO_DATA_PHRASES = [
  "not enough data",
  "insufficient data",
  "no repeating pattern",
  "no clear pattern",
];

function hasMeaningfulContent(text: string): boolean {
  const lower = text.toLowerCase();
  return !NO_DATA_PHRASES.some((phrase) => lower.includes(phrase));
}

function buildLearningTakeaways(analyzedRounds: CompletedRound[]): Takeaway[] {
  if (analyzedRounds.length === 0) return [];

  if (analyzedRounds.length === 1) {
    const analysis = analyzedRounds[0].analysis as PostRoundAnalysis;
    const items: Takeaway[] = [];
    if (analysis.patternToWatch && hasMeaningfulContent(analysis.patternToWatch)) {
      items.push({ text: analysis.patternToWatch, recurring: false });
    }
    if (analysis.takeIntoNextRound && hasMeaningfulContent(analysis.takeIntoNextRound)) {
      items.push({ text: analysis.takeIntoNextRound, recurring: false });
    }
    return items.slice(0, 2);
  }

  const themes = findRepeatedThemes(analyzedRounds, (round) => {
    const analysis = round.analysis;
    if (!analysis) return [];
    return [analysis.patternToWatch, analysis.whatHelped, analysis.takeIntoNextRound];
  });

  if (themes.length > 0) {
    return themes.slice(0, 3).map((theme) => ({ text: theme.example, recurring: true }));
  }

  const latest = (analyzedRounds[0].analysis as PostRoundAnalysis).takeIntoNextRound;
  return latest && hasMeaningfulContent(latest) ? [{ text: latest, recurring: false }] : [];
}

// Same shape as buildLearningTakeaways above, sourcing the positive
// "whatHelped" field instead of patternToWatch/takeIntoNextRound — reuses
// the same repeated-theme and meaningful-content checks, unchanged.
function buildWhatsHelping(analyzedRounds: CompletedRound[]): Takeaway[] {
  if (analyzedRounds.length === 0) return [];

  if (analyzedRounds.length === 1) {
    const analysis = analyzedRounds[0].analysis as PostRoundAnalysis;
    if (analysis.whatHelped && hasMeaningfulContent(analysis.whatHelped)) {
      return [{ text: analysis.whatHelped, recurring: false }];
    }
    return [];
  }

  const themes = findRepeatedThemes(analyzedRounds, (round) => {
    const analysis = round.analysis;
    if (!analysis) return [];
    return [analysis.whatHelped];
  });

  if (themes.length > 0) {
    return themes.slice(0, 3).map((theme) => ({ text: theme.example, recurring: true }));
  }

  const latest = (analyzedRounds[0].analysis as PostRoundAnalysis).whatHelped;
  return latest && hasMeaningfulContent(latest) ? [{ text: latest, recurring: false }] : [];
}

type CurrentFocus = { headline: string; detail: string };

function buildCurrentFocus(
  recentRounds: CompletedRound[],
  stateRoundCounts: Map<string, number>,
): CurrentFocus | null {
  const difficultCounts = new Map(
    [...stateRoundCounts].filter(([state]) => DIFFICULT_STATES.includes(state)),
  );
  const topDifficult = topEntry(difficultCounts);

  if (topDifficult && topDifficult.roundCount >= 2) {
    return {
      headline: FOCUS_HEADLINES[topDifficult.state] ?? `Notice ${topDifficult.state.toLowerCase()} early.`,
      detail: `${topDifficult.state} has appeared in ${formatRoundCountLabel(
        topDifficult.roundCount,
        recentRounds.length,
      )}, so your next focus is creating a clean break before the next shot.`,
    };
  }

  const reflectionThemes = findRepeatedThemes(recentRounds, (round) => [
    round.reflection.whatWorked,
    round.reflection.whatGotInHead,
    round.reflection.whatToRemember,
  ]);
  if (reflectionThemes.length > 0) {
    return { headline: "Watch this recurring theme.", detail: reflectionThemes[0].example };
  }

  const analyzedRounds = recentRounds.filter((round) => round.analysis);
  const latestTakeaway = analyzedRounds[0]?.analysis?.takeIntoNextRound;
  if (latestTakeaway && hasMeaningfulContent(latestTakeaway)) {
    return { headline: "Carry this into your next round.", detail: latestTakeaway };
  }

  return null;
}

function BaselineStat({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="card-hover rounded-2xl border border-border bg-surface px-3 py-4 text-center">
      {value !== null ? (
        <p className="text-2xl font-bold text-foreground">{value}</p>
      ) : (
        <p className="text-xs text-muted">Not enough data yet</p>
      )}
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

function AnalysisSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-sm text-foreground">{text}</p>
    </div>
  );
}

function RoundCard({
  round,
  isExpanded,
  onToggle,
}: {
  round: CompletedRound;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const commonState = mostCommonStateInRound(round);
  const scoreSummary = summarizeScores(round.scores, round.pars);
  const hasReflection = Boolean(
    round.reflection.whatWorked || round.reflection.whatGotInHead || round.reflection.whatToRemember,
  );

  return (
    <div className="card-hover rounded-2xl border border-border bg-surface px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div>
          <p className="text-sm font-medium text-foreground">
            {round.course.trim() || "Unnamed Course"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {formatDate(round.date)} · {round.holes} Holes
            {commonState ? ` · ${commonState}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">
              {scoreSummary.holesScored > 0 ? scoreSummary.total : "—"}
            </p>
            {scoreSummary.holesScored > 0 && (
              <p className="text-xs text-muted">
                {formatToPar(scoreSummary.toPar)}
                {scoreSummary.holesScored < round.holes
                  ? ` · ${scoreSummary.holesScored}/${round.holes} holes`
                  : ""}
              </p>
            )}
          </div>
          <span
            className={`inline-block text-xs text-muted transition-transform duration-300 ease-out ${
              isExpanded ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Always rendered (not `isExpanded &&`) so the grid-rows transition
          has something to animate between — a CSS-only accordion that
          respects prefers-reduced-motion via the global override. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div aria-hidden={!isExpanded} className="mt-4 space-y-4 border-t border-border pt-4">
            {round.analysis ? (
              <>
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sage">
                  <SparkleIcon className="h-3 w-3" />
                  AI Caddie Review
                </div>
                <AnalysisSection label="What Helped" text={round.analysis.whatHelped} />
                <AnalysisSection
                  label="What Got In Your Way"
                  text={round.analysis.whatGotInYourWay}
                />
                <AnalysisSection label="Pattern To Watch" text={round.analysis.patternToWatch} />
                <AnalysisSection
                  label="Take Into Your Next Round"
                  text={round.analysis.takeIntoNextRound}
                />
              </>
            ) : hasReflection ? (
              <p className="text-sm text-muted">Analysis preparing…</p>
            ) : (
              <p className="text-sm text-muted">No reflection saved for this round yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MentalGameDashboard() {
  const rawRounds = useSyncExternalStore(
    subscribeToStorage,
    getRoundsSnapshot,
    getServerRoundsSnapshot,
  );
  const rounds = useMemo(() => parseRoundsSnapshot(rawRounds), [rawRounds]);

  const rawCaddieLog = useSyncExternalStore(
    subscribeToStorage,
    getCaddieLogSnapshot,
    getServerCaddieLogSnapshot,
  );
  const caddieLog = useMemo(() => parseCaddieLogSnapshot(rawCaddieLog), [rawCaddieLog]);
  const recentCaddieLog = caddieLog.slice(0, 3);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (rounds.length === 0) {
    return (
      <div className="relative overflow-hidden text-center">
        <FlagstickMotif
          className="motif-flag-glow pointer-events-none absolute -right-14 -top-12 h-[400px] w-auto opacity-[0.36]"
        />
        <FlagstickMotif
          className="motif-flag-glow pointer-events-none absolute -bottom-14 -left-14 h-[420px] w-auto -scale-x-100 opacity-[0.3]"
        />
        <div className="relative mx-auto w-full max-w-md px-6 py-16">
        <h1 className="motion-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          My Mental Game
        </h1>
        <div className="motion-body">
        <p className="mt-2 text-base text-muted">
          See what&apos;s happening beyond the score.
        </p>

        <p className="mt-12 text-sm text-muted">
          Your mental game starts with your first round.
        </p>

        <Link
          href="/play"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
        >
          Start a Round →
        </Link>
        </div>
        </div>
      </div>
    );
  }

  const sortedRounds = [...rounds].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const recentRounds = sortedRounds.slice(0, RECENT_WINDOW);

  const focusValues = rounds
    .map((round) => round.preRound.focus)
    .filter((value): value is number => value !== null);
  const energyValues = rounds
    .map((round) => round.preRound.energy)
    .filter((value): value is number => value !== null);
  const confidenceValues = rounds
    .map((round) => round.preRound.confidence)
    .filter((value): value is number => value !== null);

  const averageFocus = average(focusValues);
  const averageEnergy = average(energyValues);
  const averageConfidence = average(confidenceValues);

  const stateRoundCounts = computeStateRoundCounts(recentRounds);
  const topState = topEntry(stateRoundCounts);
  const topDifficultState = topEntry(
    new Map([...stateRoundCounts].filter(([state]) => DIFFICULT_STATES.includes(state))),
  );

  const analyzedRounds = recentRounds.filter((round) => round.analysis);
  const whatToWatch = buildLearningTakeaways(analyzedRounds);
  const whatsHelping = buildWhatsHelping(analyzedRounds);
  const currentFocus = buildCurrentFocus(recentRounds, stateRoundCounts);

  return (
    <div className="relative overflow-hidden">
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -right-14 -top-12 h-[400px] w-auto opacity-[0.34] lg:h-[480px]"
      />
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -bottom-14 -left-14 h-[420px] w-auto -scale-x-100 opacity-[0.28] lg:h-[500px]"
      />
      <div className="relative mx-auto w-full max-w-md px-6 py-16 lg:max-w-4xl">
      <h1 className="motion-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        My Mental Game
      </h1>
      <p className="motion-body mt-2 text-base text-muted">
        See what&apos;s happening beyond the score.
      </p>

      {/* Named grid areas so mobile keeps document order (review, then
          baseline, then recent) while desktop repositions review into a
          right-hand column that spans both left rows — no need to
          duplicate content or fight `order` utilities for two different
          rearrangements at once. */}
      <div
        className="mt-10 lg:grid lg:items-start lg:gap-x-10"
        style={{
          gridTemplateColumns: "38% 62%",
          gridTemplateAreas: '"baseline review" "recent review"',
        }}
      >
        <section className="motion-body" style={{ gridArea: "review" }}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-soft">
              <SparkleIcon className="h-4 w-4 text-sage" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              AI Caddie Review
            </h2>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            What Fore!Mind is learning about your mental game.
          </p>

          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-sage">
              Current Mental Focus
            </h3>
            {currentFocus ? (
              <div className="card-hover motif-dimples mt-3 rounded-3xl border border-forest bg-sage-soft px-6 py-6 shadow-lg shadow-black/20">
                <p className="text-lg font-bold text-foreground sm:text-xl">
                  {currentFocus.headline}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {currentFocus.detail}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Play a few more rounds so Fore!Mind can find a focus area for you.
              </p>
            )}
          </div>

          <div className="mt-7">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-sage">
              Patterns Fore!Mind Is Seeing
            </h3>
            <div className="mt-3 space-y-2">
              {topState && topState.roundCount >= 2 ? (
                <p className="text-sm text-foreground">
                  {topState.state} appeared in{" "}
                  {formatRoundCountLabel(topState.roundCount, recentRounds.length)}.
                </p>
              ) : null}
              {topDifficultState &&
              topDifficultState.roundCount >= 2 &&
              topDifficultState.state !== topState?.state ? (
                <p className="text-sm text-foreground">
                  Most common difficult state: {topDifficultState.state} —{" "}
                  {formatRoundCountLabel(topDifficultState.roundCount, recentRounds.length)}.
                </p>
              ) : null}
              {(!topState || topState.roundCount < 2) && (
                <p className="text-sm text-muted">
                  Not enough repeated mental states yet to show a pattern.
                </p>
              )}
            </div>
          </div>

          <div className="mt-7">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-sage">
              What&apos;s Helping
            </h3>
            {whatsHelping.length > 0 ? (
              <div className="mt-3 space-y-3">
                {whatsHelping.map((takeaway, index) => (
                  <div key={index}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {takeaway.recurring ? "Recurring" : "Recent win"}
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">{takeaway.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Fore!Mind needs a couple more analyzed rounds to spot what&apos;s helping.
              </p>
            )}
          </div>

          <div className="mt-7">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-sage">
              What To Watch
            </h3>
            {whatToWatch.length > 0 ? (
              <div className="mt-3 space-y-3">
                {whatToWatch.map((takeaway, index) => (
                  <div key={index}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {takeaway.recurring ? "Recurring" : "Recent takeaway"}
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">{takeaway.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Fore!Mind needs a couple more analyzed rounds to start noticing patterns.
              </p>
            )}
          </div>

          <div className="mt-7">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-sage">
              <HistoryIcon className="h-3.5 w-3.5" />
              Caddie Log
            </h3>
            {recentCaddieLog.length > 0 ? (
              <div className="mt-3 space-y-2">
                {recentCaddieLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="card-hover rounded-2xl border border-border bg-surface px-4 py-3"
                  >
                    <p className="text-xs text-muted">{formatDate(entry.timestamp)}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground">{entry.message}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted">{entry.response}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Your conversations with Fore!Mind will show up here.
              </p>
            )}
            <Link
              href="/mental-game/log"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-sage transition-colors hover:text-foreground"
            >
              View all conversations →
            </Link>
          </div>
        </section>

        <section style={{ gridArea: "baseline" }} className="motion-body mt-10 lg:mt-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sage">
            Mental Baseline
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <BaselineStat
              label="Focus"
              value={averageFocus !== null ? averageFocus.toFixed(1) : null}
            />
            <BaselineStat
              label="Energy"
              value={averageEnergy !== null ? averageEnergy.toFixed(1) : null}
            />
            <BaselineStat
              label="Confidence"
              value={averageConfidence !== null ? averageConfidence.toFixed(1) : null}
            />
            <BaselineStat label="Rounds Played" value={String(rounds.length)} />
          </div>
        </section>

        <section style={{ gridArea: "recent" }} className="motion-body-late mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sage">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-soft">
              <ScorecardIcon className="h-3.5 w-3.5 text-sage" />
            </span>
            Recent Rounds
          </h2>
          <div className="mt-3 space-y-2">
            {recentRounds.map((round) => (
              <RoundCard
                key={round.id}
                round={round}
                isExpanded={expandedId === round.id}
                onToggle={() => setExpandedId((current) => (current === round.id ? null : round.id))}
              />
            ))}
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
