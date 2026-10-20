import { memo, useId, type ReactNode } from 'react';
import { hashString } from '../../domain/rng';
import type { Kit } from '../../domain/club/types';
import type { Appearance, BrowId, EyeId, HairId, MouthId, NoseId } from '../../domain/players/types';
import { smoothClosed, smoothOpen, mirrorX, type Pt } from './geometry';
import { CROWN_Y, FACE_SHAPES, HAIR, INK, IRIS, SKIN } from './palette';

/**
 * Procedural head-and-shoulders portrait.
 *
 * Every part is authored against the same anchors (centre x=100, crown y=38, eyes y=99,
 * mouth y=129) with a single ink weight and a consistent top-left light, so any legal
 * combination reads as one illustration style. Output is a pure function of
 * (appearance, kit): the same player renders identically on every card, the pitch and
 * after a reload.
 */

const CX = 100;
const CY = 74; // cranium centre
const EYE_Y = 99;
const MOUTH_Y = 129;
const STROKE = 2.6;

interface PortraitProps {
  appearance: Appearance;
  kit: Kit;
  /** Accessible description, e.g. player name. Omit when the parent already labels it. */
  title?: string;
  className?: string;
  /** Simplified rendering for tiny sizes (drops texture strokes). */
  compact?: boolean;
}

interface Ctx {
  a: Appearance;
  kit: Kit;
  t: number; // temple half-width
  c: number; // cheek half-width
  j: number; // jaw half-width
  chinY: number;
  chinW: number;
  ew: number; // eye offset from centre
  skin: (typeof SKIN)[keyof typeof SKIN];
  hair: (typeof HAIR)[keyof typeof HAIR];
  uid: string;
  compact: boolean;
}

function facePoints(t: number, c: number, j: number, chinY: number, chinW: number): Pt[] {
  const right: Pt[] = [
    [CX + t * 0.72, CROWN_Y + 7],
    [CX + t, 70],
    [CX + c, 101],
    [CX + j, 127],
    [CX + chinW, chinY - 3],
  ];
  return [[CX, CROWN_Y], ...right, [CX, chinY], ...mirrorX(right).reverse()];
}

function capOuter(R: number, RY: number, sideY: number): string {
  const top = CY - RY;
  return `M${CX - R},${sideY} C${CX - R},${CY - RY * 0.55} ${CX - R * 0.55},${top} ${CX},${top} C${CX + R * 0.55},${top} ${CX + R},${CY - RY * 0.55} ${CX + R},${sideY}`;
}

function crewHairline(t: number, sideY: number, frontY: number, templeY = 70): string {
  return `M${CX + t - 3},${sideY} L${CX + t - 5},${templeY} Q${CX + t * 0.45},${frontY - 3} ${CX},${frontY} Q${CX - t * 0.45},${frontY - 3} ${CX - t + 5},${templeY} L${CX - t + 3},${sideY}`;
}

function bumpyArc(R: number, RY: number, sideY: number, bumps: number, amp: number): string {
  const pts: Pt[] = [[CX - R, sideY]];
  const steps = bumps * 2;
  for (let i = 0; i <= steps; i++) {
    const ang = Math.PI - (i / steps) * Math.PI;
    const k = i % 2 === 0 ? 1 : 0;
    const rx = R + k * amp;
    const ry = RY + k * amp;
    pts.push([CX + Math.cos(ang) * rx, CY - 6 - Math.sin(ang) * ry]);
  }
  pts.push([CX + R, sideY]);
  return smoothOpen(pts, 0.9);
}

interface HairStyle {
  back?: ReactNode;
  /** Open path, left side → over the crown → right side. */
  outer: string;
  /** Open path, right side → hairline → left side (starts where `outer` ends). */
  hairline: string;
  strokeOuter: boolean;
  extras?: ReactNode;
}

function hairStyle(id: Exclude<HairId, 'bald'>, x: Ctx): HairStyle {
  const { t, hair, compact } = x;
  const tex = (d: string, key: string, w = 1.8, colour = hair.light, opacity = 0.7) =>
    compact ? null : <path key={key} d={d} fill="none" stroke={colour} strokeWidth={w} strokeLinecap="round" opacity={opacity} />;

  switch (id) {
    case 'buzz':
      return {
        outer: capOuter(t + 1.5, 37.5, 86),
        hairline: crewHairline(t, 86, 61),
        strokeOuter: true,
      };
    case 'crew':
      return {
        outer: capOuter(t + 4, 40, 90),
        hairline: crewHairline(t, 90, 62),
        strokeOuter: true,
        extras: [
          tex(`M${CX - t * 0.5},${48} Q${CX - t * 0.2},${40} ${CX + t * 0.2},${42}`, 'a'),
          tex(`M${CX - t * 0.75},${60} Q${CX - t * 0.6},${50} ${CX - t * 0.35},${46}`, 'b'),
        ],
      };
    case 'sidePart':
      return {
        outer: capOuter(t + 5, 42, 90),
        hairline: `M${CX + t - 2},90 L${CX + t - 4},72 C${CX + t - 12},64 ${CX + 8},68 ${CX - 6},59 Q${CX - t + 10},56 ${CX - t + 4},70 L${CX - t + 2},90`,
        strokeOuter: true,
        extras: [
          <path key="part" d={`M${CX - t * 0.42},${36} Q${CX - t * 0.36},${48} ${CX - t * 0.5},${57}`} fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />,
          tex(`M${CX - t * 0.2},${42} Q${CX + t * 0.3},${44} ${CX + t * 0.65},${58}`, 'a', 2.2),
        ],
      };
    case 'quiff':
      return {
        outer: `M${CX - t - 4},88 C${CX - t - 5},52 ${CX - t * 0.7},34 ${CX - 12},30 C${CX - 2},12 ${CX + t * 0.85},14 ${CX + t + 3},34 C${CX + t + 5},46 ${CX + t + 4},60 ${CX + t + 4},88`,
        hairline: crewHairline(t, 88, 63),
        strokeOuter: true,
        extras: [
          tex(`M${CX - 8},${30} C${CX + 4},${20} ${CX + t * 0.6},${22} ${CX + t * 0.8},${34}`, 'a', 2.6),
          tex(`M${CX - t * 0.55},${50} Q${CX - t * 0.3},${36} ${CX - 4},${36}`, 'b', 2),
        ],
      };
    case 'slick':
      return {
        outer: capOuter(t + 3, 39.5, 84),
        hairline: `M${CX + t - 4},84 L${CX + t - 6},66 Q${CX + t * 0.5},55 ${CX + 4},58 Q${CX - t * 0.5},55 ${CX - t + 6},66 L${CX - t + 4},84`,
        strokeOuter: true,
        extras: [
          tex(`M${CX - t * 0.5},${58} Q${CX - t * 0.45},${42} ${CX - t * 0.1},${36}`, 'a', 1.6),
          tex(`M${CX - t * 0.1},${57} Q${CX},${42} ${CX + t * 0.3},${37}`, 'b', 1.6),
          tex(`M${CX + t * 0.35},${58} Q${CX + t * 0.45},${45} ${CX + t * 0.7},${42}`, 'c', 1.6),
        ],
      };
    case 'mop': {
      const R = t + 7;
      const fringe: Pt[] = [];
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const xx = CX + t - 2 - (i / n) * (2 * t - 4);
        fringe.push([xx, i % 2 === 0 ? 80 : 73]);
      }
      return {
        outer: capOuter(R, 43, 97),
        hairline: `M${CX + t + 2},97 L${CX + t},82 ` + smoothOpen(fringe, 0.6).replace(/^M/, 'L') + ` L${CX - t},82 L${CX - t - 2},97`,
        strokeOuter: true,
        extras: [tex(`M${CX - t * 0.7},${54} Q${CX - t * 0.2},${38} ${CX + t * 0.5},${46}`, 'a', 2.4)],
      };
    }
    case 'flatTop':
      return {
        outer: `M${CX - t - 3},86 L${CX - t - 5},44 Q${CX - t - 5},22 ${CX - t + 7},20 L${CX + t - 7},20 Q${CX + t + 5},22 ${CX + t + 5},44 L${CX + t + 3},86`,
        hairline: `M${CX + t - 3},86 L${CX + t - 4},66 L${CX + t * 0.4},63 L${CX - t * 0.4},63 L${CX - t + 4},66 L${CX - t + 3},86`,
        strokeOuter: true,
        extras: [tex(`M${CX - t + 2},${26} L${CX + t - 6},${26}`, 'a', 2.2)],
      };
    case 'afro': {
      const r = t + 18;
      return {
        back: (
          <g>
            <circle cx={CX} cy={65} r={r} fill={hair.base} stroke={INK} strokeWidth={STROKE} />
            {!compact &&
              [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const ang = (i / 8) * Math.PI * 2 + 0.3;
                return <circle key={i} cx={CX + Math.cos(ang) * r * 0.72} cy={65 + Math.sin(ang) * r * 0.6} r={3.2} fill={hair.light} opacity={0.35} />;
              })}
          </g>
        ),
        outer: capOuter(t + 4, 40, 86),
        hairline: crewHairline(t, 86, 64),
        strokeOuter: false,
      };
    }
    case 'curlyTop':
      return {
        outer: bumpyArc(t + 3, 34, 84, 5, 5),
        hairline: crewHairline(t, 84, 62),
        strokeOuter: true,
        extras: compact
          ? null
          : [-0.5, -0.15, 0.2, 0.55].map((k, i) => (
              <path key={i} d={`M${CX + k * t - 4},${46 + (i % 2) * 4} q4,-5 8,0`} fill="none" stroke={hair.light} strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />
            )),
      };
    case 'twists':
      return {
        back: (
          <g>
            {[-1, 1].map((s) => (
              <path key={s} d={`M${CX + s * (t + 2)},70 q${s * 6},14 ${s * 3},30`} fill="none" stroke={hair.base} strokeWidth={7} strokeLinecap="round" />
            ))}
          </g>
        ),
        outer: bumpyArc(t + 6, 40, 88, 6, 4),
        hairline: crewHairline(t, 88, 62),
        strokeOuter: true,
        extras: compact
          ? null
          : [-0.7, -0.35, 0, 0.35, 0.7].map((k, i) => (
              <path key={i} d={`M${CX + k * t},${60} q${3},-8 ${-1},-16 q${-3},-6 ${1},-10`} fill="none" stroke={hair.light} strokeWidth={1.7} strokeLinecap="round" opacity={0.65} />
            )),
      };
    case 'cornrows':
      return {
        outer: capOuter(t + 2, 38.5, 86),
        hairline: crewHairline(t, 86, 60),
        strokeOuter: true,
        extras: [-3, -2, -1, 0, 1, 2, 3].map((k) => (
          <path
            key={k}
            d={`M${CX + k * t * 0.24},${60} Q${CX + k * t * 0.3},${48} ${CX + k * t * 0.2},${38}`}
            fill="none"
            stroke={k % 2 === 0 ? hair.light : INK}
            strokeWidth={1.4}
            strokeLinecap="round"
            opacity={0.55}
          />
        )),
      };
    case 'manBun':
      return {
        back: (
          <g>
            <circle cx={CX + 4} cy={30} r={12} fill={hair.base} stroke={INK} strokeWidth={STROKE} />
            <path d={`M${CX - 4},38 Q${CX + 4},34 ${CX + 12},38`} fill="none" stroke={x.kit.secondary} strokeWidth={3.2} strokeLinecap="round" />
          </g>
        ),
        outer: capOuter(t + 2.5, 39, 84),
        hairline: `M${CX + t - 4},84 L${CX + t - 6},67 Q${CX + t * 0.5},57 ${CX},59 Q${CX - t * 0.5},57 ${CX - t + 6},67 L${CX - t + 4},84`,
        strokeOuter: true,
        extras: [tex(`M${CX - t * 0.6},${56} Q${CX - t * 0.3},${40} ${CX + 2},${38}`, 'a', 1.6)],
      };
  }
}

function eyeOpenness(id: EyeId): number {
  return { round: 5.6, narrow: 3.6, sleepy: 4.6, wide: 6.6, bright: 5.0 }[id];
}

function Eye({ x, ex, side }: { x: Ctx; ex: number; side: 'l' | 'r' }) {
  const ry = eyeOpenness(x.a.eyeId);
  const clip = `${x.uid}-eye-${side}`;
  return (
    <g transform={`translate(${ex},${EYE_Y})`}>
      <clipPath id={clip}>
        <ellipse cx={0} cy={0} rx={6.6} ry={ry} />
      </clipPath>
      <ellipse cx={0} cy={0} rx={6.6} ry={ry} fill="#FFFDF8" />
      <g clipPath={`url(#${clip})`}>
        <circle cx={0.4} cy={0.3} r={3.8} fill={IRIS[x.a.eyeColour]} />
        <circle cx={0.4} cy={0.3} r={1.9} fill="#120D0C" />
        <circle cx={-0.9} cy={-1.2} r={1.15} fill="#FFFFFF" />
        {x.a.eyeId === 'sleepy' && <path d={`M-8,-7 L8,-7 L8,-0.6 Q0,-2.4 -8,-0.6 Z`} fill={x.skin.shade} />}
        {x.a.eyeId === 'bright' && <path d={`M-8,8 L8,8 L8,3.4 Q0,0.6 -8,3.4 Z`} fill={x.skin.base} />}
      </g>
      <path
        d={x.a.eyeId === 'sleepy' ? `M-7,-0.4 Q0,-2.6 7,-0.4` : `M-7,0.6 Q0,${-ry * 1.45} 7,0.6`}
        fill="none"
        stroke={INK}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </g>
  );
}

function browPath(id: BrowId, flip: boolean): { d: string; w: number } {
  // Defined for the viewer's right eye (inner corner is at -x).
  const base: Record<BrowId, { d: string; w: number }> = {
    flat: { d: 'M-8,-13 Q0,-14.5 8,-13', w: 3.4 },
    raised: { d: 'M-8,-14 Q0,-20 8,-15', w: 3.2 },
    fierce: { d: 'M-8,-10.5 Q0,-13 8,-16', w: 3.8 },
    worried: { d: 'M-8,-17 Q0,-15 8,-12', w: 3.2 },
    arched: { d: 'M-8,-12 Q-1,-20 8,-13', w: 3 },
    thick: { d: 'M-8,-13 Q0,-16 8,-14', w: 5.4 },
    thin: { d: 'M-7,-13 Q0,-16.5 7,-14', w: 2 },
    cheeky: { d: 'M-8,-13 Q0,-15 8,-13', w: 3.2 },
  };
  if (id === 'cheeky' && flip) return { d: 'M-8,-15 Q0,-21 8,-16', w: 3.2 };
  return base[id];
}

function Nose({ id, x }: { id: NoseId; x: Ctx }) {
  const stroke = { fill: 'none', stroke: x.skin.shade, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const ink = { ...stroke, stroke: INK, strokeWidth: 1.6, opacity: 0.55 };
  const nostrils = (spread: number, y: number) => (
    <g fill={INK} opacity={0.45}>
      <ellipse cx={-spread} cy={y} rx={1.5} ry={1.1} />
      <ellipse cx={spread} cy={y} rx={1.5} ry={1.1} />
    </g>
  );
  const y = 112;
  return (
    <g transform={`translate(${CX},${y})`}>
      <ellipse cx={3} cy={3} rx={6} ry={3} fill={x.skin.shade} opacity={0.55} />
      {id === 'button' && (
        <>
          <path d="M-5,2 Q0,7 5,2" {...ink} />
          {nostrils(3, 3)}
        </>
      )}
      {id === 'straight' && (
        <>
          <path d="M1,-11 L3,1" {...stroke} />
          <path d="M-5,2 Q0,6 5,2" {...ink} />
          {nostrils(3, 3)}
        </>
      )}
      {id === 'broad' && (
        <>
          <path d="M-8,1 Q-7,6 0,6 Q7,6 8,1" {...ink} />
          {nostrils(4.2, 3)}
        </>
      )}
      {id === 'hooked' && (
        <>
          <path d="M0,-11 Q6,-2 4,3 Q1,6 -3,4" {...stroke} />
          {nostrils(2.8, 3.4)}
        </>
      )}
      {id === 'long' && (
        <>
          <path d="M0,-13 L3,3" {...stroke} />
          <path d="M-5,4 Q0,8 5,4" {...ink} />
          {nostrils(3, 5)}
        </>
      )}
      {id === 'snub' && (
        <>
          <path d="M-4,1 Q0,4 4,1" {...ink} />
          {nostrils(2.6, 1.5)}
        </>
      )}
    </g>
  );
}

function Mouth({ id, x }: { id: MouthId; x: Ctx }) {
  const line = { fill: 'none', stroke: INK, strokeWidth: 2.3, strokeLinecap: 'round' as const };
  return (
    <g transform={`translate(${CX},${MOUTH_Y})`}>
      {id === 'smile' && (
        <>
          <path d="M-10,-1 Q0,8 10,-1" {...line} />
          <path d="M-5,6 Q0,7.6 5,6" fill="none" stroke={x.skin.lip} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
        </>
      )}
      {id === 'grin' && (
        <>
          <path d="M-11,-2 Q0,12 11,-2 Q0,1 -11,-2 Z" fill="#3A1414" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <path d="M-9,-1 Q0,1.6 9,-1 L8,2 Q0,4 -8,2 Z" fill="#FFFFFF" />
        </>
      )}
      {id === 'neutral' && <path d="M-8,1 Q0,2.4 8,1" {...line} />}
      {id === 'smirk' && <path d="M-8,2 Q2,4.5 10,-3" {...line} />}
      {id === 'determined' && (
        <>
          <path d="M-9,3 Q0,-1 9,3" {...line} />
          <path d="M-4,7 Q0,8.4 4,7" fill="none" stroke={x.skin.lip} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
        </>
      )}
      {id === 'shout' && (
        <>
          <ellipse cx={0} cy={3} rx={7.5} ry={7} fill="#3A1414" stroke={INK} strokeWidth={2} />
          <path d="M-6,1 Q0,-1.6 6,1 L5,-2 Q0,-3.6 -5,-2 Z" fill="#FFFFFF" />
          <ellipse cx={0} cy={7} rx={4} ry={2.2} fill="#C4565C" />
        </>
      )}
      {id === 'small' && <path d="M-4.5,1 Q0,3.6 4.5,1" {...line} />}
      {id === 'beam' && (
        <>
          <path d="M-12,-3 L12,-3 Q10,12 0,12 Q-10,12 -12,-3 Z" fill="#3A1414" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <path d="M-11,-2.4 L11,-2.4 L10.4,1.6 L-10.4,1.6 Z" fill="#FFFFFF" />
          <ellipse cx={0} cy={9} rx={5} ry={2.4} fill="#C4565C" />
        </>
      )}
    </g>
  );
}

function beardRegion(x: Ctx, drop: number): string {
  const { c, j, chinY, chinW } = x;
  const outer: Pt[] = [
    [CX - c + 2, 104],
    [CX - j - 0.5, 127],
    [CX - chinW - 1, chinY - 2 + drop * 0.6],
    [CX, chinY + drop],
    [CX + chinW + 1, chinY - 2 + drop * 0.6],
    [CX + j + 0.5, 127],
    [CX + c - 2, 104],
  ];
  const inner: Pt[] = [
    [CX + c - 9, 112],
    [CX + 13, 121],
    [CX, 119],
    [CX - 13, 121],
    [CX - c + 9, 112],
  ];
  return smoothClosed([...outer, ...inner], 0.85);
}

function FacialHair({ x, layer }: { x: Ctx; layer: 'chin' | 'lip' }) {
  const id = x.a.facialHairId;
  const fill = x.hair.base;
  const moustache = `M${CX - 13},${MOUTH_Y - 3} Q${CX - 7},${MOUTH_Y - 10} ${CX},${MOUTH_Y - 7} Q${CX + 7},${MOUTH_Y - 10} ${CX + 13},${MOUTH_Y - 3} Q${CX + 7},${MOUTH_Y - 5} ${CX},${MOUTH_Y - 4.5} Q${CX - 7},${MOUTH_Y - 5} ${CX - 13},${MOUTH_Y - 3} Z`;
  if (layer === 'lip') {
    if (id === 'moustache' || id === 'goatee' || id === 'beard') {
      return <path d={moustache} fill={fill} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />;
    }
    return null;
  }
  switch (id) {
    case 'stubble':
      return <path d={beardRegion(x, 0)} fill={fill} opacity={0.22} clipPath={`url(#${x.uid}-face)`} />;
    case 'beard':
      return <path d={beardRegion(x, 5)} fill={fill} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />;
    case 'chinstrap': {
      const { c, j, chinY, chinW } = x;
      const pts: Pt[] = [
        [CX - c + 1, 103],
        [CX - j + 1, 127],
        [CX - chinW, chinY - 3],
        [CX, chinY - 0.5],
        [CX + chinW, chinY - 3],
        [CX + j - 1, 127],
        [CX + c - 1, 103],
      ];
      return <path d={smoothOpen(pts)} fill="none" stroke={fill} strokeWidth={5} strokeLinecap="round" clipPath={`url(#${x.uid}-face)`} />;
    }
    case 'goatee':
      return (
        <path
          d={smoothClosed([
            [CX - 9, MOUTH_Y + 7],
            [CX - 10, MOUTH_Y + 14],
            [CX, x.chinY + 3],
            [CX + 10, MOUTH_Y + 14],
            [CX + 9, MOUTH_Y + 7],
            [CX, MOUTH_Y + 9],
          ])}
          fill={fill}
          stroke={INK}
          strokeWidth={1.8}
        />
      );
    default:
      return null;
  }
}

function Body({ x }: { x: Ctx }) {
  const { kit, a } = x;
  const sw = a.build === 'slim' ? 66 : a.build === 'stocky' ? 84 : 75;
  const nw = a.build === 'slim' ? 14.5 : a.build === 'stocky' ? 20 : 17;
  const body = `M${CX - sw},206 L${CX - sw},188 C${CX - sw},170 ${CX - sw + 14},161 ${CX - nw - 13},156 L${CX + nw + 13},156 C${CX + sw - 14},161 ${CX + sw},170 ${CX + sw},188 L${CX + sw},206 Z`;
  const clip = `${x.uid}-body`;
  const pattern = (() => {
    switch (kit.pattern) {
      case 'stripes':
        return [-60, -36, -12, 12, 36, 60].map((dx, i) =>
          i % 2 === 0 ? <rect key={dx} x={CX + dx - 6} y={150} width={12} height={60} fill={kit.secondary} /> : null,
        );
      case 'hoops':
        return [168, 190].map((y) => <rect key={y} x={0} y={y} width={200} height={10} fill={kit.secondary} />);
      case 'sash':
        return <path d={`M${CX - sw},160 L${CX - sw + 22},152 L${CX + sw},200 L${CX + sw - 22},210 Z`} fill={kit.secondary} />;
      case 'halves':
        return <rect x={CX} y={150} width={100} height={60} fill={kit.secondary} />;
      default:
        return null;
    }
  })();
  const neckline =
    kit.cut === 'vneck' ? (
      <>
        <path d={`M${CX - nw - 1},156 L${CX},176 L${CX + nw + 1},156 Z`} fill={x.skin.shade} />
        <path d={`M${CX - nw - 3},155 L${CX},178 L${CX + nw + 3},155`} fill="none" stroke={kit.secondary} strokeWidth={4.5} strokeLinejoin="round" />
        <path d={`M${CX - nw - 5.5},155 L${CX},181 L${CX + nw + 5.5},155`} fill="none" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" opacity={0.6} />
      </>
    ) : kit.cut === 'collar' ? (
      <>
        <path d={`M${CX},158 L${CX},178`} stroke={INK} strokeWidth={1.4} opacity={0.5} />
        <path d={`M${CX - nw - 6},153 L${CX - 1},166 L${CX - nw - 14},167 Z`} fill={kit.secondary} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        <path d={`M${CX + nw + 6},153 L${CX + 1},166 L${CX + nw + 14},167 Z`} fill={kit.secondary} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      </>
    ) : (
      <path d={`M${CX - nw - 4},155.5 Q${CX},171 ${CX + nw + 4},155.5`} fill="none" stroke={kit.secondary} strokeWidth={5} strokeLinecap="round" />
    );
  return (
    <g>
      <clipPath id={clip}>
        <path d={body} />
      </clipPath>
      <path d={body} fill={kit.primary} />
      <g clipPath={`url(#${clip})`}>
        {pattern}
        <ellipse cx={CX + sw + 6} cy={196} rx={sw * 0.7} ry={48} fill="#000" opacity={0.16} />
        <ellipse cx={CX - sw * 0.55} cy={170} rx={18} ry={10} fill="#FFF" opacity={0.14} />
        <path d={`M${CX - sw + 9},206 Q${CX - sw + 15},178 ${CX - sw + 28},163`} fill="none" stroke={INK} strokeWidth={1.4} opacity={0.35} />
        <path d={`M${CX + sw - 9},206 Q${CX + sw - 15},178 ${CX + sw - 28},163`} fill="none" stroke={INK} strokeWidth={1.4} opacity={0.35} />
      </g>
      <path d={body} fill="none" stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
      {/* Neck sits over the shirt so the neckline reads clearly */}
      <path d={`M${CX - nw},116 L${CX - nw},160 Q${CX},166 ${CX + nw},160 L${CX + nw},116 Z`} fill={x.skin.base} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
      <path d={`M${CX - nw},128 Q${CX},150 ${CX + nw},128 L${CX + nw},116 L${CX - nw},116 Z`} fill={x.skin.shade} />
      {neckline}
      {/* Tiny club crest on the chest */}
      <path
        d={`M${CX + sw * 0.42 - 6},176 h12 v6 q0,7 -6,9 q-6,-2 -6,-9 Z`}
        fill={kit.secondary}
        stroke={INK}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </g>
  );
}

function Accessories({ x, layer }: { x: Ctx; layer: 'face' | 'top' }) {
  const out: ReactNode[] = [];
  const has = (id: string) => x.a.accessoryIds.includes(id as never);
  if (layer === 'face') {
    if (has('freckles')) {
      for (const s of [-1, 1]) {
        for (const [dx, dy] of [[0, 0], [4, 2.5], [-3.5, 3], [1.5, 5.5]] as const) {
          out.push(<circle key={`f${s}${dx}${dy}`} cx={CX + s * (x.ew + 1) + dx} cy={110 + dy} r={1} fill={x.skin.lip} opacity={0.7} />);
        }
      }
    }
    if (has('eyeBlack')) {
      for (const s of [-1, 1]) {
        out.push(<rect key={`eb${s}`} x={CX + s * x.ew - 6} y={EYE_Y + 7.5} width={12} height={4} rx={1.6} fill={INK} opacity={0.88} />);
      }
    }
    if (has('scar')) {
      const sx = CX + x.ew + 5;
      out.push(
        <g key="scar" stroke={x.skin.lip} strokeWidth={1.5} strokeLinecap="round" opacity={0.9}>
          <path d={`M${sx - 1},${EYE_Y - 21} L${sx + 3},${EYE_Y - 9}`} />
          <path d={`M${sx - 2},${EYE_Y - 17} L${sx + 3},${EYE_Y - 18}`} />
          <path d={`M${sx - 1},${EYE_Y - 13} L${sx + 4},${EYE_Y - 14}`} />
        </g>,
      );
    }
    if (has('noseStrip')) {
      out.push(<rect key="ns" x={CX - 8.5} y={104} width={17} height={5.2} rx={2.4} fill="#F4F1EA" stroke={INK} strokeWidth={1.2} />);
    }
    if (has('studEarring')) {
      out.push(<circle key="ear" cx={CX - x.c - 1.5} cy={110} r={2.3} fill="#F4C653" stroke={INK} strokeWidth={1} />);
    }
  } else if (has('headband')) {
    const { t } = x;
    out.push(
      <path
        key="hb"
        d={`M${CX - t - 2},74 Q${CX},56 ${CX + t + 2},74 L${CX + t + 2},81 Q${CX},63 ${CX - t - 2},81 Z`}
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />,
      <path key="hb2" d={`M${CX - t - 1},77.5 Q${CX},59.5 ${CX + t + 1},77.5`} fill="none" stroke={x.kit.primary} strokeWidth={2} />,
    );
  }
  return <>{out}</>;
}

function PortraitImpl({ appearance: a, kit, title, className, compact = false }: PortraitProps) {
  // useId alone collides across separate React roots (e.g. static exports), so salt it with the look.
  const uid = `p${useId().replace(/[^a-zA-Z0-9]/g, '')}${hashString(JSON.stringify([a, kit]))[0].toString(36)}`;
  const shape = FACE_SHAPES[a.faceId];
  const x: Ctx = {
    a,
    kit,
    t: shape.temple,
    c: shape.cheek,
    j: shape.jaw,
    chinY: shape.chinY,
    chinW: shape.chinW,
    ew: Math.round(shape.cheek * 0.39 * 10) / 10,
    skin: SKIN[a.skinId],
    hair: HAIR[a.hairColour],
    uid,
    compact,
  };
  const face = smoothClosed(facePoints(x.t, x.c, x.j, x.chinY, x.chinW));
  const hs = a.hairId === 'bald' ? null : hairStyle(a.hairId, x);
  const hairFill = hs ? `${hs.outer} ${hs.hairline.replace(/^M/, 'L')} Z` : '';
  const browColour = x.hair.brow;

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      data-portrait={`${a.faceId}.${a.skinId}.${a.hairId}.${a.hairColour}.${a.eyeId}.${a.browId}.${a.noseId}.${a.mouthId}.${a.facialHairId}.${a.accessoryIds.join('+')}.${a.build}`}
    >
      <defs>
        <clipPath id={`${uid}-face`}>
          <path d={face} />
        </clipPath>
      </defs>

      {hs?.back}
      <Body x={x} />

      {/* Ears */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <ellipse cx={CX + s * (x.c + 0.5)} cy={102} rx={7.5} ry={11.5} fill={s > 0 ? x.skin.shade : x.skin.base} stroke={INK} strokeWidth={STROKE} />
          <path d={`M${CX + s * (x.c + 2)},96 q${s * 3},6 0,12`} fill="none" stroke={x.skin.lip} strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
        </g>
      ))}

      {/* Head */}
      <path d={face} fill={x.skin.base} />
      <g clipPath={`url(#${uid}-face)`}>
        <ellipse cx={CX + x.c + 12} cy={106} rx={x.c * 0.92} ry={70} fill={x.skin.shade} opacity={0.75} />
        <ellipse cx={CX} cy={x.chinY + 8} rx={34} ry={13} fill={x.skin.shade} opacity={0.55} />
        <ellipse cx={CX - x.ew - 3} cy={113} rx={7} ry={4.5} fill="#FFFFFF" opacity={0.14} />
        <ellipse cx={CX - x.t * 0.4} cy={66} rx={12} ry={7} fill="#FFFFFF" opacity={0.16} />
        {hs && <path d={hairFill} fill={x.skin.shade} transform="translate(1.5,4)" opacity={0.9} />}
        {a.hairId === 'bald' && <ellipse cx={CX - 10} cy={50} rx={11} ry={6} fill="#FFFFFF" opacity={0.28} />}
      </g>
      <path d={face} fill="none" stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />

      <FacialHair x={x} layer="chin" />
      <Accessories x={x} layer="face" />

      {/* Eyes + brows */}
      <Eye x={x} ex={CX - x.ew} side="l" />
      <Eye x={x} ex={CX + x.ew} side="r" />
      {(['l', 'r'] as const).map((side) => {
        const isLeft = side === 'l';
        const { d, w } = browPath(a.browId, isLeft);
        const ex = isLeft ? CX - x.ew : CX + x.ew;
        return (
          <path
            key={side}
            d={d}
            transform={`translate(${ex},${EYE_Y}) scale(${isLeft ? -1 : 1},1)`}
            fill="none"
            stroke={browColour}
            strokeWidth={w}
            strokeLinecap="round"
          />
        );
      })}

      <Nose id={a.noseId} x={x} />
      <Mouth id={a.mouthId} x={x} />
      <FacialHair x={x} layer="lip" />

      {hs && (
        <g>
          <path d={hairFill} fill={x.hair.base} />
          {hs.extras}
          {hs.strokeOuter && <path d={hs.outer} fill="none" stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" strokeLinecap="round" />}
          <path d={hs.hairline} fill="none" stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" strokeLinecap="round" />
        </g>
      )}
      <Accessories x={x} layer="top" />
    </svg>
  );
}

function sameProps(prev: PortraitProps, next: PortraitProps): boolean {
  return (
    prev.title === next.title &&
    prev.className === next.className &&
    prev.compact === next.compact &&
    JSON.stringify(prev.appearance) === JSON.stringify(next.appearance) &&
    JSON.stringify(prev.kit) === JSON.stringify(next.kit)
  );
}

export const Portrait = memo(PortraitImpl, sameProps);
