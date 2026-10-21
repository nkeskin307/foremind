/**
 * English UI text — the source dictionary. Every other language must match
 * this shape exactly (TypeScript enforces it via `Messages`).
 * Golf terms (par, bogey, birdie, double bogey) stay as golfers say them.
 */
export const en = {
  common: {
    back: "Back",
    cancel: "Cancel",
    close: "Close",
    unknownDate: "Unknown date",
    language: "Language",
    hole: (n: number) => `Hole ${n}`,
    holesCount: (n: number) => `${n} Holes`,
    stop: "Stop",
  },
  mentalStates: {
    Confident: "Confident",
    Focused: "Focused",
    Calm: "Calm",
    Frustrated: "Frustrated",
    Rushed: "Rushed",
    Overthinking: "Overthinking",
  } as Record<string, string>,
  landing: {
    title: "Golf is a mental game.",
    subtitle:
      "Your personal mental caddie that learns what gets in your head and helps you manage it.",
    cta: "Get Started",
  },
  header: {
    session: "Session",
    restartRound: "Restart Round",
    startOver: "Start Over",
    endSession: "End Session",
    askCaddie: "Ask My Caddie",
    restartTitle: "Restart this round?",
    restartBody:
      "This will discard your current unfinished round and take you back to Play setup. Your completed round history won't be affected.",
    startOverTitle: "Start over?",
    startOverBody:
      "This will clear your current unfinished session and take you back to the homepage. Your completed round history and Caddie history won't be affected.",
  },
  voice: {
    listening: "Listening… tap the mic to stop.",
    unsupported: "Voice input isn't supported in this browser — you can type instead.",
    stopListening: "Stop listening",
    speakAnswer: "Speak your answer",
    errors: {
      "not-allowed":
        "Microphone access is blocked. Allow the microphone for this site in your browser settings, or type instead.",
      "audio-capture": "No microphone was found. You can type instead.",
      network: "Voice input needs an internet connection. You can type instead.",
      "no-speech": "I didn't hear anything. Tap the mic and try again.",
      "language-not-supported":
        "Voice input isn't available for this language in this browser. You can type instead.",
      "start-failed": "Couldn't start the microphone. Tap the mic to try again, or type instead.",
      unsupported: "Voice input isn't supported in this browser — you can type instead.",
      other: "Voice input stopped unexpectedly. You can type instead.",
    } as Record<string, string>,
  },
  checkIn: {
    title: "Before you tee off",
    subtitle: "Take a minute to check in with yourself.",
    focus: "Focus",
    energy: "Energy",
    confidence: "Confidence",
    noteLabel: "What's on your mind before today's round?",
    notePlaceholder:
      "I want to stay present, trust my game, and not let one bad shot affect the next…",
    speakThoughts: "Speak your thoughts",
    submit: "Build My Pre-Game Routine",
  },
  routine: {
    title: "Your Pre-Game Routine",
    subtitle: "Built from how you're feeling today.",
    focusToday: "1. Your Focus Today",
    beforeFirstTee: "2. Before the First Tee",
    physicalReset: "3. Physical Reset",
    ifWrong: "4. If Something Goes Wrong",
    start: "Start My Round →",
    resetReminder:
      "Leave the last shot behind. Reset your body, pick your next target, and commit.",
    low: {
      focus: {
        mindset:
          "Stay present and play one shot at a time — the rest of the course doesn't exist until you get there.",
        teePrep: "Pick one simple pre-shot cue and repeat it before every swing today.",
        physicalReset:
          "Loosen your grip and shake out your hands for 10 seconds to release tension.",
      },
      confidence: {
        mindset:
          "Trust your own game today instead of comparing yourself to anyone else in the group.",
        teePrep: "Choose one intention for the round and commit to it before your first tee shot.",
        physicalReset: "Slowly roll your shoulders back 5 times to settle in before you swing.",
      },
      energy: {
        mindset:
          "Keep the round simple today — don't make it more mentally exhausting than it needs to be.",
        teePrep:
          "Decide now what phrase you'll return to if you start feeling worn down, so you're not thinking about it mid-round.",
        physicalReset: "Take one long exhale while relaxing your shoulders and hands.",
      },
    },
    strong: {
      mindset: "You're in a good headspace — protect it and keep doing whatever got you here.",
      teePrep: "Choose one small process goal to stay locked in through all 18 holes.",
      physicalReset: "Stretch your neck gently side to side to stay loose and ready.",
    },
    neutral: {
      mindset: "You're feeling steady today. Focus on your process, not the outcome.",
      teePrep:
        "Decide what phrase or thought you'll return to if you start rushing or getting frustrated.",
      physicalReset:
        "Loosen your grip and shake out your hands for 10 seconds before you tee off.",
    },
    noRatings: {
      mindset: "Set one intention for today's round before you swing.",
      teePrep: "Choose one simple pre-shot cue you can return to all day.",
      physicalReset:
        "Slowly roll your shoulders back a few times to settle in before your first shot.",
    },
    /** Note keywords (lowercase stems) that point at a weak area. */
    keywords: {
      focus: ["distract", "focus", "present", "rush"],
      confidence: ["nervous", "confiden", "doubt", "compar"],
      energy: ["tired", "energy", "exhaust", "drain"],
    },
  },
  setup: {
    title: "Let's play.",
    subtitle: "Set up your round and stay focused on the game in front of you.",
    course: "Course",
    coursePlaceholder: "Enter course name",
    coursesPlayed: "Courses you've played",
    holes: "Holes",
    begin: "Begin Round →",
    unfinishedTitle: "Unfinished round",
    unfinishedBody: (course: string, hole: number, holes: number) =>
      `You have an unfinished round at ${course} (hole ${hole} of ${holes}). Resume your unfinished round or start a new one?`,
    yourCourse: "your course",
    unfinishedNote: "Starting a new round discards the unfinished one and uses today's check-in.",
    resume: "Resume Round",
    startNew: "Start New Round",
    lastTimeAt: (course: string) => `Last time at ${course}`,
    roundsHere: (n: number) => `${n} rounds here`,
    holesScoredOf: (scored: number, holes: number) => `${scored} of ${holes} holes scored`,
    noHolesScored: "No holes were scored.",
    mostCommonState: (state: string, n: number) =>
      `Most common mental state: ${state} (${n} hole${n === 1 ? "" : "s"})`,
    noStates: "No mental states logged.",
    rememberLabel: "You wanted to remember:",
    noReflection: "No reflection was saved for that round.",
  },
  play: {
    holeOf: (hole: number, total: number) => `Hole ${hole} of ${total}`,
    total: "Total",
    scoredOf: (scored: number, total: number) => `${scored} of ${total} scored`,
    goToHole: (hole: number, score: number | null) =>
      `Go to hole ${hole}, ${score === null ? "not scored yet" : `scored ${score}`}`,
    shadedHint: "Shaded holes have a score.",
    par: "Par",
    score: "Score",
    decrease: "Decrease score",
    increase: "Increase score",
    notScoredHint: "Not scored yet — tap + or − to start at par.",
    onThisHole: (toPar: string) => `${toPar} on this hole`,
    clear: "Clear",
    howFeeling: "How am I feeling?",
    mentalNote: (state: string) => `Mental note: ${state}`,
    previous: "Previous",
    nextHole: "Next Hole →",
    finish: "Finish Round →",
    saving: "Saving…",
    unscoredTitle: (n: number) => (n === 1 ? "1 hole has no score" : `${n} holes have no score`),
    unscoredBody: (holes: string, n: number) =>
      `${n === 1 ? "Hole" : "Holes"} ${holes} ${n === 1 ? "isn't" : "aren't"} scored. Unscored holes won't count toward your total or analysis.`,
    keepScoring: "Keep Scoring",
    finishAnyway: "Finish Anyway",
    mentalCheckTitle: "What's affecting you right now?",
    backToRound: "Back to My Round",
    resetMessages: {
      Confident: "Trust what's working. Stay committed to your routine and don't force anything.",
      Focused: "Stay with the process. Keep your attention on the shot in front of you.",
      Calm: "Keep this tempo. Let the round come to you.",
      Frustrated: "Leave the last shot where it happened. Your only job now is the next target.",
      Rushed:
        "Slow your routine down. Your group's pace does not have to become your swing tempo.",
      Overthinking: "Stop adding swing thoughts. Pick one target, trust your game, and commit.",
    } as Record<string, string>,
  },
  resetCard: {
    title: "Pause & reset",
    loading: "Your caddie has a quick reset…",
    reset: "I'm reset",
    talk: "Talk to Caddie",
    stop: "Stop interruptions for this round",
    doubleBogey: "a double bogey",
    tripleBogey: "a triple bogey",
    whyBlowUp: (hole: number, toPar: string) =>
      `Your caddie noticed a rough one on hole ${hole}${toPar ? ` (${toPar})` : ""}.`,
    whyRoughStart: (result: string | null) =>
      result
        ? `Your caddie noticed hole 1 was ${result}.`
        : "Your caddie noticed a rough start on hole 1.",
    whyLowConfidence: (hole: number) =>
      `Your caddie noticed you started with low confidence and hole ${hole} went over par.`,
    whyStreakTwo: (first: number, second: number, a: string, b: string) =>
      `Your caddie noticed you logged ${a} then ${b} on holes ${first}–${second}.`,
    whyStreakSame: (first: number, second: number, state: string) =>
      `Your caddie noticed you logged ${state} on holes ${first}–${second}.`,
    whyStreakUnknown: (first: number, second: number) =>
      `Your caddie noticed a tough stretch on holes ${first}–${second}.`,
    fallbacks: {
      "negative-streak":
        "Pause, take one slow breath, and pick a small target before your next shot.",
      "rough-start":
        "One hole doesn't define the round. Slow your routine down and play only the next shot.",
      "low-confidence-start":
        "That's normal on a shaky day. Trust your routine: one target, one committed swing.",
      "blow-up": "It's done. Take one long exhale, then commit fully to your next tee shot.",
    },
  },
  reflection: {
    title: "Reflect on your round",
    subtitle: "Take a minute to understand what helped — and what got in your way.",
    whatWorked: "What worked well mentally today?",
    whatGotInHead: "What got in your head?",
    whatToRemember: "What do you want to remember next round?",
    notFoundTitle: "We couldn't find that round",
    notFoundBody: "It may have been removed, or the link is out of date.",
    goToMentalGame: "Go to My Mental Game →",
    save: "Save Reflection",
    complete: "Round complete.",
    viewMentalGame: "View My Mental Game →",
  },
  analysis: {
    whatHelped: "What Helped",
    whatGotInYourWay: "What Got In Your Way",
    patternToWatch: "Pattern To Watch",
    takeIntoNextRound: "Take Into Your Next Round",
    // Server-side fallback when the AI is unavailable.
    fallbackNoWins: "No specific mental wins were noted for this round.",
    fallbackStatesShowedUp: (states: string) => `${states} showed up during the round.`,
    fallbackNothingInWay: "Nothing specific was noted as getting in the way this round.",
    fallbackNoPattern: "Not enough data from this round to identify a repeating pattern.",
    fallbackStateOnHoles: (state: string, holes: string) => `${state} appeared on holes ${holes}.`,
    fallbackIntention: "Set one clear intention to carry into your next round.",
    /** Phrases meaning "not enough data", so they aren't shown as takeaways. */
    noDataPhrases: ["not enough data", "insufficient data", "no repeating pattern", "no clear pattern"],
  },
  dashboard: {
    title: "My Mental Game",
    subtitle: "See what's happening beyond the score.",
    emptyStart: "Your mental game starts with your first round.",
    startRound: "Start a Round →",
    reviewTitle: "AI Caddie Review",
    reviewSubtitle: "What Fore!Mind is learning about your mental game.",
    currentFocus: "Current Mental Focus",
    currentFocusEmpty: "Play a few more rounds so Fore!Mind can find a focus area for you.",
    focusHeadlines: {
      Frustrated: "Reset faster after mistakes.",
      Rushed: "Slow your pace between shots.",
      Overthinking: "Simplify your pre-shot routine.",
    } as Record<string, string>,
    focusHeadlineDefault: (state: string) => `Notice ${state.toLowerCase()} early.`,
    focusDetail: (state: string, rounds: string) =>
      `${state} has appeared in ${rounds}, so your next focus is creating a clean break before the next shot.`,
    roundCountLabel: (count: number, total: number) =>
      `${count} of your last ${total} round${total === 1 ? "" : "s"}`,
    watchTheme: "Watch this recurring theme.",
    carryThis: "Carry this into your next round.",
    patterns: "Patterns Fore!Mind Is Seeing",
    stateAppeared: (state: string, rounds: string) => `${state} appeared in ${rounds}.`,
    difficultState: (state: string, rounds: string) =>
      `Most common difficult state: ${state} — ${rounds}.`,
    noPatterns: "Not enough repeated mental states yet to show a pattern.",
    whatsHelping: "What's Helping",
    recurring: "Recurring",
    recentWin: "Recent win",
    whatsHelpingEmpty: "Fore!Mind needs a couple more analyzed rounds to spot what's helping.",
    whatToWatch: "What To Watch",
    recentTakeaway: "Recent takeaway",
    whatToWatchEmpty: "Fore!Mind needs a couple more analyzed rounds to start noticing patterns.",
    caddieLog: "Caddie Log",
    caddieLogEmpty: "Your conversations with Fore!Mind will show up here.",
    viewAll: "View all conversations →",
    baseline: "Mental Baseline",
    notEnoughData: "Not enough data yet",
    roundsPlayed: "Rounds Played",
    recentRounds: "Recent Rounds",
    unnamedCourse: "Unnamed Course",
    partialHoles: (scored: number, holes: number) => `${scored}/${holes} holes`,
    analysisPreparing: "Analysis preparing…",
    noReflectionYet: "No reflection saved for this round yet.",
    byCourse: "By Course",
    roundsPlayedCount: (n: number) => `${n} round${n === 1 ? "" : "s"} played`,
    avgVsPar: "avg vs par",
    mentalStatesLine: (list: string) => `Mental states: ${list}`,
    stateRounds: (state: string, count: number, total: number) =>
      `${state} (${count} of ${total} rounds)`,
    noStatesHere: "No mental states logged here yet.",
    latest: "Latest",
    previous: "Previous",
    scoreVsPar: "Score vs par",
    front9: "Front 9",
    back9: "Back 9",
    nineHoleRound: "9-hole round",
    notScored: "Not scored",
    topStates: "Top mental states (holes)",
    noneLogged: "None logged",
    takeaway: "Takeaway",
    noReflectionSaved: "No reflection saved",
    reflectNow: "Reflect now",
    retryAnalysis: "Retry analysis",
    analysisFailed: "The analysis didn't finish.",
    recoveryTitle: "Recovery after reset",
    recoverySubtitle: "Average next-hole result vs par.",
    afterCard: "After a Caddie reset card",
    afterBadHole: "After a bad hole (par +2 or worse), no card",
    cases: (n: number) => `${n} case${n === 1 ? "" : "s"}`,
    recoveryNotEnough: (min: number) =>
      `Not enough data yet — each side needs at least ${min} cases to compare.`,
  },
  photo: {
    addPhoto: "Add a photo (optional)",
    changePhoto: "Change photo",
    hint: "One photo to remember this round. It stays on this device.",
    processing: "Preparing photo…",
    readError: "Couldn't read that photo. Try another one — JPEG or PNG works best.",
    saveFailed:
      "Your round was saved, but the photo couldn't be stored on this device (storage may be full, or private browsing is on).",
    remove: "Remove photo",
    removeConfirm: "Remove this photo?",
    removeYes: "Remove",
    label: "Photo",
    alt: (course: string) => `Photo from your round at ${course}`,
  },
  glance: {
    title: "At a glance",
    avgVsPar: "Avg vs par",
    avgVsParNote: "per round · scored holes only",
    commonStates: "Most common mental states",
    byState: "Score vs par by mental state",
    byStateNote: "Average result on scored holes where you logged it",
    firstHole: "First hole vs the rest",
    firstHoleOver: "Hole 1 over par",
    firstHoleGood: "Hole 1 par or better",
    restPerHole: "rest of round, avg per hole",
    notYet: "Not yet",
    unlockAvg: "Score at least one hole in a round to see your average vs par.",
    unlockStates: "Log how you feel during a round to see which states come up most.",
    holes: (n: number) => `${n} hole${n === 1 ? "" : "s"}`,
    rounds: (n: number) => `${n} round${n === 1 ? "" : "s"}`,
    unlockRounds: (n: number) => `Play ${n} more round${n === 1 ? "" : "s"} to see patterns.`,
    unlockByState: (min: number) =>
      `Log a mental state on at least ${min} scored holes to compare scores by state.`,
    unlockFirstHole: (n: number) =>
      `Play ${n} more round${n === 1 ? "" : "s"} with hole 1 scored to see how your start shapes the rest.`,
  },
  sample: {
    badge: "SAMPLE",
    load: "Load sample rounds",
    loadHint: "See how Fore!Mind looks with 6 example rounds. You can clear them anytime.",
    clear: "Clear sample data",
    banner: "Includes sample rounds — example data, not yours. Sample rounds are never sent to the Caddie.",
    reflections: [
      { whatWorked: "Slowing my pre-shot routine kept me calm.", whatGotInHead: "Rushing after the bogey on the front nine.", whatToRemember: "Take one slow breath before every tee shot." },
      { whatWorked: "Picking small targets on approach shots.", whatGotInHead: "Comparing my score with my playing partner.", whatToRemember: "Play my own game, one shot at a time." },
      { whatWorked: "Laughing off a bad drive instead of stewing on it.", whatGotInHead: "Overthinking my putting stroke.", whatToRemember: "Trust the line and commit to the putt." },
    ],
  },
  recap: {
    title: "Round Recap",
    turningPoint: "Turning point",
    whatWorked: "What worked",
    tryThis: "Try this next round",
    patternWatch: "Pattern watch",
    bestStretch: "Best stretch",
    toughestHole: "Toughest hole",
    moodsLogged: "Moods logged",
    resetCards: "Pause & reset cards",
    rangeValue: (first: number, last: number, result: string) => `Holes ${first}–${last} (${result})`,
    holeValue: (hole: number, result: string) => `Hole ${hole} (${result})`,
    headlineBounce: (from: number, hole: number) =>
      `Hole ${from} got away from you, then you steadied from hole ${hole}.`,
    headlineSlide: (hole: number) => `A solid start that slipped from hole ${hole}.`,
    headlineSteady: (result: string) => `A steady round at ${result} with no big swings.`,
    headlineSteadyMood: (result: string, mood: string) =>
      `A round at ${result} where ${mood} came up most.`,
    headlineNoScores: "No holes were scored, so this recap is based on your moods and reflection.",
    tpBounce: (hole: number, from: number, fromResult: string) =>
      `After ${fromResult} on hole ${from}, you bounced back on hole ${hole}.`,
    tpBounceReset: (hole: number, from: number, fromResult: string) =>
      `After ${fromResult} on hole ${from} and a Pause & reset card, you bounced back on hole ${hole}.`,
    tpBounceMood: (hole: number, from: number, fromResult: string, mood: string) =>
      `After ${fromResult} on hole ${from}, you logged ${mood} and bounced back on hole ${hole}.`,
    tpSlide: (hole: number, result: string) =>
      `From hole ${hole} the scores slipped (${result} per hole on the next holes).`,
    tpSlideMood: (hole: number, result: string, mood: string) =>
      `From hole ${hole}, with ${mood} logged, the scores slipped (${result} per hole).`,
    workedStretch: (first: number, last: number, result: string) =>
      `Holes ${first}–${last} were your best stretch (${result}).`,
    workedOwnWords: (words: string) => `In your words: “${words}”`,
    tryMood: (hole: number, mood: string) =>
      `When ${mood} shows up like it did on hole ${hole}, take one slow breath and pick a small target before you swing.`,
    tryRemember: (words: string) => `On the first tee next round, say your reminder out loud: “${words}”.`,
    tryToughest: (hole: number) =>
      `On a hole like hole ${hole}, slow your pre-shot routine and commit to one small target.`,
    patternCourse: (course: string, today: string, average: string, n: number) =>
      `At ${course} you were ${today} today vs ${average} on average over ${n} earlier round${n === 1 ? "" : "s"}.`,
    patternMood: (mood: string, count: number, total: number) =>
      `${mood} showed up again — it was logged in ${count} of your last ${total} rounds.`,
  },
  caddieLog: {
    title: "Caddie Log",
    subtitle: "Every conversation you've had with your Mental Caddie.",
    empty: "Your conversations with Fore!Mind will show up here.",
    back: "← Back to My Mental Game",
  },
  caddie: {
    title: "Your Mental Caddie",
    subtitle: "What's going on?",
    remembering: (n: number) => `Remembering ${n} past round${n === 1 ? "" : "s"}`,
    history: "History",
    backToAsk: "Back to Ask",
    historyEmpty: "Your conversations with Fore!Mind will show up here.",
    handsFree: "Hands-Free",
    phases: { listening: "Listening…", thinking: "Thinking…", speaking: "Speaking…" },
    hintListening: "Ask your question — I'll send it when you stop talking.",
    hintFollowUp: "Any follow-up? I'll send it when you stop talking.",
    hintThinking: "Your caddie is thinking.",
    hintSpeaking: "Reading the reply aloud.",
    handsFreeUnsupported:
      "Hands-Free needs voice input, which this browser doesn't support. Type your question below instead.",
    ttsUnsupported: "This browser can't read replies aloud — replies will appear as text.",
    orType: "or type your question",
    placeholder: "I can't stop thinking about my last hole…",
    speakToCaddie: "Speak to your caddie",
    ask: "Ask My Caddie",
    asking: "Asking…",
    busy: "My Caddie is busy for a moment. Try again in a few seconds.",
    unavailable: "The Mental Caddie couldn't respond right now. Please try again in a moment.",
    noteNoReadAloud: "This browser can't read replies aloud, so the reply is shown below.",
    noteNoVoice: (language: string) =>
      `No ${language} voice is installed on this device, so the reply is shown below.`,
    noteReadError: "Couldn't read the reply aloud, so it's shown below.",
    noteNoFollowUp: "No follow-up heard — Hands-Free is off.",
    noteTapForFollowUp: "Tap Hands-Free to ask a follow-up.",
    noteDidntHear: "I didn't hear anything. Tap Hands-Free to try again.",
    noteOff: "Hands-Free is off. Tap it again to ask more.",
  },
};

export type Messages = typeof en;
