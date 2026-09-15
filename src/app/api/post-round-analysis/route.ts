export const runtime = "nodejs";

// Same model as /api/caddie. Kept as a separate constant (rather than a
// shared import) so this route stays fully self-contained and never risks
// touching the existing Caddie route's behavior.
const GEMINI_MODEL = "gemini-3.1-flash-lite";

const SYSTEM_INSTRUCTION = `You are the Fore!Mind Post-Round Analyst. You write a short, structured mental-game analysis of a golfer's completed round, using only the pre-round check-in, hole-by-hole scores and mental states, and post-round reflection provided to you.

Write exactly four sections:
1. What Helped
2. What Got In Your Way
3. Pattern To Watch
4. Take Into Your Next Round

Rules:
- Keep each section to one to three short sentences.
- Never claim a mental state caused a score. When connecting a mental state to what happened on the course, use wording like "coincided with", "showed up around", "appeared on", or "was followed by".
- Never invent data that wasn't provided. If there isn't enough information for a section, say so plainly and briefly instead of making something up.
- Keep the tone supportive, practical, and golf-specific.
- Do not give technical swing advice — this is about the mental game only.
- Write each section as plain text only — no markdown, no asterisks, no bullet points.
- Respond only with the requested JSON structure.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    whatHelped: { type: "STRING" },
    whatGotInYourWay: { type: "STRING" },
    patternToWatch: { type: "STRING" },
    takeIntoNextRound: { type: "STRING" },
  },
  required: ["whatHelped", "whatGotInYourWay", "patternToWatch", "takeIntoNextRound"],
};

const RETRY_DELAY_MS = 1000;
const MAX_ATTEMPTS = 2;

type AnalysisFields = {
  whatHelped: string;
  whatGotInYourWay: string;
  patternToWatch: string;
  takeIntoNextRound: string;
};

type AnalysisResult = AnalysisFields & {
  generatedAt: string;
  source: "ai" | "fallback";
};

type ParsedRound = {
  course: string;
  holes: number;
  scores: number[];
  mentalNotes: (string | null)[];
  total: number;
  preRound: {
    focus: number | null;
    energy: number | null;
    confidence: number | null;
    note: string;
  };
  reflection: {
    whatWorked: string;
    whatGotInHead: string;
    whatToRemember: string;
  };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isServiceUnavailable(status: number, errorBody: string): boolean {
  return status === 503 || errorBody.includes("UNAVAILABLE");
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatHoleList(holes: number[]): string {
  if (holes.length === 1) return `${holes[0]}`;
  if (holes.length === 2) return `${holes[0]} and ${holes[1]}`;
  return `${holes.slice(0, -1).join(", ")}, and ${holes[holes.length - 1]}`;
}

function parseRoundForAnalysis(value: unknown): ParsedRound | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const scores = Array.isArray(raw.scores)
    ? raw.scores.filter((n): n is number => typeof n === "number")
    : [];
  if (scores.length === 0) return null;

  const mentalNotes = Array.isArray(raw.mentalNotes)
    ? raw.mentalNotes.filter((n): n is string | null => typeof n === "string" || n === null)
    : [];

  const preRoundRaw =
    raw.preRound && typeof raw.preRound === "object"
      ? (raw.preRound as Record<string, unknown>)
      : {};
  const reflectionRaw =
    raw.reflection && typeof raw.reflection === "object"
      ? (raw.reflection as Record<string, unknown>)
      : {};

  return {
    course: typeof raw.course === "string" ? raw.course.trim() : "",
    holes: typeof raw.holes === "number" ? raw.holes : scores.length,
    scores,
    mentalNotes,
    total:
      typeof raw.total === "number"
        ? raw.total
        : scores.reduce((sum, score) => sum + score, 0),
    preRound: {
      focus: toNumberOrNull(preRoundRaw.focus),
      energy: toNumberOrNull(preRoundRaw.energy),
      confidence: toNumberOrNull(preRoundRaw.confidence),
      note: typeof preRoundRaw.note === "string" ? preRoundRaw.note.trim() : "",
    },
    reflection: {
      whatWorked:
        typeof reflectionRaw.whatWorked === "string" ? reflectionRaw.whatWorked.trim() : "",
      whatGotInHead:
        typeof reflectionRaw.whatGotInHead === "string"
          ? reflectionRaw.whatGotInHead.trim()
          : "",
      whatToRemember:
        typeof reflectionRaw.whatToRemember === "string"
          ? reflectionRaw.whatToRemember.trim()
          : "",
    },
  };
}

function buildAnalysisPrompt(round: ParsedRound): string {
  const lines: string[] = [];

  lines.push("PRE-ROUND CHECK-IN:");
  const hasPreRound =
    round.preRound.focus !== null ||
    round.preRound.energy !== null ||
    round.preRound.confidence !== null ||
    Boolean(round.preRound.note);
  if (round.preRound.focus !== null) lines.push(`- Focus: ${round.preRound.focus}/5`);
  if (round.preRound.energy !== null) lines.push(`- Energy: ${round.preRound.energy}/5`);
  if (round.preRound.confidence !== null)
    lines.push(`- Confidence: ${round.preRound.confidence}/5`);
  if (round.preRound.note) lines.push(`- Note: "${round.preRound.note}"`);
  if (!hasPreRound) lines.push("- No pre-round check-in data was recorded.");

  lines.push("");
  lines.push("DURING THE ROUND:");
  lines.push(`- Course: ${round.course || "Not recorded"}`);
  lines.push(`- Holes: ${round.holes}`);
  lines.push(`- Total score: ${round.total}`);
  lines.push("- Hole-by-hole:");
  round.scores.forEach((score, index) => {
    const state = round.mentalNotes[index];
    lines.push(`  Hole ${index + 1}: score ${score}${state ? `, mental state logged: ${state}` : ""}`);
  });

  lines.push("");
  lines.push("POST-ROUND REFLECTION:");
  lines.push(`- What worked well mentally: "${round.reflection.whatWorked || "(not answered)"}"`);
  lines.push(`- What got in their head: "${round.reflection.whatGotInHead || "(not answered)"}"`);
  lines.push(
    `- What they want to remember next round: "${round.reflection.whatToRemember || "(not answered)"}"`,
  );

  return lines.join("\n");
}

function buildFallbackAnalysis(round: ParsedRound): AnalysisResult {
  const holesByState = new Map<string, number[]>();
  round.mentalNotes.forEach((state, index) => {
    if (state) {
      const holes = holesByState.get(state) ?? [];
      holes.push(index + 1);
      holesByState.set(state, holes);
    }
  });

  const whatHelped = round.reflection.whatWorked
    ? round.reflection.whatWorked
    : "No specific mental wins were noted for this round.";

  const whatGotInYourWay = round.reflection.whatGotInHead
    ? round.reflection.whatGotInHead
    : holesByState.size > 0
      ? `${[...holesByState.keys()].join(", ")} showed up during the round.`
      : "Nothing specific was noted as getting in the way this round.";

  let patternToWatch = "Not enough data from this round to identify a repeating pattern.";
  for (const [state, holes] of holesByState) {
    if (holes.length >= 2) {
      patternToWatch = `${state} appeared on Holes ${formatHoleList(holes)}.`;
      break;
    }
  }

  const takeIntoNextRound = round.reflection.whatToRemember
    ? round.reflection.whatToRemember
    : "Set one clear intention to carry into your next round.";

  return {
    whatHelped,
    whatGotInYourWay,
    patternToWatch,
    takeIntoNextRound,
    generatedAt: new Date().toISOString(),
    source: "fallback",
  };
}

function parseAnalysisJson(text: string): AnalysisFields | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    const raw = parsed as Record<string, unknown>;

    const fields = [
      "whatHelped",
      "whatGotInYourWay",
      "patternToWatch",
      "takeIntoNextRound",
    ] as const;

    const result = {} as AnalysisFields;
    for (const field of fields) {
      const value = raw[field];
      if (typeof value !== "string" || !value.trim()) return null;
      result[field] = value.trim();
    }
    return result;
  } catch {
    return null;
  }
}

function callGeminiForAnalysis(apiKey: string, promptText: string): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
  );
}

async function fetchGeminiAnalysis(
  apiKey: string,
  promptText: string,
): Promise<AnalysisFields | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const geminiResponse = await callGeminiForAnalysis(apiKey, promptText);

    if (geminiResponse.ok) {
      const data = await geminiResponse.json();
      const reply: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (typeof reply === "string" && reply.trim()) {
        return parseAnalysisJson(reply.trim());
      }

      console.error("Gemini analysis returned an empty response:", data);
      return null;
    }

    const errorText = await geminiResponse.text();
    const busy = isServiceUnavailable(geminiResponse.status, errorText);
    console.error(
      `Gemini analysis error (attempt ${attempt}/${MAX_ATTEMPTS}):`,
      geminiResponse.status,
      errorText,
    );

    if (busy && attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    return null;
  }

  return null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawRound =
    body && typeof body === "object" && "round" in body
      ? (body as { round: unknown }).round
      : undefined;
  const round = parseRoundForAnalysis(rawRound);

  if (!round) {
    return Response.json({ error: "Round data is required." }, { status: 400 });
  }

  const fallback = buildFallbackAnalysis(round);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set.");
    return Response.json({ analysis: fallback });
  }

  try {
    const promptText = buildAnalysisPrompt(round);
    const fields = await fetchGeminiAnalysis(apiKey, promptText);

    if (!fields) {
      return Response.json({ analysis: fallback });
    }

    const analysis: AnalysisResult = {
      ...fields,
      generatedAt: new Date().toISOString(),
      source: "ai",
    };

    return Response.json({ analysis });
  } catch (error) {
    console.error("Failed to reach Gemini API for post-round analysis:", error);
    return Response.json({ analysis: fallback });
  }
}
