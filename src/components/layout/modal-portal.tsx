"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders popups at the end of <body>, outside the page-transition wrapper
 * (whose animation transform would otherwise trap position:fixed inside it),
 * so the backdrop covers the whole screen — header included.
 * Only ever rendered after a tap, so document always exists.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
