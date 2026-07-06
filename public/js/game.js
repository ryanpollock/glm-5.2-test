// Panda Days in SF — client game engine
// Top-down cozy explorer: a panda photographs San Francisco landmarks.

(() => {
  'use strict';

  const TILE = 32;
  const VIEW = 544;
  const TILES_IN_VIEW = VIEW / TILE;
  const MAP_W = 40;
  const MAP_H = 30;
  const SPEED = 148;            // px per second
  const INTERACT = 1.25 * TILE; // interaction radius in px

  // Tile codes
  const T = { GRASS: 0, WATER: 1, BUILDING: 2, STREET: 3, SIDEWALK: 4, BRIDGE: 5, SAND: 6, PIER: 7 };

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const mini = document.getElementById('minimap');
  const mctx = mini.getContext('2d');

  const ui = {
    energy: document.getElementById('energy'),
    bamboo: document.getElementById('bamboo'),
    photos: document.getElementById('photos'),
    score: document.getElementById('score'),
    scoreboard: document.getElementById('scoreboard'),
    restart: document.getElementById('restart'),
    submit: document.getElementById('submit'),
    overlay: document.getElementById('overlay'),
    ovTitle: document.getElementById('ov-title'),
    ovBody: document.getElementById('ov-body'),
    ovName: document.getElementById('ov-name'),
    ovSubmit: document.getElementById('ov-submit'),
    ovClose: document.getElementById('ov-close'),
    toast: document.getElementById('toast'),
    music: document.getElementById('music-btn'),
    charBtn: document.getElementById('char-btn'),
  };

  let state = null;
  let lastToken = null;
  let toastTimer = null;

  // ---------- Landmarks ----------
  const LANDMARKS = [
    { key: 'bridge',  name: 'Golden Gate Bridge', x: 18, y: 1, color: '#c1440e' },
    { key: 'wharf',   name: "Fisherman's Wharf",  x: 31, y: 4, color: '#d98a3d' },
    { key: 'alcatraz',name: 'Alcatraz',           x: 36, y: 8, color: '#9aa6b2' },
    { key: 'coit',    name: 'Coit Tower',         x: 28, y: 6, color: '#e8e6dd' },
    { key: 'lombard', name: 'Lombard Street',     x: 24, y: 8, color: '#7cc36a' },
    { key: 'ladies',  name: 'Painted Ladies',     x: 10, y: 13, color: '#e07a9b' },
    { key: 'china',   name: 'Chinatown',          x: 22, y: 12, color: '#d4362f' },
    { key: 'park',    name: 'Golden Gate Park',   x: 9,  y: 20, color: '#4f9d4f' },
  ];

  const CABLE_STOPS = [
    { x: 24, y: 4,  label: 'North Beach' },
    { x: 24, y: 20, label: 'GG Park' },
  ];
  const NAP_SPOTS = [{ x: 9, y: 20 }, { x: 13, y: 20 }];
  const FERRY_A = { x: 37, y: 4 };  // pier end
  const FERRY_B = { x: 36, y: 8 };  // Alcatraz

  // ---------- Map generation ----------
  function buildMap() {
    const m = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(T.GRASS));
    const set = (x, y, t) => { if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) m[y][x] = t; };
    const fill = (x0, x1, y0, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };

    // Pacific (west), Bay (east), Golden Gate strait (north)
    fill(0, 2, 0, MAP_H - 1, T.WATER);
    fill(34, MAP_W - 1, 0, MAP_H - 1, T.WATER);
    fill(0, 33, 0, 1, T.WATER);

    // Golden Gate Bridge across the strait
    fill(12, 23, 1, 1, T.BRIDGE);

    // Fisherman's Wharf pier jutting into the bay
    fill(33, 37, 4, 4, T.PIER);

    // Alcatraz island in the bay
    fill(35, 36, 7, 8, T.SAND);

    // Street grid
    for (const y of [5, 9, 13, 17, 21, 25]) fill(3, 33, y, y, T.STREET);
    for (const x of [8, 14, 20, 24, 30]) fill(x, x, 2, 28, T.STREET);

    // Downtown / Financial District
    fill(26, 33, 12, 17, T.BUILDING);
    fill(26, 33, 13, 13, T.STREET);
    fill(26, 33, 17, 17, T.STREET);
    fill(30, 30, 12, 17, T.STREET);

    // Chinatown blocks with a north-south gate passage at x=22..23
    fill(20, 25, 11, 11, T.BUILDING);
    fill(20, 25, 14, 14, T.BUILDING);
    fill(20, 20, 12, 13, T.BUILDING);
    fill(25, 25, 12, 13, T.BUILDING);
    fill(22, 23, 12, 13, T.STREET);
    fill(22, 23, 11, 11, T.STREET); // open gate northward -> y=9 street corridor
    fill(22, 23, 14, 14, T.STREET); // open gate southward -> y=17 street corridor

    // Painted Ladies: a row of Victorian houses (the photo is taken from the grass square below)
    fill(7, 12, 11, 11, T.BUILDING);

    // Lombard Street switchback
    const L = T.STREET;
    set(22, 9, L); set(23, 9, L); set(23, 8, L); set(24, 8, L);
    set(24, 7, L); set(25, 7, L); set(25, 8, L); set(26, 8, L);

    // A few park trees (solid) for texture in GG Park edges
    set(5, 22, T.BUILDING); set(15, 18, T.BUILDING); set(6, 19, T.BUILDING); set(14, 22, T.BUILDING);

    return m;
  }

  function isSolidTile(t) { return t === T.WATER || t === T.BUILDING; }
  function tileAtPixel(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return T.WATER;
    return state.map[ty][tx];
  }
  function canStandAt(px, py) {
    const r = 9;
    return !isSolidTile(tileAtPixel(px - r, py - r)) &&
           !isSolidTile(tileAtPixel(px + r, py - r)) &&
           !isSolidTile(tileAtPixel(px - r, py + r)) &&
           !isSolidTile(tileAtPixel(px + r, py + r));
  }

  // ---------- State ----------
  function newGame() {
    const map = buildMap();
    state = {
      map,
      panda: { px: 9 * TILE + 16, py: 21 * TILE + 16, facing: 1, phase: 0, moving: false, daze: 0 },
      energy: 20, maxEnergy: 20,
      bamboo: 0,
      photos: new Set(),
      score: 0,
      won: false,
      napping: 0,           // nap timer (s)
      invuln: 0,            // hazard cooldown
      camX: 0, camY: 0,
      keys: new Set(),
      time: 0,
      lastNap: { x: 9, y: 20 },
      bamboos: [],
      cars: [],
      gulls: [],
      tourists: [],
      fog: [],
      toastShown: new Set(),
    };

    // Bamboo pickups in GG Park + Presidio
    const spots = [
      [6, 20], [8, 19], [10, 21], [12, 20], [11, 18], [13, 22],
      [5, 21], [9, 22], [7, 18], [14, 21],
      [5, 4], [8, 5], [10, 4], [6, 6],
    ];
    state.bamboos = spots
      .map(([x, y]) => ({ x, y, taken: false, bob: Math.random() * Math.PI * 2 }))
      .filter((b) => !isSolidTile(state.map[b.y][b.x]));

    // Cable cars running along x=24 between the stops
    state.cars = [
      { x: 24, y: 4, dir: 1, t: 0 },
      { x: 24, y: 14, dir: -1, t: 0.5 },
    ];

    // Seagulls near the wharf / pier
    state.gulls = [
      { x: 32, y: 3, baseX: 32, baseY: 3, t: Math.random() * 6 },
      { x: 35, y: 5, baseX: 35, baseY: 5, t: Math.random() * 6 },
      { x: 30, y: 4, baseX: 30, baseY: 4, t: Math.random() * 6 },
    ];

    // Lost tourists wandering Chinatown
    state.tourists = [
      { x: 22, y: 13, dx: 0, dy: 0, t: 0 },
      { x: 23, y: 12, dx: 0, dy: 0, t: 1.2 },
      { x: 21, y: 13, dx: 0, dy: 0, t: 2.4 },
    ];

    // Drifting fog wisps over the bay
    for (let i = 0; i < 14; i++) {
      state.fog.push({
        x: 34 + Math.random() * 6, y: Math.random() * MAP_H,
        vx: -0.05 - Math.random() * 0.05, a: 0.05 + Math.random() * 0.08,
      });
    }

    centerCamera();
    ui.restart.textContent = 'Restart';
    fetchScoreboard();
    toast('Welcome to Golden Gate Park! Photograph all 8 landmarks.');
  }

  function centerCamera() {
    const p = state.panda;
    state.camX = clamp(p.px - VIEW / 2, 0, MAP_W * TILE - VIEW);
    state.camY = clamp(p.py - VIEW / 2, 0, MAP_H * TILE - VIEW);
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // ---------- Input ----------
  const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

  let musicPrimed = false;
  function primeMusic() {
    if (musicPrimed) return;
    musicPrimed = true;
    if (!Music.isMuted()) Music.start();
  }
  function toggleMusic() {
    const m = Music.toggle();
    if (!m) Music.start();
    if (ui.music) ui.music.textContent = 'Music: ' + (m ? 'Off' : 'On');
  }

  function pickerOpen() {
    const cp = document.getElementById('char-picker');
    return cp && !cp.classList.contains('hidden');
  }

  window.addEventListener('keydown', (e) => {
    // Let text inputs (e.g. the high-score name field) receive keystrokes normally.
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    if (!state) return;
    if (ui.overlay && !ui.overlay.classList.contains('hidden')) return;
    if (pickerOpen()) return;
    primeMusic();
    if (MOVE_KEYS.has(e.code)) { state.keys.add(e.code); e.preventDefault(); return; }
    if (e.code === 'Space' && !e.repeat) { doAction(); e.preventDefault(); return; }
    if (e.code === 'KeyM') { toggleMusic(); e.preventDefault(); return; }
    if (e.code === 'KeyR') { newGame(); }
  });
  window.addEventListener('keyup', (e) => { if (!state || pickerOpen()) return; state.keys.delete(e.code); });
  canvas.addEventListener('click', () => { if (!state) return; primeMusic(); canvas.focus(); });

  ui.restart.addEventListener('click', () => newGame());
  ui.submit.addEventListener('click', () => { if (state.score > 0) showOverlay(state.won); });
  ui.ovSubmit.addEventListener('click', submitScore);
  ui.ovClose.addEventListener('click', () => ui.overlay.classList.add('hidden'));
  ui.music.addEventListener('click', toggleMusic);
  if (ui.charBtn) ui.charBtn.addEventListener('click', () => {
    Characters.open(() => { newGame(); canvas.focus(); });
  });

  // ---------- Actions ----------
  function nearestLandmark() {
    const p = state.panda;
    let best = null, bd = INTERACT;
    for (const lm of LANDMARKS) {
      if (state.photos.has(lm.key)) continue;
      const d = Math.hypot(lm.x * TILE + 16 - p.px, lm.y * TILE + 16 - p.py);
      if (d < bd) { bd = d; best = lm; }
    }
    return best;
  }
  function nearestNap() {
    const p = state.panda;
    let best = null, bd = TILE * 1.1;
    for (const n of NAP_SPOTS) {
      const d = Math.hypot(n.x * TILE + 16 - p.px, n.y * TILE + 16 - p.py);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  function nearestStop() {
    const p = state.panda;
    let best = null, bd = TILE * 1.2;
    for (const s of CABLE_STOPS) {
      const d = Math.hypot(s.x * TILE + 16 - p.px, s.y * TILE + 16 - p.py);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  function nearFerry() {
    const p = state.panda;
    const a = Math.hypot(FERRY_A.x * TILE + 16 - p.px, FERRY_A.y * TILE + 16 - p.py) < TILE * 1.3;
    const b = Math.hypot(FERRY_B.x * TILE + 16 - p.px, FERRY_B.y * TILE + 16 - p.py) < TILE * 1.3;
    return a || b;
  }

  function doAction() {
    if (!state || state.won) return;
    if (state.napping > 0) return;

    const lm = nearestLandmark();
    if (lm) { photograph(lm); return; }

    const nap = nearestNap();
    if (nap) { startNap(nap); return; }

    const stop = nearestStop();
    if (stop) { rideCableCar(stop); return; }

    if (nearFerry()) { rideFerry(); return; }

    // a little hop
    state.panda.phase += 0.6;
  }

  function photograph(lm) {
    state.photos.add(lm.key);
    state.score += 100;
    flashScreen();
    Music.shutter();
    const n = state.photos.size;
    toast('Photographed ' + lm.name + '!  (' + n + '/8)');
    if (state.photos.size >= LANDMARKS.length) {
      state.won = true;
      state.score += 200 + state.energy * 2;
      setTimeout(() => showOverlay(true), 700);
    }
  }

  function startNap(nap) {
    state.napping = 1.6;
    state.energy = state.maxEnergy;
    state.lastNap = { x: nap.x, y: nap.y };
    toast('Nap time! Energy restored.');
  }

  function rideCableCar(stop) {
    const other = CABLE_STOPS.find((s) => s !== stop);
    state.panda.px = other.x * TILE + 16;
    state.panda.py = other.y * TILE + 16;
    centerCamera();
    toast('Riding the cable car to ' + other.label + '!');
  }

  function rideFerry() {
    const p = state.panda;
    const atPier = Math.hypot(FERRY_A.x * TILE + 16 - p.px, FERRY_A.y * TILE + 16 - p.py) < TILE * 1.4;
    const dest = atPier ? FERRY_B : FERRY_A;
    p.px = dest.x * TILE + 16;
    p.py = dest.y * TILE + 16;
    centerCamera();
    toast(atPier ? 'Ferry to Alcatraz!' : 'Ferry back to the Wharf!');
  }

  // ---------- Update ----------
  function update(dt) {
    state.time += dt;
    if (state.invuln > 0) state.invuln -= dt;
    if (state.panda.daze > 0) state.panda.daze -= dt;

    if (state.napping > 0) {
      state.napping -= dt;
      state.panda.moving = false;
    } else if (!state.won) {
      movePanda(dt);
      pickUpBamboo();
      updateHazards(dt);
      checkHazards();
    }

    // camera follow
    const p = state.panda;
    const tx = clamp(p.px - VIEW / 2, 0, MAP_W * TILE - VIEW);
    const ty = clamp(p.py - VIEW / 2, 0, MAP_H * TILE - VIEW);
    state.camX += (tx - state.camX) * Math.min(1, dt * 8);
    state.camY += (ty - state.camY) * Math.min(1, dt * 8);

    updateHUD();
  }

  function movePanda(dt) {
    const p = state.panda;
    const k = state.keys;
    let dx = 0, dy = 0;
    if (k.has('ArrowLeft') || k.has('KeyA')) dx -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) dx += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) dy -= 1;
    if (k.has('ArrowDown') || k.has('KeyS')) dy += 1;

    p.moving = (dx !== 0 || dy !== 0);
    if (!p.moving) return;

    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
    if (dx !== 0) p.facing = dx < 0 ? -1 : 1;
    const slow = p.daze > 0 ? 0.45 : 1;
    const v = SPEED * slow * dt;

    const nx = p.px + dx * v;
    if (canStandAt(nx, p.py)) p.px = nx;
    const ny = p.py + dy * v;
    if (canStandAt(p.px, ny)) p.py = ny;

    p.phase += v * 0.12;
  }

  function pickUpBamboo() {
    const p = state.panda;
    for (const b of state.bamboos) {
      if (b.taken) continue;
      const d = Math.hypot(b.x * TILE + 16 - p.px, b.y * TILE + 16 - p.py);
      if (d < TILE * 0.7) {
        b.taken = true;
        state.bamboo += 1;
        state.energy = Math.min(state.maxEnergy, state.energy + 2);
        state.score += 5;
        Music.pluck();
        toast('Nibbled some bamboo! +2 energy');
      }
    }
  }

  // ---------- Hazards ----------
  function updateHazards(dt) {
    // Cable cars move along x=24 between y=4 and y=20
    for (const c of state.cars) {
      c.t += dt;
      c.y += c.dir * 1.6 * dt;
      if (c.y >= 20) { c.y = 20; c.dir = -1; }
      if (c.y <= 4) { c.y = 4; c.dir = 1; }
    }
    // Seagulls swoop in figure-8-ish loops near the wharf
    for (const g of state.gulls) {
      g.t += dt;
      g.x = g.baseX + Math.sin(g.t * 1.3) * 3.2;
      g.y = g.baseY + Math.cos(g.t * 0.9) * 1.6;
    }
    // Tourists wander randomly within Chinatown, changing direction occasionally
    for (const tr of state.tourists) {
      tr.t -= dt;
      if (tr.t <= 0) {
        tr.t = 0.6 + Math.random() * 1.2;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]];
        const d = dirs[(Math.random() * dirs.length) | 0];
        tr.dx = d[0]; tr.dy = d[1];
      }
      const nx = tr.x + tr.dx * 1.0 * dt;
      const ny = tr.y + tr.dy * 1.0 * dt;
      if (nx >= 20 && nx <= 26) tr.x = nx;
      if (ny >= 11 && ny <= 15) tr.y = ny;
    }
    // Fog drifts westward over the bay
    for (const f of state.fog) {
      f.x += f.vx * dt * 4;
      f.y += Math.sin(state.time * 0.3 + f.x) * 0.002;
      if (f.x < 34) { f.x = 39 + Math.random() * 1; f.y = Math.random() * MAP_H; }
    }
  }

  function checkHazards() {
    const p = state.panda;
    if (state.invuln > 0) return;
    const px = p.px / TILE, py = p.py / TILE;

    // Cable car collision
    for (const c of state.cars) {
      if (Math.hypot(c.x - px, c.y - py) < 0.7) {
        hitByCar(c);
        return;
      }
    }
    // Seagull steals bamboo
    for (const g of state.gulls) {
      if (Math.hypot(g.x - px, g.y - py) < 0.7 && state.bamboo > 0) {
        state.bamboo -= 1;
        state.invuln = 0.8;
        toast('A seagull swooped off a bamboo stalk!');
        return;
      }
    }
    // Tourist bump
    for (const tr of state.tourists) {
      if (Math.hypot(tr.x - px, tr.y - py) < 0.6) {
        state.energy = Math.max(0, state.energy - 1);
        state.invuln = 0.5;
        const a = Math.atan2(py - tr.y, px - tr.x);
        const bx = p.px + Math.cos(a) * TILE * 0.8;
        const by = p.py + Math.sin(a) * TILE * 0.8;
        if (canStandAt(bx, by)) { p.px = bx; p.py = by; }
        toast('Bumped by a lost tourist!');
        if (state.energy <= 0) tuckerOut();
        return;
      }
    }

    if (state.energy <= 0) tuckerOut();
  }

  function hitByCar(c) {
    const p = state.panda;
    state.energy = Math.max(0, state.energy - 3);
    state.invuln = 1.0;
    p.daze = 1.2;
    const a = Math.atan2(p.py / TILE - c.y, p.px / TILE - c.x);
    const bx = p.px + Math.cos(a) * TILE * 1.2;
    const by = p.py + Math.sin(a) * TILE * 1.2;
    if (canStandAt(bx, by)) { p.px = bx; p.py = by; }
    toast('Cable car collision! Oof.');
    if (state.energy <= 0) tuckerOut();
  }

  function tuckerOut() {
    const n = state.lastNap;
    state.panda.px = n.x * TILE + 16;
    state.panda.py = n.y * TILE + 16;
    state.energy = state.maxEnergy;
    state.invuln = 1.0;
    centerCamera();
    toast("Tuckered out! Napping back at the park.");
  }

  // ---------- Rendering ----------
  function render() {
    ctx.clearRect(0, 0, VIEW, VIEW);
    const x0 = Math.max(0, Math.floor(state.camX / TILE));
    const y0 = Math.max(0, Math.floor(state.camY / TILE));
    const x1 = Math.min(MAP_W - 1, Math.ceil((state.camX + VIEW) / TILE));
    const y1 = Math.min(MAP_H - 1, Math.ceil((state.camY + VIEW) / TILE));

    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        drawTile(x, y);

    drawBamboos();
    drawLandmarks();
    drawFerry();
    drawCars();
    drawGulls();
    drawTourists();
    drawPanda();
    drawFog();
    drawPhotoFlash();
    if (state.panda.daze > 0) drawDazeStars();
  }

  function sx(worldX) { return worldX - state.camX; }
  function sy(worldY) { return worldY - state.camY; }

  function drawTile(x, y) {
    const t = state.map[y][x];
    const px = sx(x * TILE), py = sy(y * TILE);
    switch (t) {
      case T.GRASS:
        ctx.fillStyle = '#4f9d4f'; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#57a857'; ctx.fillRect(px + 6, py + 8, 4, 4);
        ctx.fillRect(px + 20, py + 18, 4, 4);
        break;
      case T.WATER:
        ctx.fillStyle = '#2a6f97'; ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
        const w = Math.sin(state.time * 1.5 + x * 0.7 + y * 0.5) * 3;
        ctx.beginPath(); ctx.moveTo(px + 4, py + 16 + w); ctx.lineTo(px + 28, py + 16 - w); ctx.stroke();
        break;
      case T.BUILDING:
        ctx.fillStyle = '#6b7280'; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#525a66'; ctx.fillRect(px, py, TILE, 8);
        ctx.fillStyle = '#9aa6b2'; ctx.fillRect(px + 6, py + 12, 5, 5); ctx.fillRect(px + 20, py + 12, 5, 5);
        ctx.fillRect(px + 6, py + 22, 5, 5); ctx.fillRect(px + 20, py + 22, 5, 5);
        break;
      case T.STREET:
        ctx.fillStyle = '#3a3a40'; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#d4b441'; ctx.fillRect(px + 14, py + 14, 4, 4);
        break;
      case T.BRIDGE:
        ctx.fillStyle = '#c1440e'; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#a8380b'; ctx.fillRect(px + 2, py, 4, TILE);
        ctx.fillStyle = '#e8c07a'; ctx.fillRect(px + 10, py + 12, TILE - 12, 4);
        break;
      case T.SAND:
        ctx.fillStyle = '#d9c79a'; ctx.fillRect(px, py, TILE, TILE);
        break;
      case T.PIER:
        ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#6f4720'; ctx.fillRect(px, py, TILE, 4); ctx.fillRect(px, py + TILE - 4, TILE, 4);
        break;
    }
  }

  function drawBamboos() {
    for (const b of state.bamboos) {
      if (b.taken) continue;
      const px = sx(b.x * TILE + 16), py = sy(b.y * TILE + 16);
      if (px < -TILE || py < -TILE || px > VIEW || py > VIEW) continue;
      const bob = Math.sin(state.time * 2 + b.bob) * 2;
      ctx.strokeStyle = '#3a7d3a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px, py + 10); ctx.lineTo(px, py - 8 + bob); ctx.stroke();
      ctx.fillStyle = '#5cb85c';
      ctx.beginPath(); ctx.ellipse(px - 4, py - 2 + bob, 4, 2, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px + 4, py - 6 + bob, 4, 2, 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawLandmarks() {
    for (const lm of LANDMARKS) {
      const px = sx(lm.x * TILE + 16), py = sy(lm.y * TILE + 16);
      if (px < -80 || py < -80 || px > VIEW + 80 || py > VIEW + 80) continue;
      const captured = state.photos.has(lm.key);
      drawLandmarkIcon(lm, px, py);
      // marker ring
      if (!captured) {
        const r = 18 + Math.sin(state.time * 3) * 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = '#f2c14e';
        drawStar(px + 14, py - 14, 5, 5, 2);
      }
    }
  }

  function drawLandmarkIcon(lm, px, py) {
    switch (lm.key) {
      case 'bridge': {
        // two towers + cables
        ctx.fillStyle = '#c1440e';
        ctx.fillRect(px - 26, py - 30, 6, 44);
        ctx.fillRect(px + 20, py - 30, 6, 44);
        ctx.strokeStyle = '#e8c07a'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px - 23, py - 10); ctx.quadraticCurveTo(px, py - 26, px + 23, py - 10);
        ctx.moveTo(px - 23, py - 4); ctx.quadraticCurveTo(px, py - 20, px + 23, py - 4);
        ctx.stroke();
        break;
      }
      case 'wharf': {
        ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px - 22, py - 8, 44, 16);
        ctx.fillStyle = '#d98a3d'; ctx.fillRect(px - 18, py - 22, 16, 16);
        ctx.fillRect(px + 2, py - 18, 14, 14);
        ctx.fillStyle = '#3a3a40'; ctx.fillRect(px - 16, py - 18, 4, 4); ctx.fillRect(px + 5, py - 14, 4, 4);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('P', px - 10, py - 11);
        break;
      }
      case 'alcatraz': {
        ctx.fillStyle = '#9aa6b2'; ctx.fillRect(px - 16, py - 8, 32, 16);
        ctx.fillStyle = '#cfd8e0'; ctx.fillRect(px - 4, py - 26, 8, 22);
        ctx.fillStyle = '#ef6b5b'; ctx.fillRect(px - 2, py - 30, 4, 4);
        ctx.fillStyle = '#2a2a30'; ctx.fillRect(px - 10, py - 2, 3, 3); ctx.fillRect(px + 6, py - 2, 3, 3);
        break;
      }
      case 'coit': {
        ctx.fillStyle = '#7cc36a'; ctx.beginPath(); ctx.ellipse(px, py + 6, 20, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8e6dd'; ctx.fillRect(px - 7, py - 34, 14, 38);
        ctx.fillStyle = '#cfd8e0'; ctx.beginPath(); ctx.moveTo(px, py - 44); ctx.lineTo(px - 9, py - 30); ctx.lineTo(px + 9, py - 30); ctx.closePath(); ctx.fill();
        break;
      }
      case 'lombard': {
        ctx.strokeStyle = '#d4b441'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(px - 18, py + 12); ctx.lineTo(px - 6, py + 4); ctx.lineTo(px + 6, py + 12); ctx.lineTo(px + 18, py + 4); ctx.stroke();
        for (const fx of [-12, 0, 12]) { ctx.fillStyle = '#e07a9b'; ctx.beginPath(); ctx.arc(px + fx, py + 16, 2.5, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'ladies': {
        const cols = ['#e07a9b', '#5fb3d4', '#f2c14e', '#9b7fd4'];
        for (let i = 0; i < 4; i++) {
          const hx = px - 22 + i * 14;
          ctx.fillStyle = cols[i]; ctx.fillRect(hx, py - 16, 12, 18);
          ctx.fillStyle = '#7a4a3a'; ctx.beginPath(); ctx.moveTo(hx - 1, py - 16); ctx.lineTo(hx + 6, py - 24); ctx.lineTo(hx + 13, py - 16); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#3a3a40'; ctx.fillRect(hx + 3, py - 8, 3, 3); ctx.fillRect(hx + 6, py - 8, 3, 3);
        }
        break;
      }
      case 'china': {
        ctx.fillStyle = '#d4362f'; ctx.fillRect(px - 22, py - 6, 44, 12);
        ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.moveTo(px - 24, py - 6); ctx.lineTo(px, py - 20); ctx.lineTo(px + 24, py - 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2c14e'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('天', px, py + 2);
        ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(px - 16, py - 10, 2.5, 0, Math.PI * 2); ctx.arc(px + 16, py - 10, 2.5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'park': {
        // bamboo grove
        for (let i = -2; i <= 2; i++) {
          const bx = px + i * 9;
          ctx.strokeStyle = '#3a7d3a'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(bx, py + 14); ctx.lineTo(bx, py - 16); ctx.stroke();
          ctx.fillStyle = '#5cb85c'; ctx.beginPath(); ctx.ellipse(bx - 5, py - 8, 5, 2.5, -0.6, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(bx + 5, py - 14, 5, 2.5, 0.6, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
    }
  }

  function drawStar(cx, cy, spikes, outer, inner) {
    let rot = Math.PI / 2 * 3, step = Math.PI / spikes;
    ctx.beginPath(); ctx.moveTo(cx, cy - outer);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer); rot += step;
      ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner); rot += step;
    }
    ctx.closePath(); ctx.fill();
  }

  function drawFerry() {
    const p = state.panda;
    const atPier = Math.hypot(FERRY_A.x * TILE + 16 - p.px, FERRY_A.y * TILE + 16 - p.py) < TILE * 1.4;
    const f = atPier ? FERRY_A : FERRY_B;
    const px = sx(f.x * TILE + 16), py = sy(f.y * TILE + 16);
    ctx.fillStyle = '#e07a9b'; ctx.fillRect(px - 12, py - 6, 24, 12);
    ctx.fillStyle = '#fff'; ctx.fillRect(px - 4, py - 12, 8, 8);
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(px - 3, py - 11, 2, 2); ctx.fillRect(px + 1, py - 11, 2, 2);
  }

  function drawCars() {
    for (const c of state.cars) {
      const px = sx(c.x * TILE + 16), py = sy(c.y * TILE + 16);
      ctx.fillStyle = '#c1440e'; ctx.fillRect(px - 11, py - 8, 22, 16);
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(px - 8, py - 5, 16, 5);
      ctx.fillStyle = '#fff'; ctx.fillRect(px - 9, py - 8, 2, 16); ctx.fillRect(px + 7, py - 8, 2, 16);
      ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.arc(px - 7, py + 8, 3, 0, Math.PI * 2); ctx.arc(px + 7, py + 8, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawGulls() {
    for (const g of state.gulls) {
      const px = sx(g.x * TILE + 16), py = sy(g.y * TILE + 16);
      const flap = Math.sin(state.time * 12) * 3;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px - 8, py + flap); ctx.quadraticCurveTo(px, py - 4, px + 8, py + flap);
      ctx.quadraticCurveTo(px, py + 2, px - 8, py + flap); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawTourists() {
    for (const tr of state.tourists) {
      const px = sx(tr.x * TILE + 16), py = sy(tr.y * TILE + 16);
      ctx.fillStyle = '#e6b870'; ctx.beginPath(); ctx.arc(px, py - 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a7fd4'; ctx.fillRect(px - 5, py + 3, 10, 10);
      ctx.fillStyle = '#5a3a2a'; ctx.fillRect(px - 4, py - 8, 8, 4);
      ctx.fillStyle = '#fff'; ctx.fillRect(px + 3, py - 1, 4, 3);
    }
  }

  function drawPanda() {
    const p = state.panda;
    const px = sx(p.px), py = sy(p.py);
    const ch = window.Characters ? Characters.get() : null;
    const body = ch ? ch.body : '#ffffff';
    const detail = ch ? ch.detail : '#1a1a1a';
    const belly = ch ? ch.belly : '#ffffff';
    const accent = ch ? ch.accent : '#1a1a1a';
    const eyePatch = !!(ch && ch.eyePatch);
    const stripes = !!(ch && ch.stripes);
    const glasses = !!(ch && ch.glasses);
    const tail = !!(ch && ch.tail);
    const mane = !!(ch && ch.mane);
    ctx.save();
    ctx.translate(px, py);
    const f = p.facing;
    const walking = p.moving && state.napping <= 0;
    const bob = walking ? Math.sin(p.phase) * 1.5 : Math.sin(state.time * 2) * 0.6;
    const napping = state.napping > 0;

    if (napping) {
      // lying down
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 2, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
      if (belly !== body) { ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(-2, 4, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); }
      // head
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(12 * f, 0, 7, 0, Math.PI * 2); ctx.fill();
      // ears
      ctx.fillStyle = detail;
      ctx.beginPath(); ctx.arc(8 * f, -6, 2.8, 0, Math.PI * 2); ctx.arc(16 * f, -6, 2.8, 0, Math.PI * 2); ctx.fill();
      // eyes / glasses
      if (glasses) {
        ctx.fillStyle = accent; ctx.fillRect(11 * f - 3, -3, 7, 3);
      } else {
        ctx.fillStyle = detail;
        ctx.beginPath(); ctx.arc(13 * f, -1, 1.3, 0, Math.PI * 2); ctx.arc(16 * f, -1, 1.3, 0, Math.PI * 2); ctx.fill();
      }
      // nose
      ctx.fillStyle = detail; ctx.beginPath(); ctx.arc(19 * f, 0, 1.4, 0, Math.PI * 2); ctx.fill();
      // Zzz
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
      const z = (Math.sin(state.time * 3) + 1) * 3;
      ctx.fillText('z', -2, -10 - z); ctx.fillText('Z', 4, -16 - z);
      ctx.restore(); return;
    }

    // tail (drawn behind body)
    if (tail) {
      ctx.strokeStyle = detail; ctx.lineWidth = 3;
      const tw = walking ? Math.sin(p.phase) * 3 : Math.sin(state.time * 2) * 2;
      ctx.beginPath(); ctx.moveTo(-10, 4); ctx.quadraticCurveTo(-17 + tw, 0, -15 - tw, -8); ctx.stroke();
    }

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0, 12, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, -bob);

    // legs
    ctx.fillStyle = detail;
    const swing = walking ? Math.sin(p.phase) * 3 : 0;
    ctx.fillRect(-8 + swing, 6, 4, 7);
    ctx.fillRect(4 - swing, 6, 4, 7);

    // body
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 2, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
    if (belly !== body) {
      ctx.fillStyle = belly;
      ctx.beginPath(); ctx.ellipse(0, 4, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (stripes) {
      ctx.fillStyle = detail;
      for (let i = -2; i <= 2; i++) ctx.fillRect(i * 4 - 1, -3, 2, 10);
    }
    // arms
    ctx.fillStyle = detail;
    ctx.beginPath(); ctx.ellipse(-9, 2 + swing * 0.4, 3, 5, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(9, 2 - swing * 0.4, 3, 5, -0.2, 0, Math.PI * 2); ctx.fill();

    // head
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, -8, 8, 0, Math.PI * 2); ctx.fill();
    // ears / mane
    ctx.fillStyle = detail;
    if (mane) {
      ctx.beginPath(); ctx.arc(-6, -14, 4.2, 0, Math.PI * 2); ctx.arc(6, -14, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(-6, -14, 2.4, 0, Math.PI * 2); ctx.arc(6, -14, 2.4, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(-6, -14, 3.2, 0, Math.PI * 2); ctx.arc(6, -14, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    // eye patches (panda only)
    if (eyePatch) {
      ctx.fillStyle = detail;
      ctx.beginPath(); ctx.ellipse(-3 * f, -8, 2.6, 3.2, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(3 * f, -8, 2.6, 3.2, -0.2, 0, Math.PI * 2); ctx.fill();
      // eyes (white glints in the patches)
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-3 * f + 0.4 * f, -8.6, 0.7, 0, Math.PI * 2); ctx.arc(3 * f + 0.4 * f, -8.6, 0.7, 0, Math.PI * 2); ctx.fill();
    } else if (glasses) {
      ctx.fillStyle = accent;
      ctx.fillRect(-7, -10, 6, 3);
      ctx.fillRect(1, -10, 6, 3);
      ctx.strokeStyle = detail; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-1, -9); ctx.lineTo(1, -9); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-4, -8.6, 0.7, 0, Math.PI * 2); ctx.arc(4, -8.6, 0.7, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = detail;
      ctx.beginPath(); ctx.arc(-3 * f, -8.4, 0.9, 0, Math.PI * 2); ctx.arc(3 * f, -8.4, 0.9, 0, Math.PI * 2); ctx.fill();
    }
    // nose
    ctx.fillStyle = detail;
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-2, -4); ctx.lineTo(2, -4); ctx.closePath(); ctx.fill();

    // idle hold: bamboo, or a phone for the tech bro
    if (!walking) {
      if (glasses) {
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(7 * f - 2, -6, 5, 8);
        ctx.fillStyle = accent; ctx.fillRect(7 * f - 1, -5, 3, 5);
      } else {
        ctx.strokeStyle = '#3a7d3a'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(8 * f, -5); ctx.lineTo(13 * f, -2); ctx.stroke();
        ctx.fillStyle = '#5cb85c'; ctx.beginPath(); ctx.ellipse(13 * f, -4, 2.5, 1.5, 0.6 * f, 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawDazeStars() {
    const p = state.panda;
    const px = sx(p.px), py = sy(p.py) - 22;
    ctx.fillStyle = '#f2c14e';
    for (let i = 0; i < 3; i++) {
      const a = state.time * 4 + i * 2.1;
      drawStar(px + Math.cos(a) * 10, py + Math.sin(a) * 4, 4, 3, 1.4);
    }
  }

  function drawFog() {
    for (const f of state.fog) {
      const px = sx(f.x * TILE), py = sy(f.y * TILE);
      ctx.fillStyle = 'rgba(220,228,235,' + f.a + ')';
      ctx.beginPath(); ctx.arc(px, py, 22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 14, py + 6, 18, 0, Math.PI * 2); ctx.fill();
    }
  }

  let flashAlpha = 0;
  function flashScreen() { flashAlpha = 0.55; }
  function drawPhotoFlash() {
    if (flashAlpha <= 0) return;
    ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha + ')';
    ctx.fillRect(0, 0, VIEW, VIEW);
    flashAlpha -= 0.04;
  }

  // ---------- Minimap ----------
  function drawMinimap() {
    const w = mini.width, h = mini.height;
    const sxm = w / MAP_W, sym = h / MAP_H;
    mctx.clearRect(0, 0, w, h);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = state.map[y][x];
        let c = '#4f9d4f';
        if (t === T.WATER) c = '#2a6f97';
        else if (t === T.BUILDING) c = '#525a66';
        else if (t === T.STREET) c = '#3a3a40';
        else if (t === T.BRIDGE) c = '#c1440e';
        else if (t === T.SAND) c = '#d9c79a';
        else if (t === T.PIER) c = '#8a5a2b';
        mctx.fillStyle = c;
        mctx.fillRect(x * sxm, y * sym, Math.ceil(sxm), Math.ceil(sym));
      }
    }
    for (const lm of LANDMARKS) {
      mctx.fillStyle = state.photos.has(lm.key) ? '#f2c14e' : '#fff';
      mctx.beginPath(); mctx.arc(lm.x * sxm, lm.y * sym, 2, 0, Math.PI * 2); mctx.fill();
    }
    // panda
    mctx.fillStyle = '#fff';
    mctx.beginPath(); mctx.arc(state.panda.px / TILE * sxm, state.panda.py / TILE * sym, 2.5, 0, Math.PI * 2); mctx.fill();
    mctx.fillStyle = '#1a1a1a';
    mctx.beginPath(); mctx.arc(state.panda.px / TILE * sxm, state.panda.py / TILE * sym, 1.2, 0, Math.PI * 2); mctx.fill();
  }

  // ---------- HUD ----------
  function updateHUD() {
    ui.energy.textContent = 'Energy: ' + Math.max(0, Math.round(state.energy));
    ui.bamboo.textContent = 'Bamboo: ' + state.bamboo;
    ui.photos.textContent = 'Photos: ' + state.photos.size + '/' + LANDMARKS.length;
    ui.score.textContent = 'Score: ' + state.score;
  }

  // ---------- Toast ----------
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.remove('hidden');
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      ui.toast.classList.remove('show');
      setTimeout(() => ui.toast.classList.add('hidden'), 300);
    }, 2200);
  }

  // ---------- Win overlay + scoreboard ----------
  function showOverlay(won) {
    ui.overlay.classList.remove('hidden');
    ui.ovTitle.textContent = won ? 'Postcards Complete!' : 'Submit your score';
    ui.ovBody.textContent = 'Score: ' + state.score + '  -  Photos: ' + state.photos.size + '/8  -  Bamboo: ' + state.bamboo;
    ui.ovName.value = '';
    ui.ovName.focus();
  }

  function submitScore() {
    const name = (ui.ovName.value || '').trim().slice(0, 32) || 'Anonymous';
    const body = { name, score: state.score, level: state.photos.size, won: state.won };
    fetch('/api/scoreboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.entry) lastToken = d.entry.token;
        if (d && d.top) renderScoreboard(d.top);
        ui.overlay.classList.add('hidden');
        newGame();
      })
      .catch(() => { ui.overlay.classList.add('hidden'); });
  }

  function fetchScoreboard() {
    fetch('/api/scoreboard').then((r) => r.json()).then((d) => {
      if (d && d.top) renderScoreboard(d.top);
    }).catch(() => {});
  }

  function renderScoreboard(top) {
    const ol = ui.scoreboard;
    ol.innerHTML = '';
    if (!top.length) {
      const li = document.createElement('li');
      li.className = 'empty'; li.textContent = 'No scores yet — be the first!';
      ol.appendChild(li); return;
    }
    top.forEach((e) => {
      const li = document.createElement('li');
      if (e.token && e.token === lastToken) li.className = 'me';
      const won = e.won ? ' *' : '';
      li.innerHTML = e.name + ' <small>' + e.score + 'pts' + won + '</small>';
      ol.appendChild(li);
    });
  }

  // ---------- Main loop ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state) {
      update(dt);
      render();
      drawMinimap();
    }
    requestAnimationFrame(loop);
  }

  if (ui.music) ui.music.textContent = 'Music: ' + (Music.isMuted() ? 'Off' : 'On');

  function boot() {
    newGame();
    canvas.focus();
    last = performance.now();
    requestAnimationFrame(loop);
  }
  if (window.Characters && !Characters.hasChoice()) {
    Characters.open(boot);
  } else {
    boot();
  }
})();