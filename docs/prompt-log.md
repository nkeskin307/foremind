# Prompt Log

## Prompt 1 — Foundation and Home Experience

**Purpose:** Establish the ForeCalm project foundation — navigation shell,
visual/brand direction, folder structure, and core types — and fully
implement the Home experience as the first real screen of the MVP.

**What was implemented:**

- A golf-inspired visual palette (deep forest green, soft cream, charcoal
  text, one muted sage accent) wired into Tailwind via CSS theme tokens.
- Persistent, responsive navigation: a top header/nav on desktop and a
  bottom tab bar on mobile, covering Home, Round, Coach, and Insights.
- Placeholder `/round`, `/coach`, and `/insights` pages using a shared
  "Coming next" component so navigation can already be exercised
  end-to-end.
- The full Home page: brand + tagline, a greeting, a "How's your head
  today?" mental check-in (four 1–10 sliders for confidence, focus,
  energy, and nerves, plus a free-text note), a temporary — intentionally
  non-AI — routine preview shown after submitting, a "Playing now?"
  section linking to Round and Coach, and a sample "latest insight" card.
- A `MentalCheckIn` type (`confidence`, `focus`, `energy`, `nerves`,
  `note`) as the first shared data model.
- Reusable components (`AppHeader`, `MobileNavigation`, `MentalSlider`,
  `CheckInCard`, `RoutinePreviewCard`, `PlayingNowSection`, `InsightCard`,
  `ComingNext`) under a `components/` structure intended to scale to later
  features.

No authentication, database, external AI calls, or charts were added —
those are intentionally deferred to later prompts.
