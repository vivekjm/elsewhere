"use client";
import React, { useId } from "react";
import type { Mood } from "@/lib/model";

/** Small original SVG scenes. Motion uses only composited transforms/opacity;
 * thumbnails are static and every animated layer obeys the shared motion setting. */
export function Landscape({ theme = "mountains", variant = "", animated = true }: {
  theme?: Mood; variant?: string; animated?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const night = theme === "night";
  const sky = theme === "coast" ? "#dce7df" : theme === "city" ? "#e9e3d7" : theme === "forest" ? "#dce5d9" : theme === "desert" ? "#eee1ce" : theme === "snow" ? "#dce6e9" : theme === "sunset" ? "#eed6bc" : night ? "#273e46" : "#dfe5df";
  const haze = night ? "#49616a" : theme === "sunset" ? "#f3e6d4" : "#f3eee1";
  return <svg className={`landscape ew-scene ew-scene-${theme} ${animated ? "ew-scene-animated" : "ew-scene-static"} ${variant}`} viewBox="0 0 1200 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={sky} /><stop offset="1" stopColor={haze} /></linearGradient>
      <linearGradient id={`${id}-mist`}><stop stopColor={night ? "#31474d" : "#f4f1e8"} stopOpacity=".95" /><stop offset="1" stopColor={night ? "#31474d" : "#f4f1e8"} stopOpacity="0" /></linearGradient>
    </defs>
    <path fill={`url(#${id}-sky)`} d="M0 0h1200v360H0Z" />
    {night ? <>
      <g className="ew-scene-stars" fill="#f3e9cb">{[[600,51],[687,85],[780,34],[865,115],[967,52],[1100,95],[530,112],[1150,36],[730,150]].map(([cx,cy], i) => <circle key={i} className={`ew-star ew-star-${i % 3}`} cx={cx} cy={cy} r={i % 3 === 0 ? 2.2 : 1.4} />)}</g>
      <g className="ew-scene-sun"><circle cx="980" cy="84" r="32" fill="#f0e7cc" /><circle cx="993" cy="74" r="29" fill={sky} /></g>
    </> : <circle className="ew-scene-sun" cx={theme === "sunset" ? 913 : 960} cy={theme === "sunset" ? 152 : 82} r={theme === "sunset" ? 53 : 37} fill={theme === "sunset" ? "#db9b70" : "#f8f2dd"} opacity=".95" />}
    {!night && <g className="ew-scene-clouds" fill="#f9f7ee" opacity=".45"><path d="M668 78q18-17 34-5 9-17 28-7 9 2 14 14h-76Z" /><path d="M1030 123q18-17 34-5 9-17 28-7 9 2 14 14h-76Z" /></g>}
    {theme === "coast" ? <>
      <path fill="#819f94" d="M0 183q330-30 650 0t550-10v187H0Z" />
      <path className="ew-scene-wave ew-wave-back" fill="#b0c4b2" d="M-35 234q290-45 595-10t675-16v152H-35Z" />
      <path fill="#e2d6b9" d="M0 292q330-105 610-25t590 15v78H0Z" />
      <path className="ew-scene-wave" fill="none" stroke="#f4f5e8" strokeWidth="3" opacity=".7" d="M613 254q260 66 607 15" />
      <g className="ew-scene-boat"><path fill="#596f61" d="M827 204h42l-7 10h-29Z" /><path fill="#f0ecdd" d="M847 159v40h-23Zm4 9v31h17Z" /><path stroke="#657364" d="M848 158v48" /></g>
    </> : theme === "city" ? <>
      <g fill="#c6b9a7"><path d="M440 360V146h80v214m20 0V193h82v167m25 0V95h108v265m24 0V156h69v204m26 0V117h98v243m20 0V188h101v172" /></g>
      <g fill="#9d9f8e"><path d="M540 360V232h106v128m80 0V219h145v141m24 0V263h205v97" /></g>
      <g stroke="#efe9d9" strokeWidth="9" strokeDasharray="14 17"><path d="M463 161v183m31-183v183m178-231v231m40-231v231m188-207v95m38-95v95" /></g>
      <g className="ew-scene-windows" stroke="#efe9d9" strokeWidth="9" strokeDasharray="14 17"><path d="M570 244v108m42-108v108m139-120v120m39-120v120m40-120v120" /></g>
      <path fill="#788571" d="M0 337q263-25 518 0t682 0v23H0Z" />
    </> : theme === "desert" ? <>
      <path className="ew-scene-far" fill="#d7bea0" d="M0 306q350-60 595-97t605 19v132H0Z" />
      <path fill="#c1a185" d="M290 360q237-218 456-118t454 57v61Z" />
      <path fill="#9e8270" d="M675 360q250-113 525-36v36Z" />
      <g fill="#62715b" className="ew-scene-tree"><path d="M1032 320v-82a5 5 0 0 1 10 0v82Zm-13-48v-26a4 4 0 0 1 8 0v24h9v9h-11a6 6 0 0 1-6-7Zm22-7h8v-24a4 4 0 0 1 8 0v25a8 8 0 0 1-8 8h-8Z" /></g>
    </> : theme === "forest" ? <>
      <path fill="#c4d0bd" d="M0 288q370-155 685-41t515-10v123H0Z" />
      <path fill="#8ea28b" d="M300 360q230-155 470-74t430-32v106Z" />
      <g fill="#627e68">{[630,714,805,914,1066,1150].map((x,i)=><path key={x} d={`M${x} ${340-i%2*36}l${-25-i%3*5} 0 18-33h-12l23-49 22 49h-12l18 33h-23v36h-10Z`} />)}</g>
      <g className="ew-scene-tree" fill="#3f624b"><path d="m950 326-38 0 23-44h-18l32-74 32 74h-17l23 44h-28v34h-10Zm172-21h-39l26-52h-18l30-77 35 77h-18l27 52h-32v55h-11Z" /></g>
      <path className="ew-scene-mist" fill="#e6ebda" opacity=".18" d="M430 291q250-18 610 8t250-5v27q-255-12-690 2Z" />
    </> : <>
      <path className="ew-scene-far" fill={night ? "#586e70" : theme === "snow" ? "#b9cdd0" : theme === "sunset" ? "#c5a793" : "#c3cfc7"} d="m210 243 144-112 75 57 82-100 82 64L715 47l117 133 60-63 134 84 90-96 127 123v132H210Z" />
      <path fill={night ? "#b4c5bb" : "#f1f0e6"} opacity={theme === "sunset" ? ".5" : ".95"} d="m592 152 122-105 117 133-83-57-30 12-24-46-41 62-15-8-18 20-29-11Zm-110-30 29-34 57 45-28-8-20-24-17 26Z" />
      <path fill={night ? "#40585b" : theme === "snow" ? "#96b0b8" : theme === "sunset" ? "#ac8f80" : "#93a79b"} d="m296 328 181-114 81 28 131-109 107 118 81-52 113 65 114-86 123 68v114H296Z" />
      {theme === "snow" && <path fill="#edf3ef" d="m625 187 64-54 83 92-60-28-24-32-22 38-13-9-29 11Zm420 42 59-51 83 47-76-20-21 5-19-13Z" />}
      <path fill={night ? "#2f494d" : theme === "snow" ? "#7a989e" : theme === "sunset" ? "#86776d" : "#647e6c"} d="m410 360 139-89 134 49 131-81 113 73 131-76 160 54v70Z" />
      <path fill={night ? "#203b3e" : theme === "snow" ? "#546f73" : theme === "sunset" ? "#62685c" : "#435e4d"} d="m709 360 144-48 110 27 116-56 139 46v31Z" />
      <g className="ew-scene-tree" fill={night ? "#182f33" : "#364e3e"} opacity=".82"><path d="m977 347 10-36 10 36h-6v13h-9v-13Zm31-8 13-45 13 45h-8v21h-10v-21Zm99-20 11-42 13 42h-8v22h-9v-22Zm-42 25 13-42 13 42h-8v16h-10v-16Z" /></g>
      {theme === "snow" && <g className="ew-scene-snow" fill="#fff" opacity=".7">{[[600,150],[650,270],[800,83],[883,209],[970,130],[1020,260],[1130,182]].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="2.5" />)}</g>}
    </>}
    {!night && theme !== "snow" && <g className="ew-scene-birds" fill="none" stroke="#667c6b" strokeWidth="1.5" opacity=".6"><path d="m804 100 6-3 6 3m20 13 5-3 5 3" /></g>}
    <path fill={`url(#${id}-mist)`} d="M0 0h835v360H0Z" />
  </svg>;
}
