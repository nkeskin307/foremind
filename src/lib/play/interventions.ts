export type InterventionTrigger =
  | "negative-streak"
  | "blow-up"
  | "rough-start"
  | "low-confidence-start";

/** "ignored" until the golfer taps a button on the card. */
export type InterventionOutcome = "opened" | "dismissed" | "ignored";

/** Facts behind the trigger, used to explain the card ("Your caddie noticed…"). */
export type InterventionDetail = {
  toPar: number | null;
  /** Mental states for a negative streak, in hole order. */
  states: string[];
  /** 1-based holes involved (two for a streak). */
  holes: number[];
};

export type Intervention = {
  id: string;
  /** 1-based hole the card was shown for. */
  hole: number;
  trigger: InterventionTrigger;
  /** Short English description of why the card fired (for analysis/prompts). */
  reason: string;
  message: string;
  source: "ai" | "fallback";
  outcome: InterventionOutcome;
  createdAt: string;
  /** 1-based number of the next scored hole after `hole`, or null if none yet. */
  nextHole: number | null;
  /** That hole's score vs par, or null if none yet. */
  nextHoleToPar: number | null;
  /** Missing on interventions saved before this field existed. */
  detail?: InterventionDetail;
};

const TRIGGERS: InterventionTrigger[] = [
  "negative-streak",
  "blow-up",
  "rough-start",
  "low-confidence-start",
];
const OUTCOMES: InterventionOutcome[] = ["opened", "dismissed", "ignored"];

function normalizeDetail(value: unknown): InterventionDetail | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  return {
    toPar: numberOrNull(raw.toPar),
    states: Array.isArray(raw.states)
      ? raw.states.filter((s): s is string => typeof s === "string")
      : [],
    holes: Array.isArray(raw.holes)
      ? raw.holes.filter((h): h is number => typeof h === "number")
      : [],
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Safe migration: anything missing or malformed becomes an empty list. */
export function normalizeInterventions(value: unknown): Intervention[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index): Intervention[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const hole = numberOrNull(raw.hole);
    const trigger = TRIGGERS.find((t) => t === raw.trigger);
    if (hole === null || !trigger) return [];
    return [
      {
        id: typeof raw.id === "string" && raw.id ? raw.id : `intervention-${index}`,
        hole,
        trigger,
        reason: typeof raw.reason === "string" ? raw.reason : "",
        message: typeof raw.message === "string" ? raw.message : "",
        source: raw.source === "ai" ? "ai" : "fallback",
        outcome: OUTCOMES.find((o) => o === raw.outcome) ?? "ignored",
        createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
        nextHole: numberOrNull(raw.nextHole),
        nextHoleToPar: numberOrNull(raw.nextHoleToPar),
        detail: normalizeDetail(raw.detail),
      },
    ];
  });
}
