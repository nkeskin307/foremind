import Link from "next/link";
import { generateRoutine, type CheckInRatings } from "@/lib/prepare/generate-routine";
import { FlagstickMotif } from "@/components/motifs/flagstick-motif";
import {
  parseCheckInParams,
  checkInToQueryString,
  type RawSearchParams,
} from "@/lib/prepare/check-in-params";

type SearchParams = Promise<RawSearchParams>;

export default async function RoutinePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const checkIn = parseCheckInParams(params);

  const ratings: CheckInRatings = {
    focus: checkIn.focus,
    energy: checkIn.energy,
    confidence: checkIn.confidence,
  };

  const routine = generateRoutine(ratings, checkIn.note);

  const forwardedQuery = checkInToQueryString(checkIn);
  const playHref = forwardedQuery ? `/play?${forwardedQuery}` : "/play";

  return (
    <div className="relative overflow-hidden">
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -right-14 -top-12 h-[400px] w-auto opacity-[0.32]"
      />
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -bottom-14 -left-14 h-[420px] w-auto -scale-x-100 opacity-[0.36]"
      />
      <div className="relative mx-auto w-full max-w-md px-6 py-16">
      <h1 className="motion-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Your Pre-Game Routine
      </h1>
      <div className="motion-body">
      <p className="mt-2 text-base text-muted">
        Built from how you&apos;re feeling today.
      </p>

      <div className="mt-8 space-y-6">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sage">
            1. Your Focus Today
          </h2>
          <p className="mt-2 text-sm text-foreground">{routine.focusMindset}</p>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sage">
            2. Before the First Tee
          </h2>
          <p className="mt-2 text-sm text-foreground">{routine.teePrep}</p>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sage">
            3. Physical Reset
          </h2>
          <p className="mt-2 text-sm text-foreground">{routine.physicalReset}</p>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sage">
            4. If Something Goes Wrong
          </h2>
          <p className="mt-2 text-sm text-foreground">{routine.reset}</p>
        </section>
      </div>

      <Link
        href={playHref}
        className="mt-10 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
      >
        Start My Round →
      </Link>
      </div>
      </div>
    </div>
  );
}
