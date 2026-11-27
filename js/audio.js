// ============================================================
//  AUDIO — Web Audio API: bus music / ambience / sfx → master → limiter → speaker.
//  Semua path, volume, loop & fade ada di js/audio-manifest.js.
//  - Aktif setelah unlock() (dipanggil dari tombol "Mulai": aturan autoplay, termasuk iOS).
//  - setScene(n): crossfade musik & ambience scene n, preload scene berikutnya.
//  - stopScene(): memudarkan ambience + one-shot scene lama (saat pindah / loncat scene).
//  - sfx(id): one-shot dengan batas suara bersamaan, jarak minimum & variasi pitch (tidak menumpuk keras).
//  - duck(true/false): musik & ambience hampir hening (video ucapan TV).
//  - File yang tidak ada / gagal decode → diabaikan (peringatan sekali), game tidak error.
// ============================================================
import { AUDIO_BASE, BUSES, FADE, DUCK_LEVEL, SOUNDS, SCENES, GLOBAL_SFX } from './audio-manifest.js';

let ctx = null;
let master = null, limiter = null;
const bus = {};            // music / ambience / sfx → GainNode (volume bus)
const duckGain = {};       // music / ambience → GainNode (ducking video TV)
const buffers = new Map(); // id → Promise<AudioBuffer|null>
const warned = new Set();
const voices = new Map();  // id → [{src, gain, t0}] one-shot yang sedang berbunyi
const lastAt = new Map();  // id → waktu pemicu terakhir
const loops = { music: null, ambience: null, extra: new Map() };   // {id, src, gain}
const vol = { ...BUSES };
let muted = false, unlocked = false, wantScene = 0, curScene = 0, ducked = false, silenced = false;
let gameOut = null;   // semua suara game (musik, ambience, SFX) lewat sini; video TV langsung ke master → bisa membisukan game saja
const listeners = new Set();
const failed = new Map();  // id → pesan error (untuk indikator audio mode ?debug)
const sfxLog = new Map();   // id → {n: sedang berbunyi, endAt: waktu selesai/gagal terakhir, fail} (untuk indikator)

const now = () => ctx.currentTime;
const notify = () => listeners.forEach((fn) => { try { fn(); } catch {} });

function warnOnce(id, msg) { failed.set(id, msg); if (!warned.has(id)) { warned.add(id); console.warn(`[audio] ${msg}`); } }

/** Muat & decode satu suara (sekali). Tidak ada / gagal → null, tanpa melempar. */
function load(id) {
  if (buffers.has(id)) return buffers.get(id);
  const def = SOUNDS[id];
  if (!def) { warnOnce(id, `id tidak dikenal: ${id}`); buffers.set(id, Promise.resolve(null)); return buffers.get(id); }
  const p = fetch(AUDIO_BASE + def.file)
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
    .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))   // bentuk callback: Safari lama
    .catch((err) => { notify(); warnOnce(id, `gagal memuat ${def.file} (${err?.message || err}) — suara dilewati`); return null; });
  buffers.set(id, p);
  return p;
}
const sceneIds = (n) => {
  const s = SCENES[n]; if (!s) return [];
  return [s.music, s.ambience, ...(s.onEnter || []), ...(s.preload || [])].filter(Boolean);
};
function preloadScene(n) { if (ctx) sceneIds(n).forEach(load); }

function makeGraph() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  ctx.onstatechange = notify;
  master = ctx.createGain();
  limiter = ctx.createDynamicsCompressor();   // pengaman: mencegah clipping saat banyak suara bertumpuk
  limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 12;
  limiter.attack.value = 0.003; limiter.release.value = 0.15;
  master.connect(limiter).connect(ctx.destination);
  gameOut = ctx.createGain(); gameOut.connect(master);
  for (const k of ['music', 'ambience', 'sfx']) {
    bus[k] = ctx.createGain();
    if (k !== 'sfx') { duckGain[k] = ctx.createGain(); bus[k].connect(duckGain[k]).connect(gameOut); }
    else bus[k].connect(gameOut);
  }
  applyVolumes(0);
}
function applyVolumes(t = 0.05) {
  if (!ctx) return;
  const ramp = (param, v) => { param.cancelScheduledValues(now()); param.setTargetAtTime(v, now(), Math.max(0.001, t / 3)); };
  ramp(master.gain, muted ? 0 : vol.master);
  for (const k of ['music', 'ambience', 'sfx']) ramp(bus[k].gain, vol[k]);
}

/** Dipanggil dari gestur pengguna (tombol Mulai). Aman dipanggil berkali-kali. */
export async function unlock() {
  if (!ctx) makeGraph();
  try { await ctx.resume(); } catch {}
  if (!unlocked) {
    // iOS: mainkan buffer hening sekali di dalam gestur agar output benar-benar terbuka
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
    unlocked = true;
    GLOBAL_SFX.forEach(load);
    Object.keys(SOUNDS).forEach((id) => { if (SOUNDS[id].bus !== 'music') load(id); });   // preload semua SFX & ambience; musik (file besar) dipreload per scene
    if (wantScene) setScene(wantScene, { force: true });
  }
  notify();
}

/** Loop (musik / ambience) dengan crossfade. slot: 'music' | 'ambience' | 'extra:<id>' */
async function playLoop(slot, id, fade = FADE.crossfade) {
  const cur = slot.startsWith('extra:') ? loops.extra.get(id) : loops[slot];
  if (cur && cur.id === id) return;                       // sama → lanjut tanpa restart (musik tetap konsisten)
  stopLoop(slot, fade);
  if (!id) return;
  const def = SOUNDS[id];
  const entry = { id, src: null, gain: null, cancelled: false };
  if (slot.startsWith('extra:')) loops.extra.set(id, entry); else loops[slot] = entry;
  const buf = await load(id);
  if (!buf && !entry.cancelled) { entry.failed = true; notify(); }
  if (!buf || entry.cancelled || !ctx) return;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = def.loop !== false;
  const g = ctx.createGain(); g.gain.value = 0;
  src.connect(g).connect(bus[def.bus] || bus.sfx);
  src.start(0, slot === 'music' ? 0 : Math.random() * buf.duration);   // ambience mulai di titik acak → tidak terasa mengulang
  g.gain.setTargetAtTime(def.volume ?? 1, now(), Math.max(0.01, fade / 4));   // fade-in halus (≈98% pada detik ke-fade)
  entry.src = src; entry.gain = g;
  notify();
}
function stopLoop(slot, fade = FADE.stop) {
  const entry = slot.startsWith('extra:') ? loops.extra.get(slot.slice(6)) : loops[slot];
  if (!entry) return;
  entry.cancelled = true;
  if (slot.startsWith('extra:')) loops.extra.delete(slot.slice(6)); else loops[slot] = null;
  notify();
  if (entry.src && ctx) {
    entry.gain.gain.cancelScheduledValues(now());
    entry.gain.gain.setTargetAtTime(0, now(), Math.max(0.01, fade / 4));   // fade-out halus; src dihentikan setelah ≈ -45 dB (tanpa klik)
    const src = entry.src;
    setTimeout(() => { try { src.stop(); src.disconnect(); } catch {} }, (fade * 1.4 + 0.3) * 1000);
  }
}

/** Scene aktif berubah (termasuk lanjut otomatis di dunia 3D): crossfade musik & ambience, SFX onEnter, preload scene berikut. */
export function setScene(n, { force = false } = {}) {
  wantScene = n;
  if (!ctx || !unlocked) return;
  if (n === curScene && !force) return;
  curScene = n;
  const s = SCENES[n] || {};
  playLoop('music', s.music || null, FADE.music);
  playLoop('ambience', s.ambience || null, s.ambience ? undefined : FADE.ambienceOut);   // tanpa ambience di scene ini → fade-out ±1,5 dtk lalu stop total
  (s.onEnter || []).forEach((id) => sfx(id));
  preloadScene(n);
  preloadScene(n + 1);
  notify();
}

/** Bongkar scene: hentikan one-shot & loop tambahan scene lama, pudarkan ambience (musik diteruskan bila scene baru sama). */
export function stopScene() {
  if (!ctx) return;
  curScene = 0;
  for (const id of [...loops.extra.keys()]) stopLoop('extra:' + id, FADE.stop);
  stopLoop('ambience', FADE.stop);
  for (const [, vs] of voices) for (const v of vs) fadeOut(v, 0.12);
  voices.clear();
  if (ducked) duck(false);
}
function fadeOut(v, t) {
  try { v.gain.gain.cancelScheduledValues(now()); v.gain.gain.setTargetAtTime(0, now(), t / 4); v.src.stop(now() + t * 1.4 + 0.05); } catch {}
}

/**
 * One-shot. opts: { volume (×), rate (×), detune } — volume/rate dikalikan dengan manifest.
 * Dibatasi maxVoices & minGap per id supaya pemicu beruntun (pantulan, loncat, klik roda) tidak menumpuk keras.
 */
export function sfx(id, opts = {}) {
  if (!ctx || !unlocked || muted || silenced) return;
  const def = SOUNDS[id]; if (!def) { warnOnce(id, `id tidak dikenal: ${id}`); return; }
  const t = now();
  if (def.minGap && t - (lastAt.get(id) ?? -9) < def.minGap) return;
  lastAt.set(id, t);
  load(id).then((buf) => {
    if (silenced) return;                      // dibisukan saat jeda panggilan (mis. video TV): tidak ada SFX terjadwal yang lolos
    if (!buf || !ctx) { sfxLog.set(id, { n: 0, endAt: Date.now(), fail: true }); notify(); return; }
    const list = voices.get(id) || [];
    const max = def.maxVoices ?? 4;
    while (list.length >= max) fadeOut(list.shift(), 0.04);   // suara tertua memudar cepat
    const src = ctx.createBufferSource(); src.buffer = buf;
    const [lo, hi] = def.pitch || [1, 1];
    let rate = (lo + Math.random() * (hi - lo)) * (opts.rate ?? 1);
    if (opts.fit) rate = Math.min(1.3, Math.max(0.6, buf.duration / opts.fit));   // opts.fit (detik): suara dipaskan ke durasi animasi
    src.playbackRate.value = rate;
    const g = ctx.createGain(), T = ctx.currentTime, vol = Math.min(1.5, (def.volume ?? 1) * (opts.volume ?? 1));
    g.gain.setValueAtTime(0, T);
    if (opts.fit) {   // envelope: fade-in (opts.fadeIn), tahan, fade-out selesai TEPAT saat animasi berhenti (opts.fit)
      const fi = Math.min(opts.fadeIn ?? 0.5, opts.fit / 2), fo = Math.min(opts.fadeOut ?? 0.5, opts.fit / 2);
      g.gain.linearRampToValueAtTime(vol, T + fi);
      g.gain.setValueAtTime(vol, T + opts.fit - fo);
      g.gain.linearRampToValueAtTime(0, T + opts.fit);
    } else g.gain.linearRampToValueAtTime(vol, T + 0.005);   // fade-in 5 ms: tanpa klik di awal, hentakan tetap terdengar
    src.connect(g).connect(bus[def.bus] || bus.sfx);
    src.start();
    if (opts.fit) src.stop(T + opts.fit + 0.03);
    const v = { src, gain: g, t0: t };
    list.push(v); voices.set(id, list);
    const rec = sfxLog.get(id) || { n: 0, endAt: 0, fail: false }; rec.n++; rec.fail = false; sfxLog.set(id, rec); notify();
    src.onended = () => { rec.n = Math.max(0, rec.n - 1); rec.endAt = Date.now(); notify(); const l = voices.get(id); if (l) { const i = l.indexOf(v); if (i >= 0) l.splice(i, 1); } try { src.disconnect(); g.disconnect(); } catch {} };
  });
}

/** Putar satu id acak dari daftar; id yang sama tidak terpilih dua kali berturut-turut (per daftar). */
const lastPick = new Map();
export function sfxAny(ids, opts) {
  const key = ids.join('|'), last = lastPick.get(key);
  const pool = ids.length > 1 ? ids.filter((i) => i !== last) : ids;
  const id = pool[Math.floor(Math.random() * pool.length)];
  lastPick.set(key, id);
  sfx(id, opts);
}

/** Loop tambahan yang dikendalikan event (mis. statis TV). */
export function startLoop(id, fade = 0.15) { if (ctx && unlocked) playLoop('extra:' + id, id, fade); }
export function stopLoopId(id, fade = 0.25) { stopLoop('extra:' + id, fade); }

/** Video ucapan TV: musik & ambience turun hampir hening, lalu naik lagi. */
/**
 * Bisukan SEMUA suara game (BGM, ambience, SFX, termasuk yang sudah terjadwal / sedang berbunyi) — dipakai saat video TV diputar.
 * Hanya audio video (attachMedia → master) yang terdengar. on=false → suara game kembali normal (fade in).
 */
export function silenceGame(on, fade = 0.4) {
  silenced = !!on;
  if (!ctx) return;
  gameOut.gain.cancelScheduledValues(now());
  gameOut.gain.setTargetAtTime(on ? 0 : 1, now(), Math.max(0.01, fade / 4));
  notify();
}
export const isSilenced = () => silenced;

export function duck(on) {
  ducked = !!on;
  if (!ctx) return;
  for (const k of ['music', 'ambience']) {
    const p = duckGain[k].gain;
    p.cancelScheduledValues(now());
    p.setTargetAtTime(on ? DUCK_LEVEL : 1, now(), FADE.duck / 3);
  }
  notify();
}

/** Hubungkan <video>/<audio> ke graf audio game (master → limiter): ikut mute, tidak pecah, dan bisa di-fade (juga di iOS). Mengembalikan {fade(target, detik)} atau null bila audio belum aktif. */
const mediaCtl = new WeakMap();
export function attachMedia(el) {
  if (!ctx || !unlocked || !el) return null;
  let m = mediaCtl.get(el);
  if (!m) {
    const g = ctx.createGain(); g.gain.value = 0;
    ctx.createMediaElementSource(el).connect(g).connect(master);
    m = { fade(to, sec = 0.4) { g.gain.cancelScheduledValues(now()); g.gain.setTargetAtTime(Math.max(0, to), now(), Math.max(0.005, sec / 4)); } };
    mediaCtl.set(el, m);
  }
  return m;
}

/** Ikat ke <video>: play → duck, pause / ended → kembali normal. */
export function bindDuckToMedia(video) {
  if (!video || video.__audioDuck) return;
  video.__audioDuck = true;
  video.addEventListener('play', () => duck(true));
  video.addEventListener('pause', () => duck(false));
  video.addEventListener('ended', () => duck(false));
}

export function setMuted(m) { muted = !!m; applyVolumes(0.15); notify(); }
export const isMuted = () => muted;
export function setBusVolume(name, v) { vol[name] = Math.max(0, Math.min(1.5, +v || 0)); applyVolumes(0.05); notify(); }
export const getBusVolume = (name) => vol[name];
export const isReady = () => !!ctx && unlocked;
export const soundIds = () => Object.keys(SOUNDS);
/** Foto status untuk indikator audio (?debug): loop aktif, SFX aktif / baru selesai, kegagalan, mute, jeda. */
export function getStatus() {
  const loop = (e) => e && { id: e.id, file: SOUNDS[e.id]?.file || e.id, playing: !!e.src, failed: !!e.failed || failed.has(e.id) };
  return {
    ready: !!ctx && unlocked, muted,
    paused: !!ctx && unlocked && ctx.state === 'suspended',
    music: loop(loops.music), ambience: loop(loops.ambience),
    extra: [...loops.extra.values()].map(loop),
    sfx: [...sfxLog].map(([id, r]) => ({ id, file: SOUNDS[id]?.file || id, playing: r.n > 0, endAt: r.endAt, fail: r.fail })),
  };
}
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
/** Untuk tombol uji di panel debug: loop diputar 3 detik saja. */
export function preview(id) {
  const def = SOUNDS[id]; if (!def || !ctx) return;
  if (!def.loop) return sfx(id);
  startLoop(id, 0.05);
  setTimeout(() => stopLoopId(id, 0.3), 3000);
}

/* Jeda saat tab / aplikasi tidak aktif, lanjut saat kembali */
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else if (unlocked) ctx.resume().catch(() => {});
});

export const audio = { unlock, setScene, stopScene, sfx, sfxAny, attachMedia, silenceGame, isSilenced, startLoop, stopLoopId, duck, bindDuckToMedia, setMuted, isMuted, setBusVolume, getBusVolume, isReady, soundIds, getStatus, onChange, preview };
