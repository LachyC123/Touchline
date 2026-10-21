import { CLUB_BY_ID } from '../../data/clubs';
import { buildTeamLineup } from '../../game/simulation/fromSquad';
import { ENGINE_VERSION } from '../../game/simulation/constants';
import type { CreateMatchArgs } from '../../game/simulation/engine';
import { possessionShare } from '../../game/simulation/summary';
import type { FootballEvent, LineupPlayer, MatchResult, TeamLineup, TeamSide } from '../../game/simulation/types';
import { DECK_MAX } from '../../game/simulation/cards';
import { cardsUnlockedAt, managerLevel } from '../club/manager';
import { advanceOnboarding, colourDistance, KIT_CLASH_DISTANCE } from '../club/onboarding';
import { fixtureFor, opponentLineup } from '../club/opponents';
import { grantPack, SCOUT_PACK_EVERY } from '../packs/packs';
import { lineupProblems } from '../club/lineup';
import { xpToNext } from '../players/progression';
import { FOCUS_OPTIONS } from '../players/upgrades';
import { seededUuid, stream } from '../rng';
import { MAX_MATCH_RECORDS, REPLAYS_KEPT, type ClubSave, type MatchMoment, type MatchRecord, type PendingMatch, type PlayerGain, type RewardLine } from '../save/types';

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
  const problems = lineupProblems(save.lineup, save.formationId, save.footballers, save.squadIds);
  if (problems.length) throw new Error(problems[0]);
  const fixture = fixtureFor(save.matchNumber);
  const mine = buildTeamLineup(
    { clubId: 'player-club', name: save.club.name, shortName: save.club.shortName, kit: { primary: save.club.kit.primary, secondary: save.club.kit.secondary, pattern: save.club.kit.pattern }, aiStyle: 'balanced', deck: [...save.deck] },
    save.formationId,
    save.lineup,
    save.footballers,
  );
  const theirs = opponentLineup(save.careerSeed, fixture).lineup;
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
  };
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

const MOMENT_PRIORITY: Record<MatchMoment['kind'], number> = { penalty: 9, penaltyMiss: 9, doubleSave: 8, screamer: 8, freeKick: 8, header: 6, woodwork: 5, save: 4, skill: 4, booking: 3 };

/**
 * The incidents worth remembering, each built from a logged event (never invented). Strong
 * attributes behind a moment are named, so a player's numbers visibly mean something.
 */
export function matchMoments(result: MatchResult, pending: Pick<PendingMatch, 'home' | 'away'>): MatchMoment[] {
  const players = new Map<string, { p: LineupPlayer; side: TeamSide }>();
  for (const p of pending.home.players) players.set(p.id, { p, side: 'home' });
  for (const p of pending.away.players) players.set(p.id, { p, side: 'away' });
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

/**
 * Applies a finished match to the career (on a draft inside the save transaction):
 * record, rewards, player stats/XP/level-ups, scrapbook entries and a fact-checked headline.
 */
export function settleMatch(draft: ClubSave, pending: PendingMatch, result: MatchResult): MatchRecord {
  const side = pending.userSide;
  const opp: TeamSide = side === 'home' ? 'away' : 'home';
  const mine = side === 'home' ? pending.home : pending.away;
  const theirs = side === 'home' ? pending.away : pending.home;
  const club = CLUB_BY_ID[pending.opponentId];
  const oppName = club?.name ?? theirs.name;
  const gf = result.score[side];
  const ga = result.score[opp];
  const won = gf > ga;
  const nameOf = (id: string) => [...pending.home.players, ...pending.away.players].find((p) => p.id === id)?.name ?? 'Unknown';
  const lines = new Map(result.players.map((l) => [l.playerId, l]));
  const season = draft.season;
  let order = draft.nextSeq;
  const history = (playerId: string, kind: 'debut' | 'firstGoal' | 'milestone', headline: string) => {
    const p = draft.footballers[playerId];
    if (!p) return;
    p.history.push({ id: seededUuid(`${draft.careerSeed}:history:${order}`), kind, season, order, headline });
    order++;
  };

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
  const recruitedIds = new Set(draft.packs.flatMap((p) => (p.playerId ? [p.playerId] : [])));
  for (const id of draft.squadIds) {
    const p = draft.footballers[id];
    if (!p) continue;
    const levelBefore = p.level;
    let xp: number;
    const line = lines.get(id);
    if (starters.has(id) && line) {
      const wasDebut = p.stats.matches === 0;
      const hadGoals = p.stats.goals;
      p.stats.matches++;
      p.stats.goals += line.goals;
      p.stats.assists += line.assists;
      const role = mine.players.find((x) => x.id === id)?.role;
      const cleanSheet = ga === 0 && (role === 'GK' || role === 'DEF');
      if (cleanSheet) p.stats.cleanSheets++;
      if (wasDebut) history(id, 'debut', `Made his debut against ${oppName}.`);
      if (hadGoals === 0 && line.goals > 0) {
        const g = myGoals.find((x) => x.scorerId === id);
        history(id, 'firstGoal', `First goal for the club${g ? ` (${g.minute}')` : ''} against ${oppName}.`);
      }
      if ([10, 25, 50, 100].includes(p.stats.matches)) history(id, 'milestone', `A TRUE CLUB PLAYER: ${p.stats.matches} appearances.`);
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
  draft.coins += rewards.coins;
  const levelBefore = managerLevel(draft.clubXp);
  draft.clubXp += rewards.clubXp;
  // Manager cards unlock with manager level; a new card joins the deck if there is room.
  const unlockedCards = managerLevel(draft.clubXp) > levelBefore ? cardsUnlockedAt(managerLevel(draft.clubXp)).filter((c) => !draft.cardsUnlocked.includes(c)) : [];
  for (const c of unlockedCards) {
    draft.cardsUnlocked.push(c);
    draft.newCards.push(c);
    if (draft.deck.length < DECK_MAX) draft.deck.push(c);
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
    scorers: goals.map((g) => ({ playerId: g.scorerId, name: nameOf(g.scorerId), side: g.team, minute: g.minute, tick: g.tick, ...(g.assistId ? { assistName: nameOf(g.assistId) } : {}) })),
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
    ...(unlockedCards.length ? { unlockedCards } : {}),
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
  return record;
}
