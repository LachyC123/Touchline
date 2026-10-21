import { useEffect, useState } from 'react';
import { MoraleMeter } from '../../components/players/MoraleMeter';
import { awayFor } from '../../domain/club/dressingRoom';
import { describeEffect } from '../../domain/players/morale';
import { useGame, useSave } from '../../app/GameContext';
import { goBack, navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { toCardModel } from '../../components/cards/cardModel';
import { Icon } from '../../components/icons/Icon';
import { Button, IconButton } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { TIER_DEFS } from '../../data/tiers';
import { ATTRIBUTE_INFO, overallAt } from '../../domain/players/rating';
import { xpToNext } from '../../domain/players/progression';
import type { AttributeKey, Footballer } from '../../domain/players/types';
import { playSfx } from '../../audio/sfx';
import { UpgradePicker } from '../match/UpgradePicker';
import './player.css';

type Tab = 'overview' | 'stats' | 'story';

const GROUPS: { title: string; keys: AttributeKey[]; gkOnly?: boolean }[] = [
  { title: 'Goalkeeping', keys: ['reflexes', 'handling', 'positioning', 'reach', 'distribution'], gkOnly: true },
  { title: 'Attacking', keys: ['finishing', 'shooting', 'dribbling', 'ballControl'] },
  { title: 'Playmaking', keys: ['passing', 'vision', 'setPieces', 'composure'] },
  { title: 'Defending', keys: ['tackling', 'marking', 'strength'] },
  { title: 'Physical', keys: ['pace', 'acceleration', 'stamina'] },
];

export function PlayerScreen({ id }: { id: string }) {
  const save = useSave();
  const { toggleFavourite, markInspected } = useGame();
  const toast = useToast();
  const player = save.footballers[id];
  const [flipped, setFlipped] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [openUpgrades] = useState(() => save.pendingUpgrades);

  useEffect(() => {
    if (player?.isNew) void markInspected(player.id);
  }, [player?.id, player?.isNew, markInspected]);

  if (!player) {
    return (
      <main className="screen">
        <div className="paper player__missing">
          <p className="display">Player not found</p>
          <p>This player isn’t at the club any more.</p>
          <Button variant="blue" onClick={() => navigate({ name: 'squad' })}>
            Back to squad
          </Button>
        </div>
      </main>
    );
  }

  const m = toCardModel(player);
  const promise = save.dressingRoom.promises.find((x) => x.playerId === player.id);
  const awayWhy = awayFor(save).get(player.id);
  const need = xpToNext(player.level);
  const starterSlot = Object.entries(save.lineup).find(([, pid]) => pid === player.id)?.[0];

  return (
    <main className="screen player">
      <header className="screen-head">
        <IconButton icon="back" label="Back to squad" onClick={() => goBack({ name: 'squad' })} sfx="thud" />
        <h1 className="player__title">
          <small>Player profile</small>
          {player.lastName}
        </h1>
        <IconButton
          icon={player.favourite ? 'starFilled' : 'star'}
          label={player.favourite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={player.favourite}
          sfx={player.favourite ? 'thud' : 'pop'}
          onClick={async () => {
            await toggleFavourite(player.id);
            toast.show(player.favourite ? `${player.lastName} removed from favourites` : `${player.lastName} is a favourite`);
          }}
        />
      </header>

      <div className="player__stage">
        <div className="player__hero">
          <FootballerCard player={player} kit={save.club.kit} variant="hero" flipped={flipped} onFlip={() => setFlipped((f) => !f)} showNewSticker={false} />
        </div>
        <button type="button" className="player__flip-hint" onClick={() => { playSfx('flip'); setFlipped((f) => !f); }}>
          <Icon name="flip" size={16} /> {flipped ? 'Show card front' : 'Flip for his story'}
        </button>
      </div>

      <section className="player__growth" aria-label="Growth">
        <div className="player__level">
          <span>LV</span>
          <b>{player.level}</b>
        </div>
        <div className="player__xp">
          <div className="player__xp-row">
            <span className="eyebrow">Growth</span>
            <span className="player__xp-num">
              {player.xp} / {need} XP
            </span>
          </div>
          <div className="player__bar" role="progressbar" aria-valuemin={0} aria-valuemax={need} aria-valuenow={player.xp} aria-label="Experience to next level">
            <span style={{ width: `${Math.min(100, (player.xp / need) * 100)}%` }} />
          </div>
          <p className="player__xp-note">Earn XP by playing matches. Each level lets you choose a training focus.</p>
        </div>
      </section>

      <section className="player__mood panel" aria-label="Mood">
        <MoraleMeter morale={player.morale} />
        <p className="player__mood-note">
          On the pitch: {describeEffect(player.morale)}.{promise ? ` You promised him a start (by match ${promise.byMatch}).` : ''}
          {awayWhy ? ` Away: ${awayWhy}.` : ''}
        </p>
      </section>

      {openUpgrades
        .filter((u) => u.playerId === player.id)
        .slice(0, 1)
        .map((u) => (
          <div key={u.level} className="player__upgrade">
            <UpgradePicker upgrade={u} player={player} kit={save.club.kit} />
          </div>
        ))}

      <div className="player__tabs segmented" role="tablist" aria-label="Player details">
        {(['overview', 'stats', 'story'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-pressed={tab === t}
            aria-controls={`panel-${t}`}
            id={`tab-${t}`}
            onClick={() => {
              playSfx('tap');
              setTab(t);
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <section className="player__panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} key={tab}>
        {tab === 'overview' && <Overview player={player} model={m} starterSlot={starterSlot} />}
        {tab === 'stats' && <Stats player={player} />}
        {tab === 'story' && <Story player={player} model={m} clubName={save.club.name} />}
      </section>
    </main>
  );
}

function Overview({ player, model, starterSlot }: { player: Footballer; model: ReturnType<typeof toCardModel>; starterSlot?: string }) {
  const traits = [model.trait, ...model.extraTraits].filter((t): t is NonNullable<typeof t> => Boolean(t));
  const facts: [string, string][] = [
    ['Age', String(player.age)],
    ['Position', [player.primaryPosition, ...player.secondaryPositions].join(' / ')],
    ['Foot', player.strongFoot === 'both' ? 'Both' : player.strongFoot === 'left' ? 'Left' : 'Right'],
    ['Height', `${player.heightCm} cm`],
    ['From', `${player.hometown}`],
    ['Status', starterSlot ? 'Starting seven' : 'Substitute'],
  ];
  return (
    <div className="player__stack">
      {traits.map((t) => (
        <article key={t.id} className="player__trait paper">
          <span className="player__trait-icon">
            <Icon name={t.icon} size={26} />
          </span>
          <div>
            <h3>{t.name}</h3>
            <p>{t.description}</p>
          </div>
        </article>
      ))}
      <dl className="player__facts panel">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="player__ceiling panel">
        <div>
          <p className="eyebrow">Scout’s ceiling</p>
          <p className="player__ceiling-num">
            {player.potential}
            <small> potential</small>
          </p>
        </div>
        <p className="player__ceiling-note">
          {TIER_DEFS[player.tier].label} tier · {TIER_DEFS[player.tier].meaning}
        </p>
      </div>
      <article className="player__character panel">
        <p className="eyebrow">Character</p>
        <h3>{model.personalityLabel}</h3>
        <p>{model.personalityBlurb}</p>
        <p className="player__dream">
          <Icon name="star" size={16} /> Dream: {model.dream}
        </p>
      </article>
    </div>
  );
}

function Stats({ player }: { player: Footballer }) {
  const isGk = player.primaryPosition === 'GK';
  const groups = GROUPS.filter((g) => !g.gkOnly || isGk);
  const positions = (['GK', 'DEF', 'MID', 'FWD'] as const).map((pos) => [pos, overallAt(player, pos)] as const);
  return (
    <div className="player__stack">
      <div className="player__fit panel" aria-label="Rating by position">
        {positions.map(([pos, val]) => (
          <div key={pos} className={pos === player.primaryPosition ? 'is-primary' : ''}>
            <b>{val}</b>
            <span>{pos}</span>
          </div>
        ))}
      </div>
      {groups.map((g) => (
        <section key={g.title} className="player__group panel">
          <h3 className="eyebrow">{g.title}</h3>
          <ul>
            {g.keys.map((k) => {
              const v = player.attributes[k];
              const band = v >= 70 ? 'hi' : v >= 50 ? 'mid' : 'lo';
              return (
                <li key={k}>
                  <div className="player__attr-row">
                    <span className="player__attr-name">{ATTRIBUTE_INFO[k].label}</span>
                    <span className={`player__attr-val is-${band}`}>{v}</span>
                  </div>
                  <div className="player__attr-bar" aria-hidden="true">
                    <span className={`is-${band}`} style={{ width: `${v}%` }} />
                  </div>
                  <p className="player__attr-meaning">{ATTRIBUTE_INFO[k].meaning}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

const HONOURS: { label: string; one: string; test: (h: Footballer['history'][number]) => boolean }[] = [
  { label: 'Titles', one: 'Title', test: (h) => h.kind === 'honour' && h.headline.startsWith('CHAMPIONS') },
  { label: 'Promotions', one: 'Promotion', test: (h) => h.kind === 'honour' && h.headline.startsWith('PROMOTED') },
  { label: 'Golden Boots', one: 'Golden Boot', test: (h) => h.kind === 'honour' && h.headline.startsWith('GOLDEN BOOT') },
  { label: 'Hat-tricks', one: 'Hat-trick', test: (h) => h.kind === 'hatTrick' },
];

function Story({ player, model, clubName }: { player: Footballer; model: ReturnType<typeof toCardModel>; clubName: string }) {
  const entries = [...player.history].sort((a, b) => b.order - a.order);
  const honours = HONOURS.map((h) => ({ count: player.history.filter(h.test).length, h })).filter((x) => x.count > 0).map(({ count, h }) => ({ label: count === 1 ? h.one : h.label, count }));
  return (
    <div className="player__stack">
      <article className="paper player__origin">
        <p className="player__origin-chip">{model.storyChip}</p>
        <p className="player__origin-line">“{model.originLine}”</p>
        <p className="player__origin-meta">
          {player.nationality} · born in {player.hometown}
        </p>
      </article>
      {honours.length > 0 && (
        <section className="player__honours" aria-label="Honours">
          {honours.map((h) => (
            <div key={h.label}>
              <b>{h.count}</b>
              <span>{h.label}</span>
            </div>
          ))}
        </section>
      )}
      <section className="panel player__timeline">
        <h3 className="eyebrow">Scrapbook at {clubName}</h3>
        <ol>
          {entries.map((h) => (
            <li key={h.id} className={h.kind === 'honour' || h.kind === 'hatTrick' ? 'is-gold' : ''}>
              <span className="player__stamp">S{h.season}</span>
              <span>{h.headline}</span>
            </li>
          ))}
        </ol>
        <p className="player__timeline-note">New moments are stamped here as his career unfolds.</p>
      </section>
      <section className="panel player__record">
        {(
          [
            ['Apps', player.stats.matches],
            ['Goals', player.stats.goals],
            ['Assists', player.stats.assists],
            ['Clean sheets', player.stats.cleanSheets],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <b>{v}</b>
            <span>{k}</span>
          </div>
        ))}
      </section>
      <p className="player__celebration">
        Signature celebration: <b>{model.celebration}</b>
      </p>
    </div>
  );
}
