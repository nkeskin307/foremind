export type CheckInField = "focus" | "energy" | "confidence";

export type CheckInRatings = Record<CheckInField, number | null>;

export type PreRoundRoutine = {
  focusMindset: string;
  teePrep: string;
  physicalReset: string;
  reset: string;
};

import { allRoutineKeywords, type Messages } from "@/lib/i18n";

const FIELD_PRIORITY: CheckInField[] = ["focus", "confidence", "energy"];

type MessageSet = {
  mindset: string;
  teePrep: string;
  physicalReset: string;
};

// Keywords from every language, so a note written in any language counts.
const KEYWORDS: Record<CheckInField, string[]> = allRoutineKeywords();

function detectKeywordField(notes: string): CheckInField | null {
  const lower = notes.toLowerCase();
  return (
    FIELD_PRIORITY.find((field) =>
      KEYWORDS[field].some((word) => lower.includes(word)),
    ) ?? null
  );
}

/** Builds the routine with rules (no AI), worded in the app language. */
export function generateRoutine(
  ratings: CheckInRatings,
  notes: string,
  messages: Messages,
): PreRoundRoutine {
  const text = messages.routine;
  const LOW_MESSAGES: Record<CheckInField, MessageSet> = text.low;
  const STRONG_MESSAGE: MessageSet = text.strong;
  const NEUTRAL_MESSAGE: MessageSet = text.neutral;
  const NO_RATINGS_MESSAGE: MessageSet = text.noRatings;
  const toRoutine = (message: MessageSet): PreRoundRoutine => ({
    focusMindset: message.mindset,
    teePrep: message.teePrep,
    physicalReset: message.physicalReset,
    reset: text.resetReminder,
  });

  const ratedFields = FIELD_PRIORITY.filter((field) => ratings[field] !== null);

  if (ratedFields.length === 0) {
    const keywordField = detectKeywordField(notes);
    return toRoutine(keywordField ? LOW_MESSAGES[keywordField] : NO_RATINGS_MESSAGE);
  }

  const min = Math.min(...ratedFields.map((field) => ratings[field] as number));

  if (min <= 2) {
    const weakField = FIELD_PRIORITY.find((field) => ratings[field] === min);
    return toRoutine(LOW_MESSAGES[weakField as CheckInField]);
  }

  const allStrong = ratedFields.every((field) => (ratings[field] as number) >= 4);
  if (allStrong) {
    return toRoutine(STRONG_MESSAGE);
  }

  const keywordField = detectKeywordField(notes);
  return toRoutine(keywordField ? LOW_MESSAGES[keywordField] : NEUTRAL_MESSAGE);
}
