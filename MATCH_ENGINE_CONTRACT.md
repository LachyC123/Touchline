# TOUCHLINE! — football simulation and animation contract

## 1. Objective
A match must be an internally consistent, deterministic, continuous 7v7 football simulation with visible tactical differences. It must *look and behave* like players playing football rather than static stats selected by a random result generator. It doesn't have to replicate a broadcast simulation, but every scored goal must have a plausible build-up, shooter, defender/keeper reaction and logged event.

## 2. Scope and field
- Home and away: each 1 GK + 6 outfield.
- Normalised pitch coordinates: `x=0..100`, `y=0..150`. Attack directions fixed per half and flipped when changing ends.
- Ball has ground position, height for display arc, velocity, state and owner (nullable).
- Each outfielder has position, velocity, facing, stamina, possession state, role/zone, action cooldown, behaviour target and traits.
- Fixed simulation tick: start 10 updates/sec. Presentation interpolates between snapshot states at 30/60 FPS. Increase logical tick only if testing proves needed.
- Sim match clock advances in fixed increments to 90 minutes (additional stoppage time optional). 1x match designed for 90-150 real seconds overall. Pausing does not consume sim time.
- Deterministic PRNG seed and ordered match commands. Visual camera shake never consumes match RNG.

## 3. Core event unions (fully typed)

```ts
type TeamSide = 'home' | 'away';
type SimPos = { x: number; y: number };
type FootballEvent =
  | { type: 'KICKOFF'; minute: number; team: TeamSide }
  | { type: 'PASS'; minute: number; fromId: string; toId: string; start: SimPos; end: SimPos; interceptedBy?: string }
  | { type: 'DRIBBLE'; minute: number; playerId: string; from: SimPos; to: SimPos }
  | { type: 'TACKLE'; minute: number; challengerId: string; carrierId: string; won: boolean; at: SimPos }
  | { type: 'SHOT'; minute: number; shooterId: string; from: SimPos; target: SimPos; xg: number; outcome: 'goal'|'saved'|'blocked'|'wide'|'woodwork' }
  | { type: 'GOAL'; minute: number; scorerId: string; assistId?: string; team: TeamSide; shotEventId: string }
  | { type: 'SAVE'; minute: number; keeperId: string; shotEventId: string; at: SimPos }
  | { type: 'RESTART'; minute: number; kind: 'goalKick'|'corner'|'freeKick'|'kickoff'; team: TeamSide }
  | { type: 'TACTIC_APPLIED'; minute: number; team: TeamSide; command: string; expiresMinute: number }
  | { type: 'SUBSTITUTION'; minute: number; team: TeamSide; outId: string; inId: string }
  | { type: 'HALFTIME'; minute: number }
  | { type: 'FULLTIME'; minute: number; home: number; away: number };
```

Add eventId, engineVersion and snapshot references in concrete implementation. This union is a minimum; use typed geometry. Define rules for clock threshold, added time, retaken restarts and keeper possession.

## 4. Behaviour state tree

### Team-level tactical modes
- Keep shape out of possession.
- Press near ball with constrained number of challengers; cover passing lanes.
- Build from back when keeper/defender has possession.
- Combine in midfield; penetrate in final third.
- Counter after turnover with directional acceleration; recover to shape after chance ends.

### Player decisions
For each player at relevant ticks:
1. Determine role's desired anchor for ball and team phase.
2. Adjust around nearby team/opp players to avoid overlap and create triangles.
3. Evaluate action candidates only when physically valid.
4. Score decisions using attributes, tactic, trait, stamina, time and spatial context.
5. Pick with seeded weighted sampling; apply cooldown and animation-ready intent.
6. Re-evaluate target after turnovers, blocked lanes and passes.

**Possession:** Only one player has direct ownership at a time; control transfers on a successful reception/tackle/keeper collection. Ball trajectory is continuous during free travel. Passing cannot be instant teleport. Ball collision/arrival decides control in sim and renderer follows that decision.

**Shot:** Must originate with an attacking player in an appropriate region and generate shot event with keeper/defender responses, even when failed. xG or estimated quality shown only if calculated from location/angle/pressure/keeper/skills. High OVR doesn't turn a shot from own halfway line into near-certainty.

**Physicality:** No physics engine required for precise ball travel initially. Tackle timing, direction, challenge success and ball travel can be computed in fixed timestep with deterministic analytic geometry; animations follow faithfully. No FIFA-like football AI target as scope.

## 5. In-match tactical actions

| Command | Rule | Measurable behaviour |
|---|---|---|
| PRESS | Applies for 12 sim minutes, 18-minute cooldown | + defensive closing speed / challenge frequency; higher stamina drain; may leave counter gaps |
| QUICK PASS | 12-minute duration, cooldown | Higher short-pass preference, lower hold-ball time; poorer choices under high pressure |
| GO WIDE | 12-minute duration, cooldown | Wing support targets farther out, more crosses, midfield centre leaves some space |
| SUB | Max 3 in standard 7v7 match, paused or ball out of play | Actual out/in player swapped, stamina and role change reflected |
| SET FORMATION | Paused, can change only at allowed interval | New zone anchors and defensive shape; avoid free spam |
| MOMENT CHOICE | Contextual 1–3 times/match only | Next possession choice bias between valid options, not forced goal |

*All numbers above are first-pass tuning assumptions.* Sim must expose named constants to balance scripts; cooldowns should be based on sim clock, not wall time.

## 6. Formation anchors

Provide static normalised anchors for 2-2-2, 3-2-1, 2-3-1 and 1-3-2. Anchors shift by possession, attack direction and tactical width. Only GK uses keeper zone. Proximity goals: support spacing, reasonable defensive line, pass triangles, no bunching all six players on the ball. A soft repulsion term prevents card-stacked overlaps.

## 7. Animation mapping: nothing happens just for a highlight

| Event | Phaser depiction |
|---|---|
| PASS | Foot swing, ball travels source -> destination with purposeful z-arc and shadow |
| DRIBBLE | Player controls ball near boots; run cycle and small touches |
| TACKLE | Challenger leans/slides, contact spark or turf scuff, ball deflects if won |
| SHOT | Noticeable windup, strike, ball fast arc, shot trail; defending animations correlate |
| SAVE | Keeper dive reaches actual shot region; ball rebounds/held based on logged event |
| GOAL | Ball crosses line; net pulses; score updates; specific scorer celebrates |
| WIDE/POST | Ball visibly misses or hits frame before restart |
| SUB | Incoming card pops and corresponding sprite change is visible |
| TACTIC | Formation targets change with visible player movement / brief mini arrows |

Camera may crop the pitch, but keep ball and key player visible with predictable smoothness. Avoid sudden teleport except clearly signalled restart. Commentary is generated from event data and predicates, not free invention.

## 8. Pure engine API proposal

```ts
interface MatchEngine {
  advanceTicks(count: number): void;
  dispatch(command: MatchCommand): CommandResult;
  getSnapshot(): Readonly<MatchSnapshot>;
  getEventsSince(eventIndex: number): FootballEvent[];
  serialize(): MatchCheckpoint;
  isFinished(): boolean;
}

function createMatch(args: {
  matchId: string;
  seed: string;
  home: TeamLineup;
  away: TeamLineup;
  engineVersion: string;
}): MatchEngine;
```

Rendering layer consumes snapshots/events and sends commands; it cannot mutate the simulation's player positions directly. For performance, batch unimportant tick rendering but never skip the simulation event logic that affects results.

## 9. Shot/action probability examples (starting heuristics only)

- Pass candidate rating = combination of receiver openness, distance, passer passing/vision, press and stance.
- Pass completion drops with longer distance, poor weak foot and pressure, but no guaranteed interceptions.
- Dribble gains value in an unguarded lane and for agile dribblers, loses value when surrounded.
- Shot quality depends mostly on distance, shooting angle, blocking opponents, shooter finishing/composure and keeper skill/position.
- Goal probability clamped; never use 100% save or goal due to a trait.
- Defensive tactical focus reduces opponents' shot *quality* and shot *volume* via positioning, not by secretly downscaling every goal roll after shooting.
- Player fitness falls during sprints/pressing and affects acceleration; halftime gives a small documented recovery.

Calibrate from 1000-seed simulation distributions and review played matches. Absolute football realism is not required, but obvious contradictions are unacceptable.

## 10. Critical tests

1. Replaying identical seed + player attributes + command log produces identical score, events and snapshots at checkpoints.
2. Event scorer always belongs to actual team lineup and was near ball in shot snapshot.
3. Keeper saves resolve before goal event and cannot both record save and goal for same shot.
4. If a shot is blocked, ball hit geometry respects blocker relative position.
5. All matches terminate, with no eternal passing loops or endless negative clocks.
6. Tactical commands outside their valid windows are rejected without consuming a cooldown.
7. Substitutions prevent duplicate players on field and happen at permitted times.
8. Equal teams differ statistically only with seeded variance; high-skill forwards increase expected good chances.
9. Renderer is allowed to drop frames without mutating simulation final outcome.
10. Save/reload from a checkpoint with command log results in identical final score and one reward payout.

## 11. Prototype acceptance scenario

A generated striker with strong finishing but weak pace receives a through pass; with QUICK PASS active, midfielders release earlier. The ball travels, striker makes an off-ball run, defender closes, shot leaves striker's foot from a spatially valid location, keeper dives in the proper direction. If saved, ball rebounds or is held and no goal banner appears. If scored, actual shot event yields the correct player goal, club score, XP, commentary, replay and diary entry. Exact same seed and choices repeat the same sequence.

If any stage is fake, fix it before adding leagues or packs.
