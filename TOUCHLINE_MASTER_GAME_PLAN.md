# TOUCHLINE! — THE CLUB IS YOURS
## Complete mobile-browser arcade football management game design and Claude Code implementation specification

**Document version:** 1.0 — 20 October 2026  
**Audience:** Claude Code / solo indie developer  
**Primary device:** Portrait mobile browsers, particularly modern iPhone Safari and Android Chrome  
**Secondary:** Desktop browser with responsive centred phone-sized layout  
**Format:** Installable Progressive Web App (PWA), offline-first single-player  
**Visual reference:** The tactile delight, readability and colourful hierarchy of premium mobile card-battlers, WITHOUT copying their assets, interface, typography, mascots, or intellectual property.  
**Core promise:** *Build a club full of footballers you remember, then watch them become heroes.*

---

# 0. READ THIS FIRST — THE NON-NEGOTIABLES

This is a GAME, not a dashboard. Every core screen requires rewarding interaction, movement, atmosphere, and clear feedback. Polish is not a post-launch afterthought.

1. **Playable immediately.** Within the opening minute, users open a pack, meet a player, select a lineup, and start their first match.
2. **Every player is an individual.** Procedurally generate persistent names, faces, attributes, potential, personality, tendencies, development stories, signature celebration, and career events. No generic clones.
3. **Meaningful decisions every match.** Visibly animated seven-a-side football is backed by a deterministic simulation. Real tactical changes alter behaviour and results; no fake random highlights.
4. **Arcade pacing.** Complete a match in roughly 90–150 real seconds, including dramatic pauses and the result. Users can skip spectacle but not outcomes.
5. **Outstanding card feel.** Responsive taps, dragging, flips, level-ups, rewards, particles, sound, spring transitions and bespoke art direction; accessible reduced-motion fallback.
6. **Earnable packs.** Packs are earned in matches, competitions, objectives, and scouting. No real-money gambling, dark patterns, premium-energy blockers, or artificial scarcity.
7. **No broken promises.** Every interactable either works or is explicitly absent from the shipped screen. Do not render fake buttons labelled Coming Soon in the release build.
8. **Permanent progress.** Robust IndexedDB save, migrations, import/export, autosave, backup/recovery. Never silently reset careers on refresh.
9. **One excellent vertical slice first.** A polished opening, club hub, cards, squad screen, one match type and rewards precede larger features.
10. **Do not strip earlier features for expedience.** Extend cleanly, preserve a working build, run tests at each milestone, and request milestone review before major feature expansion when collaborating interactively.

## Explicitly NOT in initial scope
- Real licensed football leagues, clubs, player names, crests or likenesses.
- Online player-vs-player, trading markets, real-time multiplayer or real-money purchases.
- Full 3D football or eleven-a-side tactical fidelity.
- Generative AI calls required for names, portraits, dialogue or simulations.
- Timed lootboxes, roulette-like monetisation, manipulative streak penalties.

---

# 1. THE VISION

## 1.1 Elevator pitch

TOUCHLINE! is a fast, deeply personal, collectible football management RPG with vivid mobile-game presentation. The user is handed a battered local club and turns unknown procedurally generated footballers into stars through smart scouting, exciting match-day decisions, hands-on training and hard-earned card upgrades. Matches are animated, tense, and short enough for one more game. Your squad's history becomes a scrapbook: the substitute who scored a stoppage-time winner, the keeper who saved three penalties, the winger who demanded a transfer before becoming club captain.

## 1.2 Genre ingredients and the DIFFERENCE

| Ingredient | Familiar attraction | TOUCHLINE! improvement |
|---|---|---|
| Football management | Squad building, formation, league table | Snappy, accessible decisions; football actually moves on screen |
| Collectible-card games | Premium rarity, tactile collection, pack reveals | Every card is a permanent *person*, not an interchangeable duplicate |
| Arcade sports | Quick matches, spectacle, last-second goals | Manager-led tactical inputs, readable outcomes, expressive players |
| RPG progression | Levels, specialisations, milestones | Player biographies, rivalries, bonds, growth arcs, earned nicknames |
| Idle club builders | Facilities, currency, visual change | Visible club evolution and individual training, without idle timers |

**Design north star:** The most emotionally valuable card should often be one the user trained, not merely the rarest card they packed.

## 1.3 Intended session shapes

- **60 seconds:** Claim result, inspect developing player, complete a drill or tweak one role.
- **3 minutes:** Play one match, celebrate, choose an upgrade, queue next match.
- **10 minutes:** Play a three-match run, scout and promote someone, adjust tactic, level up training ground, review the club story.
- **Long-term:** Win promotion, defeat recurring rivals, develop club legends, build a gallery of historic moments.

## 1.4 Emotional journey

Underdog -> scouting excitement -> tactical attachment -> first breakthrough -> adversity -> trusted favourites -> star-making -> club identity -> promotion -> new rival.

---

# 2. GAME IDENTITY / BRAND / ART DIRECTION

## 2.1 Name / tone

Working title: **TOUCHLINE!**  
Tagline: **The club is yours.**  
Alternative internal title: **LAST MINUTE FC** if branding needs change.

Tone: cheeky British football culture, bold and playful, never contemptuous. Players can be clumsy, dramatic, arrogant, loyal, quiet or hardworking; their histories can be funny and genuinely moving. Writing is **short, characterful and specific**, not thousands of generic flavour paragraphs.

## 2.2 Visual target

A distinctive **“Saturday morning football sticker album meets vibrant stadium arcade”** design language: bold rounded shapes, sharp-readable typography, slightly textured layered card stock, plastic/acrylic shine, subtle metallic rims, stitched-fabric and paper ticket motifs. High-end 2.5D feel, without 3D performance cost. Avoid generic AI-generated gradients everywhere, bland purple dashboards, generic emojis as the sole artwork, and flat text-only cards.

Suggested palette (treat as art-direction guidance, tune for legibility):
- Deep navy `#101C32` — primary background and dark ink.
- Stadium green `#1E8D70` — base action surface/pitch.
- Electric lime `#CBF238` — earned progress, action sparks.
- Cream `#FFF7E9` — warm readable paper surfaces.
- Sunset orange `#FF7956` — urgency / attacking energy.
- Royal blue `#4178EF` — team management and defence.
- Gold `#F4C653` — genuinely rare / important moments.
- Magenta `#DC63B4` — special / playful cosmetics, not universal default.

Palette accessibility: never encode rarity or urgency by colour alone. Use icons, shape, wording and contrast. Build high-contrast mode.

Typography: display font with condensed football-poster character (self-host with legal licence); compact, legible UI sans for body; small uppercase eyebrow labels; generous numbers and stat labels. No inaccessible ultra-small stats. Avoid font licences unknown to the project.

## 2.3 Card anatomy

**Portrait card layout from top to bottom:**
1. Expressive border/lighting according to card edition; max 2 decorative layers on common tiers.
2. Massive overall rating in top-left; clearly legible position in top-right.
3. Head-and-shoulders procedural portrait with layered hair, kit, accessories, face silhouette and team colour.
4. Distinct nameplate, one-line archetype subtitle (e.g. “Last-ditch wall”, “Left-foot magician”).
5. Exactly four readable primary stats (PACE, PASS, SHOT, DEF) plus GK-specific set if goalkeeper.
6. One strong trait icon and a short trait label with expandable details.
7. Bottom story chip: recent milestone (“Academy Graduate”, “Scored on debut”), not only rarity.

Card sizes:
- Mini (lineup pitch), no micro text; shows role, face, rating and rarity silhouette.
- Standard (collection grid), shows rating/name/position/trait.
- Hero (player detail and reveal), full portrait, lore, traits, animation and history.

Rarity should feel special without dominating skill or balance. Editions visually evolve with achievements: embroidered club badge, worn-in captain's ribbon, trophy foil / legacy stamp.

## 2.4 Rarity art direction

| Tier | Visual | Audio / reveal |
|---|---|---|
| Street | Warm blue/cream, simple border | Snap and paper flick |
| Prospect | Teal edge, animated sticker accent | Upward whoosh |
| Breakout | Violet/blue foil, subtle glints | Two-step stinger |
| Star | Gold trim, animated confetti on reveal | Brass-like celebratory chord |
| Phenomenon | Iridescent edge, bespoke frame and signature entrance | Unique reveal with a choice to skip |

Rarity is a recruitment signal for **potential ranges and likelihood of special traits**, not an excuse to make all low-tier players rubbish forever. The rarest tier must not always be a higher immediate OVR than a well-developed lower-tier club legend.

## 2.5 Club hub world

A charming *interactive club courtyard / stadium frontage* is the hub, not a grid of corporate cards. Use layered illustrated/2.5D components rendered in SVG/Canvas or assembled vector assets. Every building has a purposeful visual identity. Tap stadium -> Match; training ground -> Drills; scouting hut -> Packs; clubhouse -> Squad; trophy shelf -> Club Story; newspaper stand -> Inbox. Simple animation loops: tiny flags, floodlights, supporters gathering on match day, groundskeeper, rotating scoreboard, flapping banners, occasional ball bouncing. Keep loops restrained and semantic; no decorative clutter obscuring navigation.

Upgrade visuals in 3+ stages: cracked concrete to painted stands; training cones to proper pitch; ramshackle office to decorated academy. **Actual before/after visible**. Accessibility alternative: standard bottom navigation always present, no forced exploration just to use menus.

## 2.6 Motion and audio language

- **Tap:** 70–120 ms compress/rebound, quick tick, glint on meaningful actions.
- **Card drag:** lift 6 px, cast shadow, target highlight, magnetic snap (keyboard/tap alternative).
- **Upgrade:** old rating flips, number counts up, new badge bursts, brief celebratory voice-free sting.
- **Pack:** pull tab -> bright unwrapping -> staggered reveal -> new signing spotlights. “Reveal All” after first encounter.
- **Goal:** pitch camera punch-in, brief freeze frame, stadium swell, scoreboard slam, confetti only for meaningful moments.
- **Last minute:** scoreboard pulses mildly; crowd builds; shot impact and keeper save have different weighty sounds.
- **Injuries/frustration:** clear, respectful states, not gratuitous failure punishment.
- Provide separate sliders/toggles for music, SFX, haptics if available, and reduced motion. Never autoplay audio before user interaction.

Aim at 60 FPS for animated screens on a mid-range mobile device, fallback 30 FPS for less capable devices; game logic must be deterministic independent of rendering frame rate. Do not make particle effects a blocking dependency for game actions.

---

# 3. THE CORE LOOP

```
OPEN CLUB
  -> See compact daily football news / recommended action
  -> Choose next match OR training / scouting
  -> Prep line-up and tactical focus (30-45 sec max)
  -> PLAY 90-150 sec match with 3-6 important interventions
  -> RESULT: goals, player-of-match, memorable highlight
  -> CLAIM: coins + reputation + player XP + pack progress
  -> ONE CLEAR CHOICE: train player, open scout pack or upgrade facility
  -> Club story updates -> Next match button
```

**Rule:** At least one meaningful progression beat should be available after every match. Not necessarily a pack every time: a training decision, a relationship update, a small upgrade, milestone reward, new tactical unlock, or league movement also counts. Never flood the player with seven overlapping popups.

## 3.1 The 'one more match' tension

- Each league tier has a small, visible promotion path with 8-12 opponents, not an endless shapeless ladder.
- A match may advance league position, player development and contract goals simultaneously.
- Every third/fourth match typically completes some collection or facility progress through *earned*, clearly displayed systems.
- Recurring rivals and short narrative arcs give the next fixture a face.
- The match result screen gives a vivid recap and one prominent NEXT MATCH entry rather than returning to cold menus.
- Milestones are opt-in and celebratory, not predatory FOMO.

---

# 4. PLAYER GENERATION — THE HEART OF THE GAME

## 4.1 Every new signing is one-of-a-kind

Use a seed-driven procedural generator. Player identity remains unchanged after signing unless there is an intentional story event or cosmetic choice. Do not generate a new portrait or personality every time a card renders.

Generated identity fields:
- UUID; seed and generator version (for reproducibility).
- Given name, family name, optional nickname; nationality / birthplace drawn from curated fictional/localised data pools; avoid offensive combinations.
- Age 16–34 for generated senior players (youth variants only inside academy system, no problematic content); debut date / season.
- Position and secondary positions; dominant foot; height/build/face; hairstyle, hair/skin colours, brows, facial hair, kit styling and optional accessories.
- Distinct on-pitch running style, body language, idle pose, goal celebration, visual trait accent.
- Current stats, innate talent/potential range, growth curve, plateau tendency and development focus.
- Tactical tendencies: risk taking, ball carrying, work rate, off-ball runs, shot preference, pressure response.
- Personalities: selfless, hot-headed, ambitious, laid-back, resilient, anxious under pressure (handled respectfully), perfectionist, joker, big-game player. Avoid reducing people to crude stereotypes.
- Personality modifiers: loyalty, confidence, ego, adaptability, professionalism, morale, relationship bonds.
- Trait slots: e.g. Rocket Start, Poacher's Instinct, Iron Lungs, Needle Pass, Sweeper Keeper.
- A small individual “dream”: win a cup, become captain, score from distance, earn 25 starts, etc.
- Career diary + generated meaningful milestones, season-by-season stats, accomplishments and clubs represented.

### Name and uniqueness rules
- A country-aware name pool is seeded and compositional, not an API.
- Keep surname/given-name pronunciation and duplication reasonable; optionally use generated nickname for repeated common names.
- 20+ face shapes x hairstyles x expressions x uniforms x skin/hair combinations with curated matching and contrast. The **same player** must look the same on card, lineup pitch, celebration close-up and biography.
- Avoid randomised output that looks chaotic: kit styles belong to club identity, skin tones do not determine attributes or background, hair/eye combinations should look designed.
- Player cards show coherent, original illustrated assets from SVG parts or human-made sprites. No mismatched stock photos.

## 4.2 Attributes and derived rating

Core numeric skill attributes: pace, acceleration, shooting, finishing, passing, vision, dribbling, ball control, tackling, marking, strength, stamina, composure, set-pieces. GK: reflexes, positioning, handling, distribution, reach. Normalize 1-99.

Use **position-weighted** skill valuation; do not sum every stat equally. Displayed Overall = role-weighted attribute aggregate + small fit modifier; use consistent published formula in code. Example FW weights: finishing .20, shooting .16, off-ball (derived) .14, pace .12, ball-control .10, composure .10, strength .06, passing .06, stamina .06. Unit tests: weights sum to 1, no OVR outside supported range. Current form influences match ability but not permanent Overall rating.

Recommended starting club:
- 7 starters (GK, 2 DEF, 2 MID, 2 FWD) + 3 substitutes; procedural identities.
- Starting OVR 42-61 to show room for growth.
- One selectable emotional anchor player with promising but imperfect stats. First tutorial scouting pull guaranteed **a new useful positional improvement**, without promising a premium rarity.
- Hard upper bounds for natural improvements; exceptionally well-developed Street players remain useful via traits/chemistry even when rare ceilings are higher.

## 4.3 Player example briefs — generated examples, not hardcoded copies

**Milo Serrano**, 19, left-foot winger-turned-striker, 53 OVR, “Fearless Dribbler,” humble but struggles with composure. Tendency: sprints toward space. Dream: score in a final. Signature: awkward knee-slide that improves after becoming a Star. His path: practice finishing versus preserving pace, gain composure through appearances, maybe become club icon.

**Callum Okoro**, 28, 58 OVR central defender, “Last-Ditch Wall,” vocal leader, low acceleration. Doesn't need a gold rarity to become beloved: 100th interception triggers club-history badge; develops mentoring bond with academy player.

**Esme Vale** is NOT an auto-generated player in a men's league by default: if the game supports both men's and women's leagues or an explicitly mixed fictional league, establish setting rules clearly and consistently and generate suitable pools; don't arbitrarily mix leagues without worldbuilding.

## 4.4 Personal attachment systems

**Career scrapbook:** A page per player, automatically added moments: first goal, debut, clean sheet, longest goal, penalty winner, injured return, 50th appearance, captaincy, season award, upset win. Each moment has a date, opponent, auto-generated short headline, match replay reference where available, and an art-sticker stamp. Match archive preserves seeds/event logs, not heavy video.

**Relationship bonds:** Friendly rivalry and mentor bonds emerge from shared lineups, complementary playstyles and match events. Maximum two visible bonds per player to avoid opaque spreadsheets. Bonds give restrained performance synergy (e.g. +3% chance of finding each other in certain plays, not automatic wins). Make friendships visible through short locker-room snippets and special two-player celebrations.

**Personal requests:** Short inbox choice once every few matches, not a dating sim. Examples: “I need a start to prove myself”, “Let me take free kicks”, “I'm ready to mentor the kid”. Granting requests can boost confidence; declining is not automatically catastrophic. Choices visibly apply to stats/relationships for several matches.

**Signature evolution:** At training milestones, a player may gain a different signature flourish, visual celebration, new nickname or earned foil edition *without losing their original identity*. Existing cards upgrade visually; avoid reselling the same person.

**Loyalty and decisions:** Later-game players ask for starting opportunities, leadership or contracts; selling one should generate a proper farewell card and entry in club history. Initial MVP avoids deep transfer-contract economy until stable.

## 4.5 Growth balancing and meaningful choice

Player growth = match XP + training focus + mentor boost + personal milestone bonus; age, potential and fatigue moderate the curve. Never progress solely via drawing duplicates.

Upgrade at a milestone: player selects ONE of 2-3 focus cards rather than a flat +1 to everything. Examples:
- Forward: **Instinct** (+finishing, +off-ball) vs **Showtime** (+dribble, +long shot).
- Keeper: **Shot Stopper** (+reflex, +handling) vs **Sweeper** (+passing, +positioning).
- Defender: **Enforcer** (+strength, +tackling) vs **Reader** (+positioning, +passing).

Base XP example: 40 per completed match + 15 win + 5 clean sheet / assist + 10 POTM, capped per match to prevent farming. Simple levels: `XP to next = round(55 + 18*level + 3*level^1.4)`; tune via simulator. Training tokens spent for attribute allocation, not hard paywalls. Soft-cap improvement above potential means costs rise, but no invisible brick wall.

---

# 5. PACKS, SCOUTING, COLLECTING

## 5.1 Honest pack philosophy

Every pack gives a distinct prospect, useful consumable training/manual resources, and small cosmetics or club supplies. Players are **not generated duplicates of already owned players**: cards are actual people. Cards can be collected as club legends, released or transferred; no duplicate shards system. Equivalent upgrade materials come from universal coaching manuals and matches.

No paid random packs in MVP, no misleading “near miss” reveals, no purchase-based lootbox mechanics. If monetisation is ever considered, use transparent fixed-price cosmetics/content and seek age-appropriate legal review before additions.

## 5.2 Pack types and sample rewards

| Pack | Earned by | Contents |
|---|---|---|
| Local Scout | Match result / objectives | 1 player, 1 coaching manual |
| Regional Trials | Match streak progress / early milestones | 2 candidates, sign 1; bonus kit pattern |
| Academy Showcase | Training milestones | 2 youth prospects, choose 1; development plan |
| Cup Spotlight | Tournament win | 1 high-potential prospect with guaranteed special skill OR a recruit selection |
| Club Legend Memento | Long-term achievements | Commemorative card foil, banner and title for EXISTING hero, not a paywalled superior player |

**Prototype published prospect band rates** (illustrative and subject to playtesting): Street 53%, Prospect 28%, Breakout 14%, Star 4.5%, Phenomenon 0.5%. A paid currency never purchases chance-based cards. When displaying odds, include exact odds for relevant rewards and what a tier means. A deterministic reward track can guarantee a Breakout-or-higher candidate every 10 standard scouting recruitments; make guarantee visible, persisted and testable.

**Better main acquisition choice:** many scouting packs offer 3 glimpses (portrait silhouette, position, a pair of stats), then reveal/sign exactly 1. This adds decisions and reduces collection inflation. Start with simple one-card packs in MVP, add draft-style scouting later.

## 5.3 Opening choreography

1. Scout package lands on desk; envelope has taped club crest; inspect instantly.
2. Tap/drag to tear top; physical strip peels in short spring animation.
3. Cards fan out; edge colour reveals rarity without deceptive roulette.
4. Tap one card -> quick portrait assembly -> name stamp -> 4 stat counters -> trait flash.
5. Tiny acceptance moment: “WELCOME TO THE CLUB”; choice “ADD TO SQUAD” or “VIEW CARD” (add to roster in either case; no accidental deletion).
6. On high rarity: stadium floodlight silhouette, confetti and chant; **never take control away for more than a few seconds**. Skip and Reduce Motion respected.
7. Record new player's exact identity; navigate to their biography with a one-tap action.

Pack rewards should be decided and persisted **before** animation; force close/reload yields the same result and no lost rewards. Idempotency key for every claim, one transaction for inventory/currencies and reward journal.

---

# 6. THE MATCH ENGINE — ACTUAL ARCADE FOOTBALL

## 6.1 Format decision

Launch as **7v7** (GK + 2 defenders + 2 midfielders + 2 forwards) to maintain on-screen readability and meaningful player identities. Fictional mini-league rules make this natural. Entire game portrait; attacking up the screen, defending down, with camera following the ball. Later introduce a more traditional 11v11 simulation-only competition if desired; not required to call this football management.

A match runs ~120 seconds including halftime and significant highlights; simulated match clock shows 0–90 minutes. Game can include a tactical pause; match play is not real-time online, so pausing is safe. Built on a top-down/three-quarter 2D pitch with chunky expressive players and a physically traceable ball path. Use one consistent internal coordinate system; make pitch vertical on phones and adapt UI for desktop.

**Important:** A convincing sim is not random goals with players running in circles. Ball possession, passing, individual acceleration, defensive zones, player decisions, interception, shot origin, momentum and keeper save resolution must produce the event timeline. Animate that timeline deterministically.

## 6.2 Simulation architecture

Use two layers:
- **Pure simulation layer** (TypeScript): fixed step (e.g. 10 Hz), seeded PRNG, no React, Phaser, Date.now or animation calls, generates positions/actions/events, owns the actual result.
- **Presentation layer** (Phaser): interpolates positions at screen refresh rate, shows kicks, turns, ball trajectories, keeper dives, tackle impacts, camera, VFX and scoreboard. Presentation never decides the result.

Expose `createMatch(seed, home, away, tactic)`, `advanceSimulation(input?)`, `getSnapshot()`, `getEvents()`, `replayMatch(seed, recordedInputs)`.

**Deterministic behaviour inputs:** tactics, form, player attributes, footedness, fatigue, positional familiarity, confidence, trait triggers, ball/defender geometry and PRNG stream. Same seed + same actions + same versions = same events and score.

## 6.3 Football states

- Kick-off / first possession.
- Build-up from defence with support triangles.
- Midfield progression and close-range pressure.
- Attack into final third: overlaps, runs, through balls, dribbles, crosses.
- Tackle/interception/loose ball.
- Shot from coherent location and angle; keeper attempt and rebound.
- Goal/save/miss/block/post; restart.
- Set-piece (corner/free kick) as small specialised routines.
- Halftime. Foul/penalty cards are phase 2; initially limited physically plausible fouls.
- Full time, with match engine producing summary and player ratings.

**State machine** transitions must be explicit, testable, and resistant to indefinite loops. Outcomes should feel variable but readable; no ball teleportation except during valid restarts, which need animations.

## 6.4 Decision logic example

At a fixed tick, a player in possession scores candidate actions. Examples:

```
passScore = weighted(passSkill, teammateSpace, angle, targetProgression,
                     bondSynergy, tacticSafety, defensivePressure)
runScore  = weighted(pace, dribble, openLane, stamina, temperament,
                     tacticalDirectness, interceptionRisk)
shotScore = weighted(finishing, shotDistance, keeperAngle, composure,
                     defenderBlockChance, traitActivation)
```

Scores are compared using softmax with seeded variation, rather than a flat random choice. Refuse impossible shots or passes based on position. The defender responds through spatial pressure and tackling windows; ball release location determines next event. Injury or foul logic must not drive arbitrary outcomes initially.

Sample *illustrative* shot success probability (must be calibrated with batch simulations):
`pGoal = clamp(baseDistanceAngleQuality * finishingFactor * composureFactor * pressureFactor * keeperFactor, .01, .82)`;
probabilities are not a replacement for visible, coherent chance creation.

## 6.5 Formations and roles

MVP formations, all 1 GK + 6 outfield:
- **2-2-2 Balanced:** 2 DF / 2 MF / 2 FW; predictable.
- **3-2-1 Fortress:** stronger central defence, counter-play.
- **2-3-1 Press:** three midfielders, high press, vulnerable behind.
- **1-3-2 All In:** attack boost, dangerous defensive exposure; unlock later.

Cards drag to position magnets or tap player -> choose slot. Out-of-position effects are shown, not hidden. Tactical preset modifies preferred width, line depth, risk, possession/directness, pressing and stamina use.

## 6.6 In-match interaction: 3 ACTION CHIPS, NOT SPAM

Manager has three tactical chips at bottom that are visible and actionable when context permits:
- **PRESS!** Temporarily raise defensive pressure / interception attempts, with predictable fatigue cost and risk of counterattack.
- **GO WIDE** Alter support lanes, crosses and opposing defensive shape; strongest when having wingers or wide traits.
- **QUICK PASS** Raise one-touch tempo and forward combination preference; risks turnovers against intense press.

A fourth persistent **TACTICS** opens one quick overlay with formation/preset/substitute choices during pauses. The chip effect lasts e.g. 10-15 simulated match minutes with a short cooldown, never guarantees a goal or forces an event. Chips are usable without twitch reflexes. When a special **MOMENT** opens, the player sees two contextual choices: “Take the early shot” vs “Slip in the runner”, each with predicted trade-offs and an animation derived from actual sim geometry; both can succeed or fail. Limit to 1-3 meaningful Moments per match, not constant interruptions.

User control matters enough that identical squads with different tactics do measurably differently across 1,000 seeded simulations, while outcomes retain uncertainty and fair underdog wins.

## 6.7 The exact match display

**Top:** fixture strip, team badges, large score, 0–90' clock, home/away labels, 1-line announcer ticker.  
**Centre:** 70% of match-focus area: scrolling green pitch, pitch markings, miniature footballers with squad kits, dark readable shadows and name bubbles for key actions. Ball and selected player must always be readable.  
**Bottom:** 3 tactical action chips with cooldown rings, tactics/pause button, commentary/replay toggle.  
**Goal:** punchy freeze frame, player name + club crest, unique celebration, goal timestamp, replay from shot sequence, continue fast.  
**Halftime:** 6-second compact report: possession, shots, standout player; a clear “Change it up” button and instant resume.  
**Full time:** no loading page; stadium transforms into result podium with objective progress and player-of-match card.

## 6.8 Match result and recap

Show goalscorers, assists, shots, saves, possession, standout actions and ratings. Reward summary must identify why rewards changed. Feature one **club story card** (e.g. “62' — Dario’s first goal in six games”) and a single clearly surfaced progression action. Replay last goal event by seed/log where available. The player can fast-forward/skip entire match to full time for accessibility and convenience, but it simulates identical seeded outcomes and tactical decisions not made are simply omitted, not invented retrospectively.

## 6.9 Player visuals and field geometry

Create 7v7 expressive modular players, top-down/three-quarter sprite-like art: head, shirt, shorts, boots, hair and small distinguishing accessories, not just 14 coloured circles. Tiny readable foot plant, run cycle, turn, pass wind-up, kick/contact, dribble, tackle lean, keeper dive, celebration, exhaustion. Use animation layering/tweens; no requirement for physically exact humanoid simulation. If Claude can't create production-grade illustrated sprites procedurally, it should use elegant hand-authored SVG parts and a coherent vector aesthetic, not silent placeholders.

Ball arcs use tweened z-height and elliptical shadow; calculate end state in sim first. Camera follows play with capped interpolation and zoom; reduce-motion variant lowers shake and camera movement.

## 6.10 Fairness / simulation QA

Automated batch test: 1,000 matches per scenario. Check:
- Equal teams have roughly balanced win/draw/loss distribution over seeds (set tolerance based on expected variance).
- Stronger teams have a statistically meaningful edge, but not 100% wins.
- Defence-oriented tactic reduces expected goals against on average at an offensive cost.
- Aggressive pressing materially increases fatigue and turnovers both won/lost.
- Wrong-footed / out-of-position players degrade coherently, not catastrophically.
- Match always terminates; score remains integer; clock monotonic; no NaN.
- Seed-and-input replay equals original event sequence exactly.

Store simulation calibration reports under `/reports/` and re-run after tuning. Use human playtesting for “felt fairness,” not only statistical correctness.

---

# 7. TRAINING — MAKE IT A GAME, NOT A SPREADSHEET

## 7.1 Training ground layout

2.5D miniature training pitch, equipment and three stations:
- **Finishing Alley:** moving target circles in the goal; tap to time a strike. Rewards finishing XP.
- **Passing Gates:** choose a passing lane between animated defenders under a short timer. Rewards passing/vision XP.
- **Keeper Reflex:** tap one of three projected save lanes (telegraphed, not pure reaction abuse). Rewards GK XP.

Sessions take 10–25 seconds. Simple fun skill activity gives modest bonuses. Accessibility: automatic training yields the standard XP, minigame perfection adds only small bonus (e.g. +10%), so physical ability or hardware doesn't make the player uncompetitive.

## 7.2 Drill feedback

Players are shown training: they actually line up, shoot, react to misses, celebrate good hits, retrieve balls. Stats that improve pulse on their card; announce +2 FINISHING and show visible number change. Sound based on training performance. Tactile completion stamp and personal one-liner tied to traits (e.g. “Milo stayed for extra shots”).

## 7.3 Coaching choices

- Individual drill focus, 1 per player per development cycle, changed at any time.
- Facility level changes training *options* (unlock Passing Walls, Set-Piece Lab), not raw runaway XP multiplier.
- Mentorship: veteran + youth pair gives small targeted bonus and story scenes.
- Rest/recovery: energy for matches with clear visual status. No real-world timed energy gates; recover via match rotation or low-cost rest action.
- Training uses earned coins/manuals as an economy sink, but early progression is generously paced.

---

# 8. CLUB PROGRESSION, LEAGUES AND ECONOMY

## 8.1 Career season structure

Fictional seven-a-side league pyramid; initial 4 divisions for production, 8 clubs per division with authored badge, identity, stadium art accent, tactical profile, and named rival captain. A short season = play each other once or use 10-match fixture schedule incl. two derby events. Top 2 promoted, bottom 2 relegated after first season; tune accessibility. Midseason cup tournament unlocks after first few league fixtures, not a separate grind wall.

Suggested example teams:
- **Copperton Athletic:** practical, stubborn defence; local derby.
- **Harbour Rovers:** bright teal, aggressive attacking wings.
- **King's Yard FC:** highly disciplined pressing.
- **Stagmoor Town:** physical counterattack specialists.
- **Beacon Vale:** technical passing team.
- **Ironbridge United:** hated rivals with an arrogant striker.
- **Cinderfield FC:** young academy-focused side.

All names and badges are fictional; avoid near copies of real club identities. Opponent rosters generated with stable seeds and persistent memory. The opposing striker who scored a hat-trick returns as the same character next season.

## 8.2 Advancement rewards

- Win/draw/match participation coins and XP; moderate win advantage, but losses always advance players and grant rewards.
- Reputation raises sponsorship opportunities and stadium story cosmetics.
- Match tickets / stadium level provide capped coin bonus per game; no offline money generator needed.
- Pack progress track clearly shows fixed criteria; no surprise odds changes.
- Seasonal trophy cabinet holds banner and embossed commemorative stickers.
- Tactical tools unlock via club reputation, not premium tiers.

## 8.3 Example initial economy (subject to tuning)

| Action / source | Initial balance target |
|---|---|
| First-match reward | ~100 coins + 30 club XP + training manual |
| Normal match loss | 65–85 coins + full match XP |
| Normal draw | 90–110 coins |
| Normal win | 110–140 coins |
| Basic one-off drill | 25 coins (optional coin sink) |
| Standard upgrade milestone | 80–200 coins + earned training XP |
| Local scout opening | Earned every few games via points, not purchasable repeatedly without limit |
| First ground upgrade | ~400 coins, visible after 3-5 matches |

Coins are only one part of rewards; **do not gate every enjoyable click behind the same currency**. Clear tutorial “earn and spend” cadence. Show net coin flow summary in debug balance dashboard. Avoid exponential upgrade costs causing a midgame brick wall.

## 8.4 Facilities

**Stadium:** visually and acoustically evolves; unlocks rival spectacles + small coin reward boost.  
**Training Ground:** more drills and trainee slots; small efficiency boost.  
**Scouting Office:** unlocks choice packs and targeted scouting by position.  
**Medical Room:** fewer recovery penalties after demanding matches, not “injury prevention paywall”.  
**Clubhouse:** unlocks bonds and extra cosmetic customisation options.

Each facility must have visible new props, new animation state, a different silhouette and a proper upgrade animation. Treat hub composition like level design, not randomly dumping buildings on a canvas. Visual hierarchy and pedestrian space: stadium central, training pitch adjacent, scout hut near road/noticeboard, trophy area near clubhouse. Background tells club growth: fresh banners, repaired fencing, more supporters.

---

# 9. PERSONAL STORIES / NEWS / RIVALRIES

A compact in-game **TOUCHLINE POST** newspaper brings events without long dialogue:
- “UNBELIEVABLE SCENES — Milo bags his first hat-trick”.
- “THE SKIPPER SPEAKS — Callum wants a tougher training regime”.
- “OPPOSITION WATCH — Ironbridge's top scorer has 8 in 6”.
- “ACADEMY NOTE — A hard-working local teenager has turned heads”.

Story templates use actual club/game data and are generated from tagged match events; no false headlines such as a goal that never occurred. Save underlying story ID and event references.

### Story cadence
- Onboarding: club threatened, rival mocks your team, underdog stakes.
- Act 1: promotion from bottom division, first breakout player, local rivalry.
- Act 2: injuries/slumps, first cup run, more difficult talent decisions.
- Act 3: chase for top-tier title; one original veteran's farewell/legend induction.

Player choice events have 2 reasonable options and a clear effect, not “good or cruel”. E.g. “Our striker asks to take penalties” -> support request with confidence gain, or keep current taker with small tactical reason. One or two per 3-5 matches, not interrupt every click.

---

# 10. FULL SCREEN INVENTORY AND UI FLOW

## Persistent navigation
Bottom tab bar with icons + labels: **CLUB**, **SQUAD**, **MATCH**, **SCOUT**, **MORE**. Larger action buttons nested appropriately. Keep reachable thumb-zone navigation, browser safe-area insets, and landscape fallback. On very narrow devices, don't allow 5 tiny labels to become unreadable.

## 10.1 Splash / new save
Short stadium-lit logo stinger (skippable), “START YOUR CLUB”, “CONTINUE”, settings. Initial club name and shirt colours can be selected later in onboarding. No login needed. PWA setup instructions outside first-run flow.

## 10.2 Opening cutscene
Comic-strip / motion-panel 12–18 second sequence: empty stands, peeling paint, one beaten-up ball, an enthusiastic local supporter handing over keys. Text: “This club is going nowhere. Unless you change that.” Choices: start now or skip.

## 10.3 Hub
Visual focal stadium, 4 hot spots, top resource strip, league ladder teaser, recent news card, clear NEXT MATCH action. Hub reacts to weather/stadium events through lightweight art-only states (don't require weather APIs); fan count representation increases with club achievements.

## 10.4 Squad collection
2-column responsive card grid; filters GK/DEF/MID/FWD, search, sort rating/potential/age/form. Dedicated clear “Lineup” subtab; bench. Long-press or info button for detailed player biography. Drag/tap cards to formation. Detailed stat meanings accessible.

## 10.5 Player detail
Large living card; tabs: **OVERVIEW**, **TRAINING**, **STORY**, **STATS**. Prominent upgrade readiness and one-choice upgrade panel; “Favourite” pin, kit view, shareable export image later (privacy-safe, offline). Card tap flips to display story history, not meaningless ornamental back.

## 10.6 Match lobby
Opponent badge, fictional rival profile, formation/tactics selectors, projected matchup strengths (not exact win% if not calibrated), in-form player, recent club headlines, “PLAY MATCH”. Roster readiness clearly conveyed.

## 10.7 Live match
Animated pitch, score clock, 3 tactic chips, pause/skip, substitution overlay, live caption. Transitions to halftime and result without full page reload. Action chips use cooldown indication and spoken/visual feedback (not just colour).

## 10.8 Rewards
One podium moment, player-of-match card that feels earned, coins burst into resource tray, progress tracks fill, upgrade-ready chip animates. “CONTINUE”, “VIEW PLAYER”, “NEXT MATCH” hierarchy. If multiple rewards earned, deliver in controlled sequence with skip/reveal-all.

## 10.9 Scout / packs
Desk / recruitment wall, earned scout tokens, pack categories, exact reward rules, collection count, unopened packs. Make opening feel physical. Option to compare recruit against existing starter before final signing when choice scouting implemented.

## 10.10 Training
Interactive stations, currently assigned trainees, energy, quick skill challenge, attribute delta visualization, mentors. Never force repetitive drills as the only way to improve.

## 10.11 League / season
8-team ladder, form dots, fixture list, derby markers, top scorers / clean sheets, season awards, promotion rules. Players can tap opponent for biography/lineup rivalry preview. Simulate AI-AI fixtures with consistent seeded engine; table standings must add up.

## 10.12 Journal / Hall of Fame
Club trophy cabinet, timeline, records, retired/sold heroes, match highlights, player card snapshots with career progression. Allows nostalgia: first ever signing vs current greatest XI.

## 10.13 Settings
Volume sliders, colour contrast, reduced motion, font size mode, haptics toggle where supported, tutorial replay, export/import save, reset with double confirmation and explanation, credits, privacy details.

---

# 11. THE FIRST 60 SECONDS — FULL TUTORIAL SCRIPT

**0-8s — Hook:** 2D cinematic empty stadium and local supporter handing over keys. “Think you can save this place?” Skip visible. Title card.

**8-18s — Recruit:** Club scout gives ONE free, seeded-balanced newcomer. Swipe packet; animated reveal; player states a 1-sentence trait line. Explicit “MEET YOUR FIRST SIGNING”. Guarantee a useful position and personal hook. Avoid making player always the identical face/name across saves.

**18-30s — Start an XI:** Seven spots already filled with starter cards; tutorial highlights new player's best available position. Drag card into slot OR tap to auto-place. Feedback: pitch chip snaps, squad OVR small lift, confetti microburst.

**30-55s — First match:** Start an abbreviated ~40-60s *guided opening match* (shortened onboarding only). After visible possession sequence, flash **QUICK PASS!**; user taps; team creates an actual better passing shape. Ensure initial scripted tutorial event is plausible and guided, but the goal/result need not be guaranteed (avoid lying about tactical effect). Show first goal moment / heroic save via deterministic tutorial seed. No long narration.

**55-75s — Reward:** Full time, beginner reward, first XP bar reaches upgrade choice. User chooses between 2 meaningful training focuses. Show stat change on card.

**75-95s — Club belongs to you:** Choose club name and badge colour (skip has nice default), then hub reveals first rival and three obvious activities. One compact arrow points toward NEXT MATCH; tutorial ends.

**Note:** 60 seconds is the first *playable action* goal; total guided intro may last ~90 seconds with animation. Never insist tutorial is literally only 60 seconds at the expense of clarity. Tutorial is skippable/replayable. A returning player sees no repeated handholding.

---

# 12. CONTENT DESIGN — ABILITIES, MOMENTS, COSMETICS

## 12.1 Starting player traits (12)

| Trait | Trigger and bounded effect | Feedback |
|---|---|---|
| Rocket Start | Early acceleration bonus on open lanes | Speed streak behind boots |
| Poacher | Better positioning for loose balls in box | Gold boot glimmer on rebound |
| Long Ranger | Higher quality on plausible long shots | Ball trail for long-range shot |
| Needle Pass | Small precision bonus on tight through balls | Narrow pass lane highlight |
| Brick Wall | Better standing tackle against direct runners | Stamped impact graphic |
| Iron Lungs | Lower pressing fatigue cost | Tiny glowing energy badge |
| Sweeper Keeper | More aggressive off-line positioning | Keeper advance animation |
| Reflex Cat | Small improvement on close shot saves | Fast glove flash |
| Big-Game Nerves | Pressure penalty reduced in derby/cup | Calm pulse under trait icon |
| Set-Piece Artist | Better free-kick/corner delivery | Curving ball arc |
| Captain's Voice | Small local confidence boost | Brief badge pulse |
| Two-Footed | Smaller weak-foot penalty | Foot switch flourish |

No trait may automatically score/save goals. Define effect caps and audit combinations. Rare presentation ≠ broken balance.

## 12.2 Event headlines (12)

- “THE FIRST ONE: [PLAYER] FINALLY FINDS THE NET.”
- “WON IT LATE: [PLAYER] STRIKES IN THE 88TH.”
- “THE WALL: [KEEPER] DENIES THREE ON TARGET.”
- “NO EASY DAYS: [RIVAL] PUTS US TO THE TEST.”
- “BRILLIANT FROM THE BENCH: [PLAYER] CHANGES THE GAME.”
- “A TRUE CLUB PLAYER: [PLAYER] HITS 25 APPEARANCES.”
- “THAT LEFT BOOT AGAIN: [PLAYER] FINDS A PASS NOBODY SAW.”
- “THE COMEBACK: TWO GOALS DOWN, ONE TO REMEMBER.”
- “THE CLEAN SHEET CLUB: [DEFENDER] LED THE LINE.”
- “UNDER THE LIGHTS: CUP NIGHT AT [HOME_STADIUM].”
- “RISING STAR: [PLAYER]'S NEW TRAINING LEVEL.”
- “HELLO, NEIGHBOURS: DERBY WEEK ARRIVES.”

Only activate when the underlying event predicate is true. Localise later through structured tokens.

## 12.3 Reward psychology without manipulative design

Use competence, novelty, authorship and memory — not infinite push notifications or payment pressure. Present a short-term achievable objective + visible mid-term target + prestige long-term goal. Never obscure probability, manufacture urgency, or penalise life interruptions. Play-session reminders should be optional and supportive.

---

# 13. DETAILED TECHNICAL ARCHITECTURE FOR CLAUDE CODE

## 13.1 Stack — choose established, practical tools

- **Vite + React + TypeScript (strict)** for app shell, accessible menus, inventory screens, save UI.
- **Phaser** for 2D game scenes: pitch, players, ball, training minigames, select card reveal effects if this materially benefits performance. Install the currently supported stable version verified at implementation time; do not assume API versions from old guides. Phaser is a browser-native 2D game framework: https://docs.phaser.io/
- **Zustand** or narrow React context for short-lived state; **Dexie / IndexedDB** for save game. Dexie React docs: https://dexie.org/docs/Tutorial/React ; Dexie TS docs: https://dexie.org/docs/Typescript
- **CSS variables + curated styles / CSS modules** for premium crafted look; Tailwind optional if it actually helps speed; avoid style fragmentation.
- **Framer Motion / Motion** for UI springs only if performance proves acceptable; native Web Animations/CSS where simpler.
- **Howler.js or Web Audio API** for layered audio after user interaction; haptic support only if browser provides it.
- **Vitest** for domain/simulation tests, **Playwright** for mobile viewport end-to-end tests, lint + formatting, strict TypeScript.
- **vite-plugin-pwa** (verify current compatibility at setup) with manifest, install prompts where supported, cache strategy and offline app shell. PWA install/support guidance: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable ; offline guidance: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
- **No backend in MVP.** All game simulation and persistence run offline. Future cloud save possible through optional user authentication + explicit sync strategy. Do not set up Supabase merely to store single-player save files.

The game should *not* be a giant Phaser scene for every menu: DOM/React for accessible cards and interfaces; Phaser for field interaction and continuous animation. Avoid duplicate scroll controls and competing pointer handling. App remains responsive on resize and browser keyboard opening.

## 13.2 Proposed repository structure

```
touchline/
  public/
    icons/ audio/ textures/ portraits/ stadium/
  src/
    app/               # bootstrap, routes, responsive shell, accessibility
    components/
      cards/            # mini, collection, hero, upgrade, reveal
      feedback/         # coin burst, toast, stat delta, banners
      layout/           # header, bottom nav, safe-area handling
    features/
      club/ squad/ scouting/ training/ match/ season/ journal/ settings/
    game/
      simulation/       # PURE domain code: no React or Phaser imports
        rng.ts types.ts rules.ts tactics.ts spatial.ts
        ai.ts ball.ts possession.ts events.ts engine.ts
      renderer/         # Phaser pitch scene, animation interpolation, camera
      minigames/        # small Phaser training scenes
    domain/
      players/          # deterministic player generator and progression
      rewards/          # economy, progression, packs, idempotent claims
      leagues/          # fixtures and standings
      stories/          # event predicates and story templates
    data/               # fictional names, curated traits, clubs, formations
    storage/            # Dexie schema, atomic tx, migrations, import/export
    state/              # UI ephemeral state
    styles/             # design tokens, fonts, animation and responsive rules
    accessibility/
    test/fixtures/
  scripts/              # balance sims, deterministic replay testing
  reports/              # generated balance reports
  CLAUDE.md
  README.md
```

## 13.3 Crucial TypeScript models

```ts
type Position = 'GK' | 'DEF' | 'MID' | 'FWD';
type Tier = 'street' | 'prospect' | 'breakout' | 'star' | 'phenomenon';

type Footballer = {
  id: string;
  generatedSeed: string;
  generatorVersion: number;
  firstName: string;
  lastName: string;
  nickname?: string;
  nationality: string;
  age: number;
  primaryPosition: Position;
  secondaryPositions: Position[];
  strongFoot: 'left' | 'right' | 'both';
  appearance: {
    faceId: string; skinId: string; hairId: string;
    hairColour: string; eyeId: string; accessoryIds: string[];
  };
  attributes: Record<string, number>;
  potential: number;
  developmentCurve: 'early' | 'steady' | 'late';
  tier: Tier;
  traitIds: string[];
  personality: {
    loyalty: number; ambition: number; professionalism: number;
    confidence: number; sociability: number;
  };
  tendencies: { risk: number; pressing: number; passing: number; shooting: number };
  level: number;
  xp: number;
  energy: number;
  morale: number;
  historyEventIds: string[];
  stats: { matches: number; goals: number; assists: number; cleanSheets: number };
};

type ClubSave = {
  schemaVersion: number;
  saveId: string;
  careerSeed: string;
  club: { name: string; colours: [string, string]; stadiumLevel: number };
  coins: number;
  clubXp: number;
  teamFootballerIds: string[];
  lineup: Record<string, string>; // slot id -> player id
  footballers: Record<string, Footballer>;
  packInventory: Record<string, number>;
  guaranteedRecruitProgress: number;
  rewardClaimIds: string[];
  fixtures: unknown[]; // replace unknown with typed structures during implementation
  matchRecords: unknown[];
  journal: unknown[];
  season: number;
  tutorialStep: string;
};

type MatchCommand =
  | { type: 'PRESS'; simMinute: number }
  | { type: 'GO_WIDE'; simMinute: number }
  | { type: 'QUICK_PASS'; simMinute: number }
  | { type: 'SUB'; simMinute: number; outId: string; inId: string }
  | { type: 'SET_TACTIC'; simMinute: number; tacticId: string }
  | { type: 'MOMENT_CHOICE'; simMinute: number; choiceId: string };

type MatchRecord = {
  id: string; engineVersion: string; seed: string;
  homeClubId: string; awayClubId: string;
  commands: MatchCommand[];
  score: [number, number];
  eventLog: unknown[]; // formal type required before saving
  rewardsClaimed: boolean;
};
```

**Production refinement requirement:** The `unknown` fields above are scaffolding ONLY. During the domain layer milestone, define complete unions and runtime schema validations (e.g. Zod) for all persisted structures. Never ship `unknown` records or `any`-typed state as permanent design.

## 13.4 PRNG and persistence

Use a known deterministic seeded generator (e.g. mulberry32 / xoshiro with fixed seed serialisation and tests). Separate PRNG streams for generated player identity, match decisions, cosmetic animation and reward generation; visual changes must not modify football results. Store generation version in every prospect. Freeze result/pack objects at award time; never derive inventory from unstable random calls during render.

Transactions:
- Opening a pack atomically decrements inventory, generates and persists rewards and marks claim consumed *before revealing*.
- Upgrading a player atomically checks currency, deducts cost, applies attribute change and adds history entry.
- Completing a match atomically writes final match record, league points/player stats, grants once-only rewards and saves replay log.
- When save schema changes, provide explicit migrations and retain backup for recovery.

Import/export: JSON format with schema version and checksum, defensive parser, duplicate save/overwrite confirmation, private local data by default. An optional second rolling backup prevents a failed migration from losing progress. Notify user that clearing browser storage can remove offline saves.

## 13.5 Responsive and PWA constraints

- Start with 390x844 CSS px and 360x740; test 320px wide; support up to modern large screens and landscape without breakage.
- Fullscreen-like standalone PWA using safe areas (`env(safe-area-inset-*)`), no horizontal scroll, finger-sized targets approximately >=44x44 CSS px (accessibility target); pinned actions do not overlap iOS home indicator.
- Keep font rendering crisp; no tiny text on mini cards, accessible card info alternative.
- Handle page visibility: pause presentation and safely snapshot sim when backgrounded. Resume from recorded deterministic state; don't award two match rewards.
- Respect OS reduce motion, color contrast and sound settings. Keep offline shell cached, avoid unnecessary service-worker update loops.
- Use sprite atlas / SVG caching and pooled particles; budget DOM animation; cap simultaneous visual FX.
- Loading: fast first interactive paint, only load match assets on first match entry; loading screen offers actual progress not fake percentage.
- Avoid device vibration if unsupported; audio gracefully unlocks on interaction.
- Provide clear unsupported storage / private-browsing warning, not a silent crash.

## 13.6 Performance/quality gates

- UI responsive while animations run; no long main-thread freeze on squad generation or batch fixture simulation (use background worker when needed, with deterministic input/output).
- Pre-render portraits / memoize cached SVGs; do not reconstruct 10+ rich faces every animation frame.
- 60 FPS target on tested modern phones; 30 FPS acceptable performance fallback in match visuals, while gameplay remains consistent.
- Dev diagnostics: FPS, sim tick rate, memory trend, IndexedDB transaction duration, sprite count.
- Add logging boundary for state transitions, match inputs and reward operations. No production console errors / unhandled promises.
- Verify cold start online, repeat start offline, page refresh mid-match, page refresh mid-pack, rotation, low battery mode where accessible, and save export/import.

---

# 14. GAME RULES / SYSTEM DEPENDENCY MAP

Build in dependency order:

```
seeded RNG + content tables
         -> Player generator -> Profile and Card UI
         -> Squad + formation rules
         -> Match engine -> Match renderer -> Match results
         -> Rewards + progression -> Training + packs
         -> Leagues + fixtures -> Story events + rivalries
         -> Facilities / stadium visual evolution
         -> PWA offline + reliable save -> final polish / release
```

UI fidelity and save contracts must develop *alongside* domain logic, but don't build 15 static screens without a match. Team strength computation must be used by both preview and match engine; do not duplicate formulas.

# 15. IMPLEMENTATION PHASES WITH CONCRETE DELIVERABLES

## Phase 0 — Design system + technology spike

- Bootstrap Vite/React/TypeScript, strict lint/tests, base app route shell, tokens, portrait viewport, PWA skeleton.
- Make ONE complete premium card with procedural SVG head, rating stat plate, real hover/touch interactions, reduced-motion option, multiple tiers; this is the quality bar for all other screens.
- Create one animated 7v7 pitch experiment with tiny players, ball and camera, proof of 30/60fps on mobile.
- Build save format schema, seed test, basic exported fixture generator.
- **Pass condition:** no mock dashboard, one card genuinely feels collectible; touch/resize work on mobile; a seeded portrait reproduces exactly.

## Phase 1 — THE VERTICAL SLICE (PLAYABLE FROM START TO FINISH)

- New club creation, generated 10-player initial roster, one starter scout package, squad formation setup.
- One tactical preset, two action chips, one generic opposition team.
- Match engine simulates a coherent 7v7 possession sequence to full time; visible scores/replays; skip and pause.
- Match outcome saved transactionally; basic reward screen, coins, match XP, player upgrade choices, one pack.
- One polished onboarding sequence + minimal hub; refresh restores career.
- **Pass:** new user can genuinely play a full short match and upgrade a persistent unique player with *no developer intervention*.

## Phase 2 — FEEL AND JUICE PASS (before content explosion)

- Audio pass (kick, crowd, whistle, goal, save, menu taps, coin collect), cohesive motion grammar and haptics fallback.
- Better character animations: passing, shooting, dribbling, keeper dives, genuine celebrations and replay camera.
- Card flip, package tear, rare reveals, rewards tally, stat count-up, player bond stickers.
- Accessibility/low-motion/low-fx; mobile tap targets; short load performance.
- **Pass:** match outcome and pack feel satisfying in muted playback AND with sound; no button without feedback; animation never blocks progression.

## Phase 3 — COMPETITION AND PLAYER DEPTH

- 4 formations, 3 action chips, contextual Moments, bench substitutions, traits, forms/energy.
- Fictional stable opponent rosters, 8-club first division league, fixtures/ladder, records and playoff/promotion rules.
- Personal challenges, club journal, 3 rivalry arcs, early academy scouting.
- **Pass:** 10-match season can be completed, all points/statistics correct, opponent identities persist, tactics matter in large sims.

## Phase 4 — TRAINING, SCOUTING AND WORLD PERSONALITY

- 3 training minigames with accessible auto completion; focus specialisations, mentorship.
- Scouting options, pack collections and visible guarantee track; recruited cards have meaningful appearance/personality variety.
- Upgradeable stadium, training and scouting buildings with physically different art states and curated environmental animation.
- News/story events tied to match facts, Hall of Fame.
- **Pass:** the hub visibly changes, players gain authentic career stories, every screen has purposeful action and visual feedback.

## Phase 5 — BALANCE, COMPLETE GAME, RELEASE

- 4 league tiers; additional opponents/trait options; cups, seasonal awards and prestige cosmetics.
- Persistence migrations, save recovery, offline tests, PWA install guidance, accessibility audit.
- Scenario sim scripts and economy simulation; playtest first 30 min, first season and a simulated 100-match career; adjust pacing.
- Polish passes, browser compatibility, performance, production build, no placeholder assets/buttons, no broken edge states.
- **Pass:** full career functional on mobile after reload/offline, never loses a save, retains excitement beyond onboarding.

## Each phase must end with

1. Working preview URL / local dev command.
2. Checklist marked Done/Blocked/Deferred with exact file references.
3. Screenshot(s) or mobile browser review when available; actual interactions tested rather than visual-only claims.
4. Unit and end-to-end test result including regressions.
5. A short honest quality report: what feels genuinely good; what's generic; what's missing.
6. Request next milestone approval during collaboration; don't rewrite working features simply to move ahead.

---

# 16. ACCEPTANCE TESTS THAT MUST BE CODED

## Generation
- Same seed and generator version produces identical player fields/visual IDs.
- 10,000 generated players show expected approximate diversity; no forbidden offensive name combinations; realistic stat constraints and proper role matching.
- No duplicate UUIDs, no unbounded potential, no invalid skin/hair asset IDs.

## Squads
- Exactly 7 starters in 7 distinct formation slots; GK slot enforced; bench player never simultaneously starts.
- Drag and tap alternative both work on mobile; swapped cards always update team strength immediately.
- Substitution validates eligibility and updates actual sim personnel.

## Matches
- 90' match clock advances to termination; full-time awards exactly once.
- Same seed/lineups/commands yields same score and event sequence across replay.
- Pressing costs measurable stamina and changes decisions; tactical chip has no effect outside window.
- Ball never travels impossibly during active play; restart position and physics presentation consistent.
- At least 1,000-run stochastic balance tests; no impossibly extreme scoring across normal pairings unless allowed by model.

## Rewards / packs
- Hard refresh after clicking OPEN before reveal does not lose or multiply rewards.
- Two concurrent upgrade triggers don't double-charge or duplicate stats.
- Published rarity odds match tested sampling over 100,000 draws within statistical tolerance.
- Guarantee counter correctly saves and resets after qualifying pull.
- Offline saving works even when app is launched from home screen.

## Story
- A goal headline always points to a real goal scorer/event.
- “50th appearance” cannot trigger on appearance 49 or repeat at 51.
- Goalkeeper clean sheet awarded according to match participation rules.
- Recruits never change face across card and pitch representations.

## Accessibility / UX
- No critical action requires swipe, hold, vibration, sound, colour-only cues or speed reaction.
- Keyboard operation viable for menus; screen-reader names for controls; reduced-motion disables shakes and heavy effects.
- Phone orientation / dynamic island / home indicator don't obscure buttons.
- Saves survive refresh, app close/reopen and app update migration tests.

---

# 17. ART AND CONTENT PRODUCTION INSTRUCTIONS

Claude Code can produce attractive browser UI via CSS/SVG, but cannot guarantee brilliant illustration without a coherent art pipeline. Prioritise intentional authored 2D style:

1. Start with **a small professionally cohesive vector kit**: 6 face silhouettes, 12 hairstyles, 8 eyebrow expressions, 6 noses, 8 mouths, 6 accessories and three uniform cuts. Expand after seeing real variety. Design all parts to share anchor points and line weights.
2. Use generated JSON templates controlling permutations and silhouettes. Never choose every facial component independently without art compatibility constraints.
3. Stadium and hub require layered depth: foreground fence, midground buildings, background stands, functional silhouettes and shadow direction. Keep a consistent top-left light direction and coherent detail scale.
4. Icons should share corner radius, 2 px stroke ethos, consistent baseline and plate shadows. Football iconography: boot, whistle, badge, press arrow, scout glass, floodlight. Not a random icon library grab bag.
5. Animated cards must remain legible in their **static resting state**. Shine is occasional, not perpetual loading shimmer.
6. Rich designed empty states: no scout packs? The scout's desk shows empty envelopes and a “PLAY TO EARN” fixture ticket. Injured player? Club doctor pin with a concise recovery tip.
7. Avoid fake ads, stock phone screenshots and licence-dependent football brands/real players.
8. Package source assets and document generation rules; never rely on remote CDN at runtime for required art.

---

# 18. EXAMPLE 5-MATCH OPENING EXPERIENCE

**Match 1:** User recruits a low-rated but exciting forward, plays guided match, wins or loses narrowly, first attribute boost, rival introduced.

**Match 2:** Defender is the star; an earned story post recognises his crucial clearances. User chooses between fresh prospect scouting or better training equipment. Learns press fatigue.

**Match 3:** Long-awaited scout pack opens; pulls a higher-potential keeper, triggering a hard but fun squad selection rather than simply increasing numbers. Club stadium gains supporters.

**Match 4:** Derby against Copperton. Familiar rival captain has actual personality/traits. An underdog moment opens a pass-vs-shot choice. Result becomes journal highlight. Player earns first trait interaction combo.

**Match 5:** Training milestone allows one favourite to specialise. Facilities can receive first visually significant upgrade; league table shows promotion opportunity. Next opponent teased as a different tactical challenge.

No screen should feel like repeating “sim match -> number increases” five times. Each match in early onboarding introduces ONE new system after core mastery.

---

# 19. BALANCE SPREADSHEET / SIM REPORT REQUIREMENTS

Claude must create script-generated reports, even if it doesn't build a spreadsheet UI:
- Win rate by power gap and tactical preset over 1k+ simulated matches.
- Average goals/match, saves, possession, passes, turnovers, shot quality and fatigue.
- Coins earned/spent vs matches completed at 5/10/20/50 matches.
- Player OVR, levels and potential drift by 5/20/50/100 matches.
- Scout rarity outcomes and guarantee trigger frequency.
- Minutes spent in non-gameplay UI relative to match play; reduce friction when it becomes tedious.

Initial goals, not promises:
- A new player makes meaningful progress in their first 3 matches.
- First facility visual upgrade achievable within 3-5 matches.
- 90–150 sec match duration for ordinary play.
- 2-3 sessions to finish early division season for an engaged user.
- First month long-term goals include at least one realistic locally-generated football legend arc.

Tune these via human playtesting and automated balance experiments. Do not hard-code progression to hide imbalance.

---

# 20. PRODUCTION RISKS AND TRADEOFFS

| Risk | Mitigation |
|---|---|
| Scope explosion: manager sim + full playable football + gacha art | Commit to 7v7 and a single excellent playable loop before tiers/content |
| Visually generic browser UI | Design tokens, bespoke portrait kit, one quality-bar card, stadium scene, motion language |
| “Matches” are cosmetic dice rolls | Pure spatial sim + seeded replay + visible actual tactics effects + scenario tests |
| Generated players indistinguishable | Persistent face traits, archetypes, biography, match habits, scrapbook and celebrations |
| Economy becomes grindy | No energy timers, meaningful rewards on losses, coins not universal obstacle, balance reports |
| Save corruption | IndexedDB transactions, versioned saves, snapshots, import/export, refresh tests |
| Mobile performance | Lazy-loaded pitch, sprite pooling, reduced FX, standalone PWA, responsive input |
| Rarity undermines growth fantasy | Potential not power, low-tier legends stay competitive, milestone editions reward loyalty |
| Time-consuming UI animations | Skip/reveal-all, reduced-motion, never lock input past an animation's actual purpose |
| Browser closes mid-match | Persist match inputs/checkpoints and replay deterministically, award transaction once |

---

# 21. WHAT 'DONE' ACTUALLY MEANS

This is done when an unfamiliar person can open it on a phone with no instructions, open a card pack, distinguish two generated footballers, put one in their team, play a match with tactical agency, watch a satisfying goal/save sequence, receive rewards, make one meaningful upgrade choice, and reopen the browser to see the same players and club story. They should **want to play another match**, not merely think the menus look nice.

The visual art, input feedback, match action, progression, and personal narrative should all support that core outcome. Anything that does not serve it gets simplified or delayed.

---

# 22. CLAUDE CODE HANDOFF — READ NEXT

Read `CLAUDE.md` for operational behaviour, `IMPLEMENTATION_ROADMAP.md` for milestone tasks and acceptance, `START_HERE.md` for first terminal prompt. Start with Phase 0 and Phase 1; **do not** spend days populating league content before the first playable football match exists. Keep all work runnable and inspectable between milestones.

## Source/reference notes (technical verification, not copied content)

- Phaser — HTML5 2D game framework, browser and mobile rendering: https://docs.phaser.io/
- Dexie + React / IndexedDB pattern: https://dexie.org/docs/Tutorial/React
- Dexie TypeScript docs: https://dexie.org/docs/Typescript
- MDN PWA installability and iOS installation caveats: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- MDN PWA offline and service worker caching: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation

**Game-design examples, balancing numbers, names and timings in this document are original proposals for iteration, not claims about existing commercial products or established evidence-backed retention results.**
