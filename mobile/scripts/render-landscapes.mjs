/** Render the existing Trips Loom SVG cover art into native PNG assets. */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { Landscape } from '../../components/travel/landscape.tsx';

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, '../assets/landscapes');
await mkdir(output, { recursive: true });
for (const mood of ['mountains', 'coast', 'city', 'forest', 'lake', 'desert', 'island', 'aurora']) {
  const markup = renderToStaticMarkup(React.createElement(Landscape, { theme: mood, motion: false }));
  const svg = markup.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360" ');
  await sharp(Buffer.from(svg)).resize(1200, 360).png().toFile(path.join(output, `${mood}.png`));
}
