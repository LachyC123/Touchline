import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { matchSquad } from '../../game/simulation/fromSquad';
import { isReducedMotion } from '../../accessibility/motion';
import { playSfx } from '../../audio/sfx';
import { useGame, useSave } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { Crest } from '../../components/club/Crest';
import { Button, IconButton } from '../../components/ui/Button';
import { CoachMark } from '../../components/ui/CoachMark';
import { tipPending } from '../../domain/club/onboarding';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import { CLUB_BY_ID } from '../../data/clubs';
import { matchArgs } from '../../domain/match/settle';
import type { PendingMatch } from '../../domain/save/types';
import { TICKS_PER_MINUTE } from '../../game/simulation/constants';
import { CARD_DEFS, MOMENTUM, type CardId } from '../../game/simulation/cards';
import { ManagerCard } from '../../components/manager/ManagerCard';
import { replayTo } from '../../game/simulation/replay';
import { playerLines, possessionShare } from '../../game/simulation/summary';
import type { FootballEvent, MatchSnapshot, TacticCommand, TeamSide } from '../../game/simulation/types';
import { MatchController, type CommentaryLine, type HoldReason } from '../../game/renderer/controller';
import { createMatchGame } from '../../game/renderer/createMatchGame';
import { recordCommand, restartStaleMatch, saveCheckpoint, settleMatchOnce } from '../../storage/saveRepo';
import { ENGINE_VERSION } from '../../game/simulation/constants';
import { WalkOut } from './WalkOut';
import { matchAttendance } from '../../domain/club/reputation';
import { Icon } from '../../components/icons/Icon';
import { HalftimeSubs } from './HalftimeSubs';
import { bigMatch, fixtureOfPending } from '../../domain/match/bigMatch';
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
  if (pm.engineVersion !== ENGINE_VERSION) return <StaleMatch />;
  return <LiveMatchInner key={pm.matchId} pending={pm} />;
}

/** A match saved mid-way on an older engine restarts from kick-off (it can't be replayed faithfully). */
function StaleMatch() {
  return (
    <main className="screen">
      <div className="paper live__none">
        <p className="display">The game has been updated</p>
        <p>This match was paused on an older version of the match engine, so it kicks off again from 0–0. Nothing was paid out yet, so nothing is lost.</p>
        <Button variant="primary" icon="whistle" onClick={() => void restartStaleMatch()}>
          Kick off again
        </Button>
      </div>
    </main>
  );
}

function LiveMatchInner({ pending: livePending }: { pending: PendingMatch }) {
  const toast = useToast();
  const save = useSave();
  const { seeTip } = useGame();
  // Freeze the match definition at mount: later checkpoint/command writes update the stored
  // copy, but must never rebuild the engine or the scene mid-match.
  const [pending] = useState(livePending);
  const args = useMemo(() => matchArgs(pending), [pending]);
  const resumedAt = pending.checkpointTick;
  // Resume = replay the exact recorded inputs up to the checkpoint (deterministic).
  // Big matches (cup ties, derbies, deciders) open with a walk-out; held at minute 0 until kick-off.
  const [walkOut] = useState(() => {
    const club = CLUB_BY_ID[livePending.opponentId];
    const fx = club ? fixtureOfPending(save, club) : null;
    const firstRun = tipPending(save, 'tactic') && livePending.number === 1;
    return livePending.checkpointTick === 0 && !firstRun && fx ? bigMatch(save, fx) : null;
  });
  const [controller] = useState(() => {
    const c = new MatchController(replayTo(args, pending.commands, pending.checkpointTick), pending.home, pending.away, pending.userSide);
    if (walkOut) c.holdForWalkOut();
    return c;
  });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<MatchSnapshot>(() => controller.snapshot);
  const [line, setLine] = useState<CommentaryLine | null>(null);
  const [hold, setHold] = useState<HoldReason>(() => (resumedAt > 0 && !controller.engine.isFinished() ? 'paused' : controller.holdReason));
  const [goal, setGoal] = useState<Extract<FootballEvent, { type: 'GOAL' }> | null>(null);
  // The guided first match (tutorial still pending) runs at 2× so it lasts about a minute.
  const [guided] = useState(() => tipPending(save, 'tactic') && livePending.number === 1);
  const [speed, setSpeed] = useState(() => {
    if (guided) controller.setSpeed(2);
    return guided ? 2 : 1;
  });
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [goalHow, setGoalHow] = useState<string | null>(null);
  const [oppCard, setOppCard] = useState<{ card: CardId; id: number } | null>(null);
  const oppCardId = useRef(0);
  const [moment, setMoment] = useState<{ title: string; sub: string; tone: 'good' | 'bad' | 'card' | 'save' | 'sub'; id: number } | null>(null);
  const momentId = useRef(0);
  const flashMoment = useCallback((m: { title: string; sub: string; tone: 'good' | 'bad' | 'card' | 'save' | 'sub' }) => {
    const id = ++momentId.current;
    setMoment({ ...m, id });
    window.setTimeout(() => setMoment((cur) => (cur?.id === id ? null : cur)), 1900);
  }, []);
  const subBatch = useRef<string[]>([]);
  const nameOf = useCallback((id: string) => [...matchSquad(pending.home), ...matchSquad(pending.away)].find((p) => p.id === id)?.name ?? '', [pending]);
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
    createMatchGame(el, controller, { reducedMotion: isReducedMotion(), homeKitHighlight: '#CBF238', viewWidth: 68 })
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
      onSave: (e) => {
        playSfx('save');
        if (e.double) {
          playSfx('cheer');
          flashMoment({ title: 'Double save!', sub: nameOf(e.keeperId), tone: 'save' });
        } else if (e.style === 'dive' || e.style === 'fingertip') playSfx('ooh');
      },
      onSkill: () => playSfx('swish'),
      onSub: (e) => {
        // Both benches change at the same kick-off: gather them into one flash, ours first.
        const line = `${e.team === user ? '' : `${(e.team === 'home' ? pending.home : pending.away).shortName}: `}${nameOf(e.inId)} on for ${nameOf(e.outId)}`;
        const batch = subBatch.current;
        if (e.team === user) batch.unshift(line);
        else batch.push(line);
        if (batch.length === 1) {
          playSfx('whistle');
          window.setTimeout(() => {
            const lines = subBatch.current.splice(0);
            const ours = lines.some((l) => !l.includes(': '));
            flashMoment({ title: ours ? 'Fresh legs' : 'Their change', sub: lines.join(' · '), tone: 'sub' });
          }, 0);
        }
      },
      onCard: (e) => {
        playSfx(e.team === user ? 'pop' : 'flip');
        if (e.team !== user) {
          const id = ++oppCardId.current;
          setOppCard({ card: e.command, id });
          window.setTimeout(() => setOppCard((cur) => (cur?.id === id ? null : cur)), 2200);
        }
      },
      onFoul: (e) => {
        playSfx('peep');
        if (e.booked) window.setTimeout(() => playSfx('stamp'), 250);
        if (e.award === 'penalty') {
          playSfx('ooh');
          flashMoment({ title: 'Penalty!', sub: `${nameOf(e.foulerId)} brings down ${nameOf(e.victimId)}`, tone: e.team === user ? 'bad' : 'good' });
        } else if (e.booked) flashMoment({ title: 'Yellow card', sub: nameOf(e.foulerId), tone: 'card' });
      },
      onTackle: (e) => {
        if (e.won) playSfx('tackle');
      },
      onMiss: (e) => {
        if (e.outcome === 'woodwork') {
          playSfx('post');
          playSfx('ooh');
        } else if (e.outcome === 'wide') playSfx('ooh');
        else playSfx('tackle');
      },
      onGoal: (e, shot) => {
        // Bank the goal immediately so a reload can never rewind past it.
        void saveCheckpoint(pending.matchId, controller.snapshot.tick).catch(() => undefined);
        setGoal(e);
        setGoalHow(shot?.style === 'long' ? 'Screamer from distance' : shot?.style === 'header' ? 'Header' : shot?.style === 'volley' ? 'Rebound, first time' : shot?.style === 'freeKick' ? 'Direct free kick' : shot?.style === 'penalty' ? 'Penalty' : null);
        playSfx('goal');
        window.setTimeout(() => setGoal(null), 1900);
      },
      onHold: (r) => {
        setHold(r);
        setSnap(controller.snapshot);
        if (r === 'halftime' || r === 'fulltime') playSfx('whistle');
      },
    });
  }, [controller, pending.matchId, pending.home, pending.away, flashMoment, nameOf, user]);

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
    if (r.ok && tutorialMatch && tut !== 'played' && tut !== 'done') {
      setTut('played');
      setTutAt(controller.snapshot.tick);
      void seeTip('tactic');
    }
    if (!r.ok) {
      playSfx('thud');
      toast.show(r.reason, 'error');
      return;
    }
    playSfx('pop');
    const def = CARD_DEFS[type];
    setBanner(`${def.name.toUpperCase()}${def.durationMin ? ` · ${def.durationMin}'` : '!'}`);
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
  const scorerName = goal ? [...matchSquad(pending.home), ...matchSquad(pending.away)].find((p) => p.id === goal.scorerId)?.name : '';
  const ourGoal = goal?.team === user;

  const halftimeInfo = useMemo(() => {
    if (hold !== 'halftime') return null;
    const stats = controller.engine.getStats();
    const lines = playerLines(controller.engine.getEvents(), pending.home, pending.away, snap.score);
    const best = lines.filter((l) => l.side === user).sort((a, b) => b.rating - a.rating)[0];
    const bestName = best ? userTeam.players.find((p) => p.id === best.playerId)?.name : undefined;
    return { stats, poss: possessionShare(stats), best, bestName };
  }, [hold, controller, pending, snap.score, user, userTeam]);

  // Tutorial (until the first card is played): Momentum → play a card → what it did. Each beat
  // steps aside after a few seconds of play if ignored, and never blocks the controls.
  const playable = (c: CardId) => tactics.momentum >= CARD_DEFS[c].cost && (tactics.activeUntil[c] ?? 0) <= snap.tick;
  const tipCard = [...tactics.hand].filter(playable).sort((a, b) => CARD_DEFS[a].cost - CARD_DEFS[b].cost)[0];
  const ourBall = userTeam.players.some((p) => p.id === snap.ball.ownerId);
  const [tutorialMatch] = useState(() => tipPending(save, 'tactic'));
  const [tut, setTut] = useState<'momentum' | 'play' | 'played' | 'done'>('momentum');
  const [tutAt, setTutAt] = useState<number | null>(null);
  const running = hold === null && snap.phase !== 'halftime' && snap.phase !== 'fulltime';
  let showTut: 'momentum' | 'play' | 'played' | null = null;
  if (tutorialMatch && running) {
    if (tut === 'momentum' && snap.minute >= 1) showTut = 'momentum';
    else if (tut === 'play' && tipCard && (tutAt !== null || (ourBall && snap.minute >= 4))) showTut = 'play';
    else if (tut === 'played') showTut = 'played';
  }
  // Latch the moment a beat appears (derived state set during render), then time it out.
  if (showTut && tutAt === null) setTutAt(snap.tick);
  const beatTicks = showTut === 'play' ? 120 : 80;
  if (showTut && tutAt !== null && snap.tick > tutAt + beatTicks) {
    setTut(showTut === 'momentum' ? 'play' : 'done');
    setTutAt(null);
    if (showTut !== 'momentum') void seeTip('tactic');
  }
  const showTacticTip = showTut === 'play';
  useEffect(() => {
    if (showTut) playSfx('pop');
  }, [showTut]);
  const dismissTut = () => {
    setTutAt(null);
    if (tut === 'momentum') setTut('play');
    else {
      setTut('done');
      void seeTip('tactic');
    }
  };

  const activeCards = (Object.entries(tactics.activeUntil) as [CardId, number][])
    .filter(([id, until]) => until > snap.tick && CARD_DEFS[id].durationMin > 0)
    .map(([id, until]) => ({ id, mins: Math.ceil((until - snap.tick) / TICKS_PER_MINUTE) }));

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
        {oppCard && (
          <div key={oppCard.id} className="oppcard" role="status" aria-label={`${oppTeam.name} played ${CARD_DEFS[oppCard.card].name}`}>
            <span className="oppcard__who">{oppTeam.shortName} play</span>
            <ManagerCard id={oppCard.card} variant="hand" />
          </div>
        )}
        {moment && !goal && (
          <div key={moment.id} className={`moment moment--${moment.tone}`} role="status">
            {moment.tone === 'card' && <span className="moment__card" aria-hidden="true" />}
            {moment.tone === 'sub' && (
              <span className="moment__icon" aria-hidden="true">
                <Icon name="shirt" size={30} />
              </span>
            )}
            <span className="moment__title">{moment.title}</span>
            <span className="moment__sub">{moment.sub}</span>
          </div>
        )}
        {goal && (
          <div className={`goalcard ${ourGoal ? 'is-ours' : ''}`} role="status">
            <span className="goalcard__word">{ourGoal ? 'GOAL!' : 'Goal'}</span>
            <span className="goalcard__name">{scorerName}</span>
            {goalHow && <span className="goalcard__how">{goalHow}</span>}
            <span className="goalcard__min">{goal.minute}'</span>
          </div>
        )}
      </div>

      <footer className="live__controls">
        {showTut && (
          <CoachMark className={`live__coach live__coach--${showTut}`} onDismiss={dismissTut}>
            {showTut === 'momentum' ? (
              <span>
                This is your <b>Momentum</b>. It fills as the match goes on (and a little when you concede). Cards in your hand cost Momentum — the number in the green gem.
              </span>
            ) : showTut === 'play' && tipCard ? (
              <span>
                Enough Momentum — play <b>{CARD_DEFS[tipCard].name}</b> for {CARD_DEFS[tipCard].cost}. {CARD_DEFS[tipCard].effect}
              </span>
            ) : (
              <span>
                <b>Card played!</b> Watch your team change how they play. The other bench has cards too — answer theirs with yours.
              </span>
            )}
          </CoachMark>
        )}
        <div className="tray">
          <div className="tray__top">
            <div className="momentum" role="meter" aria-label={`Momentum ${tactics.momentum} of ${MOMENTUM.max}`} aria-valuemin={0} aria-valuemax={MOMENTUM.max} aria-valuenow={tactics.momentum}>
              <span className="momentum__num">{tactics.momentum}</span>
              <span className="momentum__track" aria-hidden="true">
                {Array.from({ length: MOMENTUM.max }, (_, i) => (
                  <span key={i} className={i < tactics.momentum ? 'is-full' : ''} style={i === tactics.momentum ? ({ '--fill': tactics.momentumProgress } as CSSProperties) : undefined} />
                ))}
              </span>
            </div>
            {tactics.next && (
              <span className="tray__next" aria-label={`Next card: ${CARD_DEFS[tactics.next].name}`}>
                Next <b>{CARD_DEFS[tactics.next].name}</b>
              </span>
            )}
          </div>
          {activeCards.length > 0 && (
            <ul className="tray__active" aria-label="Cards in effect">
              {activeCards.map(({ id, mins }) => (
                <li key={id}>
                  {CARD_DEFS[id].name} <b>{mins}'</b>
                </li>
              ))}
            </ul>
          )}
          <div className="tray__hand">
            {tactics.hand.map((id, slot) => {
              const def = CARD_DEFS[id];
              const active = (tactics.activeUntil[id] ?? 0) > snap.tick;
              const short = Math.max(0, def.cost - tactics.momentum);
              const closed = snap.phase === 'fulltime' || snap.phase === 'halftime';
              const disabled = active || short > 0 || closed;
              return (
                <button
                  key={`${slot}-${id}`}
                  type="button"
                  className={`mcard ${active ? 'is-active' : ''} ${short > 0 ? 'is-short' : ''} ${showTacticTip && id === tipCard ? 'coach-target' : ''}`}
                  aria-disabled={disabled}
                  aria-label={`${def.name}, costs ${def.cost} Momentum. ${def.effect} ${active ? 'Already in effect.' : short > 0 ? `Needs ${short} more Momentum.` : 'Ready to play.'}`}
                  onClick={() =>
                    disabled ? toast.show(active ? `${def.name} is already on` : short > 0 ? `${def.name} needs ${def.cost} Momentum (you have ${tactics.momentum})` : 'Not now', 'error') : void triggerChip(id)
                  }
                >
                  <ManagerCard id={id} variant="hand" />
                  {short > 0 && !active && <span className="mcard__need">+{short}</span>}
                  {active && <span className="mcard__on">ON</span>}
                </button>
              );
            })}
          </div>
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

      {hold === 'intro' && walkOut && (
        <WalkOut
          big={walkOut}
          us={{ team: userTeam, crest: save.club.crest }}
          them={{ team: oppTeam, crest: oppClub?.crest ?? 'round' }}
          reduced={isReducedMotion()}
          crowd={matchAttendance(save, pending)}
          ground={save.club.stadiumName}
          onKickOff={() => controller.resume()}
        />
      )}

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
            <p className="ht-tip">Momentum carries over — you have {tactics.momentum}. The second half is a chance to change it up.</p>
            <HalftimeSubs
              controller={controller}
              snap={snap}
              starters={userTeam.players}
              onMade={(c) => {
                void recordCommand(pending.matchId, c).catch((err: unknown) => toast.show(err instanceof Error ? err.message : 'Could not save that change.', 'error'));
              }}
            />
            <div className="live__sheet-go">
              <Button variant="primary" size="lg" block onClick={() => controller.resume()} sfx="whistle">
                Second half
              </Button>
            </div>
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
