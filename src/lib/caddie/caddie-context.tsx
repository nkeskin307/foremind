"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CaddiePreRoundContext = {
  focus: number | null;
  energy: number | null;
  confidence: number | null;
  note: string;
};

export type CaddieRoundMoment = {
  hole: number;
  /** null when the hole hasn't been scored yet. */
  holeScore: number | null;
  par: number;
  mentalState: string;
};

export type CaddieRoundContext = {
  course: string;
  holes: number;
  currentHole: number;
  currentHolePar: number;
  /** Sum of scored holes only. */
  totalScore: number;
  /** Sum of pars on scored holes only. */
  totalPar: number;
  holesScored: number;
  currentHoleScore: number | null;
  currentHoleMentalState: string | null;
  moments: CaddieRoundMoment[];
};

export type CaddieContextValue = {
  preRound: CaddiePreRoundContext | null;
  round: CaddieRoundContext | null;
};

type CaddieContextApi = {
  context: CaddieContextValue;
  setPreRoundContext: (value: CaddiePreRoundContext | null) => void;
  setRoundContext: (value: CaddieRoundContext | null) => void;
  isPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
};

const CaddieReactContext = createContext<CaddieContextApi | null>(null);

export function CaddieContextProvider({ children }: { children: ReactNode }) {
  const [preRound, setPreRound] = useState<CaddiePreRoundContext | null>(null);
  const [round, setRound] = useState<CaddieRoundContext | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const setPreRoundContext = useCallback(
    (value: CaddiePreRoundContext | null) => setPreRound(value),
    [],
  );
  const setRoundContext = useCallback(
    (value: CaddieRoundContext | null) => setRound(value),
    [],
  );
  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  const value = useMemo<CaddieContextApi>(
    () => ({
      context: { preRound, round },
      setPreRoundContext,
      setRoundContext,
      isPanelOpen,
      openPanel,
      closePanel,
    }),
    [preRound, round, setPreRoundContext, setRoundContext, isPanelOpen, openPanel, closePanel],
  );

  return (
    <CaddieReactContext.Provider value={value}>
      {children}
    </CaddieReactContext.Provider>
  );
}

export function useCaddieContext(): CaddieContextApi {
  const ctx = useContext(CaddieReactContext);
  if (!ctx) {
    throw new Error("useCaddieContext must be used within a CaddieContextProvider");
  }
  return ctx;
}
