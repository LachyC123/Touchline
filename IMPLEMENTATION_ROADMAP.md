# TOUCHLINE! — Step-by-step Claude Code build roadmap

Tick checkboxes only when the feature works on a **real narrow viewport** and passes its specified test; recording an intended implementation is not completion. Maintain this file in repo as source of truth.

## M0. Technical foundation (do this first)
- [x] Inspect existing project and report what is already available. *(Repo held only the spec zip + README.)*
- [x] Scaffold Vite, React, strict TypeScript, test framework, responsive app shell. *(Vite 8, React 19, TS 6 strict + `noUncheckedIndexedAccess`, Vitest 5, Playwright 1.56, ESLint 9.)*
- [x] Install Phaser, Dexie and PWA support only after verifying version and compatibility. *(Phaser 4.2.1 installed, first used in M1; Dexie 4.4 in use; vite-plugin-pwa 2.0 generating a service worker + manifest.)*
- [x] Create original visual tokens: colours, shapes, text sizes, spacing, radii, shadows, simple sound grammar. *(`src/styles/tokens.css`, `src/audio/sfx.ts`.)*
- [x] Build primary navigation and one polished, animated procedural FootballerCard (mini, standard and hero variants). *(`src/components/cards/`; nav shows only working tabs: Club, Squad, More.)*
- [x] Create procedural portrait assembly with coherent matching parts and seed-stable rendering. *(`src/components/portrait/`.)*
- [x] Implement deterministic RNG and player factory with test fixtures and 10k diversity smoke test. *(`src/domain/rng.ts`, `src/domain/players/generator.ts`, tests alongside.)*
- [x] Set up versioned IndexedDB and import/export test. *(`src/storage/`.)*
- [x] Run build, tests, mobile browser check. Document gaps. *(Unit + E2E at 390/360/320 in headless Chromium with mobile emulation; no physical-device test yet — see gaps below.)*
**M0 demonstration:** a unique generated footballer card can be tapped, flipped, revisited and looks exactly the same after refresh. *(Covered by `e2e/m0.spec.ts`.)*

**M0 known gaps (carried forward):**
- Not tested on a real iPhone/Android device or Safari/WebKit; only Chromium mobile emulation.
- The club hub is intentionally minimal (crest, stadium illustration, spotlight player, squad tile); hotspot hub and facility art are M4.
- No onboarding cutscene, pack opening, lineup editing, matches or rewards yet (M1/M2).
- Portrait kit is code-drawn vector art: coherent, but a human illustrator pass would raise its ceiling (expression range, hair silhouettes, ageing).
- Main JS bundle is ~164 KB gzip (React + Dexie + Zod); code-split further when match assets arrive.

## M1. First football match — functionality before content
- [ ] Footballer stats, trait definitions, position weighted OVR, initial roster factory.
- [ ] 7 starter slot validation and two formation shapes; tap and drag placement with accessible alternative.
- [ ] Pure seeded fixed-tick 7v7 match engine with player positions, ball, passes, dribbles, tackles, shots, saves and kickoff/restarts.
- [ ] Tactical action input: Quick Pass and Press with valid activation/cooldowns and actual simulation effects.
- [ ] Game scene displays pitch, each team's 7 footballers, their kits, a moving ball and event-dependent actions.
- [ ] Scoreboard, clock, key commentary ticker, one goal camera, fulltime flow.
- [ ] Match completes in normal time, can pause/skip, restores from pause/background.
- [ ] Match result carries identical score/event log to renderer; seed replays match identically.
- [ ] Real rewards/XP and upgrade choice applied atomically.
- [ ] Save restored after full reload; no duplicate match rewards.
**M1 demonstration:** tap Play, watch a complete credible match, affect it, view replay, level a player, refresh and see changes persist.

## M2. Onboarding and delight
- [ ] Opening stadium comic sequence and free pack.
- [ ] Pack outcomes persisted before first reveal; package tear, full card reveal, quick skip.
- [ ] Tutorial highlighted signing, formation swap, first tactical button and first upgrade; replayable/skip.
- [ ] Sound effects for pack, kick, impact, crowd and goal; user-toggled and respectful browser gesture policy.
- [ ] Player cards shine/foil by tier without obstructing name/OVR; stat upgrades animate.
- [ ] Goal, miss, tackle, save and result each have distinct, controlled effects.
- [ ] Reduced motion, high contrast, tap instead of drag support.
- [ ] Onboarding E2E: cold new install -> full match -> upgrade -> main hub -> refresh.
**M2 demonstration:** first-time play is intuitive, visually memorable and fast, with no mock controls.

## M3. Competitive mode and career attachment
- [ ] Stable fictional AI club identities and generated opponents with distinct tactics and named captains.
- [ ] 8-club division fixtures, results, league table, promotion, season archive; AI fixtures simulated consistently.
- [ ] Two additional formations, Go Wide and contextual decision Moments; substitutions and fatigue.
- [ ] Expanded trait set and generated player personalities.
- [ ] Player career diary, factual milestone events, locker-room requests, rivalry headlines.
- [ ] Cup bracket and home/away stadium styles if time permits after league is working.
- [ ] Season completion integration tests, opponent reappearance and standings invariants.
**M3 demonstration:** complete season with personal moments, persistent rivals, fair league standings and non-trivial tactics.

## M4. Training, scouting and living hub
- [ ] Training mini-games: finishing, passing and goalkeeper, with auto-train accessibility.
- [ ] Training focus paths, XP calculations and mentorship.
- [ ] Multiple earned scouting pack classes, odds disclosure, recruitment guarantee counter and choice recruits.
- [ ] Stadium/training/scout facility upgrades with illustrated before/after states and world interactions.
- [ ] 2-3 layered ambient animation cycles per facility (non-distracting).
- [ ] Journal / trophy room, club news tied to actual stored events.
- [ ] Economy progression simulation for 5/20/50 matches; adjust gains/costs.
**M4 demonstration:** club noticeably grows, veterans bond with prospects, scouting decisions produce meaningful roster choices.

## M5. Shipping quality
- [ ] Complete four division structure, varied authored rival styles, cups and prestige awards.
- [ ] Optimise pitch and card renderer for portrait mobile; avoid heavy rerenders and particle storms.
- [ ] Offline PWA + install guidance, test iOS/Android browsers where access exists.
- [ ] Save import/export, migration and recovery path tested; document risks of cleared browser storage.
- [ ] 1000-seed match balance reports for tactics/power gaps and edge cases.
- [ ] Accessibility pass (tap targets, focus, readable typography, contrast, captioned SFX cues).
- [ ] Complete first 30-min human playtest and write issues ranked by severity.
- [ ] No unimplemented interactive elements, broken links, production exceptions, placeholders, pirated assets.
**M5 demonstration:** a complete short career that could be played happily on an actual phone and resumed offline.

## Quality pass to run AGAIN after each milestone
1. Is it a football game instead of a stats admin panel?
2. Does tapping/claiming/signing feel responsive, dynamic and deliberate?
3. Does the individual player matter beyond OVR?
4. Do tactics alter observable match action?
5. Are first five minutes free from long dead-end menus?
6. Can a 320px-wide phone complete core actions without zooming?
7. Is all acquired progress durable after refresh?
8. Are weird states handled? (No empty squad, duplicate tapping, interrupted pack, suspended match, missing assets.)
9. Has this phase *improved* the previous feature set instead of stripping it down?
10. Have automated tests actually been run rather than assumed?

## What NOT to do first
- Do not start with online multiplayer, subscriptions, store integration or notifications.
- Do not create 100 static footballer portraits before the procedural portrait template works.
- Do not spend time on 100 fictional clubs when the same opponent must still have a functioning match.
- Do not ship arbitrary match scores because animated sim is hard.
- Do not grow 15 pages of empty menus before getting a one-match vertical slice.
