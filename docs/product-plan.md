# ForeCalm — Product Plan

## Problem

Golf performance is heavily shaped by the mental game — confidence, focus,
nerves, and how a player recovers from a bad shot — but nearly every popular
consumer golf app (swing analyzers, GPS/rangefinders, handicap trackers,
scorecards) addresses the physical or logistical side of the game and
ignores the mental one. Golfers, especially those newer to the game or
playing with stronger players, can feel intimidated, compare themselves to
others, and lose confidence after a mistake, with no tool built to help
them manage that experience in the moment.

## Target user

Recreational and intermediate golfers who feel the mental side of the game
affects how they play — including newer golfers who feel intimidated
playing with more experienced groups, and any golfer who wants to build
composure, focus, and recovery skills before, during, and after a round.

## Value proposition

ForeCalm is an AI-powered mental-game companion that helps golfers check in
with how they're feeling, prepare mentally before a round, reset after a
bad shot, and reflect afterward — turning the invisible mental side of golf
into something a player can actively train, the same way they train their
swing.

## MVP user journey

**CHECK IN → PREPARE → PLAY/RESET → COACH → REFLECT → LEARN**

1. **Check in** — Before a round, the golfer rates their confidence, focus,
   energy, and nerves, and notes what's on their mind.
2. **Prepare** — An AI-generated pre-round routine is built from that
   check-in to mentally prepare the golfer.
3. **Play / Reset** — During the round, the golfer can quickly reset after a
   bad shot or check in mid-round.
4. **Coach** — A voice AI mental coach is available to talk through nerves,
   frustration, or pressure in real time.
5. **Reflect** — After the round, the golfer reflects on how their mental
   state affected their play.
6. **Learn** — Over time, ForeCalm surfaces insights connecting mindset to
   performance.

## Planned five core features

1. **AI Pre-Round Routine** — Generates a personalized mental warm-up from
   the golfer's check-in and history.
2. **Round + Reset Mode** (implemented) — In-round score entry and a quick
   "reset" flow for recovering after a bad shot, so ForeCalm can later
   compare mental state against golf performance.
3. **Voice AI Mental Coach** — A conversational voice coach for pressure,
   nerves, and frustration in the moment.
4. **Post-Round Reflection** — A short reflection flow capturing how the
   mental game affected the round.
5. **Mental Game Insights** — Trends connecting pre-round mindset and
   in-round recovery to actual performance.

## Current status

The project foundation (navigation, visual direction, folder structure,
core types) and the Home experience are implemented. Round + Reset Mode is
now also implemented: round setup, hole-by-hole score entry, mental
resets with preset interventions, and local persistence of active and
completed rounds. See `docs/prompt-log.md` for what was built and why.
