import type { ClubDef } from '../../data/clubs';
import { opponentSquad } from '../club/opponents';
import { REP_TIERS, repTier } from '../club/reputation';
import { generateFootballer } from '../players/generator';
import { clampMorale } from '../players/morale';
import { overall } from '../players/rating';
import type { Footballer, Position } from '../players/types';
import { strengthLap } from '../league/league';
import { seededUuid, stream } from '../rng';
import type { ClubSave, TransferOffer, Transfers } from '../save/types';
import { clubOf, divisionIndexOf, divisionOf } from '../world/world';

/**
 * The transfer market. Every few matches a new list appears: real players from clubs in this
 * career's world (buy one and his club replaces him) and free agents. Prices come from the
 * player alone (rating, potential, age), ambitious players want a club with a name, and you get
 * one haggle per player (seeded, so a reload can't re-roll it). Players you list attract bids
 * after matches; big clubs sometimes come in for your stars unasked. Pure functions on drafts.
 */

export const MARKET = {
  every: 3,
  fromClubs: 4,
  freeAgents: 2,
  haggleDiscount: 0.2,
  haggleInsult: 0.1,
  squadMax: 18,
  squadMin: 9,
  offerOpenFor: 2,
  listedOfferChance: 0.7,
  unsolicitedChance: 0.12,
  unsolicitedFrom: 6,
  listedMorale: -8,
  signingMorale: 72,
} as const;

export function emptyTransfers(): Transfers {
  return { bought: [], haggles: [], listed: [], offers: [], log: [] };
}

export function marketWindow(save: Pick<ClubSave, 'matchNumber'>): number {
  return Math.floor(save.matchNumber / MARKET.every);
}

export function matchesUntilNewList(save: Pick<ClubSave, 'matchNumber'>): number {
  return MARKET.every - (save.matchNumber % MARKET.every);
}

/** What a player is worth in coins: rating first, then potential and age. Rounded to 5. */
export function playerValue(p: Pick<Footballer, 'attributes' | 'primaryPosition' | 'secondaryPositions' | 'potential' | 'age'>): number {
  const ovr = overall(p);
  const base = 40 * 1.09 ** (ovr - 45);
  const upside = 1 + Math.max(0, p.potential - ovr) / 40;
  const age = p.age <= 21 ? 1.15 : p.age >= 31 ? 0.7 : 1;
  return Math.max(15, Math.round((base * upside * age) / 5) * 5);
}

export interface Listing {
  id: string;
  player: Footballer;
  fromClubId: string | null;
  price: number;
  /** Why he is available, in a line. */
  reason: string;
  /** Reputation he wants from a new club (0 = anyone). */
  wantsRep: number;
}

const POSITIONS: readonly (readonly [Position, number])[] = [
  ['GK', 1],
  ['DEF', 3],
  ['MID', 3],
  ['FWD', 3],
];

function reasonFor(p: Footballer, club: ClubDef | null, rng: ReturnType<typeof stream>): string {
  if (!club) return p.age >= 30 ? 'Free agent: released after a long career, still hungry.' : 'Free agent: released by a league club, out to prove them wrong.';
  if (p.personality.ambition >= 70) return `Wants a bigger stage than ${club.name}.`;
  return rng.pick([`Out of favour at ${club.name}.`, `${club.name} need the money.`, `Fell out with the ${club.name} manager.`, `Homesick at ${club.name} and open to a move.`]);
}

/** The current list (pure: same save, same list). Bought listings are gone. */
export function marketListings(save: Pick<ClubSave, 'careerSeed' | 'matchNumber' | 'season' | 'league' | 'world' | 'transfers' | 'footballers' | 'squadIds'>): Listing[] {
  const window = marketWindow(save);
  const rng = stream(`${save.careerSeed}:market:${window}`, 'market');
  const lap = strengthLap(save.season);
  const ours = save.league.division;
  // Mostly your own league, plus one stretch target from the division above (if there is one).
  const home = divisionOf(save.world, ours).clubs;
  const above = divisionOf(save.world, ours + 1).clubs.filter((c) => !home.includes(c));
  const out: Listing[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < MARKET.fromClubs * 3 && out.filter((l) => l.fromClubId).length < MARKET.fromClubs; i++) {
    const stretch = above.length > 0 && out.filter((l) => l.fromClubId).length === MARKET.fromClubs - 1;
    const club = rng.pick(stretch ? above : home);
    const squad = opponentSquad(save.careerSeed, club, lap, save.world.departed);
    const p = structuredClone(rng.pick(squad));
    if (seen.has(p.id) || save.footballers[p.id]) continue;
    seen.add(p.id);
    const up = divisionIndexOf(save.world, club.id) > ours;
    const wantsRep = up ? (p.personality.ambition >= 60 ? REP_TIERS[2].from : REP_TIERS[1].from) : p.personality.ambition >= 75 ? REP_TIERS[1].from : 0;
    out.push({ id: seededUuid(`${save.careerSeed}:listing:${window}:${p.id}`), player: p, fromClubId: club.id, price: Math.round((playerValue(p) * (up ? 1.2 : 1)) / 5) * 5, reason: reasonFor(p, club, rng), wantsRep });
  }
  const avg = save.squadIds.reduce((s, id) => s + (save.footballers[id] ? overall(save.footballers[id]) : 0), 0) / Math.max(1, save.squadIds.length);
  for (let i = 0; i < MARKET.freeAgents; i++) {
    const young = rng.chance(0.5);
    const seed = `${save.careerSeed}:freeagent:${window}:${i}`;
    const p = generateFootballer({ seed, position: rng.weighted(POSITIONS), targetOvr: Math.round(avg + rng.int(-4, 3)), tier: young && rng.chance(0.35) ? 'prospect' : 'street', ageRange: young ? [17, 19] : [30, 34], season: save.season });
    if (save.footballers[p.id]) continue;
    out.push({ id: seededUuid(`${save.careerSeed}:listing:${window}:${p.id}`), player: p, fromClubId: null, price: Math.round((playerValue(p) * 0.6) / 5) * 5, reason: reasonFor(p, null, rng), wantsRep: 0 });
  }
  const bought = new Set(save.transfers.bought);
  return out.filter((l) => !bought.has(l.id));
}

export function haggleOf(save: Pick<ClubSave, 'transfers'>, listingId: string): boolean | null {
  return save.transfers.haggles.find((h) => h.listingId === listingId)?.won ?? null;
}

/** The price after any haggle. */
export function priceOf(save: Pick<ClubSave, 'transfers'>, l: Listing): number {
  const h = haggleOf(save, l.id);
  const f = h === true ? 1 - MARKET.haggleDiscount : h === false ? 1 + MARKET.haggleInsult : 1;
  return Math.round((l.price * f) / 5) * 5;
}

/** Why he won't come (or can't be afforded / fitted in); null = he's yours if you pay. */
export function buyBlocker(save: Pick<ClubSave, 'coins' | 'club' | 'squadIds' | 'transfers'>, l: Listing): string | null {
  if (save.club.reputation < l.wantsRep) return `He wants a ${repTier(l.wantsRep).label} club (reputation ${l.wantsRep}).`;
  if (save.squadIds.length >= MARKET.squadMax) return `The squad is full (${MARKET.squadMax}). Sell someone first.`;
  const price = priceOf(save, l);
  if (save.coins < price) return `Needs ${price} coins.`;
  return null;
}

/** Odds of a haggle working: loyal, unambitious players and well-known clubs get the discount. */
export function haggleChance(save: Pick<ClubSave, 'club'>, l: Listing): number {
  const p = l.player.personality;
  return Math.max(0.15, Math.min(0.85, 0.5 + (p.loyalty - 50) / 250 - (p.ambition - 50) / 250 + repTier(save.club.reputation).shift / 80 + (l.fromClubId ? 0 : 0.1)));
}

/** One haggle per listing; the outcome is seeded by the listing, so it can't be re-rolled. */
export function haggle(draft: ClubSave, listingId: string): boolean {
  const l = marketListings(draft).find((x) => x.id === listingId);
  if (!l) throw new Error('He is no longer on the list.');
  if (haggleOf(draft, listingId) !== null) throw new Error('You have already haggled over him.');
  const won = stream(`${draft.careerSeed}:haggle:${listingId}`, 'market').chance(haggleChance(draft, l));
  draft.transfers.haggles.push({ listingId, won });
  return won;
}

/** Signs a listed player on a draft. Throws with the reason if he can't be signed. */
export function buyListing(draft: ClubSave, listingId: string): Footballer {
  const l = marketListings(draft).find((x) => x.id === listingId);
  if (!l) throw new Error('He is no longer on the list.');
  const why = buyBlocker(draft, l);
  if (why) throw new Error(why);
  const price = priceOf(draft, l);
  const p = structuredClone(l.player);
  p.isNew = true;
  p.morale = clampMorale(Math.max(p.morale, MARKET.signingMorale));
  const from = l.fromClubId ? clubOf(draft.world, l.fromClubId) : undefined;
  p.history.push({
    id: seededUuid(`${draft.careerSeed}:history:${draft.nextSeq}`),
    kind: 'signed',
    season: draft.season,
    order: draft.nextSeq++,
    headline: from ? `Signed from ${from.name} for ${price} coins.` : `Signed as a free agent (${price} coins).`,
  });
  draft.coins -= price;
  draft.footballers[p.id] = p;
  draft.squadIds.push(p.id);
  draft.transfers.bought.push(l.id);
  if (from) draft.world.departed.push(p.id);
  draft.transfers.log.unshift({ kind: 'in', playerId: p.id, name: `${p.firstName} ${p.lastName}`, clubId: l.fromClubId, fee: price, atMatch: draft.matchNumber, season: draft.season });
  draft.transfers.log = draft.transfers.log.slice(0, 60);
  return p;
}

// ── Selling ────────────────────────────────────────────────────────────────────────────────

export function sellBlocker(save: Pick<ClubSave, 'squadIds' | 'footballers' | 'pendingMatch'>, playerId: string): string | null {
  if (!save.squadIds.includes(playerId)) return 'He is not in the squad.';
  if (save.pendingMatch) return 'Finish the match first.';
  if (save.squadIds.length <= MARKET.squadMin) return `Keep at least ${MARKET.squadMin} players.`;
  const p = save.footballers[playerId];
  if (p?.primaryPosition === 'GK' && save.squadIds.filter((id) => save.footballers[id]?.primaryPosition === 'GK').length <= 1) return 'He is your only goalkeeper.';
  return null;
}

/** Puts a player on (or takes him off) the transfer list. Being listed stings. */
export function setListed(draft: ClubSave, playerId: string, listed: boolean): void {
  if (!draft.squadIds.includes(playerId)) throw new Error('He is not in the squad.');
  const on = draft.transfers.listed.includes(playerId);
  if (listed === on) return;
  if (listed) {
    draft.transfers.listed.push(playerId);
    const p = draft.footballers[playerId];
    if (p) p.morale = clampMorale(p.morale + MARKET.listedMorale - (p.personality.loyalty >= 70 ? 4 : 0));
  } else {
    draft.transfers.listed = draft.transfers.listed.filter((id) => id !== playerId);
    draft.transfers.offers = draft.transfers.offers.map((o) => (o.playerId === playerId && o.status === 'open' && !o.unsolicited ? { ...o, status: 'rejected' } : o));
  }
}

function bidderFor(save: Pick<ClubSave, 'world' | 'league'>, p: Footballer, up: boolean, rng: ReturnType<typeof stream>): ClubDef {
  const ours = save.league.division;
  const pool = up ? divisionOf(save.world, ours + 1).clubs : [...divisionOf(save.world, ours).clubs, ...divisionOf(save.world, ours + 1).clubs];
  const ovr = overall(p);
  const close = [...pool].sort((a, b) => Math.abs(a.baseOvr + 2 - ovr) - Math.abs(b.baseOvr + 2 - ovr)).slice(0, 3);
  return rng.pick(close.length ? close : pool);
}

/** After a match (on a draft): old offers expire, listed players draw bids, stars draw interest. */
export function offersAfterMatch(draft: ClubSave): TransferOffer[] {
  const n = draft.matchNumber;
  draft.transfers.offers = draft.transfers.offers.map((o) => (o.status === 'open' && o.expiresAfter < n ? { ...o, status: 'expired' } : o));
  const open = (id: string) => draft.transfers.offers.some((o) => o.playerId === id && o.status === 'open');
  const made: TransferOffer[] = [];
  const offer = (playerId: string, unsolicited: boolean) => {
    const p = draft.footballers[playerId] as Footballer;
    const rng = stream(`${draft.careerSeed}:offer:${n}:${playerId}`, 'market');
    if (!rng.chance(unsolicited ? MARKET.unsolicitedChance : MARKET.listedOfferChance)) return;
    const club = bidderFor(draft, p, unsolicited, rng);
    const fee = Math.round((playerValue(p) * (unsolicited ? 1.35 : rng.range(0.8, 1.25))) / 5) * 5;
    const o: TransferOffer = { id: seededUuid(`${draft.careerSeed}:offer:${n}:${playerId}`), playerId, clubId: club.id, fee, atMatch: n, expiresAfter: n + MARKET.offerOpenFor, unsolicited, status: 'open' };
    made.push(o);
  };
  for (const id of draft.transfers.listed) if (draft.squadIds.includes(id) && !open(id)) offer(id, false);
  if (n >= MARKET.unsolicitedFrom) {
    const star = [...draft.squadIds].filter((id) => !draft.transfers.listed.includes(id) && !open(id)).sort((a, b) => overall(draft.footballers[b]!) - overall(draft.footballers[a]!) || a.localeCompare(b))[0];
    if (star) offer(star, true);
  }
  draft.transfers.offers = [...made, ...draft.transfers.offers].slice(0, 40);
  return made;
}

/** Accepts a bid on a draft: he leaves, the fee arrives, his story records where he went. */
export function acceptOffer(draft: ClubSave, offerId: string): string {
  const o = draft.transfers.offers.find((x) => x.id === offerId);
  if (!o || o.status !== 'open') throw new Error('That offer is no longer on the table.');
  const why = sellBlocker(draft, o.playerId);
  if (why) throw new Error(why);
  const p = draft.footballers[o.playerId] as Footballer;
  const club = clubOf(draft.world, o.clubId);
  draft.coins += o.fee;
  draft.squadIds = draft.squadIds.filter((id) => id !== p.id);
  for (const [slot, id] of Object.entries(draft.lineup)) if (id === p.id) delete draft.lineup[slot];
  if (draft.captainId === p.id) draft.captainId = null;
  if (draft.penaltyTakerId === p.id) draft.penaltyTakerId = null;
  draft.transfers.listed = draft.transfers.listed.filter((id) => id !== p.id);
  draft.transfers.offers = draft.transfers.offers.map((x) => (x.id === o.id ? { ...x, status: 'accepted' } : x.playerId === p.id && x.status === 'open' ? { ...x, status: 'rejected' } : x));
  draft.pendingUpgrades = draft.pendingUpgrades.filter((u) => u.playerId !== p.id);
  draft.dressingRoom.promises = draft.dressingRoom.promises.filter((x) => x.playerId !== p.id);
  draft.dressingRoom.away = draft.dressingRoom.away.filter((x) => x.playerId !== p.id);
  draft.dressingRoom.events = draft.dressingRoom.events.map((e) => (e.status === 'open' && (e.playerId === p.id || e.otherId === p.id) ? { ...e, status: 'resolved', outcome: `${p.lastName} has left the club.` } : e));
  p.history.push({
    id: seededUuid(`${draft.careerSeed}:history:${draft.nextSeq}`),
    kind: 'signed',
    season: draft.season,
    order: draft.nextSeq++,
    headline: `Left for ${club?.name ?? 'another club'} for ${o.fee} coins.`,
  });
  draft.transfers.log.unshift({ kind: 'out', playerId: p.id, name: `${p.firstName} ${p.lastName}`, clubId: o.clubId, fee: o.fee, atMatch: draft.matchNumber, season: draft.season });
  draft.transfers.log = draft.transfers.log.slice(0, 60);
  return `${p.lastName} joins ${club?.name ?? 'his new club'} for ${o.fee} coins.`;
}

/** Turns a bid down. An ambitious star blocked from a bigger club takes it badly. */
export function rejectOffer(draft: ClubSave, offerId: string): string {
  const o = draft.transfers.offers.find((x) => x.id === offerId);
  if (!o || o.status !== 'open') throw new Error('That offer is no longer on the table.');
  o.status = 'rejected';
  const p = draft.footballers[o.playerId];
  if (p && o.unsolicited) {
    const d = p.personality.ambition >= 65 ? -8 : p.personality.loyalty >= 65 ? 4 : -2;
    p.morale = clampMorale(p.morale + d);
    return d < 0 ? `${p.lastName} wanted that move. He's not happy (${d} morale).` : `${p.lastName} is glad to stay (+${d} morale).`;
  }
  return 'Offer turned down.';
}

/** A player who has left: where he went (from the log). */
export function departureOf(save: Pick<ClubSave, 'transfers'>, playerId: string) {
  return save.transfers.log.find((x) => x.kind === 'out' && x.playerId === playerId);
}
