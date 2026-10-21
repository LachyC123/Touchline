import { PERSONALITY_BY_ID } from '../../data/personality';
import { scoringRuns } from '../league/stories';
import { clampMorale, matchMoraleDelta, type MoraleChange } from '../players/morale';
import { xpToNext } from '../players/progression';
import type { Footballer } from '../players/types';
import { FOCUS_OPTIONS } from '../players/upgrades';
import { seededUuid, stream } from '../rng';
import type { ClubEvent, ClubSave, DressingRoom, EventKind, MatchRecord } from '../save/types';

/**
 * The dressing room: players with moods, requests that need an answer, and promises that are
 * remembered. Everything is decided from stored facts (match records, personality, morale) and
 * a seeded stream, so the same career always produces the same dressing room.
 */

/** Matches between one request and the next. */
export const EVENT_GAP = 2;
export const COSTS = { familyVisit: 80, nightOut: 120 } as const;
const MAX_EVENTS = 40;

export function emptyDressingRoom(): DressingRoom {
  return { events: [], promises: [], away: [], lastEventMatch: 0 };
}

/** Players who cannot be picked for the next match (and why). */
export function awayFor(save: Pick<ClubSave, 'dressingRoom' | 'matchNumber'>): Map<string, string> {
  const next = save.matchNumber + 1;
  return new Map(save.dressingRoom.away.filter((a) => a.untilMatch >= next).map((a) => [a.playerId, a.reason]));
}

export function openEvent(save: Pick<ClubSave, 'dressingRoom'>): ClubEvent | undefined {
  return save.dressingRoom.events.find((e) => e.status === 'open');
}

// ── Copy ───────────────────────────────────────────────────────────────────────────────────

export function eventHeadline(e: Pick<ClubEvent, 'kind'>, p?: Footballer): string {
  const who = p?.lastName ?? 'A player';
  switch (e.kind) {
    case 'playingTime':
      return `${who} wants more minutes`;
    case 'homesick':
      return `${who} is homesick`;
    case 'flatSquad':
      return 'The dressing room is flat';
    case 'interview':
      return `The Post wants ${who}`;
    case 'promiseKept':
      return `You kept your word to ${who}`;
    case 'promiseBroken':
      return `${who} feels let down`;
  }
}

/** What he says when he knocks on the door, in his own voice. */
export function eventQuote(e: Pick<ClubEvent, 'kind'>, p?: Footballer, extra?: { goals?: number; games?: number }): string {
  const type = p?.personality.type;
  switch (e.kind) {
    case 'playingTime':
      if (type === 'ambitious') return 'Boss, I didn’t come here to watch. I want to play — and soon.';
      if (type === 'anxious') return 'I don’t know what I’m doing wrong. Can I just get a chance?';
      if (type === 'laidBack' || type === 'joker') return 'No stress, gaffer, but my boots are getting dusty. Any chance of a run-out?';
      if (type === 'hotHeaded') return 'Three games on the bench. Three! What do I have to do?';
      return 'I’ve sat out three games now. I’m ready — give me a chance.';
    case 'homesick':
      return `I miss ${p?.hometown ?? 'home'}. My family, my mates… it’s harder than I thought it would be.`;
    case 'flatSquad':
      return 'Three defeats on the bounce. Heads are down and nobody’s put the music on in the changing room.';
    case 'interview':
      return `${extra?.goals ?? 3} goals in ${extra?.games ?? 3} games. The Touchline Post wants him on the front page.`;
    case 'promiseKept':
    case 'promiseBroken':
      return '';
  }
}

export interface ChoiceDef {
  id: string;
  label: string;
  hint: string;
  /** Set when the choice cannot be taken right now. */
  disabled?: string;
}

export function choicesFor(e: Pick<ClubEvent, 'kind'>, save: Pick<ClubSave, 'coins'>, p?: Footballer): ChoiceDef[] {
  const label = p ? PERSONALITY_BY_ID[p.personality.type].label.toLowerCase() : '';
  switch (e.kind) {
    case 'playingTime':
      return [
        { id: 'promise', label: 'Promise him a start in the next two matches', hint: '+5 now. Keep it: +15. Break it: −20, and the rest of the bench notices.' },
        { id: 'earnIt', label: 'Tell him to earn it in training', hint: `A professional knuckles down and improves; anyone else sulks. He’s ${label}.` },
        { id: 'squadRole', label: 'Be honest: he’s a squad player for now', hint: 'A loyal player respects it. An ambitious one won’t.' },
      ];
    case 'homesick':
      return [
        { id: 'daysOff', label: 'Give him a few days at home', hint: '+18 morale, but he misses the next match.' },
        { id: 'familyVisit', label: `Fly his family over (${COSTS.familyVisit} coins)`, hint: '+10 morale and he stays available.', ...(save.coins < COSTS.familyVisit ? { disabled: `Needs ${COSTS.familyVisit} coins` } : {}) },
        { id: 'keepHim', label: 'Keep him focused on football', hint: '−8 morale. He’s available, but is his head?' },
      ];
    case 'flatSquad':
      return [
        { id: 'nightOut', label: `Team night out (${COSTS.nightOut} coins)`, hint: '+8 morale for the whole squad.', ...(save.coins < COSTS.nightOut ? { disabled: `Needs ${COSTS.nightOut} coins` } : {}) },
        { id: 'toughLove', label: 'Hairdryer treatment', hint: 'The professionals respond (+6). The rest take it badly (−5).' },
        { id: 'clearAir', label: 'Clear-the-air meeting', hint: '+3 morale for everyone. Steady, not spectacular.' },
      ];
    case 'interview':
      return [
        { id: 'doIt', label: 'Let him do the interview', hint: '+10 morale, and the paper pays the club 40 coins.' },
        { id: 'grounded', label: 'Keep him grounded', hint: '−3 morale, but he puts in extra work: +30 XP.' },
      ];
    case 'promiseKept':
    case 'promiseBroken':
      return [];
  }
}

// ── Effects ────────────────────────────────────────────────────────────────────────────────

function nudge(draft: ClubSave, playerId: string, delta: number): number {
  const p = draft.footballers[playerId];
  if (!p) return 0;
  const before = p.morale;
  p.morale = clampMorale(p.morale + delta);
  return p.morale - before;
}

function grantXp(draft: ClubSave, playerId: string, xp: number): void {
  const p = draft.footballers[playerId];
  if (!p) return;
  p.xp += xp;
  while (p.xp >= xpToNext(p.level) && p.level < 99) {
    p.xp -= xpToNext(p.level);
    p.level++;
    draft.pendingUpgrades.push({ playerId, level: p.level, options: [...FOCUS_OPTIONS[p.primaryPosition]] });
  }
}

function scrapbook(draft: ClubSave, playerId: string, headline: string): void {
  const p = draft.footballers[playerId];
  if (!p) return;
  p.history.push({ id: seededUuid(`${draft.careerSeed}:history:${draft.nextSeq}`), kind: 'milestone', season: draft.season, order: draft.nextSeq, headline });
  draft.nextSeq++;
}

function newEvent(draft: ClubSave, kind: EventKind, status: ClubEvent['status'], playerId?: string, outcome?: string): ClubEvent {
  const e: ClubEvent = { id: seededUuid(`${draft.careerSeed}:event:${draft.nextSeq}`), kind, atMatch: draft.matchNumber, status, ...(playerId ? { playerId } : {}), ...(outcome ? { outcome } : {}) };
  draft.nextSeq++;
  draft.dressingRoom.events = [e, ...draft.dressingRoom.events].slice(0, MAX_EVENTS);
  return e;
}

/**
 * Applies a choice on a save draft (inside the save transaction) and returns what happened.
 * Throws for an event that is not open or a choice that is not available.
 */
export function applyChoice(draft: ClubSave, eventId: string, choiceId: string): string {
  const e = draft.dressingRoom.events.find((x) => x.id === eventId);
  if (!e || e.status !== 'open') throw new Error('That has already been dealt with.');
  const p = e.playerId ? draft.footballers[e.playerId] : undefined;
  const choice = choicesFor(e, draft, p).find((c) => c.id === choiceId);
  if (!choice) throw new Error('Unknown choice.');
  if (choice.disabled) throw new Error(choice.disabled);
  const name = p?.lastName ?? '';
  const squad = draft.squadIds.filter((id) => draft.footballers[id]);
  let outcome: string;
  switch (`${e.kind}:${choiceId}`) {
    case 'playingTime:promise': {
      nudge(draft, p!.id, 5);
      draft.dressingRoom.promises.push({ id: e.id, playerId: p!.id, starts: 1, got: 0, byMatch: draft.matchNumber + 2 });
      outcome = `${name} leaves smiling. He starts one of the next two — or he’ll remember.`;
      break;
    }
    case 'playingTime:earnIt': {
      if (p!.personality.professionalism >= 60) {
        nudge(draft, p!.id, -2);
        grantXp(draft, p!.id, 40);
        outcome = `${name} is first out on the training pitch every morning (+40 XP).`;
      } else {
        const d = nudge(draft, p!.id, -10);
        outcome = `${name} sulks. The kit man says he’s barely speaking (${d} morale).`;
      }
      break;
    }
    case 'playingTime:squadRole': {
      const pers = p!.personality;
      const d = nudge(draft, p!.id, pers.loyalty >= 60 ? 4 : pers.ambition >= 65 ? -12 : -4);
      outcome = d > 0 ? `${name} respects the honesty (+${d} morale).` : pers.ambition >= 65 ? `${name} has started asking his agent questions (${d} morale).` : `${name} takes it on the chin, just about (${d} morale).`;
      break;
    }
    case 'homesick:daysOff': {
      const d = nudge(draft, p!.id, 18);
      draft.dressingRoom.away.push({ playerId: p!.id, untilMatch: draft.matchNumber + 1, reason: `Home in ${p!.hometown}` });
      scrapbook(draft, p!.id, `Given a few days at home in ${p!.hometown} when he needed it.`);
      outcome = `${name} heads home to ${p!.hometown} (+${d} morale). He’ll miss the next match.`;
      break;
    }
    case 'homesick:familyVisit': {
      draft.coins -= COSTS.familyVisit;
      const d = nudge(draft, p!.id, 10);
      outcome = `His family are in the stand next match. ${name} can’t stop grinning (+${d} morale).`;
      break;
    }
    case 'homesick:keepHim': {
      const d = nudge(draft, p!.id, -8);
      outcome = `${name} nods, but his mind is somewhere else (${d} morale).`;
      break;
    }
    case 'flatSquad:nightOut': {
      draft.coins -= COSTS.nightOut;
      for (const id of squad) nudge(draft, id, 8);
      outcome = 'Karaoke, a curry and a bus home at midnight. Everyone’s smiling again (+8 morale).';
      break;
    }
    case 'flatSquad:toughLove': {
      let up = 0;
      let down = 0;
      for (const id of squad) {
        const pro = (draft.footballers[id] as Footballer).personality.professionalism >= 60;
        nudge(draft, id, pro ? 6 : -5);
        if (pro) up++;
        else down++;
      }
      outcome = `Teacups flew. ${up} player${up === 1 ? '' : 's'} responded (+6); ${down} took it badly (−5).`;
      break;
    }
    case 'flatSquad:clearAir': {
      for (const id of squad) nudge(draft, id, 3);
      outcome = 'Everyone had their say. It’s calmer in there now (+3 morale).';
      break;
    }
    case 'interview:doIt': {
      const d = nudge(draft, p!.id, 10);
      draft.coins += 40;
      scrapbook(draft, p!.id, 'FRONT PAGE: a big interview in the Touchline Post.');
      outcome = `${name} is on the front page (+${d} morale, +40 coins).`;
      break;
    }
    case 'interview:grounded': {
      const d = nudge(draft, p!.id, -3);
      grantXp(draft, p!.id, 30);
      outcome = `${name} stays in for extra finishing practice (${d} morale, +30 XP).`;
      break;
    }
    default:
      throw new Error('Unknown choice.');
  }
  e.status = 'resolved';
  e.choiceId = choiceId;
  e.outcome = outcome;
  return outcome;
}

// ── After a match ──────────────────────────────────────────────────────────────────────────

/** Was he in the squad but unused in each of the last `n` matches (newest records first)? */
function unusedStreak(records: readonly MatchRecord[], playerId: string, n: number): boolean {
  const recent = records.slice(0, n);
  return recent.length === n && recent.every((r) => r.gains.some((g) => g.playerId === playerId && g.rating === undefined));
}

function lostLast(records: readonly MatchRecord[], n: number): boolean {
  const recent = records.slice(0, n);
  return recent.length === n && recent.every((r) => r.score[r.userSide] < r.score[r.userSide === 'home' ? 'away' : 'home']);
}

export interface AfterMatchInput {
  started: ReadonlySet<string>;
  cameOn: ReadonlySet<string>;
  goals: ReadonlyMap<string, number>;
  potmId: string;
  result: 'win' | 'draw' | 'loss';
}

/**
 * Runs on the save draft after a match is recorded: morale for the squad, promises checked
 * (kept or broken → news), excused players back, and perhaps a new knock on the door.
 * Returns the morale swings for the result screen.
 */
export function dressingRoomAfterMatch(draft: ClubSave, m: AfterMatchInput): MoraleChange[] {
  const room = draft.dressingRoom;
  const changes: MoraleChange[] = [];
  const away = new Set(room.away.filter((a) => a.untilMatch >= draft.matchNumber).map((a) => a.playerId));
  for (const id of draft.squadIds) {
    const p = draft.footballers[id];
    if (!p || away.has(id)) continue; // excused players are not hurt by missing out
    const { delta, reasons } = matchMoraleDelta(p, { started: m.started.has(id), cameOn: m.cameOn.has(id), goals: m.goals.get(id) ?? 0, potm: m.potmId === id, result: m.result });
    p.morale = clampMorale(p.morale + delta);
    if (delta !== 0) changes.push({ playerId: id, delta, reasons });
  }

  // Promises: a start keeps it; running out of matches breaks it.
  for (const pr of [...room.promises]) {
    const p = draft.footballers[pr.playerId];
    if (!p) {
      room.promises = room.promises.filter((x) => x !== pr);
      continue;
    }
    if (m.started.has(pr.playerId)) pr.got++;
    if (pr.got >= pr.starts) {
      const d = nudge(draft, pr.playerId, 15);
      scrapbook(draft, pr.playerId, 'The gaffer promised him a start, and kept his word.');
      newEvent(draft, 'promiseKept', 'news', pr.playerId, `You promised ${p.lastName} a start and kept your word. He’s flying (+${d} morale).`);
      changes.push({ playerId: pr.playerId, delta: d, reasons: ['promise kept'] });
      room.promises = room.promises.filter((x) => x !== pr);
    } else if (draft.matchNumber >= pr.byMatch) {
      const d = nudge(draft, pr.playerId, -20);
      let others = 0;
      for (const id of draft.squadIds) {
        if (id !== pr.playerId && !m.started.has(id) && !m.cameOn.has(id) && draft.footballers[id]) {
          nudge(draft, id, -3);
          others++;
        }
      }
      scrapbook(draft, pr.playerId, 'Promised a start that never came.');
      newEvent(draft, 'promiseBroken', 'news', pr.playerId, `You promised ${p.lastName} a start and didn’t deliver. He’s furious (${d} morale)${others ? `, and the rest of the bench noticed (−3)` : ''}.`);
      changes.push({ playerId: pr.playerId, delta: d, reasons: ['promise broken'] });
      room.promises = room.promises.filter((x) => x !== pr);
    }
  }

  room.away = room.away.filter((a) => a.untilMatch > draft.matchNumber);

  // A new request: one at a time, with a gap between them.
  if (!openEvent(draft) && draft.matchNumber - room.lastEventMatch >= EVENT_GAP) {
    const made = nextRequest(draft);
    if (made) room.lastEventMatch = draft.matchNumber;
  }
  return changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function nextRequest(draft: ClubSave): ClubEvent | null {
  const records = draft.matchRecords;
  const promised = new Set(draft.dressingRoom.promises.map((p) => p.playerId));
  const squad = draft.squadIds.flatMap((id) => (draft.footballers[id] ? [draft.footballers[id]] : []));
  if (lostLast(records, 3)) return newEvent(draft, 'flatSquad', 'open');
  const benched = squad
    .filter((p) => !promised.has(p.id) && p.morale < 58 && unusedStreak(records, p.id, 3))
    .sort((a, b) => a.morale - b.morale || a.id.localeCompare(b.id))[0];
  if (benched) return newEvent(draft, 'playingTime', 'open', benched.id);
  const hot = scoringRuns(draft)[0];
  if (hot && hot.games >= 3 && draft.footballers[hot.playerId]) return newEvent(draft, 'interview', 'open', hot.playerId);
  const rng = stream(`${draft.careerSeed}:room:${draft.matchNumber}`, 'story');
  const lonely = squad.filter((p) => p.personality.sociability < 45 || p.age <= 20);
  // Personal troubles wait until a manager has found his feet.
  if (draft.matchNumber >= 4 && lonely.length && rng.chance(0.18)) return newEvent(draft, 'homesick', 'open', (lonely[rng.int(0, lonely.length - 1)] as Footballer).id);
  return null;
}

/** For the interview copy: his current run. */
export function interviewFacts(save: Pick<ClubSave, 'matchRecords' | 'season'>, playerId: string): { goals: number; games: number } {
  const run = scoringRuns(save).find((r) => r.playerId === playerId);
  const games = run?.games ?? 3;
  const goals = save.matchRecords.slice(0, games).reduce((s, r) => s + r.scorers.filter((x) => x.playerId === playerId).length, 0);
  return { goals, games };
}
