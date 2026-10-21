/**
 * Server-only helpers for the two Gemini routes: per-IP rate limiting (in
 * memory), a request-size cap, and the Gemini call itself (key sent in the
 * x-goog-api-key header, never in the URL, with a timeout).
 * Never import this from client code.
 */

type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "local";
}

/**
 * Sliding-window limit per IP and route. In-memory only: it resets when the
 * server restarts and isn't shared between serverless instances — enough to
 * stop accidental floods and casual abuse for this prototype.
 */
export function checkRateLimit(
  request: Request,
  routeKey: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const key = `${routeKey}:${clientIp(request)}`;
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((time) => now - time < windowMs);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    return { ok: false, retryAfterSeconds: Math.ceil((windowMs - (now - bucket.hits[0])) / 1000) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);

  // Occasionally drop idle buckets so memory can't grow without bound.
  if (now - lastSweep > windowMs) {
    lastSweep = now;
    for (const [bucketKey, value] of buckets) {
      if (value.hits.every((time) => now - time >= windowMs)) buckets.delete(bucketKey);
    }
  }
  return { ok: true };
}

export function rateLimitedResponse(retryAfterSeconds: number, error: string): Response {
  return Response.json(
    { error, code: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

/** Reads a JSON body, refusing anything larger than maxBytes. */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; body: unknown } | { ok: false; status: 400 | 413 }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return { ok: false, status: 413 };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return { ok: false, status: 413 };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400 };
  }
}

export function clipText(value: unknown, maxChars: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxChars) : "";
}

/** Calls Gemini generateContent. The key goes in a header, never the URL. */
export function callGemini(
  model: string,
  apiKey: string,
  body: unknown,
  timeoutMs: number,
): Promise<Response> {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}
