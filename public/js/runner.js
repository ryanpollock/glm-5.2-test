// Panda Across the Bridge — a Phaser 3 side-scroller.
// SF rooftops -> a bamboo-reclaimed Bay Bridge -> finish flag.
// ALL art is hand-coded pixel art (no external image files).
// Robust to missing music: defensive shim prevents crashes.

(() => {
  'use strict';

  if (typeof Music === 'undefined') window.Music = {
    isMuted: () => true, start: () => {}, stop: () => {}, toggle: () => false,
    pluck: () => {}, jump: () => {}, hit: () => {}, shutter: () => {},
  };

  // ===== Config =====
  const W = 544, H = 544;
  const WORLD_W = 4400;
  const GROUND_Y = 470;
  const PIT_BOTTOM = 620;
  const GRAVITY = 1400;
  const MOVE = 230;
  const ACCEL = 1600;
  const FRICTION = 1400;
  const JUMP_V = -560;
  const JUMP_HOLD_GRAV = 700;
  const COYOTE = 0.10;
  const BUFFER = 0.12;
  const MAX_FALL = 900;
  const TS = 32; // tile size

  // ===== Palette =====
  const C = {
    W: '#f0f0f0',  w: '#c8c8c8',  B: '#1a1a1a',  g: '#2d2d2d',
    P: '#e89b9b',  e: '#e8e6dd',
    G1: '#4a9e4a', G2: '#2d6e2d', G3: '#6cc06c', G4: '#1a4a1a',
    R1: '#b5603a', R2: '#8a4a2a', Rm: '#d4b888',
    C1: '#c1440e', C2: '#9a3408',
    S1: '#9a9a9a', S2: '#6a6a6a', S3: '#7a7a7a',
    Y1: '#f2c14e', Y2: '#d49530',
    U1: '#2a6f97', U2: '#1e5573',
    K1: '#4a6a8a', K2: '#3a5a7a', K3: '#2a4a6a',
    T1: '#7fb8e0', T2: '#9bd2ee',
    N1: '#d4c8a0',
    F1: '#f2c14e', F2: '#e8a040',
    E1: '#d4756a', E2: '#b05040',
  };

  let game;

  const ui = {
    lives: document.getElementById('lives'),
    bamboo: document.getElementById('bamboo'),
    score: document.getElementById('score'),
    dist: document.getElementById('dist'),
    scoreboard: document.getElementById('scoreboard'),
    restart: document.getElementById('restart'),
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

  let toastTimer = null;
  function toast(msg) {
    if (!ui.toast) return;
    ui.toast.textContent = msg;
    ui.toast.classList.remove('hidden'); ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { ui.toast.classList.remove('show'); setTimeout(() => ui.toast.classList.add('hidden'), 300); }, 1800);
  }

  function showErr(msg) {
    const c = document.getElementById('game-container');
    if (c) c.innerHTML = '<div style="color:#f85149;padding:16px;font-family:monospace;font-size:13px;white-space:pre-wrap">Game error: ' + msg + '</div>';
    console.error('Panda runner:', msg);
  }

  // ===== Pixel-art texture builder =====
  // Each sprite drawn with fillRect calls on a tiny canvas -> crisp pixel art.
  function makeTex(scene, name, w, h, drawFn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawFn(ctx);
    if (scene.textures.exists(name)) scene.textures.remove(name);
    scene.textures.addImage(name, c);
  }
  function R(ctx, col, x, y, w, h) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }

  // ===== Sprite drawing functions =====

  // Hero sprite — 24x28. frame: 0=idle,1-3=run cycle,4=jump
  // Palette is chosen from Characters.get() (panda by default).
  function drawPanda(ctx, frame) {
    const ch = window.Characters ? Characters.get() : null;
    const Wc = ch ? ch.body : C.W;     // body / fur
    const Bc = ch ? ch.detail : C.B;   // dark accent (ears, arms, legs, nose)
    const wc = ch ? ch.belly : C.w;    // belly highlight
    const Ac = ch ? ch.accent : C.P;   // glasses color (tech bro)
    const eyePatch = !!(ch && ch.eyePatch);
    const stripes = !!(ch && ch.stripes);
    const glasses = !!(ch && ch.glasses);
    const mane = !!(ch && ch.mane);
    const tail = !!(ch && ch.tail);

    // tail (drawn first, behind body) — monkey
    if (tail) {
      ctx.strokeStyle = Bc; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(2, 15); ctx.quadraticCurveTo(-2, 12, 1, 9); ctx.stroke();
    }

    // ears
    if (mane) {
      R(ctx, Bc, 4, 0, 6, 4); R(ctx, Bc, 14, 0, 6, 4);
      R(ctx, Wc, 5, 1, 4, 2); R(ctx, Wc, 15, 1, 4, 2);
    } else {
      R(ctx, Bc, 6, 1, 3, 2); R(ctx, Bc, 15, 1, 3, 2);
      R(ctx, Bc, 5, 2, 5, 3); R(ctx, Bc, 14, 2, 5, 3);
    }
    // head
    R(ctx, Wc, 5, 3, 14, 7);
    R(ctx, Wc, 4, 4, 16, 5);
    // eyes / glasses
    if (glasses) {
      R(ctx, Ac, 6, 5, 5, 3); R(ctx, Ac, 13, 5, 5, 3);
      R(ctx, Bc, 10, 6, 1, 1); // bridge
      R(ctx, Wc, 7, 6, 1, 1); R(ctx, Wc, 15, 6, 1, 1);
    } else if (eyePatch) {
      R(ctx, Bc, 7, 5, 3, 4); R(ctx, Bc, 14, 5, 3, 4);
      R(ctx, Wc, 8, 6, 1, 1); R(ctx, Wc, 15, 6, 1, 1);
    } else {
      R(ctx, Bc, 8, 6, 1, 1); R(ctx, Bc, 15, 6, 1, 1);
    }
    // nose
    R(ctx, Bc, 11, 8, 2, 1);
    // mouth
    R(ctx, Bc, 10, 9, 1, 1); R(ctx, Bc, 13, 9, 1, 1);
    // body
    R(ctx, Wc, 3, 11, 18, 9);
    R(ctx, Wc, 2, 12, 20, 7);
    if (wc !== Wc) R(ctx, wc, 5, 14, 14, 4); // belly
    if (stripes) { // zebra
      R(ctx, Bc, 5, 12, 1, 7); R(ctx, Bc, 9, 12, 1, 7);
      R(ctx, Bc, 14, 12, 1, 7); R(ctx, Bc, 18, 12, 1, 7);
    }
    // arms
    R(ctx, Bc, 2, 12, 2, 6); R(ctx, Bc, 20, 12, 2, 6);
    // legs vary by frame
    if (frame === 0 || frame === 4) { // idle or jump (legs together-ish)
      if (frame === 4) { // jump — legs tucked
        R(ctx, Bc, 6, 20, 4, 3); R(ctx, Bc, 14, 20, 4, 3);
      } else {
        R(ctx, Bc, 5, 20, 4, 5); R(ctx, Bc, 15, 20, 4, 5);
      }
    } else if (frame === 1) { // run — left leg forward
      R(ctx, Bc, 4, 20, 4, 4); R(ctx, Bc, 16, 20, 4, 5);
    } else if (frame === 2) { // run — mid stride
      R(ctx, Bc, 7, 20, 4, 4); R(ctx, Bc, 13, 20, 4, 4);
    } else if (frame === 3) { // run — right leg forward
      R(ctx, Bc, 4, 20, 4, 5); R(ctx, Bc, 16, 20, 4, 4);
    }
  }

  // City ground tile — 32x32 Victorian brick rooftop
  function drawCityGround(ctx) {
    // top grass strip
    R(ctx, C.G2, 0, 0, 32, 3);
    R(ctx, C.G1, 0, 3, 32, 1);
    // brick body
    for (let y = 4; y < 32; y += 5) {
      const offset = ((y / 5) | 0) % 2 === 0 ? 0 : 8;
      for (let x = -offset; x < 32; x += 16) {
        R(ctx, C.R1, x + 1, y, 14, 4);
        R(ctx, C.R2, x + 1, y + 3, 14, 1);
      }
      R(ctx, C.Rm, 0, y + 4, 32, 1); // mortar line
    }
    // a few darker speckles for texture
    R(ctx, C.R2, 5, 6, 2, 1); R(ctx, C.R2, 22, 11, 2, 1); R(ctx, C.R2, 14, 21, 2, 1);
  }

  // Forest ground — 32x32 mossy soil with bamboo roots
  function drawForestGround(ctx) {
    R(ctx, C.G3, 0, 0, 32, 3); // mossy top
    R(ctx, C.G2, 0, 3, 32, 1);
    R(ctx, C.G4, 0, 4, 32, 28); // dark soil
    R(ctx, C.G2, 0, 6, 32, 2); // soil gradient
    // roots & rocks
    R(ctx, C.G4, 4, 10, 6, 3); R(ctx, C.G4, 20, 14, 8, 4);
    R(ctx, C.G2, 12, 20, 5, 3); R(ctx, C.G4, 2, 26, 7, 3);
    // bamboo shoots poking through
    R(ctx, C.G1, 8, 4, 2, 5); R(ctx, C.G3, 8, 4, 1, 5);
    R(ctx, C.G1, 26, 4, 2, 4); R(ctx, C.G3, 26, 4, 1, 4);
    // scattered leaves
    R(ctx, C.G3, 16, 8, 3, 1); R(ctx, C.G3, 28, 22, 3, 1);
  }

  // Bridge ground — 32x32 concrete with cracks & bamboo
  function drawBridgeGround(ctx) {
    R(ctx, C.S3, 0, 0, 32, 4); // concrete surface
    R(ctx, C.S2, 0, 4, 32, 28); // darker base
    // cracks
    R(ctx, C.S2, 0, 6, 8, 1); R(ctx, C.S2, 8, 6, 1, 4);
    R(ctx, C.S2, 20, 10, 1, 6); R(ctx, C.S2, 21, 16, 6, 1);
    R(ctx, C.S2, 4, 24, 10, 1); R(ctx, C.S2, 14, 24, 1, 4);
    // yellow road line
    R(ctx, C.Y1, 14, 2, 4, 1);
    // bamboo shoots growing through
    R(ctx, C.G1, 6, 0, 2, 8); R(ctx, C.G3, 6, 0, 1, 8);
    R(ctx, C.G1, 24, 0, 2, 6); R(ctx, C.G3, 24, 0, 1, 6);
    R(ctx, C.G2, 16, 0, 2, 4);
  }

  // Bamboo platform — 96x32, horizontal stalk bundle
  function drawPlatform(ctx) {
    // main horizontal stalk
    R(ctx, C.G2, 0, 8, 96, 16);
    R(ctx, C.G1, 0, 8, 96, 4);
    R(ctx, C.G3, 0, 8, 96, 2);
    R(ctx, C.G4, 0, 22, 96, 2);
    // bamboo segments (vertical lines every 16px)
    for (let x = 0; x < 96; x += 16) {
      R(ctx, C.G4, x, 8, 1, 16);
      R(ctx, C.G3, x + 1, 9, 1, 3);
    }
    // top leaves
    R(ctx, C.G1, 4, 4, 4, 4); R(ctx, C.G3, 5, 3, 2, 2);
    R(ctx, C.G1, 40, 4, 4, 4); R(ctx, C.G3, 41, 3, 2, 2);
    R(ctx, C.G1, 76, 4, 4, 4); R(ctx, C.G3, 77, 3, 2, 2);
    // vine binding at ends
    R(ctx, C.G4, 2, 12, 4, 8); R(ctx, C.G4, 90, 12, 4, 8);
  }

  // Bamboo coin — 16x16
  function drawCoin(ctx) {
    R(ctx, C.G2, 4, 2, 8, 12); // stalk
    R(ctx, C.G1, 5, 3, 6, 10);
    R(ctx, C.G3, 5, 3, 2, 10); // highlight
    R(ctx, C.G1, 2, 2, 5, 3); R(ctx, C.G3, 3, 2, 2, 2); // left leaf
    R(ctx, C.G1, 9, 0, 5, 3); R(ctx, C.G3, 10, 0, 2, 2); // right leaf
    R(ctx, C.G4, 4, 13, 8, 1); // base
    // shine
    R(ctx, C.Y1, 6, 5, 1, 1);
  }

  // Seagull — 24x16
  function drawSeagull(ctx) {
    R(ctx, C.e, 2, 6, 20, 5); // body
    R(ctx, C.W, 3, 5, 18, 2); // top
    R(ctx, C.w, 2, 10, 20, 2); // belly shadow
    R(ctx, C.Y1, 11, 4, 3, 2); // head/beak
    R(ctx, C.B, 10, 3, 2, 2); // eye
    // wings (spread)
    R(ctx, C.e, 0, 3, 6, 3); R(ctx, C.e, 18, 3, 6, 3);
    R(ctx, C.w, 0, 5, 4, 1); R(ctx, C.w, 20, 5, 4, 1);
    // tail
    R(ctx, C.w, 2, 8, 3, 2);
  }

  // Frog — 20x16
  function drawFrog(ctx) {
    R(ctx, C.G1, 2, 4, 16, 8); // body
    R(ctx, C.G2, 2, 10, 16, 3); // belly shadow
    R(ctx, C.G3, 3, 4, 14, 2); // back highlight
    R(ctx, C.G1, 4, 1, 4, 4); R(ctx, C.G1, 12, 1, 4, 4); // eye bumps
    R(ctx, C.W, 5, 2, 2, 2); R(ctx, C.W, 13, 2, 2, 2); // eyes
    R(ctx, C.B, 6, 3, 1, 1); R(ctx, C.B, 14, 3, 1, 1); // pupils
    // legs
    R(ctx, C.G2, 0, 10, 3, 4); R(ctx, C.G2, 17, 10, 3, 4);
    // spots
    R(ctx, C.G2, 6, 6, 2, 2); R(ctx, C.G2, 12, 7, 2, 2);
  }

  // Finish flag — 24x40
  function drawFlag(ctx) {
    R(ctx, C.G2, 10, 0, 4, 40); // pole
    R(ctx, C.G1, 11, 0, 2, 40);
    R(ctx, C.G3, 11, 0, 1, 40); // pole highlight
    // pennant
    R(ctx, C.Y1, 14, 2, 10, 8);
    R(ctx, C.Y2, 14, 8, 10, 2);
    R(ctx, C.Y2, 20, 3, 4, 6); // triangle tip
    // check pattern on flag
    R(ctx, C.W, 16, 3, 2, 2); R(ctx, C.W, 20, 5, 2, 2);
    // top knob
    R(ctx, C.Y1, 10, 0, 4, 3); R(ctx, C.Y2, 11, 0, 2, 1);
  }

  // Parallax backgrounds
  function drawBgFar(ctx) {
    // sky gradient
    for (let y = 0; y < 200; y++) {
      const t = y / 200;
      const r = Math.round(123 + t * 30), g = Math.round(180 + t * 20), b = Math.round(224 + t * 10);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, y, 544, 1);
    }
    // distant mountains/hills
    R(ctx, C.K3, 0, 130, 544, 70);
    for (let x = 0; x < 544; x += 80) {
      R(ctx, C.K2, x, 110, 80, 20); R(ctx, C.K2, x + 20, 100, 40, 30);
    }
    // Golden Gate silhouette far right
    R(ctx, C.K1, 460, 80, 4, 120);
    R(ctx, C.K1, 500, 80, 4, 120);
    R(ctx, C.K2, 460, 95, 44, 2); R(ctx, C.K2, 460, 110, 44, 2);
  }
  function drawBgMid(ctx) {
    // SF Victorian houses + downtown + bamboo groves silhouettes
    // skyline band
    R(ctx, C.K2, 0, 0, 544, 4); // ground line
    // Victorian houses (painted ladies silhouettes)
    for (let i = 0; i < 4; i++) {
      const x = 20 + i * 70;
      R(ctx, C.K3, x, 40, 50, 80);
      R(ctx, C.K3, x - 2, 35, 54, 6); // roof
      R(ctx, C.K3, x + 22, 25, 6, 15); // spire
      // windows (lighter)
      R(ctx, C.K1, x + 8, 55, 8, 10); R(ctx, C.K1, x + 34, 55, 8, 10);
      R(ctx, C.K1, x + 8, 75, 8, 10); R(ctx, C.K1, x + 34, 75, 8, 10);
    }
    // downtown towers
    for (let i = 0; i < 5; i++) {
      const x = 320 + i * 40;
      R(ctx, C.K2, x, 20 + (i % 2) * 15, 36, 100);
      R(ctx, C.K1, x + 2, 25, 6, 8); R(ctx, C.K1, x + 14, 25, 6, 8); R(ctx, C.K1, x + 26, 25, 6, 8);
      R(ctx, C.K1, x + 2, 45, 6, 8); R(ctx, C.K1, x + 14, 45, 6, 8); R(ctx, C.K1, x + 26, 45, 6, 8);
    }
    // bamboo groves between buildings
    for (let x = 0; x < 544; x += 90) {
      R(ctx, C.G4, x + 60, 30, 3, 90); R(ctx, C.G4, x + 65, 20, 3, 100); R(ctx, C.G4, x + 70, 35, 3, 85);
      R(ctx, C.G2, x + 60, 25, 1, 10); R(ctx, C.G2, x + 65, 18, 1, 12);
    }
  }
  function drawBgNear(ctx) {
    // foreground stalks & chimney silhouettes — sparse
    for (let i = 0; i < 6; i++) {
      const x = i * 100 + 20;
      R(ctx, C.G4, x, 50, 4, 150);
      R(ctx, C.G2, x + 1, 60, 2, 30);
      // leaves at top
      R(ctx, C.G4, x - 4, 50, 5, 4); R(ctx, C.G4, x + 4, 45, 5, 4);
    }
    // chimneys
    R(ctx, C.R2, 45, 80, 12, 40); R(ctx, C.R2, 230, 70, 12, 50); R(ctx, C.R2, 420, 60, 12, 45);
    R(ctx, C.R1, 45, 80, 12, 3); R(ctx, C.R1, 230, 70, 12, 3); R(ctx, C.R1, 420, 60, 12, 3);
  }

  // ===== Phaser scene =====
  class Play extends Phaser.Scene {
    constructor() { super('play'); }

    preload() {
      // No external images — all art is generated in create()
    }

    create() {
      try {
      this.cameras.main.setBackgroundColor('#9bd2ee');
      // Ensure the game-level keyboard is re-enabled (showOverlay disables it for typing).
      const mgrKb = this.input && this.input.manager && this.input.manager.keyboard;
      if (mgrKb) mgrKb.enabled = true;
      if (this.input && this.input.keyboard) this.input.keyboard.enabled = true;
      this.buildArt();

        this.lives = 3; this.bamboo = 0; this.score = 0; this.won = false;
        this.checkpoints = [60, 760, 1440, 2300, 3300];
        this.lastSafeX = 60;
        this.runFrame = 0; this.runTimer = 0;

        this.buildParallax();
        // pixel texture for invisible collision bodies
        const gfx = this.add.graphics();
        gfx.fillStyle(0xffffff, 1); gfx.fillRect(0, 0, 2, 2);
        gfx.generateTexture('pix', 2, 2); gfx.destroy();

        this.buildLevel();
        this.spawnPanda();
        this.setupInput();
        this.setupCamera();
        this.fetchScoreboard();
this.updateHUD();

      window.__pandaScene = this; // inspection hook
      this.events.once('pointerdown', () => { if (!Music.isMuted()) Music.start(); });
      } catch (e) { showErr('create: ' + e.message); }
    }

    // ===== Generate all textures =====
    buildArt() {
      makeTex(this, 'panda_idle', 24, 28, (ctx) => drawPanda(ctx, 0));
      makeTex(this, 'panda_run1', 24, 28, (ctx) => drawPanda(ctx, 1));
      makeTex(this, 'panda_run2', 24, 28, (ctx) => drawPanda(ctx, 2));
      makeTex(this, 'panda_run3', 24, 28, (ctx) => drawPanda(ctx, 3));
      makeTex(this, 'panda_jump', 24, 28, (ctx) => drawPanda(ctx, 4));
      makeTex(this, 'city_ground', TS, TS, drawCityGround);
      makeTex(this, 'forest_ground', TS, TS, drawForestGround);
      makeTex(this, 'bridge_ground', TS, TS, drawBridgeGround);
      makeTex(this, 'platform_bamboo', 96, 32, drawPlatform);
      makeTex(this, 'bamboo_coin', 16, 16, drawCoin);
      makeTex(this, 'seagull', 24, 16, drawSeagull);
      makeTex(this, 'frog', 20, 16, drawFrog);
      makeTex(this, 'flag', 24, 40, drawFlag);
      makeTex(this, 'bg_far', 544, 200, drawBgFar);
      makeTex(this, 'bg_mid', 544, 120, drawBgMid);
      makeTex(this, 'bg_near', 544, 200, drawBgNear);
    }

    // ===== Parallax =====
    buildParallax() {
      this.parallax = [];
      const layers = [
        { key: 'bg_far', factor: 0.15, y: 0, depth: -13 },
        { key: 'bg_mid', factor: 0.40, y: 180, depth: -12 },
        { key: 'bg_near', factor: 0.75, y: 270, depth: -11 },
      ];
      for (const L of layers) {
        const t = this.add.tileSprite(0, L.y, W, this.textures.get(L.key).getSourceImage().height, L.key)
          .setOrigin(0, 0).setScrollFactor(0).setDepth(L.depth);
        this.parallax.push({ sprite: t, factor: L.factor });
      }
    }

    // ===== Level build =====
    buildLevel() {
      this.ground = this.physics.add.staticGroup();
      this.solid = this.physics.add.staticGroup();
      this.coins = this.physics.add.group();
      this.enemies = this.physics.add.group();

      const segs = [
        [0, 620, 'city_ground'], [720, 1340, 'city_ground'],
        [1420, 2200, 'city_ground'], [2200, WORLD_W, 'bridge_ground'],
      ];
      for (const [x0, x1, key] of segs) this.addGround(x0, x1, key);

      // chimneys
      const chimneys = [[360, 0], [900, 1], [1600, 0], [1880, 1]];
      for (const [x, v] of chimneys) this.addBlock(x, GROUND_Y - 70, 30, 70, v ? '#6f4720' : '#5a5a64');

      // platforms
      const plats = [
        { x: 240, y: 360 }, { x: 460, y: 300 }, { x: 820, y: 330 }, { x: 1060, y: 280 },
        { x: 1500, y: 340 }, { x: 1760, y: 300 }, { x: 2050, y: 330 },
        { x: 2360, y: 330 }, { x: 2560, y: 280 }, { x: 2780, y: 340 },
        { x: 3000, y: 290 }, { x: 3220, y: 350 }, { x: 3460, y: 300 },
        { x: 3700, y: 340 }, { x: 3920, y: 300 },
      ];
      for (const p of plats) this.addPlatform(p.x, p.y);

      // coins
      const coinSpots = [
        [250, 320], [470, 260], [700, 420], [830, 290], [1070, 240],
        [1180, 420], [1510, 300], [1770, 260], [2000, 420], [2060, 290],
        [2370, 290], [2570, 240], [2790, 300], [3010, 250], [3230, 310],
        [3470, 260], [3710, 300], [3930, 260], [4100, 420],
      ];
      for (const [x, y] of coinSpots) this.addCoin(x, y);

      // enemies
      const gulls = [[480, 250, 360], [980, 220, 320], [1700, 260, 280], [2050, 230, 220]];
      for (const [x, y, range] of gulls) this.addSeagull(x, y, range);
      const frogs = [[2500, GROUND_Y - 20], [2820, GROUND_Y - 20], [3150, GROUND_Y - 20], [3500, GROUND_Y - 20]];
      for (const [x, y] of frogs) this.addFrog(x, y);

      // finish flag + zone
      this.add.image(WORLD_W - 180, GROUND_Y, 'flag').setOrigin(0.5, 1).setDepth(5);
      const fz = this.add.rectangle(WORLD_W - 180, GROUND_Y - 60, 60, 120, 0x000000, 0).setOrigin(0.5, 1);
      this.physics.add.existing(fz, true);
      this.flagZone = fz;

      // water in pits
      const g = this.add.graphics().setDepth(-5);
      g.fillStyle(0x2a6f97, 1);
      for (const [x0, x1] of [[620, 720], [1340, 1420]]) g.fillRect(x0, GROUND_Y, x1 - x0, 160);
      // water shimmer
      g.fillStyle(0x7fb8e0, 0.3);
      for (const [x0, x1] of [[620, 720], [1340, 1420]]) g.fillRect(x0, GROUND_Y, x1 - x0, 4);
    }

    addGround(x0, x1, key) {
      const w = x1 - x0, h = H - GROUND_Y + 60;
      this.add.tileSprite(x0, GROUND_Y, w, h, key).setOrigin(0, 0);
      const plat = this.ground.create(x0 + w / 2, GROUND_Y + h / 2, 'pix');
      plat.setVisible(false);
      plat.refreshBody();
      plat.body.setSize(w, h);
    }
    addBlock(x, y, w, h, color) {
      this.add.rectangle(x, y, w, h, Phaser.Display.Color.HexStringToColor(color).color).setOrigin(0, 0);
      const plat = this.solid.create(x + w / 2, y + h / 2, 'pix');
      plat.setVisible(false);
      plat.refreshBody();
      plat.body.setSize(w, h);
    }
    addPlatform(x, y) {
      const s = this.add.image(x, y, 'platform_bamboo').setOrigin(0.5, 0.5);
      const plat = this.solid.create(x, y, 'pix');
      plat.setVisible(false);
      plat.refreshBody();
      plat.body.setSize(150, 24);
    }
    addCoin(x, y) {
      const s = this.physics.add.image(x, y, 'bamboo_coin').setScale(1.5);
      s.body.setAllowGravity(false).setCircle(10);
      this.coins.add(s);
      this.tweens.add({ targets: s, y: y - 5, duration: 800, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }
    addSeagull(x, y, range) {
      const s = this.physics.add.image(x, y, 'seagull').setScale(1.5);
      s.body.setAllowGravity(false).setSize(28, 14);
      s.baseX = x; s.range = range; s.dir = 1; s.speed = 55;
      this.enemies.add(s);
      this.tweens.add({ targets: s, y: y - 8, duration: 500, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }
    addFrog(x, y) {
      const s = this.physics.add.image(x, y, 'frog').setScale(1.5).setOrigin(0.5, 1);
      s.body.setSize(24, 16).setOffset(0, 0);
      s.dir = -1; s.hopTimer = 1.2;
      this.enemies.add(s);
    }

    spawnPanda() {
      this.panda = this.physics.add.sprite(60, GROUND_Y - 20, 'panda_idle').setOrigin(0.5, 1);
      this.panda.body.setSize(18, 26).setOffset(3, 2);
      this.panda.body.setCollideWorldBounds(false);
      this.panda.facing = 1;
      this.panda.coyote = 0; this.panda.buffer = 0; this.panda.jumpHeld = false;
      this.panda.dead = false;

      this.physics.add.collider(this.panda, this.ground, () => this.onLand());
      this.physics.add.collider(this.panda, this.solid, () => this.onLand());
      this.physics.add.collider(this.enemies, this.ground);
      this.physics.add.collider(this.enemies, this.solid);

      this.physics.add.overlap(this.panda, this.coins, (p, c) => {
        c.destroy(); this.bamboo++; this.score += 5; this.updateHUD(); Music.pluck();
      });
      this.physics.add.overlap(this.panda, this.enemies, (p, e) => this.hitEnemy(p, e));
      this.physics.add.overlap(this.panda, this.flagZone, () => this.win());
    }

    onLand() {
      if (this.panda.dead) return;
      this.panda.coyote = COYOTE;
      this.lastSafeX = Math.max(this.lastSafeX, this.panda.x);
      const cp = [...this.checkpoints].reverse().find((cx) => this.panda.x >= cx - 20);
      if (cp) this.lastSafeX = cp;
    }

    setupInput() {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys('A,D,W,S,SPACE,M,R');
      this.input.keyboard.on('keydown-M', () => this.toggleMusic());
      this.input.keyboard.on('keydown-R', () => this.scene.restart());
      this.input.keyboard.on('keydown', () => { if (!Music.isMuted()) Music.start(); });
    }
    toggleMusic() {
      const m = Music.toggle(); if (!m) Music.start();
      if (ui.music) ui.music.textContent = 'Music: ' + (m ? 'Off' : 'On');
    }
    setupCamera() {
      this.cameras.main.setBounds(0, 0, WORLD_W, H);
      this.cameras.main.startFollow(this.panda, true, 0.12, 0.12, -120, 0);
    }

    // ===== Update =====
    update(time, dt) {
      if (!this.panda) return;
      const s = dt / 1000;
      const p = this.panda;
      this.parallaxScroll();
      if (this.won) { p.setVelocityX(0); return; }
      if (p.dead) return;
      if (p.y > PIT_BOTTOM) { this.die(); return; }

      // horizontal
      let dir = 0;
      if (this.cursors.left.isDown || this.keys.A.isDown) dir = -1;
      if (this.cursors.right.isDown || this.keys.D.isDown) dir = 1;
      if (dir !== 0) {
        p.setAccelerationX(dir * ACCEL); p.body.setMaxVelocityX(MOVE); p.facing = dir;
      } else {
        p.setAccelerationX(0);
        const v = p.body.velocity.x;
        if (Math.abs(v) < 30) p.setVelocityX(0);
        else p.setAccelerationX(v > 0 ? -FRICTION : FRICTION);
      }

      // jump
      const jumpPressed = this.cursors.up.isDown || this.keys.W.isDown || this.keys.SPACE.isDown;
      if (jumpPressed) p.buffer = BUFFER; else p.buffer -= s;
      if (p.buffer > 0 && p.coyote > 0) this.doJump();
      p.coyote -= s;
      p.jumpHeld = jumpPressed && p.body.velocity.y < 0;
      p.body.setGravityY(p.jumpHeld ? JUMP_HOLD_GRAV : GRAVITY);
      p.body.setMaxVelocityY(MAX_FALL);

      // animation
      const grounded = p.body.blocked.down || p.body.touching.down;
      if (!grounded) {
        p.setTexture('panda_jump');
      } else if (Math.abs(p.body.velocity.x) > 20) {
        this.runTimer += s;
        if (this.runTimer > 0.10) { this.runTimer = 0; this.runFrame = (this.runFrame + 1) % 3; }
        p.setTexture('panda_run' + (this.runFrame + 1));
      } else {
        p.setTexture('panda_idle');
      }
      p.setFlipX(p.facing < 0);

      // enemies
      for (const e of this.enemies.getChildren()) this.updateEnemy(e, s);

      ui.dist.textContent = Math.max(0, Math.floor(p.x / 10)) + 'm';
    }

    doJump() {
      this.panda.setVelocityY(JUMP_V);
      this.panda.coyote = 0; this.panda.buffer = 0;
      Music.jump();
    }

    updateEnemy(e, s) {
      if (e.baseX !== undefined) {
        e.x += e.dir * e.speed * s;
        if (e.x > e.baseX + e.range) e.dir = -1;
        if (e.x < e.baseX - e.range) e.dir = 1;
        e.setFlipX(e.dir < 0);
        e.body.x = e.x - e.body.width / 2;
      } else {
        e.hopTimer -= s;
        if (e.hopTimer <= 0 && e.body.blocked.down) {
          e.hopTimer = 0.8 + Math.random() * 0.8;
          e.setVelocityY(-320); e.setVelocityX(e.dir * 60);
        }
        if (e.body.blocked.left || e.body.blocked.right) e.dir *= -1;
        e.setFlipX(e.dir < 0);
      }
    }

    parallaxScroll() {
      const cx = this.cameras.main.scrollX;
      for (const L of this.parallax) L.sprite.tilePositionX = cx * L.factor;
    }

    hitEnemy(p, e) {
      if (p.dead) return;
      const stomp = p.body.velocity.y > 30 && (p.y + p.body.height / 2) < (e.y + 12);
      if (stomp) {
        e.destroy(); this.score += 20; this.updateHUD(); p.setVelocityY(-300); Music.pluck();
        return;
      }
      this.lives--; this.updateHUD(); Music.hit();
      if (this.lives <= 0) { this.gameOver(); return; }
      p.setVelocityY(-260); p.setVelocityX(p.facing < 0 ? 120 : -120);
      p.dead = true; this.time.delayedCall(800, () => { p.dead = false; });
      toast('Ouch! ' + this.lives + ' lives left');
    }
    die() {
      this.lives--; this.updateHUD();
      if (this.lives <= 0) { this.gameOver(); return; }
      this.panda.x = this.lastSafeX; this.panda.y = 100;
      this.panda.setVelocity(0, 0); this.panda.dead = false;
      toast('Splash! ' + this.lives + ' lives left');
    }
    win() {
      if (this.won) return;
      this.won = true;
      this.score += 500 + this.lives * 100 + this.bamboo * 5;
      this.updateHUD();
      toast('You reached the bridge!');
      this.time.delayedCall(500, () => showOverlay(true, this));
    }
    gameOver() { this.time.delayedCall(200, () => showOverlay(false, this)); }

    updateHUD() {
      if (ui.lives) ui.lives.textContent = 'Lives: ' + Math.max(0, this.lives);
      if (ui.bamboo) ui.bamboo.textContent = 'Bamboo: ' + this.bamboo;
      if (ui.score) ui.score.textContent = 'Score: ' + this.score;
    }
    fetchScoreboard() {
      fetch('/api/scoreboard').then((r) => r.json()).then((d) => renderScoreboard(d && d.top)).catch(() => {});
    }
  }

  // ===== Overlay / scoreboard =====
  let lastToken = null;
  function showOverlay(won, scn) {
    if (!ui.overlay) return;
    ui.overlay.classList.remove('hidden');
    ui.ovTitle.textContent = won ? 'Postcards Complete!' : 'Game Over';
    ui.ovBody.textContent = 'Score: ' + scn.score + '  -  Bamboo: ' + scn.bamboo + '  -  Distance: ' + Math.floor(scn.panda.x / 10) + 'm';
    // Release the keyboard from Phaser so the name input receives keystrokes.
    // The game-level InputManager keyboard (not the scene's) calls preventDefault
    // on captured keys (WASD/M/R/Space); disabling it lets those reach the input.
    const mgrKb = scn.input && scn.input.manager && scn.input.manager.keyboard;
    if (mgrKb) mgrKb.enabled = false;
    if (scn.input && scn.input.keyboard) scn.input.keyboard.enabled = false;
    ui.ovName.value = ''; ui.ovName.focus();
    ui._pending = { won, scn };
  }
  function submitScore() {
    const p = ui._pending || {};
    const name = (ui.ovName.value || '').trim().slice(0, 32) || 'Anonymous';
    const scn = p.scn;
    const body = { name, score: scn ? scn.score : 0, level: scn ? Math.floor((scn.panda ? scn.panda.x : 0) / 10) : 0, won: !!p.won, game: 'runner' };
    fetch('/api/scoreboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => r.json()).then((d) => {
        if (d && d.entry) lastToken = d.entry.token;
        if (d && d.top) renderScoreboard(d.top);
        ui.overlay.classList.add('hidden');
        if (game) game.scene.scenes[0].scene.restart();
      }).catch(() => { ui.overlay.classList.add('hidden'); });
  }
  function renderScoreboard(top) {
    if (!ui.scoreboard) return;
    const ol = ui.scoreboard; ol.innerHTML = '';
    if (!top || !top.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No scores yet'; ol.appendChild(li); return; }
    top.forEach((e) => {
      const li = document.createElement('li');
      if (e.token && e.token === lastToken) li.className = 'me';
      const tag = e.game === 'runner' ? '[runner] ' : '';
      li.innerHTML = tag + e.name + ' <small>' + e.score + 'pts' + (e.won ? ' *' : '') + '</small>';
      ol.appendChild(li);
    });
  }

  ui.restart.addEventListener('click', () => { if (game) game.scene.scenes[0].scene.restart(); });
  ui.ovSubmit.addEventListener('click', submitScore);
  ui.ovClose.addEventListener('click', () => ui.overlay.classList.add('hidden'));
  if (ui.music) ui.music.addEventListener('click', () => {
    const m = Music.toggle(); if (!m) Music.start();
    ui.music.textContent = 'Music: ' + (m ? 'Off' : 'On');
  });
  if (ui.charBtn) ui.charBtn.addEventListener('click', () => {
    Characters.open(() => { updateTitle(); if (game) game.scene.scenes[0].scene.restart(); });
  });

  // ===== Boot =====
  window.addEventListener('error', (e) => showErr(e.message || 'unknown error'));
  function boot() {
    try {
      if (!window.Phaser) { showErr('Phaser failed to load from CDN'); return; }
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game-container',
        width: W, height: H,
        pixelArt: true,
        physics: { default: 'arcade', arcade: { gravity: { y: GRAVITY }, debug: false } },
        scene: Play,
        render: { pixelArt: true, antialias: false },
      });
    } catch (e) { showErr(e.message); }
  }
  function updateTitle() {
    const ch = window.Characters ? Characters.get() : null;
    const name = ch ? ch.name : 'Panda';
    const emoji = ch ? ch.emoji : '🐼';
    const title = emoji + ' ' + name + ' Across the Bridge';
    document.title = title;
    const h1 = document.getElementById('game-title');
    if (h1) h1.textContent = title;
  }
  function startBoot() {
    updateTitle();
    if (window.Phaser) boot(); else window.addEventListener('load', boot);
  }
  if (window.Characters && !Characters.hasChoice()) {
    Characters.open(startBoot);
  } else {
    startBoot();
  }
})();