// Checks the quiz content against the map data. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
globalThis.window = {};
await import(path.join(root, 'www', 'data.js'));
await import(path.join(root, 'www', 'levels.js'));
const { MAP_DATA: map, LEVELS: levels } = window;

const LAT0 = 44.5, LON0 = 16.5, KX = 111.32 * Math.cos(LAT0 * Math.PI / 180), KY = 110.57;
const proj = (lat, lon) => [(lon - LON0) * KX, (LAT0 - lat) * KY];
const lineLength = l => l.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - l[i][0], p[1] - l[i][1]), 0);

// Land = mainland path + island outlines, as rings of points.
const rings = (map.croatia + map.islands).split('Z').filter(Boolean)
  .map(r => r.replace(/^M/, '').split('L').map(p => p.trim().split(' ').map(Number)));
function inside(p, ring) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
function kmFromLand(p) {
  if (rings.some(r => inside(p, r))) return 0;
  let best = Infinity;
  for (const r of rings) for (let i = 1; i < r.length; i++) {
    const [a, b] = [r[i - 1], r[i]], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return best;
}

test('every level has a unique id, a title and enough questions', () => {
  const ids = new Set();
  for (const l of levels) {
    assert.ok(l.id && l.title, 'level needs id and title');
    assert.ok(!ids.has(l.id), `duplicate level id ${l.id}`);
    ids.add(l.id);
    const n = (l.items || l.rivers || l.areas).length;
    assert.ok(n >= l.perRound, `${l.title}: ${n} places but asks ${l.perRound} per round`);
    assert.ok(l.fullKm < l.zeroKm, `${l.title}: fullKm must be below zeroKm`);
  }
});

test('names are unique within each level', () => {
  for (const l of levels) {
    const names = (l.items || []).map(i => i[0]).concat(l.rivers || [], l.areas || []);
    assert.equal(new Set(names).size, names.length, `${l.title} has a duplicate name`);
  }
});

test('every point is on Croatian land (or within 8 km, for small islands)', () => {
  for (const l of levels) for (const [name, lat, lon] of l.items || []) {
    assert.ok(lat > 42.3 && lat < 46.6 && lon > 13.4 && lon < 19.5, `${name} is outside Croatia's box`);
    const km = kmFromLand(proj(lat, lon));
    assert.ok(km <= 8, `${name} is ${km.toFixed(1)} km from land`);
  }
});

test('every river has map data of a sensible length', () => {
  for (const l of levels) for (const name of l.rivers || []) {
    const lines = map.rivers[name];
    assert.ok(lines?.length, `no map data for river ${name}`);
    const km = lines.reduce((s, line) => s + lineLength(line), 0);
    assert.ok(km > 10, `river ${name} is only ${km.toFixed(0)} km`);
  }
});

test('every island and national park has a closed outline', () => {
  for (const l of levels) for (const name of l.areas || []) {
    const pieces = map[l.areaSet || 'areas'][name];
    assert.ok(pieces?.length, `no outline for ${name}`);
    for (const r of pieces) assert.deepEqual(r[0], r[r.length - 1], `${name} outline is not closed`);
  }
});

test('every mountain has a ridge line', () => {
  for (const l of levels.filter(l => l.ranges)) for (const [name] of l.items) {
    const ridge = map.ranges[name];
    assert.ok(ridge?.length >= 2, `no ridge for mountain ${name}`);
  }
});

test('the highest possible score fits the database limit', () => {
  const max = levels.reduce((s, l) => s + l.perRound * 100, 0);
  const sql = fs.readFileSync(path.join(root, 'supabase', 'schema.sql'), 'utf8');
  const limit = Number(sql.match(/points between 0 and (\d+)/)[1]);
  assert.ok(max <= limit, `main game max ${max} is above the database limit ${limit}`);
});
