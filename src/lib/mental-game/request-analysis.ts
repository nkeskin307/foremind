import {
  loadCompletedRounds,
  markAnalysisFailed,
  markAnalysisRequested,
  updateCompletedRoundAnalysis,
  withoutSamples,
  type CompletedRound,
} from "@/lib/mental-game/completed-rounds";
import { toRecapHistory } from "@/lib/mental-game/round-recap";

const MAX_HISTORY = 10;

/** Earlier real rounds (never samples), newest first — for "Pattern watch". */
function earlierRealRounds(round: CompletedRound) {
  const time = new Date(round.date).getTime();
  return withoutSamples(loadCompletedRounds())
    .filter((item) => item.id !== round.id && new Date(item.date).getTime() < time)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, MAX_HISTORY);
}
import { getLanguageSnapshot } from "@/lib/i18n/language-store";

/** How long "Analysis preparing…" may show before offering "Retry analysis". */
export const ANALYSIS_STUCK_MS = 30_000;

/**
 * Requests the post-round analysis and saves it on the round. Records when
 * it was requested and whether it failed, so My Mental Game can offer a
 * retry. Never throws.
 */
export async function requestPostRoundAnalysis(round: CompletedRound): Promise<void> {
  markAnalysisRequested(round.id);
  try {
    const res = await fetch("/api/post-round-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The analysis is written in the app language chosen at request time.
      body: JSON.stringify({
        round,
        language: getLanguageSnapshot(),
        history: round.sample ? [] : toRecapHistory(earlierRealRounds(round)),
      }),
    });
    const data = await res.json();
    if (res.ok && data && data.analysis) {
      updateCompletedRoundAnalysis(round.id, data.analysis);
    } else {
      markAnalysisFailed(round.id);
    }
  } catch {
    markAnalysisFailed(round.id);
  }
}

export type AnalysisStatus = "ready" | "none" | "preparing" | "stuck";

/** "stuck" = failed, never requested, or still preparing after ANALYSIS_STUCK_MS. */
export function analysisStatus(round: CompletedRound, now: number): AnalysisStatus {
  if (round.analysis) return "ready";
  const { whatWorked, whatGotInHead, whatToRemember } = round.reflection;
  if (!whatWorked && !whatGotInHead && !whatToRemember) return "none";
  if (round.analysisFailedAt || !round.analysisRequestedAt) return "stuck";
  const requestedAt = new Date(round.analysisRequestedAt).getTime();
  return now - requestedAt > ANALYSIS_STUCK_MS ? "stuck" : "preparing";
}
