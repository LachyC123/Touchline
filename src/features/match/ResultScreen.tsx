import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../accessibility/motion';
import { playSfx } from '../../audio/sfx';
import { useSave } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { Crest } from '../../components/club/Crest';
import { Icon } from '../../components/icons/Icon';
import { Button } from '../../components/ui/Button';
import { CLUB_BY_ID } from '../../data/clubs';
import { xpToNext } from '../../domain/players/progression';
import { UpgradePicker } from './UpgradePicker';
import './result.css';

function useCountUp(target: number, ms: number, enabled: boolean): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let lastTick = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const next = Math.round(target * (1 - Math.pow(1 - t, 3)));
      setV(next);
      if (next - lastTick >= 12) {
        lastTick = next;
        playSfx('coin');
      }
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, enabled]);
  return enabled ? v : target;
}

export function ResultScreen({ id }: { id: string }) {
  const save = useSave();
  const reduced = useReducedMotion();
  const record = save.matchRecords.find((r) => r.matchId === id);
  const [fresh] = useState(() => record?.matchId === save.matchRecords[0]?.matchId);
  const coins = useCountUp(record?.rewards.coins ?? 0, 900, fresh && !reduced);
  // Keep the pickers that were open when the screen loaded so each confirmation stays visible.
  const [upgrades] = useState(() => save.pendingUpgrades);

  useEffect(() => {
    if (!record || !fresh) return;
    const ours = record.score[record.userSide];
    const theirs = record.score[record.userSide === 'home' ? 'away' : 'home'];
    if (ours > theirs) playSfx('chime');
  }, [record, fresh]);

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

      <article className="result__story paper">
        <p className="result__paper">The Touchline Post</p>
        <h2>{record.storyHeadline}</h2>
      </article>

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
              <span>+{l.coins}</span>
            </li>
          ))}
        </ul>
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
          {upgrades.map((u) => {
            const p = save.footballers[u.playerId];
            return p ? <UpgradePicker key={`${u.playerId}-${u.level}`} upgrade={u} player={p} kit={save.club.kit} /> : null;
          })}
        </section>
      )}

      <div className="result__actions">
        <Button variant="ghost" icon="club" onClick={() => navigate({ name: 'club' })}>
          Club
        </Button>
        <Button variant="primary" size="lg" icon="whistle" onClick={() => navigate({ name: 'match' })}>
          Next match
        </Button>
      </div>
    </main>
  );
}
