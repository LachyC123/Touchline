import { describe, expect, it } from 'vitest';
import { createCareer } from '../club/newCareer';
import { opponentSquad } from '../club/opponents';
import { strengthLap } from '../league/league';
import { overall } from '../players/rating';
import { clubOf } from '../world/world';
import { acceptOffer, buyBlocker, buyListing, haggle, haggleOf, marketListings, MARKET, offersAfterMatch, playerValue, priceOf, rejectOffer, sellBlocker, setListed } from './market';

describe('the transfer market', () => {
  it('a list per window: the same save sees the same players, a new window brings new ones', () => {
    const s = createCareer('market-1', 'x');
    const a = marketListings(s);
    expect(a.length).toBe(MARKET.fromClubs + MARKET.freeAgents);
    expect(marketListings(structuredClone(s))).toEqual(a);
    s.matchNumber = MARKET.every;
    const b = marketListings(s);
    expect(b.map((l) => l.id)).not.toEqual(a.map((l) => l.id));
    for (const l of a) {
      expect(l.price).toBeGreaterThan(0);
      expect(l.price % 5).toBe(0);
      if (l.fromClubId) {
        // A real first-team player from that club in this world.
        const club = clubOf(s.world, l.fromClubId)!;
        expect(opponentSquad(s.careerSeed, club, strengthLap(s.season)).some((p) => p.id === l.player.id)).toBe(true);
      }
    }
  });

  it('value follows rating, upside and age', () => {
    const s = createCareer('market-2', 'x');
    const ps = s.squadIds.map((id) => s.footballers[id]!).sort((a, b) => overall(a) - overall(b));
    expect(playerValue(ps.at(-1)!)).toBeGreaterThanOrEqual(playerValue({ ...ps[0]!, potential: overall(ps[0]!) }));
    const p = ps[3]!;
    expect(playerValue({ ...p, age: 33 })).toBeLessThan(playerValue({ ...p, age: 25 }));
  });

  it('buying: costs the price, joins the squad excited, leaves his old club, and is gone from the list', () => {
    const s = createCareer('market-3', 'x');
    s.coins = 5000;
    s.club.reputation = 200;
    const l = marketListings(s).find((x) => x.fromClubId)!;
    const p = buyListing(s, l.id);
    expect(s.coins).toBe(5000 - l.price);
    expect(s.squadIds).toContain(p.id);
    expect(p.morale).toBeGreaterThanOrEqual(MARKET.signingMorale);
    expect(p.history.at(-1)?.headline).toMatch(/^Signed from /);
    expect(s.world.departed).toContain(p.id);
    expect(marketListings(s).some((x) => x.id === l.id)).toBe(false);
    const club = clubOf(s.world, l.fromClubId!)!;
    expect(opponentSquad(s.careerSeed, club, strengthLap(s.season), s.world).some((x) => x.id === p.id)).toBe(false);
    expect(() => buyListing(s, l.id)).toThrow(/no longer/);
  });

  it('ambitious players want a club with a name; money and squad space are checked', () => {
    const s = createCareer('market-4', 'x');
    s.coins = 0;
    s.club.reputation = 0;
    for (const l of marketListings(s)) {
      const why = buyBlocker(s, l);
      if (l.wantsRep > 0) expect(why).toMatch(/club \(reputation/);
      else expect(why).toMatch(/coins/);
    }
  });

  it('one haggle per player, decided by a seed, never re-rolled', () => {
    const s = createCareer('market-5', 'x');
    const l = marketListings(s)[0]!;
    const t = structuredClone(s);
    const won = haggle(s, l.id);
    expect(haggle(t, l.id)).toBe(won);
    expect(haggleOf(s, l.id)).toBe(won);
    expect(priceOf(s, l)).toBe(Math.round((l.price * (won ? 0.8 : 1.1)) / 5) * 5);
    expect(() => haggle(s, l.id)).toThrow(/already/);
  });

  it('selling: list him (it stings), bids arrive after matches, accepting moves him on cleanly', () => {
    const s = createCareer('market-6', 'x');
    const id = s.lineup.FWD_R!;
    s.captainId = id;
    const before = s.footballers[id]!.morale;
    setListed(s, id, true);
    expect(s.footballers[id]!.morale).toBeLessThan(before);
    let offer;
    for (let i = 0; i < 10 && !offer; i++) {
      s.matchNumber++;
      offer = offersAfterMatch(s).find((o) => o.playerId === id);
    }
    expect(offer).toBeDefined();
    const coins = s.coins;
    acceptOffer(s, offer!.id);
    expect(s.coins).toBe(coins + offer!.fee);
    expect(s.squadIds).not.toContain(id);
    expect(Object.values(s.lineup)).not.toContain(id);
    expect(s.captainId).toBeNull();
    expect(s.footballers[id]!.history.at(-1)?.headline).toMatch(/^Left for /);
    expect(s.transfers.log[0]).toMatchObject({ kind: 'out', playerId: id, fee: offer!.fee });
    expect(() => acceptOffer(s, offer!.id)).toThrow(/no longer/);
  });

  it('big clubs come in for stars unasked; turning them down upsets the ambitious', () => {
    let found = false;
    for (let k = 0; k < 40 && !found; k++) {
      const s = createCareer(`market-7-${k}`, 'x');
      s.matchNumber = MARKET.unsolicitedFrom;
      const o = offersAfterMatch(s).find((x) => x.unsolicited);
      if (!o) continue;
      found = true;
      const p = s.footballers[o.playerId]!;
      const m = p.morale;
      rejectOffer(s, o.id);
      if (p.personality.ambition >= 65) expect(p.morale).toBeLessThan(m);
    }
    expect(found).toBe(true);
  });

  it('you cannot sell your only keeper or drop below nine players', () => {
    const s = createCareer('market-8', 'x');
    expect(sellBlocker(s, s.lineup.GK!)).toMatch(/only goalkeeper/);
    s.squadIds = s.squadIds.slice(0, MARKET.squadMin);
    expect(sellBlocker(s, s.squadIds[1]!)).toMatch(/at least/);
  });
});
