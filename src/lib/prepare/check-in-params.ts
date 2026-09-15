export type RawSearchParams = { [key: string]: string | string[] | undefined };

export type CheckInQueryData = {
  focus: number | null;
  energy: number | null;
  confidence: number | null;
  note: string;
};

function toSingleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseRating(value: string | string[] | undefined): number | null {
  const raw = toSingleValue(value);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

export function parseCheckInParams(params: RawSearchParams): CheckInQueryData {
  return {
    focus: parseRating(params.focus),
    energy: parseRating(params.energy),
    confidence: parseRating(params.confidence),
    note: toSingleValue(params.note) ?? "",
  };
}

export function checkInToQueryString(checkIn: CheckInQueryData): string {
  const params = new URLSearchParams();
  if (checkIn.focus !== null) params.set("focus", String(checkIn.focus));
  if (checkIn.energy !== null) params.set("energy", String(checkIn.energy));
  if (checkIn.confidence !== null) params.set("confidence", String(checkIn.confidence));
  if (checkIn.note) params.set("note", checkIn.note);
  return params.toString();
}
