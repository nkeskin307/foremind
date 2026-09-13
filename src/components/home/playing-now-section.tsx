import Link from "next/link";
import { MicIcon } from "@/components/icons";

export function PlayingNowSection() {
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold text-charcoal">Playing now?</h2>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/round"
          className="inline-flex flex-1 items-center justify-center rounded-full bg-forest px-6 py-3.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Start Round
        </Link>
        <Link
          href="/coach"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-cream px-6 py-3.5 text-sm font-semibold text-charcoal transition-colors hover:bg-sage-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <MicIcon className="h-4 w-4" aria-hidden="true" />
          Talk to Coach
        </Link>
      </div>
    </div>
  );
}
