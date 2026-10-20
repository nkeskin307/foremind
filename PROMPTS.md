# Fore!Mind — Build Prompts

The prompts used to build Fore!Mind with Claude, in order, copied word for word.

---

## Setup

```text
Use this cloned foremind folder from now on, not foremind-main. Run npm install, then create an empty PROMPTS.md in the project root.
```

---

## Stage 0 — Inspect (no code changes)

```text
Read this whole project before changing anything. Give me a short summary of: the framework and folder structure, every page/route, the localStorage keys and the exact shape of each stored object, how /api/caddie builds its prompt and context and which model it calls, how voice input works, and how a round moves from active to completed (including reflection). Then list any bugs or fragile spots you see. Do not change any code in this step.
```

---

## Stage 1 — Fix scoring and add par

```text
Fix these reliability bugs from your review. Keep changes minimal, reuse existing components and styles, and don't add a backend.
1. Scoring: each hole gets a par (default 4, quick 3/4/5 picker) and a score that starts empty (null). Totals, vs-par, the Caddie context and the post-round analysis only count scored holes. Show which holes are complete, and warn before Finish Round if any holes are unscored. Migrate existing saved rounds safely (missing par = 4, keep old scores).
2. Make Finish Round safe to tap twice: no duplicate completed rounds (check the id and disable the button while saving).
3. Clear foremind:prepare-draft after the check-in is submitted. If an unfinished active round exists when a new check-in arrives, ask "Resume your unfinished round or start a new one?" A new round must use the latest check-in, including after Restart Round.
4. Fix the hydration mismatch in PreRoundCheckIn and ReflectionForm by reading localStorage after the component mounts.
5. Fix Golfer Memory so repeated mental states are counted per round, not per hole, and the prompt can never state impossible numbers like "7 of the last 3 rounds".
Then run npm run lint and npm run build and fix any errors. Summarize the files you changed and give me a step-by-step manual test.
```

### Stage 1 follow-up

```text
Did you also handle these two? If not, do them now, keep changes minimal, then rerun lint and build: 6. parseRoundData and the analysis parser keep unscored holes (null) in place so hole numbers never shift. 7. A mental state is saved as soon as it's tapped, so closing the picker by tapping outside doesn't lose it.
```

---

## Stage 2 — Course-specific memory and comparison

```text
Stage 2: Add Course-Specific Memory & Comparison using localStorage only (no backend). Keep changes minimal and reuse existing components and styles.
1. Normalize course names (trim, case-insensitive match) and show a suggestion list of previously played courses on the round setup screen.
2. When the golfer picks a course they've played before, show a small "Last time at [course]" card on the setup screen: date, score vs par (scored holes only), most common mental state, and their saved "what to remember" from that round's reflection.
3. In My Mental Game, add a "By Course" section: for each course show rounds played, average score vs par (scored holes only), and most common mental states. For a course with 2 or more rounds, show a side-by-side comparison of the last two rounds: score vs par, front 9 vs back 9 for 18-hole rounds, top mental states, and each round's reflection takeaway.
4. Pass a short summary of this course's past rounds into the /api/caddie context, so the Caddie can say things like "Last time at this course you...". Count per round, not per hole. If there's no history at this course, say so instead of inventing it.
Run npm run lint and npm run build. Summarize the files you changed and give me a step-by-step manual test, including how to test with two rounds at the same course.
```

---

## Stage 3 — Hands-Free Caddie and multilingual voice

```text
Stage 3: Add a Hands-Free Caddie Mode and multilingual voice. Keep changes minimal, reuse existing components and styles, no new paid services.
1. Language: add a small language setting in the Ask My Caddie panel, saved in localStorage. Default to the device language (navigator.language). Offer a list of common languages (English, Türkçe, Español, Français, Deutsch, Italiano, Português, 中文, 日本語, 한국어, العربية). Use it for speech recognition, for reading replies aloud, and tell /api/caddie to reply in that language. If the golfer types in a different language than the setting, the Caddie should reply in the language they used. The app's screens stay in English.
2. Hands-Free Mode: one large "Hands-Free" button in the Caddie panel. Flow: listen, send when the golfer stops talking, read the reply aloud with speechSynthesis using a voice for the chosen language, then listen once more for a follow-up, then stop. Show a big Stop button and clear status text (Listening / Thinking / Speaking). Keep spoken replies under 60 words.
3. Fix the voice bugs from the Stage 0 review: only one microphone can be active at a time, catch start() errors such as InvalidStateError, set isListening only after recognition actually starts, and show a friendly message if the microphone is denied or speech recognition/synthesis isn't supported (fall back to the text box). Closing the Caddie panel stops listening and speaking, and late results must not refill the input.
Run npm run lint and npm run build. Summarize the files you changed and give me a manual test for Chrome on Mac and Safari on iPhone, including a test in Turkish.
```

---

## Stage 4 — Proactive Caddie during Play Mode

```text
Stage 4: Add a Proactive Caddie during Play Mode. Keep changes minimal, reuse existing components and styles, no backend.
1. Triggers (simple rules in the browser, not AI). Check after each hole is scored or a mental state is logged:
   a. a negative state (Frustrated, Rushed, Overthinking) logged on two holes in a row;
   b. a scored hole at par +2 or worse;
   c. hole 1 at double bogey or worse;
   d. pre-round confidence was 1 or 2 and the first scored hole is over par.
   Use only scored holes. If completed rounds show that the hole after a blow-up (par +2 or worse) is usually over par too, include that pattern in the message context.
2. Reset card: when a trigger fires, show a small, dismissible card on the round screen with a short reset message (under 40 words) from /api/caddie, in the golfer's chosen language, that names the trigger reason and the hole. If the API fails or takes longer than 8 seconds, show a short static fallback message instead. Buttons: "Got it" (dismiss) and "Talk to Caddie" (opens the Caddie panel).
3. Cooldown: no more than one card every 3 holes, never on the same hole twice.
4. Save each intervention on the active round and the completed round: hole, trigger type, message, whether it was opened, dismissed or ignored, and the next scored hole's result vs par. Migrate old rounds safely (no interventions = empty list).
5. My Mental Game: add a "Recovery after reset" card: the average next-hole result vs par after a Proactive Caddie card, compared with after bad holes (par +2 or worse) with no card. Show how many cases each number is based on, and say "Not enough data yet" if either side has fewer than 3 cases.
6. Pass the round's interventions to /api/post-round-analysis so the analysis can mention them.
Run npm run lint and npm run build. Summarize the files you changed and give me a step-by-step manual test that triggers each rule.
```

### Stage 4 follow-up — clearer reset card

```text
Make the Proactive Caddie card clearer. Keep changes minimal and reuse the existing card styles.
1. Title: "Pause & reset" (with a small caddie or flag icon).
2. Under the title, one plain sentence starting with "Your caddie noticed" that explains why it appeared, built from the trigger: e.g. "Your caddie noticed a rough one on hole 4 (+2)." / "Your caddie noticed you logged Rushed then Frustrated on holes 6–7." / "Your caddie noticed hole 1 was a double bogey." / "Your caddie noticed you started with low confidence and hole 1 went over par."
3. Below that, the AI reset message (or the fallback).
4. Buttons: "I'm reset" (dismiss) and "Talk to Caddie".
5. When the voice language is Türkçe, show the title, the "why" sentence and the button labels in Turkish ("Dur ve sıfırla", "Caddie'n fark etti: …", "Hazırım", "Caddie ile konuş"); use English otherwise. Make the fallback messages follow the same rule.
6. A small "Stop interruptions for this round" text link at the bottom that turns the Proactive Caddie off until the round ends (save that choice on the active round).
Rerun lint and build and tell me how to see each version of the "why" sentence.
```

---

## Stage 5 — Full app language mode

```text
Stage 5: Add a full app language mode. Keep it simple: no new paid services, no backend.
1. Supported languages: English, Türkçe, Français, Español, Deutsch, Italiano, 中文 (Simplified Chinese). One app-wide setting saved in localStorage, defaulting to the device language if it's one of these, otherwise English.
2. Replace the separate Caddie voice-language setting with this one setting. Speech recognition, read-aloud voices, the Caddie, the reset cards, the pre-game routine, the post-round analysis and all fallback messages use it. The Caddie should still reply in the language the golfer typed in if that's clearly different.
3. Move every user-facing string in every page and component (landing, check-in, routine, play, mental states, reset card, reflection, My Mental Game, Caddie panel, header menu, errors and empty states) into one translation dictionary per language. Use a small React context or hook; a library is fine only if it's tiny. Keep golf terms the way golfers say them (par, bogey, birdie, double bogey). Format dates and numbers for the chosen language.
4. Add a language switcher on the landing page and in the header menu, showing each language in its own name.
5. Mental states are stored as stable English keys in localStorage and only translated for display, so old rounds, patterns and Golfer Memory keep working when the language changes.
6. Check that the layout still fits on a 375px phone screen in every language (German and French are longer).
Run npm run lint and npm run build. Summarize the files you changed, list anything you couldn't translate, and give me a manual test that switches through all 7 languages mid-round.
```

---

## Stage 6 — Photo Memories

```text
Stage 6: Add Photo Memories. Keep changes minimal, reuse existing components and styles, no backend.
1. In Post-Round Reflection, let the golfer add one optional photo (camera or photo library).
2. Resize it in the browser to max 800px wide as a JPEG around 0.7 quality, and store it in IndexedDB (a tiny helper like idb-keyval is fine) keyed by round id, not in localStorage.
3. Show the photo as a thumbnail on round cards in My Mental Game, in the By Course comparison, and on the "Last time at [course]" card, with an option to remove it.
4. If saving fails (storage full or private browsing), show a friendly message and still save the round without the photo.
5. All new text must use the existing translation dictionaries in all 7 languages.
Run npm run lint and npm run build. Summarize the files you changed and give me a manual test for Chrome on Mac and Safari on iPhone.
```
