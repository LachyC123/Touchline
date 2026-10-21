import { useState } from 'react';
import { useReducedMotion } from '../../accessibility/motion';
import { playSfx } from '../../audio/sfx';
import { useGame, useSave } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { Crest } from '../../components/club/Crest';
import { Button } from '../../components/ui/Button';
import { Confetti } from '../../components/ui/Confetti';
import { useToast } from '../../components/ui/Toast';
import { clubName, divisionOf, leagueTable, ordinal, SEASON_CLUB_XP, seasonComplete, seasonOutcome } from '../../domain/league/league';
import { PLAYER_CLUB_ID, type SeasonSummary } from '../../domain/save/types';
import { crestOf } from './crestOf';
import { Trophy } from '../../components/league/Trophy';
import { seasonStory } from '../../domain/league/stories';
import './league.css';

const HEADLINE: Record<SeasonSummary['outcome'], string> = {
  promoted: 'Promoted!',
  champions: 'Champions!',
  relegated: 'Relegated',
  stayed: 'Season complete',
};

/**
 * The final day: where you finished, what it means (promotion / relegation / title), the prize,
 * and the button that starts the next season. Closing a season is a single idempotent save.
 */
export function SeasonScreen() {
  const save = useSave();
  const { beginNextSeason } = useGame();
  const toast = useToast();
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const complete = seasonComplete(save.league) && !save.pendingMatch;

  if (!complete) {
    return (
      <main className="screen season">
        <div className="paper season__card">
          <p className="display">The season is still going</p>
          <p>
            Round {save.league.round + 1} of {save.league.rounds.length}.
          </p>
          <Button variant="primary" onClick={() => navigate({ name: 'league' })}>
            League table
          </Button>
        </div>
      </main>
    );
  }

  const o = seasonOutcome(save);
  const table = leagueTable(save.league, (id) => clubName(id, save.club.name)).slice(0, 4);
  const good = o.outcome === 'promoted' || o.outcome === 'champions';

  const next = divisionOf(o.nextDivision);
  // Winning the league is a title even when it also means promotion.
  const won = o.position === 1;
  const fate = won ? 'champions' : o.outcome === 'stayed' ? null : o.outcome;
  const story = seasonStory(save, fate);
  const storyLines = [
    story.sealedRound !== null && story.sealedRound < save.league.rounds.length - 1
      ? `${fate === 'relegated' ? 'The drop was confirmed' : fate === 'champions' ? 'The title was sealed' : 'Promotion was sealed'} in round ${story.sealedRound + 1}.`
      : null,
    story.bestWin ? `Best win: ${story.bestWin.gf}–${story.bestWin.ga} ${story.bestWin.home ? 'at home to' : 'away at'} ${story.bestWin.opponentName}.` : null,
    story.longestWinRun >= 2 ? `Longest winning run: ${story.longestWinRun} games.` : null,
    `At home: ${story.homeRecord.won}W ${story.homeRecord.drawn}D ${story.homeRecord.lost}L.`,
  ].filter((l): l is string => Boolean(l));

  const start = async () => {
    setBusy(true);
    try {
      await beginNextSeason();
      playSfx('chime');
      toast.show(`Season ${o.season + 1} — ${next.name}`);
      navigate({ name: 'club' });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not start the next season.', 'error');
      setBusy(false);
    }
  };

  return (
    <main className={`screen season season--${o.outcome}`}>
      <section className="season__hero">
        {good && !reduced && <Confetti count={30} colours={[save.club.kit.primary, save.club.kit.secondary, '#CBF238', '#F4C653']} />}
        <p className="season__kicker">
          Season {o.season} · {o.divisionName}
        </p>
        {good ? (
          <div className="season__silverware">
            <Trophy kind={won ? 'cup' : 'pennant'} ribbon={save.club.kit.primary} trim={save.club.kit.secondary} size={132} />
            <span className="season__crest">
              <Crest club={save.club} size={52} />
            </span>
          </div>
        ) : (
          <Crest club={save.club} size={96} />
        )}
        <h1 className="season__title">{won ? HEADLINE.champions : HEADLINE[o.outcome]}</h1>
        <p className="season__line">
          {save.club.name} finished <b>{ordinal(o.position)}</b> with <b>{o.points}</b> points ({o.won}W {o.drawn}D {o.lost}L, {o.gf}–{o.ga}).
        </p>
        <p className="season__line">
          {o.outcome === 'promoted'
            ? `${won ? `${o.divisionName} title and promotion. ` : ''}Next season: ${next.name}. Stronger clubs, bigger crowds.`
            : o.outcome === 'relegated'
              ? `Next season: back in ${next.name}. Regroup and go again.`
              : o.outcome === 'champions'
                ? `Top of ${o.divisionName}. The next step up arrives in a later update — defend the title.`
                : `Another go at ${next.name} next season.`}
        </p>
      </section>

      <section className="season__story paper" aria-labelledby="season-story">
        <h2 id="season-story" className="season__story-title">
          The season in brief
        </h2>
        <ul>
          {storyLines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="season__table panel" aria-label="Final table (top four)">
        <h2 className="eyebrow">Final table</h2>
        <ol>
          {table.map((r, i) => (
            <li key={r.clubId} className={r.clubId === PLAYER_CLUB_ID ? 'is-us' : ''}>
              <span className="ls__pos">{i + 1}</span>
              <span className="season__club">
                <Crest club={crestOf(save, r.clubId)} size={22} /> {clubName(r.clubId, save.club.name)}
              </span>
              <b>{r.points}</b>
            </li>
          ))}
        </ol>
        <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'league' })}>
          Full table
        </Button>
      </section>

      <section className="season__prize paper" aria-label="Season rewards">
        <p>
          <span className="club__coin" aria-hidden="true" /> <b>+{o.prizeCoins}</b> prize money · <b>+{SEASON_CLUB_XP[o.position - 1] ?? 50}</b> club XP
        </p>
        {o.topScorer && (
          <p>
            Top scorer: <b>{o.topScorer.name}</b> ({o.topScorer.goals})
          </p>
        )}
      </section>

      <Button variant="primary" size="lg" block icon="whistle" disabled={busy} onClick={() => void start()} sfx="whistle">
        Start season {o.season + 1}
      </Button>
    </main>
  );
}
