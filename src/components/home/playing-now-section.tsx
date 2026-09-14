import Link from "next/link";

export function PlayingNowSection() {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
        Quick actions
      </span>
      <Link
        href="/round"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-light focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span aria-hidden="true">⛳</span>
        Play Now
      </Link>
      <Link
        href="/coach"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-light focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span aria-hidden="true">🎙</span>
        Talk to Coach
      </Link>
    </div>
  );
}
