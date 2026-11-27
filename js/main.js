import { gsap } from 'gsap';
import { CONFIG } from './config.js';
import { SCENES_2D } from './scenes2d.js';
import { h } from './assets.js';
import { createGasing3D } from './gasing3d.js';
import { createDebugPanel } from './debug.js';
import { audio } from './audio.js';
import { createAudioIndicator } from './audio-indicator.js';

const TITLES = {
  1: 'Tiket', 2: 'Di Kereta', 3: 'Surabaya', 4: 'Toko Antik',
  5: 'Gembok Koper', 6: 'Isi Koper', 7: 'Bagian Kereta', 8: 'Catatan',
  9: 'Kereta Jadi', 10: 'Tutup Koper', 11: 'Bola Tenis', 12: 'Kejutan',
};
const TOTAL = 12;

const $ = (id) => document.getElementById(id);
const el = {
  gl: $('gl'), stage: $('stage2d'),
  action: $('actionBtn'), hint: $('hint'), counter: $('counter'),
  note: $('note'), noteTitle: $('noteTitle'), noteBody: $('noteBody'), noteClose: $('noteClose'),
  flash: $('flash'), fader: $('fader'), confetti: $('confetti'),
  endBar: $('endBar'), endWatch: $('endWatch'), endRestart: $('endRestart'),
  start: $('start'), startBtn: $('startBtn'), startTitle: $('startTitle'),
  mute: $('muteBtn'), error: $('error'),
};

/* ---------------- HUD ---------------- */
el.startTitle.textContent = CONFIG.recipient;
const startGasing = createGasing3D({ className: 'start-gasing', label: 'Karakter Gasing' });
$('startGasing').replaceWith(startGasing);
// Layar awal: Gasing melambai halus, lalu mengulang tiap ±8 detik sampai "Mulai" ditekan (timer di-kill di begin())
let waveCall = null;
const wave = () => { startGasing.gesture?.('wave'); waveCall = gsap.delayedCall(8, wave); };
waveCall = gsap.delayedCall(1.0, wave);

let stage = 0;      // scene yang sedang ditampilkan (1–12), ikut berubah saat alur 3D maju sendiri
let debugPanel = null;

function setStage(n) {
  stage = n;
  debugPanel?.update(n);
  audio.setScene(n);          // musik & ambience scene ini (crossfade), SFX pembuka, preload scene berikutnya
}

// Subtitle/caption dihapus — dibiarkan no-op supaya pemanggil di scene tidak error.
function caption() {}

let actionHandler = null;
function showAction(label, fn, opts = {}) {
  actionHandler = fn;
  el.action.classList.toggle('is-corner', !!opts.corner); // opts.corner: pojok kanan bawah, tengah layar dikosongkan
  if (opts.corner) {
    // tombol pojok (mis. "Turun"): label + panah kanan yang beranimasi
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('class', 'btn-arrow');
    arrow.setAttribute('viewBox', '0 0 24 24');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '<path d="M4 12h15M12.5 5.5 19 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    const text = document.createElement('span');
    text.textContent = label;
    el.action.replaceChildren(text, arrow);
  } else {
    el.action.textContent = label;
  }
  el.action.hidden = false;
  gsap.fromTo(el.action, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)', clearProps: 'all' }); // clearProps: sisa style inline GSAP tidak menimpa hover CSS
}
function hideAction() { el.action.hidden = true; actionHandler = null; }
el.action.addEventListener('click', () => { const fn = actionHandler; audio.sfx('btn_press');   // dipakai tombol "Turun" (scene 2) dan "Tutup Koper" (scene 10)
  hideAction(); fn?.(); });

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
// engraved: tulisan sudah terukir di model 3D (ultra zoom-in) → kertas catatan HTML disembunyikan, hanya tombol ✕ yang tampil
function openNote(part, { engraved = false } = {}) {
  el.note.classList.toggle('is-engraved', engraved);
  el.noteTitle.textContent = part.name;
  el.noteBody.replaceChildren(...part.text.map((s) => h('p', {}, s)));
  el.note.hidden = false;
  if (!engraved) audio.sfx('open_paper');   // surat di scene 10; scene 8 (tulisan terukir) tanpa suara buka/tutup
  gsap.fromTo(el.note.querySelector('.note-paper'), { y: 30, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'power2.out' });
  gsap.fromTo(el.note, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  el.noteClose.focus({ preventScroll: true });
  return new Promise((resolve) => {
    const close = () => {
      cancelNote = null;
      if (!engraved) audio.sfx('close_paper');
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

// Pop-up tombol akhir (scene 12 versi 3D): hanya muncul setelah video selesai / ditutup. "Putar ulang" memanggil onWatch() (zoom in + putar, lihat shop3d.js & tv-player.js)
let endWatchHandler = null;
function showEnd(onWatch, label = '↻ Putar ulang') {
  endWatchHandler = onWatch;
  el.endWatch.hidden = !onWatch;
  el.endWatch.textContent = label;
  el.endBar.hidden = false;
  gsap.killTweensOf(el.endBar);
  gsap.fromTo(el.endBar, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 });
}
function hideEnd() {
  endWatchHandler = null;
  gsap.killTweensOf(el.endBar);
  el.endBar.hidden = true;
}
el.endWatch.addEventListener('click', () => { audio.sfx('btn_press'); endWatchHandler?.(); });
el.endRestart.addEventListener('click', () => { audio.sfx('ui_click'); hideEnd(); goTo(1); });

function confetti() {
  audio.sfx('confetti');
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
    showAction: (l, fn, opts) => live() && showAction(l, fn, opts),
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
  if (n > 2) audio.sfx('whoosh');   // tanpa whoosh saat masuk scene 1 dan 2
  await fade(1, fadeColor);
  if (stale()) return;

  // bongkar scene lama (termasuk semua suaranya: one-shot, loop event, ambience)
  audio.stopScene();
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

/* ---------------- Audio (musik, ambience, SFX: js/audio.js + js/audio-manifest.js) ---------------- */
// Tombol mute lama dipakai ulang untuk semua bus audio.
el.mute.hidden = false;
el.mute.addEventListener('click', () => {
  audio.setMuted(!audio.isMuted());
  el.mute.classList.toggle('is-muted', audio.isMuted());
});

/* ---------------- Jeda otomatis saat tab / aplikasi tidak aktif ---------------- */
// Semua <video>/<audio> (termasuk yang tidak ada di DOM, mis. video TV 3D) didaftarkan saat play(),
// lalu dijeda saat tab disembunyikan dan dilanjutkan saat kembali. Loop render 3D punya jeda sendiri (world3d.js).
const mediaSeen = new Set();
const mediaPaused = new Set();
const nativePlay = HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play = function (...args) { mediaSeen.add(this); return nativePlay.apply(this, args); };
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    for (const m of mediaSeen) if (!m.paused && !m.ended) { m.pause(); mediaPaused.add(m); }
    if (!params.has('debug')) gsap.globalTimeline.pause();
  } else {
    for (const m of mediaPaused) m.play().catch(() => {});
    mediaPaused.clear();
    gsap.globalTimeline.resume();
  }
});

/* ---------------- Start ---------------- */
const params = new URLSearchParams(location.search);
const startScene = Math.min(TOTAL, Math.max(1, parseInt(params.get('scene') ?? '1', 10) || 1));

let started = false;
async function begin(n) {
  if (started) return;
  started = true;
  audio.unlock().then(() => audio.sfx('btn_press'));   // klik tombol "Mulai Perjalanan"   // harus di dalam gestur (klik Mulai / panel debug): aturan autoplay iOS
  waveCall?.kill(); waveCall = null;
  el.startBtn.disabled = true;
  getWorld().catch((err) => console.warn('3D preload gagal:', err)); // preload selama scene 2D
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
  createAudioIndicator({ getScene: () => stage, titles: TITLES });   // nama file audio aktif (hanya ?debug)
  window.__debug = { jump: debugJump, get scene() { return stage; } };
}

gsap.from('.start > *', { y: 24, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out' });
gsap.to('.start-gasing', { rotate: 6, y: -8, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
