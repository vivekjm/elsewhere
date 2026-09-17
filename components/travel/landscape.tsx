import React, { useId } from "react";
type Theme = "mountains" | "coast" | "city";
export function Landscape({
  theme = "mountains",
  variant = "",
}: {
  theme?: Theme;
  variant?: string;
}) {
  const key = useId().replaceAll(":", "");
  if (theme === "coast")
    return (
      <svg
        className={`landscape ${variant}`}
        viewBox="0 0 1000 300"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${key}`} x2="0" y2="1">
            <stop stopColor="#d1ddd6" />
            <stop offset="1" stopColor="#eef0e4" />
          </linearGradient>
        </defs>
        <path fill={`url(#${key})`} d="M0 0h1000v300H0Z" />
        <circle cx="773" cy="73" r="34" fill="#f4edd6" />
        <path fill="#789b90" d="M0 158Q300 141 600 160t400-2v142H0Z" />
        <path fill="#afc4b2" d="M0 199q230-39 469-4t531-6v111H0Z" />
        <path fill="#e2d6b9" d="M0 230q238-86 463-11t537 22v59H0Z" />
        <path
          fill="none"
          stroke="#f5f5e6"
          strokeWidth="3"
          opacity=".7"
          d="M463 210q258 69 537 19"
        />
      </svg>
    );
  if (theme === "city")
    return (
      <svg
        className={`landscape ${variant}`}
        viewBox="0 0 1000 300"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path fill="#e9e3d7" d="M0 0h1000v300H0Z" />
        <circle cx="786" cy="77" r="38" fill="#f7edda" />
        <g fill="#c4b8a5">
          <path d="M420 300V98h73v202M504 300V144h92v156M607 300V60h102v240M722 300V118h66v182M802 300V78h91v222M907 300V145h93v155" />
        </g>
        <g fill="#9d9f8e">
          <path d="M519 300V170h106v130M687 300V163h140v137M847 300V209h154v91" />
        </g>
        <g stroke="#ece7dc" strokeWidth="9" strokeDasharray="15 15">
          <path d="M443 117v169M471 117v169M633 77v197M669 77v197M829 96v97M868 96v97M716 180v105M757 180v105M792 180v105" />
        </g>
        <path d="M0 278q242-20 487 0t513 0v22H0Z" fill="#788571" />
      </svg>
    );
  return (
    <svg
      className={`landscape ${variant}`}
      viewBox="0 0 1200 360"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${key}`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#dfe5df" />
          <stop offset="1" stopColor="#f3eee1" />
        </linearGradient>
        <linearGradient id={`${key}-mist`}>
          <stop stopColor="#f4f1e8" />
          <stop offset="1" stopColor="#f4f1e8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path fill={`url(#${key})`} d="M0 0h1200v360H0Z" />
      <circle cx="900" cy="74" r="36" fill="#f8f3e2" opacity=".9" />
      <path
        fill="#c3cfc7"
        d="m210 243 144-112 75 57 82-100 82 64L715 47l117 133 60-63 134 84 90-96 127 123v132H210Z"
      />
      <path
        fill="#f1f0e6"
        d="m592 152 122-105 117 133-83-57-30 12-24-46-41 62-15-8-18 20-29-11Zm-110-30 29-34 57 45-28-8-20-24-17 26Z"
      />
      <path
        fill="#93a79b"
        d="m296 328 181-114 81 28 131-109 107 118 81-52 113 65 114-86 123 68v114H296Z"
      />
      <path
        fill="#647e6c"
        d="m410 360 139-89 134 49 131-81 113 73 131-76 160 54v70Z"
      />
      <path fill="#435e4d" d="m709 360 144-48 110 27 116-56 139 46v31Z" />
      <g fill="#364e3e" opacity=".82">
        <path d="m977 347 10-36 10 36h-6v13h-9v-13Zm31-8 13-45 13 45h-8v21h-10v-21Zm99-20 11-42 13 42h-8v22h-9v-22Zm-42 25 13-42 13 42h-8v16h-10v-16Z" />
      </g>
      <path fill={`url(#${key}-mist)`} d="M0 0h850v360H0Z" />
    </svg>
  );
}
