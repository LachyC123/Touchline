import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../accessibility/motion';
import { playSfx } from '../../audio/sfx';
import { useSave } from '../../app/GameContext';
import { CoachMark } from '../../components/ui/CoachMark';
import { tipPending } from '../../domain/club/onboarding';
import { PACK_DEFS } from '../../domain/packs/packs';
import { PLAYER_CLUB_ID, type MatchMoment } from '../../domain/save/types';
import { clubName, divisionOf, leagueTable, ordinal, seasonComplete } from '../../domain/league/league';
import { fatesSealedIn, roundHeadline, type Fate } from '../../domain/league/stories';
import { Trophy } from '../../components/league/Trophy';
import { navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { Crest } from '../../components/club/Crest';
import { Icon, type IconName } from '../../components/icons/Icon';
import { Button } from '../../components/ui/Button';
import { Confetti } from '../../components/ui/Confetti';
import { ManagerCard } from '../../components/manager/ManagerCard';
import { useCountUp } from '../../components/ui/useCountUp';
import { CLUB_BY_ID } from '../../data/clubs';
import { xpToNext } from '../../domain/players/progression';
import { UpgradePicker } from './UpgradePicker';
import './result.css';

const FATE_ORDER: Fate[] = ['champions', 'promoted', 'safe', 'relegated'];

/** The single most important thing this round settled for the player's season, if anything. */
function sealedFate(league: Parameters<typeof fatesSealedIn>[0], round: number | undefined, sameSeason: boolean): Fate | null {
  if (!sameSeason || round === undefined) return null;
  const sealed = fatesSealedIn(league, round);
  return FATE_ORDER.find((f) => sealed.includes(f)) ?? null;
}

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
  useEffect(() => {
    if (!record || !fresh) return;
    const ours = record.score[record.userSide];
    const theirs = record.score[record.userSide === 'home' ? 'away' : 'home'];
    if (ours > theirs || fate === 'champions' || fate === 'promoted') playSfx('cheer');
    else if (ours === theirs || fate === 'safe') playSfx('chime');
  }, [record, fresh, fate]);

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

  const opp = CLUB_BY_ID[record.opponentId];
  const us = record.userSide;
  const them = us === 'home' ? 'away' : 'home';
  const gf = record.score[us];
  const ga = record.score[them];
  const verdict = gf > ga ? 'Win' : gf === ga ? 'Draw' : 'Defeat';
  const homeName = us === 'home' ? save.club.shortName : (opp?.shortName ?? 'OPP');
  const awayName = us === 'home' ? (opp?.shortName ?? 'OPP') : save.club.shortName;
  const homeCrest = us === 'home' ? save.club : opp;
  const awayCrest = us === 'home' ? opp : save.club;
  const potm = save.footballers[record.playerOfMatchId];
  const pack = record.packId ? save.packs.find((p) => p.id === record.packId) : undefined;
  const firstRun = save.onboarding === 'club';
  // League context (only while that season is still the current one).
  const roundResults = sameSeason ? save.league.results.filter((r) => r.round === record.round) : [];
  const nameFn = (id: string) => clubName(id, save.club.name);
  const posAt = (rounds: number) => leagueTable({ rounds: save.league.rounds, results: save.league.results.filter((r) => r.round < rounds) }, nameFn).findIndex((r) => r.clubId === PLAYER_CLUB_ID) + 1;
  const posAfter = sameSeason ? posAt((record.round ?? 0) + 1) : 0;
  const posBefore = sameSeason && (record.round ?? 0) > 0 ? posAt(record.round ?? 0) : null;
  const headline = sameSeason ? roundHeadline(save.league, record.round ?? 0, save.club.name) : null;
  const seasonOver = !save.pendingMatch && seasonComplete(save.league) && sameSeason;
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
    <main className={`screen result result--${verdict.toLowerCase()}`}>
      <section className="result__hero" aria-label={`Full time: ${verdict} ${gf}–${ga} against ${record.opponentName}`}>
        {fresh && !reduced && (gf > ga || fate === 'champions' || fate === 'promoted') && <Confetti count={26} colours={[save.club.kit.primary, save.club.kit.secondary, '#CBF238', '#F4C653']} />}
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

      {fate && (
        <section className={`result__sealed result__sealed--${fate}`} role="status">
          {(fate === 'champions' || fate === 'promoted') && <Trophy kind={fate === 'champions' ? 'cup' : 'pennant'} ribbon={save.club.kit.primary} trim={save.club.kit.secondary} size={84} />}
          <div>
            <p className="result__sealed-title">{FATE_TITLE[fate]}</p>
            <p className="result__sealed-line">{fateLine(fate, save.league.rounds.length - (record.round ?? 0) - 1, divisionOf(save.league.division))}</p>
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
                <span className="lf__home">{clubName(r.home, save.club.name)}</span>
                <span className="lf__score">
                  {r.hg}–{r.ag}
                </span>
                <span className="lf__away">{clubName(r.away, save.club.name)}</span>
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

      <section className="result__rewards paper" aria-label="Rewards">
        <div className="result__coins">
          <span className="club__coin" aria-hidden="true" />
          <b>+{coins}</b>
          <span>coins</span>
          <span className="result__clubxp">+{record.rewards.clubXp} club XP</span>
        </div>
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
        <section className="result__upgrades" aria-label="Level-ups">
          <h2 className="eyebrow">Choose a training focus</h2>
          {tipPending(save, 'upgrade') && (
            <CoachMark className="result__coach">
              <b>Level up!</b> Training choices are permanent: pick the focus that suits how you want him to play. The stat change shows straight away.
            </CoachMark>
          )}
          {upgrades.map((u) => {
            const p = save.footballers[u.playerId];
            return p ? <UpgradePicker key={`${u.playerId}-${u.level}`} upgrade={u} player={p} kit={save.club.kit} /> : null;
          })}
        </section>
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
        {seasonOver ? (
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
