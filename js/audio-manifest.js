// ============================================================
//  AUDIO MANIFEST — satu-satunya tempat mengatur suara.
//  Ganti suara: taruh file baru di assets/audio/… lalu ubah `file` di SOUNDS (atau timpa file lama dengan nama sama).
//  Volume = 0–1 relatif terhadap bus-nya. Daftar lengkap + sumber/lisensi: AUDIO.md & assets/audio/CREDITS.md.
// ============================================================

export const AUDIO_BASE = 'assets/audio/';

/** Volume awal tiap bus (0–1). Musik paling pelan di latar, ambience di bawah musik, SFX interaksi paling jelas. */
export const BUSES = { master: 0.9, music: 0.32, ambience: 0.22, sfx: 0.85 };

/** Detik. crossfade = ganti musik/ambience antar scene · stop = memudar saat scene dibongkar · duck = turun/naik saat video TV. */
export const FADE = { crossfade: 1.0, stop: 1.0, duck: 1.0, music: 1.0, ambienceOut: 1.5 };
// FADE.music (detik) = fade in saat musik mulai, fade out saat berhenti, dan crossfade antar lagu berbeda (ambience tetap memakai crossfade/stop).

/** Saat video ucapan di TV diputar, musik & ambience dikali angka ini (hening penuh, fade ±1 dtk). */
/** Volume ambience detak jam toko antik (0–1, relatif bus ambience). SATU nilai untuk semua scene: ubah di sini untuk tuning. (0,49 → 0,25 = turun ±50%) */
export const CLOCK_VOLUME = 0.25;

export const DUCK_LEVEL = 0;

/**
 * id → { file, bus, volume, loop?, pitch?: [min, max] (variasi acak), maxVoices?: suara bersamaan maks, minGap?: detik antar-pemicu }
 * bus: 'music' | 'ambience' | 'sfx'
 */
const GLASS_VOLUME = 0.2;   // glass up / glass down (satu file: glass.mp3)
export const SOUNDS = {
  // ---- musik (loop utuh)
  journey:   { file: 'music/journey.mp3',   bus: 'music', volume: 1.0, loop: true },   // perjalanan ceria (tidak dipakai lagi: diganti 'perjalanan' / 'toko')
  shop:      { file: 'music/shop.mp3',      bus: 'music', volume: 0.9, loop: true },   // toko antik, tenang (tidak dipakai lagi)
  celebrate: { file: 'music/celebrate.mp3', bus: 'music', volume: 1.0, loop: true },   // kejutan / ucapan (scene 12)
  perjalanan: { file: 'music/lagu di perjalanan.mp3', bus: 'music', volume: 1.0, loop: true },   // scene 2–3 (nama file berspasi: di-encode saat fetch)
  toko:       { file: 'music/lagu di toko antik.mp3',  bus: 'music', volume: 0.9, loop: true },   // scene 4–11
  // ---- ambience (loop tanpa sambungan)
  station:  { file: 'amb/ambience stasiun.mp3',  bus: 'ambience', volume: 0.8, loop: true },
  train:    { file: 'amb/train.mp3',    bus: 'ambience', volume: 1.0, loop: true },
  street:   { file: 'amb/street.mp3',   bus: 'ambience', volume: 0.8, loop: true },
  clock:    { file: 'amb/clock.mp3',    bus: 'ambience', volume: CLOCK_VOLUME, loop: true },
  tvstatic: { file: 'amb/tvstatic.mp3', bus: 'ambience', volume: 0.9, loop: true },   // dinyalakan/dimatikan oleh event TV (scene 12)
  // ---- SFX: antarmuka & transisi
  ui_start: { file: 'sfx/ui_start.mp3', bus: 'sfx', volume: 0.61 },
  ui_click: { file: 'sfx/ui_click.mp3', bus: 'sfx', volume: 0.94, pitch: [0.95, 1.05], maxVoices: 2, minGap: 0.05 },
  ui_close: { file: 'sfx/ui_close.mp3', bus: 'sfx', volume: 0.6 },
  whoosh:   { file: 'sfx/whoosh.mp3',   bus: 'sfx', volume: 0.61, pitch: [0.9, 1.1], maxVoices: 1, minGap: 0.2 },
  // ---- SFX: tombol, zoom & klik cetakan (scene 1, 2, 3, 8, 10)
  btn_press: { file: 'sfx/game button press.mp3', bus: 'sfx', volume: 0.83, maxVoices: 2, minGap: 0.05 },   // tombol Mulai Perjalanan, Turun, Tutup Koper, ketuk di scene 3
  zoom2:     { file: 'sfx/zoom 2.mp3', bus: 'sfx', volume: 0.63, maxVoices: 1 },                            // zoom kedua ke tulisan terukir (scene 8)
  click_1:   { file: 'sfx/click 1.mp3', bus: 'sfx', volume: 0.96, maxVoices: 1 },                            // part masuk cetakan (scene 8): satu dari tiga, acak
  click_2:   { file: 'sfx/click 2.mp3', bus: 'sfx', volume: 0.84, maxVoices: 1 },
  click_3:   { file: 'sfx/click 3.mp3', bus: 'sfx', volume: 0.84, maxVoices: 1 },
  // ---- SFX: Gasing
  hop:      { file: 'sfx/boing.mp3',    bus: 'sfx', volume: 0.6,  pitch: [0.95, 1.08], maxVoices: 1, minGap: 0.2 },   // boing saat maskot melompat (maxVoices 1: tidak menumpuk)
  spoon_a:  { file: 'sfx/spoon_a.mp3',  bus: 'sfx', volume: 0.96, pitch: [0.95, 1.05], maxVoices: 1, minGap: 0.3 },
  spoon_b:  { file: 'sfx/spoon_b.mp3',  bus: 'sfx', volume: 0.96, pitch: [0.95, 1.05], maxVoices: 1, minGap: 0.3 },
  nom:      { file: 'sfx/nom.mp3',      bus: 'sfx', volume: 0.62, pitch: [0.9, 1.1], maxVoices: 1, minGap: 0.4 },
  // ---- SFX: scene 1–4
  station_chime: { file: 'sfx/station chime.mp3', bus: 'sfx', volume: 0.65 },
  paper:     { file: 'sfx/paper.mp3',     bus: 'sfx', volume: 0.96 },
  stamp:     { file: 'sfx/stamp.mp3',     bus: 'sfx', volume: 0.6 },
  shop_bell: { file: 'sfx/bell chime.mp3', bus: 'sfx', volume: 0.63 },
  glass_up:  { file: 'sfx/glass.mp3',  bus: 'sfx', volume: GLASS_VOLUME },   // pelan, tidak mencolok
  glass_down:{ file: 'sfx/glass.mp3',  bus: 'sfx', volume: GLASS_VOLUME },
  // ---- SFX: koper & kereta (scene 5–10)
  lock_tick:  { file: 'sfx/lock_tick.mp3',  bus: 'sfx', volume: 0.61, pitch: [0.95, 1.08], maxVoices: 3, minGap: 0.03 },
  lock_open:  { file: 'sfx/lock_open.mp3',  bus: 'sfx', volume: 0.73 },
  lid_open:   { file: 'sfx/lid_open.mp3',   bus: 'sfx', volume: 0.6 },
  lid_close:  { file: 'sfx/lid_close.mp3',  bus: 'sfx', volume: 0.61 },
  case_latch: { file: 'sfx/case_latch.mp3', bus: 'sfx', volume: 0.96 },
  open_paper:  { file: 'sfx/open paper.mp3',  bus: 'sfx', volume: 0.77 },   // buka surat (scene 10)
  close_paper: { file: 'sfx/paper close.mp3', bus: 'sfx', volume: 0.6 },   // fade in 60 ms / out 140 ms dibakar di file (0,31 dtk)   // tutup surat (scene 10)
  note_open:  { file: 'sfx/note_open.mp3',  bus: 'sfx', volume: 0.61 },
  note_close: { file: 'sfx/note_close.mp3', bus: 'sfx', volume: 0.59 },
  part_place: { file: 'sfx/part_place.mp3', bus: 'sfx', volume: 0.61, pitch: [0.95, 1.05] },
  part_chime: { file: 'sfx/part_chime.mp3', bus: 'sfx', volume: 0.6 },
  assembled:  { file: 'sfx/assembled.mp3',  bus: 'sfx', volume: 0.6 },
  lift_train: { file: 'sfx/lift train.mp3', bus: 'sfx', volume: 0.35, maxVoices: 1 },   // kereta terangkat / ditaruh kembali (dipanggil dengan opts.fit = durasi animasi; fade in/out 0,5 dtk)
  // ---- SFX: bola & TV (scene 11–12)
  ball_pop:    { file: 'sfx/ball_pop.mp3',    bus: 'sfx', volume: 0.6 },
  ball_bounce: { file: 'sfx/ball_bounce.mp3', bus: 'sfx', volume: 0.61, pitch: [0.95, 1.1], maxVoices: 2, minGap: 0.06 },
  tv_on:       { file: 'sfx/tv_on.mp3',       bus: 'sfx', volume: 0.84 },
  confetti:    { file: 'sfx/confetti.mp3',    bus: 'sfx', volume: 0.6 },
};

/**
 * Suasana per scene: music & ambience (crossfade otomatis), onEnter = SFX sekali saat scene dimulai,
 * preload = SFX yang dipakai scene ini (dimuat bersama scene; scene berikutnya dipreload di latar).
 */
export const SCENES = {
  1:  { ambience: 'station', onEnter: ['station_chime'], preload: ['paper', 'stamp'] },   // tanpa musik
  2:  { music: 'perjalanan', ambience: 'train', preload: ['toko'] },   // lagu toko dimuat lebih awal (file besar)
  3:  { music: 'perjalanan', ambience: 'street', preload: ['spoon_a', 'spoon_b', 'nom', 'shop_bell'] },
  4:  { music: 'toko', ambience: 'clock', preload: ['glass_up'] },
  5:  { music: 'toko', ambience: 'clock', preload: ['lock_tick', 'lock_open', 'lid_open'] },
  6:  { music: 'toko', ambience: 'clock', preload: ['note_open', 'note_close', 'part_place'] },
  7:  { music: 'toko', ambience: 'clock', preload: ['note_open', 'note_close', 'part_place'] },
  8:  { music: 'toko', ambience: 'clock', preload: ['note_open', 'note_close', 'part_place'] },
  9:  { music: 'toko', ambience: 'clock', preload: ['lid_close', 'case_latch'] },
  10: { music: 'toko', ambience: 'clock', preload: ['lid_close', 'case_latch', 'glass_down'] },
  11: { music: 'toko', preload: ['glass_down', 'ball_pop', 'ball_bounce'] },
  12: { music: 'celebrate', preload: ['tv_on', 'tvstatic', 'confetti'] },
};

/** SFX yang dipakai di semua scene (dimuat saat tombol Mulai ditekan). */
export const GLOBAL_SFX = ['ui_start', 'ui_click', 'ui_close', 'whoosh', 'hop', 'btn_press'];
