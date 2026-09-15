export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-3.1-flash-lite";

const SYSTEM_INSTRUCTION = `You are the Fore!Mind Mental Caddie, an AI mental-game coach for recreational golfers.

Keep responses short, calm, practical, and golf-specific.

Respond in plain text only — no markdown, no asterisks, no bullet points, no headers.

Help with:
- confidence
- focus
- frustration
- pressure
- overthinking
- recovering after mistakes

Focus on the mental game, not technical swing instruction.

Do not pretend you can see the golfer's swing.

Prefer one or two actionable ideas rather than long explanations.

When relevant history exists, begin your response with one concrete observation from the golfer's past data before giving advice.

Prefer specific evidence such as:
"Rushed has appeared in 3 of your last 4 rounds."
"You've mentioned carrying mistakes forward in two recent reflections."
"Your average pre-round confidence across your last 3 rounds is 3/5."

Do not simply say "you mentioned this before." Show the evidence that makes the memory useful.

Then connect that pattern to what is happening right now.

Keep the full response concise.

Never invent a pattern — only reference history when the golfer's saved data actually supports it. If there is no relevant pattern, skip the historical observation and focus only on the current round.`;

const UNAVAILABLE_MESSAGE = "The Mental Caddie couldn't respond right now.";
const BUSY_MESSAGE = "My Caddie is busy for a moment. Try again in a few seconds.";
const RETRY_DELAY_MS = 1000;
const MAX_ATTEMPTS = 2;

type PreRoundContext = {
  focus: number | null;
  energy: number | null;
  confidence: number | null;
  note: string;
};

type RoundMoment = {
  hole: number;
  holeScore: number;
  mentalState: string;
};

type RoundContext = {
  course: string;
  holes: number;
  currentHole: number;
  totalScore: number;
  currentHoleScore: number;
  currentHoleMentalState: string | null;
  moments: RoundMoment[];
};

type PastRoundPreRound = {
  focus: number | null;
  energy: number | null;
  confidence: number | null;
};

type PastRoundMoment = {
  holeScore: number;
  mentalState: string;
};

type PastRound = {
  course: string;
  total: number;
  moments: PastRoundMoment[];
  preRound: PastRoundPreRound;
  reflection: {
    whatWorked: string;
    whatGotInHead: string;
    whatToRemember: string;
  };
  date: string;
};

const MAX_HISTORY_ROUNDS = 5;
const DIFFICULT_HOLE_SCORE = 6;
const MENTAL_STATE_NAMES = [
  "Confident",
  "Focused",
  "Calm",
  "Frustrated",
  "Rushed",
  "Overthinking",
] as const;
const THEME_KEYWORDS = [
  "frustrat",
  "rush",
  "putt",
  "bunker",
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
  "slow down",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parsePreRoundContext(value: unknown): PreRoundContext | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const focus = toNumberOrNull(raw.focus);
  const energy = toNumberOrNull(raw.energy);
  const confidence = toNumberOrNull(raw.confidence);
  const note = typeof raw.note === "string" ? raw.note.trim() : "";

  if (focus === null && energy === null && confidence === null && !note) {
    return null;
  }

  return { focus, energy, confidence, note };
}

function parseRoundContext(value: unknown): RoundContext | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const course = typeof raw.course === "string" ? raw.course.trim() : "";
  const holes = typeof raw.holes === "number" ? raw.holes : 0;
  const currentHole = typeof raw.currentHole === "number" ? raw.currentHole : 0;
  const totalScore = toNumberOrNull(raw.totalScore);
  const currentHoleScore = toNumberOrNull(raw.currentHoleScore);
  const currentHoleMentalState =
    typeof raw.currentHoleMentalState === "string" ? raw.currentHoleMentalState : null;
  const moments: RoundMoment[] = Array.isArray(raw.moments)
    ? raw.moments.flatMap((momentItem): RoundMoment[] => {
        if (!momentItem || typeof momentItem !== "object") return [];
        const momentRaw = momentItem as Record<string, unknown>;
        const mentalState =
          typeof momentRaw.mentalState === "string" ? momentRaw.mentalState : "";
        if (!mentalState) return [];
        return [
          {
            hole: typeof momentRaw.hole === "number" ? momentRaw.hole : 0,
            holeScore: typeof momentRaw.holeScore === "number" ? momentRaw.holeScore : 0,
            mentalState,
          },
        ];
      })
    : [];

  if (!currentHole && totalScore === null && currentHoleScore === null && !course) {
    return null;
  }

  return {
    course,
    holes,
    currentHole,
    totalScore: totalScore ?? 0,
    currentHoleScore: currentHoleScore ?? 0,
    currentHoleMentalState,
    moments,
  };
}

function buildContextBlock(
  preRound: PreRoundContext | null,
  round: RoundContext | null,
): string {
  const lines: string[] = [];

  if (preRound) {
    if (preRound.focus !== null) lines.push(`Pre-round focus: ${preRound.focus}/5`);
    if (preRound.energy !== null) lines.push(`Pre-round energy: ${preRound.energy}/5`);
    if (preRound.confidence !== null)
      lines.push(`Pre-round confidence: ${preRound.confidence}/5`);
    if (preRound.note) lines.push(`Pre-round note from golfer: "${preRound.note}"`);
  }

  if (round) {
    if (round.course) lines.push(`Course: ${round.course}`);
    if (round.holes) lines.push(`Round length: ${round.holes} holes`);
    if (round.currentHole) {
      lines.push(
        `Current hole: ${round.currentHole}${round.holes ? ` of ${round.holes}` : ""}`,
      );
    }
    lines.push(`Current total score: ${round.totalScore}`);
    lines.push(`Score so far on current hole: ${round.currentHoleScore}`);
    if (round.currentHoleMentalState) {
      lines.push(
        `Most recent mental state logged on this hole: ${round.currentHoleMentalState}`,
      );
    }

    const earlierMoments = round.moments.filter((moment) => moment.hole !== round.currentHole);
    if (earlierMoments.length > 0) {
      lines.push(
        `Mental states logged earlier this round: ${earlierMoments
          .map((moment) => `${moment.mentalState} on Hole ${moment.hole} (scored ${moment.holeScore})`)
          .join(", ")}`,
      );

      const holesByState = new Map<string, number[]>();
      for (const moment of earlierMoments) {
        const holes = holesByState.get(moment.mentalState) ?? [];
        holes.push(moment.hole);
        holesByState.set(moment.mentalState, holes);
      }
      for (const [state, holes] of holesByState) {
        if (holes.length >= 2) {
          lines.push(
            `${state} has already appeared ${holes.length} times earlier in this round, on Holes ${formatHoleList(holes)}`,
          );
        }
      }
    }
  }

  if (lines.length === 0) return "";

  return `Context about the golfer's current session (use this to shape your answer naturally — do not list or repeat these facts back to the golfer):\n${lines
    .map((line) => `- ${line}`)
    .join("\n")}\n\n`;
}

function formatHistoryDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "unknown date" : date.toISOString().slice(0, 10);
}

function formatHoleList(holes: number[]): string {
  if (holes.length === 1) return `${holes[0]}`;
  if (holes.length === 2) return `${holes[0]} and ${holes[1]}`;
  return `${holes.slice(0, -1).join(", ")}, and ${holes[holes.length - 1]}`;
}

function parsePastRounds(value: unknown): PastRound[] {
  if (!Array.isArray(value)) return [];

  const rounds: PastRound[] = [];

  for (const item of value) {
    if (rounds.length >= MAX_HISTORY_ROUNDS) break;
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;

    const reflectionRaw =
      raw.reflection && typeof raw.reflection === "object"
        ? (raw.reflection as Record<string, unknown>)
        : {};

    const preRoundRaw =
      raw.preRound && typeof raw.preRound === "object"
        ? (raw.preRound as Record<string, unknown>)
        : {};

    const moments: PastRoundMoment[] = Array.isArray(raw.moments)
      ? raw.moments.flatMap((momentItem): PastRoundMoment[] => {
          if (!momentItem || typeof momentItem !== "object") return [];
          const momentRaw = momentItem as Record<string, unknown>;
          const mentalState =
            typeof momentRaw.mentalState === "string" ? momentRaw.mentalState : "";
          if (!mentalState) return [];
          return [
            {
              holeScore: typeof momentRaw.holeScore === "number" ? momentRaw.holeScore : 0,
              mentalState,
            },
          ];
        })
      : [];

    rounds.push({
      course: typeof raw.course === "string" ? raw.course.trim() : "",
      total: typeof raw.total === "number" ? raw.total : 0,
      moments,
      preRound: {
        focus: toNumberOrNull(preRoundRaw.focus),
        energy: toNumberOrNull(preRoundRaw.energy),
        confidence: toNumberOrNull(preRoundRaw.confidence),
      },
      reflection: {
        whatWorked:
          typeof reflectionRaw.whatWorked === "string"
            ? reflectionRaw.whatWorked.trim()
            : "",
        whatGotInHead:
          typeof reflectionRaw.whatGotInHead === "string"
            ? reflectionRaw.whatGotInHead.trim()
            : "",
        whatToRemember:
          typeof reflectionRaw.whatToRemember === "string"
            ? reflectionRaw.whatToRemember.trim()
            : "",
      },
      date: typeof raw.date === "string" ? raw.date : "",
    });
  }

  return rounds;
}

function average(values: number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

type MentalStateName = (typeof MENTAL_STATE_NAMES)[number];

type ThemeHit = { keyword: string; count: number; example: string };

function findRepeatedThemes(
  rounds: PastRound[],
  getField: (round: PastRound) => string,
): ThemeHit[] {
  const counts = new Map<string, number>();
  const examples = new Map<string, string>();

  for (const round of rounds) {
    const text = getField(round);
    if (!text) continue;
    const lower = text.toLowerCase();
    for (const keyword of THEME_KEYWORDS) {
      if (lower.includes(keyword)) {
        counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
        if (!examples.has(keyword)) examples.set(keyword, text);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([keyword, count]) => ({ keyword, count, example: examples.get(keyword) ?? "" }));
}

type GolferMemory = {
  roundCount: number;
  averageFocus: number | null;
  averageEnergy: number | null;
  averageConfidence: number | null;
  mentalStateCounts: Record<MentalStateName, number>;
  mostRepeatedStates: { state: MentalStateName; count: number }[];
  difficultHoleStates: { state: MentalStateName; difficultCount: number; totalCount: number }[];
  workedThemes: ThemeHit[];
  gotInHeadThemes: ThemeHit[];
  rememberThemes: ThemeHit[];
};

/**
 * Builds a structured "Golfer Memory" from the golfer's recent completed
 * rounds: concrete counts, averages, and repeated-phrase evidence so Gemini
 * can cite specifics instead of having to infer a pattern from raw data.
 * Every field only reflects what the saved rounds actually contain —
 * nothing here is invented.
 */
function buildGolferMemory(rounds: PastRound[]): GolferMemory | null {
  if (rounds.length === 0) return null;

  const mentalStateCounts = Object.fromEntries(
    MENTAL_STATE_NAMES.map((state) => [state, 0]),
  ) as Record<MentalStateName, number>;
  const stateOnDifficultHole = Object.fromEntries(
    MENTAL_STATE_NAMES.map((state) => [state, 0]),
  ) as Record<MentalStateName, number>;

  for (const round of rounds) {
    for (const moment of round.moments) {
      if (!(MENTAL_STATE_NAMES as readonly string[]).includes(moment.mentalState)) continue;
      const state = moment.mentalState as MentalStateName;
      mentalStateCounts[state] += 1;
      if (moment.holeScore >= DIFFICULT_HOLE_SCORE) stateOnDifficultHole[state] += 1;
    }
  }

  const mostRepeatedStates = MENTAL_STATE_NAMES.map((state) => ({
    state,
    count: mentalStateCounts[state],
  }))
    .filter(({ count }) => count >= 2)
    .sort((a, b) => b.count - a.count);

  const difficultHoleStates = MENTAL_STATE_NAMES.map((state) => ({
    state,
    difficultCount: stateOnDifficultHole[state],
    totalCount: mentalStateCounts[state],
  })).filter(
    ({ totalCount, difficultCount }) => totalCount >= 2 && difficultCount / totalCount >= 0.5,
  );

  return {
    roundCount: rounds.length,
    averageFocus: average(
      rounds.map((r) => r.preRound.focus).filter((v): v is number => v !== null),
    ),
    averageEnergy: average(
      rounds.map((r) => r.preRound.energy).filter((v): v is number => v !== null),
    ),
    averageConfidence: average(
      rounds.map((r) => r.preRound.confidence).filter((v): v is number => v !== null),
    ),
    mentalStateCounts,
    mostRepeatedStates,
    difficultHoleStates,
    workedThemes: findRepeatedThemes(rounds, (r) => r.reflection.whatWorked),
    gotInHeadThemes: findRepeatedThemes(rounds, (r) => r.reflection.whatGotInHead),
    rememberThemes: findRepeatedThemes(rounds, (r) => r.reflection.whatToRemember),
  };
}

function formatGolferMemory(memory: GolferMemory): string {
  const lines: string[] = [];

  lines.push(`Completed rounds available: ${memory.roundCount}`);

  const avgParts: string[] = [];
  if (memory.averageFocus !== null) avgParts.push(`Focus ${memory.averageFocus.toFixed(1)}/5`);
  if (memory.averageEnergy !== null) avgParts.push(`Energy ${memory.averageEnergy.toFixed(1)}/5`);
  if (memory.averageConfidence !== null)
    avgParts.push(`Confidence ${memory.averageConfidence.toFixed(1)}/5`);
  if (avgParts.length > 0) {
    lines.push(`Average pre-round ratings across these rounds: ${avgParts.join(", ")}`);
  }

  lines.push(
    `Mental state counts across these rounds: ${MENTAL_STATE_NAMES.map(
      (state) => `${state} ${memory.mentalStateCounts[state]}`,
    ).join(", ")}`,
  );

  if (memory.mostRepeatedStates.length > 0) {
    lines.push(
      `Most repeated mental states: ${memory.mostRepeatedStates
        .map(({ state, count }) => `${state} appeared in ${count} of the last ${memory.roundCount} rounds`)
        .join("; ")}`,
    );
  }

  for (const { state, difficultCount, totalCount } of memory.difficultHoleStates) {
    lines.push(
      `${state} was logged on a difficult hole (score ${DIFFICULT_HOLE_SCORE}+) in ${difficultCount} of its ${totalCount} occurrences`,
    );
  }

  function themeLines(label: string, themes: ThemeHit[]): void {
    if (themes.length === 0) return;
    lines.push(`${label}:`);
    for (const theme of themes) {
      lines.push(
        `- "${theme.keyword}" repeats in ${theme.count} of ${memory.roundCount} rounds' reflections (e.g., "${theme.example}")`,
      );
    }
  }

  themeLines("Repeated things that helped", memory.workedThemes);
  themeLines("Repeated things that got in their head", memory.gotInHeadThemes);
  themeLines("Repeated reminders they wanted to carry into the next round", memory.rememberThemes);

  return lines.join("\n");
}

function buildHistoryBlock(rounds: PastRound[], memory: GolferMemory | null): string {
  if (rounds.length === 0) return "";

  const perRoundLines = rounds.map((round, index) => {
    const lines: string[] = [];
    const label = [round.course || "Unnamed course", formatHistoryDate(round.date)]
      .filter(Boolean)
      .join(", ");
    lines.push(`Round ${index + 1} (${label}):`);

    const preRoundParts: string[] = [];
    if (round.preRound.focus !== null) preRoundParts.push(`Focus ${round.preRound.focus}/5`);
    if (round.preRound.energy !== null)
      preRoundParts.push(`Energy ${round.preRound.energy}/5`);
    if (round.preRound.confidence !== null)
      preRoundParts.push(`Confidence ${round.preRound.confidence}/5`);
    if (preRoundParts.length > 0) lines.push(`- Pre-round: ${preRoundParts.join(", ")}`);

    if (round.total) lines.push(`- Total score: ${round.total}`);

    if (round.moments.length > 0) {
      lines.push(
        `- Mental states logged: ${round.moments
          .map((moment) => `${moment.mentalState} (hole scored ${moment.holeScore})`)
          .join(", ")}`,
      );
    }

    if (round.reflection.whatWorked)
      lines.push(`- What worked mentally: "${round.reflection.whatWorked}"`);
    if (round.reflection.whatGotInHead)
      lines.push(`- What got in their head: "${round.reflection.whatGotInHead}"`);
    if (round.reflection.whatToRemember)
      lines.push(`- What they wanted to remember: "${round.reflection.whatToRemember}"`);

    return lines.join("\n");
  });

  const instructions = `Below is the golfer's Golfer Memory — a structured summary built only from their actual saved rounds (most recent first, up to ${MAX_HISTORY_ROUNDS} rounds) — followed by per-round detail. Only describe something as a repeated pattern, trend, or habit if it actually occurred in 2 or more of these rounds; with only one round available, you may reference it as a single past observation (e.g. "Last round, you noted…") but never imply it happens often or repeatedly. If the evidence is thin, do not mention history at all and just answer the current question. Never list these raw facts back to the golfer wholesale.`;

  const memorySection = memory
    ? `Golfer Memory (built from ${memory.roundCount} completed round${memory.roundCount === 1 ? "" : "s"}):\n${formatGolferMemory(memory)}\n\n`
    : "";

  return `${instructions}\n\n${memorySection}Per-round detail:\n${perRoundLines.join("\n\n")}\n\n`;
}

// TEMPORARY DEV-ONLY DIAGNOSTIC LOGGING.
// Reports shape/counts only — never reflection text or the API key.
// Safe to remove once the past-round history wiring is confirmed working.
function logCaddieHistoryDebugInfo(pastRounds: PastRound[]): void {
  if (process.env.NODE_ENV === "production") return;

  const mentalStateCount = pastRounds.reduce(
    (sum, round) => sum + round.moments.length,
    0,
  );
  const roundsWithReflection = pastRounds.filter(
    (round) =>
      Boolean(round.reflection.whatWorked) ||
      Boolean(round.reflection.whatGotInHead) ||
      Boolean(round.reflection.whatToRemember),
  ).length;

  console.log("[caddie] past-round history received:", {
    pastRoundCount: pastRounds.length,
    dates: pastRounds.map((round) => formatHistoryDate(round.date)),
    mentalStateCount,
    roundsWithReflection: `${roundsWithReflection}/${pastRounds.length}`,
  });
}

// TEMPORARY DEV-ONLY DIAGNOSTIC LOGGING (requested to verify Golfer Memory
// against real saved rounds). Reports structured facts and counts only —
// never full reflection text and never the API key. Safe to remove once
// verified.
function logGolferMemoryDebugInfo(
  memory: GolferMemory | null,
  pastRounds: PastRound[],
): void {
  if (process.env.NODE_ENV === "production") return;

  if (!memory) {
    console.log("[caddie] Golfer Memory: no completed rounds received from client.");
    return;
  }

  const roundsWithReflection = pastRounds.filter(
    (round) =>
      Boolean(round.reflection.whatWorked) ||
      Boolean(round.reflection.whatGotInHead) ||
      Boolean(round.reflection.whatToRemember),
  ).length;

  console.log("[caddie] Golfer Memory generated from real saved rounds:", {
    completedRoundCount: memory.roundCount,
    averageFocus: memory.averageFocus,
    averageEnergy: memory.averageEnergy,
    averageConfidence: memory.averageConfidence,
    mentalStateCounts: memory.mentalStateCounts,
    repeatedMentalStates: memory.mostRepeatedStates,
    roundsWithReflection: `${roundsWithReflection}/${pastRounds.length}`,
    repeatedReflectionThemes: {
      whatWorked: memory.workedThemes.map(({ keyword, count }) => ({ keyword, count })),
      whatGotInHead: memory.gotInHeadThemes.map(({ keyword, count }) => ({ keyword, count })),
      whatToRemember: memory.rememberThemes.map(({ keyword, count }) => ({ keyword, count })),
    },
  });
}

function isServiceUnavailable(status: number, errorBody: string): boolean {
  return status === 503 || errorBody.includes("UNAVAILABLE");
}

function callGemini(apiKey: string, message: string): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
      }),
    },
  );
}

type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; busy: boolean };

async function fetchGeminiReply(
  apiKey: string,
  message: string,
): Promise<GeminiResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const geminiResponse = await callGemini(apiKey, message);

    if (geminiResponse.ok) {
      const data = await geminiResponse.json();
      const reply: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (typeof reply === "string" && reply.trim()) {
        return { ok: true, text: reply.trim() };
      }

      console.error("Gemini API returned an empty response:", data);
      return { ok: false, busy: false };
    }

    const errorText = await geminiResponse.text();
    const busy = isServiceUnavailable(geminiResponse.status, errorText);
    console.error(
      `Gemini API error (attempt ${attempt}/${MAX_ATTEMPTS}):`,
      geminiResponse.status,
      errorText,
    );

    if (busy && attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    return { ok: false, busy };
  }

  return { ok: false, busy: false };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const message =
    body && typeof body === "object" && "message" in body
      ? (body as { message: unknown }).message
      : undefined;

  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "A message is required." }, { status: 400 });
  }

  const rawContext =
    body && typeof body === "object" && "context" in body
      ? (body as { context: unknown }).context
      : undefined;
  const contextObj =
    rawContext && typeof rawContext === "object"
      ? (rawContext as Record<string, unknown>)
      : {};
  const preRoundContext = parsePreRoundContext(contextObj.preRound);
  const roundContext = parseRoundContext(contextObj.round);
  const contextBlock = buildContextBlock(preRoundContext, roundContext);

  const rawHistory =
    body && typeof body === "object" && "history" in body
      ? (body as { history: unknown }).history
      : undefined;
  const pastRounds = parsePastRounds(rawHistory);
  logCaddieHistoryDebugInfo(pastRounds);
  const golferMemory = buildGolferMemory(pastRounds);
  logGolferMemoryDebugInfo(golferMemory, pastRounds);
  const historyBlock = buildHistoryBlock(pastRounds, golferMemory);

  const promptText = `${contextBlock}${historyBlock}Golfer says: ${message.trim()}`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set.");
    return Response.json({ error: UNAVAILABLE_MESSAGE }, { status: 500 });
  }

  try {
    const result = await fetchGeminiReply(apiKey, promptText);

    if (!result.ok) {
      return Response.json(
        { error: result.busy ? BUSY_MESSAGE : UNAVAILABLE_MESSAGE },
        { status: result.busy ? 503 : 502 },
      );
    }

    return Response.json({ response: result.text });
  } catch (error) {
    console.error("Failed to reach Gemini API:", error);
    return Response.json({ error: UNAVAILABLE_MESSAGE }, { status: 502 });
  }
}
