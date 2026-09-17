import React, { useId, useState } from "react";
import { defaultShape, type Item } from "@/lib/model";

export function Garment({ item }: { item: Item }) {
  const key = useId().replaceAll(":", ""),
    color = item.color || "#8b8b73";
  const [failedImage, setFailedImage] = useState("");
  const shapes = {
    dress: (
      <>
        <path d="m65 24-10 36 15 37-37 94h114l-37-94 14-37-9-36-25 15Z" />
        <path
          className="seam"
          d="M66 26q25 28 48 0M71 96h37M74 100l-16 79M104 100l17 79"
        />
      </>
    ),
    glasses: (
      <>
        <path
          fill="none"
          stroke={color}
          strokeWidth="8"
          d="M25 94q25-12 53 0v26q-28 20-49-5ZM103 94q25-12 53 0l-4 23q-25 20-49 3ZM77 99q13-10 27 0M25 94 17 62M156 94l9-32"
        />
      </>
    ),
    tee: (
      <>
        <path d="m60 36-28 11-24 38 29 18 13-20-3 95q44 9 88 0l-3-95 13 20 28-18-24-38-28-11q-29 12-61 0Z" />
        <path
          className="seam"
          d="M61 37q29 36 59 0M51 58l-1 25M132 58v25M50 170q40 8 82 0"
        />
        <path className="rib" d="M64 37q25 28 53 0" />
      </>
    ),
    sweater: (
      <>
        <path d="m65 30-28 13L8 145l24 9 23-68-5 102q38 9 79 0l-3-102 24 68 24-9-31-103-27-12q-23 10-51 0Z" />
        <path
          className="seam"
          d="M66 32q26 36 50 0M56 55 35 133M123 55l22 78M53 175q39 7 74 0"
        />
        <path fill={`url(#${key}-knit)`} opacity=".55" d="M57 66h65v106H57z" />
        <path className="rib" d="m10 137 23 9M150 146l22-9M53 181q37 7 74 0" />
      </>
    ),
    shirt: (
      <>
        <path d="m64 29-27 14L8 149l23 8 25-74-5 108h78l-5-108 26 74 22-8-30-106-27-14H64Z" />
        <path
          className="seam"
          d="M89 41v149M62 30l-9 26 23 12 13-27 15 27 23-12-13-26M104 80h15v22h-15ZM13 136l20 7M147 144l20-7"
        />
        <path className="button" d="M90 77h1M90 105h1M90 133h1M90 161h1" />
      </>
    ),
    pants: (
      <>
        <path d="m48 24-9 170 35 1L90 85l15 110 35-1-9-170H48Z" />
        <path
          className="seam"
          d="M49 35h79M89 36v47M49 44q19 0 13 23M126 44q-20 0-12 23M62 83l-9 105M119 83l9 105M42 183l33 2M105 185l33-2"
        />
        <path className="rib" d="M59 26v10M77 26v10M102 26v10M120 26v10" />
      </>
    ),
    puffer: (
      <>
        <path d="m68 29-13 6-23 16L12 155l28 6 14-64-6 93q43 9 85 0l-7-93 15 64 27-6-20-104-23-16-13-6H68Z" />
        <path
          fill="none"
          stroke="#f4eee3"
          strokeOpacity=".35"
          strokeWidth="2"
          d="M57 64q32 10 67 0M55 85q35 10 70 0M52 109q39 8 76 0M51 131q40 7 79 0M51 154q40 7 80 0M51 176q40 5 81 0M31 61l20 7M26 82l19 6M22 103l20 6M18 125l21 6M131 66l20-5M135 87l20-5M139 109l19-5M142 130l20-5"
        />
        <path
          className="seam"
          d="M69 30q19 40 42 0M90 45v144M59 143l16-4M105 139l17 4"
        />
        <path className="rib" d="M66 31v16M114 31v16M89 53v132" />
      </>
    ),
    coat: (
      <>
        <path d="m64 27-29 20L10 147l22 10 22-70-13 107h100L127 87l23 70 22-10-28-100-30-20H64Z" />
        <path
          className="seam"
          d="m64 28-14 41 28 18 12 104M114 28l16 41-27 18L90 191M66 28l24 33 24-33M51 122l27 4M108 125l25-3M49 153h82"
        />
        <path className="button" d="M86 112h1M86 140h1M86 165h1" />
      </>
    ),
    boots: (
      <>
        <path d="m32 74 42 1 3 47 19 13q18 14 4 25l-69 4q-16-2-15-15l6-45 10-30Zm61-20 43 1 5 47 18 13q17 14 4 25l-67 5q-16-2-15-15l4-45 8-31Z" />
        <path
          fill="#393832"
          d="M16 149q40 9 88-2l-1 15q-29 10-84 4ZM82 127q44 9 85-1l-3 16q-36 9-80 1Z"
        />
        <path
          className="rib"
          d="M33 91h30M32 101h32M30 111h34M30 121h39M95 70h29M94 80h32M91 90h34M91 100h35"
        />
        <path
          className="seam"
          d="M33 78 23 143M94 59l-10 62M41 140l30-6M103 121l33-8"
        />
      </>
    ),
    sneakers: (
      <>
        <path d="M26 87q19 6 24 27l37 14q22 5 21 25-43 13-94 3-6-16 2-36l10-33ZM88 55q21 8 26 29l37 16q20 6 18 25-42 14-93 2-5-15 1-36l11-36Z" />
        <path
          fill="#faf8f1"
          stroke="#b3b0a5"
          strokeWidth="1"
          d="M13 147q41 11 95-3v14q-45 14-94 5ZM75 120q44 9 95-4v15q-45 13-94 3Z"
        />
        <path
          className="rib"
          d="m38 112 21 6m-24 1 23 7m-28 2 23 7m48-52 23 8m-28 0 23 8m-26 1 24 7"
        />
        <path className="seam" d="m54 127-10 14 31-5M117 101l-10 14 32-5" />
      </>
    ),
    bag: (
      <>
        <path
          fill="none"
          stroke={`${color}`}
          strokeWidth="9"
          d="M48 100C21 41 26 24 62 32M133 100c27-59 20-76-15-68M74 29c0-21 33-21 33 0"
        />
        <path d="M46 56q4-32 43-32t44 32l13 122q-2 16-55 17t-56-17L46 56Z" />
        <path
          className="seam"
          d="M46 62q45-14 87 0M51 77q38-12 77 0M57 120h64v56H57Z M58 129h62M39 108l15 2M128 111l13-2"
        />
        <path className="rib" d="M86 73v14M101 123v14" />
      </>
    ),
    camera: (
      <>
        <path
          fill="#292b29"
          d="M17 70h30l13-18h40l11 18h35q17 0 17 16v67q0 13-15 13H30q-14 0-14-14V83Z"
        />
        <path fill="#454844" d="M21 82h138v12H21Z" />
        <circle cx="96" cy="120" r="38" fill="#1f2421" />
        <circle cx="96" cy="120" r="29" fill="#535d56" />
        <circle cx="96" cy="120" r="23" fill="#222c29" />
        <circle cx="96" cy="120" r="14" fill="#364e4c" />
        <ellipse cx="89" cy="111" rx="6" ry="9" fill="#819f92" opacity=".65" />
        <path stroke="#93968e" strokeWidth="3" d="M34 77h13M124 79h13" />
        <rect x="21" y="98" width="24" height="58" rx="4" fill="#343631" />
        <path
          fill="none"
          stroke="#43433b"
          strokeWidth="6"
          d="M18 78Q-5 9 46 16M157 75q36-70-15-60"
        />
      </>
    ),
    scarf: (
      <>
        <path d="m54 30 38 5 36-5 12 136-40 13-15-87-11 103-40-12L54 30Z" />
        <path
          className="seam"
          d="m54 45 38 5 36-5M53 56l37 6 39-7M87 57l-2 35M47 99l30 7M45 111l31 7M99 122l36-6M99 133l37-7M41 157l33 6M104 159l35-6"
        />
        <path
          className="rib"
          d="M37 183v10M43 186v10M50 188v10M57 190v10M64 192v10M70 194v9M107 177v10M115 176v9M123 173v10M132 170v10"
        />
      </>
    ),
    bottle: (
      <>
        <rect x="65" y="40" width="52" height="153" rx="18" />
        <path fill="#343a32" d="M72 22h38v26H72Z" />
        <path className="seam" d="M70 57h40M72 172h37" />
        <path
          fill="none"
          stroke="#d7dccb"
          strokeOpacity=".5"
          strokeWidth="5"
          d="M76 68v89"
        />
        <path
          fill="none"
          stroke="#343a32"
          strokeWidth="5"
          d="M84 22V13h30v30"
        />
      </>
    ),
    cap: (
      <>
        <path d="M31 119q2-70 65-70t65 72l-64 12-66-14Z" />
        <path d="M31 118q41-4 67 13 27 27-29 29-46 0-64-18-12-16 26-24Z" />
        <path
          className="seam"
          d="M98 52v77M89 53q-32 26-26 69M105 54q31 25 31 70"
        />
        <circle cx="96" cy="49" r="4" />
      </>
    ),
  };
  // These private image URLs require the visitor cookie; an optimization proxy cannot read them.
  // eslint-disable-next-line @next/next/no-img-element
  if (item.image && item.image !== failedImage)
    return (
      <img
        onError={() => setFailedImage(item.image)}
        className="garment-image"
        src={item.image}
        alt={item.name}
        loading="lazy"
        decoding="async"
      />
    );
  return (
    <svg
      className="garment-art"
      viewBox="0 0 180 215"
      role="img"
      aria-label={item.name}
    >
      <defs>
        <linearGradient id={`${key}-fabric`}>
          <stop stopColor={color} />
          <stop offset="1" stopColor={color} />
        </linearGradient>
        <pattern
          id={`${key}-knit`}
          width="7"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="m1 1 2 3 2-3M3 4v4"
            fill="none"
            stroke="#332a1e"
            strokeOpacity=".2"
            strokeWidth=".7"
          />
        </pattern>
        <filter
          id={`${key}-shadow`}
          x="-20%"
          y="-10%"
          width="145%"
          height="135%"
        >
          <feDropShadow
            dx="1"
            dy="5"
            stdDeviation="3"
            floodColor="#504936"
            floodOpacity=".12"
          />
        </filter>
      </defs>
      <g
        fill={color}
        stroke="#252a22"
        strokeWidth=".5"
        strokeOpacity=".22"
        filter={`url(#${key}-shadow)`}
      >
        {shapes[
          (item.shape === "hat" ? "cap" : item.shape) as keyof typeof shapes
        ] ||
          shapes[defaultShape(item.category) as keyof typeof shapes] ||
          shapes.tee}
      </g>
    </svg>
  );
}
