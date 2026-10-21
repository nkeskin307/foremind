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

const MAX_NOTE_CHARS = 70;

function shortenNote(note: string): string {
  const clean = note.trim().replace(/\s+/g, " ");
  const chars = Array.from(clean);
  return chars.length <= MAX_NOTE_CHARS
    ? clean
    : `${chars.slice(0, MAX_NOTE_CHARS - 1).join("").trimEnd()}…`;
}

/**
 * One personal line for the top of the routine, built from the check-in
 * note and the lowest rating (ties go by FIELD_PRIORITY). Null when there
 * is neither a note nor a rating to build it from.
 */
export function personalRoutineLine(
  ratings: CheckInRatings,
  notes: string,
  messages: Messages,
): string | null {
  const text = messages.routine;
  const rated = FIELD_PRIORITY.filter((field) => ratings[field] !== null);
  const note = notes.trim() ? shortenNote(notes) : "";

  if (rated.length === 0) return note ? text.personalNoteOnly(note) : null;

  const lowest = rated.reduce((low, field) =>
    (ratings[field] as number) < (ratings[low] as number) ? field : low,
  );
  const label = messages.checkIn[lowest];
  const rating = ratings[lowest] as number;
  const cue = text.lowestCue[lowest];

  return note
    ? text.personalLine(note, label, rating, cue)
    : text.personalRatingOnly(label, rating, cue);
}
