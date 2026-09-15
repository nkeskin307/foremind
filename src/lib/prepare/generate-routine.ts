export type CheckInField = "focus" | "energy" | "confidence";

export type CheckInRatings = Record<CheckInField, number | null>;

export type PreRoundRoutine = {
  focusMindset: string;
  teePrep: string;
  physicalReset: string;
  reset: string;
};

const RESET_REMINDER =
  "Leave the last shot behind. Reset your body, pick your next target, and commit.";

const FIELD_PRIORITY: CheckInField[] = ["focus", "confidence", "energy"];

type MessageSet = {
  mindset: string;
  teePrep: string;
  physicalReset: string;
};

const LOW_MESSAGES: Record<CheckInField, MessageSet> = {
  focus: {
    mindset:
      "Stay present and play one shot at a time — the rest of the course doesn't exist until you get there.",
    teePrep:
      "Pick one simple pre-shot cue and repeat it before every swing today.",
    physicalReset:
      "Loosen your grip and shake out your hands for 10 seconds to release tension.",
  },
  confidence: {
    mindset:
      "Trust your own game today instead of comparing yourself to anyone else in the group.",
    teePrep:
      "Choose one intention for the round and commit to it before your first tee shot.",
    physicalReset:
      "Slowly roll your shoulders back 5 times to settle in before you swing.",
  },
  energy: {
    mindset:
      "Keep the round simple today — don't make it more mentally exhausting than it needs to be.",
    teePrep:
      "Decide now what phrase you'll return to if you start feeling worn down, so you're not thinking about it mid-round.",
    physicalReset:
      "Take one long exhale while relaxing your shoulders and hands.",
  },
};

const STRONG_MESSAGE: MessageSet = {
  mindset:
    "You're in a good headspace — protect it and keep doing whatever got you here.",
  teePrep: "Choose one small process goal to stay locked in through all 18 holes.",
  physicalReset: "Stretch your neck gently side to side to stay loose and ready.",
};

const NEUTRAL_MESSAGE: MessageSet = {
  mindset: "You're feeling steady today. Focus on your process, not the outcome.",
  teePrep:
    "Decide what phrase or thought you'll return to if you start rushing or getting frustrated.",
  physicalReset:
    "Loosen your grip and shake out your hands for 10 seconds before you tee off.",
};

const NO_RATINGS_MESSAGE: MessageSet = {
  mindset: "Set one intention for today's round before you swing.",
  teePrep: "Choose one simple pre-shot cue you can return to all day.",
  physicalReset:
    "Slowly roll your shoulders back a few times to settle in before your first shot.",
};

const KEYWORDS: Record<CheckInField, string[]> = {
  focus: ["distract", "focus", "present", "rush"],
  confidence: ["nervous", "confiden", "doubt", "compar"],
  energy: ["tired", "energy", "exhaust", "drain"],
};

function detectKeywordField(notes: string): CheckInField | null {
  const lower = notes.toLowerCase();
  return (
    FIELD_PRIORITY.find((field) =>
      KEYWORDS[field].some((word) => lower.includes(word)),
    ) ?? null
  );
}

function toRoutine(message: MessageSet): PreRoundRoutine {
  return {
    focusMindset: message.mindset,
    teePrep: message.teePrep,
    physicalReset: message.physicalReset,
    reset: RESET_REMINDER,
  };
}

export function generateRoutine(
  ratings: CheckInRatings,
  notes: string,
): PreRoundRoutine {
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
