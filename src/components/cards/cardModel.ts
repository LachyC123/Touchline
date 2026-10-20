import { ORIGIN_BY_ID, PERSONALITY_BY_ID, DREAM_BY_ID, CELEBRATIONS } from '../../data/personality';
import { TIER_DEFS } from '../../data/tiers';
import { TRAIT_BY_ID, type TraitDef } from '../../data/traits';
import { archetypeSubtitle } from '../../domain/players/generator';
import { cardStats, overall, type CardStat } from '../../domain/players/rating';
import type { Footballer } from '../../domain/players/types';

/** Everything a card renders, derived from one stored Footballer (single source of truth). */
export interface CardModel {
  ovr: number;
  position: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  subtitle: string;
  stats: CardStat[];
  trait?: TraitDef;
  extraTraits: TraitDef[];
  tierLabel: string;
  storyChip: string;
  originLine: string;
  personalityLabel: string;
  personalityBlurb: string;
  dream: string;
  celebration: string;
  ariaLabel: string;
}

export function toCardModel(p: Footballer): CardModel {
  const traits = p.traitIds.map((id) => TRAIT_BY_ID[id]).filter((t): t is TraitDef => Boolean(t));
  const origin = ORIGIN_BY_ID[p.originStoryId];
  const latest = [...p.history].sort((a, b) => b.order - a.order)[0];
  const ovr = overall(p);
  const personality = PERSONALITY_BY_ID[p.personality.type];
  const subtitle = archetypeSubtitle(p);
  const tierLabel = TIER_DEFS[p.tier].label;
  const trait = traits[0];
  return {
    ovr,
    position: p.primaryPosition,
    firstName: p.firstName,
    lastName: p.lastName,
    ...(p.nickname ? { nickname: p.nickname } : {}),
    subtitle,
    stats: cardStats(p),
    ...(trait ? { trait } : {}),
    extraTraits: traits.slice(1),
    tierLabel,
    // Story chip prefers a real recent milestone, falling back to the origin story.
    storyChip: latest && latest.kind !== 'signed' ? latest.headline : (origin?.chip ?? 'New signing'),
    originLine: (origin?.line ?? '').replace('{town}', p.hometown),
    personalityLabel: personality.label,
    personalityBlurb: personality.blurb,
    dream: DREAM_BY_ID[p.dreamId]?.text ?? '',
    celebration: CELEBRATIONS[p.celebrationId],
    ariaLabel: `${p.firstName} ${p.lastName}, ${p.primaryPosition}, overall ${ovr}, ${tierLabel} tier${trait ? `, trait ${trait.name}` : ''}`,
  };
}

/** Shrink long surnames on the nameplate rather than truncating them. */
export function nameSizeClass(name: string): string {
  if (name.length > 11) return 'is-xlong';
  if (name.length > 8) return 'is-long';
  return '';
}
