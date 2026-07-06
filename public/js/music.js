// Music — procedural WebAudio soundtrack for Panda Days in SF.
// Cozy loop: warm pad + kalimba-style pentatonic arpeggio (C-Am-F-G).
(() => {
  'use strict';

  let ctx = null, master = null, padGain = null, leadGain = null;
  let timer = null;
  let nextTime = 0;
  let step = 0;
  let started = false;
  let muted = (localStorage.getItem('pandaMusic') === 'off');
  let noiseBuf = null;

  const tempo = 92;
  const STEPS_PER_BAR = 16;
  const BARS = 4;
  const LOOP = STEPS_PER_BAR * BARS;

  const CHORDS = [
    { pad: [48, 55, 60], lead: [60, 64, 67, 72] },
    { pad: [45, 52, 57], lead: [57, 60, 64, 69] },
    { pad: [41, 48, 53], lead: [60, 65, 69, 72] },
    { pad: [43, 50, 55], lead: [59, 62, 67, 71] },
  ];

  // 8th-note arpeggio pattern across one bar (16 sixteenths). -1 = rest.
  const ARP = [0, -1, 1, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 0, -1];

  function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function ensureCtx() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(ctx.destination);
    padGain = ctx.createGain(); padGain.gain.value = 0.5; padGain.connect(master);
    leadGain = ctx.createGain(); leadGain.gain.value = 0.5; leadGain.connect(master);
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function padNote(freqs, t, dur) {
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 1100; filt.Q.value = 0.4;
    filt.connect(padGain);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.6);
    g.gain.setValueAtTime(0.12, t + dur - 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(filt);
    for (const f of freqs) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midiHz(f); o.detune.value = -4;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = midiHz(f); o2.detune.value = 5;
      o.connect(g); o2.connect(g); o.start(t); o2.start(t);
      o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
    }
  }

  function leadNote(midi, t, dur) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = midiHz(midi);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = midiHz(midi) * 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(leadGain);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  function scheduleStep(s, t) {
    const bar = Math.floor(s / STEPS_PER_BAR);
    const beat = s % STEPS_PER_BAR;
    const chord = CHORDS[bar % BARS];
    if (beat === 0) padNote(chord.pad, t, (60 / tempo) * 4);
    const idx = ARP[beat];
    if (idx >= 0) {
      const jitter = (Math.random() - 0.5) * 0.012;
      leadNote(chord.lead[idx], t + jitter, (60 / tempo) / 2 * 1.7);
    }
  }

  function scheduler() {
    const sec16 = (60 / tempo) / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      scheduleStep(step, nextTime);
      nextTime += sec16;
      step = (step + 1) % LOOP;
    }
    timer = setTimeout(scheduler, 25);
  }

  function start() {
    ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
    if (started) return;
    started = true;
    nextTime = ctx.currentTime + 0.1;
    step = 0;
    scheduler();
  }
  function stop() {
    if (timer) { clearTimeout(timer); timer = null; }
    started = false;
  }
  function setMute(m) {
    muted = m;
    localStorage.setItem('pandaMusic', m ? 'off' : 'on');
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.05);
  }
  function toggle() { setMute(!muted); return muted; }
  function isMuted() { return muted; }

  function shutter() {
    ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    click(t); click(t + 0.07);
  }
  function click(t) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t); src.stop(t + 0.08);
  }
  function pluck() {
    ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(1320, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.22);
  }
  function jump() {
    ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(440, t);
    o.frequency.exponentialRampToValueAtTime(980, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.10, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2);
  }
  function hit() {
    ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + 0.2);
  }

  window.Music = { start, stop, toggle, isMuted, shutter, pluck, jump, hit };
})();