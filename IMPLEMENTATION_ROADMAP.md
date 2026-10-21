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
- [x] Footballer stats, trait definitions, position weighted OVR, initial roster factory. *(M0 generator + `src/domain/players/`.)*
- [x] 7 starter slot validation and two formation shapes; tap and drag placement with accessible alternative. *(`src/domain/club/lineup.ts`, `src/features/lineup/`; 2-2-2 and 3-2-1; GK slot enforced; out-of-position penalty shown.)*
- [x] Pure seeded fixed-tick 7v7 match engine with player positions, ball, passes, dribbles, tackles, shots, saves and kickoff/restarts. *(`src/game/simulation/`; 10 Hz; throw-ins, corners, goal kicks, kick-offs, half-time.)*
- [x] Tactical action input: Quick Pass and Press with valid activation/cooldowns and actual simulation effects. *(12' active / 18' cooldown on the sim clock; effects measured in `reports/balance-latest.md`.)*
- [x] Game scene displays pitch, each team's 7 footballers, their kits, a moving ball and event-dependent actions. *(`src/game/renderer/MatchScene.ts` — Phaser 4; figures use each player's stored skin/hair; kick, tackle, dive, stumble, celebrate.)*
- [x] Scoreboard, clock, key commentary ticker, one goal camera, fulltime flow.
- [x] Match completes in normal time, can pause/skip, restores from pause/background. *(Checkpoints every 3 s of play, on goals and on pagehide; resume replays seed + commands.)*
- [x] Match result carries identical score/event log to renderer; seed replays match identically. *(Unit tests; rewards are computed from a replay inside the save transaction.)*
- [x] Real rewards/XP and upgrade choice applied atomically. *(`src/domain/match/settle.ts`, `chooseUpgrade` with idempotency keys.)*
- [x] Save restored after full reload; no duplicate match rewards. *(Unit + E2E.)*
- [x] Goal replays from seed/log. *(`#/replay/:match/:goal`, last five matches.)*
**M1 demonstration:** tap Play, watch a complete credible match, affect it, view replay, level a player, refresh and see changes persist.

**M1 known gaps (carried forward):**
- No substitutions, fatigue-driven subs or formation changes mid-match (M3 per roadmap).
- Set pieces are simple: corners/throw-ins are a taker plus a normal pass decision; no free kicks or penalties yet.
- One opponent list of 7 fictional clubs rotating with +2 strength per lap — no league table yet (M3).
- PRESS used whenever ready gives a measurable edge (≈44% W / 22% L vs a non-pressing mirror); flagged for tuning.
- Rendering only tested in headless Chromium (SwiftShader WebGL); not yet on a physical phone or Safari.
- Audio is a minimal synthesised set (whistle, kick, save, goal, coin); the full audio pass is M2.

## M2. Onboarding and delight
- [x] Opening stadium comic sequence and free pack. *(`src/features/onboarding/IntroScreen.tsx`: four authored SVG comic panels (~14 s, auto-advance, tap, pause, Skip); the First Signing pack is granted with the new career.)*
- [x] Pack outcomes persisted before first reveal; package tear, full card reveal, quick skip. *(The recruit is generated and stored when the pack is **granted** (`src/domain/packs/packs.ts`); opening is one idempotent transaction (`claimId = pack:<id>`) before any animation. Swipe the perforated strip or tap Open; card back shows the tier, then turns; tier-scaled hold, sound and confetti; Skip at any point; reload shows the same signing.)*
- [x] Tutorial highlighted signing, formation swap, first tactical button and first upgrade; replayable/skip. *(Guided steps `intro → pack → lineup → match → club → done`, each advancing only from the step before. The lineup glows the slot where the signing is a guaranteed upgrade and offers a one-tap "Put him there"; the live match prompts QUICK PASS once we have the ball; the result screen explains the first training choice; "Make it yours" names the club. Skip tutorial on the pack screen; More → Replay tutorial replays the story and tips without re-granting anything.)*
- [x] Sound effects for pack, kick, impact, crowd and goal; user-toggled and respectful browser gesture policy. *(New synthesised sounds: tear, whoosh, tier-scaled reveal arpeggio, stamp, tackle, crowd "ooh", post ping, cheer. Still Web Audio only, unlocked on first input, behind the existing toggle/volume.)*
- [x] Player cards shine/foil by tier without obstructing name/OVR; stat upgrades animate. *(Foil rims/glint for Breakout+ existed since M0; training choices now count each attribute and the OVR up with a sparkle.)*
- [x] Goal, miss, tackle, save and result each have distinct, controlled effects. *(Goal: flash, zoom, net ripple, confetti. Save: SAVE! burst + expanding ring. Won tackle/block: comic impact star + clack. Wide: WIDE puff + crowd groan. Woodwork: CLANG!, frame shake, post ping. Win at full time: confetti + cheer.)*
- [x] Reduced motion, high contrast, tap instead of drag support. *(Global reduced-motion rule also covers the new screens; pack has a one-tap Open; lineup placement has a button; kit colours are radio buttons; all new controls ≥44 px.)*
- [x] Onboarding E2E: cold new install -> full match -> upgrade -> main hub -> refresh. *(`e2e/m2.spec.ts` at 390/360/320, plus skip-and-open-later with reduced motion, and tutorial replay.)*
**M2 demonstration:** first-time play is intuitive, visually memorable and fast, with no mock controls.

Also added in M2 (needed so the pack system is not a one-off): a **Scout** tab (packs waiting, exact odds, pity counter, recent signings), a **Local Scout** pack earned every 3 matches with a persisted Breakout-or-better guarantee every 10 recruits, a recruit **debut bonus** (+40 XP, so a new signing's first match always ends in a training choice), **club name/colours/pattern** editing with validation and an automatic away-kit change when shirts would clash. Save schema v3 (v2 saves migrate as already onboarded).

**M2 known gaps (carried forward):**
- The guided first match is a normal full match (~2 min at 1×, 2× available), not the abbreviated 40–60 s opener the master plan sketches; no scripted tutorial seed.
- No separate coach mark for changing the formation shape (the tutorial covers placing the signing in the XI).
- Comic panels, envelope and supporter are code-drawn SVG; a human illustrator pass would lift them (see replacement art list in README).
- Sounds are synthesised placeholders with a coherent grammar; a sound designer pass (real crowd beds, foley) is still wanted.
- No haptics, no font-size mode beyond the existing Large text toggle.
- Tested in headless Chromium only (no physical phone/Safari yet).

## M2.5 Match incidents (playtest feedback: "more things that can happen")
- [x] Long shots, crosses and headers, first-time rebounds. *(Engine `engine-2`; see MATCH_ENGINE_CONTRACT §12.)*
- [x] Real keeper saves: catch, directional full-stretch dive that travels, fingertip over/round for a corner, parry with a live rebound; double saves.
- [x] Fouls with free kicks (direct ones get a wall and a set-piece specialist) and penalties for fouls in the box; bookings make players cautious.
- [x] Slide tackles vs standing blocks; named skill moves (stepover, nutmeg, roulette, rainbow flick, drag-back) decided by dribbling duels.
- [x] Stats visible in play: card-style chips (DRI/SHO/STR/SET/REF/DEF) pop over a player when a strong attribute (65+) decided a moment; speed lines on genuinely quick players; "Key moments" on the result screen name the stat behind each moment.
- [x] Commentary, sounds (whistle peep, skill swish), banners (PENALTY!, DOUBLE SAVE!, yellow card) and goal-card labels (screamer, header, rebound, free kick, penalty).
- [x] Tests: incident coverage, penalty/foul rules, booking and double-save invariants, attribute influence; balance report includes incidents per match.

**M2.5 known gaps:** no red cards, offsides, injuries or substitutions yet; free-kick curl is drawn as an arc and gold trail rather than a modelled spin; skill and save animations are procedural rig poses, not hand-animated.

## M2.6 Manager cards and Momentum (playtest request)
- [x] Momentum bar (0–10) replaces chip cooldowns; regen on the match clock, comeback lift after conceding.
- [x] Eight manager cards with real simulation effects (Quick Pass, Press!, Go Wide, Park the Bus, Hairdryer, Target Man, All-Out Attack, Man-Mark); hand of three with Clash-style cycling; opposition benches play their own decks under the same rules.
- [x] Unlock-only progression by manager level (club XP); unlock reveal on the result screen; NEW badges.
- [x] Deck screen (3–5 cards, first three = opening hand), lobby deck preview with the opponent's bench, live card tray with Momentum meter, next card, active effects, opponent card pop-up, Man-Mark tether on the pitch.
- [x] Tests: hand/Momentum rules, exact replay of every card, paired-seed behaviour tests per card, unlock/deck persistence, v3→v4 migration; E2E for the deck screen and playing a card; balance rows per card.

**M2.6 known gaps:** no drag-to-play (tap only, by design for one-thumb play); no card art beyond the icon set; the AI manager's card logic is rule-based, not adaptive; opponents' decks are fixed per club style.

## M3. Competitive mode and career attachment
- [~] Stable fictional AI club identities and generated opponents with distinct tactics and named captains. *(14 authored clubs across two divisions, each with a style, formation, card deck and a fixed, seeded squad that improves a little each season. Named captains not yet.)*
- [x] 8-club division fixtures, results, league table, promotion, season archive; AI fixtures simulated consistently. *(`src/domain/league/league.ts`: seeded double round robin (14 rounds, fixed once generated), every AI-vs-AI fixture simulated by the same engine with both benches AI-managed, table from results only (3/1, GD, GF), scorers chart, top-2 promotion from Division Two and bottom-2 relegation from Division One, season prize money and club XP, season history. A career opens at home to the weakest side.)*
- [~] Two additional formations, Go Wide and contextual decision Moments; substitutions and fatigue. *(Go Wide shipped as a manager card in M2.6; formations, Moments and substitutions not yet.)*
- [ ] Expanded trait set and generated player personalities.
- [ ] Player career diary, factual milestone events, locker-room requests, rivalry headlines.
- [ ] Cup bracket and home/away stadium styles if time permits after league is working.
- [x] Season completion integration tests, opponent reappearance and standings invariants. *(`src/storage/league.test.ts`: fixture fairness, determinism, a full 14-round season through the real save path with table invariants, close-once season end, promotion/relegation, v4→v5 migration; `e2e/m3.spec.ts` plays a full season in the browser.)*
**M3 demonstration:** complete season with personal moments, persistent rivals, fair league standings and non-trivial tactics.

**M3 so far (league slice):** Division Two → Division One with a real table, fixtures and scorers; "Around the league" after every match; a final-day screen with promotion/relegation and prizes. Also the guided first match now teaches Momentum and the first card at 2× speed. Save schema v5 (v4 careers start a fresh Division Two season). **Form & stories (M3.1):** last-5 form chips for both sides; "The build-up" before every fixture (what a win would seal, top-of-table clashes, leapfrogs, the promotion chase, six-pointers, derbies and revenge from the last meeting, runs of form, top scorers), the most important line on the hub card; a sealed-fate banner on the result screen (title, promotion, safety or relegation, from conservative points maths over the remaining fixtures) and a headline for the rest of the round; a trophy/pennant and "season in brief" on the final day. All of it is computed from stored results in `src/domain/league/stories.ts` (tested), nothing is stored twice. **Trophies & milestones (M3.2):** hat-tricks, first goals and clean sheets, and goal/assist/appearance/clean-sheet landmarks are written to each player's scrapbook at settlement (`src/domain/players/milestones.ts`) and shown as a "Milestones" list on the result screen; the build-up flags landmarks one game away and scoring runs; the season-end transaction stamps a title/promotion medal on every player who appeared, plus the Golden Boot; a trophy cabinet on the hub and an honours row on player profiles; level-ups queue one at a time with the rest as tappable names. **County Cup (M3.3):** all 15 league clubs plus a non-league guest (Rookfield Athletic) and the player's club, single-leg knockout ties drawn round by round from the career seed, played after league rounds 3, 6, 9 and 12 (`src/domain/cup/`). A level tie goes to a seeded penalty shootout decided by takers' finishing/composure against the keeper (`shootout.ts`), revealed kick by kick on the result screen. Other ties, and every round after the player is knocked out, are simulated by the same engine. Progress prize money, a winners' bonus, cup-winner medals, a silver jug in the trophy cabinet and a Cup tab with the full bracket. Save schema v6 (a v5 season in progress gets its first cup next season). **Big-match walk-out (M3.4):** cup ties, derbies, games that can seal a title/promotion/survival, top-of-the-table clashes and the final day open with a tunnel walk-out (both crests, the storyline that makes it matter, the seven walking out). The engine is held at minute 0 (`MatchController.holdForWalkOut`) until Kick off. Chosen by `src/domain/match/bigMatch.ts` from the same storylines as the lobby. Level-ups now sit below the fixture on the Matchday screen. **Not yet:** named captains, personal requests, substitutions/new formations, a third division above Division One (Division One champions stay up and are recorded as champions).

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
