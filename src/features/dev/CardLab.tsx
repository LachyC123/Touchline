import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { IconButton, Button } from '../../components/ui/Button';
import { Portrait } from '../../components/portrait/Portrait';
import { DEFAULT_CLUB, type Kit } from '../../domain/club/types';
import { generateFootballer } from '../../domain/players/generator';
import { overall } from '../../domain/players/rating';
import { POSITIONS, TIERS, type Position, type Tier } from '../../domain/players/types';
import { prepareMatch, matchArgs } from '../../domain/match/settle';
import { replayMatch } from '../../game/simulation/replay';
import type { FootballEvent } from '../../game/simulation/types';
import { mutateSave } from '../../storage/saveRepo';
import './lab.css';

const KITS: Kit[] = [
  DEFAULT_CLUB.kit,
  { primary: '#1E8D70', secondary: '#FFF7E9', pattern: 'stripes', cut: 'vneck' },
  { primary: '#4178EF', secondary: '#F4C653', pattern: 'hoops', cut: 'collar' },
  { primary: '#101C32', secondary: '#CBF238', pattern: 'sash', cut: 'crew' },
  { primary: '#DC63B4', secondary: '#101C32', pattern: 'halves', cut: 'vneck' },
];

/**
 * DEV_DEBUG panel: inspect a player seed, force rarity/position, preview every card variant
 * and portrait variety. Excluded from production menus (see DEV_TOOLS_ENABLED).
 */
export function CardLab() {
  const { saveState } = useGame();
  const [seed, setSeed] = useState('lab-0001');
  const [tier, setTier] = useState<Tier | 'auto'>('auto');
  const [position, setPosition] = useState<Position | 'auto'>('auto');
  const [kitIndex, setKitIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const kit = saveState.status === 'ready' && saveState.save && kitIndex === 0 ? saveState.save.club.kit : (KITS[kitIndex] ?? DEFAULT_CLUB.kit);

  const player = useMemo(
    () => generateFootballer({ seed, ...(tier !== 'auto' ? { tier } : {}), ...(position !== 'auto' ? { position } : {}) }),
    [seed, tier, position],
  );
  const tierRow = useMemo(() => TIERS.map((t) => generateFootballer({ seed, tier: t, ...(position !== 'auto' ? { position } : {}) })), [seed, position]);
  const gallery = useMemo(() => Array.from({ length: 24 }, (_, i) => generateFootballer({ seed: `${seed}-g${i}` })), [seed]);

  return (
    <main className="screen lab">
      <header className="screen-head">
        <IconButton icon="back" label="Back" onClick={() => navigate({ name: 'more' })} />
        <h1>
          <small>DEV_DEBUG</small>Card lab
        </h1>
      </header>

      <div className="lab__controls panel">
        <label>
          Seed
          <input value={seed} onChange={(e) => setSeed(e.target.value)} spellCheck={false} />
        </label>
        <Button size="sm" onClick={() => setSeed(`lab-${Math.random().toString(36).slice(2, 8)}`)}>
          Random
        </Button>
        <label>
          Tier
          <select value={tier} onChange={(e) => setTier(e.target.value as Tier | 'auto')}>
            <option value="auto">Rolled</option>
            {TIERS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Position
          <select value={position} onChange={(e) => setPosition(e.target.value as Position | 'auto')}>
            <option value="auto">Rolled</option>
            {POSITIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Kit
          <select value={kitIndex} onChange={(e) => setKitIndex(Number(e.target.value))}>
            {KITS.map((k, i) => (
              <option key={i} value={i}>
                {i === 0 ? 'Club' : `${k.pattern} / ${k.cut}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="lab__meta">
        id {player.id.slice(0, 8)} · gen v{player.generatorVersion} · OVR {overall(player)} · POT {player.potential} · {player.archetypeId}
      </p>

      <div className="lab__hero">
        <FootballerCard player={player} kit={kit} variant="hero" flipped={flipped} onFlip={() => setFlipped((f) => !f)} showNewSticker={false} />
      </div>

      <h2 className="eyebrow lab__h">Same seed, every tier</h2>
      <div className="lab__tiers">
        {tierRow.map((p) => (
          <div key={p.tier} data-tier={p.tier}>
            <FootballerCard player={p} kit={kit} variant="standard" showNewSticker={false} />
          </div>
        ))}
      </div>

      <h2 className="eyebrow lab__h">Mini (lineup) cards</h2>
      <div className="lab__minis">
        {tierRow.map((p) => (
          <div key={p.tier}>
            <FootballerCard player={p} kit={kit} variant="mini" />
          </div>
        ))}
      </div>

      {saveState.status === 'ready' && saveState.save && <MatchLab />}
      {saveState.status === 'ready' && saveState.save && <PoseLab />}

      <h2 className="eyebrow lab__h">Portrait variety</h2>
      <div className="lab__gallery">
        {gallery.map((p) => (
          <button key={p.id} type="button" onClick={() => setSeed(p.generatedSeed)} title={`${p.firstName} ${p.lastName}`}>
            <Portrait appearance={p.appearance} kit={kit} />
          </button>
        ))}
      </div>
    </main>
  );
}

/** Scenario seeds for the next fixture + reward-claim journal check (DEV_DEBUG only). */
function MatchLab() {
  const { saveState } = useGame();
  const save = saveState.status === 'ready' ? saveState.save : null;
  const [report, setReport] = useState<string | null>(null);
  if (!save) return null;
  const claims = save.rewardClaimIds;
  const dupes = claims.filter((c, i) => claims.indexOf(c) !== i);
  const settled = save.matchRecords.map((r) => `match:${r.matchId}`);
  const missing = settled.filter((c) => !claims.includes(c));

  const run = () => {
    let w = 0;
    let d = 0;
    let l = 0;
    let goals = 0;
    const N = 50;
    let pm;
    try {
      pm = prepareMatch(save);
    } catch (err) {
      setReport(err instanceof Error ? err.message : String(err));
      return;
    }
    for (let i = 0; i < N; i++) {
      const r = replayMatch({ ...matchArgs(pm), seed: `lab-scenario-${i}` }, []);
      const us = r.score[pm.userSide];
      const them = r.score[pm.userSide === 'home' ? 'away' : 'home'];
      goals += us + them;
      if (us > them) w++;
      else if (us === them) d++;
      else l++;
    }
    setReport(`Next fixture × ${N} seeds: W ${w} / D ${d} / L ${l} · ${(goals / N).toFixed(2)} goals per match`);
  };

  return (
    <section className="panel lab__match">
      <h2 className="eyebrow">Match lab</h2>
      <Button size="sm" onClick={run}>
        Simulate next fixture × 50
      </Button>
      {report && <p className="lab__meta">{report}</p>}
      <p className="lab__meta">Scenario kick-off (finds a seed where it happens in the first 25'):</p>
      <div className="lab__row">
        {SCENARIOS.map((sc) => (
          <Button key={sc.label} size="sm" onClick={() => void kickOffScenario(sc, setReport)} disabled={Boolean(save.pendingMatch)}>
            {sc.label}
          </Button>
        ))}
      </div>
      <p className="lab__meta">
        Claims: {claims.length} · duplicates: {dupes.length} · settled matches missing a claim: {missing.length}
      </p>
    </section>
  );
}

const SCENARIOS: { label: string; test: (e: FootballEvent) => boolean }[] = [
  { label: 'Penalty', test: (e) => e.type === 'FOUL' && e.award === 'penalty' },
  { label: 'Double save', test: (e) => e.type === 'SAVE' && e.double },
  { label: 'Diving save', test: (e) => e.type === 'SAVE' && (e.style === 'dive' || e.style === 'fingertip') },
  { label: 'Free kick shot', test: (e) => e.type === 'SHOT' && e.style === 'freeKick' },
  { label: 'Skill move', test: (e) => e.type === 'SKILL' },
];

/**
 * DEV_DEBUG: replaces the next fixture's seed with one where the chosen incident happens early,
 * then kicks off. The match is still a normal, fully simulated and settled match.
 */
async function kickOffScenario(sc: (typeof SCENARIOS)[number], report: (s: string) => void): Promise<void> {
  let found: string | null = null;
  await mutateSave((s) => {
    const base = prepareMatch(s);
    for (let i = 0; i < 400 && !found; i++) {
      const seed = `${base.seed}:scenario:${sc.label}:${i}`;
      const r = replayMatch({ ...matchArgs(base), seed }, []);
      if (r.events.some((e) => e.minute < 25 && sc.test(e))) found = seed;
    }
    if (found) s.pendingMatch = { ...base, seed: found };
  });
  if (found) navigate({ name: 'live' });
  else report(`No ${sc.label} scenario found in 400 seeds.`);
}

/** Pitch figures in every pose, rendered by the real match rig (DEV_DEBUG only). */
function PoseLab() {
  const { saveState } = useGame();
  const save = saveState.status === 'ready' ? saveState.save : null;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !save) return;
    let game: { destroy(b: boolean): void } | null = null;
    let cancelled = false;
    void Promise.all([import('phaser'), import('../../game/renderer/PoseLabScene'), import('../../domain/match/settle')]).then(([{ default: Phaser }, { PoseLabScene }, { prepareMatch }]) => {
      if (cancelled) return;
      const pm = save.pendingMatch ?? prepareMatch(save);
      const team = pm.userSide === 'home' ? pm.home : pm.away;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: el,
        banner: false,
        audio: { noAudio: true },
        scale: { mode: Phaser.Scale.NONE, width: el.clientWidth * dpr, height: el.clientHeight * dpr, zoom: 1 / dpr },
        scene: [new PoseLabScene(team)],
      });
    });
    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [save]);
  return (
    <section className="lab__poses">
      <h2 className="eyebrow lab__h">Pitch figures</h2>
      <div ref={ref} className="lab__pose-canvas" data-testid="pose-lab" />
    </section>
  );
}
