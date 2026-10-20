import { formatToPar } from "@/lib/play/round-data";
import type { Intervention } from "@/lib/play/interventions";
import { stateLabel, type Messages } from "@/lib/i18n";

/** One plain sentence ("Your caddie noticed…") explaining why the card appeared. */
export function describeWhy(intervention: Intervention, t: Messages): string {
  const card = t.resetCard;
  const detail = intervention.detail;
  const hole = intervention.hole;
  const toPar = detail?.toPar ?? null;

  switch (intervention.trigger) {
    case "blow-up":
      return card.whyBlowUp(hole, toPar !== null ? formatToPar(toPar) : "");
    case "rough-start": {
      const result =
        toPar === 2
          ? card.doubleBogey
          : toPar === 3
            ? card.tripleBogey
            : toPar !== null
              ? formatToPar(toPar)
              : null;
      return card.whyRoughStart(result);
    }
    case "low-confidence-start":
      return card.whyLowConfidence(hole);
    case "negative-streak":
    default: {
      const [first, second] = detail?.holes.length === 2 ? detail.holes : [hole - 1, hole];
      const states = (detail?.states ?? []).map((state) => stateLabel(t, state));
      if (states.length === 2 && states[0] !== states[1]) {
        return card.whyStreakTwo(first, second, states[0], states[1]);
      }
      return states.length > 0
        ? card.whyStreakSame(first, second, states[0])
        : card.whyStreakUnknown(first, second);
    }
  }
}
