// Converts Natural Earth GeoJSON into www/data.js (map shapes in km, ready to draw as SVG).
// Run: node scripts/build-map.mjs
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const raw = f => JSON.parse(fs.readFileSync(path.join(root, 'raw-data', f + '.geojson')));

// Same projection as www/game.js: equirectangular around 44.5N, units = km.
const LAT0 = 44.5, LON0 = 16.5;
const KX = 111.32 * Math.cos(LAT0 * Math.PI / 180), KY = 110.57;
const proj = ([lon, lat]) => [(lon - LON0) * KX, (LAT0 - lat) * KY];
const r1 = n => Math.round(n * 10) / 10;

// Drop points closer than minKm to the last kept point.
function simplify(pts, minKm) {
  const out = [pts[0]];
  for (const p of pts.slice(1, -1)) {
    const q = out[out.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= minKm) out.push(p);
  }
  if (pts.length > 1) out.push(pts[pts.length - 1]); // keep the end so outlines stay closed
  return out;
}

const polygons = g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;

function toPath(geometry, minKm) {
  let d = '';
  for (const poly of polygons(geometry)) {
    for (const ring of poly) {
      const pts = simplify(ring.map(proj), minKm);
      if (pts.length < 3) continue;
      d += 'M' + pts.map(p => r1(p[0]) + ' ' + r1(p[1])).join('L') + 'Z';
    }
  }
  return d;
}

// --- Countries ---
const countries = raw('ne_10m_admin_0_countries').features;
const byCode = c => countries.find(f => f.properties.ADM0_A3 === c);
const croatia = byCode('HRV');
const croatiaPath = toPath(croatia.geometry, 0.4);
const neighbours = ['SVN', 'HUN', 'SRB', 'BIH', 'MNE', 'ITA', 'AUT', 'KOS', 'ALB']
  .map(c => byCode(c)).filter(Boolean).map(f => toPath(f.geometry, 1.5));

// --- Rivers: keep only the parts inside Croatia or within 4 km of it ---
const hrRings = polygons(croatia.geometry).map(poly => poly[0].map(proj));

function inRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function nearCroatia(p, km) {
  for (const ring of hrRings) {
    if (inRing(p, ring)) return true;
    for (let i = 1; i < ring.length; i++) if (segDist(p, ring[i - 1], ring[i]) < km) return true;
  }
  return false;
}

// Rivers come from OpenStreetMap (raw-data/osm/rivers*.json, see README): one entry per way.
// Croatian name is name:hr, or the first part of "Una / Уна" style names.
const rivers = {};
// rivers.json: the big seven; rivers2.json: smaller rivers. Same way can appear in both, so dedupe by id.
const seenWays = new Set();
const osmWays = ['rivers.json', 'rivers2.json']
  .flatMap(f => JSON.parse(fs.readFileSync(path.join(root, 'raw-data', 'osm', f))).elements)
  .filter(w => !seenWays.has(w.id) && seenWays.add(w.id));
for (const way of osmWays) {
  const hr = (way.tags['name:hr'] || way.tags.name).split(' / ')[0];
  let run = [];
  const flush = () => { if (run.length > 1) (rivers[hr] ||= []).push(simplify(run, 0.3).map(p => [r1(p[0]), r1(p[1])])); run = []; };
  // Natural Earth's border is coarser than OSM, so allow 5 km slack for border rivers.
  for (const p of way.geometry.map(g => proj([g.lon, g.lat]))) nearCroatia(p, 5) ? run.push(p) : flush();
  flush();
}

// Islands from OpenStreetMap (raw-data/osm/islands.json): outline pieces per island.
// Pieces are not joined into rings; the game's inside-test works on loose pieces too.
// Some names exist twice (e.g. two islands called Unije); keep the bigger one.
const SKIP_ISLANDS = new Set(['Prvić']); // two well-known islands share this name
const areas = {};
const areaSize = {};
for (const el of JSON.parse(fs.readFileSync(path.join(root, 'raw-data', 'osm', 'islands.json'))).elements) {
  const name = el.tags.name;
  if (SKIP_ISLANDS.has(name)) continue;
  const ways = el.type === 'relation'
    ? el.members.filter(m => m.type === 'way' && m.role !== 'inner' && m.geometry).map(m => m.geometry)
    : [el.geometry];
  const rings = joinRings(ways.map(g => g.map(p => [p.lon, p.lat])));
  const pieces = rings.map(r => simplify(r.map(proj), 0.2).map(p => [r1(p[0]), r1(p[1])])).filter(r => r.length > 3);
  const size = pieces.reduce((n, p) => n + p.length, 0);
  if (size > (areaSize[name] || 0)) { areas[name] = pieces; areaSize[name] = size; }
}

// Joins OSM way pieces that share end nodes into closed rings (so they can be filled).
function joinRings(pieces) {
  const key = p => p[0] + ',' + p[1];
  const left = pieces.map(p => p.slice());
  const rings = [];
  while (left.length) {
    let ring = left.shift();
    while (key(ring[0]) !== key(ring[ring.length - 1])) {
      const end = key(ring[ring.length - 1]);
      const i = left.findIndex(p => key(p[0]) === end || key(p[p.length - 1]) === end);
      if (i === -1) break; // open piece: keep it as is
      const next = left.splice(i, 1)[0];
      ring = ring.concat((key(next[0]) === end ? next : next.reverse()).slice(1));
    }
    rings.push(ring);
  }
  return rings;
}

// National park borders from OpenStreetMap (raw-data/osm/nparks.json), keyed by the park's
// short name ("Nacionalni park Krka" -> "Krka"). Kept apart from islands: Mljet is both.
const parks = {};
for (const el of JSON.parse(fs.readFileSync(path.join(root, 'raw-data', 'osm', 'nparks.json'))).elements) {
  const name = el.tags.name.replace(/^Nacionalni park /, '');
  const ways = el.members.filter(m => m.type === 'way' && m.role !== 'inner' && m.geometry).map(m => m.geometry.map(p => [p.lon, p.lat]));
  parks[name] = joinRings(ways).map(r => simplify(r.map(proj), 0.2).map(p => [r1(p[0]), r1(p[1])])).filter(r => r.length > 3);
}

// Island outlines are drawn on the base map too: Natural Earth leaves out the small ones.
const islandsPath = Object.values(areas).flat()
  .map(r => 'M' + r.map(p => p[0] + ' ' + p[1]).join('L') + 'Z').join('');

// Natural Earth draws the big islands too, but coarser. Drop each Natural Earth polygon that an
// OSM island outline already covers (70%+ of its points inside or within 1.5 km), so islands
// don't get two coastlines.
const osmRings = Object.values(areas).flat();
function coveredByOsm(poly) {
  const pts = poly[0].map(proj);
  const hits = pts.filter(p => osmRings.some(r => inRing(p, r) || r.some((q, i) => i > 0 && segDist(p, r[i - 1], q) < 1.5))).length;
  return hits / pts.length >= 0.7;
}
const nePolys = polygons(croatia.geometry);
const keptPolys = nePolys.filter(p => !coveredByOsm(p));
const croatiaLand = toPath({ type: 'MultiPolygon', coordinates: keptPolys }, 0.4);
console.log('Natural Earth polygons', nePolys.length, 'kept', keptPolys.length);

// Mountains as ridge lines. Velebit, Dinara and Svilaja are mapped as ridges in OSM; for the
// rest, take the real peaks around the summit and run a line through them along the direction
// the mountain stretches (centroids of the peaks in slices along that direction).
globalThis.window = globalThis.window || {};
await import(path.join(root, 'www', 'levels.js'));
const summits = Object.fromEntries(window.LEVELS.find(l => l.id === 'mountains').items.map(([n, lat, lon]) => [n, proj([lon, lat])]));
const osmRidges = JSON.parse(fs.readFileSync(path.join(root, 'raw-data', 'osm', 'ridges.json'))).elements;
const allPeaks = JSON.parse(fs.readFileSync(path.join(root, 'raw-data', 'osm', 'allpeaks.json'))).elements
  .map(p => ({ p: proj([p.lon, p.lat]), ele: parseFloat(p.tags.ele) })).filter(p => p.ele > 0);
// name: [lowest peak height to count, search radius in km around the summit]
const RIDGE_FROM_PEAKS = {
  Biokovo: [700, 22], 'Učka': [700, 12], Risnjak: [1100, 7], Medvednica: [450, 20], Mosor: [800, 14],
  Papuk: [600, 18], Psunj: [500, 15], 'Žumberačka gora': [700, 15], Kalnik: [350, 12],
  'Ivanščica': [450, 15], Bjelolasica: [1150, 9],
};
function ridgeFromPeaks(summit, minEle, radius) {
  const pts = allPeaks.filter(q => q.ele >= minEle && Math.hypot(q.p[0] - summit[0], q.p[1] - summit[1]) <= radius).map(q => q.p);
  if (pts.length < 3) return null;
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(ang), uy = Math.sin(ang);
  const t = pts.map(([x, y]) => (x - mx) * ux + (y - my) * uy);
  const tMin = Math.min(...t), tMax = Math.max(...t), bins = Math.max(2, Math.round((tMax - tMin) / 8));
  const line = [];
  for (let b = 0; b < bins; b++) {
    const lo = tMin + (b * (tMax - tMin)) / bins, hi = tMin + ((b + 1) * (tMax - tMin)) / bins;
    const inBin = pts.filter((_, i) => t[i] >= lo && (b === bins - 1 ? t[i] <= hi : t[i] < hi));
    if (inBin.length) line.push([inBin.reduce((a, p) => a + p[0], 0) / inBin.length, inBin.reduce((a, p) => a + p[1], 0) / inBin.length]);
  }
  return line.length >= 2 ? line : null;
}
const ranges = {};
for (const w of osmRidges) ranges[w.tags.name] = w.geometry.map(g => proj([g.lon, g.lat]));
for (const [name, [minEle, radius]] of Object.entries(RIDGE_FROM_PEAKS)) {
  const line = ridgeFromPeaks(summits[name], minEle, radius);
  if (line) ranges[name] = line;
}
for (const k in ranges) ranges[k] = ranges[k].map(p => [r1(p[0]), r1(p[1])]);

// Bounding box of Croatia (km) for the SVG viewBox.
const all = hrRings.flat();
const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r1);

const out = `// Generated by scripts/build-map.mjs from Natural Earth and OpenStreetMap data (© OpenStreetMap contributors, ODbL). Do not edit.
window.MAP_DATA = ${JSON.stringify({ bbox, croatia: croatiaLand, islands: islandsPath, neighbours, rivers, areas, parks, ranges })};
`;
fs.mkdirSync(path.join(root, 'www'), { recursive: true });
fs.writeFileSync(path.join(root, 'www', 'data.js'), out);
console.log('ranges', Object.entries(ranges).map(([k, v]) => { let L = 0; for (let i = 1; i < v.length; i++) L += Math.hypot(v[i][0] - v[i - 1][0], v[i][1] - v[i - 1][1]); return k + ' ' + Math.round(L) + 'km'; }).join(', '));
console.log('parks', Object.entries(parks).map(([k, v]) => k + ':' + v.length).join(' '));
console.log('bbox', bbox, 'size', (out.length / 1024).toFixed(0) + 'KB', 'islands', Object.keys(areas).length, 'rivers', Object.entries(rivers).map(([k, v]) => k + ':' + v.length).join(' '));
