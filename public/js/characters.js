// Characters — shared selectable protagonists for both Panda Days in SF
// (top-down explorer) and Panda Across the Bridge (Phaser side-scroller).
// The chosen id persists in localStorage so it carries between games.
(() => {
  'use strict';

  const DEFAULT = 'panda';
  const STORE = 'pandaChar';

  // Palette fields:
  //   body    — main fur/skin color
  //   detail  — dark accent (legs, arms, ears, nose, eye patches, stripes)
  //   belly   — lighter belly highlight (omit by setting equal to body)
  //   accent  — glasses / phone color (tech bro)
  //   eyePatch — panda/zebra-style dark patches around the eyes
  //   stripes  — zebra vertical body stripes
  //   glasses  — tech bro blue glasses (replaces eye dots)
  //   mane     — bigger, fluffier ears (koala/zebra)
  //   tail     — curly tail behind body (monkey)
  const CHARACTERS = {
    panda:   { name: 'Panda',    emoji: '🐼', body: '#ffffff', detail: '#1a1a1a', belly: '#ffffff', accent: '#1a1a1a', eyePatch: true,  stripes: false, glasses: false, mane: false, tail: false },
    koala:   { name: 'Koala',     emoji: '🐨', body: '#a8a09a', detail: '#4a4248', belly: '#d8cfc6', accent: '#2a2228', eyePatch: false, stripes: false, glasses: false, mane: true,  tail: false },
    monkey:  { name: 'Monkey',    emoji: '🐵', body: '#8a5a3a', detail: '#3a2418', belly: '#d8a878', accent: '#c98a5a', eyePatch: false, stripes: false, glasses: false, mane: false, tail: true  },
    zebra:   { name: 'Zebra',     emoji: '🦓', body: '#f0f0f0', detail: '#1a1a1a', belly: '#f0f0f0', accent: '#1a1a1a', eyePatch: false, stripes: true,  glasses: false, mane: true,  tail: false },
    techbro: { name: 'Tech Bro',  emoji: '🧑‍💻', body: '#e8c9a0', detail: '#3a2a20', belly: '#e8c9a0', accent: '#4a6a8a', eyePatch: false, stripes: false, glasses: true,  mane: false, tail: false },
  };

  function key() { return localStorage.getItem(STORE) || DEFAULT; }
  function get() { return CHARACTERS[key()] || CHARACTERS[DEFAULT]; }
  function set(k) { if (!CHARACTERS[k]) return false; localStorage.setItem(STORE, k); return true; }
  function hasChoice() { return !!localStorage.getItem(STORE); }

  // Build the picker overlay markup once into #char-picker (shared by both pages).
  function buildPicker() {
    const el = document.getElementById('char-picker');
    if (!el) return null;
    if (el.dataset.built === '1') return el;
    el.dataset.built = '1';
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2>Choose your hero</h2><p>Pick a character for your city adventure.</p>';
    const grid = document.createElement('div');
    grid.className = 'char-grid';
    Object.keys(CHARACTERS).forEach((id) => {
      const c = CHARACTERS[id];
      const btn = document.createElement('button');
      btn.className = 'char-btn';
      btn.dataset.id = id;
      btn.innerHTML = '<span class="emoji">' + c.emoji + '</span><span class="name">' + c.name + '</span>';
      grid.appendChild(btn);
    });
    card.appendChild(grid);
    el.appendChild(card);
    return el;
  }

  function open(onPick) {
    const el = buildPicker();
    if (!el) { if (onPick) onPick(key()); return; }
    el.classList.remove('hidden');
    el.querySelectorAll('.char-btn').forEach((btn) => {
      btn.onclick = () => {
        set(btn.dataset.id);
        close();
        if (onPick) onPick(btn.dataset.id);
      };
    });
  }
  function close() {
    const el = document.getElementById('char-picker');
    if (el) el.classList.add('hidden');
  }

  window.Characters = { CHARACTERS, key, get, set, hasChoice, open, close };
})();