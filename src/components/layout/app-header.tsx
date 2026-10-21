"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeftIcon } from "@/components/icons/arrow-left-icon";
import { ChevronDownIcon } from "@/components/icons/chevron-down-icon";
import { MicIcon } from "@/components/icons/mic-icon";
import { RotateIcon } from "@/components/icons/rotate-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { ShieldIcon } from "@/components/icons/shield-icon";
import { useCaddieContext } from "@/lib/caddie/caddie-context";
import { useI18n } from "@/lib/i18n/use-i18n";
import { LanguageMenuItems } from "@/components/i18n/language-switcher";
import {
  getActiveRoundSnapshot,
  clearActiveRound,
  loadActiveRound,
} from "@/lib/play/active-round-storage";
import { clearCheckInDraft } from "@/lib/prepare/check-in-draft-storage";
import {
  clearLatestCheckIn,
  loadLatestCheckIn,
  markLatestCheckInHandled,
  saveLatestCheckIn,
} from "@/lib/prepare/latest-check-in-storage";

type ConfirmAction = "restart-round" | "start-over" | null;

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { openPanel } = useCaddieContext();
  const { t } = useI18n();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasActiveRound, setHasActiveRound] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [showAbout, setShowAbout] = useState(false);

  if (pathname === "/") return null;

  function toggleMenu() {
    setIsMenuOpen((open) => {
      const next = !open;
      // Re-check on open rather than reactively, since the active round
      // lives in localStorage and this header stays mounted across
      // client-side navigations.
      if (next) setHasActiveRound(getActiveRoundSnapshot() !== "");
      return next;
    });
  }

  function closeMenu() {
    setIsMenuOpen(false);
  }

  function handleConfirm() {
    if (confirmAction === "restart-round") {
      // The restarted round uses the latest check-in from localStorage. For
      // rounds started before that was stored, save the round's own check-in
      // there first so it carries over.
      const activePreRound = loadActiveRound()?.preRound ?? null;
      if (!loadLatestCheckIn() && activePreRound) {
        saveLatestCheckIn(activePreRound);
        markLatestCheckInHandled();
      }
      clearActiveRound();
      // A full navigation, not router.push: Restart Round can be triggered
      // while already on /play, where a client-side push to the same route
      // wouldn't remount the page — leaving the in-memory round mounted, its
      // autosave effect would then immediately re-write the just-cleared
      // round straight back into localStorage.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/play";
    } else if (confirmAction === "start-over") {
      clearActiveRound();
      clearCheckInDraft();
      clearLatestCheckIn();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    }
  }

  return (
    <>
      {/* No backdrop-blur: it would make the header the containing block for
          the menu's fixed "tap outside to close" layer, so taps below the
          header wouldn't close the menu. */}
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="-ml-2 flex min-h-11 items-center gap-1.5 px-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              {t.common.back}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={toggleMenu}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                className="flex min-h-11 items-center gap-1 rounded-full border border-border bg-surface px-4 text-xs font-medium text-muted transition-colors hover:border-forest hover:text-foreground"
              >
                {t.header.session}
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>

              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={closeMenu} />
                  <div
                    role="menu"
                    className="motion-fade absolute left-0 top-full z-40 mt-2 max-h-[70vh] w-56 overflow-y-auto rounded-2xl border border-border bg-surface py-1 shadow-xl shadow-black/30"
                  >
                    {hasActiveRound && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          closeMenu();
                          setConfirmAction("restart-round");
                        }}
                        className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-sage-soft"
                      >
                        <RotateIcon className="h-3.5 w-3.5 shrink-0 text-sage" />
                        {t.header.restartRound}
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeMenu();
                        setConfirmAction("start-over");
                      }}
                      className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-sage-soft"
                    >
                      <RotateIcon className="h-3.5 w-3.5 shrink-0 text-sage" />
                      {t.header.startOver}
                    </button>
                    {pathname === "/mental-game" && (
                      <Link
                        href="/"
                        role="menuitem"
                        onClick={() => {
                          closeMenu();
                          // End Session clears only the current unfinished
                          // session — completed rounds, My Mental Game
                          // history, and Caddie history are untouched — so
                          // starting again from the homepage feels fresh.
                          clearActiveRound();
                          clearCheckInDraft();
                          clearLatestCheckIn();
                        }}
                        className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-sage-soft"
                      >
                        <HomeIcon className="h-3.5 w-3.5 shrink-0 text-sage" />
                        {t.header.endSession}
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeMenu();
                        setShowAbout(true);
                      }}
                      className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-sage-soft"
                    >
                      <ShieldIcon className="h-3.5 w-3.5 shrink-0 text-sage" />
                      {t.header.about}
                    </button>
                    <LanguageMenuItems onPick={closeMenu} />
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={openPanel}
            aria-label={t.header.askCaddie}
            className="caddie-glow hidden items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-forest-light sm:inline-flex"
          >
            <MicIcon className="h-4 w-4" />
            {t.header.askCaddie}
          </button>
          {/* Phones: Ask My Caddie lives in a bottom bar, reachable with one
              thumb. The body reserves its height (pb-28), so page buttons can
              always scroll clear of it instead of sitting underneath. */}
          <div
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pt-3 sm:hidden"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={openPanel}
              className="caddie-glow flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-forest bg-sage-soft px-5 text-sm font-semibold text-foreground hover:bg-forest"
            >
              <MicIcon className="h-5 w-5" />
              {t.header.askCaddie}
            </button>
          </div>
        </div>
      </header>

      {showAbout && (
        <div
          className="motion-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => setShowAbout(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-heading"
            onClick={(event) => event.stopPropagation()}
            className="motion-modal max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-surface p-6"
          >
            <h2 id="about-heading" className="text-base font-semibold text-foreground">
              {t.about.title}
            </h2>
            <div className="mt-3 space-y-3 text-sm text-foreground">
              <p>{t.about.whatIs}</p>
              <p>{t.about.privacy}</p>
              <p className="text-muted">{t.about.aiNote}</p>
              <p className="rounded-xl border border-forest bg-sage-soft px-3 py-2">{t.about.notMedical}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAbout(false)}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      )}

      {confirmAction && (
        <div
          className="motion-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => setConfirmAction(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-confirm-heading"
            onClick={(event) => event.stopPropagation()}
            className="motion-modal w-full max-w-sm rounded-2xl border border-border bg-surface p-6"
          >
            <h2
              id="session-confirm-heading"
              className="text-base font-semibold text-foreground"
            >
              {confirmAction === "restart-round" ? t.header.restartTitle : t.header.startOverTitle}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {confirmAction === "restart-round" ? t.header.restartBody : t.header.startOverBody}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-forest"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
              >
                {confirmAction === "restart-round" ? t.header.restartRound : t.header.startOver}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
