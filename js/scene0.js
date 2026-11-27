// ============================================================
//  SCENE 0 — halaman pembuka di depan Stasiun Gambir
//  Lapisan diambil dari Figma "Frame 3" (1298×689) dan diposisikan
//  dengan koordinat aslinya (dalam % panggung), urutan belakang → depan:
//  langit → awan (melayang) → pohon atas → kota+Monas → kereta (sesekali
//  berangkat/datang) → atap peron → stasiun → jalan → pot → plakat → tombol
//  "Mulai Perjalanan →" → indikator tap → Gasing → bus.
//
//  Game langsung membuka environment ini. Setelah semua aset (gambar, Gasing 3D, audio) siap, muncul indikator "Tap untuk mulai" di jalan
//  sisi kanan. Tap di mana saja = gestur pengguna: audio.unlock() → start(). Sebelum tap: bus & Gasing tidak terlihat, tidak ada
//  animasi (selain indikator) dan tidak ada audio.
//
//  Urutan (start()): bus datang dari kanan & berhenti → pintu (di sisi jauh, tak terlihat kamera) terbuka → Gasing muncul dari BALIK bus
//  (bus di depan Gasing, seperti versi lama) → melambai 1× → pintu menutup, bus berangkat → Gasing berjalan ke depan stasiun (menghadap arah
//  jalan) lalu berputar menghadap kamera → plakat + tombol. SEMUA mengikuti jam audio 'bus gerak.mp3' (jadwal di konstanta T / AUDIO_CUT).
//  Setelah itu bus sesekali lewat dari kanan ke kiri.
// ============================================================
import { gsap } from 'gsap';
import { CONFIG } from './config.js';
import { h } from './assets.js';
import { createGasing3D } from './gasing3d.js';
import { audio } from './audio.js';
import { FADE } from './audio-manifest.js';

const S0 = CONFIG.assets.s0;
const FW = 1298, FH = 689; // ukuran frame Figma

const pct = (v, of) => `${(v / of * 100).toFixed(3)}%`;
const box = (x, y, w, hh) => `left:${pct(x, FW)};top:${pct(y, FH)};width:${pct(w, FW)};height:${pct(hh, FH)}`;
const layer = (cls, src, [x, y, w, hh], alt = '') =>
  h('img', { class: `s0-layer ${cls}`, src, alt, draggable: 'false', decoding: 'async', style: box(x, y, w, hh) });

// Plakat judul + tombol mulai: kanan atas, di antara pohon dan atap peron (posisi dari mock-up; rasio gambar tetap)
const PLAQUE = [733, 50, 528, 259];   // 1200×589
const BTN = [857, 310, 283, 73];      // 800×206
// Indikator tap: di jalan sisi kanan, tempat bus nanti muncul
const TAP = [900, 492, 300, 170];

// Kereta: kotak diam di peron. Berangkat ke kanan sampai lewat tepi panggung,
// datang lagi dari balik gedung stasiun (dinding kanan gedung setinggi kereta ada di x ≈ 730).
const TRAIN = [802, 410, 440, 75];
const STATION_R = 730;
const TRAIN_OUT = ((FW - TRAIN[0]) / TRAIN[2]) * 100 + 4;                 // xPercent: ekor kereta lewat tepi kanan
const TRAIN_IN = ((STATION_R - (TRAIN[0] + TRAIN[2])) / TRAIN[2]) * 100 - 8; // xPercent: moncong masih di balik stasiun

// Bus: gambar menghadap kiri; datang dari tepi kanan panggung, berhenti (PARK_X), lalu lewat ke kiri.
const BUS_W = 960, BUS_H = BUS_W * 620 / 1662;                              // bus.png 1662×620
const BUS = [FW, 678 - BUS_H * 0.997, BUS_W, BUS_H];                        // roda menapak di lajur jalan (dasar roda ≈ 99,7% tinggi gambar)
const PARK_X = 690;                                                         // tepi kiri bus saat berhenti
const BUS_PARK = ((PARK_X - FW) / BUS_W) * 100;                             // xPercent saat berhenti
const BUS_OUT = -((FW + BUS_W) / BUS_W) * 100 - 4;                          // xPercent: seluruh bus lewat tepi kiri
const DOOR_X = PARK_X + BUS_W * 0.536;                                      // pintu tengah bus (sisi jauh dari kamera, tidak terlihat)
const BUS_TRAVEL = (BUS_PARK - BUS_OUT) / 100 * BUS_W;                      // jarak total bus berangkat (px frame)

// Gasing: berdiri di trotoar depan pintu kiri stasiun (posisi akhir).
const GAS = { cx: 355, feet: 537, h: 187 };
const GAS_W = GAS.h * 1000 / 1193;                                          // elemen punya rasio 1000:1193
// Offset (xPercent/yPercent dari posisi akhir) untuk titik (tengah x, kaki y) di koordinat frame
const gasAt = (cx, feet) => ({ xPercent: (cx - GAS.cx) / GAS_W * 100, yPercent: (feet - GAS.feet) / GAS.h * 100 });
// Gasing turun lewat pintu di sisi JAUH bus: mulai di balik bus (bus menutupinya, layer bus di depan Gasing), berjalan di balik bus ke arah
// moncong, lalu muncul di depan moncong bus (kiri) dan berhenti untuk melambai.
const GAS_HIDDEN = gasAt(DOOR_X, 600);    // di balik bus, di depan pintu
const GAS_FRONT = gasAt(585, 575);        // di depan moncong bus (bus mulai di x = 690; Gasing selebar ±157)

// Jadwal intro (detik pada JAM AUDIO = posisi FILE 'bus gerak.mp3', bukan timer terpisah). Timestamp dari pengguna (±); ubah di sini.
// Audio dipotong saat playback (file & kecepatan tetap): bagian datang [arrivalFrom → arrivalTo], bagian tengah dibuang, lalu bagian
// berangkat [departFrom → akhir], disambung crossfade daya-sama selebar xfade (dipusatkan di sambungan). arrivalTo harus SETELAH lambaian
// selesai; departFrom = sesaat sebelum pintu menutup (±00:24), supaya suara pintu menutup terdengar SEBELUM bus bergerak (busGo).
const AUDIO_CUT = { arrivalFrom: 3.0, arrivalTo: 13.4, departFrom: 23.4, xfade: 0.8 };
const T = {
  busEnter: AUDIO_CUT.arrivalFrom,   // bus mulai tampak di tepi kanan, tepat saat tap (suara mendekat; −32 dB naik ke −22 dB)
  busStop: 6.5,      // bus berhenti PENUH — harus sebelum doorOpen (volume mesin sudah stabil ±6 dtk)
  doorOpen: 7.5,     // suara pintu terbuka (±00:07–00:08) — pintu di sisi jauh, tanpa gambar
  busGo: 24.2,       // bus mulai bergerak: ±00:24, sedikit SETELAH suara pintu menutup (≈23,5–24)
  busGone: 30.7,     // seluruh bus sudah lewat tepi kiri (suara memudar sampai ujung file 36,96 dtk)
};
const G_HOP = 0.8;                       // detik per lompatan (≥ 0,75 = durasi hop() internal Gasing; sama dengan jeda hop() jalan di scene 3/4)
const G_OUT = T.doorOpen + 0.5;          // Gasing mulai berjalan di balik bus
const G_HOPS_OUT = 3;                    // lompatan dari pintu ke moncong bus
const G_FRONT_AT = G_OUT + G_HOPS_OUT * G_HOP;   // sampai di depan moncong bus (≈ 10,4)
const G_WAVE_AT = G_FRONT_AT + 0.3;      // melambai 1× (gestur 'wave' dengan speed WAVE_SPEED ≈ 2,6 dtk) — selesai ≈ 13,3 < arrivalTo
const WAVE_SPEED = 1.35;                 // = GESTURE_TIMING.tempo: gestur diputar pada kecepatan asli (tanpa perlambatan) supaya satu lambaian singkat
const G_HOPS_WALK = 3;                   // lompatan dari depan bus ke depan pintu stasiun (mulai tepat saat bus berangkat)
const TURN_T = 0.7;                      // detik melaporkan arah "menghadap kamera" setelah berhenti (Gasing berputar halus)
const WALK_DIR = [-2.2, -0.3];           // kecepatan relatif kamera (kanan, mendekat) saat berjalan ke kiri-sedikit-menjauh → heading ≈ −1,7 rad (menghadap kiri)
const FACE_CAM = [0.34, 1];              // heading ≈ 0,33 rad = yaw awal Gasing (menghadap kamera, sedikit ke kanan)
const BAG_SIDE_IDLE = 1.1;               // bagSide saat diam menghadap kamera (sama dengan createGasing3D di bawah & scene 1–2)
const TITLE_AT = T.busGo + (T.busGone - T.busGo) * Math.sqrt((PARK_X + BUS_W - BTN[0]) / BUS_TRAVEL);   // ekor bus sudah lewat tombol → plakat & tombol muncul
const HOP_VOLUME = 0.5;                  // boing × volume 'hop' di manifest — pelan
const READY_TIMEOUT = 20000;             // ms: indikator tap tetap muncul walau ada aset yang macet

// Awan: [gambar, lebar % panggung, atas %, durasi detik, offset awal 0–1] — melayang pelan ke kanan, berulang
const CLOUDS = [
  [0, 25.6, 12, 210, 0.08], [2, 20.1, 10, 250, 0.62], [1, 14.3, 20, 180, 0.80],
  [1, 11.7, 4, 230, 0.35], [2, 15.1, 16, 270, 0.95], [0, 17.8, 2, 300, 0.50],
];

const rand = (a, b) => a + Math.random() * (b - a);

// Ikon jari (garis, isi putih) untuk indikator tap
const FINGER_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11l5.1.9a2 2 0 0 1 1.6 1.4l1.2 4.6A4 4 0 0 1 15 22h-3a4 4 0 0 1-3.2-1.6L5.2 15.4a1.6 1.6 0 0 1 2.5-2z"/></svg>';

/**
 * Membangun panggung scene 0 di dalam `root` (section#start) dan memindahkan tombol mulai ke bawah papan nama.
 * @param {HTMLElement} root
 * @param {HTMLButtonElement} startBtn
 * @param {{ onStart?: () => void }} [opts]  onStart: dipanggil saat intro benar-benar dimulai (setelah tap + audio terbuka)
 * @returns {{ enter(): Promise, introDone: Promise, destroy(): void }}
 */
export function mountScene0(root, startBtn, { onStart } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clouds = h('div', { class: 's0-clouds', 'aria-hidden': 'true' },
    ...CLOUDS.map(([i, w, top, dur, at]) => h('img', {
      src: S0.clouds[i], alt: '', draggable: 'false', decoding: 'async',
      style: `width:${w}%;top:${top}%;animation-duration:${dur}s;animation-delay:${-(dur * at).toFixed(1)}s`,
    })));

  const train = layer('s0-train', S0.train, TRAIN, 'Kereta di peron');
  // Perpanjangan kota di kanan (cermin dari sisi kiri gambar kota, seperti di Figma)
  const skylineX = h('div', { class: 's0-layer s0-skyline-x', 'aria-hidden': 'true', style: box(1155, 145, 282, 324) },
    h('img', { src: S0.skyline, alt: '', draggable: 'false', decoding: 'async' }));
  const busImg = h('img', { src: S0.bus, alt: '', draggable: 'false', decoding: 'async' });
  const bus = h('div', { class: 's0-layer s0-bus', 'aria-hidden': 'true', style: box(...BUS) }, busImg);

  const gasing = createGasing3D({ label: 'Gasing menunggu di depan pintu stasiun sambil membawa tas tenis', className: 's0-gasing', yaw: 0.35, bag: true, bagSide: BAG_SIDE_IDLE });   // tas raket di punggung, digeser ke kiri layar supaya terlihat (nilai sama dengan S12_BAG_SIDE di scenes2d.js)
  gasing.style.cssText = `left:${pct(GAS.cx - GAS_W / 2, FW)};bottom:${pct(FH - GAS.feet, FH)};height:${pct(GAS.h, FH)}`;
  startBtn.classList.add('s0-btn');   // tersembunyi sampai Gasing sampai di depan stasiun (class is-in)
  startBtn.setAttribute('aria-label', 'Mulai Perjalanan');
  startBtn.style.setProperty('--btn-img', `url("${new URL(S0.button, document.baseURI).href}")`);   // mask kilau saat hover (URL absolut: url() di variabel CSS dihitung dari lokasi stylesheet)
  startBtn.replaceChildren(
    h('img', { src: S0.button, alt: '', draggable: 'false', decoding: 'async' }),
    h('span', { class: 's0-btn-shine', 'aria-hidden': 'true' }));
  // Pembungkus seukuran tombol di bawah plakat: hover/scale terjadi di dalamnya, jadi posisinya tidak bergeser
  const btnAnchor = h('div', { class: 's0-btn-anchor', style: box(...BTN) }, startBtn);

  // Indikator tap: ikon jari + dua ripple berdenyut + teks. Muncul setelah aset siap, hilang saat tap.
  const tapIco = h('span', { class: 's0-tap-ico' });
  tapIco.innerHTML = FINGER_SVG;
  const tapHint = h('div', { class: 's0-tap', 'aria-hidden': 'true', style: box(...TAP) }, tapIco, h('span', { class: 's0-tap-txt' }, 'Tap untuk mulai'));

  const stage = h('div', { class: 's0-stage' },
    layer('s0-sky', S0.sky, [-476, -202, 1774, 671]),
    clouds,
    layer('s0-tree-r', S0.treeR, [847, 0, 451, 211]),
    layer('s0-tree-r s0-flip', S0.treeR, [847, -211, 451, 211]),   // sambungan ke atas (cermin) untuk layar yang lebih tinggi dari panggung
    layer('s0-skyline', S0.skyline, [722, 145, 433, 324]),
    skylineX,
    train,
    layer('s0-platform', S0.platform, [685, 328, 613, 184]),
    layer('s0-station', S0.station, [-275.08, 30, 1133.08, 502.59], 'Stasiun Gambir'),
    layer('s0-street', S0.street, [-476, 503, 1774, 186]),
    layer('s0-planter', S0.planter, [812, 441, 199, 101]),
    layer('s0-sign', S0.plaque, PLAQUE, `Sebuah perjalanan kecil untuk ${CONFIG.recipient}`),
    btnAnchor,
    tapHint,
    gasing,                                    // Gasing di depan tombol, DI BELAKANG bus (bus = lapisan paling depan)
    layer('s0-tree-l', S0.treeL, [0, 0, 451, 211]),
    layer('s0-tree-l s0-flip', S0.treeL, [0, -211, 451, 211]),
    bus);
  root.prepend(stage);

  const ctx = gsap.context(() => {});
  const run = (fn) => ctx.add(fn);
  const later = (s, fn) => run(() => gsap.delayedCall(s, fn));

  // Keadaan awal = DIAM. Sebelum tap tidak ada yang berjalan: tidak ada tween/timer GSAP, awan berhenti (CSS .is-running), bus di luar tepi
  // kanan, plakat & Gasing tersembunyi, tidak ada audio. Panggung baru tampil (fade) setelah semua aset siap.
  const plaque = root.querySelector('.s0-sign');
  run(() => {
    gsap.set(stage, { opacity: 0 });
    gsap.set(plaque, { autoAlpha: 0 });
    gsap.set(gasing, { ...GAS_HIDDEN, autoAlpha: 0 });
  });

  // introDone: selesai saat plakat & tombol sudah tampil (main.js memakainya untuk memuat dunia 3D saat layar diam)
  let introDone; const introDonePromise = new Promise((r) => { introDone = r; });
  const BTN_DELAY = 0.55;   // detik setelah plakat mulai muncul
  // Gasing melambai pelan sambil menunggu tombol ditekan (berhenti saat enter())
  let wave = null;
  const waveLoop = () => { if (!gasing.isConnected || entering) return; gasing.gesture?.('wave'); wave = gsap.delayedCall(8, waveLoop); };
  const showButton = () => { startBtn.classList.add('is-in'); introDone(); if (!reduced) wave = gsap.delayedCall(1.0, waveLoop); };
  const showTitle = () => {
    if (reduced) { gsap.set(plaque, { autoAlpha: 1 }); showButton(); return; }
    run(() => {
      gsap.fromTo(plaque, { y: 14, scale: 0.85, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.55, ease: 'back.out(2)', clearProps: 'transform' });   // jangan 'all': posisi plakat ada di style inline
      later(BTN_DELAY, showButton);
    });
  };

  // Boing Gasing: SATU kali per lompatan, dibunyikan tepat di awal lengkung loncat (.call() di timeline). Id 'hop' (boing.mp3): maxVoices 1 + minGap
  // dari manifest → tidak pernah menumpuk. hop({ silent }) = animasi loncat internal Gasing (tas terayun) tanpa suara bawaan, supaya tidak dobel.
  const boing = () => { gasing.hop({ silent: true }); audio.sfx('hop', { volume: HOP_VOLUME }); };

  // Arah hadap Gasing: dilaporkan lewat move() tiap frame (gasing3d.js) — null = tidak melapor (arah terakhir dipertahankan)
  let walkDir = null;
  const startWalk = () => { walkDir = WALK_DIR; gasing.setState('walk'); gasing.setBagSide?.(0); };      // jalan: menghadap arah jalan, tas di punggung (penempelan sama dengan scene 3/4/11)
  const faceCamera = () => { walkDir = FACE_CAM; gasing.setState('idle'); gasing.setBagSide?.(BAG_SIDE_IDLE); };   // berhenti: berputar halus menghadap kamera, tas ke samping seperti scene 1–2
  const endTurn = () => { walkDir = null; };

  // Intro = SATU timeline GSAP yang playhead-nya dikunci ke jam audio (lihat start()). stopIntro() melepasnya.
  let intro = null, tick = null, started = false, armed = false, tapped = false;
  const stopIntro = () => { if (tick) { gsap.ticker.remove(tick); tick = null; } walkDir = null; };

  // Pindah ke scene berikutnya: Gasing berbalik menghadap stasiun lalu berjalan masuk lewat pintu.
  // Mengembalikan Promise yang selesai saat Gasing sudah hilang di dalam stasiun.
  const DOOR = gasAt(402, 497);            // tengah pintu kanan stasiun, di ambang pintu
  let entering = null;
  const enter = () => entering ??= new Promise((resolve) => {
    startBtn.classList.add('is-out');
    audio.fadeOutAmbient(FADE.scene0Out);   // street + sisa suara bus memudar selama Gasing berjalan masuk (keluar scene 0)
    stopIntro();
    disarm();
    if (reduced) { resolve(); return; }
    run(() => {
      gasing.setState('walk');
      // Tas: saat menunggu, tas digeser ke samping badan (bagSide, seperti scene 1–2). Begitu Gasing berbalik & berjalan, pakai penempelan yang SAMA
      // dengan scene yang berjalan (3/4/11): tas di punggung relatif arah hadap. Sisi 1,1 rad + belok ±2,3 rad membuat tas mengitari badan
      // dan "berpindah-pindah" (dan didorong menghindari tangan yang berayun) — lihat setBagSide di gasing3d.js.
      gasing.setBagSide?.(0);
      // Arah hadap mengikuti kecepatan yang dilaporkan lewat move() (gasing3d.js): bergerak ke kanan-belakang → berbalik membelakangi penonton, menghadap stasiun
      wave?.kill();
      const steer = () => gasing.move(0.6, -1.2);
      gsap.ticker.add(steer);
      const s = stage.clientWidth / FW;
      const tl = gsap.timeline({ onComplete: () => { gsap.ticker.remove(steer); resolve(); } });
      const arc = (at) => { tl.to(gasing, { y: -22 * s, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 }, at); tl.call(boing, null, at); };
      tl.call(boing, null, 0)
        .to(gasing, { xPercent: DOOR.xPercent, yPercent: DOOR.yPercent, scale: 0.6, transformOrigin: '50% 100%', duration: 1.7, ease: 'power1.inOut' }, 0.55)
        .to(gasing, { autoAlpha: 0, duration: 0.35, ease: 'power1.in' }, 2.0);
      arc(0.9); arc(1.5); arc(2.1);
    });
  });

  // Bus: badan memantul pelan selama jalan; diam saat berhenti
  let bob;
  run(() => { bob = gsap.to(busImg, { y: '-1.2%', duration: 0.22, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true }); });
  const rolling = (on) => {
    if (on) bob.play();
    else { bob.pause(); run(() => gsap.to(busImg, { y: 0, duration: 0.15 })); }
  };

  // Lewat dari kanan ke kiri, lalu ulangi sesekali (setelah intro; tanpa suara bus — file 'bus gerak' hanya untuk intro)
  const drive = () => run(() => {
    rolling(true);
    gsap.fromTo(bus, { xPercent: 0 }, {
      xPercent: BUS_OUT, duration: 9, ease: 'none',
      onComplete: () => { rolling(false); later(rand(10, 18), drive); },
    });
  });

  /** Tunggu semua gambar panggung ter-decode + Gasing 3D siap (atau gambar cadangan). Tidak pernah menolak. */
  const loadAssets = () => {
    const imgs = [...root.querySelectorAll('img')];
    const decoded = imgs.map((im) => (im.decode ? im.decode() : new Promise((r) => { im.onload = im.onerror = r; })).catch(() => {}));
    const gasingReady = new Promise((res) => {
      const t0 = performance.now();
      const poll = () => {
        if (!gasing.isConnected || gasing.classList.contains('is-fallback') || gasing.querySelector('canvas.is-ready') || performance.now() - t0 > 12000) res();
        else setTimeout(poll, 100);
      };
      poll();
    });
    return Promise.all([...decoded, gasingReady]);
  };

  /**
   * Mulai intro — dipanggil setelah tap (dan audio.unlock()): ambience street fade in, suara bus mulai, dan SEMUA animasi (bus, Gasing, boing)
   * dijadwalkan pada jam audio: playhead = posisi file 'bus gerak.mp3' yang terdengar (dengan bagian tengah dilompati, lihat AUDIO_CUT).
   */
  const start = () => {
    if (started) return;
    started = true;
    root.classList.add('is-running');                       // awan mulai melayang (CSS)
    audio.setScene(0, { force: true });                     // ambience street (fade in), preload hop
    onStart?.();
    if (reduced) {
      // Tanpa gerak: tampilan diam seperti di Figma (bus berhenti di kanan, Gasing sudah di depan stasiun); hanya ambience
      gsap.set(bus, { xPercent: BUS_PARK });
      gsap.set(gasing, { xPercent: 0, yPercent: 0, autoAlpha: 1 });
      showTitle();
      return;
    }
    const snd = audio.playTimed('bus_gerak', { fadeIn: 0.8, fadeOut: 4, xfade: AUDIO_CUT.xfade, segments: [
      { from: AUDIO_CUT.arrivalFrom, to: AUDIO_CUT.arrivalTo },
      { from: AUDIO_CUT.departFrom, to: 36.96 },
    ] });   // null bila audio gagal dimuat → jam cadangan di bawah

    // Jam intro = jam rAF yang HALUS (est), audio hanya acuan sinkron. Jam audio (ctx.currentTime) kasar: diam beberapa frame di awal play lalu loncat,
    // sehingga bus yang dihitung langsung darinya tersendat / sempat mundur. est selalu maju sebesar dt frame × laju; laju disesuaikan perlahan
    // (≤ ±12%, dihaluskan) menuju selisih terhadap audio → sinkron tanpa snap & tanpa mundur. Pengecualian: audio melompat MAJU > 0,6 dtk
    // (sambungan potongan AUDIO_CUT) → est ikut maju (satu arah). Audio berhenti (tab disembunyikan / ctx suspend) → laju ke 0 → visual ikut diam.
    // Jam audio diabaikan selama belum benar-benar berjalan (snd.running()). Tanpa audio: waktu nyata dengan lompatan potongan yang sama.
    const cutAt = AUDIO_CUT.arrivalTo - AUDIO_CUT.arrivalFrom;
    const virt = (e) => (e < cutAt ? AUDIO_CUT.arrivalFrom + e : AUDIO_CUT.departFrom + (e - cutAt));
    let est = AUDIO_CUT.arrivalFrom, last = performance.now(), wall = 0, rate = 1;
    const clock = () => {
      const t = performance.now(), dt = Math.min(0.1, (t - last) / 1000); last = t;
      wall += dt;
      if (!snd) { est = virt(wall); return est; }
      if (snd.ended) { est += dt; return est; }
      if (snd.paused()) return est;                                           // audio di-suspend → visual ikut diam
      const a = snd.time(), err = a - est;
      if (err > 0.6) { est = a; rate = 1; }                                   // lompatan maju (potongan audio)
      else if (snd.running()) {
        const target = err < -0.6 ? 0 : 1 + Math.max(-0.12, Math.min(0.12, err * 0.8));
        rate += (target - rate) * Math.min(1, dt * 6);                        // laju berubah halus (tanpa patah)
        est += dt * rate;
      } else est += dt;                                                       // audio belum jalan: jam halus berjalan sendiri
      return est;
    };

    run(() => {
      const s = stage.clientWidth / FW;      // px per satuan frame
      intro = gsap.timeline({ paused: true });
      // -- Bus datang → BERHENTI PENUH (busStop) → (pintu terbuka, doorOpen: suara) → pintu menutup (suara) → berangkat di busGo
      intro
        .fromTo(bus, { xPercent: 0 }, { xPercent: BUS_PARK, duration: T.busStop - T.busEnter, ease: 'power2.out' }, T.busEnter)
        .call(() => rolling(true), null, T.busEnter)
        .call(() => rolling(false), null, T.busStop)
        .fromTo(busImg, { rotation: 0 }, { rotation: -0.9, transformOrigin: '30% 100%', duration: 0.22, yoyo: true, repeat: 1, ease: 'sine.inOut' }, T.busStop)   // menunduk saat mengerem
        .call(() => rolling(true), null, T.busGo)
        .to(bus, { xPercent: BUS_OUT, duration: T.busGone - T.busGo, ease: 'power1.in' }, T.busGo)   // power1 (kuadrat): kubik hampir tak bergerak ±1 dtk pertama
        .call(() => rolling(false), null, T.busGone);

      // Boing lewat .call() (bukan onStart tween): callback .call() tetap terpanggil walau playhead melompat melewatinya (frame lambat / jeda)
      const arc = (at, hgt) => { intro.to(gasing, { y: -hgt * s, duration: G_HOP / 2, ease: 'power2.out', yoyo: true, repeat: 1 }, at); intro.call(boing, null, at); };
      const squash = (at) => intro.to(gasing, { scaleY: 0.9, scaleX: 1.05, transformOrigin: '50% 100%', duration: 0.1, yoyo: true, repeat: 1, ease: 'sine.inOut' }, at);

      // -- Gasing 1: keluar pintu sisi jauh, berjalan DI BALIK bus (tak terlihat) menghadap arah jalan, muncul di depan moncong bus, menghadap kamera, melambai 1×
      const OUT_T = G_HOPS_OUT * G_HOP;
      intro
        .set(gasing, { autoAlpha: 1 }, G_OUT)
        .call(startWalk, null, G_OUT)
        .to(gasing, { ...GAS_FRONT, duration: OUT_T, ease: 'none' }, G_OUT);
      for (let i = 0; i < G_HOPS_OUT; i++) arc(G_OUT + i * G_HOP, 50);
      squash(G_FRONT_AT);
      intro
        .call(faceCamera, null, G_FRONT_AT).call(endTurn, null, G_FRONT_AT + TURN_T)
        .call(() => gasing.gesture?.('wave', { speed: WAVE_SPEED }), null, G_WAVE_AT);

      // -- Gasing 2: begitu bus berangkat, berjalan ke depan pintu stasiun (menghadap arah jalan), lalu berputar menghadap kamera
      const WALK_T = G_HOPS_WALK * G_HOP;
      intro
        .call(startWalk, null, T.busGo)
        .to(gasing, { xPercent: 0, yPercent: 0, duration: WALK_T, ease: 'none' }, T.busGo);
      for (let i = 0; i < G_HOPS_WALK; i++) arc(T.busGo + i * G_HOP, 55);
      squash(T.busGo + WALK_T);
      intro.call(faceCamera, null, T.busGo + WALK_T).call(endTurn, null, T.busGo + WALK_T + TURN_T);

      // -- Selesai: plakat + tombol "Mulai Perjalanan" (setelah ekor bus lewat tombol), lalu bus sesekali lewat
      intro.call(() => { showTitle(); later(rand(12, 18), drive); }, null, Math.max(TITLE_AT, T.busGo + WALK_T + TURN_T));

      tick = () => {
        const t = clock(), end = intro.duration();
        intro.time(Math.min(t, end), false);
        if (walkDir) gasing.move(walkDir[0], walkDir[1]);
        if (t >= end) stopIntro();
      };
      gsap.ticker.add(tick);
    });

    // Kereta: diam di peron → berangkat ke kanan → (jeda) → datang dari balik stasiun → diam lagi …
    const depart = () => run(() => gsap.to(train, {
      xPercent: TRAIN_OUT, duration: 4.2, ease: 'power2.in',
      onComplete: () => later(rand(3, 6), arrive),
    }));
    const arrive = () => run(() => gsap.fromTo(train, { xPercent: TRAIN_IN }, {
      xPercent: 0, duration: 4.6, ease: 'power3.out',
      onComplete: () => later(rand(8, 14), depart),
    }));
    later(rand(5, 8), depart);
  };

  // ---- Pemicu tap: setelah semua aset (gambar, Gasing 3D, audio) siap → panggung tampil + indikator "Tap untuk mulai". Tap/klik di mana saja
  // di panggung (tombol layar penuh & panel debug ada di luar elemen ini) = gestur pengguna: audio.unlock() sinkron di handler, indikator
  // hilang, lalu start(). Hanya sekali.
  const onTap = () => {
    if (tapped) return;
    tapped = true;
    disarm();
    const opened = audio.unlock();   // di dalam gestur klik (aturan autoplay, termasuk iOS); aman dipanggil berulang
    tapHint.classList.remove('is-on'); tapHint.classList.add('is-out');
    setTimeout(() => tapHint.remove(), 500);
    // Tunggu AudioContext berjalan (beberapa ms) lalu mulai SEMUANYA sekaligus; batas 700 ms supaya tidak menggantung bila resume macet
    Promise.race([opened, new Promise((r) => setTimeout(r, 700))]).then(start);
  };
  function disarm() { if (armed) { armed = false; root.removeEventListener('click', onTap); root.classList.remove('is-armed'); } }
  const ready = Promise.race([
    Promise.all([loadAssets(), audio.preload(audio.soundsForScene(0))]),
    new Promise((r) => setTimeout(r, READY_TIMEOUT)),
  ]).then(() => {
    if (tapped || started || entering) return;
    armed = true;
    root.classList.add('is-armed');
    root.addEventListener('click', onTap);
    run(() => gsap.to(stage, { opacity: 1, duration: 0.5, ease: 'power1.out' }));
    tapHint.classList.add('is-on');
  });

  return { enter, introDone: introDonePromise, ready, destroy: () => { stopIntro(); disarm(); ctx.revert(); } };
}
