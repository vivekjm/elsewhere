/**
 * The 3.0 map: OpenFreeMap's dark style, warmed to the app's palette (land, parks, water and roads in warm
 * near-blacks, labels in the faint ink). Fetched once and recoloured on the phone; the plain dark style shows
 * until it's ready.
 */
import { useEffect, useState } from 'react';

const DARK = 'https://tiles.openfreemap.org/styles/dark';

const MAP = {
  land: '#1a1814', park: '#22271d', water: '#141d22', road: '#2e2b24', roadMajor: '#3f3a31', building: '#16140f', label: '#a39c8e', halo: '#0d0c09',
};

type Layer = { id: string; type: string; paint?: Record<string, unknown> };
type Style = { layers: Layer[] };

function warm(style: Style): Style {
  const layers = style.layers.map((l) => {
    const paint = { ...(l.paint ?? {}) };
    const id = l.id;
    if (l.type === 'background') paint['background-color'] = MAP.land;
    else if (l.type === 'fill') {
      if (/water/.test(id)) paint['fill-color'] = MAP.water;
      else if (/park|wood|grass|landcover/.test(id)) paint['fill-color'] = MAP.park;
      else if (/building/.test(id)) { paint['fill-color'] = MAP.building; paint['fill-outline-color'] = MAP.road; }
      else if (/landuse|aeroway|pier/.test(id)) paint['fill-color'] = MAP.land;
    } else if (l.type === 'line') {
      if (/water/.test(id)) paint['line-color'] = MAP.water;
      else if (/motorway|major|trunk|primary/.test(id)) paint['line-color'] = MAP.roadMajor;
      else if (/highway|road|street|path|minor|rail|aeroway/.test(id)) paint['line-color'] = MAP.road;
      else if (/boundary/.test(id)) paint['line-color'] = '#4a453b';
    } else if (l.type === 'symbol') {
      paint['text-color'] = MAP.label; paint['text-halo-color'] = MAP.halo; paint['text-halo-width'] = 1.2;
    }
    return { ...l, paint };
  });
  return { ...style, layers };
}

let cached: Style | null = null;
let pending: Promise<Style | null> | null = null;

function load(): Promise<Style | null> {
  if (cached) return Promise.resolve(cached);
  pending ??= fetch(DARK).then((r) => (r.ok ? r.json() : null)).then((s: Style | null) => { cached = s ? warm(s) : null; return cached; }).catch(() => { pending = null; return null; });
  return pending;
}

/** The warm dark style (an object), or the plain dark style's URL until it has loaded. */
export function useMapStyle(): string | Style {
  const [style, setStyle] = useState<Style | null>(cached);
  useEffect(() => {
    if (style) return;
    let on = true;
    void load().then((s) => { if (on && s) setStyle(s); });
    return () => { on = false; };
  }, [style]);
  return style ?? DARK;
}
