# WAR ECONOMY

> A roguelike deckbuilder about the price of winning a war. (Consolidated Edition — locked for build)

A ~10-minute single-run deckbuilder: pick a side, then beat the other three
WWII powers back to back (the third fight is a boss-buffed rematch). Teaches
opportunity cost, war finance, regime mobilization styles, information/signaling,
and reputation constraints — through mechanics, not lectures.

## What's in the box

- **44 cards** — 24 shared (Military / Buildings / Politics, incl. 3 tempting
  dirty cards) + 4 faction kits of 5. Your faction's signature card starts in
  your deck; its other 4 cards are weighted ×1.5 in the reward pool.
- **4 factions / archetypes** — Germany (tempo), USSR (attrition), Japan
  (piracy), USA (snowball).
- **Enemy War Chest** — every enemy has a visible treasury (+1/turn, USA +2)
  that *funds* its signature moves (💰-tagged intents). Rob it empty and
  Blitzkrieg limps, the USSR's block fizzles ("supply lines cut"), Divine Wind
  stays grounded, the USA's ramp stalls. The Manhattan Clock doesn't care.
- **Intent telegraphs** — the enemy always shows its next move; Blitzkrieg
  warns one extra turn ahead; Eye in the Sky shows two moves.
- **Reputation (0–10)** — dirty cards are 30–50% stronger on purpose; at ≤2
  the world intervenes, once, irreversibly.
- **Theft timing (spec 3.2)** — stolen gold never lands in the current turn's
  pocket: all theft, by either side, resolves into the victim's next income
  step (player theft adds to the player's next income). Keeps theft from
  bypassing the opportunity-cost scarcity loop.
- **Synth soundtrack** — sfx and a chiptune battle loop are WebAudio-generated
  at runtime; still zero audio assets. The mute button silences both.
- **Two difficulties** — Standard (boss in the last fight only) and Hell
  (**every** fight is the boss version: +15 HP, signature moves +30%). Picked
  on the faction-select screen, fixed for the run.
- **Onboarding** — a How to Play screen (six one-line rules) and a Four Powers
  screen giving each faction one strength and one weakness, so the first
  faction choice is an informed one.
- **28 achievements** — 10 general, 12 matchup, 6 death; localStorage only,
  gallery on the title screen, "War Is Over" badge at 100%.
- **6 death causes** — the death screen tells you exactly how you lost.

## Run locally

Any static file server works:

```bash
python3 serve.py 8642
```

Then open http://localhost:8642. No build step, no dependencies, no backend.
(`serve.py` just adds no-cache headers; `python3 -m http.server` works too.)

## Deploy to Netlify

Drag this folder onto https://app.netlify.com/drop — that's it.
The whole app is static files; achievements are the only persistent data
and they live in the player's browser.

## Languages

Ships in 18 languages:

English · 简体中文 · 繁體中文 · 日本語 · 한국어 · Español · Português (BR) ·
Français · Deutsch · Italiano · Русский · Polski · Türkçe · Tiếng Việt ·
Bahasa Indonesia · ไทย · हिन्दी · العربية

On first visit the language is picked from the browser; after that the
player's choice is remembered in localStorage. Arabic renders right-to-left
(`dir="rtl"`), with numeric HUD readouts pinned LTR so bidi doesn't scramble
them.

**Language is locked for the duration of a run.** The picker appears on the
title, side-select, victory and defeat screens only — not during a battle.
Switching mid-fight was almost always a misclick, and having the game change
language while you're reading enemy intents is worse than finishing the run
first. `runLocked` in `game.js` enforces this, and `UI.setLanguage` refuses
mid-run even if called directly.

Translations are localized, not translated: the jokes are rewritten to land
in each language rather than carried over word-for-word. (The "Polyglot at
War" achievement — win battles in 3 languages — is the excuse to go look.)

### Adding a language

1. Copy `lang/en.js` (the reference locale — every other pack mirrors its keys).
2. Translate the values. Keep the keys and the function signatures identical.
3. Add one `<script>` line in `index.html`.

Nothing else changes. Missing keys fall back to English rather than breaking.

## Files

- `index.html` — shell and the language-pack script list
- `i18n.js` — the i18n engine: registry, `T()`, achievement lookups, language
  detection, RTL
- `sprites.js` — all pixel art as palette-indexed pixel grids (Sweetie-16,
  the spec's 16-color palette), drawn to canvas at runtime and cached as data
  URLs. 4 country sprites (24×18) + 44 card icons (16×12), no image assets;
  falls back to emoji if canvas is unavailable. CSS scales them crisply via
  `image-rendering: pixelated`.
- `lang/*.js` — one file per language. **All player-facing text lives here.**
- `style.css` — all styling (responsive to 380px, RTL, per-script typography,
  war-chest/funded badges, achievements UI)
- `game.js` — all game logic: 44 cards, 4 enemy scripts with War Chest funding,
  faction system, weighted rewards, reputation + intervention, 28 achievements,
  death-cause attribution, WebAudio-synthesized sound (no audio assets)
- `serve.py` — local dev server with no-cache headers (not needed to deploy)

To reword a card, edit the relevant `lang/*.js` — `game.js` holds only
mechanics, so text changes can't break the rules.

### Tests & balance sim

- `node test/harness.mjs` — ~128 assertions over every mechanic.
- `node test/langcheck.mjs` — key-completeness audit of all language packs.
- `node test/sim.mjs 1000` — heuristic bot plays 1000 full runs per faction
  and reports win rates (`… 1000 oldtheft` re-runs under the pre-change
  same-turn theft rule for A/B comparison).

### Cache busting

Asset URLs in `index.html` carry a `?v=N` stamp. Bump it after editing text
so returning players don't get stale language packs from their browser cache.

## Single-file build & deployment

```bash
node build.mjs
```

Produces `dist/index.html` — the entire game (CSS, i18n engine, 18 language
packs, sprite data, game logic) inlined into one ~440 KB file with **zero
external requests**. Drag `dist/index.html` onto https://app.netlify.com/drop
for a public link, or drag the whole project folder if you'd rather deploy the
unbundled version. `dist/artifact.html` is the same content without the
`<html>/<head>/<body>` skeleton, for hosts that supply their own.
