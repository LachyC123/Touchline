# CLAUDE.md — project operating instructions for TOUCHLINE!

You are building a real, mobile-first, offline-capable browser GAME called TOUCHLINE!, not a collection of static mock-ups. Read `TOUCHLINE_MASTER_GAME_PLAN.md` in full before major architecture or gameplay changes. Refer to `IMPLEMENTATION_ROADMAP.md`, `UI_INTERACTION_BLUEPRINT.md`, and `MATCH_ENGINE_CONTRACT.md` as companion specifications.

## Absolute priorities (ordered)
1. Core football management loop that is enjoyable after five matches.
2. Recognisable, persistent player identity and emotionally satisfying progression.
3. Match visual credibility and tactical influence.
4. Tactile, curated, visually coherent premium mobile UI.
5. Correct rewards, deterministic generation, durable save state.
6. Performance and accessible controls on small mobile screens.
7. Additional seasons/content only after above are excellent.

## Working rules
- Build from a clean Vite + React + strict TypeScript repository if none exists. Do not overwrite existing work without inspection.
- Use Phaser for continuously animated match and training scenes; React/DOM for forms, menus, accessibility and card surfaces. Separate pure simulation from rendering. Verify actual installed package APIs; don't fabricate imports/functions.
- Use Dexie/IndexedDB for local persistence with schema versions and atomic state changes. Provide JSON save export/import. No forced login, no mandatory remote services.
- Make portrait mobile your default target (390x844, 360x740, 320x680). Desktop view is a graceful enhancement, not the main canvas.
- Use original fictional teams and names. Never include real club crests, copyrighted fonts, logos, commercial game art or unlicensed sounds.
- Build an actual visual identity: authored SVG character-part kit, card borders, badge family, gradients used sparingly, stadium illustration, motion/particle polish, short memorable sounds.
- Don't present fake “PLAY”, “TRAIN”, “SIGN”, “OPEN” etc. controls. Every visible important control has a working state transition and feedback or must be removed pending feature implementation.
- Do not replace a gameplay feature with a score-changing random button. Tactical commands must visibly change pure-sim decisions. Do not fabricate match animations unrelated to recorded actions.
- Do not silently simplify away existing functionality to fix a bug. Preserve behaviour, fix root cause, add regression test.
- Whenever a requested asset/design cannot be achieved programmatically to production standard, state precisely what is missing, create a coherent in-project original SVG/vector fallback, and list replacement art tasks clearly. Do not secretly add unrelated stock photos.
- Don't claim that you browsed, tested devices, opened a site, or inspected screenshots unless you actually did.
- Prefer explicit domain types, pure functions, well-scoped components and small feature modules over monolithic files.

## First milestone / vertical slice
Get from NEW SAVE -> free recruit pack -> generated unique card -> set lineup -> play animated 7v7 match with tactical input -> see full time -> receive coins and player XP -> select upgrade focus -> persistent save -> next match.

This must work before building a league pyramid, full narrative archive, academy, market, online play, detailed contracts, cosmetics shop, or exotic modes.

## Quality criteria for each implementation
For every new screen, ask:
- Can a first-time user immediately understand what to touch?
- Does its primary action have satisfying animated and audible feedback?
- Does that action make the user feel more connected to a footballer or club?
- Does an inactive card, empty state or error screen look intentionally designed?
- Is every number sourced from the same underlying game state?
- Is it readable with one thumb on a narrow portrait screen?
- Can the same task be done without dragging or rapid tapping?
- Does it work after refresh and offline?

## Programming contracts
- Seeded RNG must be deterministic; separate simulation RNG from reward RNG and visual RNG.
- Generate player identity once and persist; cards and pitch load appearance from one stable player definition.
- Pure domain functions cannot import Phaser, DOM or React.
- Simulation runs fixed timestep, renderer interpolates; rendering frequency must not affect winners.
- Match commands have recorded timestamps, deterministic validation, cooldowns and effects.
- All economy mutations enforce invariants atomically, with idempotency keys for repeated taps/reloads.
- Use `Number.isFinite`, sensible clamps, safe integers and fixed data bounds; validate every imported save.
- Persist save schema version, content/engine version for replay, reward-journal IDs and career seed.
- Unit tests for seeded generation, traits/OVR, lineup, economy, replay, clocks, league table and narrative predicates.
- E2E tests at mobile viewport for onboarding, pack reload, formation management, match completion, claim exactly once, save reload and setting accessibility.

## Review rhythm
Implement one milestone at a time. At its end, provide:
1. What concretely works and how to access it.
2. Files changed and commands run.
3. Tests with actual result and known blockers.
4. Screenshot/mobile preview when you actually have tooling for it.
5. Three most important feel/polish shortcomings.
6. The next smallest milestone, avoiding scope sprawl.

If interactive collaboration is possible, pause for review at milestone boundaries. Continue locally within a milestone as necessary to finish the tested user journey. Never mark unfinished work as complete.

## Commands (set after repository scaffold)
- `npm install`
- `npm run dev -- --host 0.0.0.0` for dev, if safe for local environment
- `npm run build`
- `npm run test`
- `npm run test:e2e`
- `npm run lint`
- `npm run simulate:balance` (create this script during match milestone)

Document exact commands and prerequisites in README. Do not assume every command exists before adding it to package.json.

## Practical code guardrails
- Keep generated initial season fixtures stable; do not regen when user reopens.
- Ensure match score/rewards persist before presentation ends or can be safely reconstructed by replay.
- Avoid browser alerts/confirm for premium UI; implement custom accessible dialogs.
- Respect audio policy: audio starts only after first input.
- Virtualize/list-window large card collections; don't render hundreds of animated portrait layers at once.
- Use requestAnimationFrame for motion, and pause costly effects on visibility change.
- Show useful save/export reminder in settings; browser storage may be deleted.
- Include a `DEV_DEBUG` gated panel for forcing rarity, inspecting player seed, setting scenario match seeds, and validating reward claims; exclude from production menus.

## Definition of a successful first playable
A real user on their phone can play several enjoyable matches; their favourite player has a recognisable face and history; cards feel exciting to touch; match tactics matter; a refresh preserves all progress. Not sufficient: pretty homepage, random generated team table, hardcoded match results, or a pack-opening animation that doesn't persist rewards.
