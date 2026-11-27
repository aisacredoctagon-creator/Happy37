import { gsap } from 'gsap';
import { CONFIG } from './config.js';
import { slot, h, mediaExists } from './assets.js';
import { createGasing3D, bagMouthOffset, GESTURE_TIMING } from './gasing3d.js';
import { sfx, startLoop, stopLoopId, bindDuckToMedia } from './audio.js';

const A = CONFIG.assets;

// Gasing: karakter 3D (js/gasing3d.js). yaw > 0 = badan menghadap sedikit ke kanan layar.
// bag = true → Gasing menjinjing tas tenis + raket (model 3D js/bag3d.js) di sarung tangan kirinya.
// Kalau WebGL gagal → gasing.png + slot gambar assets/scene3/tas-raket-tenis.png
/** onUpdate GSAP (tween ease bounce.out): bunyi pantulan tepat di titik sentuh lantai ease itu (progres 1/2.75, 2/2.75, 2.5/2.75, 1) — tidak bergantung FPS. */
function bounceSfx() {
  const hits = [1 / 2.75, 2 / 2.75, 2.5 / 2.75, 0.999], vols = [1, 0.6, 0.35, 0.18];
  let prev = 0;
  return function () {
    const p = this.progress();
    let hit = -1;
    hits.forEach((h, k) => { if (prev < h && p >= h) hit = k; });
    if (hit >= 0) sfx('ball_bounce', { volume: vols[hit] });
    prev = p;
  };
}
const gasing = (label, className = '', yaw = 0, bag = false, bagSide = 0) => createGasing3D({ label, className, yaw, bag, bagSide });
const S12_BAG_SIDE = 1.1;   // rad: scene 1 & 2 — tas raket digeser ke samping badan (+ = kiri layar) supaya terlihat, tidak sepenuhnya tertutup badan

const bg = (src, label, tint) => {
  const el = slot({ src, label, className: 'bg', fit: 'cover' });
  if (tint) el.style.setProperty('--tint', tint);
  return el;
};

/* -------------------------------------------------------------
   SCENE 1 — Tiket di stasiun
------------------------------------------------------------- */
function scene1(ctx) {
  const t = CONFIG.ticket;
  const stamp = h('div', { class: 'ticket-stamp' }, 'BERANGKAT');
  const ticket = h('button', { class: 'ticket', 'aria-label': 'Tiket kereta, ketuk untuk berangkat' },
    h('div', { class: 'ticket-head' },
      h('img', { class: 'ticket-logo', src: A.s1_logo, alt: 'Gasing Academy Railways', draggable: 'false' }),
      h('div', { class: 'ticket-train' }, h('small', {}, 'Kereta'), h('b', {}, t.train))),
    h('div', { class: 'ticket-body' },
      h('div', { class: 'ticket-route' },
        h('div', {}, h('small', {}, 'Dari'), h('strong', {}, t.from), h('span', { class: 'ticket-city' }, t.fromCity)),
        h('div', { class: 'ticket-arrow' }, '→'),
        h('div', {}, h('small', {}, 'Tujuan'), h('strong', { class: 'dest' }, t.to), h('span', { class: 'ticket-city dest' }, t.toCity))),
      h('div', { class: 'ticket-meta' },
        h('div', {}, h('small', {}, 'Nama'), h('b', {}, t.name)),
        h('div', {}, h('small', {}, 'Tanggal'), h('b', {}, t.date)),
        h('div', {}, h('small', {}, 'Kursi'), h('b', {}, t.seat)),
        h('div', {}, h('small', {}, 'Tipe Penumpang'), h('b', {}, t.passengerType)))),
    h('div', { class: 'ticket-barcode', 'aria-hidden': 'true' }),
    stamp);

  // Panggung 2172×724: langit, awan, dan stasiun memakai kotak yang sama supaya awan selalu pas di belakang atap/gedung.
  // Tiap awan: [gambar, lebar % panggung, atas %, durasi detik, offset awal 0–1] — melayang pelan ke kanan, berulang.
  const cloudSpecs = [
    [0, 26, 9, 230, 0.12], [1, 14, 30, 190, 0.48], [2, 20, 17, 270, 0.78], [0, 17, 36, 210, 0.95],
    [1, 18, 3, 250, 0.30], [2, 12, 24, 170, 0.62], [0, 15, 12, 300, 0.40], [2, 16, 33, 240, 0.05],
    [1, 22, 6, 285, 0.88], [0, 11, 27, 200, 0.22], [2, 13, 20, 180, 0.70], [1, 10, 38, 220, 0.55],
  ];
  const clouds = h('div', { class: 's1-clouds', 'aria-hidden': 'true' },
    ...cloudSpecs.map(([i, w, top, dur, at]) => h('img', {
      src: A.s1_clouds[i], alt: '', draggable: 'false', decoding: 'async',
      style: `width:${w}%;top:${top}%;animation-duration:${dur}s;animation-delay:${-(dur * at).toFixed(1)}s`,
    })));
  const stage = h('div', { class: 's1-stage' },
    h('img', { class: 's1-sky', src: A.s1_sky, alt: '', draggable: 'false' }),
    clouds,
    h('img', { class: 's1-fg', src: A.s1_fg, alt: 'Peron Stasiun Gambir', draggable: 'false' }));

  const g = gasing('Gasing menunggu tiket', 's1-gasing', 0.35, true, S12_BAG_SIDE);   // tas raket di punggung (sama seperti scene lain)
  const el = h('section', { class: 'scene s1' },
    stage,
    g,
    h('div', { class: 's1-ticket-wrap attn' }, ticket));

  // Kemiringan 3D tipis mengikuti kursor saat hover (hanya mouse/pen; sentuh tidak ada hover)
  const wrap = el.querySelector('.s1-ticket-wrap');
  const MAX_TILT = 9;
  ticket.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !wrap.classList.contains('attn')) return;
    const r = ticket.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    wrap.style.setProperty('--tilt-y', `${(px * 2 * MAX_TILT).toFixed(2)}deg`);
    wrap.style.setProperty('--tilt-x', `${(-py * 2 * MAX_TILT).toFixed(2)}deg`);
  });
  ticket.addEventListener('pointerleave', () => {
    wrap.style.setProperty('--tilt-x', '0deg');
    wrap.style.setProperty('--tilt-y', '0deg');
  });

  let done = false;
  ticket.addEventListener('click', () => {
    if (done) return;
    done = true;
    sfx('paper');
    g.hop();
    el.querySelector('.s1-ticket-wrap').classList.remove('attn');
    gsap.timeline()
      .fromTo(stamp, { scale: 2.4, opacity: 0, rotate: -25 }, { scale: 1, opacity: 1, rotate: -12, duration: 0.35, ease: 'back.out(2)' })
      .add(() => sfx('stamp'), '-=0.12')                       // stempel mendarat
      .to(ticket, { y: '-=12', duration: 0.15, yoyo: true, repeat: 1 }, '<0.1')
      .to(ticket, { scale: 1.08, duration: 0.5, ease: 'power2.inOut' }, '+=0.5')
      .add(() => ctx.next(), '+=0.2');
  });

  return {
    el,
    enter() {
      // satu gestur: menunjuk tiket setelah tiket selesai muncul (memberi tahu pemain apa yang diketuk)
      gsap.delayedCall(1.2 + GESTURE_TIMING.lead, () => { if (!done) g.gesture('point'); });
      gsap.from(ticket, { y: 80, rotate: 8, opacity: 0, duration: 0.9, ease: 'back.out(1.4)', delay: 0.3 });
      gsap.from(el.querySelector('.s1-gasing'), { x: -60, opacity: 0, duration: 0.8, ease: 'power2.out' });
    },
  };
}

/* -------------------------------------------------------------
   SCENE 2 — Lihat landmark dari jendela kereta
------------------------------------------------------------- */
/* Pemandangan Surabaya dari jendela kereta — parallax berlapis.
   Semua posisi/ukuran ditulis dalam "unit" desain 2172×724 (referensi Figma), lalu diskalakan ke
   tinggi jendela lewat --u (css). Tiap lapisan = potongan (chunk) + salinan cerminnya ("mirror trick"):
   [A][A↔][A][A↔] digeser tepat 2 chunk lalu diulang → ujung kiri/kanan selalu nyambung, tanpa
   pola yang terulang persis dan tanpa sambungan terlihat. */
const S2_DIR = A.s2_parallax;
const S2_H = 724; // tinggi unit desain
const S2_NAT = { // ukuran asli tiap sprite (px)
  'bld-glass-tower': [179, 239], 'bld-cream-a': [137, 159], 'bld-blue-a': [149, 132], 'bld-cream-b': [191, 166],
  'bld-spire': [58, 199], 'bld-grey': [165, 160], 'bld-white': [151, 160], 'bld-beige': [131, 160], 'bld-blue-b': [116, 160],
  'lm-suroboyo': [228, 332], 'lm-tugu-pahlawan': [272, 348], 'lm-gedung': [549, 259],
  'lm-siola': [600, 449], 'lm-bambu-runcing': [481, 387], 'lm-hotel-majapahit': [800, 365],
  'lm-kapal-selam': [720, 337], 'lm-jalesveva': [760, 438], 'lm-gedung-kolonial': [680, 363],
  'tree-big': [303, 273], 'tree-small': [161, 134], 'bush-wide': [334, 86], 'bush-small': [135, 42],
  // treeline: tepi kiri/kanan (yang membulat) sudah dipotong 40 px → sambungan cermin tidak bolong
  treeline: [2040, 210], wall: [2106, 66], tracks: [2106, 254],
  'wires-band': [1760, 182], 'pole-lamp': [72, 556], 'pole-power': [130, 694],
};
const u = (n) => `calc(var(--u) * ${+n.toFixed(2)})`;

// sprite: x = tepi kiri, y = tepi BAWAH (unit desain), s = skala terhadap ukuran asli
// keepText: sprite berisi tulisan/angka → di chunk cermin dibalik lagi supaya tulisan tetap terbaca
function s2Sprite(name, x, y, s = 1, extra = '', keepText = false) {
  const [nw, nh] = S2_NAT[name];
  const img = h('img', {
    src: `${S2_DIR}${name}.png`, alt: '', draggable: 'false', decoding: 'async', class: keepText ? 'keep-text' : '',
    style: `left:${u(x)};top:${u(y - nh * s)};width:${u(nw * s)};height:${u(nh * s)};${extra}`,
  });
  return img;
}

function s2Cloud(x, y, w) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 200 60');
  svg.setAttribute('class', 's2-cloud');
  svg.style.cssText = `left:${u(x)};top:${u(y)};width:${u(w)};height:${u(w * 0.3)}`;
  svg.innerHTML =
    '<g fill="#fff"><circle cx="45" cy="38" r="20"/><circle cx="80" cy="30" r="28"/><circle cx="122" cy="34" r="24"/>' +
    '<circle cx="155" cy="42" r="16"/><circle cx="24" cy="46" r="12"/><rect x="8" y="42" width="184" height="16" rx="8"/></g>' +
    '<rect x="8" y="50" width="184" height="8" rx="4" fill="#d6eafb"/>';
  return svg;
}

/**
 * @param {string} cls   nama lapisan
 * @param {number} W     lebar satu chunk (unit desain)
 * @param {number} speed kecepatan (unit desain / detik)
 * @param {Array<Node|Function>} items
 */
function s2Layer(cls, W, speed, items) {
  const chunk = (mirror) => h('div', { class: `s2-chunk${mirror ? ' is-mirror' : ''}`, style: `width:${u(W)}` },
    ...items.map((it) => (typeof it === 'function' ? it() : it.cloneNode(true))));
  return h('div', { class: `s2-layer s2-l-${cls}` },
    h('div', { class: 's2-strip', style: `--period:${2 * W};animation-duration:${((2 * W) / speed).toFixed(1)}s;width:${u(4 * W)}` },
      chunk(false), chunk(true), chunk(false), chunk(true)));
}

function buildSurabayaParallax() {
  const sp = (...a) => () => s2Sprite(...a);
  const far = 'opacity:.5;filter:saturate(.55) brightness(1.18) hue-rotate(-6deg);';
  // Dasar semua gedung jauh/menengah/landmark harus TERTUTUP barisan pohon (lembah pohon terdalam ≈ y 473, rata-rata ≈ 440),
  // kalau tidak gedung terlihat "melayang". Gedung dibesarkan sedikit supaya bagian yang menyembul di atas pohon tetap cukup.
  const FY = 452, MY = 466; // garis dasar gedung jauh / menengah
  const spF = (n, x, y, s, ...r) => sp(n, x, y, s * 1.15, ...r);
  const spM = (n, x, y, s, ...r) => sp(n, x, y, s * 1.2, ...r);

  // 1. awan (paling lambat)
  const clouds = s2Layer('clouds', 2172, 7, [
    () => s2Cloud(402, 62, 316), () => s2Cloud(12, 178, 220), () => s2Cloud(684, 222, 200),
    () => s2Cloud(1526, 216, 212), () => s2Cloud(1685, 64, 218), () => s2Cloud(1930, 178, 215),
    () => s2Cloud(1160, 120, 150),
  ]);

  // 2. skyline jauh (kabur, kecil)
  const skyline = s2Layer('far', 2172, 20, [
    spF('bld-blue-a', 190, FY, 0.62, far), spF('bld-cream-b', FY, 420, 0.55, far), spF('bld-glass-tower', 690, FY, 0.46, far),
    spF('bld-grey', 900, FY, 0.6, far), spF('bld-spire', 1110, FY, 0.8, far), spF('bld-white', 1230, FY, 0.56, far),
    spF('bld-blue-b', 1470, FY, 0.6, far), spF('bld-beige', 1700, FY, 0.6, far), spF('bld-cream-a', 1900, FY, 0.55, far),
    // tambahan supaya skyline lebih padat
    spF('bld-beige', 60, FY, 0.5, far), spF('bld-white', 305, FY, 0.45, far), spF('bld-blue-b', 790, FY, 0.5, far),
    spF('bld-glass-tower', 1340, FY, 0.4, far), spF('bld-cream-b', 1580, FY, 0.45, far), spF('bld-blue-a', 2030, FY, 0.5, far),
  ]);

  // 3. gedung perkantoran (di belakang pepohonan). Jauhi tepi chunk supaya pasangan cermin tidak terlalu mencolok
  const mid = s2Layer('mid', 2172, 48, [
    spM('bld-blue-b', 200, MY, 0.66), spM('bld-grey', 300, MY, 0.45), spM('bld-blue-a', 610, MY, 0.66),
    spM('bld-glass-tower', 790, MY, 0.58), spM('bld-beige', 905, MY, 0.5), spM('bld-cream-b', 1330, MY, 0.58),
    spM('bld-spire', 1490, MY, 0.62), spM('bld-white', 1700, MY, 0.62), spM('bld-cream-a', 1850, MY, 0.5),
    // tambahan gedung di sela-sela
    spM('bld-white', 420, MY, 0.5), spM('bld-spire', 530, MY, 0.55), spM('bld-cream-b', 1010, MY, 0.5),
    spM('bld-glass-tower', 1170, MY, 0.5), spM('bld-beige', 1960, MY, 0.55),
  ]);

  // 4. pepohonan di belakang tembok (panjang, tanpa pola ulang berkat cermin). 76 px teratas sprite kosong.
  const treeline = s2Layer('trees', 2040, 100, [sp('treeline', 0, 530, 1)]);
  // baris pohon belakang: salinan treeline yang dibalik & sedikit lebih gelap, lajunya lebih lambat (di antara landmark & pohon depan).
  // Lembah di barisan depan jadi terisi dedaunan → dasar gedung/landmark di belakangnya tidak kelihatan melayang.
  const treeBack = s2Layer('trees-back', 2040, 90, [sp('treeline', 0, 538, 1, 'transform:scaleX(-1);filter:brightness(.9) saturate(1.05);')]);

  // 5. landmark Surabaya (Suro & Boyo, Tugu Pahlawan, gedung merah) berdiri di depan pepohonan.
  //    Tepi chunk dikosongkan: pasangan cermin di sambungan tidak menampilkan landmark yang sama berdampingan.
  //    Hotel Majapahit & Kapal Selam 410 bertulisan → keepText (tidak ikut terbalik di chunk cermin).
  //    Landmark berdiri DI BELAKANG barisan pohon → dasarnya tertutup pohon, jadi garis tanahnya dinaikkan
  //    dan lajunya di antara gedung jauh (48) dan pohon (100) supaya parallax-nya masuk akal.
  const GY = 458; // garis tanah landmark
  const landmarks = s2Layer('landmarks', 10150, 80, [
    // landmark pendek & lebar (hotel, kapal selam, gedung) dinaikkan sedikit supaya tidak hampir seluruhnya tertutup pohon
    sp('lm-hotel-majapahit', 500, GY - 14, 0.5, '', true), sp('lm-suroboyo', 1700, GY - 2, 0.72), sp('lm-siola', 2664, GY, 0.5),
    sp('lm-tugu-pahlawan', 3764, GY - 2, 0.75), sp('lm-kapal-selam', 4768, GY - 24, 0.5, '', true),
    sp('lm-bambu-runcing', 5928, GY, 0.6), sp('lm-gedung', 7017, GY - 22, 0.56), sp('lm-jalesveva', 8124, GY, 0.5),
    sp('lm-gedung-kolonial', 9304, GY - 14, 0.5),
  ]);

  // 6. pohon & semak tunggal di depan barisan pohon
  const shrubs = s2Layer('shrubs', 2172, 190, [
    sp('tree-big', 160, 514, 0.55), sp('bush-wide', 470, 514, 0.62), sp('tree-small', 820, 514, 0.62),
    sp('tree-big', 1200, 514, 0.5), sp('bush-small', 1560, 514, 0.8), sp('bush-wide', 1740, 514, 0.55),
  ]);

  // 7. tembok & 8. rel (sama-sama panjang → cermin). Sprite rel: 36 baris teratas kosong → digeser naik.
  const wall = s2Layer('wall', 1895, 280, [sp('wall', 0, 578, 0.9, `top:${u(492)};height:${u(86)};`)]); // dipertinggi (86) & diturunkan supaya menutupi jalan aspal di atas rel
  const tracks = s2Layer('tracks', 1895, 360, [sp('tracks', 0, 726, 0.9)]);

  // 8. kabel + tiang (paling dekat → paling cepat) + semak depan
  //    Kabel + tiang digeser turun bersama (POLE_DY) supaya dasar tiang tersembunyi di bawah bingkai jendela
  //    dan kabel tetap tersambung ke tiang.
  const POLE_DY = 72;
  const power = s2Layer('power', 1760, 300, [
    () => h('img', { src: `${S2_DIR}wires-band.png`, alt: '', draggable: 'false', decoding: 'async', style: `left:0;top:${u(118 + POLE_DY)};width:${u(1760)};height:${u(182)}` }),
    sp('pole-lamp', 400, 704 + POLE_DY, 1), sp('pole-power', 1250, 706 + POLE_DY, 1),
    sp('bush-wide', 980, 742, 1.15), sp('bush-small', 70, 736, 1.1),
  ]);

  return h('div', { class: 's2-stage' }, h('div', { class: 's2-sky' }),
    // urutan dari belakang ke depan: ... landmark → pepohonan → semak → rel → tembok (di depan rel) → kabel/tiang
    clouds, skyline, mid, landmarks, treeBack, treeline, shrubs, tracks, wall, power);
}

function scene2(ctx) {
  // dibuat per pemanggilan scene2() (bukan di level modul): instance Gasing yang sudah di-dispose tidak dipakai ulang saat scene diulang / dilewati
  const g2 = gasing('Gasing lihat jendela', 's2-gasing', 0.3, true, S12_BAG_SIDE);   // tas raket di punggung (sama seperti scene lain)
  const el = h('section', { class: 'scene s2' },
    h('div', { class: 's2-wall' }),
    // Interior kereta (PNG dengan jendela transparan): parallax Surabaya ada DI BELAKANG gambar ini
    h('div', { class: 's2-room' },
      h('div', { class: 's2-window' },
        h('div', { class: 's2-outside' }, buildSurabayaParallax()),
        h('div', { class: 's2-glare' })),
      h('img', { class: 's2-room-img', src: A.s2_room, alt: 'Interior kereta', draggable: 'false' }),
      // Pegangan tangan menggantung: berayun pelan mengikuti goyangan kereta
      ...A.s2_straps.map((src, i) => h('img', { class: `s2-strap is-${i + 1}`, src, alt: '', draggable: 'false' })),
      // Poster di dua bingkai dinding (bingkai ada di gambar interior; poster ditempel di atasnya & di-crop pas)
      h('div', { class: 's2-poster is-left' },
        h('img', { src: A.s2_poster_math, alt: 'Poster Kelas Matematika Dasar dengan Metode Gasing', draggable: 'false', decoding: 'async' })),
      h('div', { class: 's2-poster is-right' },
        h('img', { src: A.s2_poster_wilson, alt: 'Poster Wilson', draggable: 'false', decoding: 'async' })),
      // Botol minum di meja bawah jendela — bergetar halus mengikuti guncangan kereta
      h('div', { class: 's2-bottle' },
        h('img', { src: A.s2_bottle, alt: 'Botol minum', draggable: 'false', decoding: 'async' }))),
    g2);

  return {
    el,
    enter() {
      gsap.delayedCall(1.2, () => g2.gesture('marvelNear'));   // kagum melihat pemandangan
      el.classList.add('is-running'); // mulai menggulir semua lapisan parallax
      gsap.to(el.querySelector('.s2-window'), { y: 2, duration: 0.18, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.from(el.querySelector('.s2-gasing'), { y: 60, opacity: 0, duration: 0.8, delay: 0.3 });
      gsap.delayedCall(2.2, () => ctx.showAction('Turun', () => ctx.next(), { corner: true }));
    },
    exit() { el.classList.remove('is-running'); gsap.killTweensOf(el.querySelector('.s2-window')); },
  };
}

/* -------------------------------------------------------------
   SCENE 3 — Makan soto gerobak Ambengan, lalu ke toko antik
------------------------------------------------------------- */
function scene3(ctx) {
  const bubble = h('div', { class: 'bubble' }, 'Nyam! Sotonya mantap 😋');
  const gerobak = h('button', { class: 's3-gerobak hotspot', 'aria-label': 'Gerobak soto Ambengan' },
    slot({ src: A.s3_gerobak, label: 'Gerobak Soto Ambengan' }));
  const toko = h('button', { class: 's3-toko', 'aria-label': 'Toko antik', disabled: true },
    slot({ src: A.s3_toko, label: 'Toko Antik (tampak luar)' }),
    h('span', { class: 's3-toko-sign' }, 'TOKO ANTIK'));
  const gasingGroup = h('div', { class: 's3-gasing-group' },
    gasing('Gasing makan soto sambil menjinjing tas tenis', 's3-gasing', 0.25, true),
    bubble);

  const el = h('section', { class: 'scene s3' },
    bg(A.s3_bg, 'Background · Jalan / gang Surabaya', '#e8d5b0'),
    h('div', { class: 's3-sign' }, h('small', {}, 'Selamat Datang di'), h('strong', {}, 'SURABAYA')),
    toko, gerobak, gasingGroup);

  let eaten = false;
  gerobak.addEventListener('click', () => {
    if (eaten) return;
    eaten = true;
    sfx('ui_click');
    gerobak.classList.remove('hotspot');
    gsap.timeline()
      .to(gerobak, { scale: 1.06, duration: 0.12, yoyo: true, repeat: 1 })
      .fromTo(bubble, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' })
      .to(el.querySelector('.s3-gasing'), { y: -18, duration: 0.18, yoyo: true, repeat: 3, ease: 'power1.out' }, '<')
      .to(bubble, { opacity: 0, duration: 0.3 }, '+=1.4')
      .add(() => {
        ctx.caption('Kenyang! Sekarang mampir ke toko antik di seberang. Ketuk tokonya.');
        toko.disabled = false;
        toko.classList.add('hotspot');
      });
  });
  toko.addEventListener('click', () => {
    toko.disabled = true;
    sfx('shop_bell');
    toko.classList.remove('hotspot');
    gsap.to(gasingGroup, { x: () => toko.getBoundingClientRect().left - gasingGroup.getBoundingClientRect().left, opacity: 0, duration: 1.1, ease: 'power1.in', onComplete: () => ctx.next() });
  });

  return {
    el,
    enter() {
      gsap.from(el.querySelector('.s3-sign'), { y: -40, opacity: 0, duration: 0.7, ease: 'back.out(1.6)', delay: 0.2 });
    },
  };
}

/* -------------------------------------------------------------
   SCENE 4 — Di dalam toko antik, melihat koper di etalase
------------------------------------------------------------- */
function scene4(ctx) {
  const koper = h('button', { class: 's4-koper', 'aria-label': 'Koper di etalase', disabled: true },
    slot({ src: A.s4_koper, label: 'Koper antik' }));
  const etalase = h('div', { class: 's4-etalase' },
    slot({ src: A.s4_etalase, label: 'Etalase / display case', className: 's4-etalase-img' }),
    koper,
    h('div', { class: 's4-glass' }));
  const g = gasing('Gasing berjalan', 's4-gasing', 0.35);

  const el = h('section', { class: 'scene s4' },
    bg(A.s4_bg, 'Background · Interior toko antik', '#b89a7a'),
    etalase, g);

  koper.addEventListener('click', () => {
    koper.disabled = true;
    sfx('ui_click');
    koper.classList.remove('hotspot');
    const kr = koper.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const ox = ((kr.left + kr.width / 2 - er.left) / er.width) * 100;
    const oy = ((kr.top + kr.height / 2 - er.top) / er.height) * 100;
    gsap.timeline()
      .to(g, { x: () => (kr.left - g.getBoundingClientRect().right) * 0.6, duration: 0.8, ease: 'power1.inOut' })
      .to(el, { scale: 3.2, transformOrigin: `${ox}% ${oy}%`, duration: 1.2, ease: 'power2.in' })
      .add(() => ctx.next({ fade: 'white' }), '-=0.35');
  });

  return {
    el,
    enter() {
      gsap.set(el, { scale: 1 });
      gsap.timeline()
        .fromTo(g, { x: '-45vw' }, { x: 0, duration: 2, ease: 'power1.out' })
        .to(g, { rotate: 4, duration: 0.25, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0)
        .add(() => { koper.disabled = false; koper.classList.add('hotspot'); });
    },
  };
}

/* -------------------------------------------------------------
   SCENE 11 & 12 — Bola tenis jatuh, menggelinding ke TV CRT
------------------------------------------------------------- */
function scene11(ctx) {
  const ball = h('div', { class: 'tennis-ball', 'aria-hidden': 'true' });
  const screen = h('div', { class: 'crt-screen' },
    h('canvas', { class: 'crt-noise', width: 160, height: 120 }),
    h('div', { class: 'crt-content' }));
  const tv = h('div', { class: 'crt' },
    h('div', { class: 'crt-body' },
      screen,
      h('div', { class: 'crt-panel' },
        h('span', { class: 'crt-knob' }), h('span', { class: 'crt-knob' }),
        h('span', { class: 'crt-grill' }), h('span', { class: 'crt-led' }))),
    h('div', { class: 'crt-legs' }, h('span'), h('span')));

  const g11 = gasing('Gasing menjinjing tas tenis', 's11-gasing', 0.35, true);
  const gasingGroup = h('div', { class: 's11-gasing-group' }, g11);

  const endBar = h('div', { class: 'end-bar' },
    h('button', { class: 'btn btn-ghost', onclick: () => { sfx('ui_click'); tv.classList.toggle('is-expanded'); } }, '⤢ Perbesar TV'),
    h('button', { class: 'btn', onclick: () => { sfx('ui_click'); ctx.restart(); } }, '↺ Ulangi dari awal'));

  const el = h('section', { class: 'scene s11' },
    bg(A.s11_bg, 'Background · Toko antik (sisi TV)', '#a8896b'),
    h('div', { class: 's11-floor' }),
    gasingGroup, tv, ball, endBar);

  let noiseRAF = 0;
  function startNoise() {
    startLoop('tvstatic');            // desis statis selama layar bersalju
    const c = screen.querySelector('.crt-noise');
    const g = c.getContext('2d');
    const img = g.createImageData(c.width, c.height);
    const tick = () => {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      noiseRAF = requestAnimationFrame(tick);
    };
    tick();
  }
  const stopNoise = () => { cancelAnimationFrame(noiseRAF); stopLoopId('tvstatic'); };

  async function turnOnTV() {
    tv.classList.add('is-on');
    sfx('tv_on');
    startNoise();
    await new Promise((r) => setTimeout(r, 900));
    const content = screen.querySelector('.crt-content');
    if (await mediaExists(A.s12_video)) {
      const v = h('video', { src: A.s12_video, playsinline: '', controls: '' });
      bindDuckToMedia(v);                    // musik & ambience hampir hening selama video diputar
      content.append(v);
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    } else {
      content.append(
        h('div', { class: 'crt-placeholder' },
          h('small', {}, '▶ PLACEHOLDER VIDEO'),
          h('strong', {}, 'Selamat Ulang Tahun,'),
          h('strong', { class: 'big' }, `${CONFIG.recipient}! 🎉`),
          h('small', {}, A.s12_video)));
    }
    stopNoise();
    screen.classList.add('has-content');
    ctx.confetti();
    gsap.fromTo(endBar, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, delay: 1.2, pointerEvents: 'auto' });
  }

  return {
    el,
    enter() {
      // Posisi awal bola: di mulut tas yang dijinjing Gasing
      const sr = el.getBoundingClientRect();
      const gr = g11.getBoundingClientRect();
      const size = ball.offsetWidth;
      const mouth = bagMouthOffset(gr.width / gr.height || undefined);
      const startX = gr.left - sr.left + gr.width / 2 + mouth.x * gr.height - size / 2;
      const startY = gr.bottom - sr.top - mouth.y * gr.height - size / 2;
      const floorY = sr.height - el.querySelector('.s11-floor').offsetHeight - size;
      const tvR = tv.getBoundingClientRect();
      const endX = tvR.left - sr.left - size * 0.6;
      const dist = Math.max(0, endX - startX);
      gsap.set(ball, { x: startX, y: startY, rotate: 0, opacity: 1 });

      const tl = gsap.timeline({ delay: ctx.at12 ? 0 : 1.2 })
        .add(() => { g11.wobble(); g11.gesture('startle'); })   // senggol tas (kaget), lalu Gasing meloncat
        .add(() => g11.hop(), '+=0.4')
        .add(() => sfx('ball_pop'))
        .to(ball, { y: floorY, duration: 0.7, ease: 'bounce.out', onUpdate: bounceSfx() })
        .to(ball, { x: startX + dist, rotate: (dist / (Math.PI * size)) * 360, duration: Math.max(1.6, dist / 260), ease: 'power2.out' }, '-=0.15')
        .add(() => { ctx.setStage(12); ctx.caption(CONFIG.captions[12]); }, '-=0.6')
        .addLabel('stage12')
        .add(() => turnOnTV(), '+=0.3');
      if (ctx.at12) tl.seek('stage12', false); // masuk langsung ke scene 12 (debug / ?scene=12): bola sudah di dekat TV
    },
    exit() { stopNoise(); },
  };
}

export const SCENES_2D = { 1: scene1, 2: scene2, 3: scene3, 4: scene4, 11: scene11 };
