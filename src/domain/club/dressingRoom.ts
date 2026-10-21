import { CLUB_BY_ID, DIVISIONS } from '../../data/clubs';
import { DREAM_BY_ID, PERSONALITY_BY_ID } from '../../data/personality';
import { scoringRuns } from '../league/stories';
import { clampMorale, matchMoraleDelta, type MoraleChange } from '../players/morale';
import { xpToNext } from '../players/progression';
import { overall } from '../players/rating';
import type { Footballer } from '../players/types';
import { FOCUS_OPTIONS } from '../players/upgrades';
import { seededUuid, stream, type Rng } from '../rng';
import type { ClubEvent, ClubSave, DressingRoom, EventKind, MatchRecord } from '../save/types';

/**
 * The dressing room: players with moods, requests that need an answer, and promises that are
 * remembered. Every request type is one entry in REQUESTS (trigger → words → choices →
 * consequences). Everything is decided from stored facts (match records, personality, morale)
 * and a seeded stream, so the same career always produces the same dressing room.
 */

/** Matches between one request and the next. */
export const EVENT_GAP = 2;
export const COSTS = { familyVisit: 80, nightOut: 120, hamper: 30 } as const;
const MAX_EVENTS = 40;

export function emptyDressingRoom(): DressingRoom {
  return { events: [], promises: [], away: [], lastEventMatch: 0, backed: [] };
}

/** Players who cannot be picked for the next match (and why). */
export function awayFor(save: Pick<ClubSave, 'dressingRoom' | 'matchNumber'>): Map<string, string> {
  const next = save.matchNumber + 1;
  return new Map(save.dressingRoom.away.filter((a) => a.untilMatch >= next).map((a) => [a.playerId, a.reason]));
}

export function openEvent(save: Pick<ClubSave, 'dressingRoom'>): ClubEvent | undefined {
  return save.dressingRoom.events.find((e) => e.status === 'open');
}

export interface ChoiceDef {
  id: string;
  label: string;
  hint: string;
  /** Set when the choice cannot be taken right now. */
  disabled?: string;
}

type View = Pick<ClubSave, 'footballers' | 'coins' | 'club' | 'captainId' | 'penaltyTakerId' | 'matchRecords' | 'season' | 'squadIds' | 'dressingRoom'>;

// ── Shared effects ─────────────────────────────────────────────────────────────────────────

function nudge(draft: ClubSave, playerId: string | undefined, delta: number): number {
  const p = playerId ? draft.footballers[playerId] : undefined;
  if (!p) return 0;
  const before = p.morale;
  p.morale = clampMorale(p.morale + delta);
  return p.morale - before;
}

function signed(d: number): string {
  return d > 0 ? `+${d}` : `${d}`;
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

export function scrapbook(draft: ClubSave, playerId: string, headline: string, kind: 'milestone' | 'dream' = 'milestone'): void {
  const p = draft.footballers[playerId];
  if (!p) return;
  p.history.push({ id: seededUuid(`${draft.careerSeed}:history:${draft.nextSeq}`), kind, season: draft.season, order: draft.nextSeq, headline });
  draft.nextSeq++;
}

export function newEvent(draft: ClubSave, kind: EventKind, status: ClubEvent['status'], fields: Partial<Pick<ClubEvent, 'playerId' | 'otherId' | 'clubId' | 'outcome'>> = {}): ClubEvent {
  const e: ClubEvent = { id: seededUuid(`${draft.careerSeed}:event:${draft.nextSeq}`), kind, atMatch: draft.matchNumber, status };
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) (e as unknown as Record<string, unknown>)[k] = v;
  draft.nextSeq++;
  draft.dressingRoom.events = [e, ...draft.dressingRoom.events].slice(0, MAX_EVENTS);
  return e;
}

function away(draft: ClubSave, playerId: string, reason: string): void {
  draft.dressingRoom.away.push({ playerId, untilMatch: draft.matchNumber + 1, reason });
}

function promise(draft: ClubSave, e: ClubEvent, playerId: string, starts: number, within: number): void {
  draft.dressingRoom.promises.push({ id: e.id, playerId, starts, got: 0, byMatch: draft.matchNumber + within });
}

/** The armband changes hands: pride for the new man, a sting for the old one. */
export function appointCaptain(draft: ClubSave, playerId: string): { gained: number; lost: number } {
  const old = draft.captainId;
  if (old === playerId) return { gained: 0, lost: 0 };
  draft.captainId = playerId;
  const gained = nudge(draft, playerId, 12);
  const lost = old && draft.footballers[old] ? nudge(draft, old, -10) : 0;
  return { gained, lost };
}

/** Penalty duty changes hands. */
export function givePenalties(draft: ClubSave, playerId: string | null): number {
  const old = draft.penaltyTakerId;
  draft.penaltyTakerId = playerId;
  if (old && old !== playerId) nudge(draft, old, -5);
  return playerId ? nudge(draft, playerId, 10) : 0;
}

// ── Facts ──────────────────────────────────────────────────────────────────────────────────

const who = (save: View, id?: string) => (id ? save.footballers[id] : undefined);
const last = (save: View, id?: string) => who(save, id)?.lastName ?? 'He';
const persona = (p?: Footballer) => (p ? PERSONALITY_BY_ID[p.personality.type].label.toLowerCase() : '');

/** Was he in the squad but unused in each of the last `n` matches (newest records first)? */
function unusedStreak(records: readonly MatchRecord[], playerId: string, n: number): boolean {
  const recent = records.slice(0, n);
  return recent.length === n && recent.every((r) => r.gains.some((g) => g.playerId === playerId && g.rating === undefined));
}

function startedRecently(records: readonly MatchRecord[], playerId: string, n: number): boolean {
  const recent = records.slice(0, n);
  return recent.length === n && recent.every((r) => r.gains.some((g) => g.playerId === playerId && g.rating !== undefined));
}

function lostLast(records: readonly MatchRecord[], n: number): boolean {
  const recent = records.slice(0, n);
  return recent.length === n && recent.every((r) => r.score[r.userSide] < r.score[r.userSide === 'home' ? 'away' : 'home']);
}

/** Has this kind of request (for this player, if given) come up among the last `n` events? */
function recently(save: View, kind: EventKind, n: number, playerId?: string): boolean {
  return save.dressingRoom.events.slice(0, n).some((e) => e.kind === kind && (playerId === undefined || e.playerId === playerId));
}

export function dreamFulfilled(p: Footballer): boolean {
  return p.history.some((h) => h.kind === 'dream');
}

/** Leadership for the armband: professionalism, confidence, experience and a captain's voice. */
function leadership(p: Footballer): number {
  return p.personality.professionalism + p.personality.confidence + p.age * 2 + (p.traitIds.includes('captainsVoice') ? 30 : 0);
}

export function interviewFacts(save: Pick<ClubSave, 'matchRecords' | 'season'>, playerId: string): { goals: number; games: number } {
  const run = scoringRuns(save).find((r) => r.playerId === playerId);
  const games = run?.games ?? 3;
  const goals = save.matchRecords.slice(0, games).reduce((s, r) => s + r.scorers.filter((x) => x.playerId === playerId).length, 0);
  return { goals, games };
}

// ── The requests ───────────────────────────────────────────────────────────────────────────

interface Ctx {
  draft: ClubSave;
  rng: Rng;
  squad: Footballer[];
  records: readonly MatchRecord[];
}

type Fields = Partial<Pick<ClubEvent, 'playerId' | 'otherId' | 'clubId'>>;

interface RequestDef {
  /** Rule-based requests are checked first, in order; the rest are drawn at random. */
  rule: boolean;
  trigger(c: Ctx): Fields | null;
  headline(e: ClubEvent, s: View): string;
  quote(e: ClubEvent, s: View): string;
  choices(e: ClubEvent, s: View): ChoiceDef[];
  apply(d: ClubSave, e: ClubEvent, choiceId: string): string;
}

const REQUESTS: Partial<Record<EventKind, RequestDef>> = {
  flatSquad: {
    rule: true,
    trigger: (c) => (lostLast(c.records, 3) && !recently(c.draft, 'flatSquad', 4) ? {} : null),
    headline: () => 'The dressing room is flat',
    quote: () => 'Three defeats on the bounce. Heads are down and nobody’s put the music on in the changing room.',
    choices: (_e, s) => [
      { id: 'nightOut', label: `Team night out (${COSTS.nightOut} coins)`, hint: '+8 morale for the whole squad.', ...(s.coins < COSTS.nightOut ? { disabled: `Needs ${COSTS.nightOut} coins` } : {}) },
      { id: 'toughLove', label: 'Hairdryer treatment', hint: 'The professionals respond (+6). The rest take it badly (−5).' },
      { id: 'clearAir', label: 'Clear-the-air meeting', hint: '+3 morale for everyone. Steady, not spectacular.' },
    ],
    apply: (d, _e, choice) => {
      const squad = d.squadIds.filter((id) => d.footballers[id]);
      if (choice === 'nightOut') {
        d.coins -= COSTS.nightOut;
        for (const id of squad) nudge(d, id, 8);
        return 'Karaoke, a curry and a bus home at midnight. Everyone’s smiling again (+8 morale).';
      }
      if (choice === 'toughLove') {
        let up = 0;
        let down = 0;
        for (const id of squad) {
          const pro = (d.footballers[id] as Footballer).personality.professionalism >= 60;
          nudge(d, id, pro ? 6 : -5);
          if (pro) up++;
          else down++;
        }
        return `Teacups flew. ${up} player${up === 1 ? '' : 's'} responded (+6); ${down} took it badly (−5).`;
      }
      for (const id of squad) nudge(d, id, 3);
      return 'Everyone had their say. It’s calmer in there now (+3 morale).';
    },
  },

  playingTime: {
    rule: true,
    trigger: (c) => {
      const promised = new Set(c.draft.dressingRoom.promises.map((p) => p.playerId));
      const p = c.squad.filter((x) => !promised.has(x.id) && x.morale < 58 && unusedStreak(c.records, x.id, 3) && !recently(c.draft, 'playingTime', 6, x.id)).sort((a, b) => a.morale - b.morale || a.id.localeCompare(b.id))[0];
      return p ? { playerId: p.id } : null;
    },
    headline: (e, s) => `${last(s, e.playerId)} wants more minutes`,
    quote: (e, s) => {
      const type = who(s, e.playerId)?.personality.type;
      if (type === 'ambitious') return 'Boss, I didn’t come here to watch. I want to play — and soon.';
      if (type === 'anxious') return 'I don’t know what I’m doing wrong. Can I just get a chance?';
      if (type === 'laidBack' || type === 'joker') return 'No stress, gaffer, but my boots are getting dusty. Any chance of a run-out?';
      if (type === 'hotHeaded') return 'Three games on the bench. Three! What do I have to do?';
      return 'I’ve sat out three games now. I’m ready — give me a chance.';
    },
    choices: (e, s) => [
      { id: 'promise', label: 'Promise him a start in the next two matches', hint: '+5 now. Keep it: +15. Break it: −20, and the rest of the bench notices.' },
      { id: 'earnIt', label: 'Tell him to earn it in training', hint: `A professional knuckles down and improves; anyone else sulks. He’s ${persona(who(s, e.playerId))}.` },
      { id: 'squadRole', label: 'Be honest: he’s a squad player for now', hint: 'A loyal player respects it. An ambitious one won’t.' },
    ],
    apply: (d, e, choice) => {
      const p = d.footballers[e.playerId as string] as Footballer;
      if (choice === 'promise') {
        nudge(d, p.id, 5);
        promise(d, e, p.id, 1, 2);
        return `${p.lastName} leaves smiling. He starts one of the next two — or he’ll remember.`;
      }
      if (choice === 'earnIt') {
        if (p.personality.professionalism >= 60) {
          nudge(d, p.id, -2);
          grantXp(d, p.id, 40);
          return `${p.lastName} is first out on the training pitch every morning (+40 XP).`;
        }
        return `${p.lastName} sulks. The kit man says he’s barely speaking (${signed(nudge(d, p.id, -10))} morale).`;
      }
      const dd = nudge(d, p.id, p.personality.loyalty >= 60 ? 4 : p.personality.ambition >= 65 ? -12 : -4);
      if (dd > 0) return `${p.lastName} respects the honesty (${signed(dd)} morale).`;
      return p.personality.ambition >= 65 ? `${p.lastName} has started asking his agent questions (${signed(dd)} morale).` : `${p.lastName} takes it on the chin, just about (${signed(dd)} morale).`;
    },
  },

  captaincy: {
    rule: true,
    trigger: (c) => (!c.draft.captainId && c.draft.matchNumber >= 2 && !recently(c.draft, 'captaincy', 8) && c.squad.length >= 3 ? {} : null),
    headline: () => 'The squad needs a captain',
    quote: () => 'Every team needs a voice on the pitch. Three names keep coming up in the dressing room.',
    choices: (_e, s) => {
      const squad = s.squadIds.flatMap((id) => (s.footballers[id] ? [s.footballers[id]] : []));
      const top = [...squad].sort((a, b) => leadership(b) - leadership(a) || a.id.localeCompare(b.id)).slice(0, 3);
      return [
        ...top.map((p) => ({ id: `appoint:${p.id}`, label: `Give ${p.firstName} ${p.lastName} the armband`, hint: `${PERSONALITY_BY_ID[p.personality.type].label}, ${p.age}. +12 morale, and a little extra every match he leads the side.` })),
        { id: 'wait', label: 'Not yet — let a leader emerge', hint: 'Nothing changes. You can name a captain from the lineup any time.' },
      ];
    },
    apply: (d, _e, choice) => {
      if (choice === 'wait') return 'No captain for now. The squad will sort out its own pecking order.';
      const id = choice.slice('appoint:'.length);
      const p = d.footballers[id];
      if (!p) throw new Error('Unknown choice.');
      const { gained } = appointCaptain(d, id);
      scrapbook(d, id, 'Named club captain.');
      return `${p.lastName} is your captain. He holds the armband like it’s made of glass (${signed(gained)} morale).`;
    },
  },

  interview: {
    rule: true,
    trigger: (c) => {
      const hot = scoringRuns(c.draft)[0];
      return hot && hot.games >= 3 && c.draft.footballers[hot.playerId] && !recently(c.draft, 'interview', 6, hot.playerId) ? { playerId: hot.playerId } : null;
    },
    headline: (e, s) => `The Post wants ${last(s, e.playerId)}`,
    quote: (e, s) => {
      const f = interviewFacts(s, e.playerId as string);
      return `${f.goals} goals in ${f.games} games. The Touchline Post wants him on the front page.`;
    },
    choices: () => [
      { id: 'doIt', label: 'Let him do the interview', hint: '+10 morale, and the paper pays the club 40 coins.' },
      { id: 'grounded', label: 'Keep him grounded', hint: '−3 morale, but he puts in extra work: +30 XP.' },
    ],
    apply: (d, e, choice) => {
      const p = d.footballers[e.playerId as string] as Footballer;
      if (choice === 'doIt') {
        const dd = nudge(d, p.id, 10);
        d.coins += 40;
        d.club.reputation += 1;
        scrapbook(d, p.id, 'FRONT PAGE: a big interview in the Touchline Post.');
        return `${p.lastName} is on the front page (${signed(dd)} morale, +40 coins, +1 reputation).`;
      }
      const dd = nudge(d, p.id, -3);
      grantXp(d, p.id, 30);
      return `${p.lastName} stays in for extra finishing practice (${signed(dd)} morale, +30 XP).`;
    },
  },

  penalties: {
    rule: false,
    trigger: (c) => {
      if (c.draft.matchNumber < 3) return null;
      const keen = c.squad.filter(
        (p) => p.primaryPosition !== 'GK' && p.id !== c.draft.penaltyTakerId && (p.personality.confidence >= 62 || ['hotHeaded', 'bigGame', 'ambitious'].includes(p.personality.type)) && startedRecently(c.records, p.id, 2) && !recently(c.draft, 'penalties', 10, p.id),
      );
      return keen.length ? { playerId: c.rng.pick(keen).id } : null;
    },
    headline: (e, s) => `${last(s, e.playerId)} wants the penalties`,
    quote: (e, s) => (who(s, e.playerId)?.personality.type === 'hotHeaded' ? 'Next penalty’s mine. I’m not asking, gaffer — well, I am, but you know what I mean.' : 'Next time we get a penalty, I want it. I won’t miss.'),
    choices: (_e, s) => [
      { id: 'give', label: 'Give him the penalties', hint: `+10 morale. He steps up for every penalty while he’s on the pitch${s.penaltyTakerId && s.footballers[s.penaltyTakerId] ? `; ${s.footballers[s.penaltyTakerId]!.lastName} loses the job (−5)` : ''}.` },
      { id: 'keep', label: 'Penalties stay as they are', hint: 'He won’t like it (−6); a resilient player shrugs it off.' },
    ],
    apply: (d, e, choice) => {
      const p = d.footballers[e.playerId as string] as Footballer;
      if (choice === 'give') {
        const dd = givePenalties(d, p.id);
        return `${p.lastName} is on penalties. He’s practising his run-up already (${signed(dd)} morale).`;
      }
      const dd = nudge(d, p.id, p.personality.type === 'resilient' ? -2 : -6);
      return `${p.lastName} nods and walks off (${signed(dd)} morale).`;
    },
  },

  rivalInterest: {
    rule: false,
    trigger: (c) => {
      if (c.draft.matchNumber < 5) return null;
      const best = [...c.squad].sort((a, b) => overall(b) - overall(a)).slice(0, 3).filter((p) => p.personality.ambition >= 55 && !recently(c.draft, 'rivalInterest', 12, p.id));
      if (!best.length) return null;
      const bigger = DIVISIONS[Math.min(DIVISIONS.length - 1, c.draft.league.division + 1)]?.clubs ?? [];
      return { playerId: c.rng.pick(best).id, clubId: c.rng.pick(bigger).id };
    },
    headline: (e, s) => `${CLUB_BY_ID[e.clubId ?? '']?.shortName ?? 'A big club'} are watching ${last(s, e.playerId)}`,
    quote: (e) => `My agent says ${CLUB_BY_ID[e.clubId ?? '']?.name ?? 'a bigger club'} have been at the last two games. I’m not saying I want to go… but I’m listening.`,
    choices: () => [
      { id: 'heart', label: 'Tell him he’s at the heart of your plans', hint: '+6 now, and a promise: he starts both of the next three. Keep it: +15. Break it: −20.' },
      { id: 'free', label: 'It’s his career — wish him well', hint: '+4 morale. Loyal players appreciate it; ambitious ones start dreaming.' },
      { id: 'ignore', label: 'Say nothing', hint: 'He feels taken for granted (−8; worse if he’s ambitious).' },
    ],
    apply: (d, e, choice) => {
      const p = d.footballers[e.playerId as string] as Footballer;
      const club = CLUB_BY_ID[e.clubId ?? '']?.name ?? 'them';
      if (choice === 'heart') {
        nudge(d, p.id, 6);
        promise(d, e, p.id, 2, 3);
        return `${p.lastName} is staying put — and expects to start the next two of three. ${club} will have to wait.`;
      }
      if (choice === 'free') {
        const dd = nudge(d, p.id, p.personality.loyalty >= 60 ? 8 : 4);
        return `${p.lastName} appreciates the honesty (${signed(dd)} morale). For now, he’s ours.`;
      }
      const dd = nudge(d, p.id, p.personality.ambition >= 70 ? -12 : -8);
      return `${p.lastName} feels taken for granted (${signed(dd)} morale).`;
    },
  },

  armband: {
    rule: false,
    trigger: (c) => {
      const cap = c.draft.captainId ? c.draft.footballers[c.draft.captainId] : undefined;
      if (!cap || c.draft.matchNumber < 6 || recently(c.draft, 'armband', 12)) return null;
      const rivals = c.squad.filter((p) => p.id !== cap.id && p.age >= 25 && p.personality.confidence >= 60 && leadership(p) > leadership(cap) - 20);
      return rivals.length ? { playerId: c.rng.pick(rivals).id, otherId: cap.id } : null;
    },
    headline: (e, s) => `${last(s, e.playerId)} wants the armband`,
    quote: (e, s) => `With respect to ${last(s, e.otherId)}, the lads look to me out there. I should be captain.`,
    choices: (e, s) => [
      { id: 'switch', label: 'Give him the armband', hint: `+12 for him. ${last(s, e.otherId)} won’t take it well (−10).` },
      { id: 'keep', label: `${last(s, e.otherId)} stays captain`, hint: `He’s disappointed (−6); ${last(s, e.otherId)} feels backed (+3).` },
    ],
    apply: (d, e, choice) => {
      const p = d.footballers[e.playerId as string] as Footballer;
      const cap = d.footballers[e.otherId as string];
      if (choice === 'switch') {
        appointCaptain(d, p.id);
        scrapbook(d, p.id, 'Named club captain.');
        return `${p.lastName} is the new captain. ${cap?.lastName ?? 'The old captain'} is quiet in training.`;
      }
      nudge(d, p.id, -6);
      nudge(d, e.otherId, 3);
      return `${cap?.lastName ?? 'The captain'} keeps the armband. ${p.lastName} will have to lead by example.`;
    },
  },

  dreamTalk: {
    rule: false,
    trigger: (c) => {
      if (c.draft.matchNumber < 3) return null;
      const talked = new Set(c.draft.dressingRoom.events.filter((e) => e.kind === 'dreamTalk').map((e) => e.playerId));
      const open = c.squad.filter((p) => !dreamFulfilled(p) && !talked.has(p.id) && !c.draft.dressingRoom.backed.includes(p.id) && p.morale >= 45 && DREAM_BY_ID[p.dreamId]);
      return open.length ? { playerId: c.rng.pick(open).id } : null;
    },
    headline: (e, s) => `${last(s, e.playerId)} has a dream`,
    quote: (e, s) => {
      const p = who(s, e.playerId);
      const dream = p ? DREAM_BY_ID[p.dreamId]?.text : undefined;
      return `Can I tell you something, gaffer? Ever since I was a kid in ${p?.hometown ?? 'my town'}, I’ve wanted to ${(dream ?? 'make it').replace(/^./, (c) => c.toLowerCase())}.`;
    },
    choices: () => [
      { id: 'back', label: 'Tell him you’ll help make it happen', hint: '+6 now. If it comes true, he’ll remember you backed him (+10 more).' },
      { id: 'grounded', label: '“One step at a time, son”', hint: 'No change, but a professional takes it as motivation (+20 XP).' },
    ],
    apply: (d, e, choice) => {
      const p = d.footballers[e.playerId as string] as Footballer;
      if (choice === 'back') {
        const dd = nudge(d, p.id, 6);
        d.dressingRoom.backed.push(p.id);
        return `${p.lastName} grins. You’re in this together now (${signed(dd)} morale).`;
      }
      if (p.personality.professionalism >= 60) {
        grantXp(d, p.id, 20);
        return `${p.lastName} nods. He’s back out on the training pitch within the hour (+20 XP).`;
      }
      return `${p.lastName} shrugs. Dreams can wait.`;
    },
  },

  bustUp: {
    rule: false,
    trigger: (c) => {
      if (c.draft.matchNumber < 4 || recently(c.draft, 'bustUp', 8)) return null;
      const sparks = c.squad.filter((p) => p.personality.type === 'hotHeaded' || p.personality.professionalism < 40);
      if (!sparks.length) return null;
      const a = c.rng.pick(sparks);
      const others = c.squad.filter((p) => p.id !== a.id);
      return others.length ? { playerId: a.id, otherId: c.rng.pick(others).id } : null;
    },
    headline: (e, s) => `${last(s, e.playerId)} and ${last(s, e.otherId)} clash in training`,
    quote: (e, s) => `A late tackle, a shove, and now ${last(s, e.playerId)} and ${last(s, e.otherId)} aren’t speaking. The whole squad saw it.`,
    choices: (e, s) => [
      { id: 'fine', label: `Fine ${last(s, e.playerId)}`, hint: 'He started it: −10 for him, +5 for the other lad.' },
      { id: 'handshake', label: 'Make them shake hands', hint: 'Works if the instigator is sociable (both +4); if not, it’s frosty (both −3).' },
      { id: 'drop', label: 'Drop them both for the next match', hint: 'Both miss the next game. The rest of the squad respects the discipline (+2).' },
    ],
    apply: (d, e, choice) => {
      const a = d.footballers[e.playerId as string] as Footballer;
      const b = d.footballers[e.otherId as string];
      if (choice === 'fine') {
        nudge(d, a.id, -10);
        nudge(d, b?.id, 5);
        return `${a.lastName} is fined a week’s wages. ${b?.lastName ?? 'The other lad'} feels backed.`;
      }
      if (choice === 'handshake') {
        const ok = a.personality.sociability >= 50;
        nudge(d, a.id, ok ? 4 : -3);
        nudge(d, b?.id, ok ? 4 : -3);
        return ok ? `${a.lastName} and ${b?.lastName ?? 'his teammate'} are laughing about it by lunch.` : `They shook hands. Neither meant it.`;
      }
      away(d, a.id, 'Dropped');
      if (b) away(d, b.id, 'Dropped');
      for (const id of d.squadIds) if (id !== a.id && id !== b?.id) nudge(d, id, 2);
      return `Both are dropped for the next match. Nobody’s late for training this week (+2 for the rest).`;
    },
  },

  homesick: {
    rule: false,
    trigger: (c) => {
      if (c.draft.matchNumber < 4) return null;
      const lonely = c.squad.filter((p) => (p.personality.sociability < 45 || p.age <= 20) && !recently(c.draft, 'homesick', 10, p.id));
      return lonely.length ? { playerId: c.rng.pick(lonely).id } : null;
    },
    headline: (e, s) => `${last(s, e.playerId)} is homesick`,
    quote: (e, s) => `I miss ${who(s, e.playerId)?.hometown ?? 'home'}. My family, my mates… it’s harder than I thought it would be.`,
    choices: (_e, s) => [
      { id: 'daysOff', label: 'Give him a few days at home', hint: '+18 morale, but he misses the next match.' },
      { id: 'familyVisit', label: `Fly his family over (${COSTS.familyVisit} coins)`, hint: '+10 morale and he stays available.', ...(s.coins < COSTS.familyVisit ? { disabled: `Needs ${COSTS.familyVisit} coins` } : {}) },
      { id: 'keepHim', label: 'Keep him focused on football', hint: '−8 morale. He’s available, but is his head?' },
    ],
    apply: (d, e, choice) => {
      const p = d.footballers[e.playerId as string] as Footballer;
      if (choice === 'daysOff') {
        const dd = nudge(d, p.id, 18);
        away(d, p.id, `Home in ${p.hometown}`);
        scrapbook(d, p.id, `Given a few days at home in ${p.hometown} when he needed it.`);
        return `${p.lastName} heads home to ${p.hometown} (${signed(dd)} morale). He’ll miss the next match.`;
      }
      if (choice === 'familyVisit') {
        d.coins -= COSTS.familyVisit;
        return `His family are in the stand next match. ${p.lastName} can’t stop grinning (${signed(nudge(d, p.id, 10))} morale).`;
      }
      return `${p.lastName} nods, but his mind is somewhere else (${signed(nudge(d, p.id, -8))} morale).`;
    },
  },

  newDad: {
    rule: false,
    trigger: (c) => {
      if (c.draft.matchNumber < 4 || recently(c.draft, 'newDad', 15)) return null;
      const dads = c.squad.filter((p) => p.age >= 23 && !p.history.some((h) => h.headline.startsWith('Became a dad')));
      return dads.length && c.rng.chance(0.4) ? { playerId: c.rng.pick(dads).id } : null;
    },
    headline: (e, s) => `${last(s, e.playerId)} is a dad!`,
    quote: (e) => `Gaffer! It’s a ${e.id.charCodeAt(0) % 2 ? 'girl' : 'boy'}! Born last night — I haven’t slept a wink.`,
    choices: (_e, s) => [
      { id: 'leave', label: 'Paternity leave: miss the next match', hint: '+20 morale. Family first.' },
      { id: 'hamper', label: `Send flowers and a hamper (${COSTS.hamper} coins)`, hint: '+8 morale, and he plays.', ...(s.coins < COSTS.hamper ? { disabled: `Needs ${COSTS.hamper} coins` } : {}) },
    ],
    apply: (d, e, choice) => {
      const p = d.footballers[e.playerId as string] as Footballer;
      scrapbook(d, p.id, 'Became a dad.');
      if (choice === 'leave') {
        away(d, p.id, 'Paternity leave');
        return `${p.lastName} is home with the baby (${signed(nudge(d, p.id, 20))} morale). He’ll miss the next match.`;
      }
      d.coins -= COSTS.hamper;
      return `The hamper arrives with the whole squad’s signatures on the card (${signed(nudge(d, p.id, 8))} morale).`;
    },
  },

  schoolVisit: {
    rule: false,
    trigger: (c) => (c.draft.matchNumber >= 3 && !recently(c.draft, 'schoolVisit', 10) ? {} : null),
    headline: () => 'A school wants a visit',
    quote: (_e, s) => `Ashby Lane Primary have written in: thirty kids in ${s.club.name} shirts want to meet a real player.`,
    choices: (_e, s) => {
      const squad = s.squadIds.flatMap((id) => (s.footballers[id] ? [s.footballers[id]] : []));
      const star = [...squad].sort((a, b) => Number(b.favourite) - Number(a.favourite) || overall(b) - overall(a))[0];
      const kid = [...squad].sort((a, b) => a.age - b.age || a.id.localeCompare(b.id)).find((p) => p.id !== star?.id);
      return [
        ...(star ? [{ id: `send:${star.id}`, label: `Send ${star.firstName} ${star.lastName}`, hint: 'The kids go wild. +6 morale, +2 reputation.' }] : []),
        ...(kid ? [{ id: `send:${kid.id}`, label: `Send young ${kid.lastName}`, hint: 'Not long ago he was one of them. +12 morale, +1 reputation.' }] : []),
        { id: 'decline', label: 'Too busy this week', hint: 'Nothing changes.' },
      ];
    },
    apply: (d, _e, choice) => {
      if (choice === 'decline') return 'A polite letter goes back. Maybe next time.';
      const id = choice.slice('send:'.length);
      const p = d.footballers[id];
      if (!p) throw new Error('Unknown choice.');
      const star = Object.values(d.footballers).every((x) => x.age >= p.age) ? 1 : 2;
      const dd = nudge(d, id, star === 1 ? 12 : 6);
      d.club.reputation += star;
      scrapbook(d, id, 'Visited Ashby Lane Primary. Signed thirty shirts.');
      return `${p.lastName} signs thirty shirts and plays headers in the playground (${signed(dd)} morale, +${star} reputation).`;
    },
  },
};

// ── Public API ─────────────────────────────────────────────────────────────────────────────

const NEWS: Partial<Record<EventKind, (e: ClubEvent, s: View) => string>> = {
  promiseKept: (e, s) => `You kept your word to ${last(s, e.playerId)}`,
  promiseBroken: (e, s) => `${last(s, e.playerId)} feels let down`,
  dreamCome: (e, s) => `${last(s, e.playerId)}’s dream came true`,
};

export function eventHeadline(e: ClubEvent, s: View): string {
  return REQUESTS[e.kind]?.headline(e, s) ?? NEWS[e.kind]?.(e, s) ?? 'Dressing room';
}

/** What he says when he knocks on the door, in his own voice. */
export function eventQuote(e: ClubEvent, s: View): string {
  return REQUESTS[e.kind]?.quote(e, s) ?? '';
}

export function choicesFor(e: ClubEvent, s: View): ChoiceDef[] {
  return e.status === 'open' ? (REQUESTS[e.kind]?.choices(e, s) ?? []) : [];
}

/**
 * Applies a choice on a save draft (inside the save transaction) and returns what happened.
 * Throws for an event that is not open or a choice that is not available.
 */
export function applyChoice(draft: ClubSave, eventId: string, choiceId: string): string {
  const e = draft.dressingRoom.events.find((x) => x.id === eventId);
  if (!e || e.status !== 'open') throw new Error('That has already been dealt with.');
  const def = REQUESTS[e.kind];
  const choice = choicesFor(e, draft).find((c) => c.id === choiceId);
  if (!def || !choice) throw new Error('Unknown choice.');
  if (choice.disabled) throw new Error(choice.disabled);
  const outcome = def.apply(draft, e, choiceId);
  e.status = 'resolved';
  e.choiceId = choiceId;
  e.outcome = outcome;
  return outcome;
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
  const excused = new Set(room.away.filter((a) => a.untilMatch >= draft.matchNumber).map((a) => a.playerId));
  for (const id of draft.squadIds) {
    const p = draft.footballers[id];
    if (!p || excused.has(id)) continue; // excused players are not hurt by missing out
    const { delta, reasons } = matchMoraleDelta(p, { started: m.started.has(id), cameOn: m.cameOn.has(id), goals: m.goals.get(id) ?? 0, potm: m.potmId === id, result: m.result });
    p.morale = clampMorale(p.morale + delta);
    let total = delta;
    if (draft.captainId === id && m.started.has(id)) {
      total += nudge(draft, id, 2);
      reasons.push('captain');
    }
    if (total !== 0) changes.push({ playerId: id, delta: total, reasons });
  }

  // Promises: enough starts keeps it; running out of matches breaks it.
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
      newEvent(draft, 'promiseKept', 'news', { playerId: pr.playerId, outcome: `You promised ${p.lastName} ${pr.starts > 1 ? `${pr.starts} starts` : 'a start'} and kept your word. He’s flying (${signed(d)} morale).` });
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
      newEvent(draft, 'promiseBroken', 'news', { playerId: pr.playerId, outcome: `You promised ${p.lastName} ${pr.starts > 1 ? `${pr.starts} starts` : 'a start'} and didn’t deliver. He’s furious (${signed(d)} morale)${others ? ', and the rest of the bench noticed (−3)' : ''}.` });
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

/** Rule-based requests first (in order); otherwise maybe one drawn from the rest. */
function nextRequest(draft: ClubSave): ClubEvent | null {
  const c: Ctx = {
    draft,
    rng: stream(`${draft.careerSeed}:room:${draft.matchNumber}`, 'story'),
    squad: draft.squadIds.flatMap((id) => (draft.footballers[id] ? [draft.footballers[id]] : [])),
    records: draft.matchRecords,
  };
  const kinds = Object.keys(REQUESTS) as EventKind[];
  for (const kind of kinds) {
    const def = REQUESTS[kind] as RequestDef;
    if (!def.rule) continue;
    const f = def.trigger(c);
    if (f) return newEvent(draft, kind, 'open', f);
  }
  // Life happens most weeks, but not every week.
  if (!c.rng.chance(0.55)) return null;
  for (const kind of c.rng.shuffle(kinds.filter((k) => !(REQUESTS[k] as RequestDef).rule))) {
    const f = (REQUESTS[kind] as RequestDef).trigger(c);
    if (f) return newEvent(draft, kind, 'open', f);
  }
  return null;
}

/** Every request type, for tests and the debug panel. */
export const REQUEST_KINDS = Object.keys(REQUESTS) as EventKind[];
