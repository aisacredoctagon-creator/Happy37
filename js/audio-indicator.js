// ============================================================
//  INDIKATOR AUDIO — hanya dipakai di testing mode (?debug). Dibuat dari main.js; mode normal tidak memuat/menampilkannya.
//  Membaca status dari audio.getStatus() (js/audio.js), tanpa kode tambahan di scene.
// ============================================================
import { audio } from './audio.js';

const HOLD_MS = 1000;   // SFX yang sudah selesai tetap tampil sebentar supaya SFX pendek terbaca

export function createAudioIndicator({ getScene, titles = {} }) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;pointer-events:none;max-width:60vw;padding:6px 9px;'
    + 'background:rgba(0,0,0,.6);color:#fff;font:12px/1.4 monospace;border-radius:6px;white-space:pre-wrap;word-break:break-all';
  document.body.appendChild(box);
  const line = (parent, text, red) => {
    const d = document.createElement('div'); d.textContent = text;
    if (red) d.style.color = '#ff5a5a';
    parent.appendChild(d);
  };

  function render() {
    const st = audio.getStatus(), t = Date.now();
    box.replaceChildren();
    const n = getScene();
    line(box, `Scene: ${n}${titles[n] ? ' · ' + titles[n] : ''}${st.muted ? '  [MUTED]' : ''}${st.paused ? '  [PAUSED]' : ''}`);
    if (!st.ready) { line(box, 'Audio belum aktif (menunggu tombol Mulai)', true); return; }
    const loopLine = (label, e) => {
      if (e) line(box, `${label}: ${e.failed ? '✖ ' : ''}${e.file}${e.failed ? ' (GAGAL)' : e.playing ? ' (loop)' : ' (memuat…)'}`, e.failed);
      else line(box, `${label}: -`);
    };
    loopLine('♪ Music', st.music);
    loopLine('≈ Ambience', st.ambience);
    st.extra.forEach((e) => loopLine('↻ Loop', e));
    const sfx = st.sfx.filter((s) => s.playing || t - s.endAt < HOLD_MS);
    if (!sfx.length) line(box, '🔊 SFX: -');
    sfx.forEach((s) => line(box, `🔊 SFX: ${s.fail ? '✖ ' : ''}${s.file}${s.fail ? ' (GAGAL)' : ''}`, s.fail));
  }

  render();
  audio.onChange(render);
  setInterval(render, 250);   // menghapus SFX setelah masa tahan & ikut ganti scene
  return { render };
}
