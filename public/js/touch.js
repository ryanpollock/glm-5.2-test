// Touch controls — on-screen D-pad / action buttons for iPad & touch devices.
// Wires any `.touch-btn[data-key]` to dispatch synthetic KeyboardEvents on
// `window`, so the existing keyboard handlers in game.js and runner.js (Phaser)
// drive movement/actions without either game knowing about touch directly.
(() => {
  'use strict';

  const container = document.getElementById('touch-controls');
  if (!container) return;

  // Show controls on touch devices. Append ?touch=1 to the URL to force them
  // on desktop for testing.
  const hasTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const force = new URLSearchParams(location.search).has('touch');
  if (!hasTouch && !force) return;

  container.classList.remove('hidden');
  document.body.classList.add('touch-device');

  // Maps `KeyboardEvent.code` -> numeric keyCode (legacy, used by Phaser).
  const KEYCODE = {
    ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
    Space: 32,
    KeyA: 65, KeyD: 68, KeyW: 87, KeyS: 83, KeyM: 77, KeyR: 82,
  };
  const KEYNAME = {
    ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
    Space: ' ',
  };

  function dispatch(code, type) {
    const ev = new KeyboardEvent(type, {
      code,
      key: KEYNAME[code] || '',
      bubbles: true,
      cancelable: true,
    });
    const kc = KEYCODE[code];
    if (kc != null) {
      try { Object.defineProperty(ev, 'keyCode', { get: () => kc }); } catch (_) {}
      try { Object.defineProperty(ev, 'which', { get: () => kc }); } catch (_) {}
    }
    window.dispatchEvent(ev);
  }

  function wire(btn) {
    const code = btn.dataset.key;
    if (!code) return;
    let active = false;
    let pid = null;

    const press = (e) => {
      e.preventDefault();
      if (active) return;
      active = true;
      pid = e.pointerId;
      if (btn.setPointerCapture && pid != null) {
        try { btn.setPointerCapture(pid); } catch (_) {}
      }
      btn.classList.add('active');
      // iOS/iPadOS requires a REAL user gesture to start WebAudio — synthetic
      // KeyboardEvents don't carry user activation. prime music here so the
      // AudioContext resumes inside a genuine pointerdown handler.
      if (window.Music && !Music.isMuted()) Music.start();
      dispatch(code, 'keydown');
    };
    const release = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      if (!active) return;
      active = false;
      btn.classList.remove('active');
      dispatch(code, 'keyup');
      if (btn.releasePointerCapture && pid != null) {
        try { btn.releasePointerCapture(pid); } catch (_) {}
      }
      pid = null;
    };

    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    // stop the browser's long-press context menu / callout on iOS
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    // safety: if focus leaves the button while held (e.g. tab switch), release
    window.addEventListener('blur', () => { if (active) release(); });
  }

  container.querySelectorAll('.touch-btn').forEach(wire);
})();