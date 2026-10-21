import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "../../accessibility/motion";
import { playSfx } from "../../audio/sfx";
import { useGame, useSave } from "../../app/GameContext";
import { navigate } from "../../app/router";
import { Crest } from "../../components/club/Crest";
import { StadiumScene } from "../../components/club/StadiumScene";
import { Portrait } from "../../components/portrait/Portrait";
import { Button } from "../../components/ui/Button";
import type { ClubIdentity } from "../../domain/club/types";
import type { HomeTown } from "../../domain/world/world";
import type { Appearance } from "../../domain/players/types";
import "./intro.css";

/** The lifelong supporter who hands over the keys (a fixed character, not a squad player). */
const SUPPORTER: Appearance = {
  faceId: "long",
  skinId: "s3",
  hairId: "sidePart",
  hairColour: "grey",
  eyeId: "sleepy",
  eyeColour: "blue",
  browId: "thick",
  noseId: "hooked",
  mouthId: "smile",
  facialHairId: "moustache",
  accessoryIds: [],
  build: "average",
};

const PANEL_MS = 3600;

interface Panel {
  id: string;
  caption: (home: HomeTown) => string;
  art: (club: ClubIdentity) => ReactNode;
}

const PANELS: readonly Panel[] = [
  {
    id: "ground",
    caption: (h) => `${h.town}. ${h.line} Once, thousands sang here every Saturday.`,
    art: (club) => (
      <div className="intro__art intro__art--ground">
        <StadiumScene club={club} variant="title" />
        <span className="intro__sfx intro__sfx--a" aria-hidden="true">
          creak…
        </span>
      </div>
    ),
  },
  {
    id: "ball",
    caption: () => "Now? Peeling paint, empty stands and one battered ball.",
    art: (club) => <TerraceArt club={club} />,
  },
  {
    id: "keys",
    caption: (h) =>
      `“Forty years on that terrace. Somebody has to save ${h.nickname.replace(/^The /, 'the ')}. Here — the keys are yours.”`,
    art: (club) => <KeysArt club={club} />,
  },
  {
    id: "title",
    caption: (h) => `Founded ${h.founded}. Going nowhere. Unless you change that.`,
    art: (club) => (
      <div className="intro__art intro__art--title">
        <div className="intro__crest">
          <Crest club={club} size={128} />
        </div>
        <p className="intro__club">{club.name}</p>
      </div>
    ),
  },
];

/**
 * The 12–18 second opening: four comic panels that advance on their own or on a tap, with a
 * Skip that is always visible. Replay mode (from More) returns to the club afterwards.
 */
export function IntroScreen({ replay }: { replay: boolean }) {
  const save = useSave();
  const { onboarding } = useGame();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const leaving = useRef(false);
  const last = index === PANELS.length - 1;

  const finish = useCallback(async () => {
    if (leaving.current) return;
    leaving.current = true;
    if (replay || save.onboarding !== "intro") {
      navigate({ name: "club" });
      return;
    }
    await onboarding("introDone");
    const pack = save.packs.find(
      (p) => p.kind === "first-signing" && p.playerId === null,
    );
    navigate(pack ? { name: "pack", id: pack.id } : { name: "club" });
  }, [onboarding, replay, save.onboarding, save.packs]);

  const next = useCallback(() => {
    if (last) return;
    playSfx("flip");
    setIndex((i) => Math.min(PANELS.length - 1, i + 1));
  }, [last]);

  useEffect(() => {
    if (last || paused) return;
    const t = window.setTimeout(next, PANEL_MS);
    return () => window.clearTimeout(t);
  }, [index, last, next, paused]);

  const panel = PANELS[index] as Panel;
  const caption = panel.caption(save.world.home);

  return (
    <main
      className={`intro intro--${panel.id}`}
      aria-roledescription="opening story"
    >
      <header className="intro__top">
        <ol
          className="intro__dots"
          aria-label={`Panel ${index + 1} of ${PANELS.length}`}
        >
          {PANELS.map((p, i) => (
            <li key={p.id} className={i <= index ? "is-on" : ""} />
          ))}
        </ol>
        {!last && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIndex(PANELS.length - 1)}
            sfx="thud"
          >
            Skip
          </Button>
        )}
      </header>

      <button
        type="button"
        className="intro__stage"
        onClick={next}
        aria-label={
          last ? caption : `${caption} Tap for the next panel.`
        }
        disabled={last}
      >
        <div
          key={panel.id}
          className={`intro__panel ${reduced ? "is-still" : ""}`}
        >
          {panel.art(save.club)}
          <p className="intro__caption" aria-live="polite">
            {caption}
          </p>
        </div>
      </button>

      <footer className="intro__actions">
        {last ? (
          <Button
            variant="primary"
            size="lg"
            block
            onClick={() => void finish()}
            sfx="chime"
          >
            {replay || save.onboarding !== "intro"
              ? "Back to the club"
              : "Meet your first signing"}
          </Button>
        ) : (
          <p className="intro__hint">
            Tap to continue
            <button
              type="button"
              className="intro__pause"
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
            >
              {paused ? "Play" : "Pause"}
            </button>
          </p>
        )}
      </footer>
    </main>
  );
}

function TerraceArt({ club }: { club: ClubIdentity }) {
  const ink = "#1B2235";
  return (
    <div className="intro__art intro__art--terrace">
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <rect width="400" height="300" fill="#2A3550" />
        {/* Terrace steps, top to bottom, catching light from the top left */}
        {Array.from({ length: 7 }, (_, i) => (
          <g key={i}>
            <rect
              x="0"
              y={30 + i * 40}
              width="400"
              height="40"
              fill={i % 2 ? "#56607A" : "#4B5570"}
            />
            <rect x="0" y={30 + i * 40} width="400" height="6" fill="#6C7792" />
          </g>
        ))}
        {/* Faded painted club stripe, peeling */}
        <path
          d="M0 112 L400 112 L400 128 L0 128 Z"
          fill={club.kit.primary}
          opacity={0.5}
        />
        <path d="M150 112 l16 0 l-4 10 l10 6 l-26 0 Z" fill="#4B5570" />
        <path d="M262 112 l30 0 l-8 16 l-30 0 l6 -8 Z" fill="#56607A" />
        <path
          d="M60 116 q8 -8 18 0 q-6 10 -18 0Z"
          fill="#C9C1AE"
          opacity={0.6}
        />
        {/* Cracks */}
        <path
          d="M40 190 l18 8 l-6 10 l20 6 M300 70 l10 14 l-8 6 l14 12 M340 230 l-12 10 l8 8"
          stroke={ink}
          strokeWidth={2}
          fill="none"
          opacity={0.6}
        />
        {/* Puddle */}
        <ellipse
          cx="270"
          cy="252"
          rx="70"
          ry="12"
          fill="#7C8FB8"
          opacity={0.35}
        />
        {/* Battered ball with tape patch */}
        <g className="intro__ball" transform="translate(200 214)">
          <ellipse cx="4" cy="34" rx="34" ry="7" fill="#000" opacity={0.3} />
          <circle r="34" fill="#E9E1CF" stroke={ink} strokeWidth={4} />
          <path
            d="M-8 -12 l14 -6 l12 8 l-4 14 l-16 2 Z"
            fill={ink}
            opacity={0.85}
          />
          <path
            d="M-30 6 l10 -2 l6 12 l-8 10 M22 18 l10 -10 M-6 22 l4 12"
            stroke={ink}
            strokeWidth={3}
            fill="none"
          />
          <rect
            x="-26"
            y="-26"
            width="22"
            height="9"
            rx="2"
            fill="#C9B98F"
            stroke={ink}
            strokeWidth={2}
            transform="rotate(-24)"
          />
          <path
            d="M-20 -24 a30 30 0 0 1 26 -8"
            stroke="#fff"
            strokeWidth={4}
            fill="none"
            opacity={0.6}
            strokeLinecap="round"
          />
        </g>
        {/* Rain */}
        <g
          className="intro__rain"
          stroke="#C7D3F0"
          strokeWidth={2}
          opacity={0.5}
        >
          {Array.from({ length: 18 }, (_, i) => (
            <line
              key={i}
              x1={(i * 53) % 400}
              y1={(i * 37) % 220}
              x2={((i * 53) % 400) - 6}
              y2={((i * 37) % 220) + 16}
            />
          ))}
        </g>
      </svg>
      <span className="intro__sfx intro__sfx--b" aria-hidden="true">
        plip… plip…
      </span>
    </div>
  );
}

function KeysArt({ club }: { club: ClubIdentity }) {
  const coat = {
    ...club.kit,
    primary: "#3B4E7A",
    secondary: club.kit.primary,
    pattern: "plain" as const,
  };
  const ink = "#1B2235";
  return (
    <div className="intro__art intro__art--keys">
      <div className="intro__supporter">
        <Portrait appearance={SUPPORTER} kit={coat} />
        {/* Club scarf, knotted, in the club colours */}
        <svg className="intro__scarf" viewBox="0 0 200 80" aria-hidden="true">
          <path
            d="M30 18 q70 26 140 0 l6 22 q-76 30 -152 0 Z"
            fill={club.kit.primary}
            stroke={ink}
            strokeWidth={4}
          />
          {[52, 84, 116, 148].map((x) => (
            <path
              key={x}
              d={`M${x} ${22 + Math.abs(100 - x) * 0.08} l10 3 l-2 20 l-10 -3 Z`}
              fill={club.kit.secondary}
            />
          ))}
          <path
            d="M120 34 l22 6 l-6 40 l-20 -4 Z"
            fill={club.kit.primary}
            stroke={ink}
            strokeWidth={4}
          />
          <path
            d="M122 60 l18 4 M120 70 l18 4"
            stroke={club.kit.secondary}
            strokeWidth={5}
          />
        </svg>
      </div>
      <svg className="intro__keys" viewBox="0 0 120 150" aria-hidden="true">
        {/* Outstretched hand holding the ring */}
        <path
          d="M-10 4 L30 0 L36 22 L-10 30 Z"
          fill="#3B4E7A"
          stroke={ink}
          strokeWidth={3}
        />
        <ellipse
          cx="44"
          cy="14"
          rx="14"
          ry="11"
          fill="#D9A273"
          stroke={ink}
          strokeWidth={3}
        />
        <path d="M38 22 q4 6 10 4" stroke={ink} strokeWidth={2.5} fill="none" />
        <g transform="translate(0 18)">
          <circle
            cx="40"
            cy="36"
            r="22"
            fill="none"
            stroke="#F4C653"
            strokeWidth={7}
          />
          <g transform="rotate(28 60 60)">
            <rect
              x="52"
              y="40"
              width="12"
              height="62"
              rx="4"
              fill="#F4C653"
              stroke={ink}
              strokeWidth={3}
            />
            <path
              d="M64 82 h12 v8 h-12 M64 94 h8 v6 h-8"
              fill="#F4C653"
              stroke={ink}
              strokeWidth={3}
            />
          </g>
          <g transform="rotate(-12 40 60)">
            <rect
              x="20"
              y="52"
              width="10"
              height="50"
              rx="4"
              fill="#D9D3C4"
              stroke={ink}
              strokeWidth={3}
            />
            <path
              d="M30 84 h9 v7 h-9"
              fill="#D9D3C4"
              stroke={ink}
              strokeWidth={3}
            />
          </g>
          <rect
            x="70"
            y="58"
            width="40"
            height="24"
            rx="4"
            fill="#FFF7E9"
            stroke={ink}
            strokeWidth={3}
            transform="rotate(14 90 70)"
          />
          <text
            x="90"
            y="75"
            textAnchor="middle"
            fontSize="11"
            fontWeight="800"
            fill={ink}
            transform="rotate(14 90 70)"
          >
            {club.shortName}
          </text>
        </g>
      </svg>
      <span className="intro__sfx intro__sfx--c" aria-hidden="true">
        jingle!
      </span>
    </div>
  );
}
