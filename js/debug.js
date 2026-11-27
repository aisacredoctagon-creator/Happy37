// ============================================================
//  DEBUG MODE — panel untuk loncat antar scene
//  Aktif hanya kalau URL memakai ?debug (mis. http://localhost:5173/?debug)
//    [  /  ]   scene sebelumnya / berikutnya
//    `         sembunyikan / tampilkan panel
//  Panel juga bisa dipakai di HP (tombol ◀ ▶ dan grid 1–12).
// ============================================================
import { h } from './assets.js';
import { GESTURE_NAMES, getGasingEls, THUMB_SOTO } from './gasing3d.js';
import { audio } from './audio.js';
import { BUBBLE_OFFSET } from './street3d.js';
import { SOUNDS } from './audio-manifest.js';

// Alat uji audio di panel debug: tombol putar tiap suara + slider volume per bus. false = sembunyikan.
const AUDIO_TOOLS = true;

/** Panel audio: slider bus (master/music/ambience/sfx) + tombol putar per id (loop diputar 3 detik). */
function audioTools() {
  const note = h('small', { class: 'dbg-audio-note' }, 'Audio aktif setelah tombol Mulai / loncat scene.');
  const rows = ['master', 'music', 'ambience', 'sfx'].map((b) => {
    const val = h('span', { class: 'dbg-thumb-val' }, String(audio.getBusVolume(b)));
    const input = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: audio.getBusVolume(b) });
    input.addEventListener('input', () => { audio.setBusVolume(b, +input.value); val.textContent = input.value; });
    return h('label', { class: 'dbg-thumb-row' }, h('span', {}, 'bus ' + b), input, val);
  });
  const btns = h('div', { class: 'dbg-grid dbg-grid3' }, ...Object.entries(SOUNDS).map(([id, d]) =>
    h('button', { class: 'dbg-cell dbg-g', type: 'button', title: d.file + (d.loop ? ' (loop, diputar 3 detik)' : ''), onclick: () => audio.preview(id) }, (d.loop ? '↻ ' : '') + id)));
  const body = h('div', { class: 'dbg-gest dbg-thumb' }, note, ...rows, btns);
  const toggle = h('button', { class: 'dbg-btn dbg-wide', type: 'button', onclick: () => body.classList.toggle('is-open') }, '🔊 audio');
  audio.onChange(() => { note.hidden = audio.isReady(); });
  return [toggle, body];
}

// Slider posisi speech bubble scene 3 (X / Y sebagai pecahan lebar / tinggi scene). false = sembunyikan.
const BUBBLE_TUNER = true;

function bubbleTuner() {
  const spec = [['x', 'X (kanan +  /  kiri −)', -0.4, 0.4, 0.005], ['y', 'Y (bawah +  /  atas −)', -0.4, 0.4, 0.005]];
  const text = () => `export const BUBBLE_OFFSET = { x: ${+BUBBLE_OFFSET.x.toFixed(3)}, y: ${+BUBBLE_OFFSET.y.toFixed(3)}, free: ${BUBBLE_OFFSET.free} };`;
  const out = h('code', { class: 'dbg-thumb-out' }, text());
  const rows = spec.map(([k, label, min, max, step]) => {
    const val = h('span', { class: 'dbg-thumb-val' }, String(BUBBLE_OFFSET[k]));
    const input = h('input', { type: 'range', min, max, step, value: BUBBLE_OFFSET[k] });
    input.addEventListener('input', () => { BUBBLE_OFFSET[k] = +input.value; val.textContent = input.value; out.textContent = text(); });
    return h('label', { class: 'dbg-thumb-row' }, h('span', {}, label), input, val);
  });
  const free = h('input', { type: 'checkbox' });
  free.checked = BUBBLE_OFFSET.free;
  free.addEventListener('change', () => { BUBBLE_OFFSET.free = free.checked; out.textContent = text(); });
  const reset = h('button', { class: 'dbg-btn dbg-wide', type: 'button', onclick: () => { Object.assign(BUBBLE_OFFSET, { x: -0.06, y: 0.11 }); rows.forEach((r, i) => { const v = BUBBLE_OFFSET[spec[i][0]]; r.querySelector('input').value = v; r.querySelector('.dbg-thumb-val').textContent = String(v); }); out.textContent = text(); } }, '↺ reset');
  const copy = h('button', { class: 'dbg-btn dbg-wide', type: 'button', onclick: async () => {
    try { await navigator.clipboard.writeText(text()); copy.textContent = '✓ tersalin'; } catch { copy.textContent = 'pilih & Ctrl+C'; }
    setTimeout(() => { copy.textContent = '⧉ salin nilai'; }, 1500);
  } }, '⧉ salin nilai');
  const body = h('div', { class: 'dbg-gest dbg-thumb' }, ...rows, h('label', { class: 'dbg-fade' }, free, ' abaikan anti-tabrakan'), h('div', { class: 'dbg-row' }, reset, copy), out);
  const toggle = h('button', { class: 'dbg-btn dbg-wide', type: 'button', onclick: () => body.classList.toggle('is-open') }, '💬 speech bubble');
  return [toggle, body];
}

// Kontrol sementara: slider pose jempol tangan mangkuk saat makan soto (scene 3 / tombol "eat"). false = sembunyikan.
const THUMB_TUNER = true;

/** Slider THUMB_SOTO (mengubah objek konstanta langsung → terlihat di frame berikutnya) + tombol salin nilai. */
function thumbTuner() {
  const spec = [   // [kunci, label, min, max, step]
    ['x', 'pangkal X (kanan)', -0.6, 0.6, 0.01], ['y', 'pangkal Y (atas)', -0.6, 0.6, 0.01], ['z', 'pangkal Z (ke kamera)', -0.6, 0.6, 0.01],
    ['rot', 'rotasi ruas pangkal °', -90, 210, 1], ['bend1', 'tekuk sendi tengah °', -40, 130, 1], ['bend2', 'tekuk sendi ujung °', -40, 130, 1],
    ['tilt', 'condong ke kamera °', -60, 60, 1],
  ];
  const text = () => `export const THUMB_SOTO = { ${spec.map(([k]) => `${k}: ${+THUMB_SOTO[k].toFixed(3)}`).join(', ')} };`;
  const out = h('code', { class: 'dbg-thumb-out' }, text());
  const rows = spec.map(([k, label, min, max, step]) => {
    const val = h('span', { class: 'dbg-thumb-val' }, String(THUMB_SOTO[k]));
    const input = h('input', { type: 'range', min, max, step, value: THUMB_SOTO[k] });
    input.addEventListener('input', () => { THUMB_SOTO[k] = +input.value; val.textContent = input.value; out.textContent = text(); });
    return h('label', { class: 'dbg-thumb-row' }, h('span', {}, label), input, val);
  });
  const copy = h('button', { class: 'dbg-btn dbg-wide', type: 'button', onclick: async () => {
    try { await navigator.clipboard.writeText(text()); copy.textContent = '✓ tersalin'; }
    catch { const r = document.createRange(); r.selectNodeContents(out); getSelection().removeAllRanges(); getSelection().addRange(r); copy.textContent = 'pilih & Ctrl+C'; }
    setTimeout(() => { copy.textContent = '⧉ salin nilai'; }, 1500);
  } }, '⧉ salin nilai');
  const eat = h('button', { class: 'dbg-btn dbg-wide', type: 'button', onclick: () => getGasingEls().forEach((g) => g.setState?.('eat')) }, 'eat');
  const body = h('div', { class: 'dbg-gest dbg-thumb' }, ...rows, h('div', { class: 'dbg-row' }, eat, copy), out);
  const toggle = h('button', { class: 'dbg-btn dbg-wide', type: 'button', onclick: () => body.classList.toggle('is-open') }, '👍 jempol soto');
  return [toggle, body];
}

export function createDebugPanel({ total, titles, getScene, jump, onSkipFadeChange }) {
  const cells = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    return h('button', { class: 'dbg-cell', type: 'button', title: titles[n], onclick: () => jump(n) }, String(n));
  });
  const title = h('span', { class: 'dbg-title' });
  const prev = h('button', { class: 'dbg-btn', type: 'button', title: 'Scene sebelumnya  [', onclick: () => jump(getScene() - 1) }, '◀');
  const next = h('button', { class: 'dbg-btn', type: 'button', title: 'Scene berikutnya  ]', onclick: () => jump(getScene() + 1) }, '▶');
  const redo = h('button', { class: 'dbg-btn dbg-wide', type: 'button', title: 'Ulangi scene ini', onclick: () => jump(getScene(), { force: true }) }, '↻ ulang');
  const fadeBox = h('input', { type: 'checkbox' });
  fadeBox.addEventListener('change', () => onSkipFadeChange(fadeBox.checked));
  const toggle = h('button', { class: 'dbg-toggle', type: 'button', title: 'Sembunyikan / tampilkan  `', onclick: () => root.classList.toggle('is-min') }, 'DEBUG');

  // Uji animasi tangan Gasing: memicu state / hop / wobble / gestur pada semua Gasing yang sedang tampil
  const eachG = (fn) => getGasingEls().forEach((g) => { try { fn(g); } catch (err) { console.error(err); } });
  const gBtn = (label, fn, title) => h('button', { class: 'dbg-cell dbg-g', type: 'button', title: title || label, onclick: () => eachG(fn) }, label);
  const gestBody = h('div', { class: 'dbg-gest' },
    h('div', { class: 'dbg-grid dbg-grid3' },
      ...['idle', 'walk', 'eat'].map((s) => gBtn(s, (g) => g.setState?.(s), `setState('${s}')`)),
      gBtn('hop', (g) => g.hop?.()), gBtn('wobble', (g) => g.wobble?.())),
    h('div', { class: 'dbg-grid dbg-grid3' }, ...GESTURE_NAMES.map((n) => gBtn(n, (g) => g.gesture?.(n), `gesture('${n}')`))));
  const gestToggle = h('button', { class: 'dbg-btn dbg-wide', type: 'button', onclick: () => gestBody.classList.toggle('is-open') }, '✋ gestur tangan');

  const root = h('aside', { class: 'dbg', 'aria-label': 'Panel debug' },
    h('div', { class: 'dbg-head' }, toggle, title),
    h('div', { class: 'dbg-body' },
      h('div', { class: 'dbg-row' }, prev, next, redo),
      h('div', { class: 'dbg-grid' }, ...cells),
      h('label', { class: 'dbg-check' }, fadeBox, ' lewati fade transisi'),
      gestToggle, gestBody,
      ...(THUMB_TUNER ? thumbTuner() : []),
      ...(BUBBLE_TUNER ? bubbleTuner() : []),
      ...(AUDIO_TOOLS ? audioTools() : [])));
  document.body.append(root);

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea')) return;
    if (e.key === '[') jump(getScene() - 1);
    else if (e.key === ']') jump(getScene() + 1);
    else if (e.key === '`') root.classList.toggle('is-min');
  });

  return {
    /** dipanggil main.js setiap scene/stage berubah */
    update(n) {
      title.textContent = n ? `Scene ${n} · ${titles[n]}` : 'belum mulai';
      cells.forEach((c, i) => c.classList.toggle('is-current', i + 1 === n));
      prev.disabled = n <= 1;
      next.disabled = n >= total;
    },
  };
}
