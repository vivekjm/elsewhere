import React, { useId } from "react";
import { TRIP_MOODS } from "@/lib/model";
const MOOD_LABELS: Record<(typeof TRIP_MOODS)[number], string> = {
  mountains: "Quiet mountains",
  coast: "By the coast",
  city: "City wandering",
  forest: "Deep forest",
  lake: "Still lake",
  desert: "Desert road",
  island: "Island time",
  aurora: "Northern lights",
};
export const MOODS = TRIP_MOODS.map((id) => ({ id, label: MOOD_LABELS[id] }));
export type Mood = (typeof TRIP_MOODS)[number];
export const MOOD_IDS = MOODS.map((m) => m.id);
/** Unknown or legacy values fall back to mountains so covers never break. */
export const isMood = (value: unknown): value is Mood =>
  typeof value === "string" && (MOOD_IDS as string[]).includes(value);
export const moodOf = (value: unknown): Mood =>
  isMood(value) ? value : "mountains";
type SceneProps = { id: string; motion: boolean; className?: string; mood: Mood };
/** Shared SVG shell so every mood keeps the same responsive behaviour. */
function Frame({
  motion,
  className,
  mood,
  viewBox,
  focusY,
  children,
}: {
  motion: boolean;
  className?: string;
  mood: Mood;
  viewBox: string;
  /** Where the cover crop should look: sky, horizon or foreground. */
  focusY?: number;
  children: React.ReactNode;
}) {
  const [vx, vy, vw, vh] = viewBox.split(" ").map(Number);
  // `xMidY150 slice` is not a valid value, so browsers fell back to `meet`
  // and letterboxed the scene. Keep the attribute valid and move the crop
  // window instead, damped so no scene loses its horizon.
  const shift =
    focusY === undefined
      ? 0
      : Math.max(-vh * 0.14, Math.min(vh * 0.14, (focusY - vh / 2) * 0.5));
  return (
    <svg
      className={`landscape ${className || ""}`}
      viewBox={`${vx} ${(vy + shift).toFixed(1)} ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      data-mood={mood}
      data-motion={motion ? "on" : "off"}
    >
      {children}
    </svg>
  );
}

const Sky = ({ id, from, to }: { id: string; from: string; to: string }) => (
  <>
    <defs>
      <linearGradient id={`${id}-sky`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="360">
        <stop stopColor={from} />
        <stop offset="1" stopColor={to} />
      </linearGradient>
    </defs>
    <path fill={`url(#${id}-sky)`} d="M-100-100h1400v560H-100Z" />
  </>
);
const Clouds = ({
  fill = "#fbfaf3",
  opacity = 0.75,
}: {
  fill?: string;
  opacity?: number;
}) => (
  <g className="ew-sky-drift" fill={fill} opacity={opacity}>
    <g className="ew-drift-a">
      <path d="M120 96c14-22 52-24 66-4 22-12 52 2 50 24H96c-4-12 6-20 24-20Z" />
      <path d="M760 62c12-18 44-20 56-3 19-10 44 2 42 20H742c-3-10 5-17 18-17Z" />
    </g>
    <g className="ew-drift-b" opacity=".7">
      <path d="M420 132c10-15 36-16 46-3 15-8 36 2 34 16H404c-3-8 4-13 16-13Z" />
      <path d="M960 118c11-16 39-17 49-3 16-9 39 2 37 17H944c-3-9 5-14 16-14Z" />
    </g>
    {/* One bank crosses the whole cover so the scene never looks frozen. */}
    <g className="ew-cloud-cross" opacity=".8">
      <path d="M-40 84c22-34 82-38 104-7 34-19 82 3 78 37H-96c-7-19 9-31 56-30Z" />
      <path d="M150 104c15-23 56-26 71-5 23-13 56 2 53 25H112c-5-13 6-21 38-20Z" />
    </g>
  </g>
);
const Sun = ({
  cx,
  cy,
  r,
  fill,
  glow,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  glow?: string;
}) => (
  <g className="ew-sun">
    <circle cx={cx} cy={cy} r={r} fill={fill} opacity=".95" />
    {glow && <circle cx={cx} cy={cy} r={r * 1.9} fill={glow} opacity=".22" />}
  </g>
);
const Stars = ({ id }: { id: string }) => (
  <g className="ew-stars" fill="#ffffff">
    {[
      [80, 44, 1.6],
      [180, 88, 1.1],
      [268, 36, 1.4],
      [360, 104, 1],
      [452, 52, 1.5],
      [560, 92, 1.1],
      [660, 34, 1.3],
      [748, 108, 1],
      [838, 58, 1.6],
      [930, 96, 1.2],
      [1024, 40, 1.4],
      [1120, 84, 1],
      [1160, 140, 1.2],
      [300, 148, 0.9],
      [880, 150, 0.9],
    ].map(([x, y, r], i) => (
      <circle
        key={`${id}-${i}`}
        cx={x}
        cy={y}
        r={r}
        className="ew-twinkle"
        style={{ animationDelay: `${(i % 7) * 0.6}s` }}
      />
    ))}
  </g>
);
const Mist = ({ id, y, height, opacity = 0.9 }: { id: string; y: number; height: number; opacity?: number }) => (
  <>
    <defs>
      <linearGradient id={`${id}-mist${y}`} x1="0" y1="1" x2="0" y2="0">
        <stop stopColor="#f6f3e8" />
        <stop offset="1" stopColor="#f6f3e8" stopOpacity="0" />
      </linearGradient>
    </defs>
    <g className="ew-mist">
      <path
        fill={`url(#${id}-mist${y})`}
        opacity={opacity}
        d={`M0 ${y}h1200v${height}H0Z`}
      />
    </g>
  </>
);
const Birds = ({ delay = 0, x = 300, y = 70 }: { delay?: number; x?: number; y?: number }) => (
  <g
    className="ew-birds"
    stroke="#5c6a55"
    strokeWidth="2.4"
    fill="none"
    strokeLinecap="round"
    style={{ animationDelay: `${delay}s` }}
  >
    <path d={`M${x} ${y}q10-8 20 0`} />
    <path d={`M${x + 26} ${y + 12}q8-6 16 0`} />
  </g>
);
/** Deterministic scatter so weather is varied but never re-randomised per render. */
const scatter = (count: number, seed: number, spanX: number, spanY: number) =>
  Array.from({ length: count }, (_, i) => {
    const a = Math.sin((i + 1) * seed) * 10000,
      b = Math.sin((i + 1) * seed * 1.77) * 10000;
    return {
      x: (a - Math.floor(a)) * spanX,
      y: (b - Math.floor(b)) * spanY,
    };
  });
/** Sunlight: rays that breathe and rotate around the sun. */
const SunRays = ({
  cx,
  cy,
  r,
  rays = 12,
  opacity = 0.34,
  length = 58,
}: {
  cx: number;
  cy: number;
  r: number;
  rays?: number;
  opacity?: number;
  length?: number;
}) => (
  <g
    className="ew-rays"
    opacity={opacity}
    style={{ transformBox: "view-box", transformOrigin: `${cx}px ${cy}px` }}
  >
    {Array.from({ length: rays }, (_, i) => {
      const a = (i * Math.PI * 2) / rays,
        x1 = cx + Math.cos(a) * (r + 9),
        y1 = cy + Math.sin(a) * (r + 9),
        x2 = cx + Math.cos(a) * (r + 9 + length),
        y2 = cy + Math.sin(a) * (r + 9 + length);
      return (
        <path
          key={i}
          stroke="#fdf5e0"
          strokeWidth="4"
          strokeLinecap="round"
          d={`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`}
        />
      );
    })}
  </g>
);
/** Rain: short diagonal streaks falling through the whole scene. */
const Rain = ({
  id,
  count = 26,
  opacity = 0.42,
  slant = 13,
}: {
  id: string;
  count?: number;
  opacity?: number;
  slant?: number;
}) => (
  <g
    className="ew-rain"
    stroke="#e2eef3"
    strokeWidth="2"
    strokeLinecap="round"
    opacity={opacity}
  >
    {scatter(count, 2.399, 1160, 320).map(({ x, y }, i) => (
      <path
        key={`${id}-rain-${i}`}
        className="ew-rain-drop"
        style={{ animationDelay: `${((i % 10) * 0.2).toFixed(2)}s` }}
        d={`M${(x + 20).toFixed(0)} ${y.toFixed(0)}l-${slant} 30`}
      />
    ))}
  </g>
);
/** Snow: flakes that drift down and sideways. */
const Snowfall = ({
  id,
  count = 18,
  opacity = 0.9,
}: {
  id: string;
  count?: number;
  opacity?: number;
}) => (
  <g className="ew-snowfall" fill="#ffffff" opacity={opacity}>
    {scatter(count, 1.618, 1160, 300).map(({ x, y }, i) => (
      <circle
        key={`${id}-snow-${i}`}
        cx={x.toFixed(0)}
        cy={y.toFixed(0)}
        r={i % 3 === 0 ? 2.4 : 1.6}
        className="ew-flake"
        style={{ animationDelay: `${(i % 8) * 0.9}s` }}
      />
    ))}
  </g>
);
/** Wind: long streaks that sweep across the horizon. */
const Wind = ({
  id,
  count = 4,
  opacity = 0.5,
}: {
  id: string;
  count?: number;
  opacity?: number;
}) => (
  <g
    className="ew-wind"
    stroke="#ffffff"
    strokeWidth="2.6"
    strokeLinecap="round"
    fill="none"
    opacity={opacity}
  >
    {scatter(count, 3.137, 760, 150).map(({ x, y }, i) => (
      <path
        key={`${id}-wind-${i}`}
        className="ew-wind-streak"
        style={{ animationDelay: `${(i * 2.1).toFixed(1)}s` }}
        d={`M${(x + 60).toFixed(0)} ${(y + 120).toFixed(0)}q80-18 170 2`}
      />
    ))}
  </g>
);
function MountainScene({ id, motion, className, mood }: SceneProps) {
  return (
    <Frame
      motion={motion}
      className={className}
      mood={mood}
      focusY={160}
      viewBox="0 0 1200 360"
    >
      <Sky id={id} from="#dfe5df" to="#f3eee1" />
      <Sun cx={914} cy={78} r={34} fill="#f8f3e2" glow="#f6e7c4" />
      <SunRays cx={914} cy={78} r={34} />
      <Clouds opacity={0.68} />
      <Birds x={340} y={78} />
      <g className="ew-range ew-range-far">
        <path
          fill="#c3cfc7"
          d="m120 300 144-112 75 57 82-100 82 64L625 47l117 133 60-63 134 84 90-96 127 123v132H120Z"
        />
        <path
          fill="#f1f0e6"
          d="m502 152 122-105 117 133-83-57-30 12-24-46-41 62-15-8-18 20-29-11Zm-110-30 29-34 57 45-28-8-20-24-17 26Z"
        />
      </g>
      <g className="ew-range ew-range-mid">
        <path
          fill="#93a79b"
          d="m216 356 181-114 81 28 131-109 107 118 81-52 113 65 114-86 123 68v82H216Z"
        />
      </g>
      <g className="ew-range ew-range-near">
        <path
          fill="#647e6c"
          d="m330 380 139-89 134 49 131-81 113 73 131-76 160 54v70H330Z"
        />
        <path fill="#435e4d" d="m629 380 144-48 110 27 116-56 139 46v31H629Z" />
        <g fill="#364e3e" opacity=".82">
          <path d="m897 347 10-36 10 36h-6v13h-9v-13Zm31-8 13-45 13 45h-8v21h-10v-21Zm99-20 11-42 13 42h-8v22h-9v-22Zm-42 25 13-42 13 42h-8v16h-10v-16Z" />
        </g>
      </g>
      <Mist id={id} y={220} height={140} opacity={0.65} />
      <Snowfall id={id} count={20} opacity={0.85} />
      <g className="ew-lake">
        <path fill="#b9cdc6" d="M0 300h1200v60H0Z" opacity=".55" />
        <g stroke="#eef3ec" strokeWidth="3" strokeLinecap="round" opacity=".65">
          <path className="ew-ripple" d="M180 318h120" />
          <path className="ew-ripple" d="M520 332h150" style={{ animationDelay: "1.1s" }} />
          <path className="ew-ripple" d="M880 312h130" style={{ animationDelay: "2.2s" }} />
        </g>
      </g>
    </Frame>
  );
}
function CoastScene({ id, motion, className, mood }: SceneProps) {
  return (
    <Frame
      motion={motion}
      className={className}
      mood={mood}
      focusY={150}
      viewBox="0 0 1000 300"
    >
      <Sky id={id} from="#d6e2dc" to="#f2f1e3" />
      <Sun cx={773} cy={70} r={32} fill="#f6edcf" glow="#f4dfae" />
      <SunRays cx={773} cy={70} r={32} opacity={0.3} />
      <Clouds opacity={0.6} />
      <Birds x={250} y={62} delay={1.4} />
      <Wind id={id} count={4} opacity={0.42} />
      <g className="ew-sea">
        <path fill="#8fb0a4" d="M0 150Q300 134 600 152t400-2v150H0Z" />
        <path
          fill="#789b90"
          d="M0 168Q300 151 600 170t400-2v132H0Z"
        />
        <g stroke="#e9f1ea" strokeWidth="2.4" strokeLinecap="round" opacity=".6">
          <path className="ew-ripple" d="M90 196h150" />
          <path className="ew-ripple" d="M420 210h190" style={{ animationDelay: "0.8s" }} />
          <path className="ew-ripple" d="M700 190h180" style={{ animationDelay: "1.6s" }} />
        </g>
      </g>
      <g className="ew-boat">
        <path fill="#f4efe1" d="M642 196h64l-10 14h-44Z" />
        <path fill="#435e4d" d="M676 158v38" stroke="#435e4d" strokeWidth="2" />
        <path fill="#f7f3e6" d="M678 162l30 30h-30Z" />
      </g>
      <path fill="#afc4b2" d="M0 209q230-39 469-4t531-6v101H0Z" />
      <path fill="#e2d6b9" d="M0 240q238-86 463-11t537 22v49H0Z" />
      <path
        fill="none"
        stroke="#f7f6e8"
        strokeWidth="3"
        opacity=".7"
        d="M463 220q258 69 537 19"
      />
      <g className="ew-foam">
        <path
          fill="none"
          stroke="#fbfaef"
          strokeWidth="4"
          strokeLinecap="round"
          opacity=".8"
          d="M120 252q60 16 120 0t120 0"
        />
        <path
          fill="none"
          stroke="#fbfaef"
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".6"
          d="M640 262q60 16 120 0t120 0"
          className="ew-foam-b"
        />
      </g>
    </Frame>
  );
}
function CityScene({ id, motion, className, mood }: SceneProps) {
  return (
    <Frame
      motion={motion}
      className={className}
      mood={mood}
      focusY={70}
      viewBox="0 0 1000 300"
    >
      <Sky id={id} from="#e9e3d7" to="#f7f0e2" />
      <Sun cx={786} cy={74} r={36} fill="#f7edda" glow="#f3dcb4" />
      <SunRays cx={786} cy={74} r={36} opacity={0.26} />
      <Clouds opacity={0.5} />
      <g fill="#c4b8a5">
        <path d="M420 300V98h73v202M504 300V144h92v156M607 300V60h102v240M722 300V118h66v182M802 300V78h91v222M907 300V145h93v155" />
      </g>
      <g fill="#9d9f8e">
        <path d="M519 300V170h106v130M687 300V163h140v137M847 300V209h154v91M360 300V180h60v120M240 300V205h90v95" />
      </g>
      <g stroke="#ece7dc" strokeWidth="9" strokeDasharray="15 15">
        <path d="M443 117v169M471 117v169M633 77v197M669 77v197M829 96v97M868 96v97M716 180v105M757 180v105M792 180v105" />
      </g>
      <g className="ew-city-windows" fill="#f6e6bd">
        {[
          [372, 196],
          [392, 196],
          [372, 220],
          [392, 220],
          [258, 222],
          [280, 222],
          [300, 222],
          [258, 246],
          [300, 246],
          [530, 190],
          [552, 190],
          [576, 190],
          [530, 216],
          [576, 216],
          [700, 182],
          [722, 182],
          [754, 182],
          [700, 208],
          [754, 208],
          [860, 226],
          [884, 226],
          [910, 226],
          [860, 250],
          [910, 250],
        ].map(([x, y], i) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="9"
            height="12"
            rx="1.5"
            className="ew-window"
            style={{ animationDelay: `${(i % 9) * 0.45}s` }}
          />
        ))}
      </g>
      <g className="ew-traffic">
        <path fill="#8b8b73" d="M0 286h1000v14H0Z" />
        <g className="ew-car">
          <rect x="0" y="277" width="42" height="11" rx="5" fill="#8c6f52" />
          <rect x="8" y="270" width="24" height="9" rx="4" fill="#a98a67" />
        </g>
        <g className="ew-car ew-car-2">
          <rect x="0" y="277" width="30" height="10" rx="5" fill="#5d6b58" />
          <rect x="6" y="271" width="16" height="8" rx="4" fill="#77866b" />
        </g>
      </g>
      <path d="M0 268q242-20 487 0t513 0v32H0Z" fill="#788571" />
      <Rain id={id} count={20} opacity={0.3} slant={11} />
    </Frame>
  );
}
function ForestScene({ id, motion, className, mood }: SceneProps) {
  return (
    <Frame
      motion={motion}
      className={className}
      mood={mood}
      focusY={170}
      viewBox="0 0 1200 360"
    >
      <Sky id={id} from="#cfe0d3" to="#f0efe0" />
      <Sun cx={250} cy={72} r={30} fill="#f7f0d8" glow="#e7ecc9" />
      <SunRays cx={250} cy={72} r={30} opacity={0.3} />
      <g className="ew-light-shafts">
        <path fill="#fdfbef" opacity=".28" d="M250 90 130 360h150Z" />
        <path
          fill="#fdfbef"
          opacity=".22"
          d="M300 100 210 360h96Z"
          className="ew-shaft-b"
        />
      </g>
      <path fill="#a8bfa7" d="M0 250q180-60 360-24t300-40 340 44 200-16v146H0Z" />
      <path fill="#7d9a80" d="M0 286q220-54 430-12t320-30 250 34 200-14v96H0Z" />
      <g className="ew-treeline ew-treeline-far" fill="#5a7a61">
        {[
          [40, 190],
          [120, 168],
          [210, 200],
          [300, 176],
          [400, 196],
          [500, 164],
          [610, 190],
          [710, 172],
          [820, 198],
          [920, 170],
          [1030, 192],
          [1140, 174],
        ].map(([x, y], i) => {
          const height = 360 - y;
          const base = 30 + (i % 3) * 8;
          return (
            <path
              key={x}
              className="ew-tree"
              style={{ animationDelay: `${(i % 6) * 0.7}s` }}
              d={`m${x} 360 ${Math.round(base / 2)} -${height} ${base} ${height}Z`}
            />
          );
        })}
      </g>
      <g className="ew-treeline ew-treeline-near" fill="#3f5d47">
        {[
          [0, 236],
          [95, 214],
          [200, 246],
          [310, 218],
          [430, 244],
          [560, 210],
          [690, 240],
          [810, 216],
          [940, 246],
          [1070, 214],
        ].map(([x, y], i) => {
          const height = 360 - y;
          const base = 52 + (i % 4) * 12;
          return (
            <path
              key={x}
              className="ew-tree ew-tree-near"
              style={{ animationDelay: `${(i % 5) * 0.9}s` }}
              d={`m${x} 360 ${Math.round(base / 2)} -${height} ${base} ${height}Z`}
            />
          );
        })}
      </g>
      <Mist id={id} y={230} height={130} opacity={0.5} />
      <Rain id={id} count={30} opacity={0.4} slant={9} />
    </Frame>
  );
}
function LakeScene({ id, motion, className, mood }: SceneProps) {
  return (
    <Frame
      motion={motion}
      className={className}
      mood={mood}
      focusY={160}
      viewBox="0 0 1200 360"
    >
      <Sky id={id} from="#dbe4e6" to="#f5f1e6" />
      <Sun cx={980} cy={70} r={30} fill="#f8f2dd" glow="#f1e2c0" />
      <SunRays cx={980} cy={70} r={30} opacity={0.28} />
      <Clouds opacity={0.55} />
      <g className="ew-range ew-range-far">
        <path
          fill="#b6c6c4"
          d="m60 210 150-96 96 74 84-58 120 96 130-84 118 92 96-74 130 78 110-66 100 84v92H60Z"
        />
        <path fill="#eef1e9" opacity=".9" d="m210 150 44-36 52 42-30-6-22 20Z" />
      </g>
      <path fill="#93a9ab" d="M0 214h1200v40H0Z" />
      <g className="ew-reflection" opacity=".38">
        <path
          fill="#b6c6c4"
          d="m60 300 150-72 96 56 84-44 120 72 130-62 118 68 96-56 130 58 110-50 100 64v26H60Z"
        />
      </g>
      <g className="ew-lake">
        <path fill="#c3d4d6" d="M0 234h1200v126H0Z" opacity=".85" />
        <g stroke="#f2f6f3" strokeWidth="3" strokeLinecap="round" opacity=".7">
          <path className="ew-ripple" d="M140 268h180" />
          <path className="ew-ripple" d="M420 296h240" style={{ animationDelay: "1.3s" }} />
          <path className="ew-ripple" d="M760 274h200" style={{ animationDelay: "2.4s" }} />
          <path className="ew-ripple" d="M300 330h260" style={{ animationDelay: "3.1s" }} />
        </g>
      </g>
      <g className="ew-boat ew-canoe">
        <path fill="#8b6f4e" d="M540 320q60 16 120 0l-14 14H554Z" />
        <path stroke="#5c4a33" strokeWidth="3" d="M596 300v22" />
      </g>
      <Mist id={id} y={238} height={110} opacity={0.55} />
      <Wind id={id} count={3} opacity={0.34} />
    </Frame>
  );
}
function DesertScene({ id, motion, className, mood }: SceneProps) {
  return (
    <Frame
      motion={motion}
      className={className}
      mood={mood}
      focusY={180}
      viewBox="0 0 1200 360"
    >
      <Sky id={id} from="#f0d9b5" to="#f8efe0" />
      <Sun cx={880} cy={86} r={44} fill="#f6d79a" glow="#f0c377" />
      <SunRays cx={880} cy={86} r={44} opacity={0.4} length={74} />
      <g className="ew-heat" aria-hidden="true">
        <path
          fill="none"
          stroke="#fbf1dd"
          strokeWidth="3"
          opacity=".55"
          d="M60 300q60-14 120 0t120 0"
        />
        <path
          fill="none"
          stroke="#fbf1dd"
          strokeWidth="2"
          opacity=".4"
          d="M700 320q70-14 140 0t140 0"
          className="ew-heat-b"
        />
      </g>
      <g className="ew-range ew-range-far">
        <path fill="#d8b98c" d="m0 246 210-74 190 62 190-88 200 92 190-70 220 88v104H0Z" />
      </g>
      <g className="ew-dune ew-dune-1">
        <path fill="#e6c99b" d="M0 288q300-64 600-6t600-20v98H0Z" />
      </g>
      <g className="ew-dune ew-dune-2">
        <path fill="#d9b184" d="M0 318q320-52 640 2t560-8v48H0Z" />
      </g>
      <g className="ew-cactus" fill="#6b7f52">
        <path d="M286 330v-70h16v70Zm-26-52h26v12h-14v10h-12Zm42-22h26v12h-14v22h-12Z" />
        <path d="M880 344v-52h14v52Zm-22-38h22v11h-12v8h-10Zm36-16h22v11h-12v16h-10Z" opacity=".9" />
      </g>
      <g className="ew-road">
        <path fill="#6d6355" d="M0 344h1200v16H0Z" />
        <g stroke="#f3ead6" strokeWidth="3" strokeDasharray="34 26">
          <path d="M0 352h1200" className="ew-lane" />
        </g>
      </g>
      <g className="ew-desert-car">
        <g className="ew-car">
          <rect x="0" y="322" width="52" height="14" rx="6" fill="#a4553c" />
          <rect x="10" y="312" width="30" height="12" rx="5" fill="#bd6a4c" />
        </g>
      </g>
    </Frame>
  );
}
function IslandScene({ id, motion, className, mood }: SceneProps) {
  return (
    <Frame
      motion={motion}
      className={className}
      mood={mood}
      focusY={175}
      viewBox="0 0 1200 360"
    >
      <Sky id={id} from="#cfe6e6" to="#f6f1e2" />
      <Sun cx={210} cy={72} r={30} fill="#f9f1cf" glow="#f6e2a4" />
      <SunRays cx={210} cy={72} r={30} opacity={0.42} length={66} />
      <Clouds opacity={0.6} />
      <g className="ew-palms">
        <path fill="#7c6a4b" d="M310 300q-10-70 14-116l16 4q-22 46-10 112Z" />
        <g className="ew-fronds" fill="#4f7a52">
          <path className="ew-frond" d="M330 186q52-30 96-6-46 4-88 20Z" />
          <path className="ew-frond" style={{ animationDelay: "0.6s" }} d="M330 186q-46-34-92-16 44 10 84 30Z" />
          <path className="ew-frond" style={{ animationDelay: "1.2s" }} d="M330 184q40-44 88-40-40 16-84 48Z" />
          <path className="ew-frond" style={{ animationDelay: "1.8s" }} d="M330 188q-30 4-58 40 40-24 62-30Z" />
        </g>
      </g>
      <g className="ew-sea">
        <path fill="#8ec3bd" d="M0 232h1200v128H0Z" />
        <path fill="#79b3ad" d="M0 258q300-26 600 0t600 0v102H0Z" />
        <g stroke="#eef8f4" strokeWidth="2.6" strokeLinecap="round" opacity=".65">
          <path className="ew-ripple" d="M80 292h200" />
          <path className="ew-ripple" d="M520 306h240" style={{ animationDelay: "1s" }} />
          <path className="ew-ripple" d="M880 284h220" style={{ animationDelay: "1.9s" }} />
        </g>
      </g>
      <g className="ew-island">
        <path fill="#e7d6a8" d="M700 268q70-34 150-4 46 18 96 4-70 30-160 22-56-6-86-22Z" />
        <path fill="#5f8a5c" d="M760 258q40-22 92-10-46 16-92 10Z" />
      </g>
      <g className="ew-foam">
        <path
          fill="none"
          stroke="#fbfaef"
          strokeWidth="4"
          strokeLinecap="round"
          opacity=".75"
          d="M0 320q80 14 160 0t160 0 160 0"
        />
        <path
          fill="none"
          stroke="#fbfaef"
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".55"
          className="ew-foam-b"
          d="M560 336q80 14 160 0t160 0 160-4"
        />
      </g>
      <g className="ew-umbrella">
        <path stroke="#8b6f4e" strokeWidth="4" d="M1044 300V262" />
        <path fill="#c4705a" d="M990 262q54-46 108 0Z" />
      </g>
    </Frame>
  );
}
function AuroraScene({ id, motion, className, mood }: SceneProps) {
  return (
    <Frame
      motion={motion}
      className={className}
      mood={mood}
      focusY={110}
      viewBox="0 0 1200 360"
    >
      <defs>
        <linearGradient id={`${id}-night`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="360">
          <stop stopColor="#c3d3e8" />
          <stop offset=".55" stopColor="#dde5ee" />
          <stop offset="1" stopColor="#eef1ec" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id}-night)`} d="M-100-100h1400v560H-100Z" />
      <defs>
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#7fc9a6" stopOpacity="0" />
          <stop offset=".35" stopColor="#7fc9a6" stopOpacity=".6" />
          <stop offset=".7" stopColor="#9dbde8" stopOpacity=".5" />
          <stop offset="1" stopColor="#9dbde8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <Stars id={id} />
      <g className="ew-aurora">
        <path
          className="ew-aurora-band ew-band-a"
          fill={`url(#${id}-band)`}
          d="M-80 150q240-90 470-24t400-52 420 40v-70q-230-40-430 26T320 76 0 62Z"
        />
        <path
          className="ew-aurora-band ew-band-b"
          fill={`url(#${id}-band)`}
          d="M-60 196q260-70 480-16t380-40 420 34v-54q-220-34-420 22T300 122 0 108Z"
        />
      </g>
      <g className="ew-range ew-range-far">
        <path fill="#93a7c0" d="m-40 260 200-96 150 78 130-118 160 134 150-96 170 108 150-84 170 96v90H-40Z" />
        <path fill="#f3f7fb" opacity=".9" d="m436 130 64-58 62 62-30-10-16 18-20-26-26 32Z" />
      </g>
      <g className="ew-range ew-range-near">
        <path fill="#5d7186" d="m120 360 190-116 170 84 150-96 180 118 160-88 190 106v42H120Z" />
        <path fill="#495c70" d="M0 344q300-40 600 0t600-6v22H0Z" />
      </g>
      <Snowfall id={id} count={22} opacity={0.85} />
    </Frame>
  );
}
const SCENES: Record<Mood, (props: SceneProps) => React.JSX.Element> = {
  mountains: MountainScene,
  coast: CoastScene,
  city: CityScene,
  forest: ForestScene,
  lake: LakeScene,
  desert: DesertScene,
  island: IslandScene,
  aurora: AuroraScene,
};
export function Landscape({
  theme = "mountains",
  variant = "",
  motion = true,
}: {
  theme?: Mood;
  variant?: string;
  motion?: boolean;
}) {
  const raw = useId(),
    id = `ew${raw.replaceAll(/[^a-zA-Z0-9]/g, "")}`,
    Scene = SCENES[theme] || MountainScene;
  return (
    <Scene
      id={id}
      motion={motion}
      mood={theme}
      className={variant}
    />
  );
}
