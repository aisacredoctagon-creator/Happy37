// ============================================================
//  SCENE 0 — halaman pembuka di depan Stasiun Gambir
//  Lapisan diambil dari Figma "Frame 3" (1298×689) dan diposisikan
//  dengan koordinat aslinya (dalam % panggung), urutan belakang → depan:
//  langit → awan (melayang) → pohon atas → kota+Monas → kereta (sesekali
//  berangkat/datang) → atap peron → stasiun → jalan → pot → Gasing →
//  papan nama → tombol "Mulai Perjalanan →" → bus.
//
//  Urutan animasi:
//   1) Pertama kali dibuka: bus datang dari kanan, berhenti, MENURUNKAN Gasing
//      (Gasing meloncat keluar dari pintu bus ke depan pintu stasiun), lalu bus jalan lagi ke kiri.
//   2) Setelah itu bus sesekali lewat dari kanan ke kiri.
// ============================================================
import { gsap } from 'gsap';
import { CONFIG } from './config.js';
import { h } from './assets.js';
import { createGasing3D } from './gasing3d.js';

const S0 = CONFIG.assets.s0;
const FW = 1298, FH = 689; // ukuran frame Figma

const pct = (v, of) => `${(v / of * 100).toFixed(3)}%`;
const box = (x, y, w, hh) => `left:${pct(x, FW)};top:${pct(y, FH)};width:${pct(w, FW)};height:${pct(hh, FH)}`;
const layer = (cls, src, [x, y, w, hh], alt = '') =>
  h('img', { class: `s0-layer ${cls}`, src, alt, draggable: 'false', decoding: 'async', style: box(x, y, w, hh) });

// Plakat judul + tombol mulai: kanan atas, di antara pohon dan atap peron (posisi dari mock-up; rasio gambar tetap)
const PLAQUE = [733, 30, 528, 259];   // 1200×589
const BTN = [857, 290, 283, 73];      // 800×206

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
const DOOR_X = PARK_X + BUS_W * 0.536;                                      // pintu tengah bus

// Gasing: berdiri di trotoar depan pintu kiri stasiun (posisi akhir).
const GAS = { cx: 355, feet: 537, h: 187 };
const GAS_W = GAS.h * 1000 / 1193;                                          // elemen punya rasio 1000:1193
// Offset (xPercent/yPercent dari posisi akhir) untuk titik (tengah x, kaki y) di koordinat frame
const gasAt = (cx, feet) => ({ xPercent: (cx - GAS.cx) / GAS_W * 100, yPercent: (feet - GAS.feet) / GAS.h * 100 });
// Urutan Figma (Section 4): [Frame 4] Gasing di balik bus yang berhenti → [Frame 5] bus jalan ke kiri, Gasing
// tampak berdiri di depan pintu bus → [Frame 6] Gasing berjalan ke posisi akhir di depan stasiun.
const GAS_HIDDEN = gasAt(1019.5, 597);   // di balik bus (Frame 4)
const GAS_DROPPED = gasAt(1056.5, 563);  // turun dari bus (Frame 5)

// Awan: [gambar, lebar % panggung, atas %, durasi detik, offset awal 0–1] — melayang pelan ke kanan, berulang
const CLOUDS = [
  [0, 25.6, 12, 210, 0.08], [2, 20.1, 10, 250, 0.62], [1, 14.3, 20, 180, 0.80],
  [1, 11.7, 4, 230, 0.35], [2, 15.1, 16, 270, 0.95], [0, 17.8, 2, 300, 0.50],
];

const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Membangun panggung scene 0 di dalam `root` (section#start) dan memindahkan tombol mulai ke bawah papan nama.
 * @param {HTMLElement} root
 * @param {HTMLButtonElement} startBtn
 * @returns {{ destroy(): void }}
 */
export function mountScene0(root, startBtn) {
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

  const gasing = createGasing3D({ label: 'Gasing menunggu di depan pintu stasiun sambil membawa tas tenis', className: 's0-gasing', yaw: 0.35, bag: true, bagSide: 1.1 });   // tas raket di punggung, digeser ke kiri layar supaya terlihat (nilai sama dengan S12_BAG_SIDE di scenes2d.js)
  gasing.style.cssText = `left:${pct(GAS.cx - GAS_W / 2, FW)};bottom:${pct(FH - GAS.feet, FH)};height:${pct(GAS.h, FH)}`;
  startBtn.classList.add('s0-btn');   // tersembunyi sampai Gasing selesai diturunkan bus (class is-in)
  startBtn.setAttribute('aria-label', 'Mulai Perjalanan');
  startBtn.style.setProperty('--btn-img', `url("${new URL(S0.button, document.baseURI).href}")`);   // mask kilau saat hover (URL absolut: url() di variabel CSS dihitung dari lokasi stylesheet)
  startBtn.replaceChildren(
    h('img', { src: S0.button, alt: '', draggable: 'false', decoding: 'async' }),
    h('span', { class: 's0-btn-shine', 'aria-hidden': 'true' }));
  // Pembungkus seukuran tombol di bawah plakat: hover/scale terjadi di dalamnya, jadi posisinya tidak bergeser
  const btnAnchor = h('div', { class: 's0-btn-anchor', style: box(...BTN) }, startBtn);

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
    gasing,                                    // Gasing di depan tombol
    layer('s0-tree-l', S0.treeL, [0, 0, 451, 211]),
    layer('s0-tree-l s0-flip', S0.treeL, [0, -211, 451, 211]),
    bus);
  root.prepend(stage);

  const ctx = gsap.context(() => {});
  const run = (fn) => ctx.add(fn);
  const later = (s, fn) => run(() => gsap.delayedCall(s, fn));

  // Masuk: panggung muncul. Plakat & tombol tersembunyi dulu — keduanya muncul berurutan setelah bus selesai menurunkan Gasing:
  // plakat meletup → (jeda singkat) → tombol "Mulai Perjalanan" muncul.
  const plaque = root.querySelector('.s0-sign');
  run(() => {
    gsap.from(stage, { opacity: 0, duration: 0.6, ease: 'power1.out' });
    gsap.set(plaque, { autoAlpha: 0 });
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

  // Pindah ke scene berikutnya: Gasing berbalik menghadap stasiun lalu berjalan masuk lewat pintu.
  // Mengembalikan Promise yang selesai saat Gasing sudah hilang di dalam stasiun.
  const DOOR = gasAt(402, 497);            // tengah pintu kanan stasiun, di ambang pintu
  let entering = null;
  const enter = () => entering ??= new Promise((resolve) => {
    startBtn.classList.add('is-out');
    if (reduced) { resolve(); return; }
    run(() => {
      gasing.setState('walk');
      // Arah hadap mengikuti kecepatan yang dilaporkan lewat move() (gasing3d.js): bergerak ke kanan-belakang → berbalik membelakangi penonton, menghadap stasiun
      wave?.kill();
      const steer = () => gasing.move(0.6, -1.2);
      gsap.ticker.add(steer);
      const s = stage.clientWidth / FW;
      const tl = gsap.timeline({ onComplete: () => { gsap.ticker.remove(steer); resolve(); } });
      tl.call(() => gasing.hop(), null, 0)
        .to(gasing, { xPercent: DOOR.xPercent, yPercent: DOOR.yPercent, scale: 0.6, transformOrigin: '50% 100%', duration: 1.7, ease: 'power1.inOut' }, 0.55)
        .to(gasing, { y: -22 * s, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 }, 0.9)
        .to(gasing, { y: -22 * s, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 }, 1.5)
        .to(gasing, { y: -22 * s, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 }, 2.1)
        .to(gasing, { autoAlpha: 0, duration: 0.35, ease: 'power1.in' }, 2.0);
    });
  });

  if (reduced) {
    // Tanpa gerak: tampilan diam seperti di Figma (bus berhenti di kanan, Gasing sudah turun)
    gsap.set(bus, { xPercent: BUS_PARK });
    showTitle();
    return { enter, introDone: introDonePromise, destroy: () => ctx.revert() };
  }

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

  // ---- Bus ----
  // Badan bus memantul pelan selama jalan; diam saat berhenti
  let bob;
  run(() => { bob = gsap.to(busImg, { y: '-1.2%', duration: 0.22, repeat: -1, yoyo: true, ease: 'sine.inOut', paused: true }); });
  const rolling = (on) => {
    if (on) bob.play();
    else { bob.pause(); run(() => gsap.to(busImg, { y: 0, duration: 0.15 })); }
  };

  // Lewat dari kanan ke kiri, lalu ulangi sesekali
  const drive = () => run(() => {
    rolling(true);
    gsap.fromTo(bus, { xPercent: 0 }, {
      xPercent: BUS_OUT, duration: 9, ease: 'none',
      onComplete: () => { rolling(false); later(rand(10, 18), drive); },
    });
  });

  // Bus berangkat ke kiri dan menurunkan Gasing (urutan Figma Frame 4 → 5 → 6):
  //  - Gasing awalnya di balik bus (tak terlihat)
  //  - bus makin cepat ke kiri → Gasing tersingkap, meloncat kecil ke trotoar di depan pintu bus
  //  - Gasing berjalan (loncat-loncat) ke kiri ke posisi akhir di depan stasiun
  const leaveAndDrop = () => run(() => {
    const s = stage.clientWidth / FW;      // px per satuan frame
    const BUS_T = 5.5, REVEAL = 2.9, hops = 3, per = 0.62, WALK = REVEAL + 0.9;
    const arc = (at, h) => tl.to(gasing, { y: -h * s, duration: per / 2, ease: 'power2.out', yoyo: true, repeat: 1, onStart: () => gasing.hop() }, at);
    rolling(true);
    const tl = gsap.timeline({ onComplete: () => { rolling(false); showTitle(); later(rand(12, 18), drive); } });
    tl.to(bus, { xPercent: BUS_OUT, duration: BUS_T, ease: 'power2.in' }, 0)
      .to(gasing, { ...GAS_DROPPED, duration: 0.7, ease: 'power1.out' }, REVEAL);
    arc(REVEAL, 36);
    tl.to(gasing, { xPercent: 0, yPercent: 0, duration: hops * per, ease: 'power1.inOut' }, WALK);
    for (let i = 0; i < hops; i++) arc(WALK + i * per, 55);
    tl.to(gasing, { scaleY: 0.9, scaleX: 1.05, transformOrigin: '50% 100%', duration: 0.1, yoyo: true, repeat: 1, ease: 'sine.inOut' }, WALK + hops * per);   // mendarat
  });

  // Intro: bus datang → berhenti (menunduk sedikit; Gasing tersembunyi di baliknya) → bus berangkat & menurunkan Gasing → (sesekali lewat)
  gsap.set(gasing, { ...GAS_HIDDEN, autoAlpha: 0 });
  later(0.8, () => run(() => {
    rolling(true);
    gsap.to(bus, {
      xPercent: BUS_PARK, duration: 3.4, ease: 'power2.out',
      onComplete: () => {
        rolling(false);
        gsap.set(gasing, { autoAlpha: 1 });   // sudah tertutup bus seluruhnya
        run(() => gsap.fromTo(busImg, { rotation: 0 }, { rotation: -0.9, transformOrigin: '30% 100%', duration: 0.22, yoyo: true, repeat: 1, ease: 'sine.inOut' }));
        later(1.0, leaveAndDrop);
      },
    });
  }));

  return { enter, introDone: introDonePromise, destroy: () => ctx.revert() };
}
