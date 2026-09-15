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
import { getActiveRoundSnapshot, clearActiveRound } from "@/lib/play/active-round-storage";
import { clearCheckInDraft } from "@/lib/prepare/check-in-draft-storage";

type ConfirmAction = "restart-round" | "start-over" | null;

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { openPanel } = useCaddieContext();

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
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={toggleMenu}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-forest hover:text-foreground"
              >
                Session
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>

              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={closeMenu} />
                  <div
                    role="menu"
                    className="motion-fade absolute left-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-2xl border border-border bg-surface py-1 shadow-xl shadow-black/30"
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
                        <RotateIcon className="h-3.5 w-3.5 text-sage" />
                        Restart Round
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
                      <RotateIcon className="h-3.5 w-3.5 text-sage" />
                      Start Over
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
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-sage-soft"
                      >
                        <HomeIcon className="h-3.5 w-3.5 text-sage" />
                        End Session
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={openPanel}
            aria-label="Ask My Caddie"
            className="caddie-glow hidden items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-forest-light sm:inline-flex"
          >
            <MicIcon className="h-4 w-4" />
            Ask My Caddie
          </button>
          <button
            type="button"
            onClick={openPanel}
            aria-label="Ask My Caddie"
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
              {confirmAction === "restart-round" ? "Restart this round?" : "Start over?"}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {confirmAction === "restart-round"
                ? "This will discard your current unfinished round and take you back to Play setup. Your completed round history won't be affected."
                : "This will clear your current unfinished session and take you back to the homepage. Your completed round history and Caddie history won't be affected."}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-forest"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-forest-light"
              >
                {confirmAction === "restart-round" ? "Restart Round" : "Start Over"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
