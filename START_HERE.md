# START HERE — run this with Claude Code

1. Put these files in the intended project folder (or open a new empty folder):
   - `TOUCHLINE_MASTER_GAME_PLAN.md`
   - `CLAUDE.md`
   - `IMPLEMENTATION_ROADMAP.md`
   - `UI_INTERACTION_BLUEPRINT.md`
   - `MATCH_ENGINE_CONTRACT.md`
2. Open that folder in VS Code / terminal with Claude Code.
3. Copy and send the prompt below.
4. Ask Claude to implement milestones one by one, reviewing the phone-sized preview and gameplay after each.

## First prompt for Claude Code (copy from here)

> Read **every file** in this project, especially `TOUCHLINE_MASTER_GAME_PLAN.md`, `CLAUDE.md`, `IMPLEMENTATION_ROADMAP.md`, `UI_INTERACTION_BLUEPRINT.md` and `MATCH_ENGINE_CONTRACT.md`. Treat them as the full specification for our game, TOUCHLINE!. Build a **genuine playable mobile-first browser football management game**, not a prototype that only shows static menus. The game must have highly polished card design, randomly generated persistent player identities, genuinely animated deterministic seven-a-side matches with tactics that influence the simulation, exciting earned pack reveals, satisfying training/upgrades, club progression and reliable save data.
>
> Start by inspecting the existing folder and proposing a concise architecture. Then implement **Milestone M0** from the roadmap, with strong mobile UI craftsmanship, deterministic player generation, a premium functional player card, and working persistence. Don't skip straight to an unrelated dashboard, don't remove features to make work easier and don't use copyrighted football game assets. Use TypeScript strict, React/Vite, Phaser for playable animation and Dexie for IndexedDB. After M0, run the actual build and tests, demonstrate the generated cards and explain precisely what works and what doesn't, including any art limitations. **Pause at milestone review** before building M1 if interactive review is possible. Proceed to M1 only with tested M0 foundations. Implement M1 as a proper end-to-end match experience with a real sim, not random scores. Keep it playable and responsive at 390x844 and 360x740 mobile sizes.

## Briefing for later iterations

After M1 works: “Run the feel/juice pass in M2. I want the game to feel like a premium fast mobile title: animated pack tear/reveal, bouncy card placement, strong goal and save effects, personalised footballers, victory/upgrade choreography and intentional layered visuals. Preserve every existing working system and run regression tests.”

When something looks basic: “Do a **second-pass visual and tactile polish**, not a redesign of the underlying logic. Improve hierarchy, animations, distinct football identity, player art cohesion, stadium atmosphere, button press feedback, quality of rewards and the visual storytelling. Do not add pointless decorative panels or lose mobile readability.”

When matches feel fake: “Compare current match sim with `MATCH_ENGINE_CONTRACT.md`; diagnose the first moment where action, ball path and player decisions are disconnected. Repair deterministic sim/presentation correspondence and demonstrate replay identical for the same seed/input. Do not use synthetic highlight random rolls to mask missing football behaviour.”

## File purpose
- **MASTER:** the what and why — game vision, systems, balance, every major screen, progression.
- **CLAUDE.md:** how Claude should work, technical guardrails and review standards.
- **ROADMAP:** small reviewable increments rather than impossible one-shot implementation.
- **UI BLUEPRINT:** composition, component states, motion and individual screen wireframes.
- **MATCH CONTRACT:** exact testable shape of football simulation and event rendering.
