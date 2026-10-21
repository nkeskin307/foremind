"use client";

import { useState } from "react";
import { removeRoundPhoto, useRoundPhotoUrl } from "@/lib/photos/photo-store";
import { useI18n } from "@/lib/i18n/use-i18n";

/**
 * A round's photo (from IndexedDB) as a thumbnail, with an optional
 * two-step "Remove photo". Renders nothing when the round has no photo.
 */
export function RoundPhoto({
  roundId,
  alt,
  imageClassName = "h-24 w-full",
  removable = true,
  className = "",
}: {
  roundId: string;
  alt: string;
  imageClassName?: string;
  removable?: boolean;
  className?: string;
}) {
  const url = useRoundPhotoUrl(roundId);
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);

  if (!url) return null;

  return (
    <div className={className}>
      {/* A local blob: URL from IndexedDB — next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className={`${imageClassName} rounded-xl border border-border object-cover`}
      />
      {removable &&
        (confirming ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-muted">{t.photo.removeConfirm}</span>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                void removeRoundPhoto(roundId);
              }}
              className="inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-2"
            >
              {t.photo.removeYes}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="inline-flex min-h-11 items-center text-muted underline underline-offset-2 hover:text-foreground"
            >
              {t.common.cancel}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex min-h-11 items-center mt-1.5 text-xs text-muted underline underline-offset-2 hover:text-foreground"
          >
            {t.photo.remove}
          </button>
        ))}
    </div>
  );
}
