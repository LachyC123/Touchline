import { isNameAllowed } from '../../data/names';
import { seededUuid, stream } from '../rng';
import type { ClubSave } from '../save/types';
import type { Footballer } from './types';

/**
 * Nicknames the fans give for what a player actually does: a keeper who keeps clean sheets,
 * a striker who keeps scoring, a provider, a stalwart, a derby hero. Each player earns one
 * (it replaces any he arrived with), written into his story; the pick from each pool is seeded
 * by the player, so it never changes on a reload.
 */

interface Rule {
  id: string;
  /** Lower = checked first. */
  order: number;
  when(p: Footballer, ctx: NicknameContext): boolean;
  names: readonly string[];
  why(p: Footballer, ctx: NicknameContext): string;
}

export interface NicknameContext {
  town: string;
  /** Scored this match's winner in a derby. */
  derbyWinnerId?: string;
  /** Scored three or more this match. */
  hatTricks: ReadonlySet<string>;
}

const RULES: readonly Rule[] = [
  { id: 'derby', order: 0, when: (p, c) => c.derbyWinnerId === p.id, names: ['Derby King', 'The Local Hero', 'Mr Derby'], why: () => 'for the derby winner' },
  { id: 'hatTrick', order: 1, when: (p, c) => c.hatTricks.has(p.id), names: ['Hat-Trick Hero', 'Treble', 'The Matchball'], why: () => 'after his hat-trick' },
  { id: 'wall', order: 2, when: (p) => p.primaryPosition === 'GK' && p.stats.cleanSheets >= 4, names: ['The Wall', 'The Cat', 'Safe Hands', 'The Octopus'], why: (p) => `after ${p.stats.cleanSheets} clean sheets` },
  { id: 'rock', order: 3, when: (p) => p.primaryPosition === 'DEF' && p.stats.cleanSheets >= 5, names: ['The Rock', 'Brick', 'The Bouncer', 'Iron'], why: (p) => `after ${p.stats.cleanSheets} clean sheets` },
  { id: 'scorer', order: 4, when: (p) => p.stats.goals >= 8, names: ['The Fox', 'Hitman', 'Goal Machine', 'The Finisher', 'Deadly'], why: (p) => `after ${p.stats.goals} goals` },
  { id: 'provider', order: 5, when: (p) => p.stats.assists >= 6, names: ['The Postman', 'The Architect', 'Mr Delivery', 'The Magician'], why: (p) => `after ${p.stats.assists} assists` },
  { id: 'stalwart', order: 6, when: (p) => p.stats.matches >= 30 && p.personality.loyalty >= 60, names: ['Mr {town}', 'Captain Fantastic', 'Old Faithful'], why: (p) => `after ${p.stats.matches} games for the club` },
];

export function hasEarnedNickname(p: Footballer): boolean {
  return p.history.some((h) => h.kind === 'nickname');
}

/** Gives nicknames on a draft (after the match's stats are in). Returns who got what. */
export function earnNicknames(draft: ClubSave, ids: readonly string[], ctx: NicknameContext): { playerId: string; name: string; nickname: string; reason: string }[] {
  const out: { playerId: string; name: string; nickname: string; reason: string }[] = [];
  const taken = new Set(draft.squadIds.map((id) => draft.footballers[id]?.nickname).filter(Boolean));
  for (const id of ids) {
    const p = draft.footballers[id];
    if (!p || hasEarnedNickname(p)) continue;
    const rule = [...RULES].sort((a, b) => a.order - b.order).find((r) => r.when(p, ctx));
    if (!rule) continue;
    const rng = stream(`${p.generatedSeed}:nickname:${rule.id}`, 'story');
    const options = rule.names.map((n) => n.replace('{town}', ctx.town)).filter((n) => !taken.has(n) && isNameAllowed(n));
    if (!options.length) continue;
    const nickname = rng.pick(options);
    taken.add(nickname);
    p.nickname = nickname;
    const reason = rule.why(p, ctx);
    p.history.push({ id: seededUuid(`${draft.careerSeed}:history:${draft.nextSeq}`), kind: 'nickname', season: draft.season, order: draft.nextSeq++, headline: `The fans started calling him “${nickname}” ${reason}.` });
    out.push({ playerId: id, name: `${p.firstName} ${p.lastName}`, nickname, reason });
  }
  return out;
}
