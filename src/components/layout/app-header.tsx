"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeftIcon } from "@/components/icons/arrow-left-icon";
import { ChevronDownIcon } from "@/components/icons/chevron-down-icon";
import { MicIcon } from "@/components/icons/mic-icon";
import { RotateIcon } from "@/components/icons/rotate-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { useCaddieContext } from "@/lib/caddie/caddie-context";
import { useI18n } from "@/lib/i18n/use-i18n";
import { LanguageMenuItems } from "@/components/i18n/language-switcher";
import {
  getActiveRoundSnapshot,
  clearActiveRound,
  loadActiveRound,
} from "@/lib/play/active-round-storage";
import { clearCheckInDraft } from "@/lib/prepare/check-in-draft-storage";
import { checkInToQueryString } from "@/lib/prepare/check-in-params";
import {
  clearLatestCheckIn,
  loadLatestCheckIn,
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
      // Carry the latest check-in into the restarted round (falling back to
      // the round's own check-in for rounds started before it was stored).
      const checkIn = loadLatestCheckIn() ?? loadActiveRound()?.preRound ?? null;
      const query = checkIn ? checkInToQueryString(checkIn) : "";
      clearActiveRound();
      // A full navigation, not router.push: Restart Round can be triggered
      // while already on /play, where a client-side push to the same route
      // wouldn't remount the page — leaving the in-memory round mounted, its
      // autosave effect would then immediately re-write the just-cleared
      // round straight back into localStorage.
      window.location.href = query ? `/play?${query}` : "/play";
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
              className="flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
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
                className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-forest hover:text-foreground"
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
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-sage-soft"
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
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-sage-soft"
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
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-sage-soft"
                      >
                        <HomeIcon className="h-3.5 w-3.5 shrink-0 text-sage" />
                        {t.header.endSession}
                      </Link>
                    )}
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
          <button
            type="button"
            onClick={openPanel}
            aria-label={t.header.askCaddie}
            className="caddie-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-foreground hover:bg-forest-light sm:hidden"
          >
            <MicIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

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
