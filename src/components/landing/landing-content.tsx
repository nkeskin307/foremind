"use client";

import Link from "next/link";
import { FlagstickMotif } from "@/components/motifs/flagstick-motif";
import { LanguageSelect } from "@/components/i18n/language-switcher";
import { useI18n } from "@/lib/i18n/use-i18n";

export function LandingContent() {
  const { t } = useI18n();
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
      <div className="absolute right-4 top-4 z-20">
        <LanguageSelect />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <p className="motion-heading text-sm font-medium tracking-wide text-sage">Fore!Mind</p>

        <h1 className="motion-heading mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t.landing.title}
        </h1>

        <p className="motion-body mt-4 text-base text-muted">{t.landing.subtitle}</p>

        <Link
          href="/prepare"
          className="motion-body-late mt-8 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light sm:w-auto"
        >
          {t.landing.cta}
        </Link>
      </div>
    </main>
  );
}
