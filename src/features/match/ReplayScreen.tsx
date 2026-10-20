import { useEffect, useMemo, useRef, useState } from 'react';
import { isReducedMotion } from '../../accessibility/motion';
import { useSave } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { Button, IconButton } from '../../components/ui/Button';
import type { MatchRecord } from '../../domain/save/types';
import { ENGINE_VERSION } from '../../game/simulation/constants';
import { replayTo } from '../../game/simulation/replay';
import type { CreateMatchArgs } from '../../game/simulation/engine';
import { MatchController } from '../../game/renderer/controller';
import { createMatchGame } from '../../game/renderer/createMatchGame';
import './live.css';

const LEAD_TICKS = 70;
const TAIL_TICKS = 45;

/**
 * Goal replays are re-simulated from seed + recorded commands + frozen lineups — the same
 * deterministic engine, so what you see is exactly what happened. No video is stored.
 */
export function ReplayScreen({ id, goal }: { id: string; goal: number }) {
  const save = useSave();
  const record = save.matchRecords.find((r) => r.matchId === id);
  const scorer = record?.scorers[goal];
  if (!record || !scorer || !record.replay) {
    return (
      <main className="screen">
        <div className="paper live__none">
          <p className="display">Replay unavailable</p>
          <p>Replays are kept for your five most recent matches.</p>
          <Button variant="primary" onClick={() => navigate(record ? { name: 'result', id } : { name: 'match' })}>
            Back
          </Button>
        </div>
      </main>
    );
  }
  if (record.engineVersion !== ENGINE_VERSION) {
    return (
      <main className="screen">
        <div className="paper live__none">
          <p className="display">Replay unavailable</p>
          <p>This match was played on an older version of the match engine, so it can’t be re-run exactly.</p>
          <Button variant="primary" onClick={() => navigate({ name: 'result', id })}>
            Back
          </Button>
        </div>
      </main>
    );
  }
  return <ReplayTakes record={record} goal={goal} />;
}

function ReplayTakes({ record, goal }: { record: MatchRecord; goal: number }) {
  const [take, setTake] = useState(0);
  return <ReplayInner key={`${record.matchId}-${goal}-${take}`} record={record} goal={goal} onAgain={() => setTake((t) => t + 1)} />;
}

function ReplayInner({ record, goal, onAgain }: { record: MatchRecord; goal: number; onAgain: () => void }) {
  const scorer = record.scorers[goal]!;
  const args = useMemo<CreateMatchArgs>(() => ({ matchId: record.matchId, seed: record.seed, home: record.replay!.home, away: record.replay!.away, userSide: record.userSide }), [record]);
  const [controller] = useState(() => new MatchController(replayTo(args, record.commands, Math.max(0, scorer.tick - LEAD_TICKS)), args.home, args.away, record.userSide));
  const canvasRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [minute, setMinute] = useState(controller.snapshot.minute);

  useEffect(() => {
    let cancelled = false;
    let handle: { destroy(): void } | null = null;
    const el = canvasRef.current;
    if (!el) return;
    void createMatchGame(el, controller, { reducedMotion: isReducedMotion(), homeKitHighlight: '#CBF238', viewWidth: 66 }).then((h) => {
      if (cancelled) h.destroy();
      else handle = h;
    });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, [controller]);

  useEffect(
    () =>
      controller.subscribe({
        onTick: (s) => {
          setMinute(s.minute);
          if (s.tick >= scorer.tick + TAIL_TICKS) {
            controller.pause();
            setDone(true);
          }
        },
        onGoal: (e) => {
          // Integrity check: the re-run must produce the recorded goal.
          if (Math.abs(e.tick - scorer.tick) < 2 && e.scorerId !== scorer.playerId) setMismatch(true);
        },
        onHold: (r) => {
          if (r === 'halftime') controller.resume();
        },
      }),
    [controller, scorer],
  );

  return (
    <main className="live replay">
      <header className="scoreboard replay__head">
        <IconButton icon="back" label="Close replay" onClick={() => navigate({ name: 'result', id: record.matchId })} />
        <div className="replay__title">
          <span className="replay__tag">Replay</span>
          <b>
            {scorer.name} · {scorer.minute}'
          </b>
        </div>
        <span className="scoreboard__clock">{minute}'</span>
      </header>
      <div className="live__pitch" ref={canvasRef} />
      <footer className="live__controls replay__controls">
        {mismatch && <p className="lineup__problem">This replay does not match the stored result.</p>}
        <div className="replay__buttons">
          {record.scorers.map((s, i) => (
            <Button key={i} size="sm" variant={i === goal ? 'primary' : 'ghost'} onClick={() => navigate({ name: 'replay', id: record.matchId, goal: i }, { replace: true })}>
              {s.minute}'
            </Button>
          ))}
        </div>
        {done && (
          <div className="replay__buttons">
            <Button variant="blue" onClick={onAgain}>
              Watch again
            </Button>
            <Button variant="primary" onClick={() => navigate({ name: 'result', id: record.matchId })}>
              Done
            </Button>
          </div>
        )}
      </footer>
    </main>
  );
}
