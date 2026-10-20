# TOUCHLINE!

*The club is yours.* A mobile-first, offline-capable browser football management game: procedurally generated footballers you get attached to, collectible cards, and (from M1) animated deterministic 7-a-side matches.

The full specification lives in this repo:

- `TOUCHLINE_MASTER_GAME_PLAN.md` — vision, systems, balance, screens
- `CLAUDE.md` — working rules and technical guardrails
- `IMPLEMENTATION_ROADMAP.md` — milestones and their current status
- `UI_INTERACTION_BLUEPRINT.md` — layout, motion and feedback spec
- `MATCH_ENGINE_CONTRACT.md` — simulation and rendering contract

## Status

**Milestone M0 (technical foundation)** is implemented: new career → 10 generated footballers → squad grid → player profile with a flippable hero card, all persisted in IndexedDB with export/import. See the M0 section of `IMPLEMENTATION_ROADMAP.md` for exactly what is done and what is deferred. Matches (M1) are not built yet, so there is no Match tab.

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
| `npm run test` | Unit tests (Vitest): RNG, generator incl. 10k diversity + 100k odds checks, save/persistence, export/import |
| `npm run test:e2e` | Playwright E2E at 390×844, 360×740 and 320×680 against a production build |
| `npm run lint` | ESLint (also forbids UI/framework imports in pure domain code) |
| `npm run typecheck` | TypeScript only |
| `npm run icons` | Re-render PWA PNG icons from `public/icons/icon.svg` |
| `node scripts/capture.mjs <url> <dir>` | Capture the review storyboard screenshots |

`npm run simulate:balance` arrives with the match engine in M1.

To include the developer Card Lab in a production-style build: `VITE_DEV_DEBUG=true npx vite build`.

## Architecture

```
src/
  domain/        pure TypeScript — no React/Phaser/Dexie (enforced by lint)
    rng.ts         cyrb128 hash + mulberry32, named independent streams, seeded UUIDs
    players/       generator (GENERATOR_VERSION), position-weighted Overall, card stats, XP curve
    club/          club identity/kit, new-career factory, auto-lineup, squad power
    save/          ClubSave type, schema/content/engine versions, formations
  data/          curated content: name pools, 12 traits, archetypes, personalities, origins, tier odds
  storage/       Dexie DB, Zod runtime schema, migrations, atomic mutateSave (with idempotency
                 claim ids), rolling backups, checksummed JSON export/import
  components/    portrait kit (procedural SVG), FootballerCard (mini/standard/hero), icons, UI kit
  features/      title, club hub, squad, player profile, settings (More), dev Card Lab
  app/           boot, hash router, GameContext (live queries), PWA update prompt
  audio/         procedural Web Audio sound grammar (no sample files)
```

Key contracts:

- **Same seed + generator version ⇒ identical player** (pinned by a snapshot test). Identity is generated once and persisted; every card and the profile render from that one stored record.
- **Every state change goes through `mutateSave`**: read → mutate a clone → validate with Zod (including squad/lineup invariants) → write, inside one IndexedDB transaction. A `claimId` makes a mutation apply at most once (tested with concurrent calls).
- **Imports** are size-limited, checksum-verified (SHA-256 over canonical JSON), migrated and schema-validated before a confirm dialog; the replaced career is kept as a local backup.

## Art & licences

All art is original and generated in code: the portrait kit (6 face shapes, 13 hairstyles incl. bald, 8 hair colours, 8 skin tones, 5 eye shapes, 8 brows, 6 noses, 8 mouths, 6 facial-hair styles, 6 accessories, 3 builds, 3 kit cuts × 5 patterns), card frames, icons, crest and stadium illustration. Fonts: Barlow and Barlow Condensed (SIL Open Font License 1.1), self-hosted via `@fontsource`. Sounds are synthesised at runtime. No real clubs, players, crests or commercial game assets are used.

## Saves

Your career is stored in this browser's IndexedDB. Clearing site data or using private browsing can delete it — use **More → Export** to keep a copy.
