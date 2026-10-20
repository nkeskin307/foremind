export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) return Promise.resolve(voices);

  // Chrome loads voices asynchronously; Safari sometimes never fires the event.
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      clearTimeout(timer);
      resolve(window.speechSynthesis.getVoices());
    };
    const timer = setTimeout(done, 1500);
    window.speechSynthesis.addEventListener("voiceschanged", done);
  });
}

function normalizeLang(lang: string): string {
  return lang.replace("_", "-").toLowerCase();
}

/** Exact locale first, then same base language; prefers on-device voices. */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | null {
  const target = normalizeLang(lang);
  const base = target.split("-")[0];
  const exact = voices.filter((voice) => normalizeLang(voice.lang) === target);
  const candidates =
    exact.length > 0
      ? exact
      : voices.filter((voice) => normalizeLang(voice.lang).split("-")[0] === base);
  return candidates.find((voice) => voice.localService) ?? candidates[0] ?? null;
}

export type SpeakResult = "done" | "cancelled" | "unsupported" | "no-voice" | "error";

/** Reads text aloud with a voice for `lang`. Resolves when finished or stopped. */
export async function speak(text: string, lang: string): Promise<SpeakResult> {
  if (!isSpeechSynthesisSupported() || !text.trim()) return "unsupported";

  const voices = await loadVoices();
  const voice = pickVoice(voices, lang);
  // Without a matching voice the browser would read, say, Turkish with an
  // English voice — show the text instead.
  if (!voice && voices.length > 0) return "no-voice";

  window.speechSynthesis.cancel();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: SpeakResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(safety);
      resolve(result);
    };
    // Some browsers occasionally never fire onend; don't hang Hands-Free.
    const safety = setTimeout(() => finish("done"), 5000 + text.length * 120);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang ?? lang;
    if (voice) utterance.voice = voice;
    utterance.onend = () => finish("done");
    utterance.onerror = (event) =>
      finish(event.error === "interrupted" || event.error === "canceled" ? "cancelled" : "error");
    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}

/**
 * iOS Safari only allows speech that starts from a tap. Speaking a silent
 * utterance inside the Hands-Free tap unlocks later replies.
 */
export function primeSpeechSynthesis(): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Best effort only.
  }
}
