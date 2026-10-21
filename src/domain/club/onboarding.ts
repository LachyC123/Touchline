import { KIT_PATTERNS, type ClubIdentity, type KitPattern } from './types';
import { ONBOARDING_STEPS, type ClubSave, type OnboardingStep, type TipId } from '../save/types';

/** What happened, in the order the guided first run expects it. */
export type OnboardingEvent = 'introDone' | 'packOpened' | 'recruitPlaced' | 'firstMatchSettled' | 'clubNamed' | 'skip';

const NEXT: Readonly<Record<Exclude<OnboardingEvent, 'skip'>, [from: OnboardingStep, to: OnboardingStep]>> = {
  introDone: ['intro', 'pack'],
  packOpened: ['pack', 'lineup'],
  recruitPlaced: ['lineup', 'match'],
  firstMatchSettled: ['match', 'club'],
  clubNamed: ['club', 'done'],
};

/**
 * Advances the first-run flow. An event only moves the step on from the step it belongs to,
 * so replays, reloads and out-of-order taps can never skip ahead or go backwards.
 */
export function advanceOnboarding(step: OnboardingStep, event: OnboardingEvent): OnboardingStep {
  if (event === 'skip') return 'done';
  const [from, to] = NEXT[event];
  return step === from ? to : step;
}

export function onboardingIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

/** True once the flow has reached (or passed) `step`. */
export function reached(save: Pick<ClubSave, 'onboarding'>, step: OnboardingStep): boolean {
  return onboardingIndex(save.onboarding) >= onboardingIndex(step);
}

export function tipPending(save: Pick<ClubSave, 'tipsSeen' | 'onboarding'>, tip: TipId): boolean {
  return save.onboarding !== 'intro' && save.onboarding !== 'pack' && !save.tipsSeen.includes(tip);
}

// ---------------------------------------------------------------------------- club identity

export interface KitPreset {
  id: string;
  label: string;
  primary: string;
  secondary: string;
}

/** Curated, readable pairs (each primary contrasts with the pitch green and with cream). */
export const KIT_PRESETS: readonly KitPreset[] = [
  { id: 'brick', label: 'Brick & cream', primary: '#E2563B', secondary: '#FFF7E9' },
  { id: 'royal', label: 'Royal & white', primary: '#2F5FD0', secondary: '#FFF7E9' },
  { id: 'claret', label: 'Claret & sky', primary: '#7A1F3D', secondary: '#8FD0F2' },
  { id: 'amber', label: 'Amber & ink', primary: '#F2A93B', secondary: '#1B2235' },
  { id: 'black', label: 'Black & lime', primary: '#22252B', secondary: '#CBF238' },
  { id: 'violet', label: 'Violet & gold', primary: '#5B3BB5', secondary: '#F4C653' },
  { id: 'white', label: 'White & navy', primary: '#F4F1EA', secondary: '#1F3566' },
  { id: 'sky', label: 'Sky & navy', primary: '#6EC3F0', secondary: '#1F3566' },
];

export const CLUB_NAME_MIN = 3;
export const CLUB_NAME_MAX = 24;
const NAME_OK = /^[A-Za-z0-9][A-Za-z0-9 '&.-]*$/;

/** Plain-language validation for a typed club name (null = fine). */
export function clubNameProblem(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < CLUB_NAME_MIN) return `Use at least ${CLUB_NAME_MIN} characters.`;
  if (name.length > CLUB_NAME_MAX) return `Keep it to ${CLUB_NAME_MAX} characters.`;
  if (!NAME_OK.test(name)) return 'Letters, numbers, spaces and & ’ . - only.';
  return null;
}

/** Three-letter scoreboard code: initials of a multi-word name, else the first three letters. */
export function shortNameFor(raw: string): string {
  const words = raw.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  const filler = new Set(['FC', 'AFC', 'CF', 'THE', 'TOWN', 'CITY', 'UNITED', 'ATHLETIC', 'ROVERS', 'WANDERERS']);
  const core = words.filter((w) => !filler.has(w));
  const base = core.length ? core : words;
  if (base.length >= 3) return base.slice(0, 3).map((w) => w[0]).join('');
  const first = base[0] ?? 'CLB';
  return first.slice(0, 3).padEnd(3, 'X');
}

export interface ClubIdentityChoice {
  name: string;
  presetId: string;
  pattern: KitPattern;
}

/** Applies a validated identity choice to a save draft (throws on invalid input). */
export function applyClubIdentity(club: ClubIdentity, choice: ClubIdentityChoice): ClubIdentity {
  const problem = clubNameProblem(choice.name);
  if (problem) throw new Error(problem);
  const preset = KIT_PRESETS.find((p) => p.id === choice.presetId);
  if (!preset) throw new Error('Pick one of the kit colours.');
  if (!KIT_PATTERNS.includes(choice.pattern)) throw new Error('Pick one of the kit patterns.');
  const name = choice.name.trim().replace(/\s+/g, ' ');
  return { ...club, name, shortName: shortNameFor(name), kit: { ...club.kit, primary: preset.primary, secondary: preset.secondary, pattern: choice.pattern } };
}

/** Rough perceptual distance between two #RRGGBB colours (0–~765). */
export function colourDistance(a: string, b: string): number {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) || 0;
  const dr = ch(a, 0) - ch(b, 0);
  const dg = ch(a, 1) - ch(b, 1);
  const db = ch(a, 2) - ch(b, 2);
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

export const KIT_CLASH_DISTANCE = 150;
