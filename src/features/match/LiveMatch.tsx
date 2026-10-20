import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { isReducedMotion } from '../../accessibility/motion';
import { playSfx } from '../../audio/sfx';
import { useSave } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { Crest } from '../../components/club/Crest';
import { Icon } from '../../components/icons/Icon';
import { Button, IconButton } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import { CLUB_BY_ID } from '../../data/clubs';
import { matchArgs } from '../../domain/match/settle';
import type { PendingMatch } from '../../domain/save/types';
import { TACTIC_DURATION_MIN, TICKS_PER_MINUTE, TACTIC_COOLDOWN_MIN } from '../../game/simulation/constants';
import { replayTo } from '../../game/simulation/replay';
import { playerLines, possessionShare } from '../../game/simulation/summary';
import type { FootballEvent, MatchSnapshot, TacticCommand, TeamSide } from '../../game/simulation/types';
import { MatchController, type CommentaryLine, type HoldReason } from '../../game/renderer/controller';
import { createMatchGame } from '../../game/renderer/createMatchGame';
import { recordCommand, saveCheckpoint, settleMatchOnce } from '../../storage/saveRepo';
import './live.css';

export function LiveMatch() {
  const save = useSave();
  const pm = save.pendingMatch;
  const last = save.matchRecords[0];
  if (!pm) {
    return (
      <main className="screen">
        <div className="paper live__none">
          <p className="display">No match in progress</p>
          <Button variant="primary" onClick={() => navigate(last ? { name: 'result', id: last.matchId } : { name: 'match' })}>
            {last ? 'See the last result' : 'Go to matchday'}
          </Button>
        </div>
      </main>
    );
  }
  return <LiveMatchInner key={pm.matchId} pending={pm} />;
}

const CHIPS: { type: TacticCommand; label: string; activeLabel: string; icon: 'bolt' | 'needle'; help: string }[] = [
  { type: 'PRESS', label: 'Press!', activeLabel: 'Pressing', icon: 'bolt', help: 'Hunt the ball high up. Wins it back more — tires legs and leaves space behind.' },
  { type: 'QUICK_PASS', label: 'Quick pass', activeLabel: 'Quick passing', icon: 'needle', help: 'One-touch tempo: shorter holds, more short passes. Riskier under pressure.' },
];

function LiveMatchInner({ pending: livePending }: { pending: PendingMatch }) {
  const toast = useToast();
  // Freeze the match definition at mount: later checkpoint/command writes update the stored
  // copy, but must never rebuild the engine or the scene mid-match.
  const [pending] = useState(livePending);
  const args = useMemo(() => matchArgs(pending), [pending]);
  const resumedAt = pending.checkpointTick;
  // Resume = replay the exact recorded inputs up to the checkpoint (deterministic).
  const [controller] = useState(() => new MatchController(replayTo(args, pending.commands, pending.checkpointTick), pending.home, pending.away, pending.userSide));
  const canvasRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<MatchSnapshot>(() => controller.snapshot);
  const [line, setLine] = useState<CommentaryLine | null>(null);
  const [hold, setHold] = useState<HoldReason>(() => (resumedAt > 0 && !controller.engine.isFinished() ? 'paused' : controller.holdReason));
  const [goal, setGoal] = useState<Extract<FootballEvent, { type: 'GOAL' }> | null>(null);
  const [speed, setSpeed] = useState(1);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const settling = useRef(false);
  const user = pending.userSide;
  const oppClub = CLUB_BY_ID[pending.opponentId];

  // Phaser lifecycle
  useEffect(() => {
    if (resumedAt > 0 && !controller.engine.isFinished()) controller.pause();
    let cancelled = false;
    let handle: { destroy(): void } | null = null;
    const el = canvasRef.current;
    if (!el) return;
    createMatchGame(el, controller, { reducedMotion: isReducedMotion(), homeKitHighlight: '#CBF238', viewWidth: 74 })
      .then((h) => {
        if (cancelled) h.destroy();
        else handle = h;
      })
      .catch((err: unknown) => toast.show(`The pitch could not be drawn: ${err instanceof Error ? err.message : String(err)}`, 'error'));
    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, [controller, resumedAt, toast]);

  // Controller → HUD
  useEffect(() => {
    return controller.subscribe({
      onTick: (s) => {
        setSnap(s);
        if (s.tick % 30 === 0) void saveCheckpoint(pending.matchId, s.tick).catch(() => undefined);
      },
      onCommentary: (l) => setLine(l),
      onShot: () => playSfx('kick'),
      onSave: () => playSfx('save'),
      onGoal: (e) => {
        // Bank the goal immediately so a reload can never rewind past it.
        void saveCheckpoint(pending.matchId, controller.snapshot.tick).catch(() => undefined);
        setGoal(e);
        playSfx('goal');
        window.setTimeout(() => setGoal(null), 1900);
      },
      onHold: (r) => {
        setHold(r);
        setSnap(controller.snapshot);
        if (r === 'halftime' || r === 'fulltime') playSfx('whistle');
      },
    });
  }, [controller, pending.matchId]);

  // Backgrounding pauses presentation and checkpoints; nothing simulates unseen.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        controller.suspend();
        void saveCheckpoint(pending.matchId, controller.snapshot.tick).catch(() => undefined);
      }
    };
    const onHide = () => void saveCheckpoint(pending.matchId, controller.snapshot.tick).catch(() => undefined);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      void saveCheckpoint(pending.matchId, controller.snapshot.tick).catch(() => undefined);
    };
  }, [controller, pending.matchId]);

  // Full time → settle exactly once → result screen.
  useEffect(() => {
    if (hold !== 'fulltime' || settling.current) return;
    settling.current = true;
    const started = Date.now();
    settleMatchOnce(pending.matchId)
      .then(({ record }) => {
        const wait = Math.max(0, 1300 - (Date.now() - started));
        window.setTimeout(() => navigate({ name: 'result', id: record.matchId }, { replace: true }), wait);
      })
      .catch((err: unknown) => {
        settling.current = false;
        toast.show(err instanceof Error ? err.message : 'Could not save the result.', 'error');
      });
  }, [hold, pending.matchId, toast]);

  const triggerChip = async (type: TacticCommand) => {
    const r = controller.dispatch(type);
    if (!r.ok) {
      playSfx('thud');
      toast.show(r.reason, 'error');
      return;
    }
    playSfx('pop');
    const chip = CHIPS.find((c) => c.type === type);
    setBanner(`${chip?.activeLabel.toUpperCase()} ↑ for ${TACTIC_DURATION_MIN}'`);
    window.setTimeout(() => setBanner(null), 2200);
    setSnap(controller.engine.getSnapshot());
    try {
      await recordCommand(pending.matchId, r.command);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not save that instruction.', 'error');
    }
  };

  const tactics = snap.tactics[user];
  const userTeam = user === 'home' ? pending.home : pending.away;
  const oppTeam = user === 'home' ? pending.away : pending.home;
  const scorerName = goal ? [...pending.home.players, ...pending.away.players].find((p) => p.id === goal.scorerId)?.name : '';
  const ourGoal = goal?.team === user;

  const halftimeInfo = useMemo(() => {
    if (hold !== 'halftime') return null;
    const stats = controller.engine.getStats();
    const lines = playerLines(controller.engine.getEvents(), pending.home, pending.away, snap.score);
    const best = lines.filter((l) => l.side === user).sort((a, b) => b.rating - a.rating)[0];
    const bestName = best ? userTeam.players.find((p) => p.id === best.playerId)?.name : undefined;
    return { stats, poss: possessionShare(stats), best, bestName };
  }, [hold, controller, pending, snap.score, user, userTeam]);

  const crestFor = (side: TeamSide) =>
    side === user ? { name: userTeam.name, shortName: userTeam.shortName, crest: 'shield' as const, kit: { ...userTeam.kit, pattern: 'plain' as const, cut: 'crew' as const } } : { name: oppTeam.name, shortName: oppTeam.shortName, crest: oppClub?.crest ?? ('round' as const), kit: { ...oppTeam.kit, pattern: 'plain' as const, cut: 'crew' as const } };

  return (
    <main className={`live ${goal ? (ourGoal ? 'is-goal-ours' : 'is-goal-theirs') : ''}`}>
      <header className="scoreboard" aria-label="Scoreboard">
        <div className="scoreboard__team">
          <Crest club={crestFor('home')} size={34} />
          <span>{pending.home.shortName}</span>
        </div>
        <div className="scoreboard__mid">
          <div className="scoreboard__score" aria-live="polite" aria-label={`${pending.home.name} ${snap.score.home}, ${pending.away.name} ${snap.score.away}`}>
            <b key={`h${snap.score.home}`}>{snap.score.home}</b>
            <span>–</span>
            <b key={`a${snap.score.away}`}>{snap.score.away}</b>
          </div>
          <div className={`scoreboard__clock ${snap.minute >= 85 ? 'is-late' : ''}`}>
            {snap.phase === 'halftime' ? 'HT' : snap.phase === 'fulltime' ? 'FT' : `${snap.minute}'`}
          </div>
        </div>
        <div className="scoreboard__team scoreboard__team--away">
          <span>{pending.away.shortName}</span>
          <Crest club={crestFor('away')} size={34} />
        </div>
      </header>
      <p className={`ticker ticker--${line?.tone ?? 'info'}`} aria-live="polite" key={line?.id}>
        {line?.text ?? 'The players are out…'}
      </p>

      <div className="live__pitch" ref={canvasRef} data-testid="pitch">
        {banner && <div className="live__banner">{banner}</div>}
        {goal && (
          <div className={`goalcard ${ourGoal ? 'is-ours' : ''}`} role="status">
            <span className="goalcard__word">{ourGoal ? 'GOAL!' : 'Goal'}</span>
            <span className="goalcard__name">{scorerName}</span>
            <span className="goalcard__min">{goal.minute}'</span>
          </div>
        )}
      </div>

      <footer className="live__controls">
        <div className="chips-row">
          {CHIPS.map((c) => {
            const active = tactics.activeUntil[c.type] > snap.tick;
            const cooling = !active && tactics.readyAt[c.type] > snap.tick;
            const remaining = active ? (tactics.activeUntil[c.type] - snap.tick) / (TACTIC_DURATION_MIN * TICKS_PER_MINUTE) : cooling ? (tactics.readyAt[c.type] - snap.tick) / ((TACTIC_COOLDOWN_MIN - TACTIC_DURATION_MIN) * TICKS_PER_MINUTE) : 0;
            const minsLeft = Math.ceil(((active ? tactics.activeUntil[c.type] : tactics.readyAt[c.type]) - snap.tick) / TICKS_PER_MINUTE);
            const disabled = active || cooling || snap.phase === 'fulltime' || snap.phase === 'halftime';
            return (
              <button
                key={c.type}
                type="button"
                className={`tchip ${active ? 'is-active' : ''} ${cooling ? 'is-cooling' : ''}`}
                style={{ '--p': Math.max(0, Math.min(1, remaining)) } as CSSProperties}
                aria-disabled={disabled}
                aria-label={`${c.label}. ${active ? `Active for ${minsLeft} more minutes` : cooling ? `Ready in ${minsLeft} minutes` : 'Ready'}. ${c.help}`}
                onClick={() => (disabled ? toast.show(active ? `${c.activeLabel} for ${minsLeft}' more` : cooling ? `${c.label} ready in ${minsLeft}'` : 'Not now', 'error') : void triggerChip(c.type))}
              >
                <span className="tchip__ring" aria-hidden="true">
                  <Icon name={c.icon} size={22} />
                </span>
                <span className="tchip__text">
                  <span className="tchip__label">{active ? c.activeLabel : c.label}</span>
                  <span className="tchip__state">{active ? `${minsLeft}' left` : cooling ? `Ready in ${minsLeft}'` : 'Ready'}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="live__buttons">
          <IconButton icon="pause" label="Pause" onClick={() => controller.pause()} disabled={hold === 'fulltime'} />
          <button
            type="button"
            className="live__speed"
            aria-label={`Speed ${speed}×. Tap to change`}
            onClick={() => {
              const next = speed === 1 ? 2 : 1;
              controller.setSpeed(next);
              setSpeed(next);
              playSfx('tap');
            }}
          >
            {speed}×
          </button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmSkip(true)} disabled={hold === 'fulltime'}>
            Skip to FT
          </Button>
        </div>
      </footer>

      {hold === 'paused' && (
        <div className="live__overlay" role="dialog" aria-modal="true" aria-label="Paused">
          <div className="live__sheet paper">
            <p className="display live__sheet-title">{resumedAt > 0 && snap.tick === resumedAt ? 'Welcome back' : 'Paused'}</p>
            <p>
              {snap.minute}' · {pending.home.shortName} {snap.score.home}–{snap.score.away} {pending.away.shortName}
            </p>
            <Button variant="primary" size="lg" block onClick={() => controller.resume()} sfx="whistle">
              Resume
            </Button>
            <Button variant="ghost" block onClick={() => navigate({ name: 'club' })}>
              Leave for now (saved)
            </Button>
          </div>
        </div>
      )}

      {hold === 'hidden' && (
        <div className="live__overlay">
          <div className="live__sheet paper">
            <p className="display live__sheet-title">Paused while you were away</p>
            <Button variant="primary" size="lg" block onClick={() => controller.resume()}>
              Resume
            </Button>
          </div>
        </div>
      )}

      {hold === 'halftime' && halftimeInfo && (
        <div className="live__overlay" role="dialog" aria-modal="true" aria-label="Half-time">
          <div className="live__sheet paper">
            <p className="live__kicker">Half-time</p>
            <p className="display live__sheet-title">
              {pending.home.shortName} {snap.score.home}–{snap.score.away} {pending.away.shortName}
            </p>
            <dl className="ht-stats">
              {(
                [
                  ['Possession', `${halftimeInfo.poss.home}%`, `${halftimeInfo.poss.away}%`],
                  ['Shots', halftimeInfo.stats.shots.home, halftimeInfo.stats.shots.away],
                  ['On target', halftimeInfo.stats.onTarget.home, halftimeInfo.stats.onTarget.away],
                  ['Tackles won', halftimeInfo.stats.tacklesWon.home, halftimeInfo.stats.tacklesWon.away],
                ] as const
              ).map(([k, h, a]) => (
                <div key={k}>
                  <dd>{h}</dd>
                  <dt>{k}</dt>
                  <dd>{a}</dd>
                </div>
              ))}
            </dl>
            {halftimeInfo.bestName && (
              <p className="ht-best">
                Standout so far: <b>{halftimeInfo.bestName}</b> ({halftimeInfo.best?.rating.toFixed(1)})
              </p>
            )}
            <p className="ht-tip">Chips refresh on their own timers — the second half is a chance to change it up.</p>
            <Button variant="primary" size="lg" block onClick={() => controller.resume()} sfx="whistle">
              Second half
            </Button>
          </div>
        </div>
      )}

      {hold === 'fulltime' && (
        <div className="live__overlay live__overlay--ft" role="status">
          <div className="ft-flash">
            <span>Full time</span>
            <b>
              {pending.home.shortName} {snap.score.home}–{snap.score.away} {pending.away.shortName}
            </b>
            <small>Saving result…</small>
          </div>
        </div>
      )}

      <Dialog
        open={confirmSkip}
        title="Skip to full time?"
        onClose={() => setConfirmSkip(false)}
        actions={
          <>
            <Button
              variant="primary"
              block
              onClick={() => {
                setConfirmSkip(false);
                controller.skipToEnd();
              }}
            >
              Simulate the rest
            </Button>
            <Button variant="ghost" block onClick={() => setConfirmSkip(false)}>
              Keep watching
            </Button>
          </>
        }
      >
        <p>The rest of the match plays out instantly with the same engine. Tactics you don’t use simply aren’t used.</p>
      </Dialog>
    </main>
  );
}
