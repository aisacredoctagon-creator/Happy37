// ============================================================
//  DEBUG MODE — panel untuk loncat antar scene
//  Aktif hanya kalau URL memakai ?debug (mis. http://localhost:5173/?debug)
//    [  /  ]   scene sebelumnya / berikutnya
//    `         sembunyikan / tampilkan panel
//  Panel juga bisa dipakai di HP (tombol ◀ ▶ dan grid 1–12).
// ============================================================
import { h } from './assets.js';

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

  const root = h('aside', { class: 'dbg', 'aria-label': 'Panel debug' },
    h('div', { class: 'dbg-head' }, toggle, title),
    h('div', { class: 'dbg-body' },
      h('div', { class: 'dbg-row' }, prev, next, redo),
      h('div', { class: 'dbg-grid' }, ...cells),
      h('label', { class: 'dbg-check' }, fadeBox, ' lewati fade transisi')));
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
