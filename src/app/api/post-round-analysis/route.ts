export const runtime = "nodejs";

import { getMessages } from "@/lib/i18n";
import { getLanguageInfo, toAppLanguage } from "@/lib/i18n/languages";
import { formatToPar } from "@/lib/play/round-data";
import {
  MIN_EARLIER_ROUNDS_FOR_PATTERN,
  RECAP_MAX_WORDS,
  buildFallbackRecap,
  computeRecapGlance,
  enforceRecapLimit,
  findTurningPoint,
  type RecapHistoryRound,
  type RoundRecap,
} from "@/lib/mental-game/round-recap";
import {
  callGemini,
  checkRateLimit,
  clipText,
  rateLimitedResponse,
  readJsonBody,
} from "@/lib/server/api-safety";

// Request limits for this route.
const MAX_BODY_BYTES = 128 * 1024;
const MAX_HOLES = 36;
const MAX_TEXT_CHARS = 1000;
const MAX_INTERVENTIONS = 12;
const RATE_LIMIT = { limit: 8, windowMs: 60_000 };
const GEMINI_ATTEMPT_TIMEOUT_MS = 14_000;

// Same model as /api/caddie. Kept as a separate constant (rather than a
// shared import) so this route stays fully self-contained and never risks
// touching the existing Caddie route's behavior.
const GEMINI_MODEL = "gemini-3.1-flash-lite";

const SYSTEM_INSTRUCTION = `You are the Fore!Mind Post-Round Analyst. You write a short "Round Recap" of a golfer's completed round, using only the data provided: pre-round check-in, hole-by-hole scores and logged moods, Pause & reset cards, computed facts, earlier rounds (if any), and the golfer's reflection.

Return JSON with these fields:
- headline: ONE sentence summarizing this round's mental story.
- turningPoint: 1–2 sentences explaining WHY the turning-point hole given in COMPUTED FACTS was where the round changed, using the logged moods, scores and any reset card around it. If COMPUTED FACTS says there was no turning point, return "".
- whatWorked: 1 or 2 short bullets. Each must cite a specific hole number and/or quote the golfer's own reflection words.
- tryThis: EXACTLY ONE concrete action for the next round, in one sentence, tied to a specific hole, mood or the golfer's own words from this round.
- patternWatch: one sentence comparing this round with the EARLIER ROUNDS (or the same course) — only if earlier rounds are provided; otherwise return "".

Rules:
- All fields together must stay under ${RECAP_MAX_WORDS} words.
- Every sentence must be tied to something specific from this round (a hole, a score, a logged mood, a reset card, or the golfer's own words). Never give generic advice.
- Use the numbers in COMPUTED FACTS as given; never invent data.
- Never claim a mood or a reset card caused a score — use wording like "came after", "showed up around", "was followed by".
- Mental game only: no technical swing advice.
- Plain text only — no markdown or asterisks.
- Respond only with the requested JSON structure.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    turningPoint: { type: "STRING" },
    whatWorked: { type: "ARRAY", items: { type: "STRING" }, minItems: 1, maxItems: 2 },
    tryThis: { type: "STRING" },
    patternWatch: { type: "STRING" },
  },
  required: ["headline", "turningPoint", "whatWorked", "tryThis", "patternWatch"],
};

const RETRY_DELAY_MS = 1000;
const MAX_ATTEMPTS = 2;

type AiRecapFields = {
  headline: string;
  turningPoint: string;
  whatWorked: string[];
  tryThis: string;
  patternWatch: string;
};

const MAX_HISTORY = 10;

function parseHistory(value: unknown): RecapHistoryRound[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_HISTORY).flatMap((item): RecapHistoryRound[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    return [
      {
        course: typeof raw.course === "string" ? raw.course : "",
        date: typeof raw.date === "string" ? raw.date : "",
        toPar: typeof raw.toPar === "number" && Number.isFinite(raw.toPar) ? raw.toPar : null,
        holesScored: typeof raw.holesScored === "number" ? raw.holesScored : 0,
        states: Array.isArray(raw.states)
          ? raw.states.filter((state): state is string => typeof state === "string")
          : [],
      },
    ];
  });
}

type ParsedIntervention = {
  hole: number;
  trigger: string;
  reason: string;
  outcome: string;
  nextHole: number | null;
  nextHoleToPar: number | null;
};

const TRIGGER_LABELS: Record<string, string> = {
  "negative-streak": "negative mental state on two holes in a row",
  "blow-up": "a hole at par +2 or worse",
  "rough-start": "double bogey or worse on hole 1",
  "low-confidence-start": "low pre-round confidence and an over-par first hole",
};

const OUTCOME_LABELS: Record<string, string> = {
  opened: "opened the Caddie to talk",
  dismissed: "tapped Got it",
  ignored: "did not respond to it",
};

function parseInterventions(value: unknown): ParsedIntervention[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ParsedIntervention[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const hole = toNumberOrNull(raw.hole);
    if (hole === null || typeof raw.trigger !== "string") return [];
    return [
      {
        hole,
        trigger: raw.trigger,
        reason: typeof raw.reason === "string" ? raw.reason : "",
        outcome: typeof raw.outcome === "string" ? raw.outcome : "ignored",
        nextHole: toNumberOrNull(raw.nextHole),
        nextHoleToPar: toNumberOrNull(raw.nextHoleToPar),
      },
    ];
  });
}

type ParsedRound = {
  course: string;
  holes: number;
  /** null = hole not scored. */
  scores: (number | null)[];
  pars: number[];
  mentalNotes: (string | null)[];
  /** Sum of scored holes only. */
  total: number;
  totalPar: number;
  holesScored: number;
  interventions: ParsedIntervention[];
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

/** 503 / UNAVAILABLE and 429 / RESOURCE_EXHAUSTED (Gemini rate limit) are worth one retry. */
function isServiceUnavailable(status: number, errorBody: string): boolean {
  return (
    status === 503 ||
    status === 429 ||
    errorBody.includes("UNAVAILABLE") ||
    errorBody.includes("RESOURCE_EXHAUSTED")
  );
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}


function parseRoundForAnalysis(value: unknown): ParsedRound | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  if (!Array.isArray(raw.scores) || raw.scores.length === 0) return null;

  // Keep hole positions intact: an unscored hole stays null (never dropped,
  // which would shift every later hole's number).
  const holes =
    typeof raw.holes === "number" && Number.isInteger(raw.holes) && raw.holes > 0
      ? Math.min(raw.holes, MAX_HOLES)
      : Math.min(raw.scores.length, MAX_HOLES);
  const rawScores = raw.scores as unknown[];
  const rawPars = Array.isArray(raw.pars) ? (raw.pars as unknown[]) : [];
  const rawNotes = Array.isArray(raw.mentalNotes) ? (raw.mentalNotes as unknown[]) : [];
  const scores = Array.from({ length: holes }, (_, index) => toNumberOrNull(rawScores[index]));
  const pars = Array.from({ length: holes }, (_, index) => {
    const par = toNumberOrNull(rawPars[index]);
    return par !== null && par >= 3 && par <= 6 ? par : 4;
  });
  const mentalNotes = Array.from({ length: holes }, (_, index) => {
    const note = rawNotes[index];
    return typeof note === "string" && note ? note : null;
  });

  let total = 0;
  let totalPar = 0;
  let holesScored = 0;
  scores.forEach((score, index) => {
    if (score === null) return;
    total += score;
    totalPar += pars[index];
    holesScored += 1;
  });

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
    holes,
    scores,
    pars,
    mentalNotes,
    total,
    totalPar,
    holesScored,
    interventions: parseInterventions(raw.interventions).slice(0, MAX_INTERVENTIONS),
    preRound: {
      focus: toNumberOrNull(preRoundRaw.focus),
      energy: toNumberOrNull(preRoundRaw.energy),
      confidence: toNumberOrNull(preRoundRaw.confidence),
      note: clipText(preRoundRaw.note, MAX_TEXT_CHARS),
    },
    reflection: {
      whatWorked: clipText(reflectionRaw.whatWorked, MAX_TEXT_CHARS),
      whatGotInHead: clipText(reflectionRaw.whatGotInHead, MAX_TEXT_CHARS),
      whatToRemember: clipText(reflectionRaw.whatToRemember, MAX_TEXT_CHARS),
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
  if (round.holesScored > 0) {
    const toPar = round.total - round.totalPar;
    lines.push(
      `- Total score: ${round.total} across ${round.holesScored} of ${round.holes} scored holes (${
        toPar === 0 ? "even par" : toPar > 0 ? `+${toPar}` : `${toPar}`
      } vs par on those holes)`,
    );
  } else {
    lines.push("- No hole scores were entered.");
  }
  if (round.holesScored < round.holes) {
    lines.push(
      "- Holes marked \"not scored\" have no score entered. Do not treat them as played holes or guess their scores.",
    );
  }
  lines.push("- Hole-by-hole:");
  round.scores.forEach((score, index) => {
    const state = round.mentalNotes[index];
    const par = round.pars[index];
    const scoreText =
      score === null
        ? "not scored"
        : `score ${score} (${score === par ? "even" : score > par ? `+${score - par}` : `${score - par}`})`;
    lines.push(
      `  Hole ${index + 1} (par ${par}): ${scoreText}${state ? `, mental state logged: ${state}` : ""}`,
    );
  });

  lines.push("");
  lines.push("PROACTIVE CADDIE RESET CARDS:");
  if (round.interventions.length === 0) {
    lines.push("- None were shown this round.");
  } else {
    for (const card of round.interventions) {
      const next =
        card.nextHole !== null && card.nextHoleToPar !== null
          ? `next scored hole ${card.nextHole} was ${
              card.nextHoleToPar === 0
                ? "even par"
                : card.nextHoleToPar > 0
                  ? `+${card.nextHoleToPar}`
                  : `${card.nextHoleToPar}`
            }`
          : "no later hole was scored";
      lines.push(
        `- Hole ${card.hole}: shown for ${TRIGGER_LABELS[card.trigger] ?? card.trigger}${
          card.reason ? ` (${card.reason})` : ""
        }; golfer ${OUTCOME_LABELS[card.outcome] ?? "did not respond to it"}; ${next}.`,
      );
    }
  }

  lines.push("");
  lines.push("POST-ROUND REFLECTION:");
  lines.push(`- What worked well mentally: "${round.reflection.whatWorked || "(not answered)"}"`);
  lines.push(`- What got in their head: "${round.reflection.whatGotInHead || "(not answered)"}"`);
  lines.push(
    `- What they want to remember next round: "${round.reflection.whatToRemember || "(not answered)"}"`,
  );

  return lines.join("\n");
}

function buildComputedFacts(round: ParsedRound, history: RecapHistoryRound[]): string {
  const glance = computeRecapGlance(round);
  const turn = findTurningPoint(round);
  const lines = ["COMPUTED FACTS (from code — use as given):"];
  lines.push(
    `- Score vs par: ${glance.toPar === null ? "no holes scored" : `${formatToPar(glance.toPar)} over ${glance.holesScored} of ${glance.holes} scored holes`}`,
  );
  if (glance.bestStretch) {
    lines.push(
      `- Best stretch: holes ${glance.bestStretch.first}–${glance.bestStretch.last} (${formatToPar(glance.bestStretch.toPar)})`,
    );
  }
  if (glance.toughestHole) {
    lines.push(`- Toughest hole: hole ${glance.toughestHole.hole} (${formatToPar(glance.toughestHole.toPar)})`);
  }
  lines.push(`- Moods logged: ${glance.moodsLogged}; Pause & reset cards: ${glance.resetCards}`);
  lines.push(
    turn
      ? `- Turning point: hole ${turn.hole} — ${turn.kind === "bounce-back" ? "bounce-back" : "slide"} after ${formatToPar(turn.fromToPar)} on hole ${turn.fromHole}; next holes averaged ${turn.afterAverage.toFixed(1)} vs par${turn.afterReset ? `; a Pause & reset card was shown on hole ${turn.fromHole}` : ""}${turn.mood ? `; mood logged around it: ${turn.mood}` : ""}`
      : "- Turning point: none (no clear change in this round) — return an empty turningPoint.",
  );

  lines.push("");
  if (history.length >= MIN_EARLIER_ROUNDS_FOR_PATTERN) {
    lines.push(`EARLIER ROUNDS (${history.length}, newest first):`);
    for (const item of history) {
      lines.push(
        `- ${item.date.slice(0, 10)} at ${item.course || "unnamed course"}: ${item.toPar === null ? "not scored" : `${formatToPar(item.toPar)} over ${item.holesScored} holes`}; moods: ${item.states.join(", ") || "none"}`,
      );
    }
  } else {
    lines.push(
      `EARLIER ROUNDS: fewer than ${MIN_EARLIER_ROUNDS_FOR_PATTERN} — return an empty patternWatch.`,
    );
  }
  return lines.join("\n");
}

function parseRecapJson(text: string): AiRecapFields | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    const raw = parsed as Record<string, unknown>;
    const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    const whatWorked = Array.isArray(raw.whatWorked)
      ? raw.whatWorked.map(str).filter(Boolean).slice(0, 2)
      : [];
    const fields: AiRecapFields = {
      headline: str(raw.headline),
      turningPoint: str(raw.turningPoint),
      whatWorked,
      tryThis: str(raw.tryThis),
      patternWatch: str(raw.patternWatch),
    };
    return fields.headline && fields.tryThis && fields.whatWorked.length > 0 ? fields : null;
  } catch {
    return null;
  }
}

function callGeminiForAnalysis(apiKey: string, promptText: string): Promise<Response> {
  return callGemini(
    GEMINI_MODEL,
    apiKey,
    {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    },
    GEMINI_ATTEMPT_TIMEOUT_MS,
  );
}

async function fetchGeminiAnalysis(
  apiKey: string,
  promptText: string,
): Promise<AiRecapFields | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const geminiResponse = await callGeminiForAnalysis(apiKey, promptText);

    if (geminiResponse.ok) {
      const data = await geminiResponse.json();
      const reply: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (typeof reply === "string" && reply.trim()) {
        return parseRecapJson(reply.trim());
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
  const limited = checkRateLimit(request, "analysis", RATE_LIMIT.limit, RATE_LIMIT.windowMs);
  if (!limited.ok) {
    return rateLimitedResponse(limited.retryAfterSeconds, "Too many requests. Try again shortly.");
  }

  const read = await readJsonBody(request, MAX_BODY_BYTES);
  if (!read.ok) {
    return Response.json({ error: "Invalid request body." }, { status: read.status });
  }
  const body = read.body;

  const rawRound =
    body && typeof body === "object" && "round" in body
      ? (body as { round: unknown }).round
      : undefined;
  const round = parseRoundForAnalysis(rawRound);

  if (!round) {
    return Response.json({ error: "Round data is required." }, { status: 400 });
  }

  const lang = toAppLanguage((body as { language?: unknown }).language) ?? "en";
  // Earlier real rounds (the client never includes sample rounds).
  const history = parseHistory((body as { history?: unknown }).history);
  const fallback = buildFallbackRecap(round, history, getMessages(lang), lang);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set.");
    return Response.json({ analysis: fallback });
  }

  try {
    const languageName = getLanguageInfo(lang).englishName;
    // Field keys stay in English (JSON schema); the text is in the golfer's language.
    const promptText = `${buildAnalysisPrompt(round)}\n\n${buildComputedFacts(round, history)}\n\nWrite every field in ${languageName}. Use golf terms the way ${languageName}-speaking golfers say them (par, bogey, birdie, double bogey). Translate mood names naturally.`;
    const fields = await fetchGeminiAnalysis(apiKey, promptText);

    if (!fields) {
      return Response.json({ analysis: fallback });
    }

    // The turning-point hole and the pattern-watch rule come from code, not the AI.
    const turn = findTurningPoint(round);
    const recap: RoundRecap = enforceRecapLimit({
      version: 2,
      headline: fields.headline,
      turningPoint: turn
        ? { hole: turn.hole, text: fields.turningPoint || fallback.turningPoint?.text || "" }
        : null,
      whatWorked: fields.whatWorked,
      tryThis: fields.tryThis,
      patternWatch:
        history.length >= MIN_EARLIER_ROUNDS_FOR_PATTERN ? fields.patternWatch || null : null,
      generatedAt: new Date().toISOString(),
      source: "ai",
    });

    return Response.json({ analysis: recap });
  } catch (error) {
    console.error("Failed to reach Gemini API for post-round analysis:", error);
    return Response.json({ analysis: fallback });
  }
}
