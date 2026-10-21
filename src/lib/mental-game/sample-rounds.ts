import {
  addCompletedRounds,
  removeSampleRounds,
  type CompletedRound,
} from "@/lib/mental-game/completed-rounds";
import { summarizeScores } from "@/lib/play/round-data";
import type { Intervention, InterventionTrigger } from "@/lib/play/interventions";
import { withNextHoleResults } from "@/lib/play/proactive-caddie";
import { removeRoundPhoto, saveRoundPhoto } from "@/lib/photos/photo-store";
import type { Messages } from "@/lib/i18n";
import { buildFallbackRecap, toRecapHistory } from "@/lib/mental-game/round-recap";
import type { AppLanguage } from "@/lib/i18n/languages";

const CEDAR = { name: "Cedar Ridge Golf Club", pars: [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5] };
const HARBOR = { name: "Harbor Point Links", pars: [4, 3, 5, 4, 4, 3, 4, 5, 4] };

type SampleSpec = {
  course: typeof CEDAR;
  daysAgo: number;
  scores: number[];
  states: Record<number, string>; // 1-based hole → English state key
  preRound: { focus: number; energy: number; confidence: number };
  interventions: { hole: number; trigger: InterventionTrigger; outcome: Intervention["outcome"]; states?: string[] }[];
  photo: boolean;
};

// Two courses, three rounds each; one round per course has no photo.
const SPECS: SampleSpec[] = [
  {
    course: CEDAR, daysAgo: 42, photo: true,
    scores: [6, 5, 3, 6, 5, 4, 4, 6, 5, 4, 4, 5, 6, 4, 5, 3, 4, 6],
    states: { 1: "Frustrated", 2: "Rushed", 5: "Rushed", 13: "Overthinking", 16: "Calm" },
    preRound: { focus: 2, energy: 3, confidence: 3 },
    interventions: [
      { hole: 1, trigger: "rough-start", outcome: "dismissed" },
      { hole: 8, trigger: "blow-up", outcome: "opened" },
    ],
  },
  {
    course: HARBOR, daysAgo: 35, photo: true,
    scores: [5, 3, 7, 4, 5, 3, 4, 5, 4],
    states: { 3: "Frustrated", 4: "Rushed", 8: "Calm" },
    preRound: { focus: 3, energy: 4, confidence: 3 },
    interventions: [{ hole: 3, trigger: "blow-up", outcome: "dismissed" }],
  },
  {
    course: CEDAR, daysAgo: 26, photo: false,
    scores: [4, 5, 3, 5, 4, 5, 4, 4, 5, 5, 3, 4, 6, 4, 4, 3, 5, 5],
    states: { 6: "Rushed", 7: "Frustrated", 10: "Calm", 12: "Focused" },
    preRound: { focus: 3, energy: 3, confidence: 4 },
    interventions: [{ hole: 7, trigger: "negative-streak", outcome: "ignored", states: ["Rushed", "Frustrated"] }],
  },
  {
    course: HARBOR, daysAgo: 18, photo: false,
    scores: [5, 4, 5, 5, 4, 3, 4, 6, 4],
    states: { 2: "Overthinking", 4: "Overthinking", 7: "Focused" },
    preRound: { focus: 3, energy: 2, confidence: 2 },
    interventions: [{ hole: 1, trigger: "low-confidence-start", outcome: "dismissed" }],
  },
  {
    course: CEDAR, daysAgo: 9, photo: true,
    scores: [5, 4, 3, 5, 4, 4, 3, 5, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5],
    states: { 1: "Focused", 9: "Calm", 14: "Confident" },
    preRound: { focus: 4, energy: 4, confidence: 4 },
    interventions: [],
  },
  {
    course: HARBOR, daysAgo: 3, photo: true,
    scores: [4, 3, 5, 4, 4, 4, 4, 5, 4],
    states: { 5: "Calm", 6: "Focused" },
    preRound: { focus: 4, energy: 3, confidence: 4 },
    interventions: [],
  },
];

function buildRound(spec: SampleSpec, index: number, t: Messages): CompletedRound {
  const holes = spec.course.pars.length;
  const pars = spec.course.pars;
  const mentalNotes = Array.from({ length: holes }, (_, i) => spec.states[i + 1] ?? null);
  const date = new Date(Date.now() - spec.daysAgo * 86_400_000).toISOString();
  const reflection = t.sample.reflections[index % t.sample.reflections.length];

  const interventions = withNextHoleResults(
    spec.interventions.map((item, i): Intervention => {
      const toPar = spec.scores[item.hole - 1] - pars[item.hole - 1];
      return {
        id: `sample-${index}-intervention-${i}`,
        hole: item.hole,
        trigger: item.trigger,
        reason: `Sample: ${item.trigger} on hole ${item.hole}`,
        message: t.resetCard.fallbacks[item.trigger],
        source: "fallback",
        outcome: item.outcome,
        createdAt: date,
        nextHole: null,
        nextHoleToPar: null,
        detail: {
          toPar: item.trigger === "negative-streak" ? null : toPar,
          states: item.states ?? [],
          holes: item.trigger === "negative-streak" ? [item.hole - 1, item.hole] : [item.hole],
        },
      };
    }),
    spec.scores,
    pars,
  );

  return {
    id: `sample-${index}`,
    sample: true,
    course: spec.course.name,
    holes,
    scores: spec.scores,
    pars,
    total: summarizeScores(spec.scores, pars).total,
    mentalNotes,
    preRound: { ...spec.preRound, note: "" },
    date,
    interventions,
    reflection: { ...reflection },
  };
}

/** A simple drawn "course" picture (sky, fairway, flag) — no network, no assets. */
function drawSamplePhoto(seed: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 450;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  const sky = ctx.createLinearGradient(0, 0, 0, 260);
  sky.addColorStop(0, ["#9cc9e8", "#f2c38b", "#b9d7ea", "#e9b9a0"][seed % 4]);
  sky.addColorStop(1, "#eef3e6");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 800, 260);
  ctx.fillStyle = "#3f7a3a";
  ctx.fillRect(0, 240, 800, 210);
  ctx.fillStyle = "#5aa04f";
  ctx.beginPath();
  ctx.ellipse(470 + (seed % 3) * 60, 300, 170, 45, 0, 0, Math.PI * 2);
  ctx.fill();
  const x = 480 + (seed % 3) * 60;
  ctx.fillStyle = "#f5f5f0";
  ctx.fillRect(x, 170, 5, 130);
  ctx.fillStyle = "#d9463b";
  ctx.beginPath();
  ctx.moveTo(x + 5, 170);
  ctx.lineTo(x + 60, 188);
  ctx.lineTo(x + 5, 206);
  ctx.fill();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.7));
}

/** Adds the 6 sample rounds (and their photos, best-effort). */
export async function loadSampleRounds(t: Messages, lang: AppLanguage): Promise<void> {
  const base = SPECS.map((spec, index) => buildRound(spec, index, t));
  // Same Round Recap builder as the app's own fallback; each sample round's
  // "earlier rounds" are the sample rounds before it (newest first).
  const rounds: CompletedRound[] = base.map((round, index) => ({
    ...round,
    analysis: {
      ...buildFallbackRecap(round, toRecapHistory(base.slice(0, index).reverse()), t, lang),
      generatedAt: round.date,
    },
  }));
  addCompletedRounds(rounds);
  await Promise.all(
    SPECS.map(async (spec, index) => {
      if (!spec.photo) return;
      const blob = await drawSamplePhoto(index);
      if (blob) await saveRoundPhoto(rounds[index].id, blob).catch(() => undefined);
    }),
  );
}

/** Removes every sample round and its photo. Real rounds are untouched. */
export async function clearSampleData(): Promise<void> {
  const ids = removeSampleRounds();
  await Promise.all(ids.map((id) => removeRoundPhoto(id).catch(() => undefined)));
}
