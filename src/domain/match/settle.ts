import { buildTeamLineup, lineupAtFullTime, matchSquad } from '../../game/simulation/fromSquad';
import { ENGINE_VERSION, SUBS } from '../../game/simulation/constants';
import type { CreateMatchArgs } from '../../game/simulation/engine';
import { possessionShare } from '../../game/simulation/summary';
import type { FootballEvent, LineupPlayer, MatchResult, TeamLineup, TeamSide } from '../../game/simulation/types';
import { grantClubXp } from '../club/manager';
import { advanceOnboarding, colourDistance, KIT_CLASH_DISTANCE } from '../club/onboarding';
import { opponentLineup } from '../club/opponents';
import { simulateOtherFixtures, userLeagueResult, userFixture } from '../league/league';
import { clubOf } from '../world/world';
import { awardCupMedals } from '../league/honours';
import { catchUpCup, completeCupRound, cupHeadline, CUP_NAME, CUP_PRIZES, CUP_ROUNDS, cupRoundName, settleTie } from '../cup/cup';
import { penaltyShootout, type ShootoutResult } from '../cup/shootout';
import { grantPack, SCOUT_PACK_EVERY } from '../packs/packs';
import { lineupProblems } from '../club/lineup';
import { dressingRoomAfterMatch } from '../club/dressingRoom';
import { injuriesAfterMatch, unavailableFor } from '../players/injuries';
import { offersAfterMatch } from '../transfers/market';
import { objectivesFor, settleObjectives } from './objectives';
import { gateMoney, matchAttendance, REP_GAIN, repTier } from '../club/reputation';
import { dreamsAfterMatch } from '../players/dreams';
import { matchMilestones, type MilestoneKind } from '../players/milestones';
import { xpToNext } from '../players/progression';
import { overall } from '../players/rating';
import type { Footballer, HistoryEventKind } from '../players/types';
import { FOCUS_OPTIONS } from '../players/upgrades';
import { seededUuid, stream } from '../rng';
import { MAX_MATCH_RECORDS, PLAYER_CLUB_ID, REPLAYS_KEPT, type ClubSave, type MatchMoment, type MatchRecord, type PendingMatch, type PlayerGain, type RecordMilestone, type RewardLine } from '../save/types';

export const XP = { match: 40, win: 15, cleanSheet: 5, goal: 8, assist: 5, potm: 10, cap: 85, bench: 10, recruitDebut: 40 } as const;

type MatchKit = TeamLineup['kit'];
const CHANGE_KIT: MatchKit = { primary: '#F4F1EA', secondary: '#1B2235', pattern: 'plain' };

/** The away side changes kit when the shirts would be hard to tell apart on the pitch. */
export function resolveKitClash(home: MatchKit, away: MatchKit): MatchKit {
  if (colourDistance(home.primary, away.primary) >= KIT_CLASH_DISTANCE) return away;
  const swapped: MatchKit = { ...away, primary: away.secondary, secondary: away.primary };
  if (colourDistance(home.primary, swapped.primary) >= KIT_CLASH_DISTANCE) return swapped;
  return colourDistance(home.primary, CHANGE_KIT.primary) >= KIT_CLASH_DISTANCE ? CHANGE_KIT : { ...CHANGE_KIT, primary: '#1B2235', secondary: '#F4F1EA' };
}
export const COINS = { win: [110, 140], draw: [90, 110], loss: [65, 85], perGoal: 5, goalCap: 20 } as const;
export const CLUB_XP = { match: 30, win: 15, draw: 8 } as const;

/** Freeze both lineups and the seed at kick-off. Throws if the lineup is not valid. */
export function prepareMatch(save: ClubSave): PendingMatch {
  const problems = lineupProblems(save.lineup, save.formationId, save.footballers, save.squadIds, unavailableFor(save));
  if (problems.length) throw new Error(problems[0]);
  const fx = userFixture(save);
  if (!fx) throw new Error('The season is over — start the next one from the league table.');
  const fixture = { number: save.matchNumber, club: fx.club, lap: fx.lap, home: fx.home };
  const mine = buildTeamLineup(
    { clubId: PLAYER_CLUB_ID, name: save.club.name, shortName: save.club.shortName, kit: { primary: save.club.kit.primary, secondary: save.club.kit.secondary, pattern: save.club.kit.pattern }, aiStyle: 'balanced', deck: [...save.deck], ...(save.captainId ? { captainId: save.captainId } : {}), ...(save.penaltyTakerId ? { penaltyTakerId: save.penaltyTakerId } : {}) },
    save.formationId,
    save.lineup,
    save.footballers,
    benchFor(save),
  );
  const theirs = opponentLineup(save.careerSeed, fixture, save.world.departed).lineup;
  const number = save.matchNumber + 1;
  const home = fixture.home ? mine : theirs;
  const away = fixture.home ? theirs : mine;
  return {
    matchId: `m${number}`,
    number,
    seed: `${save.careerSeed}:match:${number}`,
    engineVersion: ENGINE_VERSION,
    opponentId: fixture.club.id,
    userSide: fixture.home ? 'home' : 'away',
    home,
    away: { ...away, kit: resolveKitClash(home.kit, away.kit) },
    commands: [],
    checkpointTick: 0,
    season: save.season,
    ...(fx.competition === 'cup' ? { competition: 'cup' as const, cupRound: fx.cupRound ?? 0 } : { round: fx.round }),
    objectives: objectivesFor(save),
  };
}

/** The substitutes for kick-off: everyone not starting, best first (up to the bench size). */
export function benchFor(save: Pick<ClubSave, 'squadIds' | 'lineup' | 'footballers' | 'dressingRoom' | 'matchNumber' | 'injuries'>): Footballer[] {
  const starting = new Set(Object.values(save.lineup));
  const away = unavailableFor(save);
  return save.squadIds
    .filter((id) => !starting.has(id) && !away.has(id))
    .flatMap((id) => (save.footballers[id] ? [save.footballers[id]] : []))
    .sort((a, b) => overall(b) - overall(a) || a.id.localeCompare(b.id))
    .slice(0, SUBS.bench);
}

export function matchArgs(p: PendingMatch): CreateMatchArgs {
  return { matchId: p.matchId, seed: p.seed, home: p.home, away: p.away, userSide: p.userSide };
}

function rangeInt(seed: string, [lo, hi]: readonly [number, number]): number {
  return stream(seed, 'reward').int(lo, hi);
}

export function computeRewards(result: MatchResult, side: TeamSide, careerSeed: string): { coins: number; clubXp: number; lines: RewardLine[] } {
  const opp: TeamSide = side === 'home' ? 'away' : 'home';
  const gf = result.score[side];
  const ga = result.score[opp];
  const outcome = gf > ga ? 'win' : gf === ga ? 'draw' : 'loss';
  const base = rangeInt(`${careerSeed}:reward:${result.matchId}`, COINS[outcome]);
  const goalBonus = Math.min(COINS.goalCap, gf * COINS.perGoal);
  const lines: RewardLine[] = [{ label: outcome === 'win' ? 'Win' : outcome === 'draw' ? 'Draw' : 'Match fee', coins: base }];
  if (goalBonus > 0) lines.push({ label: `Goals scored ×${gf}`, coins: goalBonus });
  return {
    coins: base + goalBonus,
    clubXp: CLUB_XP.match + (outcome === 'win' ? CLUB_XP.win : outcome === 'draw' ? CLUB_XP.draw : 0),
    lines,
  };
}

const MOMENT_PRIORITY: Record<MatchMoment['kind'], number> = { penalty: 9, penaltyMiss: 9, doubleSave: 8, screamer: 8, freeKick: 8, header: 6, woodwork: 5, sub: 4, save: 4, skill: 4, booking: 3 };

/**
 * The incidents worth remembering, each built from a logged event (never invented). Strong
 * attributes behind a moment are named, so a player's numbers visibly mean something.
 */
export function matchMoments(result: MatchResult, pending: Pick<PendingMatch, 'home' | 'away'>): MatchMoment[] {
  const players = new Map<string, { p: LineupPlayer; side: TeamSide }>();
  for (const p of [...pending.home.players, ...(pending.home.bench ?? [])]) players.set(p.id, { p, side: 'home' });
  for (const p of [...pending.away.players, ...(pending.away.bench ?? [])]) players.set(p.id, { p, side: 'away' });
  const name = (id: string) => players.get(id)?.p.name ?? 'Unknown';
  const sideOf = (id: string) => players.get(id)?.side ?? 'home';
  const stat = (id: string, label: string, key: 'dribbling' | 'shooting' | 'reflexes' | 'setPieces' | 'strength'): string | undefined => {
    const v = players.get(id)?.p.attributes[key];
    return v !== undefined && v >= 65 ? `${label} ${v}` : undefined;
  };
  const shots = new Map(result.events.flatMap((e) => (e.type === 'SHOT' ? [[e.id, e] as const] : [])));
  const out: MatchMoment[] = [];
  const push = (m: MatchMoment) => out.push(m.stat === undefined ? (({ stat: _s, ...rest }) => rest)(m) : m);
  for (const e of result.events) {
    if (e.type === 'GOAL') {
      const shot = shots.get(e.shotEventId);
      const who = name(e.scorerId);
      if (shot?.style === 'long') push({ minute: e.minute, side: e.team, kind: 'screamer', text: `${who} scores a screamer from distance`, stat: stat(e.scorerId, 'SHO', 'shooting') });
      else if (shot?.style === 'freeKick') push({ minute: e.minute, side: e.team, kind: 'freeKick', text: `${who} curls in a direct free kick`, stat: stat(e.scorerId, 'SET', 'setPieces') });
      else if (shot?.style === 'header') push({ minute: e.minute, side: e.team, kind: 'header', text: `${who} heads home`, stat: stat(e.scorerId, 'STR', 'strength') });
      else if (shot?.style === 'penalty') push({ minute: e.minute, side: e.team, kind: 'penalty', text: `${who} scores the penalty` });
    } else if (e.type === 'SHOT' && e.style === 'penalty' && e.outcome !== 'goal') {
      push({ minute: e.minute, side: e.team, kind: 'penaltyMiss', text: e.outcome === 'saved' ? `Penalty saved! ${name(e.shooterId)} is denied` : `${name(e.shooterId)} misses a penalty` });
    } else if (e.type === 'SHOT' && e.outcome === 'woodwork') {
      push({ minute: e.minute, side: e.team, kind: 'woodwork', text: `${name(e.shooterId)} hits the woodwork` });
    } else if (e.type === 'SAVE' && (e.double || e.style === 'dive' || e.style === 'fingertip')) {
      const s = sideOf(e.keeperId);
      push({ minute: e.minute, side: s, kind: e.double ? 'doubleSave' : 'save', text: e.double ? `Double save from ${name(e.keeperId)}` : `${e.style === 'fingertip' ? 'Fingertip' : 'Diving'} save by ${name(e.keeperId)}`, stat: stat(e.keeperId, 'REF', 'reflexes') });
    } else if (e.type === 'SKILL') {
      const label = { stepover: 'stepover', nutmeg: 'nutmeg', roulette: 'roulette', flick: 'rainbow flick', dragBack: 'drag-back' }[e.move];
      push({ minute: e.minute, side: sideOf(e.playerId), kind: 'skill', text: `${name(e.playerId)}'s ${label} beats ${name(e.beatenId)}`, stat: stat(e.playerId, 'DRI', 'dribbling') });
    } else if (e.type === 'SUB') {
      push({ minute: e.minute, side: e.team, kind: 'sub', text: `${name(e.inId)} on for ${name(e.outId)}` });
    } else if (e.type === 'FOUL' && e.booked) {
      push({ minute: e.minute, side: e.team, kind: 'booking', text: `${name(e.foulerId)} is booked` });
    }
  }
  // Keep the eight that matter most, shown in match order.
  return out
    .map((m, i) => ({ m, i }))
    .sort((a, b) => MOMENT_PRIORITY[b.m.kind] - MOMENT_PRIORITY[a.m.kind] || a.i - b.i)
    .slice(0, 8)
    .sort((a, b) => a.i - b.i)
    .map(({ m }) => m);
}

function scoreTimeline(events: readonly FootballEvent[]): { home: number; away: number }[] {
  const out = [{ home: 0, away: 0 }];
  for (const e of events) {
    if (e.type === 'GOAL') {
      const last = out[out.length - 1] as { home: number; away: number };
      out.push({ ...last, [e.team]: last[e.team] + 1 });
    }
  }
  return out;
}

const HISTORY_KIND: Record<MilestoneKind, HistoryEventKind> = {
  debut: 'debut',
  firstGoal: 'firstGoal',
  hatTrick: 'hatTrick',
  goals: 'milestone',
  assists: 'milestone',
  apps: 'milestone',
  firstCleanSheet: 'milestone',
  cleanSheets: 'milestone',
};

/**
 * Applies a finished match to the career (on a draft inside the save transaction):
 * record, rewards, player stats/XP/level-ups, scrapbook entries and a fact-checked headline.
 */
export function settleMatch(draft: ClubSave, pending: PendingMatch, result: MatchResult): MatchRecord {
  const side = pending.userSide;
  const opp: TeamSide = side === 'home' ? 'away' : 'home';
  const mine = side === 'home' ? pending.home : pending.away;
  const theirs = side === 'home' ? pending.away : pending.home;
  const club = clubOf(draft.world, pending.opponentId);
  const oppName = club?.name ?? theirs.name;
  const gf = result.score[side];
  const ga = result.score[opp];
  const won = gf > ga;
  const nameOf = (id: string) => [...matchSquad(pending.home), ...matchSquad(pending.away)].find((p) => p.id === id)?.name ?? 'Unknown';
  const lines = new Map(result.players.map((l) => [l.playerId, l]));
  const season = draft.season;
  let order = draft.nextSeq;
  const history = (playerId: string, kind: HistoryEventKind, headline: string) => {
    const p = draft.footballers[playerId];
    if (!p) return;
    p.history.push({ id: seededUuid(`${draft.careerSeed}:history:${order}`), kind, season, order, headline });
    order++;
  };
  const milestones: RecordMilestone[] = [];

  // Headline candidates are evaluated against real facts (order = priority).
  const goals = result.events.filter((e): e is Extract<FootballEvent, { type: 'GOAL' }> => e.type === 'GOAL');
  const myGoals = goals.filter((g) => g.team === side);
  const firstTimers = myGoals.filter((g) => (draft.footballers[g.scorerId]?.stats.goals ?? 1) === 0);
  const timeline = scoreTimeline(result.events);
  const trailedBy2 = timeline.some((s) => s[opp] - s[side] >= 2);
  const lateWinner = won && myGoals.length > 0 && (myGoals.at(-1) as (typeof myGoals)[number]).minute >= 85 && gf - ga === 1 ? myGoals.at(-1) : undefined;
  const keeper = mine.players.find((p) => p.role === 'GK');
  const keeperSaves = keeper ? (lines.get(keeper.id)?.saves ?? 0) : 0;
  let storyHeadline: string;
  if (lateWinner) storyHeadline = `WON IT LATE: ${nameOf(lateWinner.scorerId).toUpperCase()} STRIKES IN THE ${lateWinner.minute}TH.`;
  else if (trailedBy2 && gf >= ga) storyHeadline = `THE COMEBACK: TWO GOALS DOWN AGAINST ${oppName.toUpperCase()}, ONE TO REMEMBER.`;
  else if (firstTimers.length > 0) storyHeadline = `OFF THE MARK: ${nameOf((firstTimers[0] as (typeof firstTimers)[number]).scorerId).toUpperCase()} SCORES HIS FIRST FOR THE CLUB.`;
  else if (keeper && keeperSaves >= 3 && gf >= ga) storyHeadline = `THE WALL: ${keeper.shortName.toUpperCase()} DENIES ${keeperSaves} ON TARGET.`;
  else if (ga === 0) {
    const bestDef = mine.players.filter((p) => p.role === 'DEF').sort((a, b) => (lines.get(b.id)?.rating ?? 0) - (lines.get(a.id)?.rating ?? 0))[0];
    storyHeadline = bestDef ? `THE CLEAN SHEET CLUB: ${bestDef.shortName.toUpperCase()} LED THE LINE.` : `A CLEAN SHEET AGAINST ${oppName.toUpperCase()}.`;
  } else if (!won && club?.rival) storyHeadline = `NO EASY DAYS: ${oppName.toUpperCase()} PUT US TO THE TEST.`;
  else if (won) storyHeadline = `${draft.club.name.toUpperCase()} ${gf}–${ga} ${oppName.toUpperCase()}: ${nameOf(result.playerOfMatchId).toUpperCase()} STARS.`;
  else if (gf === ga) storyHeadline = `HONOURS EVEN AT ${gf}–${ga} WITH ${oppName.toUpperCase()}.`;
  else storyHeadline = `A TOUGH DAY: ${oppName.toUpperCase()} WIN ${ga}–${gf}.`;

  // Player stats, scrapbook, XP.
  const gains: PlayerGain[] = [];
  const starters = new Set(mine.players.map((p) => p.id));
  // Substitutes who came on play in the role of the man they replaced.
  const subRole = new Map<string, LineupPlayer['role']>();
  for (const e of result.events) {
    if (e.type === 'SUB' && e.team === side) {
      const role = mine.players.find((x) => x.id === e.outId)?.role ?? subRole.get(e.outId);
      if (role) subRole.set(e.inId, role);
    }
  }
  const recruitedIds = new Set(draft.packs.flatMap((p) => (p.playerId ? [p.playerId] : [])));
  for (const id of draft.squadIds) {
    const p = draft.footballers[id];
    if (!p) continue;
    const levelBefore = p.level;
    let xp: number;
    const line = lines.get(id);
    if ((starters.has(id) || subRole.has(id)) && line) {
      const wasDebut = p.stats.matches === 0;
      const statsBefore = { ...p.stats };
      p.stats.matches++;
      p.stats.goals += line.goals;
      p.stats.assists += line.assists;
      const role = mine.players.find((x) => x.id === id)?.role ?? subRole.get(id);
      const cleanSheet = ga === 0 && (role === 'GK' || role === 'DEF');
      if (cleanSheet) p.stats.cleanSheets++;
      const firstGoal = myGoals.find((x) => x.scorerId === id);
      for (const m of matchMilestones(statsBefore, p.stats, { goals: line.goals, opponent: oppName, keeper: role === 'GK', ...(firstGoal ? { firstGoalMinute: firstGoal.minute } : {}) })) {
        history(id, HISTORY_KIND[m.kind], m.headline);
        if (m.kind !== 'debut') milestones.push({ playerId: id, name: `${p.firstName} ${p.lastName}`, kind: m.kind, text: m.headline });
      }
      xp = XP.match + (won ? XP.win : 0) + (cleanSheet ? XP.cleanSheet : 0) + line.goals * XP.goal + line.assists * XP.assist + (result.playerOfMatchId === id ? XP.potm : 0);
      xp = Math.min(XP.cap, xp);
      // A scouted recruit's debut is worth a level: their first match always ends in a training choice.
      if (wasDebut && recruitedIds.has(id)) xp += XP.recruitDebut;
    } else {
      xp = XP.bench;
    }
    p.xp += xp;
    while (p.xp >= xpToNext(p.level) && p.level < 99) {
      p.xp -= xpToNext(p.level);
      p.level++;
      draft.pendingUpgrades.push({ playerId: id, level: p.level, options: [...FOCUS_OPTIONS[p.primaryPosition]] });
    }
    gains.push({ playerId: id, xp, levelBefore, levelAfter: p.level, ...(line ? { rating: line.rating } : {}) });
  }
  draft.nextSeq = order;

  const rewards = computeRewards(result, side, draft.careerSeed);
  for (const g of gains) {
    const p = draft.footballers[g.playerId];
    if (p && recruitedIds.has(g.playerId) && p.stats.matches === 1 && starters.has(g.playerId)) {
      rewards.lines.push({ label: `${p.lastName}’s debut: +${XP.recruitDebut} XP`, coins: 0 });
    }
  }
  // Cup: penalties if level, our tie, the rest of the round, the next draw; prize money for progress.
  const isCup = pending.competition === 'cup';
  let shootout: ShootoutResult | null = null;
  if (isCup) {
    if (gf === ga) shootout = penaltyShootout(pending.seed, lineupAtFullTime(pending.home, 'home', result.events), lineupAtFullTime(pending.away, 'away', result.events));
    const k = pending.cupRound ?? -1;
    const tie = draft.cup?.rounds[k]?.find((t) => t.home === PLAYER_CLUB_ID || t.away === PLAYER_CLUB_ID);
    if (draft.cup && pending.season === draft.season && k === draft.cup.round && tie && !tie.winner) {
      const settled = settleTie(tie, result, pending.home, pending.away, shootout);
      completeCupRound(draft, settled);
      const through = settled.winner === PLAYER_CLUB_ID;
      if (through && k < CUP_ROUNDS.length - 1) rewards.lines.push({ label: `Into the ${cupRoundName(k + 1).toLowerCase()}`, coins: CUP_PRIZES.progress[k] ?? 0 });
      if (through && k === CUP_ROUNDS.length - 1) {
        rewards.lines.push({ label: `${CUP_NAME} winners`, coins: CUP_PRIZES.winner });
        rewards.clubXp += CUP_PRIZES.winnerClubXp;
        awardCupMedals(draft, [...starters]);
      }
      rewards.coins = rewards.lines.reduce((sum, l) => sum + l.coins, 0);
      storyHeadline = cupHeadline(draft.world, settled, k, draft.club.name, oppName, shootout, side, draft.league.division) ?? storyHeadline;
    }
  }
  // A home crowd pays at the gate; reputation grows with results.
  const fans = matchAttendance(draft, pending);
  if (fans > 0) {
    rewards.lines.push({ label: `Gate receipts (${fans.toLocaleString('en-GB')} fans)`, coins: gateMoney(fans) });
    rewards.coins = rewards.lines.reduce((sum, l) => sum + l.coins, 0);
  }
  // Objectives: judged from the recorded events, paid in stars.
  const obj = pending.objectives?.length ? settleObjectives(pending.objectives, result.events, side) : null;
  if (obj) {
    rewards.lines.push({ label: `Objectives ${'★'.repeat(obj.stars)}${'☆'.repeat(obj.results.length - obj.stars)}`, coins: obj.coins });
    rewards.coins = rewards.lines.reduce((sum, l) => sum + l.coins, 0);
  }
  const cupTie = isCup ? draft.cup?.rounds[pending.cupRound ?? -1]?.find((t) => t.home === PLAYER_CLUB_ID || t.away === PLAYER_CLUB_ID) : undefined;
  const repGain =
    (won ? REP_GAIN.win : gf === ga ? REP_GAIN.draw : 0) +
    (cupTie?.winner === PLAYER_CLUB_ID ? REP_GAIN.cupTieWon + (pending.cupRound === CUP_ROUNDS.length - 1 ? REP_GAIN.cupWon : 0) : 0);
  const tierBefore = repTier(draft.club.reputation).id;
  draft.club.reputation += repGain;
  const tierAfter = repTier(draft.club.reputation).id;
  draft.coins += rewards.coins;
  const unlockedCards = grantClubXp(draft, rewards.clubXp);

  // League: our result, the rest of the round (same engine, AI benches), then the next round.
  const leagueRound = pending.round ?? draft.league.round;
  if (!isCup && pending.season === draft.season && leagueRound === draft.league.round && draft.league.rounds[leagueRound]) {
    const names = new Map([...matchSquad(pending.home), ...matchSquad(pending.away)].map((p) => [p.id, p.name] as const));
    const homeId = side === 'home' ? PLAYER_CLUB_ID : pending.opponentId;
    const awayId = side === 'home' ? pending.opponentId : PLAYER_CLUB_ID;
    draft.league.results.push(userLeagueResult(leagueRound, homeId, awayId, result, names));
    draft.league.results.push(...simulateOtherFixtures(draft.careerSeed, draft.world, draft.season, draft.league, leagueRound));
    draft.league.round++;
    // Cup rounds we are no longer in are played as the league reaches them.
    catchUpCup(draft);
  }

  const pair = <T,>(h: T, a: T) => ({ home: h, away: a });
  const potmLine = lines.get(result.playerOfMatchId);
  const record: MatchRecord = {
    matchId: pending.matchId,
    number: pending.number,
    seed: pending.seed,
    engineVersion: pending.engineVersion,
    opponentId: pending.opponentId,
    opponentName: oppName,
    userSide: side,
    score: { ...result.score },
    scorers: goals.map((g) => ({ playerId: g.scorerId, name: nameOf(g.scorerId), side: g.team, minute: g.minute, tick: g.tick, ...(g.assistId ? { assistName: nameOf(g.assistId), assistId: g.assistId } : {}) })),
    playerOfMatchId: result.playerOfMatchId,
    playerOfMatchName: nameOf(result.playerOfMatchId),
    playerOfMatchRating: potmLine?.rating ?? 6,
    stats: {
      possession: possessionShare(result.stats),
      shots: pair(result.stats.shots.home, result.stats.shots.away),
      onTarget: pair(result.stats.onTarget.home, result.stats.onTarget.away),
      xg: pair(Math.round(result.stats.xg.home * 100) / 100, Math.round(result.stats.xg.away * 100) / 100),
      saves: pair(result.stats.saves.home, result.stats.saves.away),
      passes: pair(result.stats.passes.home, result.stats.passes.away),
    },
    commands: [...result.commands],
    rewards,
    gains,
    storyHeadline,
    moments: matchMoments(result, pending),
    ...(milestones.length ? { milestones } : {}),
    ...(fans > 0 ? { attendance: fans } : {}),
    ...(repGain > 0 ? { repGain } : {}),
    ...(tierAfter !== tierBefore ? { repTier: tierAfter } : {}),
    ...(obj ? { objectives: obj.results } : {}),
    ...(unlockedCards.length ? { unlockedCards } : {}),
    ...(pending.season !== undefined ? { season: pending.season } : {}),
    ...(pending.round !== undefined && !isCup ? { round: pending.round } : {}),
    ...(isCup ? { competition: 'cup' as const, cupRound: pending.cupRound ?? 0, ...(shootout ? { shootout } : {}) } : {}),
    ...(pending.number % SCOUT_PACK_EVERY === 0 ? { packId: grantPack(draft, 'local-scout', `match:${pending.matchId}`).id } : {}),
    replay: { home: pending.home, away: pending.away },
  };
  draft.matchRecords = [record, ...draft.matchRecords].slice(0, MAX_MATCH_RECORDS).map((r, i) => {
    if (i < REPLAYS_KEPT || !r.replay) return r;
    const { replay: _drop, ...rest } = r;
    return rest;
  });
  draft.matchNumber = pending.number;
  draft.pendingMatch = null;
  draft.onboarding = advanceOnboarding(draft.onboarding, 'firstMatchSettled');

  // The dressing room reacts: morale, promises, and perhaps a knock on the door.
  const goalsBy = new Map<string, number>();
  for (const g of myGoals) goalsBy.set(g.scorerId, (goalsBy.get(g.scorerId) ?? 0) + 1);
  const outcome = gf > ga ? 'win' : gf === ga ? 'draw' : 'loss';
  const swings = dressingRoomAfterMatch(draft, { started: starters, cameOn: new Set(subRole.keys()), goals: goalsBy, potmId: result.playerOfMatchId, result: outcome });
  const morale = swings.slice(0, 6).map((c) => ({ ...c, name: draft.footballers[c.playerId] ? `${draft.footballers[c.playerId]!.firstName} ${draft.footballers[c.playerId]!.lastName}` : nameOf(c.playerId) }));
  // Dreams: did this match make anyone's come true?
  const dreams = dreamsAfterMatch(draft, {
    side,
    events: result.events,
    started: starters,
    played: new Set([...starters, ...subRole.keys()]),
    cupFinal: isCup && pending.cupRound === CUP_ROUNDS.length - 1,
    rival: Boolean(club?.rival),
    won,
  });
  // Knocks taken on the pitch: did anyone pick up an injury?
  const hurt = injuriesAfterMatch(draft, { matchId: pending.matchId, number: pending.number, side, events: result.events, played: new Set([...starters, ...subRole.keys()]), nameOf });
  const injuries = hurt.map((i) => ({ playerId: i.playerId, name: nameOf(i.playerId), kind: i.kind, minute: i.minute, byName: i.byName, outFor: i.outFor }));
  // The market moves: bids for listed players, interest in stars.
  offersAfterMatch(draft);
  const withMorale: MatchRecord = { ...record, ...(morale.length ? { morale } : {}), ...(dreams.length ? { dreams } : {}), ...(injuries.length ? { injuries } : {}) };
  draft.matchRecords[0] = withMorale;
  return withMorale;
}
