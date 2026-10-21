import { grantPack } from '../packs/packs';
import type { ClubSave, PackKind } from '../save/types';

/**
 * The Reputation Road: rewards waiting along the reputation track, claimed once each (the claim
 * id is the step). Every reward is real: coins, or a scout pack whose recruit is committed the
 * moment it is granted.
 */

export type RoadReward = { kind: 'coins'; coins: number } | { kind: 'pack'; pack: PackKind };

export interface RoadStep {
  at: number;
  reward: RoadReward;
}

export const ROAD: readonly RoadStep[] = [
  { at: 5, reward: { kind: 'coins', coins: 100 } },
  { at: 10, reward: { kind: 'pack', pack: 'local-scout' } },
  { at: 15, reward: { kind: 'coins', coins: 150 } },
  { at: 22, reward: { kind: 'pack', pack: 'local-scout' } },
  { at: 30, reward: { kind: 'coins', coins: 250 } },
  { at: 40, reward: { kind: 'pack', pack: 'gold-scout' } },
  { at: 50, reward: { kind: 'coins', coins: 350 } },
  { at: 65, reward: { kind: 'pack', pack: 'local-scout' } },
  { at: 80, reward: { kind: 'pack', pack: 'gold-scout' } },
  { at: 100, reward: { kind: 'coins', coins: 600 } },
  { at: 120, reward: { kind: 'pack', pack: 'local-scout' } },
  { at: 140, reward: { kind: 'pack', pack: 'gold-scout' } },
  { at: 170, reward: { kind: 'coins', coins: 1000 } },
  { at: 200, reward: { kind: 'pack', pack: 'gold-scout' } },
];

export function roadClaimId(at: number): string {
  return `road:${at}`;
}

export type RoadState = 'claimed' | 'ready' | 'locked';

export function roadState(save: Pick<ClubSave, 'club' | 'rewardClaimIds'>, step: RoadStep): RoadState {
  if (save.rewardClaimIds.includes(roadClaimId(step.at))) return 'claimed';
  return save.club.reputation >= step.at ? 'ready' : 'locked';
}

export function roadReady(save: Pick<ClubSave, 'club' | 'rewardClaimIds'>): RoadStep[] {
  return ROAD.filter((s) => roadState(save, s) === 'ready');
}

/** Pays a step out on a draft (the caller records the claim id). Returns the pack id if any. */
export function claimRoadStep(draft: ClubSave, at: number): { packId: string | null; coins: number } {
  const step = ROAD.find((s) => s.at === at);
  if (!step) throw new Error('There is no reward there.');
  if (draft.club.reputation < at) throw new Error(`Reach ${at} reputation first.`);
  if (draft.rewardClaimIds.includes(roadClaimId(at))) throw new Error('Already claimed.');
  if (step.reward.kind === 'coins') {
    draft.coins += step.reward.coins;
    return { packId: null, coins: step.reward.coins };
  }
  return { packId: grantPack(draft, step.reward.pack, roadClaimId(at)).id, coins: 0 };
}
