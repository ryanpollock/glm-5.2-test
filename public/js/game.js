// Panda's City Tour — client game engine
// Top-down cozy explorer: a panda photographs landmarks across 4 cities.

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
    city: document.getElementById('city'),
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

  // ---------- Map helpers ----------
  function newMap() { return Array.from({ length: MAP_H }, () => Array(MAP_W).fill(T.GRASS)); }
  function fillM(m, x0, x1, y0, y1, t) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) m[y][x] = t; } }
  function setM(m, x, y, t) { if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) m[y][x] = t; }

  // ---------- SF map ----------
  function buildSFMap() {
    const m = newMap();
    fillM(m, 0, 2, 0, MAP_H - 1, T.WATER);
    fillM(m, 34, MAP_W - 1, 0, MAP_H - 1, T.WATER);
    fillM(m, 0, 33, 0, 1, T.WATER);
    fillM(m, 12, 23, 1, 1, T.BRIDGE);
    fillM(m, 33, 37, 4, 4, T.PIER);
    fillM(m, 35, 36, 7, 8, T.SAND);
    for (const y of [5, 9, 13, 17, 21, 25]) fillM(m, 3, 33, y, y, T.STREET);
    for (const x of [8, 14, 20, 24, 30]) fillM(m, x, x, 2, 28, T.STREET);
    fillM(m, 26, 33, 12, 17, T.BUILDING);
    fillM(m, 26, 33, 13, 13, T.STREET); fillM(m, 26, 33, 17, 17, T.STREET); fillM(m, 30, 30, 12, 17, T.STREET);
    fillM(m, 20, 25, 11, 11, T.BUILDING); fillM(m, 20, 25, 14, 14, T.BUILDING);
    fillM(m, 20, 20, 12, 13, T.BUILDING); fillM(m, 25, 25, 12, 13, T.BUILDING);
    fillM(m, 22, 23, 12, 13, T.STREET); fillM(m, 22, 23, 11, 11, T.STREET); fillM(m, 22, 23, 14, 14, T.STREET);
    fillM(m, 7, 12, 11, 11, T.BUILDING);
    const L = T.STREET;
    setM(m, 22, 9, L); setM(m, 23, 9, L); setM(m, 23, 8, L); setM(m, 24, 8, L);
    setM(m, 24, 7, L); setM(m, 25, 7, L); setM(m, 25, 8, L); setM(m, 26, 8, L);
    setM(m, 5, 22, T.BUILDING); setM(m, 15, 18, T.BUILDING); setM(m, 6, 19, T.BUILDING); setM(m, 14, 22, T.BUILDING);
    return m;
  }
  function setupSF(s) {
    s.bamboos = [[6,20],[8,19],[10,21],[12,20],[11,18],[13,22],[5,21],[9,22],[7,18],[14,21],[5,4],[8,5],[10,4],[6,6]]
      .map(([x,y]) => ({ x, y, taken: false, bob: Math.random()*Math.PI*2 })).filter((b) => !isSolidTile(s.map[b.y][b.x]));
    s.cars = [{ x: 24, y: 4, dir: 1, t: 0 }, { x: 24, y: 14, dir: -1, t: 0.5 }];
    s.gulls = [{ x: 32, y: 3, baseX: 32, baseY: 3, t: Math.random()*6 }, { x: 35, y: 5, baseX: 35, baseY: 5, t: Math.random()*6 }, { x: 30, y: 4, baseX: 30, baseY: 4, t: Math.random()*6 }];
    s.tourists = [{ x: 22, y: 13, dx: 0, dy: 0, t: 0 }, { x: 23, y: 12, dx: 0, dy: 0, t: 1.2 }, { x: 21, y: 13, dx: 0, dy: 0, t: 2.4 }];
    s.fog = [];
    for (let i = 0; i < 14; i++) s.fog.push({ x: 34+Math.random()*6, y: Math.random()*MAP_H, vx: -0.05-Math.random()*0.05, a: 0.05+Math.random()*0.08 });
  }

  // ---------- Buffalo map ----------
  function buildBuffaloMap() {
    const m = newMap();
    // Lake Erie on the west
    fillM(m, 0, 2, 0, MAP_H - 1, T.WATER);
    // Buffalo River / canal
    fillM(m, 3, 8, 15, 16, T.WATER);
    fillM(m, 3, 3, 14, 17, T.WATER);
    // Canalside pier
    fillM(m, 2, 6, 15, 15, T.PIER);
    // Street grid
    for (const y of [4, 8, 12, 18, 22, 26]) fillM(m, 3, 35, y, y, T.STREET);
    for (const x of [8, 14, 20, 26, 32]) fillM(m, x, x, 2, 28, T.STREET);
    // Downtown
    fillM(m, 15, 22, 7, 11, T.BUILDING);
    fillM(m, 15, 22, 8, 8, T.STREET); fillM(m, 15, 22, 11, 11, T.STREET);
    fillM(m, 20, 20, 7, 11, T.STREET);
    // Central Terminal area (east)
    fillM(m, 30, 34, 6, 10, T.BUILDING);
    fillM(m, 30, 34, 8, 8, T.STREET);
    // Zoo area (south)
    fillM(m, 25, 31, 23, 27, T.BUILDING);
    fillM(m, 25, 31, 25, 25, T.STREET);
    // Delaware Park trees
    setM(m, 5, 24, T.BUILDING); setM(m, 14, 22, T.BUILDING); setM(m, 7, 26, T.BUILDING); setM(m, 12, 25, T.BUILDING);
    return m;
  }
  function setupBuffalo(s) {
    s.bamboos = [[8,22],[10,23],[12,24],[9,25],[11,22],[7,24],[13,25],[10,26],[16,22],[28,22],[30,23]]
      .map(([x,y]) => ({ x, y, taken: false, bob: Math.random()*Math.PI*2 })).filter((b) => !isSolidTile(s.map[b.y][b.x]));
    s.cars = [{ x: 20, y: 4, dir: 1, t: 0 }, { x: 20, y: 14, dir: -1, t: 0.5 }];
    s.gulls = [{ x: 4, y: 14, baseX: 4, baseY: 14, t: Math.random()*6 }, { x: 6, y: 16, baseX: 6, baseY: 16, t: Math.random()*6 }];
    s.tourists = [{ x: 18, y: 9, dx: 0, dy: 0, t: 0 }, { x: 20, y: 10, dx: 0, dy: 0, t: 1.5 }, { x: 17, y: 10, dx: 0, dy: 0, t: 3 }];
    s.fog = [];
    for (let i = 0; i < 10; i++) s.fog.push({ x: Math.random()*3, y: Math.random()*MAP_H, vx: 0.04+Math.random()*0.04, a: 0.05+Math.random()*0.08 });
  }

  // ---------- Chicago map ----------
  function buildChicagoMap() {
    const m = newMap();
    // Lake Michigan on the east
    fillM(m, 34, MAP_W - 1, 0, MAP_H - 1, T.WATER);
    // Chicago River (horizontal)
    fillM(m, 3, 33, 14, 15, T.WATER);
    // Navy Pier into the lake
    fillM(m, 33, 38, 5, 5, T.PIER);
    // Street grid
    for (const y of [4, 8, 12, 18, 22, 26]) fillM(m, 3, 33, y, y, T.STREET);
    for (const x of [8, 14, 20, 26, 30]) fillM(m, x, x, 2, 28, T.STREET);
    // The Loop / downtown
    fillM(m, 15, 24, 9, 13, T.BUILDING);
    fillM(m, 15, 24, 10, 10, T.STREET); fillM(m, 15, 24, 13, 13, T.STREET);
    fillM(m, 20, 20, 9, 13, T.STREET);
    // Wrigley Field area (north)
    fillM(m, 8, 12, 3, 5, T.BUILDING);
    fillM(m, 8, 12, 4, 4, T.STREET);
    // Millennium Park (open grass, not buildings)
    // South side residential
    fillM(m, 5, 10, 22, 26, T.BUILDING);
    fillM(m, 5, 10, 24, 24, T.STREET);
    // Park trees
    setM(m, 25, 20, T.BUILDING); setM(m, 28, 24, T.BUILDING); setM(m, 30, 22, T.BUILDING);
    return m;
  }
  function setupChicago(s) {
    s.bamboos = [[11,9],[13,8],[10,7],[12,10],[25,20],[28,22],[30,20],[8,22],[10,24],[22,22]]
      .map(([x,y]) => ({ x, y, taken: false, bob: Math.random()*Math.PI*2 })).filter((b) => !isSolidTile(s.map[b.y][b.x]));
    s.cars = [{ x: 5, y: 18, dir: 1, t: 0 }, { x: 18, y: 18, dir: -1, t: 0.5 }];
    s.gulls = [{ x: 35, y: 4, baseX: 35, baseY: 4, t: Math.random()*6 }, { x: 37, y: 6, baseX: 37, baseY: 6, t: Math.random()*6 }, { x: 33, y: 5, baseX: 33, baseY: 5, t: Math.random()*6 }];
    s.tourists = [{ x: 18, y: 11, dx: 0, dy: 0, t: 0 }, { x: 20, y: 12, dx: 0, dy: 0, t: 1.5 }, { x: 16, y: 10, dx: 0, dy: 0, t: 3 }];
    s.fog = [];
    for (let i = 0; i < 12; i++) s.fog.push({ x: 34+Math.random()*6, y: Math.random()*MAP_H, vx: -0.05-Math.random()*0.05, a: 0.05+Math.random()*0.08 });
  }

  // ---------- Cleveland map ----------
  function buildClevelandMap() {
    const m = newMap();
    // Lake Erie on the north
    fillM(m, 0, MAP_W - 1, 0, 1, T.WATER);
    // Cuyahoga River (vertical)
    fillM(m, 12, 13, 2, 20, T.WATER);
    // Street grid
    for (const y of [4, 8, 12, 16, 20, 24]) fillM(m, 3, 35, y, y, T.STREET);
    for (const x of [6, 10, 16, 22, 28, 32]) fillM(m, x, x, 2, 28, T.STREET);
    // Downtown
    fillM(m, 16, 24, 8, 14, T.BUILDING);
    fillM(m, 16, 24, 10, 10, T.STREET); fillM(m, 16, 24, 14, 14, T.STREET);
    fillM(m, 20, 20, 8, 14, T.STREET);
    // West Side Market area
    fillM(m, 6, 10, 11, 13, T.BUILDING);
    fillM(m, 6, 10, 12, 12, T.STREET);
    // Edgewater Park (open grass)
    // Zoo area (south)
    fillM(m, 22, 28, 23, 27, T.BUILDING);
    fillM(m, 22, 28, 25, 25, T.STREET);
    // Park trees
    setM(m, 4, 6, T.BUILDING); setM(m, 7, 3, T.BUILDING); setM(m, 30, 20, T.BUILDING); setM(m, 33, 22, T.BUILDING);
    return m;
  }
  function setupCleveland(s) {
    s.bamboos = [[4,5],[6,6],[5,4],[3,5],[7,4],[24,20],[26,22],[28,20],[30,24],[32,22],[18,22],[20,24]]
      .map(([x,y]) => ({ x, y, taken: false, bob: Math.random()*Math.PI*2 })).filter((b) => !isSolidTile(s.map[b.y][b.x]));
    s.cars = [{ x: 22, y: 5, dir: 1, t: 0 }, { x: 22, y: 16, dir: -1, t: 0.5 }];
    s.gulls = [{ x: 18, y: 2, baseX: 18, baseY: 2, t: Math.random()*6 }, { x: 22, y: 3, baseX: 22, baseY: 3, t: Math.random()*6 }, { x: 25, y: 2, baseX: 25, baseY: 2, t: Math.random()*6 }];
    s.tourists = [{ x: 18, y: 10, dx: 0, dy: 0, t: 0 }, { x: 20, y: 12, dx: 0, dy: 0, t: 1.5 }, { x: 22, y: 11, dx: 0, dy: 0, t: 3 }];
    s.fog = [];
    for (let i = 0; i < 10; i++) s.fog.push({ x: Math.random()*MAP_W, y: Math.random()*2, vx: -0.03+Math.random()*0.06, a: 0.05+Math.random()*0.08 });
  }

  // ---------- Cities ----------
  const CITIES = [
    {
      name: 'San Francisco', vehicleName: 'cable car', vehicleType: 'cablecar', vehicleColor: '#c1440e',
      landmarks: [
        { key: 'bridge',  name: 'Golden Gate Bridge', x: 18, y: 1, color: '#c1440e' },
        { key: 'wharf',   name: "Fisherman's Wharf",  x: 31, y: 4, color: '#d98a3d' },
        { key: 'alcatraz',name: 'Alcatraz',           x: 36, y: 8, color: '#9aa6b2' },
        { key: 'coit',    name: 'Coit Tower',         x: 28, y: 6, color: '#e8e6dd' },
        { key: 'lombard', name: 'Lombard Street',     x: 24, y: 8, color: '#7cc36a' },
        { key: 'ladies',  name: 'Painted Ladies',     x: 10, y: 13, color: '#e07a9b' },
        { key: 'china',   name: 'Chinatown',          x: 22, y: 12, color: '#d4362f' },
        { key: 'park',    name: 'Golden Gate Park',   x: 9,  y: 20, color: '#4f9d4f' },
      ],
      napSpots: [{ x: 9, y: 20 }, { x: 13, y: 20 }],
      vehicleStops: [{ x: 24, y: 4, label: 'North Beach' }, { x: 24, y: 20, label: 'GG Park' }],
      ferry: { a: { x: 37, y: 4 }, b: { x: 36, y: 8 }, labelA: 'Wharf', labelB: 'Alcatraz' },
      carTrack: { axis: 'y', fixed: 24, min: 4, max: 20, speed: 1.6 },
      touristBounds: { minX: 20, maxX: 26, minY: 11, maxY: 15 },
      fogArea: { min: 34, max: 39, drift: -1 },
      pandaStart: { x: 9, y: 21 }, lastNap: { x: 9, y: 20 },
      welcomeToast: 'Welcome to San Francisco! Photograph all 8 landmarks.',
      buildMap: buildSFMap, setup: setupSF,
    },
    {
      name: 'Buffalo', vehicleName: 'Metro Rail', vehicleType: 'metrorail', vehicleColor: '#3a7fd4',
      landmarks: [
        { key: 'bf_cityhall', name: 'Buffalo City Hall', x: 18, y: 8, color: '#d4b888' },
        { key: 'bf_park',     name: 'Delaware Park',     x: 10, y: 22, color: '#4f9d4f' },
        { key: 'bf_canal',    name: 'Canalside',         x: 5,  y: 14, color: '#2a6f97' },
        { key: 'bf_terminal', name: 'Central Terminal',  x: 32, y: 8, color: '#8a5a2b' },
        { key: 'bf_zoo',      name: 'Buffalo Zoo',       x: 28, y: 24, color: '#5cb85c' },
      ],
      napSpots: [{ x: 10, y: 22 }, { x: 12, y: 24 }],
      vehicleStops: [{ x: 20, y: 4, label: 'North Buffalo' }, { x: 20, y: 24, label: 'South Buffalo' }],
      ferry: null,
      carTrack: { axis: 'y', fixed: 20, min: 4, max: 24, speed: 1.6 },
      touristBounds: { minX: 15, maxX: 22, minY: 7, maxY: 11 },
      fogArea: { min: 0, max: 3, drift: 1 },
      pandaStart: { x: 10, y: 22 }, lastNap: { x: 10, y: 22 },
      welcomeToast: 'Welcome to Buffalo! Photograph all 5 landmarks.',
      buildMap: buildBuffaloMap, setup: setupBuffalo,
    },
    {
      name: 'Chicago', vehicleName: 'L train', vehicleType: 'ltrain', vehicleColor: '#5cb85c',
      landmarks: [
        { key: 'chi_willis',   name: 'Willis Tower',      x: 18, y: 11, color: '#3a3a40' },
        { key: 'chi_bean',     name: 'Cloud Gate',        x: 12, y: 9,  color: '#c0c0c0' },
        { key: 'chi_pier',     name: 'Navy Pier',         x: 37, y: 5,  color: '#d98a3d' },
        { key: 'chi_fountain',  name: 'Buckingham Fountain', x: 20, y: 7, color: '#5fb3d4' },
        { key: 'chi_wrigley',   name: 'Wrigley Field',     x: 10, y: 4,  color: '#4f9d4f' },
      ],
      napSpots: [{ x: 12, y: 9 }, { x: 25, y: 22 }],
      vehicleStops: [{ x: 5, y: 18, label: 'West Side' }, { x: 30, y: 18, label: 'East Side' }],
      ferry: { a: { x: 33, y: 5 }, b: { x: 37, y: 5 }, labelA: 'Lakeshore', labelB: 'Navy Pier' },
      carTrack: { axis: 'x', fixed: 18, min: 5, max: 30, speed: 1.6 },
      touristBounds: { minX: 15, maxX: 22, minY: 9, maxY: 13 },
      fogArea: { min: 34, max: 39, drift: -1 },
      pandaStart: { x: 12, y: 9 }, lastNap: { x: 12, y: 9 },
      welcomeToast: 'Welcome to Chicago! Photograph all 5 landmarks.',
      buildMap: buildChicagoMap, setup: setupChicago,
    },
    {
      name: 'Cleveland', vehicleName: 'RTA Rapid', vehicleType: 'rapid', vehicleColor: '#d4362f',
      landmarks: [
        { key: 'cle_rock',    name: 'Rock & Roll Hall of Fame', x: 22, y: 2,  color: '#9aa6b2' },
        { key: 'cle_market',  name: 'West Side Market',          x: 8,  y: 12, color: '#d4b888' },
        { key: 'cle_terminal', name: 'Terminal Tower',           x: 18, y: 10, color: '#3a3a40' },
        { key: 'cle_edgewater',name: 'Edgewater Park',           x: 5,  y: 4,  color: '#4f9d4f' },
        { key: 'cle_zoo',     name: 'Cleveland Zoo',             x: 25, y: 24, color: '#5cb85c' },
      ],
      napSpots: [{ x: 5, y: 4 }, { x: 22, y: 22 }],
      vehicleStops: [{ x: 22, y: 5, label: 'Downtown' }, { x: 22, y: 25, label: 'South Side' }],
      ferry: null,
      carTrack: { axis: 'y', fixed: 22, min: 5, max: 25, speed: 1.6 },
      touristBounds: { minX: 16, maxX: 24, minY: 8, maxY: 14 },
      fogArea: { min: 0, max: 39, drift: 0 },
      pandaStart: { x: 5, y: 4 }, lastNap: { x: 5, y: 4 },
      welcomeToast: 'Welcome to Cleveland! Photograph all 5 landmarks.',
      buildMap: buildClevelandMap, setup: setupCleveland,
    },
  ];

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
    state = {
      level: 0,
      city: null,
      map: null,
      panda: { px: 0, py: 0, facing: 1, phase: 0, moving: false, daze: 0 },
      energy: 20, maxEnergy: 20,
      bamboo: 0,
      photos: new Set(),
      score: 0,
      won: false,
      napping: 0,
      invuln: 0,
      camX: 0, camY: 0,
      keys: new Set(),
      time: 0,
      lastNap: { x: 0, y: 0 },
      bamboos: [], cars: [], gulls: [], tourists: [], fog: [],
      toastShown: new Set(),
    };
    loadCity(0);
    ui.restart.textContent = 'Restart';
    fetchScoreboard();
  }

  function loadCity(level) {
    const city = CITIES[level];
    state.level = level;
    state.city = city;
    state.map = city.buildMap();
    state.photos = new Set();
    state.energy = state.maxEnergy;
    state.napping = 0;
    state.invuln = 0;
    state.panda.px = city.pandaStart.x * TILE + 16;
    state.panda.py = city.pandaStart.y * TILE + 16;
    state.panda.facing = 1;
    state.panda.moving = false;
    state.panda.daze = 0;
    state.lastNap = { x: city.lastNap.x, y: city.lastNap.y };
    city.setup(state);
    centerCamera();
    toast(city.welcomeToast);
  }

  function advanceLevel() {
    if (state.level < CITIES.length - 1) {
      const next = CITIES[state.level + 1];
      toast('Level complete! Next: ' + next.name);
      setTimeout(() => loadCity(state.level + 1), 1200);
    } else {
      state.won = true;
      state.score += 200 + state.energy * 2;
      setTimeout(() => showOverlay(true), 700);
    }
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
    Characters.open(() => { updateTitle(); newGame(); canvas.focus(); });
  });

  // ---------- Actions ----------
  function nearestLandmark() {
    const p = state.panda;
    let best = null, bd = INTERACT;
    for (const lm of state.city.landmarks) {
      if (state.photos.has(lm.key)) continue;
      const d = Math.hypot(lm.x * TILE + 16 - p.px, lm.y * TILE + 16 - p.py);
      if (d < bd) { bd = d; best = lm; }
    }
    return best;
  }
  function nearestNap() {
    const p = state.panda;
    let best = null, bd = TILE * 1.1;
    for (const n of state.city.napSpots) {
      const d = Math.hypot(n.x * TILE + 16 - p.px, n.y * TILE + 16 - p.py);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  function nearestStop() {
    const p = state.panda;
    let best = null, bd = TILE * 1.2;
    for (const s of state.city.vehicleStops) {
      const d = Math.hypot(s.x * TILE + 16 - p.px, s.y * TILE + 16 - p.py);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  function nearFerry() {
    if (!state.city.ferry) return false;
    const p = state.panda;
    const a = Math.hypot(state.city.ferry.a.x * TILE + 16 - p.px, state.city.ferry.a.y * TILE + 16 - p.py) < TILE * 1.3;
    const b = Math.hypot(state.city.ferry.b.x * TILE + 16 - p.px, state.city.ferry.b.y * TILE + 16 - p.py) < TILE * 1.3;
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
    if (stop) { rideVehicle(stop); return; }

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
    const total = state.city.landmarks.length;
    toast('Photographed ' + lm.name + '!  (' + n + '/' + total + ')');
    if (state.photos.size >= total) {
      state.score += 50 * total;
      advanceLevel();
    }
  }

  function startNap(nap) {
    state.napping = 1.6;
    state.energy = state.maxEnergy;
    state.lastNap = { x: nap.x, y: nap.y };
    toast('Nap time! Energy restored.');
  }

  function rideVehicle(stop) {
    const other = state.city.vehicleStops.find((s) => s !== stop);
    state.panda.px = other.x * TILE + 16;
    state.panda.py = other.y * TILE + 16;
    centerCamera();
    toast('Riding the ' + state.city.vehicleName + ' to ' + other.label + '!');
  }

  function rideFerry() {
    const p = state.panda;
    const f = state.city.ferry;
    const atA = Math.hypot(f.a.x * TILE + 16 - p.px, f.a.y * TILE + 16 - p.py) < TILE * 1.4;
    const dest = atA ? f.b : f.a;
    p.px = dest.x * TILE + 16;
    p.py = dest.y * TILE + 16;
    centerCamera();
    toast(atA ? 'Ferry to ' + f.labelB + '!' : 'Ferry to ' + f.labelA + '!');
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
    const track = state.city.carTrack;
    for (const c of state.cars) {
      c.t += dt;
      if (track.axis === 'y') {
        c.y += c.dir * track.speed * dt;
        if (c.y >= track.max) { c.y = track.max; c.dir = -1; }
        if (c.y <= track.min) { c.y = track.min; c.dir = 1; }
      } else {
        c.x += c.dir * track.speed * dt;
        if (c.x >= track.max) { c.x = track.max; c.dir = -1; }
        if (c.x <= track.min) { c.x = track.min; c.dir = 1; }
      }
    }
    for (const g of state.gulls) {
      g.t += dt;
      g.x = g.baseX + Math.sin(g.t * 1.3) * 3.2;
      g.y = g.baseY + Math.cos(g.t * 0.9) * 1.6;
    }
    const tb = state.city.touristBounds;
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
      if (nx >= tb.minX && nx <= tb.maxX) tr.x = nx;
      if (ny >= tb.minY && ny <= tb.maxY) tr.y = ny;
    }
    const fa = state.city.fogArea;
    for (const f of state.fog) {
      f.x += f.vx * dt * 4;
      f.y += Math.sin(state.time * 0.3 + f.x) * 0.002;
      if (fa.drift < 0 && f.x < fa.min) { f.x = fa.max; f.y = Math.random() * MAP_H; }
      if (fa.drift > 0 && f.x > fa.max) { f.x = fa.min; f.y = Math.random() * MAP_H; }
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
    toast(state.city.vehicleName.charAt(0).toUpperCase() + state.city.vehicleName.slice(1) + ' collision! Oof.');
    if (state.energy <= 0) tuckerOut();
  }

  function tuckerOut() {
    const n = state.lastNap;
    state.panda.px = n.x * TILE + 16;
    state.panda.py = n.y * TILE + 16;
    state.energy = state.maxEnergy;
    state.invuln = 1.0;
    centerCamera();
    toast("Tuckered out! Napping back at the last nap spot.");
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
    for (const lm of state.city.landmarks) {
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
      // ===== Buffalo landmarks =====
      case 'bf_cityhall': {
        // Art Deco City Hall tower
        ctx.fillStyle = '#d4b888'; ctx.fillRect(px - 12, py - 40, 24, 48);
        ctx.fillStyle = '#c4a878'; ctx.fillRect(px - 12, py - 40, 24, 4);
        ctx.fillStyle = '#a89060'; ctx.fillRect(px - 2, py - 48, 4, 10);
        ctx.fillStyle = '#d4b888'; ctx.fillRect(px - 5, py - 50, 10, 4);
        ctx.fillStyle = '#e8d0a0'; ctx.fillRect(px - 4, py - 54, 8, 6);
        ctx.fillStyle = '#c4a878'; for (let i = -2; i <= 2; i++) ctx.fillRect(px + i * 4 - 1, py - 30, 2, 8);
        ctx.fillStyle = '#8a7050'; ctx.fillRect(px - 14, py + 6, 28, 4);
        break;
      }
      case 'bf_park': {
        // Delaware Park — pond + trees
        ctx.fillStyle = '#4a8ec4'; ctx.beginPath(); ctx.ellipse(px, py + 8, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6ba0d4'; ctx.beginPath(); ctx.ellipse(px - 4, py + 6, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
        for (const tx of [-14, 0, 14]) {
          ctx.fillStyle = '#5a3a2a'; ctx.fillRect(px + tx - 1, py - 4, 3, 10);
          ctx.fillStyle = '#4f9d4f'; ctx.beginPath(); ctx.arc(px + tx, py - 8, 8, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'bf_canal': {
        // Canalside waterfront
        ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px - 20, py, 40, 12);
        ctx.fillStyle = '#6f4720'; ctx.fillRect(px - 20, py, 40, 3);
        ctx.fillStyle = '#2a6f97'; ctx.fillRect(px - 20, py + 12, 40, 6);
        ctx.fillStyle = '#d98a3d'; ctx.fillRect(px - 6, py - 14, 12, 14);
        ctx.fillStyle = '#fff'; ctx.fillRect(px - 4, py - 12, 3, 3); ctx.fillRect(px + 1, py - 12, 3, 3);
        ctx.fillStyle = '#3a3a40'; ctx.fillRect(px - 1, py - 18, 2, 6);
        break;
      }
      case 'bf_terminal': {
        // Central Terminal — train station
        ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px - 18, py - 10, 36, 20);
        ctx.fillStyle = '#6f4720'; ctx.fillRect(px - 18, py - 10, 36, 4);
        ctx.fillStyle = '#a87838'; ctx.fillRect(px - 3, py - 24, 6, 16);
        ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(px, py - 20, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a3a40'; ctx.fillRect(px - 14, py - 4, 6, 6); ctx.fillRect(px + 8, py - 4, 6, 6);
        ctx.fillStyle = '#5a5a64'; ctx.fillRect(px - 22, py + 8, 44, 4);
        break;
      }
      case 'bf_zoo': {
        // Buffalo Zoo entrance
        ctx.fillStyle = '#5cb85c'; ctx.fillRect(px - 16, py - 6, 32, 16);
        ctx.fillStyle = '#3a7d3a'; ctx.fillRect(px - 16, py - 6, 32, 3);
        ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px - 14, py - 2, 4, 12); ctx.fillRect(px + 10, py - 2, 4, 12);
        ctx.fillStyle = '#f2c14e'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('ZOO', px, py + 6);
        ctx.fillStyle = '#7a4a3a'; ctx.beginPath(); ctx.arc(px - 8, py - 10, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a3a30'; ctx.fillRect(px - 10, py - 12, 2, 2); ctx.fillRect(px - 6, py - 12, 2, 2);
        break;
      }
      // ===== Chicago landmarks =====
      case 'chi_willis': {
        // Willis Tower — tall dark skyscraper
        ctx.fillStyle = '#3a3a40'; ctx.fillRect(px - 10, py - 54, 20, 60);
        ctx.fillStyle = '#4a4a50'; ctx.fillRect(px - 10, py - 54, 20, 2);
        ctx.fillStyle = '#5a5a64'; ctx.fillRect(px - 8, py - 56, 16, 4);
        ctx.fillStyle = '#2a2a30'; ctx.fillRect(px - 2, py - 60, 4, 6);
        for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) {
          ctx.fillStyle = '#7a8a9a'; ctx.fillRect(px - 7 + c * 6, py - 48 + r * 8, 4, 4);
        }
        break;
      }
      case 'chi_bean': {
        // Cloud Gate — mirrored bean
        ctx.fillStyle = '#c0c0c0'; ctx.beginPath(); ctx.ellipse(px, py + 4, 18, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d0d0d0'; ctx.beginPath(); ctx.ellipse(px - 4, py + 2, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a0a0a0'; ctx.beginPath(); ctx.ellipse(px, py - 4, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e0e0e0'; ctx.fillRect(px - 2, py - 2, 4, 2);
        ctx.fillStyle = '#909090'; ctx.beginPath(); ctx.ellipse(px, py + 12, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'chi_pier': {
        // Navy Pier — pier with ferris wheel
        ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px - 4, py, 30, 10);
        ctx.fillStyle = '#6f4720'; ctx.fillRect(px - 4, py, 30, 3);
        // Ferris wheel
        ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px - 8, py - 18, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#d98a3d';
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.arc(px - 8 + Math.cos(a) * 12, py - 18 + Math.sin(a) * 12, 2.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = '#5a5a64'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(px - 8, py - 18); ctx.lineTo(px - 8 + Math.cos(a) * 12, py - 18 + Math.sin(a) * 12); ctx.stroke(); }
        ctx.fillStyle = '#3a3a40'; ctx.fillRect(px - 10, py - 6, 4, 8);
        break;
      }
      case 'chi_fountain': {
        // Buckingham Fountain — multi-tier
        ctx.fillStyle = '#5fb3d4'; ctx.beginPath(); ctx.ellipse(px, py + 8, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a90b4'; ctx.beginPath(); ctx.ellipse(px, py + 8, 20, 8, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#9accd4'; ctx.beginPath(); ctx.ellipse(px, py + 6, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5fb3d4'; ctx.beginPath(); ctx.ellipse(px, py, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
        // water jets
        ctx.strokeStyle = '#b0e0e8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 8, py - 14); ctx.moveTo(px, py); ctx.lineTo(px + 8, py - 14); ctx.moveTo(px, py); ctx.lineTo(px, py - 18); ctx.stroke();
        ctx.fillStyle = '#d0e8ec'; ctx.beginPath(); ctx.arc(px - 8, py - 14, 2, 0, Math.PI * 2); ctx.arc(px + 8, py - 14, 2, 0, Math.PI * 2); ctx.arc(px, py - 18, 2.5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'chi_wrigley': {
        // Wrigley Field — stadium
        ctx.fillStyle = '#4f9d4f'; ctx.fillRect(px - 18, py - 4, 36, 16);
        ctx.fillStyle = '#3a7d3a'; ctx.fillRect(px - 18, py - 4, 36, 2);
        ctx.fillStyle = '#c4a060'; ctx.fillRect(px - 18, py - 12, 36, 8);
        ctx.fillStyle = '#8a7050'; ctx.fillRect(px - 18, py - 12, 36, 2);
        ctx.fillStyle = '#3a3a40';
        for (let i = -2; i <= 2; i++) ctx.fillRect(px + i * 6 - 1, py - 10, 2, 6);
        ctx.fillStyle = '#f2c14e'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('WRIGLEY', px, py + 6);
        break;
      }
      // ===== Cleveland landmarks =====
      case 'cle_rock': {
        // Rock & Roll Hall of Fame — glass pyramid
        ctx.fillStyle = '#9aa6b2'; ctx.fillRect(px - 14, py, 28, 12);
        ctx.fillStyle = '#c0d0e0'; ctx.beginPath(); ctx.moveTo(px, py - 28); ctx.lineTo(px - 16, py); ctx.lineTo(px + 16, py); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a0b0c8'; ctx.beginPath(); ctx.moveTo(px, py - 28); ctx.lineTo(px, py); ctx.lineTo(px - 16, py); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#d0e0f0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, py - 28); ctx.lineTo(px - 16, py); ctx.moveTo(px, py - 28); ctx.lineTo(px + 16, py); ctx.moveTo(px, py - 28); ctx.lineTo(px, py); ctx.stroke();
        ctx.fillStyle = '#e8e6dd'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('R&R', px, py - 6);
        break;
      }
      case 'cle_market': {
        // West Side Market — clock tower
        ctx.fillStyle = '#d4b888'; ctx.fillRect(px - 14, py - 8, 28, 16);
        ctx.fillStyle = '#c4a878'; ctx.fillRect(px - 14, py - 8, 28, 3);
        ctx.fillStyle = '#a89060'; ctx.fillRect(px - 3, py - 26, 6, 20);
        ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(px, py - 22, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a3a30'; ctx.fillRect(px - 1, py - 23, 1, 3); ctx.fillRect(px, py - 22, 3, 1);
        ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px - 10, py - 4, 4, 6); ctx.fillRect(px + 6, py - 4, 4, 6);
        ctx.fillStyle = '#6f4720'; ctx.fillRect(px - 16, py + 6, 32, 4);
        break;
      }
      case 'cle_terminal': {
        // Terminal Tower — skyscraper with crown
        ctx.fillStyle = '#3a3a40'; ctx.fillRect(px - 10, py - 44, 20, 50);
        ctx.fillStyle = '#4a4a50'; ctx.fillRect(px - 10, py - 44, 20, 3);
        ctx.fillStyle = '#5a5a64'; ctx.beginPath(); ctx.moveTo(px - 12, py - 44); ctx.lineTo(px, py - 54); ctx.lineTo(px + 12, py - 44); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2c14e'; ctx.fillRect(px - 1, py - 56, 2, 6);
        for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
          ctx.fillStyle = '#7a8a9a'; ctx.fillRect(px - 7 + c * 6, py - 38 + r * 7, 4, 4);
        }
        break;
      }
      case 'cle_edgewater': {
        // Edgewater Park — beach + trees
        ctx.fillStyle = '#d9c79a'; ctx.fillRect(px - 16, py + 4, 32, 8);
        ctx.fillStyle = '#2a6f97'; ctx.fillRect(px - 16, py + 10, 32, 4);
        for (const tx of [-10, 4, 14]) {
          ctx.fillStyle = '#5a3a2a'; ctx.fillRect(px + tx - 1, py - 2, 3, 8);
          ctx.fillStyle = '#4f9d4f'; ctx.beginPath(); ctx.arc(px + tx, py - 6, 7, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(px - 14, py - 8, 3, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'cle_zoo': {
        // Cleveland Zoo entrance
        ctx.fillStyle = '#5cb85c'; ctx.fillRect(px - 16, py - 6, 32, 16);
        ctx.fillStyle = '#3a7d3a'; ctx.fillRect(px - 16, py - 6, 32, 3);
        ctx.fillStyle = '#8a5a2b'; ctx.fillRect(px - 14, py - 2, 4, 12); ctx.fillRect(px + 10, py - 2, 4, 12);
        ctx.fillStyle = '#f2c14e'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('ZOO', px, py + 6);
        ctx.fillStyle = '#7a4a3a'; ctx.beginPath(); ctx.arc(px + 8, py - 10, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a3a30'; ctx.fillRect(px + 6, py - 12, 2, 2); ctx.fillRect(px + 10, py - 12, 2, 2);
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
    if (!state.city.ferry) return;
    const p = state.panda;
    const f = state.city.ferry;
    const atA = Math.hypot(f.a.x * TILE + 16 - p.px, f.a.y * TILE + 16 - p.py) < TILE * 1.4;
    const dest = atA ? f.a : f.b;
    const px = sx(dest.x * TILE + 16), py = sy(dest.y * TILE + 16);
    ctx.fillStyle = '#e07a9b'; ctx.fillRect(px - 12, py - 6, 24, 12);
    ctx.fillStyle = '#fff'; ctx.fillRect(px - 4, py - 12, 8, 8);
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(px - 3, py - 11, 2, 2); ctx.fillRect(px + 1, py - 11, 2, 2);
  }

  function drawCars() {
    const vtype = state.city.vehicleType;
    const vcol = state.city.vehicleColor;
    for (const c of state.cars) {
      const px = sx(c.x * TILE + 16), py = sy(c.y * TILE + 16);
      if (vtype === 'cablecar') {
        ctx.fillStyle = vcol; ctx.fillRect(px - 11, py - 8, 22, 16);
        ctx.fillStyle = '#f2c14e'; ctx.fillRect(px - 8, py - 5, 16, 5);
        ctx.fillStyle = '#fff'; ctx.fillRect(px - 9, py - 8, 2, 16); ctx.fillRect(px + 7, py - 8, 2, 16);
        ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.arc(px - 7, py + 8, 3, 0, Math.PI * 2); ctx.arc(px + 7, py + 8, 3, 0, Math.PI * 2); ctx.fill();
      } else if (vtype === 'metrorail') {
        ctx.fillStyle = '#c0c8d0'; ctx.fillRect(px - 13, py - 8, 26, 16);
        ctx.fillStyle = vcol; ctx.fillRect(px - 13, py - 8, 26, 4);
        ctx.fillStyle = '#3a5a7a'; ctx.fillRect(px - 10, py - 3, 6, 5); ctx.fillRect(px - 2, py - 3, 6, 5); ctx.fillRect(px + 5, py - 3, 6, 5);
        ctx.fillStyle = '#fff'; ctx.fillRect(px - 13, py + 6, 26, 2);
        ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.arc(px - 8, py + 8, 3, 0, Math.PI * 2); ctx.arc(px + 8, py + 8, 3, 0, Math.PI * 2); ctx.fill();
      } else if (vtype === 'ltrain') {
        ctx.fillStyle = vcol; ctx.fillRect(px - 14, py - 10, 28, 18);
        ctx.fillStyle = '#3a7d3a'; ctx.fillRect(px - 14, py - 10, 28, 3);
        ctx.fillStyle = '#fff'; ctx.fillRect(px - 11, py - 5, 7, 6); ctx.fillRect(px - 2, py - 5, 7, 6); ctx.fillRect(px + 7, py - 5, 5, 6);
        ctx.fillStyle = '#3a3a40'; ctx.fillRect(px - 14, py - 14, 2, 6); ctx.fillRect(px + 12, py - 14, 2, 6);
        ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(px - 9, py + 9, 3, 0, Math.PI * 2); ctx.arc(px + 9, py + 9, 3, 0, Math.PI * 2); ctx.fill();
      } else if (vtype === 'rapid') {
        ctx.fillStyle = vcol; ctx.fillRect(px - 13, py - 9, 26, 17);
        ctx.fillStyle = '#b03020'; ctx.fillRect(px - 13, py - 9, 26, 3);
        ctx.fillStyle = '#fff'; ctx.fillRect(px - 10, py - 4, 6, 5); ctx.fillRect(px - 1, py - 4, 6, 5); ctx.fillRect(px + 7, py - 4, 5, 5);
        ctx.fillStyle = '#f2c14e'; ctx.fillRect(px - 13, py + 4, 26, 2);
        ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.arc(px - 8, py + 8, 3, 0, Math.PI * 2); ctx.arc(px + 8, py + 8, 3, 0, Math.PI * 2); ctx.fill();
      }
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
    for (const lm of state.city.landmarks) {
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
    if (ui.city) ui.city.textContent = state.city.name + ' (Level ' + (state.level + 1) + '/' + CITIES.length + ')';
    ui.energy.textContent = 'Energy: ' + Math.max(0, Math.round(state.energy));
    ui.bamboo.textContent = 'Bamboo: ' + state.bamboo;
    ui.photos.textContent = 'Photos: ' + state.photos.size + '/' + state.city.landmarks.length;
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
    ui.ovTitle.textContent = won ? 'City Tour Complete!' : 'Submit your score';
    const cityNames = CITIES.map((c) => c.name);
    ui.ovBody.textContent = 'Score: ' + state.score + '  -  Reached: ' + state.city.name + ' (Level ' + (state.level + 1) + '/' + CITIES.length + ')  -  Bamboo: ' + state.bamboo;
    ui.ovName.value = '';
    ui.ovName.focus();
  }

  function submitScore() {
    const name = (ui.ovName.value || '').trim().slice(0, 32) || 'Anonymous';
    const body = { name, score: state.score, level: state.level + 1, won: state.won };
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

  function updateTitle() {
    const ch = window.Characters ? Characters.get() : null;
    const name = ch ? ch.name : 'Panda';
    const emoji = ch ? ch.emoji : '🐼';
    const title = emoji + ' ' + name + "'s City Tour";
    document.title = title;
    const h1 = document.getElementById('game-title');
    if (h1) h1.textContent = title;
  }

  function boot() {
    updateTitle();
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