"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Keying on pathname forces a fresh mount on every route change, which is
// what replays the CSS entrance animation — the standard App-Router-native
// way to get a page transition without a client-side routing library.
// flex/flex-1/flex-col mirror <body>'s own flex column so this wrapper is
// layout-transparent: pages that rely on flex-1 for full-height centering
// (e.g. the homepage) keep working exactly as if it weren't here.
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="motion-page flex flex-1 flex-col">
      {children}
    </div>
  );
}
