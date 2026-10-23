(() => {
  const PASS_PERCENT = 50;
  const MAIN_GAME_MIN = 50;  // main game: below this on any level and you're out
  const HIGHSCORE_COUNT = 5;
  const STORE_KEY = 'slijepa-karta-progress';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const PLURAL = new Set(['Plitvička jezera', 'Kornati', 'Brijuni']);
  const NUMBER_WORDS = { 5: 'pet', 6: 'šest', 7: 'sedam', 8: 'osam', 9: 'devet', 10: 'deset' };
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  // Same projection as scripts/build-map.mjs: equirectangular around 44.5N, units = km.
  const LAT0 = 44.5, LON0 = 16.5;
  const KX = 111.32 * Math.cos(LAT0 * Math.PI / 180), KY = 110.57;
  const proj = (lat, lon) => [(lon - LON0) * KX, (LAT0 - lat) * KY];

  const $ = id => document.getElementById(id);
  const map = $('map');

  // ---------- progress ----------
  function loadProgress() {
    try { return { best: {}, highscores: [], ...JSON.parse(localStorage.getItem(STORE_KEY)) }; } catch { return { best: {}, highscores: [] }; }
  }
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch {}
  }
  let progress = loadProgress();
  const passed = id => (progress.best[id] || 0) >= PASS_PERCENT;
  // Campaign position: first level not yet passed (or the last one if all are passed).
  const campaignIndex = () => {
    const i = LEVELS.findIndex(l => !passed(l.id));
    return i === -1 ? LEVELS.length - 1 : i;
  };

  // ---------- screens ----------
  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id);
  }

  function renderHome() {
    const ci = campaignIndex();
    const allDone = LEVELS.every(l => passed(l.id));
    $('campaign').innerHTML = allDone
      ? '<small>Sve razine prijeđene</small><span>Igraj ponovno →</span>'
      : `<small>${ci === 0 && !progress.best[LEVELS[0].id] ? 'Počni' : 'Nastavi'} · razina ${ROMAN[ci]}</small><span>${LEVELS[ci].title} →</span>`;
    $('campaign').onclick = () => startRound(ci);
    $('main-game').onclick = startMainGame;
    $('main-game-label').textContent = `Svih ${NUMBER_WORDS[LEVELS.length] || LEVELS.length} razina zaredom →`;

    $('levels').innerHTML = '';
    LEVELS.forEach((level, i) => {
      const li = document.createElement('li');
      const best = progress.best[level.id];
      li.innerHTML = `<button>
        <span class="num">${ROMAN[i]}.</span>
        <span class="name">${level.title}</span>
        <span class="best ${passed(level.id) ? 'passed' : ''}">${best == null ? '—' : best + ' %'}</span>
      </button>`;
      li.firstElementChild.onclick = () => startRound(i);
      $('levels').appendChild(li);
    });
    show('home');
  }

  // ---------- online leaderboard ----------
  let pendingScore = null;
  function offerSubmit(score) {
    pendingScore = Leaderboard.enabled && score.points > 0 ? score : null;
    $('submit-score').classList.toggle('hidden', !pendingScore);
    $('submit-score').querySelector('.row').classList.remove('hidden');
    $('submit-score').querySelector('label').classList.remove('hidden');
    $('nickname').value = Leaderboard.lastNickname();
    $('submit-msg').textContent = '';
    $('submit-btn').disabled = false;
  }
  $('submit-score').addEventListener('submit', async e => {
    e.preventDefault();
    if (!pendingScore) return;
    const { nick, error } = Leaderboard.checkNickname($('nickname').value);
    if (error) { $('submit-msg').textContent = error; return; }
    $('submit-btn').disabled = true;
    $('submit-msg').textContent = 'Spremam…';
    const score = pendingScore;
    pendingScore = null; // one save per game
    const result = await Leaderboard.submit({ nickname: nick, ...score });
    $('submit-score').querySelector('.row').classList.add('hidden');
    $('submit-score').querySelector('label').classList.add('hidden');
    $('submit-msg').textContent = result === 'sent'
      ? `✓ Spremljeno na ljestvicu kao „${nick}“.`
      : 'Nema interneta. Rezultat će se poslati kad se spojiš.';
  });

  function scoreRow(name, points, meta, me) {
    const li = document.createElement('li');
    if (me) li.className = 'me';
    for (const [cls, text] of [['who', name], ['pts', points], ['meta', meta]]) {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text; // textContent: nicknames come from other players
      li.appendChild(span);
    }
    return li;
  }

  async function renderOnline() {
    $('online-section').classList.toggle('hidden', !Leaderboard.enabled);
    if (!Leaderboard.enabled) return;
    const list = $('online-scores');
    $('online-status').textContent = 'Učitavam…';
    list.innerHTML = '';
    try {
      await Leaderboard.flush();
      const rows = await Leaderboard.top(20);
      $('online-status').textContent = rows.length ? '' : 'Još nitko nije na ljestvici. Budi prvi!';
      const mine = Leaderboard.lastNickname();
      for (const r of rows) list.appendChild(scoreRow(r.nickname, r.points, r.finished ? 'sve' : 'do ' + ROMAN[r.reached], r.nickname === mine));
    } catch {
      $('online-status').textContent = 'Ljestvica nije dostupna bez interneta.';
    }
  }

  function renderScores() {
    renderOnline();
    const hs = progress.highscores;
    $('highscores').innerHTML = hs.length
      ? hs.map(h => `<li><span class="pts">${h.points} bodova</span><span class="meta">${h.finished ? 'sve razine' : 'do razine ' + ROMAN[h.reached]} · ${h.date}</span></li>`).join('')
      : '<li class="empty">Još nema rezultata. Odigraj glavnu igru.</li>';
    show('scores');
  }

  // ---------- map drawing ----------
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  let overlay;
  const [bx0, by0, bx1, by1] = MAP_DATA.bbox;
  const HOME = { x: bx0 - 12, y: by0 - 12, w: bx1 - bx0 + 24, h: by1 - by0 + 24 };
  const MAX_ZOOM = 8;
  let view = { ...HOME };

  function setView(v) {
    const f = Math.min(1, Math.max(1 / MAX_ZOOM, v.w / HOME.w));
    const w = HOME.w * f, h = HOME.h * f;
    // Keep the view centre over the home area so the map can't be dragged away.
    const cx = Math.min(HOME.x + HOME.w, Math.max(HOME.x, v.x + v.w / 2));
    const cy = Math.min(HOME.y + HOME.h, Math.max(HOME.y, v.y + v.h / 2));
    view = { x: cx - w / 2, y: cy - h / 2, w, h };
    map.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    $('reset-view').classList.toggle('hidden', f > 0.99);
    drawScale();
    drawReveal();
  }

  // Zoom by factor f (<1 zooms in) keeping the map point p fixed on screen.
  function zoomAt(p, f, from = view) {
    setView({ x: p[0] - (p[0] - from.x) * f, y: p[1] - (p[1] - from.y) * f, w: from.w * f, h: from.h * f });
  }

  // Scale bar: pick a round distance that is about 70px wide at the current zoom.
  function drawScale() {
    const s = kmPerPixel();
    if (!isFinite(s) || s <= 0) return;
    const km = [5, 10, 20, 25, 50, 100, 200].find(k => k / s >= 70) || 200;
    $('scale-line').style.width = km / s + 'px';
    $('scale-km').textContent = km + ' km';
  }

  function drawMap() {
    map.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    // Neighbouring countries get diagonal hatching, like a printed atlas.
    const defs = el('defs', {}, map);
    const hatch = el('pattern', { id: 'hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 5, height: 5, fill: '#e6dcc4' }, hatch);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: '#cbbd9d', 'stroke-width': 1.2 }, hatch);
    el('rect', { x: bx0 - 2000, y: by0 - 2000, width: 4000, height: 4000, fill: 'var(--sea)' }, map);
    for (const d of MAP_DATA.neighbours) el('path', { d, class: 'other' }, map);
    el('path', { d: MAP_DATA.croatia, class: 'croatia' }, map);
    el('path', { d: MAP_DATA.islands, class: 'croatia' }, map);
    // Graticule: a line every whole degree of latitude and longitude.
    let grat = '';
    for (let lon = 12; lon <= 21; lon++) { const [x] = proj(0, lon); grat += `M${x} -2000V2000`; }
    for (let lat = 41; lat <= 48; lat++) { const [, y] = proj(lat, 0); grat += `M-2000 ${y}H2000`; }
    el('path', { d: grat, class: 'grat' }, map);
    overlay = el('g', {}, map);
    setView(HOME);
  }

  // Map units are km, so on-screen sizes are scaled to stay readable on any screen.
  function kmPerPixel() {
    const r = map.getBoundingClientRect();
    const vb = map.viewBox.baseVal;
    return Math.max(vb.width / r.width, vb.height / r.height);
  }

  function svgPoint(evt) {
    const p = map.createSVGPoint();
    p.x = evt[0] ?? evt.clientX; p.y = evt[1] ?? evt.clientY;
    const q = p.matrixTransform(map.getScreenCTM().inverse());
    return [q.x, q.y];
  }

  // ---------- geometry ----------
  function nearestOnSegment(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return [a[0] + t * dx, a[1] + t * dy];
  }
  function nearestOnRiver(p, lines) {
    let best = null, bestD = Infinity;
    for (const line of lines) {
      for (let i = 1; i < line.length; i++) {
        const q = nearestOnSegment(p, line[i - 1], line[i]);
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (d < bestD) { bestD = d; best = q; }
      }
    }
    return best;
  }

  // Even-odd ray test. Works on loose outline pieces as long as together they close up.
  function insideOutline(p, pieces) {
    let inside = false;
    for (const line of pieces) {
      for (let i = 1; i < line.length; i++) {
        const [xi, yi] = line[i], [xj, yj] = line[i - 1];
        if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  }

  // ---------- round ----------
  let round = null;

  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function questionsFor(level) {
    const all = level.rivers ? level.rivers.filter(n => MAP_DATA.rivers[n]).map(name => ({ name, lines: MAP_DATA.rivers[name] }))
      : level.areas ? level.areas.filter(n => MAP_DATA[level.areaSet || 'areas'][n]).map(name => ({ name, lines: MAP_DATA[level.areaSet || 'areas'][name], area: true }))
      : level.items.map(([name, lat, lon, info]) => ({ name, point: proj(lat, lon), info, ridge: level.ranges ? MAP_DATA.ranges[name] : null }));
    return run ? shuffle(all).slice(0, level.perRound) : shuffle(all);
  }

  // Main game: all levels back to back, total points carried over.
  let run = null;
  function startMainGame() {
    run = { total: 0, start: Date.now() };
    startRound(0);
  }

  // Returns the 1-based rank if this run made the high score list, else null.
  function saveHighscore(points, reached, finished) {
    const d = new Date();
    const entry = { points, reached, finished, date: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}.`, t: d.getTime() };
    const list = [...progress.highscores, entry].sort((a, b) => b.points - a.points).slice(0, HIGHSCORE_COUNT);
    progress.highscores = list;
    saveProgress();
    const rank = list.indexOf(entry);
    return rank === -1 ? null : rank + 1;
  }

  function startRound(levelIndex) {
    const level = LEVELS[levelIndex];
    round = { levelIndex, level, questions: questionsFor(level), i: 0, points: 0, answered: false };
    show('game');
    setView(HOME);
    askQuestion();
  }

  function askQuestion() {
    const { level, questions, i } = round;
    round.answered = false;
    round.reveal = null;
    drawReveal();
    $('progress').textContent = `${run ? 'Glavna igra · ' : ''}${ROMAN[round.levelIndex]}. ${level.title} · ${i + 1} od ${questions.length}`;
    // Plural names take "su" instead of "je".
    const verb = PLURAL.has(questions[i].name) ? 'su' : 'je';
    $('question').innerHTML = `Gdje ${verb} <i>${questions[i].name}</i>?`;
    $('score').textContent = (run ? run.total : 0) + round.points;
    $('feedback').classList.add('hidden');
  }

  function scoreFor(km) {
    const { fullKm, zeroKm } = round.level;
    if (km <= fullKm) return 100;
    return Math.max(0, Math.round(100 * (zeroKm - km) / (zeroKm - fullKm)));
  }

  // Draws the guess, the right answer and the line between them, sized for the current zoom.
  function drawReveal() {
    if (!overlay) return;
    overlay.innerHTML = '';
    if (!round || !round.reveal) return;
    const { q, guess, target } = round.reveal;
    const s = kmPerPixel();
    // Mountain band: as wide as the hit zone, in real km (so it grows when you zoom in).
    if (q.ridge) el('polyline', { points: q.ridge.join(' '), class: 'band', 'stroke-width': 2 * round.level.fullKm }, overlay);
    if (q.lines) for (const line of q.lines) el('polyline', { points: line.join(' '), class: q.area ? 'area' : 'river', 'stroke-width': (q.area ? 2 : 3) * s }, overlay);
    el('line', { x1: guess[0], y1: guess[1], x2: target[0], y2: target[1], class: 'link', 'stroke-width': 1 * s, 'stroke-dasharray': `${2 * s} ${3 * s}` }, overlay);
    // Guess: an ink cross. Answer: a red dot in a ring (the atlas symbol for a town).
    const c = 5 * s;
    el('path', { d: `M${guess[0] - c} ${guess[1] - c}L${guess[0] + c} ${guess[1] + c}M${guess[0] + c} ${guess[1] - c}L${guess[0] - c} ${guess[1] + c}`, class: 'guess', 'stroke-width': 2 * s }, overlay);
    if (q.ridge) {
      const [x, y] = q.point;
      el('path', { d: `M${x} ${y - 7 * s}L${x + 6 * s} ${y + 5 * s}L${x - 6 * s} ${y + 5 * s}Z`, class: 'target' }, overlay);
    } else if (q.point) {
      el('circle', { cx: target[0], cy: target[1], r: 6 * s, class: 'target-ring', 'stroke-width': 1.5 * s }, overlay);
      el('circle', { cx: target[0], cy: target[1], r: 2.5 * s, class: 'target' }, overlay);
    }
    const at = q.ridge ? q.point : target; // mountains: label the peak
    const label = el('text', { x: at[0] + 10 * s, y: at[1] + 5 * s, class: 'label', 'font-size': 16 * s, 'stroke-width': 3.5 * s }, overlay);
    label.textContent = q.name;
  }

  function answer(guess) {
    if (!round || round.answered) return;
    round.answered = true;
    const q = round.questions[round.i];
    const target = q.area && insideOutline(guess, q.lines) ? guess
      : q.lines ? nearestOnRiver(guess, q.lines)
      : q.ridge ? nearestOnRiver(guess, [q.ridge]) : q.point;
    const km = Math.hypot(guess[0] - target[0], guess[1] - target[1]);
    const pts = scoreFor(km);
    round.points += pts;

    round.reveal = { q, guess, target };
    drawReveal();

    const verdict = pts === 100 ? 'Točno' : pts >= 70 ? 'Vrlo blizu' : pts >= 40 ? 'Blizu' : pts > 0 ? 'Daleko' : 'Promašaj';
    const dist = km <= round.level.fullKm ? 'pogođeno' : `${Math.round(km)} km`;
    $('feedback-text').innerHTML = `<b>${verdict}</b>, ${dist} <span class="pts">+${pts}</span>`
      + (q.info ? `<div class="info">${q.name}: ${q.info}</div>` : '');
    $('score').textContent = (run ? run.total : 0) + round.points;
    $('next').textContent = round.i + 1 < round.questions.length ? 'Dalje' : 'Rezultat';
    $('feedback').classList.remove('hidden');
  }

  function next() {
    round.i++;
    if (round.i < round.questions.length) askQuestion();
    else finishRound();
  }

  function finishRound() {
    const { level, levelIndex, questions, points } = round;
    const percent = Math.round(points / questions.length);
    const ok = percent >= PASS_PERCENT;
    const wasPassed = passed(level.id);
    if (percent > (progress.best[level.id] || 0)) { progress.best[level.id] = percent; saveProgress(); }

    const nextIndex = levelIndex + 1 < LEVELS.length ? levelIndex + 1 : null;
    if (run) return finishMainGameRound(percent, nextIndex);
    $('result-level').textContent = `${ROMAN[levelIndex]}. ${level.title}`;
    $('result-score').innerHTML = `${percent}<small> %</small>`;
    $('result-stamp').textContent = ok ? (percent >= 90 ? 'Odlično' : 'Položeno') : 'Nije položeno';
    $('result-stamp').classList.toggle('fail', !ok);
    $('result-text').textContent = ok
      ? (!wasPassed && nextIndex != null ? `Otvorena je razina ${ROMAN[nextIndex]}: ${LEVELS[nextIndex].title}.` : `${points} bodova od ${questions.length * 100}.`)
      : `Za prolaz treba ${PASS_PERCENT} %.`;

    const showNext = ok && nextIndex != null;
    $('result-next').classList.toggle('hidden', !showNext);
    if (showNext) {
      $('result-next').textContent = `${ROMAN[nextIndex]}. ${LEVELS[nextIndex].title} →`;
      $('result-next').onclick = () => startRound(nextIndex);
    }
    $('result-retry').textContent = ok ? 'Igraj ponovno' : 'Pokušaj ponovno';
    $('result-retry').className = showNext ? 'btn-outline' : 'btn';
    $('result-retry').classList.remove('hidden');
    $('result-retry').onclick = () => startRound(levelIndex);
    show('result');
  }

  function finishMainGameRound(percent, nextIndex) {
    const { level, levelIndex, points } = round;
    run.total += points;
    const out = percent < MAIN_GAME_MIN;
    const finished = !out && nextIndex == null;
    const rank = out || finished ? saveHighscore(run.total, levelIndex, finished) : null;
    const record = rank === 1 ? ' Novi rekord!' : rank ? ` ${rank}. mjesto na listi.` : '';

    $('result-level').textContent = `Glavna igra · ${ROMAN[levelIndex]}. ${level.title}`;
    $('result-score').innerHTML = `${percent}<small> %</small>`;
    $('result-stamp').textContent = out ? 'Ispadanje' : finished ? 'Sve prijeđeno' : 'Prolaz';
    $('result-stamp').classList.toggle('fail', out);
    $('result-text').textContent = out
      ? `Ispod ${MAIN_GAME_MIN} % na ovoj razini. Ukupno ${run.total} bodova.${record}`
      : finished ? `Ukupno ${run.total} bodova.${record}` : `Zasad ${run.total} bodova.`;

    const goOn = !out && !finished;
    $('result-next').classList.toggle('hidden', !goOn);
    if (goOn) {
      $('result-next').textContent = `${ROMAN[nextIndex]}. ${LEVELS[nextIndex].title} →`;
      $('result-next').onclick = () => startRound(nextIndex);
    }
    $('result-retry').classList.toggle('hidden', goOn);
    $('result-retry').textContent = 'Nova igra';
    $('result-retry').className = 'btn';
    $('result-retry').onclick = startMainGame;
    if (out || finished) {
      offerSubmit({ points: run.total, reached: levelIndex, finished, durationS: (Date.now() - run.start) / 1000 });
      run = null;
    }
    show('result');
  }

  // ---------- wiring ----------
  // One finger: drag to pan, tap (finger barely moved) to guess. Two fingers: pinch to zoom and drag.
  const pointers = new Map();
  let gesture = null;
  const pts = () => [...pointers.values()];
  function startGesture() {
    const p = pts();
    gesture = p.length === 1
      ? { start: p[0], view: { ...view }, moved: gesture?.moved || false }
      : { dist: Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]), mid: svgPoint([(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2]), view: { ...view }, moved: true };
  }
  map.addEventListener('pointerdown', e => {
    try { map.setPointerCapture(e.pointerId); } catch {}
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) gesture = null;
    if (pointers.size <= 2) startGesture();
  });
  map.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    const p = pts();
    if (p.length === 1 && gesture.start) {
      const dx = p[0][0] - gesture.start[0], dy = p[0][1] - gesture.start[1];
      if (Math.hypot(dx, dy) > 10) gesture.moved = true;
      if (gesture.moved) {
        const s = kmPerPixel();
        setView({ ...gesture.view, x: gesture.view.x - dx * s, y: gesture.view.y - dy * s });
      }
    } else if (p.length === 2 && gesture.dist) {
      // Zoom and pan together: the map point that started under the fingers stays under them.
      const d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
      zoomAt(gesture.mid, gesture.dist / d, gesture.view);
      const now = svgPoint([(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2]);
      setView({ ...view, x: view.x + gesture.mid[0] - now[0], y: view.y + gesture.mid[1] - now[1] });
    }
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    const tap = pointers.size === 1 && gesture && !gesture.moved;
    pointers.delete(e.pointerId);
    if (tap && e.type === 'pointerup') answer(svgPoint(e));
    if (pointers.size === 1) startGesture();
  }
  map.addEventListener('pointerup', endPointer);
  map.addEventListener('pointercancel', endPointer);
  map.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(svgPoint(e), Math.exp(e.deltaY * 0.002));
  }, { passive: false });
  $('reset-view').onclick = () => setView(HOME);
  $('next').onclick = next;
  $('quit').onclick = () => { round = null; run = null; renderHome(); };
  $('open-scores').onclick = renderScores;
  $('scores-back').onclick = renderHome;
  $('result-home').onclick = () => { run = null; renderHome(); };

  drawMap();
  renderHome();
  Leaderboard.flush().catch(() => {});
})();
