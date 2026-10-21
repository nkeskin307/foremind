# Fore!Mind

**Your personal mental caddie.** Fore!Mind helps recreational golfers manage the mental side of the game — before, during and after a round. It learns what gets in your head and helps you reset.

**Live app:** https://foremind-three.vercel.app

## Features

- **Pre-round check-in** — rate focus, energy and confidence, add a note (typed or spoken), and get a short pre-game routine.
- **Play mode** — 9 or 18 holes, par per hole, scores that start empty, and quick mood logging ("How am I feeling?").
- **Mental Caddie** — ask by text or voice, or use **Hands-Free** mode; it knows your current round, your past rounds and your history at this course.
- **Proactive Caddie** — simple in-app rules spot rough moments (a blow-up hole, a rough start, two tough moods in a row) and offer a short **Pause & reset** card.
- **Reflection + Round Recap** — three quick questions, an optional photo, and an AI recap: headline, at-a-glance stats, turning point, what worked and one thing to try next round.
- **My Mental Game** — at-a-glance insights, patterns, recovery after resets, recent rounds and a by-course comparison. Includes optional sample data to explore.
- **7 languages** — English, Türkçe, Français, Español, Deutsch, Italiano, 中文 (screens, voice and AI replies).

## Privacy

Rounds, reflections and photos are stored only in your browser on this device (localStorage and IndexedDB). There are no accounts and no database. When you ask the Caddie or save a reflection, that text and round data are sent to the app's server and Google Gemini to write the reply. Fore!Mind is performance coaching for golf, not medical or mental-health treatment.

## Run it locally

Requirements: Node.js 20+ and a [Google Gemini API key](https://aistudio.google.com/apikey).

```bash
git clone https://github.com/nkeskin307/foremind.git
cd foremind
npm install
```

Create `.env.local` in the project root (it is git-ignored and only read on the server):

```bash
GEMINI_API_KEY=your-key-here
```

Then:

```bash
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

Without a key the app still works: the Caddie shows a friendly "couldn't respond" message, and the Round Recap and reset cards use built-in, non-AI text.

## Tech

Next.js (App Router), React, TypeScript, Tailwind CSS, the browser's Web Speech API for voice, and Google Gemini (`gemini-3.1-flash-lite`) through two server routes: `/api/caddie` and `/api/post-round-analysis`.

## Project docs

- [`docs/product-plan.md`](docs/product-plan.md) — product plan
- [`docs/prompt-log.md`](docs/prompt-log.md) — Sprint 1 prompt log (when the app was called ForeCalm)
- [`PROMPTS.md`](PROMPTS.md) — Sprint 2 build prompts
