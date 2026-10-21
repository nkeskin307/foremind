import { summarizeScores, type HoleScore } from "@/lib/play/round-data";
import type { CompletedRound } from "@/lib/mental-game/completed-rounds";

/** Course match key: trimmed, inner whitespace collapsed, case-insensitive. */
export function normalizeCourseName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export type ScoreSplit = {
  holesScored: number;
  holes: number;
  total: number;
  toPar: number;
};

export type StateCount = { state: string; count: number };

export type CourseRoundSummary = {
  id: string;
  date: string;
  holes: number;
  holesScored: number;
  /** Scored holes only. */
  total: number;
  /** Scored holes only. */
  toPar: number;
  /** Only for 18-hole rounds. */
  front9: ScoreSplit | null;
  back9: ScoreSplit | null;
  /** Mental states in this round, by number of holes logged, most first. */
  topStates: StateCount[];
  whatToRemember: string;
  whatGotInHead: string;
};

export type CourseHistory = {
  key: string;
  /** Sample courses are grouped separately from real ones, even with the same name. */
  sample: boolean;
  /** Name as the golfer most recently typed it. */
  displayName: string;
  /** Newest first. */
  rounds: CourseRoundSummary[];
  /** Average vs par across rounds with at least one scored hole; null if none. */
  averageToPar: number | null;
  /** Number of rounds (not holes) each state appeared in, most first. */
  stateRoundCounts: StateCount[];
};

function splitScores(
  scores: HoleScore[],
  pars: number[],
  start: number,
  end: number,
): ScoreSplit {
  const summary = summarizeScores(scores.slice(start, end), pars.slice(start, end));
  return {
    holesScored: summary.holesScored,
    holes: end - start,
    total: summary.total,
    toPar: summary.toPar,
  };
}

function sortCounts(counts: Map<string, number>): StateCount[] {
  return [...counts.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count);
}

export function summarizeCourseRound(round: CompletedRound): CourseRoundSummary {
  const summary = summarizeScores(round.scores, round.pars);
  const stateCounts = new Map<string, number>();
  for (const state of round.mentalNotes) {
    if (state) stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);
  }
  const is18 = round.holes === 18;

  return {
    id: round.id,
    date: round.date,
    holes: round.holes,
    holesScored: summary.holesScored,
    total: summary.total,
    toPar: summary.toPar,
    front9: is18 ? splitScores(round.scores, round.pars, 0, 9) : null,
    back9: is18 ? splitScores(round.scores, round.pars, 9, 18) : null,
    topStates: sortCounts(stateCounts),
    whatToRemember: round.reflection.whatToRemember.trim(),
    whatGotInHead: round.reflection.whatGotInHead.trim(),
  };
}

/** Groups completed rounds by normalized course name; most recently played course first. */
export function buildCourseHistories(rounds: CompletedRound[]): CourseHistory[] {
  const byKey = new Map<string, CompletedRound[]>();
  for (const round of rounds) {
    const name = normalizeCourseName(round.course);
    if (!name) continue;
    const key = round.sample ? `sample:${name}` : name;
    const list = byKey.get(key) ?? [];
    list.push(round);
    byKey.set(key, list);
  }

  const histories: CourseHistory[] = [];
  for (const [key, courseRounds] of byKey) {
    const sorted = [...courseRounds].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const summaries = sorted.map(summarizeCourseRound);

    const scored = summaries.filter((round) => round.holesScored > 0);
    const averageToPar =
      scored.length > 0
        ? scored.reduce((sum, round) => sum + round.toPar, 0) / scored.length
        : null;

    // Per round, not per hole: a state counts once per round it appeared in.
    const stateRounds = new Map<string, number>();
    for (const round of summaries) {
      for (const { state } of round.topStates) {
        stateRounds.set(state, (stateRounds.get(state) ?? 0) + 1);
      }
    }

    histories.push({
      key,
      sample: sorted.some((round) => round.sample),
      displayName: sorted[0].course.trim().replace(/\s+/g, " "),
      rounds: summaries,
      averageToPar,
      stateRoundCounts: sortCounts(stateRounds),
    });
  }

  return histories.sort(
    (a, b) => new Date(b.rounds[0].date).getTime() - new Date(a.rounds[0].date).getTime(),
  );
}

export function findCourseHistory(
  histories: CourseHistory[],
  courseName: string,
): CourseHistory | null {
  const key = normalizeCourseName(courseName);
  if (!key) return null;
  return histories.find((history) => history.key === key) ?? null;
}

/** Short, per-round summary of past rounds at one course for /api/caddie. */
export type CaddieCourseHistory = {
  course: string;
  roundsPlayed: number;
  rounds: {
    date: string;
    holes: number;
    holesScored: number;
    total: number;
    toPar: number;
    /** Distinct mental states logged in that round. */
    states: string[];
    whatToRemember: string;
    whatGotInHead: string;
  }[];
  /** Number of rounds at this course each state appeared in. */
  stateRoundCounts: StateCount[];
};

const MAX_CADDIE_COURSE_ROUNDS = 3;

export function toCaddieCourseHistory(
  courseName: string,
  history: CourseHistory | null,
): CaddieCourseHistory {
  if (!history) {
    return { course: courseName.trim(), roundsPlayed: 0, rounds: [], stateRoundCounts: [] };
  }
  return {
    course: history.displayName,
    roundsPlayed: history.rounds.length,
    rounds: history.rounds.slice(0, MAX_CADDIE_COURSE_ROUNDS).map((round) => ({
      date: round.date,
      holes: round.holes,
      holesScored: round.holesScored,
      total: round.total,
      toPar: round.toPar,
      states: round.topStates.map(({ state }) => state),
      whatToRemember: round.whatToRemember,
      whatGotInHead: round.whatGotInHead,
    })),
    stateRoundCounts: history.stateRoundCounts,
  };
}
