import { gsap } from 'gsap';
import { CONFIG } from './config.js';
import { SCENES_2D } from './scenes2d.js';
import { h, mediaExists } from './assets.js';
import { createGasing3D } from './gasing3d.js';
import { createDebugPanel } from './debug.js';

const TITLES = {
  1: 'Tiket', 2: 'Di Kereta', 3: 'Surabaya', 4: 'Toko Antik',
  5: 'Gembok Koper', 6: 'Isi Koper', 7: 'Bagian Kereta', 8: 'Catatan',
  9: 'Kereta Jadi', 10: 'Tutup Koper', 11: 'Bola Tenis', 12: 'Kejutan',
};
const TOTAL = 12;

const $ = (id) => document.getElementById(id);
const el = {
  gl: $('gl'), stage: $('stage2d'), progress: $('progress'), label: $('sceneLabel'),
  caption: $('caption'), action: $('actionBtn'), hint: $('hint'), counter: $('counter'),
  note: $('note'), noteTitle: $('noteTitle'), noteBody: $('noteBody'), noteClose: $('noteClose'),
  flash: $('flash'), fader: $('fader'), confetti: $('confetti'),
  endBar: $('endBar'), endZoom: $('endZoom'), endRestart: $('endRestart'),
  start: $('start'), startBtn: $('startBtn'), startTitle: $('startTitle'),
  mute: $('muteBtn'), error: $('error'),
};

/* ---------------- HUD ---------------- */
for (let i = 1; i <= TOTAL; i++) el.progress.append(h('span', { class: 'dot', 'data-n': i }));
el.startTitle.textContent = CONFIG.recipient;
$('startGasing').replaceWith(createGasing3D({ className: 'start-gasing', label: 'Karakter Gasing' }));

let stage = 0;      // scene yang sedang ditampilkan (1–12), ikut berubah saat alur 3D maju sendiri
let debugPanel = null;

function setStage(n) {
  stage = n;
  debugPanel?.update(n);
  el.progress.querySelectorAll('.dot').forEach((d) => {
    const k = +d.dataset.n;
    d.classList.toggle('is-done', k < n);
    d.classList.toggle('is-current', k === n);
  });
  el.label.textContent = `Scene ${n} · ${TITLES[n]}`;
  caption(CONFIG.captions[n] ?? '');
}

function caption(text) {
  if (el.caption.textContent === text) return;
  gsap.killTweensOf(el.caption);
  gsap.fromTo(el.caption, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35 });
  el.caption.textContent = text;
}

let actionHandler = null;
function showAction(label, fn) {
  actionHandler = fn;
  el.action.textContent = label;
  el.action.hidden = false;
  gsap.fromTo(el.action, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
}
function hideAction() { el.action.hidden = true; actionHandler = null; }
el.action.addEventListener('click', () => { const fn = actionHandler; hideAction(); fn?.(); });

const pill = (node) => (text) => {
  node.hidden = !text;
  if (text) node.textContent = text;
};
const hint = pill(el.hint);
const counter = pill(el.counter);

function flash(strength = 1) {
  gsap.timeline()
    .to(el.flash, { opacity: 0.75 * strength, duration: 0.25, ease: 'power1.in' })
    .to(el.flash, { opacity: 0, duration: 0.6, ease: 'power1.out' });
}

let skipFade = false; // debug: transisi instan
function fade(to, color = 'black', duration = 0.45) {
  el.fader.style.background = color === 'white' ? '#fff8ec' : '#0d0806';
  if (skipFade) duration = 0;
  return new Promise((r) => gsap.to(el.fader, { opacity: to, duration, ease: 'power1.inOut', onComplete: r }));
}

let cancelNote = null;
function openNote(part) {
  el.noteTitle.textContent = part.name;
  el.noteBody.replaceChildren(...part.text.map((s) => h('p', {}, s)));
  el.note.hidden = false;
  gsap.fromTo(el.note.querySelector('.note-paper'), { y: 30, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'power2.out' });
  gsap.fromTo(el.note, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  el.noteClose.focus({ preventScroll: true });
  return new Promise((resolve) => {
    const close = () => {
      cancelNote = null;
      el.noteClose.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
      gsap.to(el.note, { opacity: 0, duration: 0.25, onComplete: () => { el.note.hidden = true; resolve(); } });
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    el.noteClose.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    // dipanggil saat scene dibongkar (loncat scene): tutup tanpa me-resolve, supaya alur 3D lama tidak lanjut
    cancelNote = () => {
      el.noteClose.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
      gsap.killTweensOf(el.note);
      el.note.hidden = true;
      cancelNote = null;
    };
  });
}

// Tombol akhir (scene 12 versi 3D): "Perbesar TV" memanggil onZoom() → true kalau sekarang diperbesar
let endZoomHandler = null;
function showEnd(onZoom) {
  endZoomHandler = onZoom;
  el.endZoom.textContent = '⤢ Perbesar TV';
  el.endBar.hidden = false;
  gsap.killTweensOf(el.endBar);
  gsap.fromTo(el.endBar, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 });
}
function hideEnd() {
  endZoomHandler = null;
  gsap.killTweensOf(el.endBar);
  el.endBar.hidden = true;
}
el.endZoom.addEventListener('click', () => {
  const zoomed = endZoomHandler?.();
  el.endZoom.textContent = zoomed ? '⤡ Kecilkan TV' : '⤢ Perbesar TV';
});
el.endRestart.addEventListener('click', () => { hideEnd(); goTo(1); });

function confetti() {
  const colors = ['#e4572e', '#f2b134', '#b4d44e', '#3fa7d6', '#f6efe2', '#d16ba5'];
  const W = window.innerWidth, H = window.innerHeight;
  for (let i = 0; i < 140; i++) {
    const c = h('i', { style: `background:${colors[i % colors.length]};left:${Math.random() * W}px;` });
    el.confetti.append(c);
    gsap.fromTo(c,
      { y: -20 - Math.random() * H * 0.4, rotate: Math.random() * 360, opacity: 1 },
      {
        y: H + 40, x: `+=${(Math.random() - 0.5) * 220}`, rotate: `+=${360 + Math.random() * 540}`,
        duration: 2.8 + Math.random() * 2.2, ease: 'power1.in', delay: Math.random() * 0.8,
        onComplete: () => c.remove(),
      });
  }
}

/* ---------------- 3D world (lazy) ---------------- */
let worldPromise = null;
function getWorld() {
  worldPromise ??= import('./world3d.js').then(({ createWorld }) => createWorld({
    canvas: el.gl,
    ui: { setStage, caption, hint, counter, showAction, hideAction, flash, openNote, showEnd, hideEnd, confetti },
    // koper sudah tertutup: kalau toko 3D tersedia, scene 11 berlanjut di ruang yang sama TANPA fade hitam
    // (kamera mundur dari koper, Gasing datang membawa tas tenis); kalau tidak → scene 11 versi 2D dengan fade
    onDone: (inRoom) => {
      if (!inRoom) return goTo(11, { fade: 'black' });
      current = 11;
      setStage(11);
      caption(CONFIG.captions.t11);
    },
    // koper diketuk di toko → langsung scene 5 TANPA fade (satu ruang 3D yang sama; kamera terbang ke gembok)
    onShopOpen: () => { current = 5; setStage(5); },
    // Gasing sudah masuk ke pintu toko antik (scene 3 3D) → scene 4, memudar ke cahaya hangat dari dalam toko
    onStreetDone: () => goTo(4, { fade: 'white' }),
  }));
  return worldPromise;
}

/* ---------------- Scene controller ---------------- */
let current = 0;
let active2d = null;
let gctx = null; // gsap.context untuk scene 2D aktif
let busy = false;

// Scene 3 (jalan Surabaya), scene 4 (toko antik) & scene 11–12 (bola + TV CRT, masih di toko yang sama) tampil 3D;
// kalau WebGL / modul 3D gagal → otomatis pakai versi 2D (scenes2d.js)
const is3D = (n) => n >= 3 && n <= 12;

function mount2D(n) {
  el.gl.hidden = true;
  el.stage.hidden = false;
  document.body.dataset.mode = '2d';
  const key = n === 12 ? 11 : n;
  const live = () => current === n;
  const ctx = {
    next: (opts) => live() && goTo(n === 4 ? 5 : n + 1, opts),
    caption: (t) => live() && caption(t),
    showAction: (l, fn) => live() && showAction(l, fn),
    setStage: (k) => live() && setStage(k),
    confetti,
    restart: () => goTo(1),
    at12: n === 12,
  };
  const scene = SCENES_2D[key](ctx);
  active2d = scene;
  el.stage.append(scene.el);
  setStage(key);
  gctx = gsap.context(() => {});
  requestAnimationFrame(() => gctx?.add(() => scene.enter?.()));
}

// force (debug): boleh memotong transisi yang sedang berjalan. Transisi lama berhenti di `stale()` berikutnya.
let navId = 0;
async function goTo(n, { fade: fadeColor = 'black', force = false } = {}) {
  if (busy && !force) return;
  busy = true;
  const id = ++navId;
  const stale = () => id !== navId;
  if (force) gsap.killTweensOf(el.fader);
  await fade(1, fadeColor);
  if (stale()) return;

  // bongkar scene lama
  active2d?.exit?.();
  gctx?.revert();
  active2d = null; gctx = null;
  el.stage.replaceChildren();
  cancelNote?.();
  hideAction(); hint(null); counter(null); hideEnd();

  current = n;
  if (is3D(n)) {
    el.stage.hidden = true;
    el.gl.hidden = false;
    document.body.dataset.mode = '3d';
    let world = null;
    try {
      world = await getWorld();
      if (stale()) return;
      world.start();
      if (n === 3) {
        world.enterStreet();   // melempar error kalau jalan 3D tidak bisa dibangun → cadangan 2D di bawah
        setStage(3);
      } else if (n === 4) {
        world.enterShop();
        setStage(4);
      } else if (n >= 11) {
        const run = world.enterTV(n);   // melempar error kalau toko 3D tidak ada → cadangan 2D di bawah
        setStage(n);
        run.catch((err) => console.error(err));
      } else {
        setStage(n);
        world.enterStage(n).catch((err) => console.error(err));
      }
    } catch (err) {
      console.error(err);
      if (n === 3 || n === 4 || n >= 11) {
        console.warn('Scene 3D gagal, memakai versi 2D.');
        world?.stop();
        mount2D(n);
      } else {
        showError('Gagal memuat scene 3D. Cek koneksi internet lalu muat ulang halaman.');
      }
    }
  } else {
    (await worldPromise?.catch(() => null))?.stop();
    if (stale()) return;
    mount2D(n);
  }

  await fade(0, fadeColor, 0.6);
  if (stale()) return;
  busy = false;
}

function showError(msg) {
  el.error.replaceChildren(
    h('p', {}, msg),
    h('button', { class: 'btn', onclick: () => location.reload() }, 'Muat ulang'));
  el.error.hidden = false;
}

/* ---------------- Musik ---------------- */
let bgm = null;
async function setupMusic() {
  if (!(await mediaExists(CONFIG.assets.bgm))) return;
  bgm = new Audio(CONFIG.assets.bgm);
  bgm.loop = true;
  bgm.volume = 0.5;
  el.mute.hidden = false;
  el.mute.addEventListener('click', () => {
    bgm.muted = !bgm.muted;
    el.mute.classList.toggle('is-muted', bgm.muted);
  });
}

/* ---------------- Start ---------------- */
const params = new URLSearchParams(location.search);
const startScene = Math.min(TOTAL, Math.max(1, parseInt(params.get('scene') ?? '1', 10) || 1));
const musicReady = setupMusic();

let started = false;
async function begin(n) {
  if (started) return;
  started = true;
  el.startBtn.disabled = true;
  getWorld().catch((err) => console.warn('3D preload gagal:', err)); // preload selama scene 2D
  await musicReady;
  bgm?.play().catch(() => {});
  gsap.to(el.start, { opacity: 0, duration: 0.5, onComplete: () => el.start.remove() });
  goTo(n);
}
el.startBtn.addEventListener('click', () => begin(startScene));

/* ---------------- Debug mode (?debug) ---------------- */
if (params.has('debug')) {
  gsap.ticker.lagSmoothing(0); // animasi tetap normal di tab latar

  const debugJump = (n, { force = false } = {}) => {
    n = Math.min(TOTAL, Math.max(1, n));
    if (!started) return begin(n);
    if (n === stage && !force) return;
    const url = new URL(location.href);
    url.searchParams.set('scene', n);          // reload tetap di scene ini
    history.replaceState(null, '', url);
    goTo(n, { force: true });
  };

  debugPanel = createDebugPanel({
    total: TOTAL, titles: TITLES,
    getScene: () => stage, jump: debugJump,
    onSkipFadeChange: (v) => { skipFade = v; },
  });
  debugPanel.update(stage);
  window.__debug = { jump: debugJump, get scene() { return stage; } };
}

gsap.from('.start > *', { y: 24, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out' });
gsap.to('.start-gasing', { rotate: 6, y: -8, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
