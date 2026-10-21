import Phaser from 'phaser';
import { HAIR, INK, SKIN } from '../../components/portrait/palette';
import { hashString } from '../../domain/rng';
import type { LineupPlayer, PlayerAction, TeamLineup } from '../simulation/types';

/**
 * Articulated side-on footballer for the match pitch.
 *
 * Joints (hips, knees, shoulders, elbows, neck) are separate containers so one procedural rig
 * can run, strike, slide, dive and celebrate. Every visual comes from the player's stored
 * identity (skin, hair style/colour, facial hair, accessories, running style, celebration) and
 * the club kit; every action comes from the engine's recorded action. Units: 1 = one pitch unit.
 */

const hex = (c: string): number => parseInt(c.replace('#', ''), 16);
/** Graphics.fillPoints only reads x/y; plain points avoid allocating Vector2s. */
const pts = (list: { x: number; y: number }[]) => list as unknown as Phaser.Math.Vector2[];

function shade(colour: number, k: number): number {
  const r = (colour >> 16) & 255;
  const g = (colour >> 8) & 255;
  const b = colour & 255;
  return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k);
}

const BOOTS = [0x1b2235, 0xfff7e9, 0xcbf238, 0xff7956, 0x4178ef, 0xf4c653, 0xdc63b4];

const LEG_LEN = 3.05;
const THIGH = 1.5;
const SHOULDER = { x: 0.05, y: -2.85 };
const NECK = { x: 0.22, y: -3.2 };

interface Gait {
  stride: number;
  cadence: number;
  bob: number;
  lean: number;
}

const GAITS: Record<string, Gait> = {
  upright: { stride: 0.72, cadence: 1, bob: 0.28, lean: 0.06 },
  hunched: { stride: 0.7, cadence: 1, bob: 0.22, lean: 0.24 },
  bouncy: { stride: 0.75, cadence: 1.05, bob: 0.55, lean: 0.1 },
  gliding: { stride: 0.95, cadence: 0.85, bob: 0.14, lean: 0.12 },
  choppy: { stride: 0.55, cadence: 1.35, bob: 0.3, lean: 0.14 },
};

export interface RigFrame {
  x: number;
  y: number;
  facing: 1 | -1;
  /** Pitch units per tick (from the snapshot). */
  speed: number;
  action: PlayerAction;
  isCarrier: boolean;
  /** Ball relative to the player, in display units (for keeper stance / head turn). */
  ballDx: number;
  ballDist: number;
  isScorer: boolean;
  dtMs: number;
  now: number;
  /** Action detail from the engine (skill move name). */
  detail: string | null;
  /** Screen-space velocity (display units per tick) for speed lines. */
  velX: number;
  velY: number;
  /** A genuinely quick player (high pace) at full tilt: draw speed lines. */
  sprint: boolean;
}

interface Limb {
  upper: Phaser.GameObjects.Container;
  lower: Phaser.GameObjects.Container;
}

interface Pose {
  bodyRot: number;
  lean: number;
  lift: number;
  thighF: number;
  shinF: number;
  thighB: number;
  shinB: number;
  armF: number;
  elbowF: number;
  armB: number;
  elbowB: number;
  head: number;
  /** Horizontal squash of the whole body (a roulette spin reads as the body turning). */
  spin?: number;
}

export class FootballerRig {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly torso: Phaser.GameObjects.Container;
  private readonly head: Phaser.GameObjects.Container;
  private readonly legF: Limb;
  private readonly legB: Limb;
  private readonly armF: Limb;
  private readonly armB: Limb;
  readonly ring: Phaser.GameObjects.Graphics;
  private readonly streaks: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly gait: Gait;
  private phase: number;
  private lastAction: PlayerAction = 'idle';
  private actionT = 0;
  private readonly S: number;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly player: LineupPlayer,
    kit: TeamLineup['kit'],
    S: number,
    isUser: boolean,
    private readonly reducedMotion: boolean,
  ) {
    this.S = S;
    const u = (n: number) => n * S;
    const a = player.appearance;
    const skin = SKIN[a.skinId];
    const skinBase = hex(skin.base);
    const skinShade = hex(skin.shade);
    const hair = hex(HAIR[a.hairColour].base);
    const ink = hex(INK);
    const keeper = player.role === 'GK';
    const shirt = keeper ? (isUser ? 0xcbf238 : 0xf4c653) : hex(kit.primary);
    const trim = keeper ? 0x1b2235 : hex(kit.secondary);
    const shorts = keeper ? 0x1b2235 : trim === 0xfff7e9 || trim === 0xffffff ? 0x1b2235 : trim;
    const socks = keeper ? shirt : shirt;
    const vis = hashString(`${player.id}::visual:kit`);
    const boot = BOOTS[(vis[0] ?? 0) % BOOTS.length] as number;
    const ow = Math.max(1, 0.14 * S);
    this.gait = GAITS[player.runningStyleId ?? 'upright'] ?? (GAITS.upright as Gait);
    this.phase = ((vis[1] ?? 0) % 628) / 100;

    // ---- limbs -----------------------------------------------------------------
    const makeLeg = (back: boolean): Limb => {
      const k = back ? 0.78 : 1;
      const thigh = scene.add.graphics();
      thigh.fillStyle(shade(skinBase, k), 1).fillRoundedRect(u(-0.4), 0, u(0.8), u(THIGH + 0.15), u(0.38));
      thigh.lineStyle(ow, ink, 0.8).strokeRoundedRect(u(-0.4), 0, u(0.8), u(THIGH + 0.15), u(0.38));
      const shin = scene.add.graphics();
      shin.fillStyle(shade(socks, k), 1).fillRoundedRect(u(-0.36), u(0.15), u(0.72), u(1.05), u(0.3));
      shin.fillStyle(shade(trim, k), 1).fillRect(u(-0.36), u(0.18), u(0.72), u(0.2));
      shin.fillStyle(shade(skinBase, k), 1).fillRoundedRect(u(-0.34), u(-0.1), u(0.68), u(0.35), u(0.2));
      shin.fillStyle(shade(boot, k), 1).fillRoundedRect(u(-0.42), u(1.12), u(1.3), u(0.48), u(0.24));
      shin.lineStyle(ow, ink, 0.85).strokeRoundedRect(u(-0.42), u(1.12), u(1.3), u(0.48), u(0.24));
      shin.fillStyle(ink, 0.55).fillRect(u(-0.38), u(1.48), u(1.2), u(0.1));
      const lower = scene.add.container(0, u(THIGH), [shin]);
      const upper = scene.add.container(0, 0, [thigh, lower]);
      return { upper, lower };
    };
    const makeArm = (back: boolean): Limb => {
      // Sleeves are a shade darker than the chest so arms read against the shirt.
      const k = back ? 0.72 : 0.88;
      const up = scene.add.graphics();
      up.fillStyle(shade(skinBase, k), 1).fillRoundedRect(u(-0.29), u(0.5), u(0.58), u(0.85), u(0.28));
      up.fillStyle(shade(shirt, k), 1).fillRoundedRect(u(-0.42), u(-0.15), u(0.84), u(0.8), u(0.38));
      up.fillStyle(shade(trim, k), 1).fillRect(u(-0.4), u(0.5), u(0.8), u(0.12));
      up.lineStyle(ow, ink, 0.6).strokeRoundedRect(u(-0.42), u(-0.15), u(0.84), u(0.8), u(0.38));
      const fore = scene.add.graphics();
      fore.fillStyle(shade(skinBase, k), 1).fillRoundedRect(u(-0.27), u(-0.12), u(0.54), u(1.15), u(0.26));
      const handR = keeper ? 0.5 : 0.34;
      fore.fillStyle(keeper ? shade(0xfff7e9, k) : shade(skinBase, k), 1).fillCircle(0, u(1.1), u(handR));
      if (keeper) fore.lineStyle(ow, ink, 0.6).strokeCircle(0, u(1.1), u(handR));
      const lower = scene.add.container(0, u(1.18), [fore]);
      const upper = scene.add.container(u(SHOULDER.x), u(SHOULDER.y), [up, lower]);
      return { upper, lower };
    };

    // ---- torso: shorts + shirt with the club pattern ---------------------------------
    const torsoG = scene.add.graphics();
    torsoG.fillStyle(shorts, 1).fillRoundedRect(u(-1.02), u(-0.5), u(2.04), u(1.3), u(0.38));
    torsoG.lineStyle(ow, ink, 0.85).strokeRoundedRect(u(-1.02), u(-0.5), u(2.04), u(1.3), u(0.38));
    const sx = -1.12;
    const sy = -3.25;
    const sw = 2.24;
    const sh = 2.95;
    torsoG.fillStyle(shirt, 1).fillRoundedRect(u(sx), u(sy), u(sw), u(sh), u(0.62));
    if (!keeper) {
      torsoG.fillStyle(trim, 1);
      switch (kit.pattern) {
        case 'stripes':
          for (const x of [-0.75, 0.05]) torsoG.fillRect(u(x), u(sy + 0.25), u(0.42), u(sh - 0.5));
          break;
        case 'hoops':
          for (const y of [-2.55, -1.55]) torsoG.fillRect(u(sx + 0.1), u(y), u(sw - 0.2), u(0.42));
          break;
        case 'sash':
          torsoG.fillPoints(
            pts([
              { x: u(sx + 0.15), y: u(sy + 0.35) },
              { x: u(sx + 0.75), y: u(sy + 0.25) },
              { x: u(sx + sw - 0.15), y: u(sy + sh - 0.55) },
              { x: u(sx + sw - 0.75), y: u(sy + sh - 0.35) },
            ]),
            true,
          );
          break;
        case 'halves':
          torsoG.fillRoundedRect(u(0), u(sy + 0.1), u(sw / 2 - 0.12), u(sh - 0.2), { tl: 0, tr: u(0.5), bl: 0, br: u(0.5) });
          break;
        default:
          torsoG.fillRect(u(sx + 0.2), u(-1.05), u(sw - 0.4), u(0.18));
      }
    }
    // collar + back-side shading (light from the front/top-left)
    torsoG.fillStyle(trim, 1).fillRoundedRect(u(-0.1), u(sy - 0.05), u(0.95), u(0.38), u(0.15));
    torsoG.fillStyle(0x000000, 0.16).fillRoundedRect(u(sx), u(sy), u(0.62), u(sh), { tl: u(0.62), bl: u(0.62), tr: 0, br: 0 });
    torsoG.lineStyle(ow, ink, 1).strokeRoundedRect(u(sx), u(sy), u(sw), u(sh), u(0.62));

    // ---- head ------------------------------------------------------------------
    const headG = scene.add.graphics();
    const hcX = 0.12;
    const hcY = -1.25;
    const r = 1.18;
    const deg = Phaser.Math.DegToRad;
    // neck
    headG.fillStyle(skinShade, 1).fillRoundedRect(u(-0.34), u(-0.5), u(0.68), u(0.65), u(0.2));
    if (a.hairId === 'afro') headG.fillStyle(hair, 1).fillCircle(u(hcX - 0.3), u(hcY - 0.35), u(1.7));
    if (a.hairId === 'manBun') headG.fillStyle(hair, 1).fillCircle(u(hcX - 0.95), u(hcY - 0.95), u(0.48));
    if (a.hairId === 'twists') {
      headG.lineStyle(u(0.32), hair, 1);
      for (const [x0, y0, x1, y1] of [[-0.9, -1.2, -1.3, 0.35], [-0.55, -1.6, -1.0, 0.0], [-1.05, -0.6, -1.25, 0.6]] as const) {
        headG.lineBetween(u(hcX + x0), u(hcY + y0), u(hcX + x1), u(hcY + y1));
      }
    }
    headG.fillStyle(skinBase, 1).fillCircle(u(hcX), u(hcY), u(r));
    headG.fillStyle(skinShade, 0.9);
    headG.beginPath();
    headG.arc(u(hcX), u(hcY), u(r), deg(95), deg(265), false);
    headG.closePath();
    headG.fillPath();
    headG.lineStyle(ow, ink, 1).strokeCircle(u(hcX), u(hcY), u(r));
    // hair cap (shared silhouette, per-style details)
    const capK: Record<string, number> = { bald: 0, buzz: 1.01, crew: 1.07, sidePart: 1.1, quiff: 1.08, afro: 1.12, curlyTop: 1.08, flatTop: 1.06, manBun: 1.04, twists: 1.09, slick: 1.06, mop: 1.12, cornrows: 1.03 };
    const k = capK[a.hairId] ?? 1.06;
    if (k > 0) {
      // Cap over the crown and back; the hairline rises at the front so the face stays clear.
      const front = a.hairId === 'mop' ? 10 : 335;
      const capPath = () => {
        headG.beginPath();
        headG.arc(u(hcX), u(hcY), u(r * k), deg(150), deg(front), false);
        headG.lineTo(u(hcX + r * 0.55), u(hcY - r * (a.hairId === 'mop' ? 0.15 : 0.55)));
        headG.lineTo(u(hcX - r * 0.2), u(hcY - r * 0.35));
        headG.lineTo(u(hcX - r * 0.62), u(hcY + r * 0.25));
        headG.closePath();
      };
      headG.fillStyle(hair, a.hairId === 'buzz' ? 0.85 : 1);
      capPath();
      headG.fillPath();
      headG.lineStyle(ow, ink, 0.9);
      headG.beginPath();
      headG.arc(u(hcX), u(hcY), u(r * k), deg(150), deg(front), false);
      headG.strokePath();
    }
    const light = hex(HAIR[a.hairColour].light);
    switch (a.hairId) {
      case 'quiff':
        headG.fillStyle(hair, 1).fillPoints(
          pts([
            { x: u(hcX + 0.1), y: u(hcY - r - 0.05) },
            { x: u(hcX + 1.25), y: u(hcY - r - 0.55) },
            { x: u(hcX + 1.15), y: u(hcY - 0.55) },
          ]),
          true,
        );
        break;
      case 'flatTop':
        headG.fillStyle(hair, 1).fillRect(u(hcX - 0.95), u(hcY - r - 0.55), u(1.9), u(0.8));
        break;
      case 'curlyTop':
        headG.fillStyle(hair, 1);
        for (const ang of [200, 230, 260, 290, 320]) headG.fillCircle(u(hcX + Math.cos(deg(ang)) * r), u(hcY + Math.sin(deg(ang)) * r), u(0.42));
        break;
      case 'sidePart':
        headG.fillStyle(hair, 1).fillEllipse(u(hcX + 0.75), u(hcY - 0.75), u(0.9), u(0.45));
        break;
      case 'slick':
      case 'cornrows':
        headG.lineStyle(Math.max(1, 0.1 * S), light, 0.7);
        for (const off of [-0.25, 0.15]) headG.lineBetween(u(hcX + 0.8), u(hcY - 0.85 + off), u(hcX - 0.7), u(hcY - 0.95 + off));
        break;
      case 'bald':
        headG.fillStyle(0xffffff, 0.3).fillEllipse(u(hcX + 0.2), u(hcY - 0.75), u(0.8), u(0.35));
        break;
    }
    // facial hair
    switch (a.facialHairId) {
      case 'beard':
        headG.fillStyle(hair, 1);
        headG.beginPath();
        headG.arc(u(hcX), u(hcY), u(r * 1.02), deg(-5), deg(150), false);
        headG.lineTo(u(hcX - 0.1), u(hcY + 0.35));
        headG.lineTo(u(hcX + 0.9), u(hcY + 0.4));
        headG.closePath();
        headG.fillPath();
        break;
      case 'goatee':
        headG.fillStyle(hair, 1).fillCircle(u(hcX + 0.88), u(hcY + 0.85), u(0.28));
        break;
      case 'moustache':
        headG.fillStyle(hair, 1).fillEllipse(u(hcX + 0.82), u(hcY + 0.45), u(0.55), u(0.2));
        break;
      case 'stubble':
        headG.fillStyle(hair, 0.25);
        headG.beginPath();
        headG.arc(u(hcX), u(hcY), u(r), deg(0), deg(140), false);
        headG.closePath();
        headG.fillPath();
        break;
      case 'chinstrap':
        headG.lineStyle(u(0.18), hair, 1);
        headG.beginPath();
        headG.arc(u(hcX), u(hcY), u(r * 0.95), deg(20), deg(150), false);
        headG.strokePath();
        break;
    }
    // ear, eye, brow, nose, mouth
    headG.fillStyle(shade(skinShade, 0.9), 1).fillEllipse(u(hcX - 0.22), u(hcY + 0.08), u(0.36), u(0.5));
    headG.fillStyle(0xffffff, 1).fillCircle(u(hcX + 0.68), u(hcY - 0.12), u(0.2));
    headG.fillStyle(ink, 1).fillCircle(u(hcX + 0.74), u(hcY - 0.12), u(0.13));
    headG.fillStyle(skinBase, 1).fillCircle(u(hcX + 1.12), u(hcY + 0.12), u(0.24));
    headG.lineStyle(Math.max(1, 0.12 * S), hex(skin.lip), 1).lineBetween(u(hcX + 0.62), u(hcY + 0.62), u(hcX + 0.95), u(hcY + 0.58));

    // accessories
    for (const acc of a.accessoryIds) {
      if (acc === 'headband') headG.fillStyle(0xffffff, 1).fillRect(u(hcX - 1.15), u(hcY - 0.68), u(2.3), u(0.32));
      if (acc === 'eyeBlack') headG.fillStyle(ink, 0.9).fillRect(u(hcX + 0.5), u(hcY + 0.15), u(0.42), u(0.14));
      if (acc === 'studEarring') headG.fillStyle(0xf4c653, 1).fillCircle(u(hcX - 0.25), u(hcY + 0.35), u(0.12));
      if (acc === 'noseStrip') headG.fillStyle(0xf4f1ea, 1).fillRect(u(hcX + 1.0), u(hcY - 0.05), u(0.3), u(0.18));
    }

    this.legB = makeLeg(true);
    this.legF = makeLeg(false);
    this.armB = makeArm(true);
    this.armF = makeArm(false);
    this.torso = scene.add.container(0, 0, [torsoG]);
    this.head = scene.add.container(u(NECK.x), u(NECK.y), [headG]);
    this.body = scene.add.container(0, -u(LEG_LEN), [this.armB.upper, this.legB.upper, this.legF.upper, this.torso, this.head, this.armF.upper]);

    this.ring = scene.add.graphics();
    this.streaks = scene.add.graphics();
    this.shadow = scene.add.ellipse(0, 0, u(3.4), u(1.15), 0x000000, 0.3);
    this.root = scene.add.container(0, 0, [this.ring, this.shadow, this.streaks, this.body]);
    void isUser;
  }

  /** Little dust puff at the feet (tackles, dives, strikes). */
  private puff(scale = 1): void {
    if (this.reducedMotion) return;
    const u = (n: number) => n * this.S;
    for (let i = 0; i < 4; i++) {
      const p = this.scene.add.ellipse(this.root.x + u((i - 1.5) * 0.7), this.root.y, u(1.1 * scale), u(0.7 * scale), 0xe8dcc0, 0.55).setDepth(this.root.depth + 0.1);
      this.scene.tweens.add({
        targets: p,
        x: p.x + u((i - 1.5) * 1.2),
        y: p.y - u(0.8 + i * 0.25),
        scale: 1.8,
        alpha: 0,
        duration: 420,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  update(f: RigFrame): void {
    const S = this.S;
    if (f.action !== this.lastAction) {
      this.actionT = 0;
      if (f.action === 'slide' || f.action === 'dive' || f.action === 'fouled') this.puff(1.3);
      if (f.action === 'kick' || f.action === 'tackle' || f.action === 'volley') this.puff(0.6);
      this.lastAction = f.action;
    } else {
      this.actionT += f.dtMs;
    }
    this.root.setPosition(f.x, f.y);
    // Stand still → face the ball; moving → face the running direction.
    const facing: 1 | -1 = f.speed < 0.12 && f.action === 'idle' ? (f.ballDx >= 0 ? 1 : -1) : f.facing;

    const g = this.gait;
    const run = Math.min(1.4, f.speed / 1.3);
    if (run > 0.08) this.phase += (f.dtMs / 1000) * (7 + run * 6) * g.cadence;
    const ph = this.phase;
    const sin = Math.sin(ph);
    const stride = g.stride * Math.min(1, run * 1.2);
    const p: Pose = {
      bodyRot: 0,
      lean: g.lean * Math.min(1, run * 1.5) + (f.isCarrier ? 0.06 : 0),
      lift: -Math.abs(Math.sin(ph)) * g.bob * Math.min(1, run * 1.5),
      thighF: -stride * sin,
      shinF: 0.15 + 1.05 * Math.max(0, sin) * Math.min(1, run * 1.5),
      thighB: stride * sin,
      shinB: 0.15 + 1.05 * Math.max(0, -sin) * Math.min(1, run * 1.5),
      armF: stride * 0.95 * sin,
      elbowF: run > 0.08 ? -1.35 : -0.25,
      armB: -stride * 0.95 * sin,
      elbowB: run > 0.08 ? -1.35 : -0.25,
      head: f.isCarrier ? 0.18 : 0,
    };
    if (run <= 0.08) {
      // idle breathing
      p.lift = Math.sin(f.now / 420 + ph) * 0.06;
      p.armF = 0.08;
      p.armB = -0.08;
      // goalkeeper set position when the ball is close to his area
      if (this.player.role === 'GK' && f.ballDist < 40 && f.action === 'idle') {
        Object.assign(p, { lift: 0.55, lean: 0.32, thighF: -0.55, shinF: 1.0, thighB: -0.35, shinB: 0.95, armF: -1.0, elbowF: -0.35, armB: -0.85, elbowB: -0.35 });
      }
    }

    const t = this.actionT;
    switch (f.action) {
      case 'kick': {
        const k = Math.min(1, t / 300);
        if (k < 0.35) {
          Object.assign(p, { thighF: 0.9, shinF: 1.3, armF: -0.9, armB: 0.7, lean: -0.05 });
        } else {
          const s = Math.min(1, (k - 0.35) / 0.3);
          const e = 1 - (1 - s) * (1 - s);
          Object.assign(p, { thighF: 0.9 - 2.4 * e, shinF: 1.3 * (1 - e) + 0.05, armF: -0.9 + 0.3 * e, armB: 0.9, lean: -0.15 * e });
        }
        break;
      }
      case 'slide':
        // Feet-first slide along the turf.
        Object.assign(p, { bodyRot: -1.1, lift: 2.3, thighF: -0.5, shinF: 0.05, thighB: 0.1, shinB: 1.4, armF: 0.9, elbowF: -0.2, armB: -0.6, elbowB: -0.4, lean: 0 });
        break;
      case 'tackle': {
        // Standing block: plant, lunge the front leg across the ball.
        const k = Math.min(1, t / 140);
        Object.assign(p, { lean: 0.28 * k, lift: 0.45 * k, thighF: -1.25 * k, shinF: 0.15, thighB: 0.55 * k, shinB: 0.8, armF: -0.6, elbowF: -0.6, armB: 0.9, elbowB: -0.4 });
        break;
      }
      case 'dive': {
        // Full-stretch dive towards the facing side, arms leading; lands on the side.
        const k = Math.min(1, t / 140);
        const air = Math.sin(Math.min(1, t / 520) * Math.PI);
        Object.assign(p, { bodyRot: 1.35 * k, lift: -1.4 * air + 1.6 * Math.max(0, (t - 520) / 300 > 1 ? 1 : (t - 520) / 300), thighF: 0.25, shinF: 0.3, thighB: 0.55, shinB: 0.7, armF: -2.95, elbowF: 0, armB: -2.75, elbowB: 0, lean: 0 });
        break;
      }
      case 'catch':
        // Get the body behind it: crouch and gather into the chest.
        Object.assign(p, { lift: 0.6, lean: 0.3, thighF: -0.6, shinF: 1.0, thighB: -0.3, shinB: 1.0, armF: -1.35, elbowF: -1.3, armB: -1.25, elbowB: -1.35, head: 0.1 });
        break;
      case 'header': {
        // Leap, then snap the head through the ball.
        const k = Math.min(1, t / 420);
        Object.assign(p, { lift: -2.2 * Math.sin(k * Math.PI), lean: -0.15 + 0.45 * k, head: -0.4 + 0.7 * k, thighF: -0.2, shinF: 1.3, thighB: 0.4, shinB: 1.4, armF: -2.0, elbowF: -0.6, armB: 1.0, elbowB: -0.3 });
        break;
      }
      case 'volley': {
        // Scissor volley: lean back, strike leg high.
        const k = Math.min(1, t / 260);
        Object.assign(p, { bodyRot: -0.35 * k, lift: -0.9 * Math.sin(Math.min(1, t / 400) * Math.PI), lean: -0.35, thighF: -1.9 * k, shinF: 0.15, thighB: 0.5, shinB: 1.1, armF: -1.8, elbowF: -0.3, armB: 1.3, elbowB: -0.2 });
        break;
      }
      case 'skill':
        this.skill(p, f);
        break;
      case 'wall':
        // Shoulder to shoulder, hands protecting, bouncing on the toes.
        Object.assign(p, { lift: -Math.abs(Math.sin(f.now / 140)) * 0.12, lean: 0.05, armF: 0.55, elbowF: -1.55, armB: 0.45, elbowB: -1.6, thighF: -0.08, thighB: 0.08 });
        break;
      case 'fouled': {
        // Clipped: stumble forward and go down.
        const k = Math.min(1, t / 380);
        Object.assign(p, { bodyRot: 1.25 * k, lift: 2.0 * k, lean: 0.2, armF: -2.4, elbowF: -0.3, armB: -2.0, elbowB: -0.4, thighF: -0.4, shinF: 0.6, thighB: 0.6, shinB: 0.9 });
        break;
      }
      case 'stumble':
        Object.assign(p, { bodyRot: 0.32 + Math.sin(f.now / 45) * 0.12, armF: -2.2 + Math.sin(f.now / 60) * 0.6, armB: 1.6, elbowF: -0.4, elbowB: -0.4 });
        break;
      case 'celebrate':
        this.celebrate(p, f);
        break;
    }

    const u = (n: number) => n * S;
    // Rotation is applied after the facing mirror, so it has to be mirrored too.
    this.body.rotation = p.bodyRot * facing;
    this.body.scaleX = facing * (p.spin ?? 1);
    this.body.y = -u(LEG_LEN) + u(p.lift);
    this.torso.rotation = p.lean;
    const rot = (x: number, y: number) => ({ x: x * Math.cos(p.lean) - y * Math.sin(p.lean), y: x * Math.sin(p.lean) + y * Math.cos(p.lean) });
    const sh = rot(SHOULDER.x, SHOULDER.y);
    const nk = rot(NECK.x, NECK.y);
    this.armF.upper.setPosition(u(sh.x), u(sh.y)).setRotation(p.armF + p.lean);
    this.armB.upper.setPosition(u(sh.x - 0.1), u(sh.y)).setRotation(p.armB + p.lean);
    this.armF.lower.rotation = p.elbowF;
    this.armB.lower.rotation = p.elbowB;
    this.head.setPosition(u(nk.x), u(nk.y)).setRotation(p.lean * 0.5 + p.head);
    this.legF.upper.rotation = p.thighF;
    this.legF.lower.rotation = p.shinF;
    this.legB.upper.rotation = p.thighB;
    this.legB.lower.rotation = p.shinB;
    // Shadow shrinks as the body leaves the ground.
    const air = Math.max(0, -p.lift);
    this.shadow.setScale(1 / (1 + air * 0.25), 1);

    // Speed lines behind genuinely quick players at full tilt.
    this.streaks.clear();
    const v = Math.hypot(f.velX, f.velY);
    if (f.sprint && v > 0.01 && !this.reducedMotion && run > 0.85) {
      const nx = -f.velX / v;
      const ny = -f.velY / v;
      this.streaks.lineStyle(Math.max(1, 0.18 * S), 0xfff7e9, 0.55);
      for (const [off, len, h] of [[-0.7, 2.2, -2.2], [0.1, 3.0, -3.0], [0.8, 1.8, -1.2]] as const) {
        const ox = -ny * off * S;
        const oy = nx * off * S;
        const sx = ox + nx * 1.6 * S;
        const sy = oy + ny * 1.6 * S + h * S;
        this.streaks.lineBetween(sx, sy, sx + nx * len * S, sy + ny * len * S);
      }
    }
  }

  /** Named dribbling skills, keyed by the engine's recorded move. */
  private skill(p: Pose, f: RigFrame): void {
    const t = this.actionT;
    const k = Math.min(1, t / 700);
    switch (f.detail) {
      case 'stepover': {
        // Front leg circles over the ball twice; hips sway.
        const w = Math.sin(k * Math.PI * 4);
        Object.assign(p, { thighF: -0.7 + 0.5 * Math.cos(k * Math.PI * 4), shinF: 0.9, thighB: 0.25, shinB: 0.5, lean: 0.12 + w * 0.12, lift: 0.25, armF: -0.9 - w * 0.4, armB: 0.6 + w * 0.4 });
        break;
      }
      case 'nutmeg':
        // Low, quick poke through the legs.
        Object.assign(p, { lean: 0.35, lift: 0.5, thighF: -1.0 + Math.min(1, t / 160) * 0.3, shinF: 0.2, thighB: 0.6, shinB: 0.9, armF: -0.4, armB: 0.8 });
        break;
      case 'roulette':
        // Drag-and-spin: the body turns a full circle over the ball.
        Object.assign(p, { spin: this.reducedMotion ? 1 : Math.cos(k * Math.PI * 2), lean: 0.1, thighF: -0.5, shinF: 0.6, thighB: 0.4, shinB: 0.6, armF: -1.2, armB: 1.2, elbowF: -0.2, elbowB: -0.2 });
        break;
      case 'flick':
        // Rainbow flick: heel kicks up behind.
        Object.assign(p, { lean: 0.15, lift: -0.4 * Math.sin(k * Math.PI), thighB: 1.1 - 0.4 * k, shinB: 1.9, thighF: -0.2, shinF: 0.3, armF: -1.5, armB: 1.4 });
        break;
      default:
        // Drag back: sole on the ball, lean away.
        Object.assign(p, { lean: -0.18, thighF: -0.55 + 0.4 * k, shinF: 0.45, thighB: 0.35, shinB: 0.4, armF: -1.4, armB: 1.2, elbowF: -0.2 });
    }
  }

  private celebrate(p: Pose, f: RigFrame): void {
    const time = f.now;
    const pump = Math.sin(time / 110);
    if (!f.isScorer) {
      Object.assign(p, { lift: -Math.abs(Math.sin(time / 160)) * 1.0, armF: -2.7 + pump * 0.2, armB: -2.5 - pump * 0.2, elbowF: -0.2, elbowB: -0.2 });
      return;
    }
    switch (this.player.celebrationId) {
      case 'kneeSlide':
        Object.assign(p, { lift: 1.45, lean: -0.35, thighF: -1.45, shinF: 1.55, thighB: -1.2, shinB: 1.6, armF: -2.4, armB: -2.2, elbowF: -0.2, elbowB: -0.2, head: -0.3 });
        break;
      case 'aeroplane':
        Object.assign(p, { bodyRot: Math.sin(time / 260) * 0.22, armF: -1.57, armB: 1.57, elbowF: 0, elbowB: 0 });
        break;
      case 'salute':
        Object.assign(p, { armF: -2.6, elbowF: -2.2, armB: 0.1, elbowB: -0.2, lean: -0.05 });
        break;
      case 'cuppedEar':
        Object.assign(p, { armF: -2.1, elbowF: -2.4, armB: 0.3, lean: -0.1, head: -0.15 });
        break;
      case 'shush':
        Object.assign(p, { armF: -0.9, elbowF: -2.5, armB: 0.2, lean: 0.05 });
        break;
      case 'robot': {
        const step = Math.floor(time / 220) % 4;
        Object.assign(p, { armF: [-1.57, 0, -1.57, -3.1][step] as number, elbowF: [0, -1.57, -1.57, 0][step] as number, armB: [0, -1.57, -3.1, -1.57][step] as number, elbowB: -1.57 });
        break;
      }
      case 'heartHands':
        Object.assign(p, { armF: -2.2, elbowF: -1.3, armB: -2.0, elbowB: -1.3, head: -0.1 });
        break;
      case 'cornerFlag':
        Object.assign(p, { lift: -Math.abs(pump) * 0.6, thighF: pump * 0.9, shinF: 0.3, thighB: -pump * 0.6, armF: -1.2 + pump * 0.6, armB: -1.2 - pump * 0.6 });
        break;
      case 'backflip': {
        const k = Math.min(1, this.actionT / 750);
        if (k < 1 && !this.reducedMotion) {
          Object.assign(p, { bodyRot: -k * Math.PI * 2, lift: -Math.sin(k * Math.PI) * 3, thighF: -1.2, shinF: 1.5, thighB: -1.2, shinB: 1.5, armF: -2.8, armB: -2.8 });
        } else {
          Object.assign(p, { armF: -2.8, armB: -2.6, elbowF: -0.1, elbowB: -0.1 });
        }
        break;
      }
      default:
        Object.assign(p, { lift: -Math.abs(Math.sin(time / 160)) * 1.2, armF: -2.8, armB: -2.6, elbowF: -0.2, elbowB: -0.2 });
    }
  }
}
