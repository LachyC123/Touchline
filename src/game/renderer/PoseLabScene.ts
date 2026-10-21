import Phaser from 'phaser';
import type { LineupPlayer, PlayerAction, TeamLineup } from '../simulation/types';
import { FootballerRig } from './footballerRig';

/** DEV_DEBUG pose sheet: every rig action and signature celebration side by side. */
export interface PoseSpec {
  label: string;
  action: PlayerAction;
  speed: number;
  scorer?: boolean;
  celebrationId?: string;
}

export const POSES: readonly PoseSpec[] = [
  { label: 'Idle', action: 'idle', speed: 0 },
  { label: 'Jog', action: 'run', speed: 0.7 },
  { label: 'Sprint', action: 'run', speed: 1.7 },
  { label: 'Strike', action: 'kick', speed: 0.3 },
  { label: 'Slide', action: 'tackle', speed: 0 },
  { label: 'Dive', action: 'dive', speed: 0 },
  { label: 'Stumble', action: 'stumble', speed: 0 },
  { label: 'Knee slide', action: 'celebrate', speed: 0, scorer: true, celebrationId: 'kneeSlide' },
  { label: 'Aeroplane', action: 'celebrate', speed: 0, scorer: true, celebrationId: 'aeroplane' },
  { label: 'Salute', action: 'celebrate', speed: 0, scorer: true, celebrationId: 'salute' },
  { label: 'Robot', action: 'celebrate', speed: 0, scorer: true, celebrationId: 'robot' },
  { label: 'Backflip', action: 'celebrate', speed: 0, scorer: true, celebrationId: 'backflip' },
];

export class PoseLabScene extends Phaser.Scene {
  private rigs: { rig: FootballerRig; pose: PoseSpec }[] = [];

  constructor(private readonly team: TeamLineup) {
    super({ key: 'pose-lab' });
  }

  create(): void {
    const cols = 4;
    const cellW = this.scale.width / cols;
    const rows = Math.ceil(POSES.length / cols);
    const cellH = this.scale.height / rows;
    const S = cellW / 11;
    this.cameras.main.setBackgroundColor('#1E8D70');
    POSES.forEach((pose, i) => {
      const base = this.team.players[i % this.team.players.length] as LineupPlayer;
      const player: LineupPlayer = { ...base, ...(pose.celebrationId ? { celebrationId: pose.celebrationId } : {}), ...(pose.action === 'dive' ? { role: 'GK' as const } : {}) };
      const rig = new FootballerRig(this, player, this.team.kit, S, true, false);
      const x = (i % cols) * cellW + cellW / 2;
      const y = Math.floor(i / cols) * cellH + cellH * 0.78;
      rig.root.setPosition(x, y);
      this.add
        .text(x, Math.floor(i / cols) * cellH + cellH * 0.94, pose.label.toUpperCase(), { fontFamily: 'Barlow Condensed, sans-serif', fontStyle: '800', fontSize: `${Math.round(S * 1.4)}px`, color: '#FFF7E9' })
        .setOrigin(0.5);
      this.rigs.push({ rig, pose });
    });
  }

  override update(time: number, delta: number): void {
    for (const { rig, pose } of this.rigs) {
      // Re-trigger one-shot actions every 1.2 s so they can be inspected.
      const cycle = time % 1200;
      const oneShot = pose.action === 'kick' || pose.action === 'dive';
      const action: PlayerAction = oneShot && cycle > 700 ? 'idle' : pose.action;
      rig.update({
        x: rig.root.x,
        y: rig.root.y,
        facing: 1,
        speed: action === 'idle' ? 0 : pose.speed,
        action,
        isCarrier: pose.label === 'Sprint',
        ballDx: 3,
        ballDist: 50,
        isScorer: Boolean(pose.scorer),
        dtMs: delta,
        now: time,
      });
    }
  }
}
