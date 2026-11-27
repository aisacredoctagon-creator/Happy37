// ============================================================
//  PEMAIN VIDEO TV (scene 12) — kontrol minimalis di atas layar saat TV di-zoom:
//  play/pause · progress bar (bisa digeser) · mute + volume. Menutup video: Escape, atau tombol ✕ layar penuh (#fsBtn, main.js → closeActiveTVPlayer). Kontrol tersembunyi otomatis saat video berjalan,
//  muncul lagi saat mouse bergerak / layar disentuh. Autoplay bersuara diblokir → tombol play besar (tidak pernah diputar diam-diam).
//  Audio video lewat graf audio game (audio.attachMedia): ikut mute game, ada limiter, fade-in/out halus.
//  Semua suara game dibisukan saat video diputar (audio.silenceGame) dan kembali setelah selesai / ditutup (jeda video TIDAK mengembalikannya).
// ============================================================
import { audio } from './audio.js';

const FADE_IN = 0.5, FADE_OUT = 0.45, END_FADE = 0.7, HIDE_AFTER = 2600;
const fmt = (t) => { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pemain yang sedang aktif (satu saja): dipakai main.js supaya tombol ✕ layar penuh ikut menutup video. */
let current = null;
export function closeActiveTVPlayer() { return current?.close(); }

export function createTVPlayer(video, { onExit } = {}) {
  const mk = (tag, cls, attrs = {}, text) => { const e = document.createElement(tag); e.className = cls; for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text) e.textContent = text; return e; };
  const root = mk('div', 'tvp'); root.hidden = true;
  const hit = mk('div', 'tvp-hit');
  const big = mk('button', 'tvp-big', { type: 'button', 'aria-label': 'Klik untuk memutar' }, '▶'); big.hidden = true;
  const bigHint = mk('span', 'tvp-big-hint', {}, 'Klik untuk memutar');
  const bar = mk('div', 'tvp-bar');
  const play = mk('button', 'tvp-btn', { type: 'button', 'aria-label': 'Putar / jeda' }, '⏸');
  const time = mk('span', 'tvp-time', {}, '0:00');
  const prog = mk('input', 'tvp-prog', { type: 'range', min: '0', max: '1000', value: '0', step: '1', 'aria-label': 'Posisi video' });
  const mute = mk('button', 'tvp-btn', { type: 'button', 'aria-label': 'Bisukan / suarakan' }, '🔊');
  const volume = mk('input', 'tvp-vol', { type: 'range', min: '0', max: '1', value: '1', step: '0.05', 'aria-label': 'Volume' });
  bar.append(play, time, prog, mute, volume);
  big.append(bigHint);
  root.append(hit, big, bar);
  document.body.appendChild(root);

  let active = false, userMuted = false, vol = 1, media = null, hideT = 0, endFaded = false, finishing = false;
  const level = () => (userMuted ? 0 : vol);
  const setGain = (to, sec) => { if (media) media.fade(to, sec); else video.volume = Math.min(1, to); };

  function showControls() {
    root.classList.remove('is-idle');
    clearTimeout(hideT);
    if (active && !video.paused && big.hidden) hideT = setTimeout(() => root.classList.add('is-idle'), HIDE_AFTER);
  }
  function sync() {
    play.textContent = video.paused ? '▶' : '⏸';
    mute.textContent = userMuted || vol === 0 ? '🔇' : '🔊';
    const d = video.duration || 0;
    time.textContent = fmt(video.currentTime) + ' / ' + fmt(d);
    if (!prog.matches(':active')) prog.value = d ? String(Math.round((video.currentTime / d) * 1000)) : '0';
    prog.style.setProperty('--p', (Number(prog.value) / 10) + '%');
  }

  async function startPlayback() {            // dipanggil setelah zoom in selesai
    big.hidden = true;
    try {
      await video.play();
      setGain(0, 0.001); setGain(level(), FADE_IN);   // fade-in awal video
      audio.silenceGame(true);                           // semua suara game (BGM, ambience, SFX) dibisukan: hanya audio video
    } catch {
      big.hidden = false;                                // diblokir browser → tombol play besar
    }
    sync(); showControls();
  }
  async function togglePause() {
    if (!active) return;
    if (video.paused) {
      try { await video.play(); setGain(level(), 0.15); big.hidden = true; } catch { big.hidden = false; }
    } else { setGain(0, 0.06); await sleep(70); video.pause(); }
    sync(); showControls();
  }
  async function finish(info) {
    if (!active || finishing) return;
    finishing = true; active = false;
    root.classList.add('is-leaving');
    if (!info.ended) { setGain(0, FADE_OUT); await sleep(FADE_OUT * 1000); }   // ditutup di tengah: fade-out dulu
    video.pause();
    root.hidden = true; root.classList.remove('is-leaving');
    audio.silenceGame(false, 1.0);                                              // suara game kembali normal (fade in)
    finishing = false;
    if (current === api) current = null;
    onExit?.(info);
  }

  hit.addEventListener('pointermove', showControls);
  hit.addEventListener('pointerdown', showControls);
  hit.addEventListener('click', () => { if (root.classList.contains('is-idle')) showControls(); else togglePause(); });
  bar.addEventListener('pointermove', showControls);
  play.addEventListener('click', togglePause);
  big.addEventListener('click', async () => { if (video.ended) video.currentTime = 0; await startPlayback(); });
  mute.addEventListener('click', () => { userMuted = !userMuted; setGain(level(), 0.15); sync(); });
  volume.addEventListener('input', () => { vol = Number(volume.value); userMuted = false; setGain(level(), 0.05); sync(); });
  prog.addEventListener('input', () => { if (video.duration) { video.currentTime = (Number(prog.value) / 1000) * video.duration; endFaded = false; sync(); } });
  video.addEventListener('timeupdate', () => {
    if (!active) return;
    sync();
    const left = (video.duration || 0) - video.currentTime;
    if (!endFaded && left > 0 && left < END_FADE + 0.1) { endFaded = true; setGain(0, END_FADE); }   // fade-out akhir video
    else if (endFaded && left > END_FADE + 0.6) { endFaded = false; setGain(level(), 0.2); }          // digeser mundur
  });
  video.addEventListener('ended', () => { if (active) finish({ ended: true }); });
  video.addEventListener('pause', () => { if (active) { sync(); showControls(); } });
  video.addEventListener('play', () => { if (active) { sync(); showControls(); } });
  window.addEventListener('keydown', (e) => {
    if (!active) return;
    if (e.key === 'Escape') finish({ ended: false });
    else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); togglePause(); }
  });

  const api = {
    close() { return finish({ ended: false }); },
    /** Dipanggil di dalam gestur pengguna (klik / ketuk): membuka kunci putar video, supaya iOS mengizinkan play() setelah zoom. */
    prime() {
      media = media || audio.attachMedia(video);
      setGain(0, 0.001);
      const p = video.play();
      if (p?.then) p.then(() => video.pause()).catch(() => {});
    },
    /** Setelah zoom in selesai: tampilkan kontrol & putar dari awal. */
    async start() {
      media = media || audio.attachMedia(video);
      active = true; endFaded = false; finishing = false; current = api;
      root.hidden = false; root.classList.remove('is-idle', 'is-leaving');
      video.currentTime = 0;
      await startPlayback();
    },
    /** Tutup tanpa animasi (scene dibongkar): hentikan semuanya, kembalikan musik. */
    abort() {
      if (current === api) current = null;
      const was = active; active = false; finishing = false; clearTimeout(hideT);
      root.hidden = true; big.hidden = true;
      if (was || !video.paused) { try { video.pause(); } catch {} }
      setGain(0, 0.05);
      audio.silenceGame(false, 0.2);
    },
    get active() { return active; },
  };
  return api;
}
