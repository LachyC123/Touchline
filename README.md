# TOUCHLINE!

*The club is yours.* A mobile-first, offline-capable browser football management game: procedurally generated footballers you get attached to, collectible cards, and (from M1) animated deterministic 7-a-side matches.

The full specification lives in this repo:

- `TOUCHLINE_MASTER_GAME_PLAN.md` — vision, systems, balance, screens
- `CLAUDE.md` — working rules and technical guardrails
- `IMPLEMENTATION_ROADMAP.md` — milestones and their current status
- `UI_INTERACTION_BLUEPRINT.md` — layout, motion and feedback spec
- `MATCH_ENGINE_CONTRACT.md` — simulation and rendering contract

## Status

**M0, M1 and M2** are implemented: opening comic → free First Signing pack (tear, reveal, persisted before the animation) → guided lineup placement → an animated, deterministic 7v7 match you can influence with PRESS and QUICK PASS (with a first-time prompt) → full time with real rewards, XP and the first training choice → name your club and pick its colours → hub. Scout packs are earned every 3 matches with published odds and a visible guarantee; goal replays; everything persists across reloads (including mid-match). Matches (engine-2) include long shots, crosses and headers, diving/fingertip/double saves, rebounds, slide tackles, named skill moves, fouls, free kicks with walls, penalties and bookings, all decided by player attributes; strong stats light up on the pitch as card-style chips. Tactics are **manager cards** paid for with **Momentum** that builds during the match: build a 3–5 card deck, unlock more cards by manager level, and play them from a hand of three while the opposition bench does the same. See `IMPLEMENTATION_ROADMAP.md` for exactly what is done and what is deferred.

## Requirements

- Node 22+ and npm 10+
- For E2E tests: a Chromium that Playwright 1.56 can drive. In the cloud dev container, set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`; locally, run `npx playwright install chromium` once.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev -- --host 0.0.0.0` | Dev server (includes the developer Card Lab at `#/lab`) |
| `npm run build` | Typecheck (`tsc -b`) and production build with service worker |
| `npm run preview` | Serve the production build |
| `npm run build:artifact` | Build for the claude.ai Artifact viewer (relative paths, fonts inlined, no service worker) → `dist-artifact/touchline.html` + `assets/`; used for phone playtests |
| `npm run test` | Unit tests (Vitest): RNG, generator incl. 10k diversity + 100k odds checks, match engine (determinism, replay, invariants, fairness, tactics), lineup rules, settlement exactly-once, save/persistence, export/import |
| `npm run test:e2e` | Playwright E2E at 390×844, 360×740 and 320×680 against a production build |
| `npm run lint` | ESLint (also forbids UI/framework imports in pure domain code) |
| `npm run typecheck` | TypeScript only |
| `npm run icons` | Re-render PWA PNG icons from `public/icons/icon.svg` |
| `npm run simulate:balance -- --n 1000` | Batch match sims → `reports/balance-latest.md` / `.json` (fairness, power gaps, formations, tactics) |
| `node scripts/capture-moment.mjs <url> <dir> "<Lab scenario>" "<ticker regex>"` | DEV build: kick off a Lab scenario seed (Penalty, Double save, Diving save, Free kick shot, Skill move) and capture frames when the commentary matches |
| `node scripts/capture.mjs <url> <dir>` / `capture-m1.mjs` / `capture-m2.mjs` | Capture the review storyboard screenshots (M0 screens / M1 match flow / M2 first run; `VW=320 VH=680` for other viewports) |

To include the developer Card Lab in a production-style build: `VITE_DEV_DEBUG=true npx vite build`.

## Architecture

```
src/
  game/
    simulation/  pure seeded 7v7 engine (engine.ts, ai.ts, shotModel.ts, replay.ts) — no DOM/Phaser
    renderer/    MatchController (fixed-step clock, interpolation, event reveal) + Phaser MatchScene
  domain/        pure TypeScript — no React/Phaser/Dexie (enforced by lint)
    rng.ts         cyrb128 hash + mulberry32, named independent streams, seeded UUIDs
    players/       generator (GENERATOR_VERSION), position-weighted Overall, card stats, XP curve
    club/          club identity/kit, new-career factory, auto-lineup, squad power
    save/          ClubSave type, schema/content/engine versions, formations
  data/          curated content: name pools, 12 traits, archetypes, personalities, origins, tier odds
  storage/       Dexie DB, Zod runtime schema, migrations, atomic mutateSave (with idempotency
                 claim ids), rolling backups, checksummed JSON export/import
  components/    portrait kit (procedural SVG), FootballerCard (mini/standard/hero), icons, UI kit
  features/      title, onboarding (story, club identity), scout (room, pack opening), club hub, squad, lineup,
                 matchday lobby, live match, result, replay, player profile, settings, dev Card Lab
  app/           boot, hash router, GameContext (live queries), PWA update prompt
  audio/         procedural Web Audio sound grammar (no sample files)
```

Key contracts:

- **Same seed + generator version ⇒ identical player** (pinned by a snapshot test). Identity is generated once and persisted; every card and the profile render from that one stored record.
- **Every state change goes through `mutateSave`**: read → mutate a clone → validate with Zod (including squad/lineup invariants) → write, inside one IndexedDB transaction. A `claimId` makes a mutation apply at most once (tested with concurrent calls).
- **Matches are deterministic**: `createMatch(seed, lineups)` + recorded commands (with their tick) always produce the same events. Kick-off freezes both lineups into the save; rewards are re-derived by replaying seed + commands inside the settlement transaction (`claimId = match:<id>`), so reloads and double taps can never pay twice.
- **Imports** are size-limited, checksum-verified (SHA-256 over canonical JSON), migrated and schema-validated before a confirm dialog; the replaced career is kept as a local backup.

## Art & licences

All art is original and generated in code: the portrait kit (6 face shapes, 13 hairstyles incl. bald, 8 hair colours, 8 skin tones, 5 eye shapes, 8 brows, 6 noses, 8 mouths, 6 facial-hair styles, 6 accessories, 3 builds, 3 kit cuts × 5 patterns), card frames, icons, crest and stadium illustration. Fonts: Barlow and Barlow Condensed (SIL Open Font License 1.1), self-hosted via `@fontsource`. Sounds are synthesised at runtime. No real clubs, players, crests or commercial game assets are used.

### Replacement art wanted (current versions are original in-code SVG fallbacks)

- Opening comic panels (empty ground, terrace + battered ball, supporter handing over keys, title card): illustrator pass for character acting and lighting.
- Scout envelope / card back: a paper texture and printed crest treatment.
- Sound: crowd beds, net ripple, boot/ball foley, pack tear to replace the synthesised placeholders.

## Saves

Your career is stored in this browser's IndexedDB. Clearing site data or using private browsing can delete it — use **More → Export** to keep a copy.
