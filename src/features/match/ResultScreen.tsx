import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../accessibility/motion';
import { playSfx } from '../../audio/sfx';
import { useSave } from '../../app/GameContext';
import { CoachMark } from '../../components/ui/CoachMark';
import { tipPending } from '../../domain/club/onboarding';
import { PACK_DEFS } from '../../domain/packs/packs';
import { PLAYER_CLUB_ID, type ClubSave, type MatchMoment, type RecordMilestone } from '../../domain/save/types';
import { clubName, divisionOf, leagueTable, ordinal, seasonOver } from '../../domain/league/league';
import { fatesSealedIn, roundHeadline, type Fate } from '../../domain/league/stories';
import { Trophy } from '../../components/league/Trophy';
import { CUP_NAME, CUP_ROUNDS, cupRoundName } from '../../domain/cup/cup';
import { ShootoutReveal } from './ShootoutReveal';
import { MoraleMeter } from '../../components/players/MoraleMeter';
import { eventHeadline } from '../../domain/club/dressingRoom';
import { navigate } from '../../app/router';
import { repTier } from '../../domain/club/reputation';
import { RepTierUp } from './RepTierUp';
import { PhysioCard } from '../physio/PhysioCard';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { Crest } from '../../components/club/Crest';
import { Icon, type IconName } from '../../components/icons/Icon';
import { Button } from '../../components/ui/Button';
import { Confetti } from '../../components/ui/Confetti';
import { ManagerCard } from '../../components/manager/ManagerCard';
import { useCountUp } from '../../components/ui/useCountUp';
import { xpToNext } from '../../domain/players/progression';
import { UpgradeQueue } from './UpgradeQueue';
import './result.css';
import { clubOf } from '../../domain/world/world';

/** Who we drew in the next cup round (the draw is made as soon as a round finishes). */
function nextCupOpponent(save: Pick<ClubSave, 'cup' | 'club' | 'world'>, round: number): string {
  const tie = save.cup?.rounds[round + 1]?.find((t) => t.home === PLAYER_CLUB_ID || t.away === PLAYER_CLUB_ID);
  if (!tie) return 'the next opponents';
  return clubName(save.world, tie.home === PLAYER_CLUB_ID ? tie.away : tie.home, save.club.name);
}

const FATE_ORDER: Fate[] = ['champions', 'promoted', 'safe', 'relegated'];

/** The single most important thing this round settled for the player's season, if anything. */
function sealedFate(league: Parameters<typeof fatesSealedIn>[0], round: number | undefined, sameSeason: boolean): Fate | null {
  if (!sameSeason || round === undefined) return null;
  const sealed = fatesSealedIn(league, round);
  return FATE_ORDER.find((f) => sealed.includes(f)) ?? null;
}

const MILESTONE_ICON: Record<RecordMilestone['kind'], IconName> = {
  debut: 'shirt',
  firstGoal: 'boot',
  hatTrick: 'starFilled',
  goals: 'boot',
  assists: 'feet',
  apps: 'shirt',
  firstCleanSheet: 'glove',
  cleanSheets: 'glove',
};

const FATE_TITLE: Record<Fate, string> = {
  champions: 'Champions!',
  promoted: 'Promotion sealed!',
  safe: 'Safe!',
  relegated: 'Relegated',
};

function fateLine(fate: Fate, left: number, div: { name: string; promote: number }): string {
  const spare = left > 0 ? ` with ${left} game${left === 1 ? '' : 's'} to spare` : '';
  if (fate === 'champions') return `Nobody can catch you now — the title${div.promote > 0 ? ' and promotion are' : ' is'} yours${spare}.`;
  if (fate === 'promoted') return `A top-two finish is guaranteed${spare}. Bigger clubs await next season.`;
  if (fate === 'safe') return `Nobody can drag you into the bottom two now${spare}.`;
  return 'It’s confirmed: the drop. Finish strong and come straight back up.';
}

const MOMENT_ICON: Record<MatchMoment['kind'], IconName> = {
  screamer: 'bolt',
  header: 'pulse',
  freeKick: 'curve',
  penalty: 'target',
  penaltyMiss: 'glove',
  doubleSave: 'glove',
  save: 'glove',
  skill: 'feet',
  booking: 'whistle',
  woodwork: 'wall',
  sub: 'shirt',
};

export function ResultScreen({ id }: { id: string }) {
  const save = useSave();
  const reduced = useReducedMotion();
  const record = save.matchRecords.find((r) => r.matchId === id);
  const [fresh] = useState(() => record?.matchId === save.matchRecords[0]?.matchId);
  const coins = useCountUp(record?.rewards.coins ?? 0, 900, fresh && !reduced);
  // Keep the pickers that were open when the screen loaded so each confirmation stays visible.
  const [upgrades] = useState(() => save.pendingUpgrades);

  const sameSeason = record?.season !== undefined && record.season === save.season && record.round !== undefined;
  const fate = sealedFate(save.league, record?.round, sameSeason);
  // Cup: our tie in this season's draw (only while that cup is the current one).
  const cupTie = record?.competition === 'cup' && save.cup && save.cup.season === record.season ? save.cup.rounds[record.cupRound ?? 0]?.find((t) => t.home === PLAYER_CLUB_ID || t.away === PLAYER_CLUB_ID) : undefined;
  const cupThrough = cupTie?.winner === PLAYER_CLUB_ID;
  const cupWon = cupThrough && record?.cupRound === CUP_ROUNDS.length - 1;
  useEffect(() => {
    if (!record || !fresh) return;
    const ours = record.score[record.userSide];
    const theirs = record.score[record.userSide === 'home' ? 'away' : 'home'];
    if (ours > theirs || fate === 'champions' || fate === 'promoted' || cupWon || record.dreams?.length) playSfx('cheer');
    else if ((ours === theirs && !record.shootout) || fate === 'safe') playSfx('chime');
  }, [record, fresh, fate, cupWon]);

  if (!record) {
    return (
      <main className="screen">
        <div className="paper result__missing">
          <p className="display">Result not found</p>
          <Button variant="primary" onClick={() => navigate({ name: 'match' })}>
            Matchday
          </Button>
        </div>
      </main>
    );
  }

  const opp = clubOf(save.world, record.opponentId);
  const us = record.userSide;
  const them = us === 'home' ? 'away' : 'home';
  const gf = record.score[us];
  const ga = record.score[them];
  const outcome = gf > ga ? 'win' : gf === ga ? 'draw' : 'defeat';
  const verdict = record.shootout ? (record.shootout.winner === us ? 'Won on penalties' : 'Lost on penalties') : gf > ga ? 'Win' : gf === ga ? 'Draw' : 'Defeat';
  const isCup = record.competition === 'cup';
  const homeName = us === 'home' ? save.club.shortName : (opp?.shortName ?? 'OPP');
  const awayName = us === 'home' ? (opp?.shortName ?? 'OPP') : save.club.shortName;
  const homeCrest = us === 'home' ? save.club : opp;
  const awayCrest = us === 'home' ? opp : save.club;
  const potm = save.footballers[record.playerOfMatchId];
  const pack = record.packId ? save.packs.find((p) => p.id === record.packId) : undefined;
  const firstRun = save.onboarding === 'club';
  // League context (only while that season is still the current one).
  const roundResults = sameSeason ? save.league.results.filter((r) => r.round === record.round) : [];
  const nameFn = (id: string) => clubName(save.world, id, save.club.name);
  const posAt = (rounds: number) => leagueTable({ rounds: save.league.rounds, results: save.league.results.filter((r) => r.round < rounds) }, nameFn).findIndex((r) => r.clubId === PLAYER_CLUB_ID) + 1;
  const posAfter = sameSeason ? posAt((record.round ?? 0) + 1) : 0;
  const posBefore = sameSeason && (record.round ?? 0) > 0 ? posAt(record.round ?? 0) : null;
  // Dressing-room fallout from this match: news and any new knock on the door.
  const roomNews = fresh ? save.dressingRoom.events.filter((e) => e.atMatch === record.number) : [];
  const headline = sameSeason ? roundHeadline(save.world, save.league, record.round ?? 0, save.club.name) : null;
  const seasonEnded = !save.pendingMatch && seasonOver(save) && sameSeason;
  const gains = [...record.gains].filter((g) => save.footballers[g.playerId]).sort((a, b) => b.xp - a.xp);
  const stats: [string, number | string, number | string, number, number][] = [
    ['Possession', `${record.stats.possession.home}%`, `${record.stats.possession.away}%`, record.stats.possession.home, record.stats.possession.away],
    ['Shots', record.stats.shots.home, record.stats.shots.away, record.stats.shots.home, record.stats.shots.away],
    ['On target', record.stats.onTarget.home, record.stats.onTarget.away, record.stats.onTarget.home, record.stats.onTarget.away],
    ['Chance quality (xG)', record.stats.xg.home.toFixed(2), record.stats.xg.away.toFixed(2), record.stats.xg.home, record.stats.xg.away],
    ['Saves', record.stats.saves.home, record.stats.saves.away, record.stats.saves.home, record.stats.saves.away],
    ['Passes', record.stats.passes.home, record.stats.passes.away, record.stats.passes.home, record.stats.passes.away],
  ];

  return (
    <main className={`screen result result--${outcome}`}>
      <section className="result__hero" aria-label={`Full time: ${verdict} ${gf}–${ga} against ${record.opponentName}`}>
        {fresh && !reduced && (gf > ga || fate === 'champions' || fate === 'promoted' || cupThrough) && <Confetti count={26} colours={[save.club.kit.primary, save.club.kit.secondary, '#CBF238', '#F4C653']} />}
        {isCup && <p className="result__comp">{`${CUP_NAME} · ${cupRoundName(record.cupRound ?? 0)}`}</p>}
        <p className="result__ft">Full time · {verdict}</p>
        <div className="result__score">
          <div className="result__team">
            {homeCrest && <Crest club={homeCrest} size={56} />}
            <span>{homeName}</span>
          </div>
          <b>
            {record.score.home}
            <i>–</i>
            {record.score.away}
          </b>
          <div className="result__team">
            {awayCrest && <Crest club={awayCrest} size={56} />}
            <span>{awayName}</span>
          </div>
        </div>
        {record.scorers.length > 0 && (
          <ul className="result__scorers">
            {record.scorers.map((s, i) => (
              <li key={i} className={s.side === us ? 'is-ours' : ''}>
                {record.replay ? (
                  <button type="button" className="result__replay" onClick={() => navigate({ name: 'replay', id: record.matchId, goal: i })} aria-label={`Watch replay of ${s.name}'s goal, ${s.minute} minutes`}>
                    <Icon name="play" size={14} /> {s.name} {s.minute}'{s.assistName ? <small> (ast. {s.assistName})</small> : null}
                  </button>
                ) : (
                  <>
                    <Icon name="boot" size={14} /> {s.name} {s.minute}'{s.assistName ? <small> (ast. {s.assistName})</small> : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {record.shootout && <ShootoutReveal shootout={record.shootout} us={us} names={{ home: homeName, away: awayName }} animate={fresh && !reduced} />}

      {cupTie && (
        <section className={`result__sealed result__sealed--${cupWon ? 'champions' : cupThrough ? 'safe' : 'relegated'}`} role="status">
          {cupWon && <Trophy kind="jug" ribbon={save.club.kit.primary} trim={save.club.kit.secondary} size={84} />}
          <div>
            <p className="result__sealed-title">{cupWon ? 'Cup winners!' : cupThrough ? `Into the ${cupRoundName((record.cupRound ?? 0) + 1).toLowerCase()}!` : 'Out of the cup'}</p>
            <p className="result__sealed-line">
              {cupWon
                ? `The ${CUP_NAME} is yours. It goes straight into the trophy cabinet.`
                : cupThrough
                  ? `Drawn against ${nextCupOpponent(save, record.cupRound ?? 0)} — after a few more league games.`
                  : `Knocked out in the ${cupRoundName(record.cupRound ?? 0).toLowerCase()} by ${record.opponentName}.`}
            </p>
          </div>
        </section>
      )}

      {fate && (
        <section className={`result__sealed result__sealed--${fate}`} role="status">
          {(fate === 'champions' || fate === 'promoted') && <Trophy kind={fate === 'champions' ? 'cup' : 'pennant'} ribbon={save.club.kit.primary} trim={save.club.kit.secondary} size={84} />}
          <div>
            <p className="result__sealed-title">{FATE_TITLE[fate]}</p>
            <p className="result__sealed-line">{fateLine(fate, save.league.rounds.length - (record.round ?? 0) - 1, divisionOf(save.world, save.league.division))}</p>
          </div>
        </section>
      )}

      <article className="result__story paper">
        <p className="result__paper">The Touchline Post</p>
        <h2>{record.storyHeadline}</h2>
      </article>

      {roundResults.length > 0 && (
        <section className="result__league panel" aria-labelledby="around-title">
          <div className="result__league-head">
            <h2 id="around-title" className="eyebrow">
              Around the league · round {(record.round ?? 0) + 1}
            </h2>
            <span className="result__pos">
              {ordinal(posAfter)}
              {posBefore && posBefore !== posAfter ? <small className={posAfter < posBefore ? 'is-up' : 'is-down'}>{posAfter < posBefore ? `▲${posBefore - posAfter}` : `▼${posAfter - posBefore}`}</small> : null}
            </span>
          </div>
          {headline && <p className="result__league-headline">{headline}</p>}
          <ul>
            {roundResults.map((r) => (
              <li key={`${r.home}-${r.away}`} className={r.home === PLAYER_CLUB_ID || r.away === PLAYER_CLUB_ID ? 'is-us' : ''}>
                <span className="lf__home">{clubName(save.world, r.home, save.club.name)}</span>
                <span className="lf__score">
                  {r.hg}–{r.ag}
                </span>
                <span className="lf__away">{clubName(save.world, r.away, save.club.name)}</span>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" icon="sort" onClick={() => navigate({ name: 'league' })}>
            League table
          </Button>
        </section>
      )}

      {record.moments && record.moments.length > 0 && (
        <section className="result__moments panel" aria-labelledby="moments-title">
          <h2 id="moments-title" className="eyebrow">
            Key moments
          </h2>
          <ol>
            {record.moments.map((m, i) => (
              <li key={i} className={`result__moment ${m.side === us ? 'is-ours' : ''}`}>
                <span className="result__moment-min">{m.minute}'</span>
                <span className="result__moment-icon" aria-hidden="true">
                  <Icon name={MOMENT_ICON[m.kind]} size={16} />
                </span>
                <span className="result__moment-text">{m.text}</span>
                {m.stat && <span className="result__moment-stat">{m.stat}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {record.injuries && record.injuries.length > 0 && (
        <section className="result__physio" aria-labelledby="physio-title">
          <h2 id="physio-title" className="eyebrow">
            Physio’s room
          </h2>
          {save.injuries
            .filter((i) => i.matchId === record.matchId)
            .map((i) => (
              <PhysioCard key={i.id} injury={i} />
            ))}
        </section>
      )}

      {fresh && save.transfers.offers.some((o) => o.atMatch === record.number && o.status === 'open') && (
        <section className="result__offers" aria-labelledby="offers-title">
          <h2 id="offers-title" className="eyebrow">
            The phone rang
          </h2>
          {save.transfers.offers
            .filter((o) => o.atMatch === record.number && o.status === 'open')
            .map((o) => (
              <button key={o.id} type="button" className="result__offer" onClick={() => navigate({ name: 'market' })}>
                <b>{clubOf(save.world, o.clubId)?.name ?? 'A club'}</b> bid <b>{o.fee}</b> for {save.footballers[o.playerId]?.lastName ?? 'one of yours'}
                {o.unsolicited ? ' (unasked)' : ''}. Answer in the market.
              </button>
            ))}
        </section>
      )}

      {record.repTier && <RepTierUp tierId={record.repTier} rep={save.club.reputation} stadiumLevel={save.club.stadiumLevel} animate={fresh && !reduced} colours={[save.club.kit.primary, save.club.kit.secondary]} />}

      {record.milestones && record.milestones.length > 0 && (
        <section className="result__milestones" aria-labelledby="milestones-title">
          <h2 id="milestones-title" className="eyebrow">
            Milestones
          </h2>
          <ul>
            {record.milestones.map((m, i) => {
              const p = save.footballers[m.playerId];
              return (
                <li key={`${m.playerId}-${m.kind}`} style={{ animationDelay: `${200 + i * 120}ms` }}>
                  <button type="button" className={`result__milestone result__milestone--${m.kind}`} onClick={() => navigate({ name: 'player', id: m.playerId })} disabled={!p}>
                    <span className="result__milestone-icon" aria-hidden="true">
                      <Icon name={MILESTONE_ICON[m.kind]} size={20} />
                    </span>
                    <span>
                      <b>{m.name}</b>
                      <small>{m.text}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {record.dreams && record.dreams.length > 0 && (
        <section className="result__dreams" aria-labelledby="dreams-title">
          {fresh && !reduced && <Confetti count={30} colours={['#F4C653', '#FFF7E9', save.club.kit.primary, '#CBF238']} />}
          <h2 id="dreams-title" className="result__dreams-title">
            Dream come true
          </h2>
          {record.dreams.map((d) => {
            const p = save.footballers[d.playerId];
            return (
              <button key={d.playerId} type="button" className="result__dream" onClick={() => navigate({ name: 'player', id: d.playerId })}>
                {p && (
                  <span className="result__dream-card">
                    <FootballerCard player={p} kit={save.club.kit} variant="mini" />
                  </span>
                )}
                <span>
                  <b>{d.name}</b>
                  <small>“{d.text}”</small>
                </span>
              </button>
            );
          })}
        </section>
      )}

      {(record.morale?.length || roomNews.length > 0) && (
        <section className="result__room panel" aria-labelledby="room-title">
          <h2 id="room-title" className="eyebrow">
            Dressing room
          </h2>
          {roomNews.map((e) => (
            <button key={e.id} type="button" className={`result__room-news ${e.status === 'open' ? 'is-open' : e.kind === 'promiseBroken' ? 'is-bad' : 'is-good'}`} onClick={() => navigate({ name: 'event', id: e.id })}>
              {e.status === 'open' ? `${eventHeadline(e, save)} — hear ${e.playerId ? 'him' : 'them'} out` : e.outcome}
            </button>
          ))}
          {record.morale && record.morale.length > 0 && (
            <ul className="result__room-list">
              {record.morale.map((m) => {
                const p = save.footballers[m.playerId];
                return (
                  <li key={m.playerId}>
                    {p && <MoraleMeter morale={p.morale} compact />}
                    <span className="result__room-name">{p?.lastName ?? m.name}</span>
                    <span className="result__room-why">{m.reasons.join(', ')}</span>
                    <b className={m.delta > 0 ? 'is-up' : 'is-down'}>
                      {m.delta > 0 ? '▲' : '▼'}
                      {Math.abs(m.delta)}
                    </b>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section className="result__rewards paper" aria-label="Rewards">
        <div className="result__coins">
          <span className="club__coin" aria-hidden="true" />
          <b>+{coins}</b>
          <span>coins</span>
          <span className="result__clubxp">+{record.rewards.clubXp} club XP</span>
        </div>
        {Boolean(record.repGain || record.attendance) && (
          <p className="result__rep">
            {record.attendance ? `${record.attendance.toLocaleString('en-GB')} at ${save.club.stadiumName}. ` : ''}
            {record.repGain ? (
              <b>
                +{record.repGain} reputation · {repTier(save.club.reputation).label} club
              </b>
            ) : null}
          </p>
        )}
        <ul className="result__lines">
          {record.rewards.lines.map((l) => (
            <li key={l.label}>
              <span>{l.label}</span>
              <span>{l.coins > 0 ? `+${l.coins}` : ''}</span>
            </li>
          ))}
        </ul>
        {pack && (
          <button type="button" className={`result__pack ${pack.playerId ? 'is-opened' : ''}`} onClick={() => navigate(pack.playerId ? { name: 'scout' } : { name: 'pack', id: pack.id })}>
            <Icon name="pack" size={22} />
            <span>
              <b>{PACK_DEFS[pack.kind].name} pack earned</b>
              <small>{pack.playerId ? 'Opened — see the Scout room' : 'Tap to open it now'}</small>
            </span>
          </button>
        )}
        {record.unlockedCards && record.unlockedCards.length > 0 && (
          <div className="result__unlock">
            <p className="result__unlock-title">Manager level up — new card{record.unlockedCards.length > 1 ? 's' : ''}!</p>
            <div className="result__unlock-cards">
              {record.unlockedCards.map((id) => (
                <ManagerCard key={id} id={id} />
              ))}
            </div>
            <Button variant="blue" size="sm" block icon="flip" onClick={() => navigate({ name: 'cards' })}>
              {save.deck.some((c) => record.unlockedCards?.includes(c)) ? 'Added to your deck — view deck' : 'Add it to your deck'}
            </Button>
          </div>
        )}
        <h3 className="result__xp-title">Player XP</h3>
        <ul className="result__xp">
          {gains.slice(0, 10).map((g) => {
            const p = save.footballers[g.playerId]!;
            const need = xpToNext(p.level);
            const levelled = g.levelAfter > g.levelBefore;
            return (
              <li key={g.playerId}>
                <button type="button" onClick={() => navigate({ name: 'player', id: p.id })}>
                  <span className="result__xp-name">{p.lastName}</span>
                  <span className="result__xp-bar">
                    <span style={{ width: `${Math.min(100, (p.xp / need) * 100)}%` }} />
                  </span>
                  <span className="result__xp-gain">+{g.xp}</span>
                  {levelled && <span className="result__lvl">LV {g.levelAfter}!</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {upgrades.length > 0 && (
        <div className="result__upgrades">
          <UpgradeQueue heading="Choose a training focus">
            {tipPending(save, 'upgrade') && (
              <CoachMark className="result__coach">
                <b>Level up!</b> Training choices are permanent: pick the focus that suits how you want him to play. The stat change shows straight away.
              </CoachMark>
            )}
          </UpgradeQueue>
        </div>
      )}

      <section className="result__potm">
        <div className="result__potm-card">
          {potm ? (
            <FootballerCard player={potm} kit={save.club.kit} variant="standard" onActivate={() => navigate({ name: 'player', id: potm.id })} showNewSticker={false} />
          ) : (
            <div className="result__potm-opp paper">
              <p className="display">{record.playerOfMatchName}</p>
              <p>{record.opponentName}</p>
            </div>
          )}
        </div>
        <div className="result__potm-copy">
          <p className="eyebrow">Player of the match</p>
          <p className="result__potm-name">{record.playerOfMatchName}</p>
          <p className="result__potm-rating">
            <b>{record.playerOfMatchRating.toFixed(1)}</b> rating
          </p>
        </div>
      </section>

      <section className="result__stats panel" aria-label="Match stats">
        {stats.map(([label, h, a, hv, av]) => {
          const total = hv + av || 1;
          return (
            <div key={label} className="result__stat">
              <span className="result__stat-v">{h}</span>
              <span className="result__stat-mid">
                <span className="result__stat-label">{label}</span>
                <span className="result__stat-bar">
                  <span className={us === 'home' ? 'is-ours' : ''} style={{ width: `${(hv / total) * 100}%` }} />
                  <span className={us === 'away' ? 'is-ours' : ''} style={{ width: `${(av / total) * 100}%` }} />
                </span>
              </span>
              <span className="result__stat-v">{a}</span>
            </div>
          );
        })}
      </section>

      <div className="result__actions">
        <Button variant="ghost" icon="club" onClick={() => navigate({ name: 'club' })}>
          Club
        </Button>
        {seasonEnded ? (
          <Button variant="primary" size="lg" icon="star" onClick={() => navigate({ name: 'season' })}>
            Final day
          </Button>
        ) : firstRun ? (
          <Button variant="primary" size="lg" icon="shield" onClick={() => navigate({ name: 'setup' })}>
            Make it yours
          </Button>
        ) : (
          <Button variant="primary" size="lg" icon="whistle" onClick={() => navigate({ name: 'match' })}>
            Next match
          </Button>
        )}
      </div>
    </main>
  );
}
