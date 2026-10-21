import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { RoleBadges } from '../../components/players/RoleBadges';
import { MoraleMeter } from '../../components/players/MoraleMeter';
import { awayFor } from '../../domain/club/dressingRoom';
import { playSfx } from '../../audio/sfx';
import { useGame, useSave } from '../../app/GameContext';
import { goBack, navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { Icon } from '../../components/icons/Icon';
import { Button, IconButton } from '../../components/ui/Button';
import { CoachMark } from '../../components/ui/CoachMark';
import { useToast } from '../../components/ui/Toast';
import { fitWarnings, lineupProblems } from '../../domain/club/lineup';
import { squadPower } from '../../domain/club/newCareer';
import { FORMATION_DEFS, FORMATION_IDS, type FormationId } from '../../domain/formations';
import { bestSlotFor } from '../../domain/packs/packs';
import { overall, overallAt } from '../../domain/players/rating';
import type { Footballer } from '../../domain/players/types';
import './lineup.css';

/** Spread the formation's depth range over the board so four rows of cards never overlap. */
function slotTop(depth: number): number {
  return 3 + ((0.66 - Math.min(0.66, depth)) / 0.63) * 72;
}

type Selection = { kind: 'slot'; slotId: string } | { kind: 'bench'; playerId: string } | null;

interface DragState {
  playerId: string;
  fromSlot: string | null;
  x: number;
  y: number;
  startX: number;
  startY: number;
  active: boolean;
}

/**
 * Tap a position, then tap the player to put there (works with one thumb, keyboard and screen
 * readers). Dragging a card onto a position does the same thing as an enhancement.
 */
export function LineupScreen() {
  const save = useSave();
  const { assignPlayer, setFormation, autoPick, setCaptain, setPenaltyTaker } = useGame();
  const toast = useToast();
  const [sel, setSel] = useState<Selection>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [justPlaced, setJustPlaced] = useState<string | null>(null);
  // Tutorial: the first signing's best slot glows until he is in the team.
  const signingId = save.onboarding === 'lineup' ? (save.packs.find((p) => p.kind === 'first-signing')?.playerId ?? null) : null;
  const signing = signingId ? save.footballers[signingId] : undefined;
  const target = signing ? bestSlotFor(save, signing) : null;
  const [lift, setLift] = useState<{ before: number; name: string } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const locked = save.pendingMatch !== null;

  const formation = FORMATION_DEFS[save.formationId];
  const starters = new Set(Object.values(save.lineup));
  const bench = save.squadIds
    .map((id) => save.footballers[id])
    .filter((p): p is Footballer => Boolean(p) && !starters.has(p!.id))
    .sort((a, b) => overall(b) - overall(a));
  const warnings = useMemo(() => fitWarnings(save.lineup, save.formationId, save.footballers), [save]);
  const away = awayFor(save);
  const starterPlayers = FORMATION_DEFS[save.formationId].slots.flatMap((sl) => (save.footballers[save.lineup[sl.id] ?? ''] ? [save.footballers[save.lineup[sl.id]!]!] : []));
  const pickCaptain = async (id: string) => {
    if (save.captainId === id) return;
    playSfx('stamp');
    try {
      await setCaptain(id);
      toast.show(`${save.footballers[id]?.lastName ?? 'He'} is your captain`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not change the captain.', 'error');
    }
  };
  const pickPens = async (id: string | null) => {
    if (save.penaltyTakerId === id) return;
    playSfx('tap');
    try {
      await setPenaltyTaker(id);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not change penalty duty.', 'error');
    }
  };
  const promised = new Set(save.dressingRoom.promises.map((p) => p.playerId));
  const problems = lineupProblems(save.lineup, save.formationId, save.footballers, save.squadIds, away);
  const power = squadPower(save);

  const place = async (slotId: string, playerId: string) => {
    const before = power;
    try {
      await assignPlayer(slotId, playerId);
      if (playerId === signingId && signing) {
        playSfx('cheer');
        setLift({ before, name: signing.lastName });
      } else playSfx('pop');
      setJustPlaced(slotId);
      window.setTimeout(() => setJustPlaced(null), 450);
    } catch (err) {
      playSfx('thud');
      toast.show(err instanceof Error ? err.message : 'That move is not allowed.', 'error');
    }
  };

  const onSlotTap = (slotId: string) => {
    if (locked) return;
    const occupant = save.lineup[slotId];
    if (sel?.kind === 'bench') {
      void place(slotId, sel.playerId);
      setSel(null);
    } else if (sel?.kind === 'slot') {
      if (sel.slotId !== slotId) {
        const mover = save.lineup[sel.slotId];
        if (mover) void place(slotId, mover);
      }
      setSel(null);
    } else {
      playSfx('tap');
      setSel(occupant ? { kind: 'slot', slotId } : null);
    }
  };

  const onBenchTap = (playerId: string) => {
    if (locked) return;
    if (sel?.kind === 'slot') {
      void place(sel.slotId, playerId);
      setSel(null);
    } else {
      playSfx('tap');
      setSel(sel?.kind === 'bench' && sel.playerId === playerId ? null : { kind: 'bench', playerId });
    }
  };

  // ---- drag & drop (enhancement) -------------------------------------------------
  const onPointerDown = (e: ReactPointerEvent, playerId: string, fromSlot: string | null) => {
    if (locked || e.button !== 0) return;
    const st = { playerId, fromSlot, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, active: false };
    dragRef.current = st;
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const moved = Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) > 8;
      const next = { ...d, x: ev.clientX, y: ev.clientY, active: d.active || moved };
      dragRef.current = next;
      if (next.active) setDrag(next);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d?.active) return; // a plain tap: handled by onClick
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-slot]');
      const slotId = target?.dataset.slot;
      if (slotId && slotId !== d.fromSlot) void place(slotId, d.playerId);
      setSel(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const dragPlayer = drag?.active ? save.footballers[drag.playerId] : undefined;
  const selectedPlayerId = sel?.kind === 'bench' ? sel.playerId : sel?.kind === 'slot' ? save.lineup[sel.slotId] : undefined;
  const selected = selectedPlayerId ? save.footballers[selectedPlayerId] : undefined;

  return (
    <main className="screen lineup">
      <header className="screen-head">
        <IconButton icon="back" label="Back" onClick={() => goBack({ name: 'match' })} sfx="thud" />
        <h1>
          <small>Starting seven</small>
          Lineup
        </h1>
        <div className="lineup__power" aria-label={`Team power ${power}`}>
          <span>Power</span>
          <b key={power}>{power.toFixed(1)}</b>
        </div>
      </header>

      {locked && (
        <div className="lineup__locked paper">
          <p>
            <b>Match in progress.</b> Finish it before changing the team.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate({ name: 'live' })}>
            Resume
          </Button>
        </div>
      )}

      {signing && target && (
        <CoachMark className="lineup__coach">
          <span>
            <b>{signing.lastName}</b> is your new {signing.primaryPosition}. Tap the glowing slot, then tap him on the bench — or drag him there.
          </span>
          <Button variant="secondary" size="sm" className="coach__action" onClick={() => void place(target.slotId, signing.id)} sfx={null}>
            Put him there (+{target.gain})
          </Button>
        </CoachMark>
      )}
      {lift && (
        <CoachMark className="lineup__coach" onDismiss={() => setLift(null)}>
          <span>
            <b>{lift.name} starts!</b> Team power {lift.before.toFixed(1)} → <b>{power.toFixed(1)}</b>. Time for the first match.
          </span>
          <Button variant="secondary" size="sm" className="coach__action" icon="whistle" onClick={() => navigate({ name: 'match' })}>
            To the match
          </Button>
        </CoachMark>
      )}
      {lift && <span className="lineup__burst" aria-hidden="true" />}

      <div className="segmented lineup__formations" role="group" aria-label="Formation">
        {FORMATION_IDS.map((f: FormationId) => (
          <button
            key={f}
            type="button"
            aria-pressed={save.formationId === f}
            disabled={locked}
            onClick={async () => {
              if (save.formationId === f) return;
              playSfx('flip');
              await setFormation(f);
              setSel(null);
            }}
          >
            {f} <span className="lineup__fname">{FORMATION_DEFS[f].name}</span>
          </button>
        ))}
      </div>
      <p className="lineup__blurb">{formation.blurb}</p>

      <section className={`pitchboard ${sel ? 'is-choosing' : ''}`} aria-label="Pitch">
        <div className="pitchboard__lines" aria-hidden="true" />
        {formation.slots.map((slot) => {
          const p = save.footballers[save.lineup[slot.id] ?? ''];
          const isSel = sel?.kind === 'slot' && sel.slotId === slot.id;
          const warn = warnings[slot.id];
          const fitHint = p ? `${p.lastName}, ${overallAt(p, slot.position)} at ${slot.position}${warn ? `, out of position (−${warn})` : ''}` : 'empty';
          return (
            <button
              key={slot.id}
              type="button"
              data-slot={slot.id}
              className={`pitchboard__slot ${isSel ? 'is-selected' : ''} ${justPlaced === slot.id ? 'is-placed' : ''} ${drag?.active && drag.fromSlot !== slot.id ? 'is-target' : ''} ${target?.slotId === slot.id ? 'coach-target' : ''}`}
              style={{ left: `${slot.x}%`, top: `${slotTop(slot.depth)}%` }}
              aria-label={`${slot.position} slot: ${fitHint}${isSel ? '. Selected — now choose a player' : ''}`}
              aria-pressed={isSel}
              onClick={() => onSlotTap(slot.id)}
              onPointerDown={(e) => p && onPointerDown(e, p.id, slot.id)}
              disabled={locked}
            >
              {p ? (
                <>
                  <span className="pitchboard__card">
                    <FootballerCard player={p} kit={save.club.kit} variant="mini" />
                    <span className="pitchboard__mood">
                      <MoraleMeter morale={p.morale} compact />
                    </span>
                    <span className="pitchboard__roles">
                      <RoleBadges captain={save.captainId === p.id} penalties={save.penaltyTakerId === p.id} />
                    </span>
                  </span>
                  <span className="pitchboard__name">{p.lastName}</span>
                  {away.has(p.id) && <span className="pitchboard__tag is-away">Away</span>}
                  {warn ? (
                    <span className="pitchboard__warn" title={`Out of position: −${warn} rating`}>
                      <Icon name="info" size={12} />−{warn}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="pitchboard__empty">{slot.position}</span>
              )}
            </button>
          );
        })}
      </section>

      <p className="lineup__hint" aria-live="polite">
        {locked
          ? ' '
          : selected
            ? `${selected.lastName} selected — tap a ${sel?.kind === 'bench' ? 'position' : 'position or bench player'} to move him.`
            : 'Tap a player then tap where he should go — or drag him there.'}
      </p>

      <section className="lineup__bench" aria-label="Substitutes">
        <h2 className="eyebrow">Bench</h2>
        <div className="lineup__bench-row">
          {bench.map((p) => {
            const isSel = sel?.kind === 'bench' && sel.playerId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`lineup__bench-player ${isSel ? 'is-selected' : ''} ${target && p.id === signingId ? 'coach-target' : ''}`}
                aria-label={`Bench: ${p.firstName} ${p.lastName}, ${p.primaryPosition}, overall ${overall(p)}${isSel ? '. Selected' : ''}`}
                aria-pressed={isSel}
                onClick={() => onBenchTap(p.id)}
                onPointerDown={(e) => onPointerDown(e, p.id, null)}
                disabled={locked}
              >
                <span className="pitchboard__card">
                  <FootballerCard player={p} kit={save.club.kit} variant="mini" />
                  <span className="pitchboard__mood">
                    <MoraleMeter morale={p.morale} compact />
                  </span>
                </span>
                <span className="pitchboard__name">{p.lastName}</span>
                {away.has(p.id) ? <span className="pitchboard__tag is-away">Away</span> : promised.has(p.id) ? <span className="pitchboard__tag is-promised">Promised</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      {!locked && (
        <section className="lineup__roles panel" aria-label="Captain and penalties">
          <div className="lineup__role">
            <h2 className="eyebrow">Captain</h2>
            <div className="lineup__role-chips" role="radiogroup" aria-label="Captain">
              {starterPlayers.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={save.captainId === p.id} className={`lineup__role-chip ${save.captainId === p.id ? 'is-on' : ''}`} onClick={() => void pickCaptain(p.id)}>
                  {p.lastName}
                </button>
              ))}
            </div>
            <p className="lineup__role-note">{save.captainId && save.footballers[save.captainId] ? `${save.footballers[save.captainId]!.lastName} wears the armband: a little extra pride every match he starts.` : 'Nobody wears the armband yet. A new captain gets a big lift; the old one feels it.'}</p>
          </div>
          <div className="lineup__role">
            <h2 className="eyebrow">Penalties</h2>
            <div className="lineup__role-chips" role="radiogroup" aria-label="Penalty taker">
              <button type="button" role="radio" aria-checked={save.penaltyTakerId === null} className={`lineup__role-chip ${save.penaltyTakerId === null ? 'is-on' : ''}`} onClick={() => void pickPens(null)}>
                Best taker
              </button>
              {starterPlayers
                .filter((p) => p.primaryPosition !== 'GK')
                .map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={save.penaltyTakerId === p.id} className={`lineup__role-chip ${save.penaltyTakerId === p.id ? 'is-on' : ''}`} onClick={() => void pickPens(p.id)}>
                    {p.lastName}
                  </button>
                ))}
            </div>
            <p className="lineup__role-note">{save.penaltyTakerId ? 'He steps up for every penalty while he’s on the pitch.' : 'Whoever on the pitch has the best composure, finishing and set-piece skill.'}</p>
          </div>
        </section>
      )}

      {problems.length > 0 && (
        <p className="lineup__problem" role="alert">
          <Icon name="info" size={16} /> {problems[0]}
        </p>
      )}

      <div className="lineup__actions">
        <Button
          variant="ghost"
          icon="squad"
          disabled={locked}
          onClick={async () => {
            await autoPick();
            toast.show('Strongest seven picked');
          }}
        >
          Auto-pick
        </Button>
        <Button variant="primary" icon="whistle" onClick={() => navigate({ name: 'match' })} disabled={problems.length > 0}>
          Done
        </Button>
      </div>

      {dragPlayer && drag && (
        <div className="lineup__ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <FootballerCard player={dragPlayer} kit={save.club.kit} variant="mini" />
        </div>
      )}
    </main>
  );
}
