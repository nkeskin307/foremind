import Link from "next/link";
import { FlagstickMotif } from "@/components/motifs/flagstick-motif";

export default function HomePage() {
  return (
    <main className="relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div
        className="hero-glow pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2"
        aria-hidden="true"
      />
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -right-20 top-1/2 h-[620px] w-auto -translate-y-1/2 opacity-[0.4] sm:-right-10"
      />
      <FlagstickMotif
        className="motif-flag-glow pointer-events-none absolute -left-24 bottom-0 h-[400px] w-auto -scale-x-100 opacity-[0.3]"
      />
      <div className="relative z-10 w-full max-w-md">
        <p className="motion-heading text-sm font-medium tracking-wide text-sage">Fore!Mind</p>

        <h1 className="motion-heading mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Golf is a mental game.
        </h1>

        <p className="motion-body mt-4 text-base text-muted">
          Your personal mental caddie that learns what gets in your head and
          helps you manage it.
        </p>

        <Link
          href="/prepare"
          className="motion-body-late mt-8 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light sm:w-auto"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
