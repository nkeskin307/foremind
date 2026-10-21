"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ScorecardIcon } from "@/components/icons/scorecard-icon";
import { SparkleIcon } from "@/components/icons/sparkle-icon";
import { HistoryIcon } from "@/components/icons/history-icon";
import { FlagIcon } from "@/components/icons/flag-icon";
import { FlagstickMotif } from "@/components/motifs/flagstick-motif";
import {
  getRoundsSnapshot,
  parseRoundsSnapshot,
  subscribeToRounds,
  type CompletedRound,
  type PostRoundAnalysis,
} from "@/lib/mental-game/completed-rounds";
import { formatToPar, summarizeScores } from "@/lib/play/round-data";
import {
  MIN_RECOVERY_CASES,
  computeRecoveryStats,
  type RecoveryStats,
} from "@/lib/play/proactive-caddie";
import { useI18n } from "@/lib/i18n/use-i18n";
import { useRoundPhotoUrl } from "@/lib/photos/photo-store";
import { RoundPhoto } from "@/components/photos/round-photo";
import { allNoDataPhrases, stateLabel, type Messages } from "@/lib/i18n";
import { formatAverageToPar, formatDate, formatDateTime, formatDecimal } from "@/lib/i18n/format";
import {
  buildCourseHistories,
  type CourseHistory,
  type CourseRoundSummary,
  type ScoreSplit,
} from "@/lib/mental-game/course-history";
import {
  getCaddieLogSnapshot,
  parseCaddieLogSnapshot,
  subscribeToCaddieLog,
} from "@/lib/caddie/caddie-log-storage";
import {
  ANALYSIS_STUCK_MS,
  analysisStatus,
  requestPostRoundAnalysis,
} from "@/lib/mental-game/request-analysis";
import { MIN_ROUNDS_FOR_PATTERNS } from "@/lib/mental-game/insights";
import { AtAGlance } from "@/components/mental-game/at-a-glance";
import { RoundRecapView } from "@/components/mental-game/round-recap-view";
import {
  LoadSampleButton,
  SampleBadge,
  SampleBanner,
} from "@/components/mental-game/sample-controls";

const RECENT_WINDOW = 5;

const DIFFICULT_STATES = ["Frustrated", "Rushed", "Overthinking"];


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
const NO_DATA_PHRASES = allNoDataPhrases();

function hasMeaningfulContent(text: string): boolean {
  const lower = text.toLowerCase();
  return !NO_DATA_PHRASES.some((phrase) => lower.includes(phrase));
}

function buildLearningTakeaways(analyzedRounds: CompletedRound[]): Takeaway[] {
  if (analyzedRounds.length === 0) return [];

  if (analyzedRounds.length === 1) {
    const analysis = analyzedRounds[0].analysis as PostRoundAnalysis;
    const items: Takeaway[] = [];
    if (analysis.patternWatch && hasMeaningfulContent(analysis.patternWatch)) {
      items.push({ text: analysis.patternWatch, recurring: false });
    }
    if (analysis.tryThis && hasMeaningfulContent(analysis.tryThis)) {
      items.push({ text: analysis.tryThis, recurring: false });
    }
    return items.slice(0, 2);
  }

  const themes = findRepeatedThemes(analyzedRounds, (round) => {
    const analysis = round.analysis;
    if (!analysis) return [];
    return [analysis.patternWatch ?? "", ...analysis.whatWorked, analysis.tryThis];
  });

  if (themes.length > 0) {
    return themes.slice(0, 3).map((theme) => ({ text: theme.example, recurring: true }));
  }

  const latest = (analyzedRounds[0].analysis as PostRoundAnalysis).tryThis;
  return latest && hasMeaningfulContent(latest) ? [{ text: latest, recurring: false }] : [];
}

// Same shape as buildLearningTakeaways above, sourcing the positive
// "whatHelped" field instead of patternToWatch/takeIntoNextRound — reuses
// the same repeated-theme and meaningful-content checks, unchanged.
function buildWhatsHelping(analyzedRounds: CompletedRound[]): Takeaway[] {
  if (analyzedRounds.length === 0) return [];

  if (analyzedRounds.length === 1) {
    const analysis = analyzedRounds[0].analysis as PostRoundAnalysis;
    const helped = analysis.whatWorked[0];
    if (helped && hasMeaningfulContent(helped)) {
      return [{ text: helped, recurring: false }];
    }
    return [];
  }

  const themes = findRepeatedThemes(analyzedRounds, (round) => {
    const analysis = round.analysis;
    if (!analysis) return [];
    return analysis.whatWorked;
  });

  if (themes.length > 0) {
    return themes.slice(0, 3).map((theme) => ({ text: theme.example, recurring: true }));
  }

  const latest = (analyzedRounds[0].analysis as PostRoundAnalysis).whatWorked[0];
  return latest && hasMeaningfulContent(latest) ? [{ text: latest, recurring: false }] : [];
}

type CurrentFocus = { headline: string; detail: string };

function buildCurrentFocus(
  recentRounds: CompletedRound[],
  stateRoundCounts: Map<string, number>,
  t: Messages,
): CurrentFocus | null {
  const difficultCounts = new Map(
    [...stateRoundCounts].filter(([state]) => DIFFICULT_STATES.includes(state)),
  );
  const topDifficult = topEntry(difficultCounts);

  if (topDifficult && topDifficult.roundCount >= 2) {
    return {
      headline:
        t.dashboard.focusHeadlines[topDifficult.state] ??
        t.dashboard.focusHeadlineDefault(stateLabel(t, topDifficult.state)),
      detail: t.dashboard.focusDetail(
        stateLabel(t, topDifficult.state),
        t.dashboard.roundCountLabel(topDifficult.roundCount, recentRounds.length),
      ),
    };
  }

  const reflectionThemes = findRepeatedThemes(recentRounds, (round) => [
    round.reflection.whatWorked,
    round.reflection.whatGotInHead,
    round.reflection.whatToRemember,
  ]);
  if (reflectionThemes.length > 0) {
    return { headline: t.dashboard.watchTheme, detail: reflectionThemes[0].example };
  }

  const analyzedRounds = recentRounds.filter((round) => round.analysis);
  const latestTakeaway = analyzedRounds[0]?.analysis?.tryThis;
  if (latestTakeaway && hasMeaningfulContent(latestTakeaway)) {
    return { headline: t.dashboard.carryThis, detail: latestTakeaway };
  }

  return null;
}

function BaselineStat({ label, value }: { label: string; value: number | string | null }) {
  const { t } = useI18n();
  return (
    <div className="card-hover rounded-2xl border border-border bg-surface px-3 py-4 text-center">
      {value !== null ? (
        <p className="text-2xl font-bold text-foreground">{value}</p>
      ) : (
        <p className="text-xs text-muted">{t.dashboard.notEnoughData}</p>
      )}
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

function formatRoundScore(
  round: { holesScored: number; holes: number; total: number; toPar: number },
  t: Messages,
) {
  if (round.holesScored === 0) return t.dashboard.notScored;
  const partial = round.holesScored < round.holes ? ` · ${round.holesScored}/${round.holes}` : "";
  return `${round.total} (${formatToPar(round.toPar)})${partial}`;
}

function formatSplit(split: ScoreSplit | null, t: Messages): string {
  return split ? formatRoundScore(split, t) : t.dashboard.nineHoleRound;
}

function CompareRow({
  label,
  latest,
  previous,
}: {
  label: string;
  latest: string;
  previous: string;
}) {
  return (
    <>
      <p className="col-span-2 mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="text-sm text-foreground">{latest}</p>
      <p className="text-sm text-foreground">{previous}</p>
    </>
  );
}

function formatTopStates(round: CourseRoundSummary, t: Messages): string {
  if (round.topStates.length === 0) return t.dashboard.noneLogged;
  return round.topStates
    .slice(0, 2)
    .map(({ state, count }) => `${stateLabel(t, state)} (${count})`)
    .join(", ");
}

function CourseCard({ history }: { history: CourseHistory }) {
  const { lang, t } = useI18n();
  const roundCount = history.rounds.length;
  const [latest, previous] = history.rounds;
  const has18 = latest.holes === 18 || previous?.holes === 18;
  const latestPhoto = useRoundPhotoUrl(latest.id);
  const previousPhoto = useRoundPhotoUrl(previous?.id ?? null);

  return (
    <div className="card-hover rounded-2xl border border-border bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            {history.displayName}
            {history.sample && <SampleBadge />}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t.dashboard.roundsPlayedCount(roundCount)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-foreground">
            {history.averageToPar !== null ? formatAverageToPar(history.averageToPar, lang) : "—"}
          </p>
          <p className="text-xs text-muted">{t.dashboard.avgVsPar}</p>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted">
        {history.stateRoundCounts.length > 0
          ? t.dashboard.mentalStatesLine(
              history.stateRoundCounts
                .slice(0, 3)
                .map(({ state, count }) =>
                  t.dashboard.stateRounds(stateLabel(t, state), count, roundCount),
                )
                .join(", "),
            )
          : t.dashboard.noStatesHere}
      </p>

      {previous && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-x-4">
            <p className="text-xs font-semibold text-sage">
              {t.dashboard.latest} · {formatDate(latest.date, lang, t.common.unknownDate)}
            </p>
            <p className="text-xs font-semibold text-sage">
              {t.dashboard.previous} · {formatDate(previous.date, lang, t.common.unknownDate)}
            </p>
            <CompareRow
              label={t.dashboard.scoreVsPar}
              latest={formatRoundScore(latest, t)}
              previous={formatRoundScore(previous, t)}
            />
            {has18 && (
              <>
                <CompareRow
                  label={t.dashboard.front9}
                  latest={formatSplit(latest.front9, t)}
                  previous={formatSplit(previous.front9, t)}
                />
                <CompareRow
                  label={t.dashboard.back9}
                  latest={formatSplit(latest.back9, t)}
                  previous={formatSplit(previous.back9, t)}
                />
              </>
            )}
            <CompareRow
              label={t.dashboard.topStates}
              latest={formatTopStates(latest, t)}
              previous={formatTopStates(previous, t)}
            />
            <CompareRow
              label={t.dashboard.takeaway}
              latest={latest.whatToRemember || t.dashboard.noReflectionSaved}
              previous={previous.whatToRemember || t.dashboard.noReflectionSaved}
            />
            {(latestPhoto || previousPhoto) && (
              <>
                <p className="col-span-2 mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {t.photo.label}
                </p>
                {[latest, previous].map((round) => (
                  <div key={round.id}>
                    <RoundPhoto
                      roundId={round.id}
                      alt={t.photo.alt(history.displayName)}
                      imageClassName="h-20 w-full"
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RecoveryValue({
  label,
  side,
  showAverage,
}: {
  label: string;
  side: RecoveryStats["afterCard"];
  showAverage: boolean;
}) {
  const { lang, t } = useI18n();
  return (
    <div>
      {showAverage && side.average !== null ? (
        <p className="text-2xl font-bold text-foreground">{formatAverageToPar(side.average, lang)}</p>
      ) : (
        <p className="py-1.5 text-xs text-muted">{t.dashboard.notEnoughData}</p>
      )}
      <p className="mt-1 text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-[10px] text-muted">
        {t.dashboard.cases(side.count)}
      </p>
    </div>
  );
}

function RecoveryCard({ stats }: { stats: RecoveryStats }) {
  const { t } = useI18n();
  const enoughData =
    stats.afterCard.count >= MIN_RECOVERY_CASES &&
    stats.afterBadHoleNoCard.count >= MIN_RECOVERY_CASES;

  return (
    <div className="card-hover mt-3 rounded-2xl border border-border bg-surface px-4 py-4">
      <p className="text-sm font-medium text-foreground">{t.dashboard.recoveryTitle}</p>
      <p className="mt-1 text-xs text-muted">
        {t.dashboard.recoverySubtitle}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-center">
        <RecoveryValue
          label={t.dashboard.afterCard}
          side={stats.afterCard}
          showAverage={enoughData}
        />
        <RecoveryValue
          label={t.dashboard.afterBadHole}
          side={stats.afterBadHoleNoCard}
          showAverage={enoughData}
        />
      </div>
      {!enoughData && (
        <p className="mt-3 text-xs text-muted">
          {t.dashboard.recoveryNotEnough(MIN_RECOVERY_CASES)}
        </p>
      )}
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
  const { lang, t } = useI18n();
  const commonState = mostCommonStateInRound(round);
  const scoreSummary = summarizeScores(round.scores, round.pars);
  // A clock that only ticks when a "preparing" analysis may become stuck.
  const [now, setNow] = useState(() => Date.now());
  const [retrying, setRetrying] = useState(false);
  const status = analysisStatus(round, now);

  useEffect(() => {
    if (status !== "preparing" || !round.analysisRequestedAt) return;
    const stuckAt = new Date(round.analysisRequestedAt).getTime() + ANALYSIS_STUCK_MS;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, stuckAt - Date.now()) + 250);
    return () => clearTimeout(timer);
  }, [status, round.analysisRequestedAt]);

  function retryAnalysis() {
    setRetrying(true);
    setNow(Date.now());
    void requestPostRoundAnalysis(round).finally(() => setRetrying(false));
  }

  return (
    <div className="card-hover rounded-2xl border border-border bg-surface px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex min-h-11 w-full items-center justify-between gap-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <RoundPhoto
            roundId={round.id}
            alt={t.photo.alt(round.course.trim() || t.dashboard.unnamedCourse)}
            imageClassName="h-10 w-10"
            removable={false}
            className="shrink-0"
          />
          <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            {round.course.trim() || t.dashboard.unnamedCourse}
            {round.sample && <SampleBadge />}
          </p>
          <p className="mt-1 text-xs text-muted">
            {formatDate(round.date, lang, t.common.unknownDate)} · {t.common.holesCount(round.holes)}
            {commonState ? ` · ${stateLabel(t, commonState)}` : ""}
          </p>
          </div>
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
                  ? ` · ${t.dashboard.partialHoles(scoreSummary.holesScored, round.holes)}`
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

      {status === "none" && (
        <Link
          href={`/reflection?id=${encodeURIComponent(round.id)}`}
          className="min-h-11 mt-3 inline-flex items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-forest"
        >
          {t.dashboard.reflectNow}
        </Link>
      )}

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
            {isExpanded && (
              <RoundPhoto
                roundId={round.id}
                alt={t.photo.alt(round.course.trim() || t.dashboard.unnamedCourse)}
                imageClassName="h-40 w-full"
              />
            )}
            {round.analysis ? (
              <RoundRecapView round={round} recap={round.analysis} />
            ) : status === "stuck" && !retrying ? (
              <div>
                <p className="text-sm text-muted">{t.dashboard.analysisFailed}</p>
                <button
                  type="button"
                  onClick={retryAnalysis}
                  className="min-h-11 mt-2 inline-flex items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-forest"
                >
                  {t.dashboard.retryAnalysis}
                </button>
              </div>
            ) : status === "preparing" || retrying ? (
              <p className="text-sm text-muted">{t.dashboard.analysisPreparing}</p>
            ) : (
              <p className="text-sm text-muted">{t.dashboard.noReflectionYet}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MentalGameDashboard() {
  const { lang, t } = useI18n();
  const rawRounds = useSyncExternalStore(
    subscribeToRounds,
    getRoundsSnapshot,
    getServerRoundsSnapshot,
  );
  const rounds = useMemo(() => parseRoundsSnapshot(rawRounds), [rawRounds]);

  const rawCaddieLog = useSyncExternalStore(
    subscribeToCaddieLog,
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
          {t.dashboard.title}
        </h1>
        <div className="motion-body">
        <p className="mt-2 text-base text-muted">
          {t.dashboard.subtitle}
        </p>

        <p className="mt-12 text-sm text-muted">
          {t.dashboard.emptyStart}
        </p>

        <Link
          href="/play"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
        >
          {t.dashboard.startRound}
        </Link>
        <LoadSampleButton className="mt-3" />
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

  const courseHistories = buildCourseHistories(rounds);
  const hasSamples = rounds.some((round) => round.sample);
  const recoveryStats = computeRecoveryStats(rounds);

  const analyzedRounds = recentRounds.filter((round) => round.analysis);
  const whatToWatch = buildLearningTakeaways(analyzedRounds);
  const whatsHelping = buildWhatsHelping(analyzedRounds);
  const currentFocus = buildCurrentFocus(recentRounds, stateRoundCounts, t);

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
        {t.dashboard.title}
      </h1>
      <p className="motion-body mt-2 text-base text-muted">
        {t.dashboard.subtitle}
      </p>
      {hasSamples && <SampleBanner />}

      {/* Named grid areas so mobile keeps document order (review, then
          baseline, then recent; "At a glance" comes first on phones) while desktop repositions review into a
          right-hand column that spans both left rows — no need to
          duplicate content or fight `order` utilities for two different
          rearrangements at once. */}
      <div
        className="mt-10 lg:grid lg:items-start lg:gap-x-10"
        style={{
          // fr/minmax instead of 38% + 62% + gap (which overflowed and clipped the right column).
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
          gridTemplateAreas: '"glance review" "baseline review" "recent review" "courses review"',
        }}
      >
        <section style={{ gridArea: "glance" }} className="motion-body">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sage">
            {t.glance.title}
            {hasSamples && <SampleBadge />}
          </h2>
          <div className="mt-3">
            <AtAGlance rounds={rounds} />
            <RecoveryCard stats={recoveryStats} />
          </div>
        </section>

        <section className="motion-body mt-10 lg:mt-0" style={{ gridArea: "review" }}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-soft">
              <SparkleIcon className="h-4 w-4 text-sage" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {t.dashboard.reviewTitle}
            </h2>
            {hasSamples && <SampleBadge />}
          </div>
          <p className="mt-1.5 text-sm text-muted">
            {t.dashboard.reviewSubtitle}
          </p>

          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-sage">
              {t.dashboard.currentFocus}
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
                {t.dashboard.currentFocusEmpty}
              </p>
            )}
          </div>

          <div className="mt-7">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-sage">
              {t.dashboard.patterns}
            </h3>
            <div className="mt-3 space-y-2">
              {topState && topState.roundCount >= 2 ? (
                <p className="text-sm text-foreground">
                  {t.dashboard.stateAppeared(
                    stateLabel(t, topState.state),
                    t.dashboard.roundCountLabel(topState.roundCount, recentRounds.length),
                  )}
                </p>
              ) : null}
              {topDifficultState &&
              topDifficultState.roundCount >= 2 &&
              topDifficultState.state !== topState?.state ? (
                <p className="text-sm text-foreground">
                  {t.dashboard.difficultState(
                    stateLabel(t, topDifficultState.state),
                    t.dashboard.roundCountLabel(topDifficultState.roundCount, recentRounds.length),
                  )}
                </p>
              ) : null}
              {(!topState || topState.roundCount < 2) && (
                <p className="text-sm text-muted">
                  {rounds.length < MIN_ROUNDS_FOR_PATTERNS
                    ? t.glance.unlockRounds(MIN_ROUNDS_FOR_PATTERNS - rounds.length)
                    : t.dashboard.noPatterns}
                </p>
              )}
            </div>
          </div>

          <div className="mt-7">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-sage">
              {t.dashboard.whatsHelping}
            </h3>
            {whatsHelping.length > 0 ? (
              <div className="mt-3 space-y-3">
                {whatsHelping.map((takeaway, index) => (
                  <div key={index}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {takeaway.recurring ? t.dashboard.recurring : t.dashboard.recentWin}
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">{takeaway.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {t.dashboard.whatsHelpingEmpty}
              </p>
            )}
          </div>

          <div className="mt-7">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-sage">
              {t.dashboard.whatToWatch}
            </h3>
            {whatToWatch.length > 0 ? (
              <div className="mt-3 space-y-3">
                {whatToWatch.map((takeaway, index) => (
                  <div key={index}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {takeaway.recurring ? t.dashboard.recurring : t.dashboard.recentTakeaway}
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">{takeaway.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {t.dashboard.whatToWatchEmpty}
              </p>
            )}
          </div>

          <div className="mt-7">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-sage">
              <HistoryIcon className="h-3.5 w-3.5" />
              {t.dashboard.caddieLog}
            </h3>
            {recentCaddieLog.length > 0 ? (
              <div className="mt-3 space-y-2">
                {recentCaddieLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="card-hover rounded-2xl border border-border bg-surface px-4 py-3"
                  >
                    <p className="text-xs text-muted">
                      {formatDateTime(entry.timestamp, lang, t.common.unknownDate)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground">{entry.message}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted">{entry.response}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {t.dashboard.caddieLogEmpty}
              </p>
            )}
            <Link
              href="/mental-game/log"
              className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sage transition-colors hover:text-foreground"
            >
              {t.dashboard.viewAll}
            </Link>
          </div>
        </section>

        <section style={{ gridArea: "baseline" }} className="motion-body mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sage">
            {t.dashboard.baseline}
            {hasSamples && <SampleBadge />}
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <BaselineStat
              label={t.checkIn.focus}
              value={averageFocus !== null ? formatDecimal(averageFocus, lang) : null}
            />
            <BaselineStat
              label={t.checkIn.energy}
              value={averageEnergy !== null ? formatDecimal(averageEnergy, lang) : null}
            />
            <BaselineStat
              label={t.checkIn.confidence}
              value={averageConfidence !== null ? formatDecimal(averageConfidence, lang) : null}
            />
          </div>
        </section>

        <section style={{ gridArea: "recent" }} className="motion-body-late mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sage">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-soft">
              <ScorecardIcon className="h-3.5 w-3.5 text-sage" />
            </span>
            {t.dashboard.recentRounds}
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

        {courseHistories.length > 0 && (
          <section style={{ gridArea: "courses" }} className="motion-body-late mt-8">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sage">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-soft">
                <FlagIcon className="h-3.5 w-3.5 text-sage" />
              </span>
              {t.dashboard.byCourse}
            </h2>
            <div className="mt-3 space-y-2">
              {courseHistories.map((history) => (
                <CourseCard key={history.key} history={history} />
              ))}
            </div>
          </section>
        )}
      </div>
      {!hasSamples && <LoadSampleButton className="mx-auto mt-10 max-w-md" />}
      </div>
    </div>
  );
}
