/**
 * A submitted pre-round check-in. It travels between /prepare, /routine
 * and /play through localStorage (latest-check-in-storage), never the URL,
 * so the golfer's note doesn't end up in links, history or server logs.
 */
export type CheckInQueryData = {
  focus: number | null;
  energy: number | null;
  confidence: number | null;
  note: string;
};

export const EMPTY_CHECK_IN: CheckInQueryData = {
  focus: null,
  energy: null,
  confidence: null,
  note: "",
};
