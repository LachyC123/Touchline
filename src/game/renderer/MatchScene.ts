import Phaser from 'phaser';
import { cardStats } from '../../domain/players/rating';
import type { Attributes } from '../../domain/players/types';
import { PITCH_L, PITCH_W } from '../simulation/constants';
import type { LineupPlayer, MatchSnapshot, PlayerSnapshot, TeamLineup, TeamSide } from '../simulation/types';
import type { MatchController } from './controller';
import { FootballerRig } from './footballerRig';

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
  rig: FootballerRig;
  label: Phaser.GameObjects.Text;
  isUser: boolean;
}

export class MatchScene extends Phaser.Scene {
  private S = 5;
  private figures = new Map<string, Figure>();
  private players = new Map<string, LineupPlayer>();
  private pace = new Map<string, number>();
  private ball!: Phaser.GameObjects.Container;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private trail!: Phaser.GameObjects.Graphics;
  private trailPoints: { x: number; y: number }[] = [];
  private camX = 0;
  private camY = 0;
  private baseZoom = 1;
  private unsubscribe: (() => void) | null = null;
  private nets: Phaser.GameObjects.Graphics[] = [];
  private scorerId: string | null = null;
  private trailColour = 0xffffff;

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
      for (const p of team.players) {
        this.figures.set(p.id, this.makeFigure(p, side, team.kit));
        this.players.set(p.id, p);
        this.pace.set(p.id, p.attributes.pace);
      }
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
      onGoal: (e, shot) => {
        this.scorerId = e.scorerId;
        this.goalFx(e.team);
        const label = shot?.style === 'long' ? 'SCREAMER!' : shot?.style === 'header' ? 'HEADER!' : shot?.style === 'volley' ? 'VOLLEY!' : shot?.style === 'freeKick' ? 'TOP BIN!' : null;
        if (label) this.callout(e.scorerId, label, 0xf4c653, 1.6);
      },
      onSave: (e) => {
        if (e.style === 'catch') {
          this.ring(e.at.x, e.at.y, 0xfff7e9);
          return;
        }
        this.burst(e.at.x, e.at.y, 0xcbf238, e.double ? 'DOUBLE SAVE!' : e.style === 'fingertip' ? 'FINGERTIPS!' : 'SAVE!');
        this.ring(e.at.x, e.at.y, 0xcbf238);
        this.statChip(e.keeperId, 'REF');
      },
      onTackle: (e) => {
        if (!e.won) return;
        this.impact(e.at.x, e.at.y);
        if (e.style === 'slide') this.statChip(e.challengerId, 'DEF');
      },
      onSkill: (e) => {
        const label = { stepover: 'STEPOVER', nutmeg: 'NUTMEG!', roulette: 'ROULETTE', flick: 'RAINBOW FLICK!', dragBack: 'DRAG BACK' }[e.move];
        this.callout(e.playerId, label, 0xfff7e9, 1.1);
        this.statChip(e.playerId, 'DRI', 0.35);
        this.swirl(e.at.x, e.at.y);
      },
      onFoul: (e) => {
        this.impact(e.at.x, e.at.y);
        if (e.booked) this.card(e.foulerId);
        this.callout(e.foulerId, e.award === 'penalty' ? 'PENALTY!' : 'FOUL', e.award === 'penalty' ? 0xff7956 : 0xfff7e9, e.award === 'penalty' ? 1.5 : 0.9);
      },
      onClearance: (e) => this.ring(e.at.x, e.at.y, 0xfff7e9),
      onMiss: (e) => {
        if (e.outcome === 'woodwork') {
          this.burst(e.target.x, e.target.y, 0xfff7e9, 'CLANG!');
          for (const net of this.nets) this.tweens.add({ targets: net, x: { from: -0.25 * this.S, to: 0.25 * this.S }, duration: 45, yoyo: true, repeat: 4, onComplete: () => net.setX(0) });
          if (!this.opts.reducedMotion) this.cameras.main.shake(160, 0.004);
        } else if (e.outcome === 'wide') {
          this.burst(e.target.x, e.target.y, 0x9fb0cc, 'WIDE');
        } else {
          this.impact(e.target.x, e.target.y);
        }
      },
      onShot: (e) => {
        this.trailPoints = [];
        this.trailColour = e.style === 'long' || e.style === 'freeKick' ? 0xf4c653 : 0xffffff;
        if (e.style === 'long' || e.style === 'freeKick') this.statChip(e.shooterId, e.style === 'freeKick' ? 'SET' : 'SHO');
        if (e.style === 'header') this.statChip(e.shooterId, 'STR');
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

  private makeFigure(p: LineupPlayer, side: TeamSide, kit: TeamLineup['kit']): Figure {
    const S = this.S;
    const isUser = side === this.controller.userSide;
    const rig = new FootballerRig(this, p, kit, S, isUser, this.opts.reducedMotion);
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
    return { id: p.id, side, rig, label, isUser };
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

  /**
   * The number behind the moment: a small card-style chip ("DRI 81") over the player when a
   * strong attribute decided what just happened. Values are the same numbers as on his card.
   */
  private statChip(playerId: string, key: 'DRI' | 'SHO' | 'DEF' | 'REF' | 'STR' | 'SET', delay = 0): void {
    const lp = this.players.get(playerId);
    const f = this.figures.get(playerId);
    if (!lp || !f) return;
    const a = lp.attributes;
    const card = cardStats({ attributes: a as unknown as Attributes, primaryPosition: lp.naturalPosition });
    const value = key === 'DRI' ? a.dribbling : key === 'STR' ? a.strength : key === 'SET' ? a.setPieces : (card.find((c) => c.key === key)?.value ?? 0);
    if (value < 65) return; // only good stats get the spotlight
    const S = this.S;
    const colour = value >= 80 ? '#F4C653' : value >= 72 ? '#CBF238' : '#FFF7E9';
    const text = this.add
      .text(0, 0, `${key} ${value}`, { fontFamily: 'Barlow Condensed, sans-serif', fontStyle: '900', fontSize: `${Math.round(2.1 * S)}px`, color: '#1B2235', backgroundColor: colour, padding: { x: Math.round(0.5 * S), y: Math.round(0.1 * S) } })
      .setOrigin(0.5, 1)
      .setDepth(PITCH_L * S + 13)
      .setAlpha(0);
    const x0 = f.rig.root.x + 2.6 * S * (f.isUser ? 1 : -1);
    const y0 = f.rig.root.y - 7.5 * S;
    text.setPosition(x0, y0);
    this.tweens.add({ targets: text, alpha: 1, y: y0 - 1.2 * S, duration: 220, delay: delay * 1000, ease: 'Back.easeOut' });
    this.tweens.add({ targets: text, alpha: 0, y: y0 - 3 * S, duration: 380, delay: delay * 1000 + 1250, ease: 'Quad.easeIn', onComplete: () => text.destroy() });
  }

  /** Short comic callout above a player (skill names, FOUL, PENALTY!). */
  private callout(playerId: string, label: string, colour: number, scale: number): void {
    const f = this.figures.get(playerId);
    if (!f) return;
    const S = this.S;
    const t = this.add
      .text(f.rig.root.x, f.rig.root.y - 10 * S, label, { fontFamily: 'Barlow Condensed, sans-serif', fontStyle: '900', fontSize: `${Math.round(2.6 * S * scale)}px`, color: `#${colour.toString(16).padStart(6, '0')}`, stroke: '#1B2235', strokeThickness: Math.round(0.6 * S) })
      .setOrigin(0.5)
      .setDepth(PITCH_L * S + 12)
      .setScale(this.opts.reducedMotion ? 1 : 0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 3 * S, duration: 420, delay: 900, onComplete: () => t.destroy() });
  }

  /** Booking: a yellow card held up over the player. */
  private card(playerId: string): void {
    const f = this.figures.get(playerId);
    if (!f) return;
    const S = this.S;
    const c = this.add.rectangle(f.rig.root.x + 2 * S, f.rig.root.y - 9 * S, 1.6 * S, 2.2 * S, 0xf4c653).setStrokeStyle(Math.max(1, 0.2 * S), 0x1b2235).setDepth(PITCH_L * S + 12).setAngle(-12);
    this.tweens.add({ targets: c, y: c.y - 1.5 * S, angle: 8, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, duration: 300, delay: 1500, onComplete: () => c.destroy() });
  }

  /** A little swirl of sparks around a skill move. */
  private swirl(x: number, y: number): void {
    if (this.opts.reducedMotion) return;
    const w = this.toWorld(x, y, this.flip(this.controller.snapshot));
    const S = this.S;
    for (let i = 0; i < 5; i++) {
      const a0 = (i / 5) * Math.PI * 2;
      const dot = this.add.circle(w.x + Math.cos(a0) * 2 * S, w.y - 1 * S + Math.sin(a0) * 0.8 * S, 0.3 * S, 0xcbf238).setDepth(PITCH_L * S + 6);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 500,
        onUpdate: (tw) => {
          const k = tw.getValue() ?? 0;
          const a = a0 + k * Math.PI * 2;
          dot.setPosition(w.x + Math.cos(a) * (2 + k * 2) * S, w.y - (1 + k * 2) * S + Math.sin(a) * 0.8 * S);
          dot.setAlpha(1 - k);
        },
        onComplete: () => dot.destroy(),
      });
    }
  }

  /** An expanding ring (keeper saves). */
  private ring(x: number, y: number, colour: number): void {
    if (this.opts.reducedMotion) return;
    const w = this.toWorld(x, y, this.flip(this.controller.snapshot));
    const S = this.S;
    const g = this.add.circle(w.x, w.y - 2 * S, 1.5 * S).setStrokeStyle(Math.max(1.5, 0.35 * S), colour, 1).setDepth(PITCH_L * S + 6);
    g.isFilled = false;
    this.tweens.add({ targets: g, scale: 3.2, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
  }

  /** A comic "impact star" for won tackles and blocks: short, local and small. */
  private impact(x: number, y: number): void {
    const w = this.toWorld(x, y, this.flip(this.controller.snapshot));
    const S = this.S;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 16; i++) {
      const r = (i % 2 === 0 ? 1.9 : 0.85) * S;
      const a = (i / 16) * Math.PI * 2;
      pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    const star = this.add.graphics({ x: w.x, y: w.y - 1.5 * S }).setDepth(PITCH_L * S + 6);
    star.fillStyle(0xfff7e9, 0.95).fillPoints(pts, true);
    star.lineStyle(Math.max(1, 0.2 * S), 0x1b2235, 1).strokePoints(pts, true);
    star.setScale(this.opts.reducedMotion ? 0.8 : 0.3);
    this.tweens.add({ targets: star, scale: 1, alpha: 0, angle: 25, duration: this.opts.reducedMotion ? 300 : 360, ease: 'Back.easeOut', onComplete: () => star.destroy() });
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

    const ballNow = this.toWorld(curr.ball.x, curr.ball.y, flip);
    for (const p of curr.players) {
      const f = this.figures.get(p.id);
      if (!f) continue;
      const pp: PlayerSnapshot = this.flip(prev) === flip ? (prevById.get(p.id) ?? p) : p;
      const w = this.toWorld(lerp(pp.x, p.x, t), lerp(pp.y, p.y, t), flip);
      const w0 = this.toWorld(pp.x, pp.y, flip);
      const w1 = this.toWorld(p.x, p.y, flip);
      const facing = (flip ? -p.facing : p.facing) as 1 | -1;
      const has = p.id === carrierId;
      f.rig.update({
        x: w.x,
        y: w.y,
        facing,
        speed: this.controller.isRunning() ? p.speed : 0,
        action: p.action,
        isCarrier: has,
        ballDx: (ballNow.x - w.x) / S,
        ballDist: Math.hypot(ballNow.x - w.x, ballNow.y - w.y) / S,
        isScorer: p.id === this.scorerId,
        dtMs: this.controller.isRunning() || p.action === 'celebrate' ? delta : 0,
        now: this.time.now,
        detail: p.detail,
        velX: (w1.x - w0.x) / S,
        velY: (w1.y - w0.y) / S,
        sprint: (this.pace.get(p.id) ?? 0) >= 72 && p.speed > 1.3,
      });
      f.rig.root.setDepth(2 + w.y / S);
      f.rig.ring.clear();
      if (has || f.isUser) {
        // Our players: lime rings; an opposition carrier gets a white one.
        f.rig.ring.lineStyle(Math.max(1.5, (has ? 0.45 : 0.25) * S), f.isUser ? 0xcbf238 : 0xfff7e9, has ? 1 : 0.55);
        f.rig.ring.strokeEllipse(0, 0, (has ? 4.4 : 3.6) * S, (has ? 1.8 : 1.35) * S);
      }
      f.label.setVisible(has || (p.action === 'celebrate' && p.id === this.scorerId));
      if (f.label.visible) f.label.setPosition(w.x, w.y - 10.5 * S);
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
        this.trail.fillStyle(this.trailColour, (i / this.trailPoints.length) * 0.6).fillCircle(pt.x, pt.y, 0.55 * S * (i / this.trailPoints.length));
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
