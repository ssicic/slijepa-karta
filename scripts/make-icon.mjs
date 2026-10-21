// Draws the app icon from the real map shapes: Croatia in ink on atlas paper, red dot on Zagreb.
// Writes assets/icon-only.png, icon-foreground.png, icon-background.png (1024px) for @capacitor/assets.
// Run: node scripts/make-icon.mjs
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
globalThis.window = {};
await import(path.join(root, 'www', 'data.js'));
const { bbox, croatia, islands } = window.MAP_DATA;

const PAPER = '#f3ead3', INK = '#2b2620', RED = '#b5361f';
const LAT0 = 44.5, LON0 = 16.5, KX = 111.32 * Math.cos(LAT0 * Math.PI / 180), KY = 110.57;
const zagreb = [(15.982 - LON0) * KX, (LAT0 - 45.815) * KY];

// fill: share of the 1024px canvas the map should span (Android adaptive icons crop the edges).
function svg({ fill, background }) {
  const [x0, y0, x1, y1] = bbox;
  const size = Math.max(x1 - x0, y1 - y0);
  const s = (1024 * fill) / size;
  const tx = 512 - ((x0 + x1) / 2) * s, ty = 512 - ((y0 + y1) / 2) * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${background ? `<rect width="1024" height="1024" fill="${PAPER}"/>` : ''}
    <g transform="translate(${tx} ${ty}) scale(${s})">
      <path d="${croatia}${islands}" fill="${INK}"/>
      <circle cx="${zagreb[0]}" cy="${zagreb[1]}" r="${34 / s}" fill="${PAPER}"/>
      <circle cx="${zagreb[0]}" cy="${zagreb[1]}" r="${22 / s}" fill="${RED}"/>
    </g>
  </svg>`;
}

const out = path.join(root, 'assets');
fs.mkdirSync(out, { recursive: true });
const png = (s, file) => sharp(Buffer.from(s)).png().toFile(path.join(out, file));
await png(svg({ fill: 0.78, background: true }), 'icon-only.png');
await png(svg({ fill: 0.56, background: false }), 'icon-foreground.png');
await png(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${PAPER}"/></svg>`, 'icon-background.png');
console.log('icons written to assets/');
