export type PreRoundCheckIn = {
  focus: number | null;
  energy: number | null;
  confidence: number | null;
  note: string;
};

export type RoundData = {
  course: string;
  holes: number;
  scores: number[];
  total: number;
  mentalNotes: (string | null)[];
  preRound: PreRoundCheckIn;
  date: string;
};

function emptyRoundData(): RoundData {
  return {
    course: "",
    holes: 18,
    scores: [],
    total: 0,
    mentalNotes: [],
    preRound: { focus: null, energy: null, confidence: null, note: "" },
    date: new Date().toISOString(),
  };
}

function parsePreRound(value: unknown): PreRoundCheckIn {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    focus: typeof raw.focus === "number" ? raw.focus : null,
    energy: typeof raw.energy === "number" ? raw.energy : null,
    confidence: typeof raw.confidence === "number" ? raw.confidence : null,
    note: typeof raw.note === "string" ? raw.note : "",
  };
}

export function parseRoundData(raw: string | undefined): RoundData {
  if (!raw) return emptyRoundData();

  try {
    const parsed = JSON.parse(raw);
    return {
      course: typeof parsed.course === "string" ? parsed.course : "",
      holes: typeof parsed.holes === "number" ? parsed.holes : 18,
      scores: Array.isArray(parsed.scores)
        ? parsed.scores.filter((value: unknown) => typeof value === "number")
        : [],
      total: typeof parsed.total === "number" ? parsed.total : 0,
      mentalNotes: Array.isArray(parsed.mentalNotes) ? parsed.mentalNotes : [],
      preRound: parsePreRound(parsed.preRound),
      date: typeof parsed.date === "string" ? parsed.date : new Date().toISOString(),
    };
  } catch {
    return emptyRoundData();
  }
}
