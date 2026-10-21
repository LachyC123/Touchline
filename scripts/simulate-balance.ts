/**
 * Batch match simulations → reports/balance-latest.md (+ .json).
 * Usage: npm run simulate:balance -- [--n 1000]
 * Every scenario uses fixed seeds, so the report is reproducible for a given engine version.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createMatch, type CreateMatchArgs } from '../src/game/simulation/engine';
import * as C from '../src/game/simulation/constants';
import { resultOf } from '../src/game/simulation/replay';
import { possessionShare } from '../src/game/simulation/summary';
import type { MatchResult, TacticCommand, TeamLineup } from '../src/game/simulation/types';
import { makeTeam, mirrorOf } from '../src/test/fixtures/teams';

const nArg = process.argv.indexOf('--n');
const N = nArg > 0 ? Number(process.argv[nArg + 1]) : 1000;
if (!Number.isInteger(N) || N <= 0) throw new Error('--n must be a positive integer');

interface Agg {
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  shots: number;
  xg: number;
  xga: number;
  poss: number;
  passes: number;
  completion: number;
  tackles: number;
  turnoversLost: number;
  turnoversWon: number;
  fatigue: number;
  ticks: number;
}

const empty = (): Agg => ({ w: 0, d: 0, l: 0, gf: 0, ga: 0, shots: 0, xg: 0, xga: 0, poss: 0, passes: 0, completion: 0, tackles: 0, turnoversLost: 0, turnoversWon: 0, fatigue: 0, ticks: 0 });

/** Aggregate from the point of view of `focus` (which may play home or away). */
function add(agg: Agg, r: MatchResult, focus: 'home' | 'away', ticks: number) {
  const opp = focus === 'home' ? 'away' : 'home';
  const gf = r.score[focus];
  const ga = r.score[opp];
  if (gf > ga) agg.w++;
  else if (gf === ga) agg.d++;
  else agg.l++;
  agg.gf += gf;
  agg.ga += ga;
  agg.shots += r.stats.shots[focus];
  agg.xg += r.stats.xg[focus];
  agg.xga += r.stats.xg[opp];
  agg.poss += possessionShare(r.stats)[focus];
  agg.passes += r.stats.passes[focus];
  agg.completion += r.stats.passes[focus] ? r.stats.passesCompleted[focus] / r.stats.passes[focus] : 0;
  agg.tackles += r.stats.tacklesWon[focus];
  agg.turnoversLost += r.stats.turnovers[focus];
  agg.turnoversWon += r.stats.turnovers[opp];
  agg.fatigue += r.stats.fatigue[focus];
  agg.ticks += ticks;
}

function run(home: TeamLineup, away: TeamLineup, seed: string, policy?: { side: 'home' | 'away'; cmd: TacticCommand }): { r: MatchResult; ticks: number } {
  const args: CreateMatchArgs = { matchId: seed, seed, home, away, userSide: policy?.side ?? null };
  const e = createMatch(args);
  while (!e.isFinished()) {
    if (policy) e.dispatch(policy.cmd, policy.side);
    e.advanceTicks(1);
  }
  return { r: resultOf(e, args), ticks: e.tick };
}

function row(label: string, a: Agg, n: number): string {
  const pct = (x: number) => `${((x / n) * 100).toFixed(1)}%`;
  const avg = (x: number, dp = 2) => (x / n).toFixed(dp);
  return `| ${label} | ${pct(a.w)} | ${pct(a.d)} | ${pct(a.l)} | ${avg(a.gf)} | ${avg(a.ga)} | ${avg(a.shots, 1)} | ${avg(a.xg)} | ${avg(a.xga)} | ${avg(a.poss, 1)}% | ${avg(a.passes, 1)} | ${pct(a.completion)} | ${avg(a.tackles, 1)} | ${avg(a.turnoversWon, 1)} / ${avg(a.turnoversLost, 1)} | ${avg(a.fatigue)} |`;
}

const header =
  '| Scenario (focus team) | Win | Draw | Loss | GF | GA | Shots | xG | xGA | Poss | Passes | Pass % | Tackles won | Turnovers won / lost | End stamina |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';

/** Football incidents per match (both teams), from the mirror scenario's event logs. */
const incidents: Record<string, number> = {};
function tallyIncidents(r: MatchResult) {
  const inc = (k: string) => (incidents[k] = (incidents[k] ?? 0) + 1);
  const shots = new Map<number, string>();
  for (const e of r.events) {
    if (e.type === 'SHOT') {
      shots.set(e.id, e.style);
      inc(`Shots: ${e.style}`);
    }
    if (e.type === 'GOAL') inc(`Goals: ${shots.get(e.shotEventId) ?? '?'}`);
    if (e.type === 'SAVE') inc(e.double ? 'Saves: double save' : `Saves: ${e.style}`);
    if (e.type === 'FOUL') inc(e.award === 'penalty' ? 'Fouls: penalty awarded' : 'Fouls: free kick');
    if (e.type === 'FOUL' && e.booked) inc('Fouls: booking');
    if (e.type === 'SKILL') inc(`Skills: ${e.move}`);
    if (e.type === 'TACKLE') inc(`Tackles: ${e.style} ${e.won ? 'won' : 'lost'}`);
    if (e.type === 'PASS' && e.cross) inc(`Crosses: ${e.outcome}`);
    if (e.type === 'RESTART' && e.kind === 'corner') inc('Restarts: corner');
  }
}

const t0 = Date.now();
const sections: string[] = [];
const json: Record<string, Agg & { n: number }> = {};

function scenario(key: string, label: string, focusTeam: TeamLineup, oppTeam: TeamLineup, policy?: TacticCommand): string {
  const agg = empty();
  for (let i = 0; i < N; i++) {
    const focusHome = i % 2 === 0;
    const home = focusHome ? focusTeam : oppTeam;
    const away = focusHome ? oppTeam : focusTeam;
    const side = focusHome ? 'home' : 'away';
    const { r, ticks } = run(home, away, `${key}-${i}`, policy ? { side, cmd: policy } : undefined);
    add(agg, r, side, ticks);
    if (key === 'mirror') tallyIncidents(r);
  }
  json[key] = { ...agg, n: N };
  return row(label, agg, N);
}

// 1. Mirror match
const base = makeTeam('bal-base', 55);
const mirror = mirrorOf(base);
const mirrorRow = scenario('mirror', 'Mirror (55 vs same 55)', base, mirror);
const ticksPerMatch = json.mirror!.ticks / N;
sections.push(`## Equal teams\n\n${header}\n${mirrorRow}\n\nMean match length: ${ticksPerMatch.toFixed(0)} ticks = ${(ticksPerMatch / C.TICKS_PER_SECOND).toFixed(0)} s of football at 1× (plus goal/halftime presentation pauses).`);

// 2. Power gaps
const gapRows: string[] = [];
for (const gap of [4, 8, 12, 18]) {
  const strong = makeTeam(`bal-strong-${gap}`, 55 + gap / 2);
  const weak = makeTeam(`bal-weak-${gap}`, 55 - gap / 2);
  gapRows.push(scenario(`gap${gap}`, `Stronger by ${gap} OVR`, strong, weak));
}
sections.push(`## Power gaps (stronger team's view)\n\n${header}\n${gapRows.join('\n')}`);

// 3. Formation
const fortress = makeTeam('bal-321', 55, '3-2-1');
const balanced = makeTeam('bal-222', 55, '2-2-2');
sections.push(`## Formations\n\n${header}\n${scenario('f321', '3-2-1 Fortress vs 2-2-2', fortress, balanced)}\n${scenario('f222', '2-2-2 Balanced vs 2-2-2 (control)', balanced, mirrorOf(balanced))}`);

// 4. Tactics (always re-activated when allowed, vs a mirror that never uses chips)
sections.push(
  `## Tactics (chip re-used whenever ready)\n\n${header}\n${row('No chips (control)', json.mirror!, N)}\n${scenario('press', 'PRESS whenever ready', base, mirror, 'PRESS')}\n${scenario('quick', 'QUICK PASS whenever ready', base, mirror, 'QUICK_PASS')}`,
);

sections.push(
  `## Incidents per match (mirror scenario, both teams)\n\n| Incident | Per match |\n|---|---|\n${Object.entries(incidents)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `| ${k} | ${(v / N).toFixed(2)} |`)
    .join('\n')}`,
);

const secs = ((Date.now() - t0) / 1000).toFixed(1);
const md = `# TOUCHLINE! balance report

- Engine: \`${C.ENGINE_VERSION}\`
- Matches per scenario: ${N} (home/away alternated, fixed seeds)
- Generated in ${secs}s on ${new Date().toISOString().slice(0, 10)}
- Key constants: tactic ${C.TACTIC_DURATION_MIN}' active / ${C.TACTIC_COOLDOWN_MIN}' cooldown; ${C.TICKS_PER_MINUTE} ticks per minute; shot range ${C.DECISION.shootRange} units.

${sections.join('\n\n')}

## How to read this
- *Mirror* checks engine fairness: the same team against itself should split wins and losses evenly.
- *Power gaps* should show a clear, rising edge for the stronger team without guaranteed wins.
- *Tactics*: PRESS should raise tackles/turnovers won and lower end stamina; QUICK PASS should raise pass volume.
`;

mkdirSync('reports', { recursive: true });
writeFileSync('reports/balance-latest.md', md);
writeFileSync('reports/balance-latest.json', JSON.stringify({ engine: C.ENGINE_VERSION, n: N, scenarios: json, incidents: Object.fromEntries(Object.entries(incidents).map(([k, v]) => [k, v / N])) }, null, 2));
console.log(md);
