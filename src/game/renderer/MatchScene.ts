import Phaser from 'phaser';
import { HAIR, SKIN } from '../../components/portrait/palette';
import { PITCH_L, PITCH_W } from '../simulation/constants';
import type { LineupPlayer, MatchSnapshot, PlayerSnapshot, TeamSide } from '../simulation/types';
import type { MatchController } from './controller';

/**
 * Phaser presentation of the pure simulation. It interpolates between engine snapshots and
 * animates only what the engine recorded (kicks, tackles, dives, celebrations). It never
 * writes to the simulation.
 */
export interface SceneOptions {
  reducedMotion: boolean;
  homeKitHighlight: string;
  /** Visible pitch width in units (smaller = more zoomed in). */
  viewWidth: number;
}

const hex = (c: string): number => parseInt(c.replace('#', ''), 16);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Figure {
  id: string;
  side: TeamSide;
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  legL: Phaser.GameObjects.Graphics;
  legR: Phaser.GameObjects.Graphics;
  ring: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  phase: number;
  isUser: boolean;
  isKeeper: boolean;
}

export class MatchScene extends Phaser.Scene {
  private S = 5;
  private figures = new Map<string, Figure>();
  private ball!: Phaser.GameObjects.Container;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private trail!: Phaser.GameObjects.Graphics;
  private trailPoints: { x: number; y: number }[] = [];
  private camX = 0;
  private camY = 0;
  private baseZoom = 1;
  private unsubscribe: (() => void) | null = null;
  private nets: Phaser.GameObjects.Graphics[] = [];

  constructor(
    private readonly controller: MatchController,
    private readonly opts: SceneOptions,
  ) {
    super({ key: 'match' });
  }

  /** Pitch coordinates → display, flipped so the player's team always attacks up the screen. */
  private flip(snap: MatchSnapshot): boolean {
    return snap.attackingUp !== this.controller.userSide;
  }

  private toWorld(x: number, y: number, flip: boolean): { x: number; y: number } {
    return flip ? { x: (PITCH_W - x) * this.S, y: (PITCH_L - y) * this.S } : { x: x * this.S, y: y * this.S };
  }

  create(): void {
    const w = this.scale.width;
    this.S = w / this.opts.viewWidth;
    const S = this.S;
    this.cameras.main.setBackgroundColor('#0d3a2f');
    this.cameras.main.setBounds(-9 * S, -14 * S, (PITCH_W + 18) * S, (PITCH_L + 28) * S);
    this.drawPitch();

    for (const [side, team] of [['home', this.controller.home], ['away', this.controller.away]] as const) {
      for (const p of team.players) this.figures.set(p.id, this.makeFigure(p, side, team.kit));
    }

    this.trail = this.add.graphics().setDepth(PITCH_L * S + 5);
    this.ballShadow = this.add.ellipse(0, 0, 1.6 * S, 0.7 * S, 0x000000, 0.35).setDepth(1);
    const ballG = this.add.graphics();
    ballG.fillStyle(0xffffff, 1).fillCircle(0, 0, 0.78 * S);
    ballG.lineStyle(Math.max(1, 0.18 * S), 0x1b2235, 1).strokeCircle(0, 0, 0.78 * S);
    ballG.fillStyle(0x1b2235, 1).fillCircle(0.1 * S, -0.05 * S, 0.26 * S);
    this.ball = this.add.container(0, 0, [ballG]);

    const snap = this.controller.snapshot;
    const b = this.toWorld(snap.ball.x, snap.ball.y, this.flip(snap));
    this.camX = b.x;
    this.camY = b.y;
    this.cameras.main.centerOn(b.x, b.y);

    this.unsubscribe = this.controller.subscribe({
      onGoal: (e) => this.goalFx(e.team),
      onSave: (e) => this.burst(e.at.x, e.at.y, 0xcbf238, 'SAVE!'),
      onTackle: (e) => {
        if (e.won) this.burst(e.at.x, e.at.y, 0xfff7e9);
      },
      onShot: () => {
        this.trailPoints = [];
      },
    });
    this.events.once('shutdown', () => this.unsubscribe?.());
    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.baseZoom = size.width / (this.opts.viewWidth * this.S);
      this.cameras.main.setZoom(this.baseZoom);
    });
  }

  private drawPitch(): void {
    const S = this.S;
    const g = this.add.graphics().setDepth(0);
    // Surround + advertising boards
    g.fillStyle(0x0d3a2f, 1).fillRect(-9 * S, -14 * S, (PITCH_W + 18) * S, (PITCH_L + 28) * S);
    for (let i = 0; i < 15; i++) {
      g.fillStyle(i % 2 === 0 ? 0x1e8d70 : 0x1a8167, 1).fillRect(-1.5 * S, i * 10 * S, (PITCH_W + 3) * S, 10 * S);
    }
    g.fillStyle(0x1e8d70, 1).fillRect(-1.5 * S, -1.5 * S, (PITCH_W + 3) * S, 1.5 * S);
    g.fillStyle(0x1a8167, 1).fillRect(-1.5 * S, PITCH_L * S, (PITCH_W + 3) * S, 1.5 * S);

    const line = Math.max(1.5, 0.32 * S);
    g.lineStyle(line, 0xfff7e9, 0.85);
    g.strokeRect(0, 0, PITCH_W * S, PITCH_L * S);
    g.lineBetween(0, (PITCH_L / 2) * S, PITCH_W * S, (PITCH_L / 2) * S);
    g.strokeCircle(50 * S, 75 * S, 10 * S);
    g.fillStyle(0xfff7e9, 0.9).fillCircle(50 * S, 75 * S, 0.5 * S);
    for (const end of [0, PITCH_L]) {
      const dir = end === 0 ? 1 : -1;
      const boxY = end === 0 ? 0 : (PITCH_L - 20) * S;
      g.strokeRect(27 * S, boxY, 46 * S, 20 * S);
      const sixY = end === 0 ? 0 : (PITCH_L - 7) * S;
      g.strokeRect(38 * S, sixY, 24 * S, 7 * S);
      g.fillCircle(50 * S, (end + dir * 13) * S, 0.45 * S);
      g.beginPath();
      g.arc(50 * S, (end + dir * 13) * S, 9 * S, dir > 0 ? Math.PI * 0.2 : Math.PI * 1.2, dir > 0 ? Math.PI * 0.8 : Math.PI * 1.8, false);
      g.strokePath();
      // Goal + net
      const net = this.add.graphics().setDepth(end === 0 ? 0.5 : PITCH_L * S + 1);
      const gy = end === 0 ? -3.4 * S : PITCH_L * S;
      net.fillStyle(0xfff7e9, 0.14).fillRect(43.5 * S, gy, 13 * S, 3.4 * S);
      net.lineStyle(Math.max(1, 0.12 * S), 0xfff7e9, 0.45);
      for (let x = 43.5; x <= 56.5; x += 1.3) net.lineBetween(x * S, gy, x * S, gy + 3.4 * S);
      for (let y = 0; y <= 3.4; y += 1.1) net.lineBetween(43.5 * S, gy + y * S, 56.5 * S, gy + y * S);
      net.lineStyle(Math.max(2, 0.55 * S), 0xffffff, 1);
      net.strokeRect(43.5 * S, gy, 13 * S, 3.4 * S);
      this.nets.push(net);
    }
    // Corner arcs
    for (const [cx, cy, a0] of [[0, 0, 0], [PITCH_W, 0, Math.PI / 2], [PITCH_W, PITCH_L, Math.PI], [0, PITCH_L, Math.PI * 1.5]] as const) {
      g.beginPath();
      g.arc(cx * S, cy * S, 2 * S, a0, a0 + Math.PI / 2, false);
      g.strokePath();
    }
    // Boards behind each goal carry the two club names.
    const boardFont = { fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif', fontStyle: '900', fontSize: `${Math.round(2.6 * S)}px`, color: '#FFF7E9' };
    const flip = this.flip(this.controller.snapshot);
    const topName = flip ? this.controller.home.name : this.controller.away.name;
    const bottomName = flip ? this.controller.away.name : this.controller.home.name;
    for (const [y, text, colour] of [[-11, topName, '#182a47'], [PITCH_L + 7, bottomName, '#182a47']] as const) {
      g.fillStyle(hex(colour), 1).fillRect(4 * S, y * S, (PITCH_W - 8) * S, 4 * S);
      this.add.text(50 * S, (y + 2) * S, `${text.toUpperCase()}  ·  TOUCHLINE!  ·  ${text.toUpperCase()}`, boardFont).setOrigin(0.5).setDepth(0.6).setAlpha(0.9);
    }
  }

  private makeFigure(p: LineupPlayer, side: TeamSide, kit: { primary: string; secondary: string }): Figure {
    const S = this.S;
    const isUser = side === this.controller.userSide;
    const isKeeper = p.role === 'GK';
    const skin = SKIN[p.appearance.skinId];
    const hair = HAIR[p.appearance.hairColour];
    const ink = 0x1b2235;
    const shirt = isKeeper ? (isUser ? 0xcbf238 : 0xf4c653) : hex(kit.primary);
    const trim = isKeeper ? ink : hex(kit.secondary);
    const ow = Math.max(1, 0.2 * S);

    const ring = this.add.graphics();
    const shadow = this.add.ellipse(0, 0, 3.2 * S, 1.1 * S, 0x000000, 0.32);

    const legL = this.add.graphics();
    const legR = this.add.graphics();
    for (const [g, x] of [[legL, -0.65], [legR, 0.65]] as const) {
      g.fillStyle(trim, 1).fillRoundedRect((x - 0.45) * S, -2.2 * S, 0.9 * S, 1.7 * S, 0.3 * S);
      g.fillStyle(ink, 1).fillRoundedRect((x - 0.5) * S, -0.7 * S, 1.0 * S, 0.7 * S, 0.3 * S);
    }

    const torso = this.add.graphics();
    // shorts
    torso.fillStyle(isKeeper ? ink : trim === 0xfff7e9 ? 0x1b2235 : trim, 1).fillRoundedRect(-1.3 * S, -3.1 * S, 2.6 * S, 1.2 * S, 0.35 * S);
    // shirt
    torso.fillStyle(shirt, 1).fillRoundedRect(-1.55 * S, -5.4 * S, 3.1 * S, 2.6 * S, 0.7 * S);
    torso.lineStyle(ow, ink, 1).strokeRoundedRect(-1.55 * S, -5.4 * S, 3.1 * S, 2.6 * S, 0.7 * S);
    torso.fillStyle(trim, 1).fillRect(-1.55 * S, -4.0 * S, 3.1 * S, 0.35 * S);
    // arms
    torso.fillStyle(hex(skin.base), 1).fillCircle(-1.85 * S, -3.7 * S, 0.45 * S).fillCircle(1.85 * S, -3.7 * S, 0.45 * S);
    torso.fillStyle(shirt, 1).fillCircle(-1.7 * S, -4.6 * S, 0.55 * S).fillCircle(1.7 * S, -4.6 * S, 0.55 * S);

    const head = this.add.graphics();
    const hy = -6.6 * S;
    const r = 1.25 * S;
    if (p.appearance.hairId === 'afro') head.fillStyle(hex(hair.base), 1).fillCircle(0, hy - 0.3 * S, r * 1.45);
    if (p.appearance.hairId === 'manBun') head.fillStyle(hex(hair.base), 1).fillCircle(0.2 * S, hy - r * 1.05, r * 0.5);
    head.fillStyle(hex(skin.base), 1).fillCircle(0, hy, r);
    head.lineStyle(ow, ink, 1).strokeCircle(0, hy, r);
    if (p.appearance.hairId !== 'bald') {
      head.fillStyle(hex(hair.base), 1);
      head.beginPath();
      head.arc(0, hy, r * (p.appearance.hairId === 'buzz' ? 1.0 : 1.08), Math.PI * 1.02, Math.PI * 1.98, false);
      head.closePath();
      head.fillPath();
    }
    if (p.appearance.facialHairId === 'beard') head.fillStyle(hex(hair.base), 1).fillEllipse(0, hy + 0.75 * S, r * 1.4, r * 0.7);
    // tiny eye dots looking in the facing direction
    head.fillStyle(ink, 1).fillCircle(0.35 * S, hy + 0.1 * S, 0.17 * S).fillCircle(0.85 * S, hy + 0.1 * S, 0.17 * S);

    const body = this.add.container(0, 0, [legL, legR, torso, head]);
    const root = this.add.container(0, 0, [ring, shadow, body]);
    const label = this.add
      .text(0, 0, p.shortName.toUpperCase(), {
        fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif',
        fontStyle: '800',
        fontSize: `${Math.round(1.9 * S)}px`,
        color: '#FFF7E9',
        backgroundColor: isUser ? '#1B2235' : '#3a1414',
        padding: { x: Math.round(0.5 * S), y: Math.round(0.15 * S) },
      })
      .setOrigin(0.5, 1)
      .setVisible(false)
      .setDepth(PITCH_L * S + 10);
    return { id: p.id, side, root, body, legL, legR, ring, label, phase: 0, isUser, isKeeper };
  }

  private burst(x: number, y: number, colour: number, text?: string): void {
    if (this.opts.reducedMotion && !text) return;
    const snap = this.controller.snapshot;
    const w = this.toWorld(x, y, this.flip(snap));
    const S = this.S;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spark = this.add.rectangle(w.x, w.y - 2 * S, 0.5 * S, 1.6 * S, colour).setRotation(a).setDepth(PITCH_L * S + 6);
      this.tweens.add({ targets: spark, x: w.x + Math.cos(a) * 3 * S, y: w.y - 2 * S + Math.sin(a) * 3 * S, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => spark.destroy() });
    }
    if (text) {
      const t = this.add
        .text(w.x, w.y - 7 * S, text, { fontFamily: 'Barlow Condensed, sans-serif', fontStyle: '900', fontSize: `${Math.round(3 * S)}px`, color: '#CBF238', stroke: '#1B2235', strokeThickness: Math.round(0.6 * S) })
        .setOrigin(0.5)
        .setDepth(PITCH_L * S + 12);
      this.tweens.add({ targets: t, y: w.y - 11 * S, alpha: 0, duration: 900, delay: 300, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
    }
  }

  private goalFx(team: TeamSide): void {
    const cam = this.cameras.main;
    const ours = team === this.controller.userSide;
    if (!this.opts.reducedMotion) {
      cam.flash(260, 255, 255, ours ? 230 : 200);
      cam.zoomTo(this.baseZoom * 1.22, 320, 'Quad.easeOut');
      this.time.delayedCall(1500, () => cam.zoomTo(this.baseZoom, 450, 'Quad.easeInOut'));
    }
    for (const net of this.nets) this.tweens.add({ targets: net, alpha: 0.4, duration: 90, yoyo: true, repeat: 3 });
    // Confetti in the scorer's colours from the goal mouth that was hit.
    const snap = this.controller.snapshot;
    const b = this.toWorld(snap.ball.x, snap.ball.y, this.flip(snap));
    const kit = team === 'home' ? this.controller.home.kit : this.controller.away.kit;
    const count = this.opts.reducedMotion ? 8 : 26;
    for (let i = 0; i < count; i++) {
      const c = this.add.rectangle(b.x, b.y, 0.7 * this.S, 0.4 * this.S, i % 2 ? hex(kit.primary) : hex(kit.secondary)).setDepth(PITCH_L * this.S + 7);
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const dist = (6 + Math.random() * 14) * this.S;
      this.tweens.add({
        targets: c,
        x: b.x + Math.cos(ang) * dist,
        y: b.y + Math.sin(ang) * dist + 8 * this.S,
        angle: Math.random() * 720,
        alpha: 0,
        duration: 1100 + Math.random() * 500,
        ease: 'Cubic.easeOut',
        onComplete: () => c.destroy(),
      });
    }
  }

  override update(_time: number, delta: number): void {
    this.controller.update(delta);
    const prev = this.controller.previous;
    const curr = this.controller.snapshot;
    const t = this.controller.alpha;
    const flip = this.flip(curr);
    // A flip only changes at half-time, when positions reset anyway.
    const prevById = new Map(prev.players.map((p) => [p.id, p] as const));
    const S = this.S;
    const carrierId = curr.ball.ownerId;

    for (const p of curr.players) {
      const f = this.figures.get(p.id);
      if (!f) continue;
      const pp: PlayerSnapshot = this.flip(prev) === flip ? (prevById.get(p.id) ?? p) : p;
      const w = this.toWorld(lerp(pp.x, p.x, t), lerp(pp.y, p.y, t), flip);
      f.root.setPosition(w.x, w.y).setDepth(2 + w.y / S);
      const facing = (flip ? -p.facing : p.facing) as 1 | -1;
      f.body.scaleX = facing;
      // Run cycle scaled by speed.
      const moving = p.speed > 0.12 && p.action !== 'dive';
      f.phase += moving ? delta * 0.018 * Math.min(1.6, p.speed) : 0;
      const swing = moving ? Math.sin(f.phase) * 0.45 * S : 0;
      f.legL.y = swing;
      f.legR.y = -swing;
      let rot = 0;
      let bob = moving ? -Math.abs(Math.sin(f.phase)) * 0.35 * S : 0;
      switch (p.action) {
        case 'kick':
          f.legR.y = -0.9 * S;
          f.legR.x = 0.6 * S;
          rot = 0.12;
          break;
        case 'tackle':
          rot = 0.45;
          break;
        case 'dive':
          rot = 1.25;
          bob = -1.2 * S;
          break;
        case 'stumble':
          rot = Math.sin(this.time.now * 0.03) * 0.25;
          break;
        case 'celebrate':
          bob = -Math.abs(Math.sin(this.time.now * 0.012)) * 1.4 * S;
          break;
        default:
          f.legR.x = 0;
      }
      if (p.action !== 'kick') f.legR.x = 0;
      f.body.rotation = rot * facing;
      f.body.y = bob;

      f.ring.clear();
      const has = p.id === carrierId;
      if (has || f.isUser) {
        f.ring.lineStyle(Math.max(1.5, (has ? 0.45 : 0.25) * S), has ? 0xcbf238 : 0xcbf238, has ? 1 : 0.55);
        f.ring.strokeEllipse(0, 0, (has ? 4.2 : 3.4) * S, (has ? 1.7 : 1.3) * S);
      }
      f.label.setVisible(has || p.action === 'celebrate');
      if (f.label.visible) f.label.setPosition(w.x, w.y - 9 * S);
    }

    // Ball (with height): shadow on the turf, ball lifted by z.
    const pb = prev.ball;
    const cb = curr.ball;
    const jump = Math.hypot(cb.x - pb.x, cb.y - pb.y) > 12; // restart placement: no tweening across the pitch
    const bx = jump ? cb.x : lerp(pb.x, cb.x, t);
    const by = jump ? cb.y : lerp(pb.y, cb.y, t);
    const bz = jump ? cb.z : lerp(pb.z, cb.z, t);
    const bw = this.toWorld(bx, by, flip);
    this.ballShadow.setPosition(bw.x, bw.y).setScale(1 / (1 + bz * 0.15)).setDepth(1.5 + bw.y / S);
    this.ball.setPosition(bw.x, bw.y - bz * 1.6 * S - 0.6 * S).setDepth(3 + bw.y / S + bz).setScale(1 + bz * 0.05);

    this.trail.clear();
    if (cb.state === 'shot' && !this.opts.reducedMotion) {
      this.trailPoints.push({ x: bw.x, y: bw.y - bz * 1.6 * S - 0.6 * S });
      if (this.trailPoints.length > 8) this.trailPoints.shift();
      this.trailPoints.forEach((pt, i) => {
        this.trail.fillStyle(0xffffff, (i / this.trailPoints.length) * 0.5).fillCircle(pt.x, pt.y, 0.55 * S * (i / this.trailPoints.length));
      });
    } else if (this.trailPoints.length) this.trailPoints = [];

    // Camera follows the ball, leading slightly towards the attack, with capped smoothing.
    const leadY = cb.ownerId ? -6 * S : 0;
    const k = this.opts.reducedMotion ? 0.04 : 0.08;
    const ease = Math.min(1, (delta / 16.7) * k);
    this.camX += (bw.x - this.camX) * ease;
    this.camY += (bw.y + leadY - this.camY) * ease;
    this.cameras.main.centerOn(this.camX, this.camY);
  }
}
