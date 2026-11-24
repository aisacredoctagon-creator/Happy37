import { gsap } from 'gsap';
import { CONFIG } from './config.js';
import { slot, h, mediaExists } from './assets.js';
import { createGasing3D, bagMouthOffset } from './gasing3d.js';

const A = CONFIG.assets;

// Gasing: karakter 3D (js/gasing3d.js). yaw > 0 = badan menghadap sedikit ke kanan layar.
// bag = true → Gasing menjinjing tas tenis + raket (model 3D js/bag3d.js) di sarung tangan kirinya.
// Kalau WebGL gagal → gasing.png + slot gambar assets/scene3/tas-raket-tenis.png
const gasing = (label, className = '', yaw = 0, bag = false) => createGasing3D({ label, className, yaw, bag });

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
      h('span', {}, 'TIKET KERETA API'),
      h('span', { class: 'ticket-train' }, t.train)),
    h('div', { class: 'ticket-body' },
      h('div', { class: 'ticket-route' },
        h('div', {}, h('small', {}, 'Dari'), h('strong', {}, t.from)),
        h('div', { class: 'ticket-arrow' }, '→'),
        h('div', {}, h('small', {}, 'Tujuan'), h('strong', { class: 'dest' }, t.to))),
      h('div', { class: 'ticket-meta' },
        h('div', {}, h('small', {}, 'Nama'), h('b', {}, t.name)),
        h('div', {}, h('small', {}, 'Tanggal'), h('b', {}, t.date)),
        h('div', {}, h('small', {}, 'Kursi'), h('b', {}, t.seat)))),
    h('div', { class: 'ticket-barcode', 'aria-hidden': 'true' }),
    stamp);

  const g = gasing('Gasing menunggu tiket', 's1-gasing', 0.35);
  const el = h('section', { class: 'scene s1' },
    bg(A.s1_bg, 'Background · Stasiun Kereta', '#c9d6c3'),
    g,
    h('div', { class: 's1-ticket-wrap hotspot' }, ticket));

  let done = false;
  ticket.addEventListener('click', () => {
    if (done) return;
    done = true;
    g.hop();
    el.querySelector('.s1-ticket-wrap').classList.remove('hotspot');
    gsap.timeline()
      .fromTo(stamp, { scale: 2.4, opacity: 0, rotate: -25 }, { scale: 1, opacity: 1, rotate: -12, duration: 0.35, ease: 'back.out(2)' })
      .to(ticket, { y: '-=12', duration: 0.15, yoyo: true, repeat: 1 }, '<0.1')
      .to(ticket, { scale: 1.08, duration: 0.5, ease: 'power2.inOut' }, '+=0.5')
      .add(() => ctx.next(), '+=0.2');
  });

  return {
    el,
    enter() {
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
  'tree-big': [303, 273], 'tree-small': [161, 134], 'bush-wide': [334, 86], 'bush-small': [135, 42],
  treeline: [2120, 210], wall: [2106, 66], tracks: [2106, 254],
  'wires-band': [1760, 182], 'pole-lamp': [72, 556], 'pole-power': [130, 694],
};
const u = (n) => `calc(var(--u) * ${+n.toFixed(2)})`;

// sprite: x = tepi kiri, y = tepi BAWAH (unit desain), s = skala terhadap ukuran asli
function s2Sprite(name, x, y, s = 1, extra = '') {
  const [nw, nh] = S2_NAT[name];
  const img = h('img', {
    src: `${S2_DIR}${name}.png`, alt: '', draggable: 'false', decoding: 'async',
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

  // 1. awan (paling lambat)
  const clouds = s2Layer('clouds', 2172, 7, [
    () => s2Cloud(402, 62, 316), () => s2Cloud(12, 178, 220), () => s2Cloud(684, 222, 200),
    () => s2Cloud(1526, 216, 212), () => s2Cloud(1685, 64, 218), () => s2Cloud(1930, 178, 215),
    () => s2Cloud(1160, 120, 150),
  ]);

  // 2. skyline jauh (kabur, kecil)
  const skyline = s2Layer('far', 2172, 20, [
    sp('bld-blue-a', 190, 420, 0.62, far), sp('bld-cream-b', 420, 420, 0.55, far), sp('bld-glass-tower', 690, 420, 0.46, far),
    sp('bld-grey', 900, 420, 0.6, far), sp('bld-spire', 1110, 420, 0.8, far), sp('bld-white', 1230, 420, 0.56, far),
    sp('bld-blue-b', 1470, 420, 0.6, far), sp('bld-beige', 1700, 420, 0.6, far), sp('bld-cream-a', 1900, 420, 0.55, far),
  ]);

  // 3. gedung perkantoran (di belakang pepohonan). Jauhi tepi chunk supaya pasangan cermin tidak terlalu mencolok
  const mid = s2Layer('mid', 2172, 48, [
    sp('bld-blue-b', 200, 445, 0.66), sp('bld-grey', 300, 445, 0.45), sp('bld-blue-a', 610, 445, 0.66),
    sp('bld-glass-tower', 790, 445, 0.58), sp('bld-beige', 905, 445, 0.5), sp('bld-cream-b', 1330, 445, 0.58),
    sp('bld-spire', 1490, 445, 0.62), sp('bld-white', 1700, 445, 0.62), sp('bld-cream-a', 1850, 445, 0.5),
  ]);

  // 4. pepohonan di belakang tembok (panjang, tanpa pola ulang berkat cermin). 76 px teratas sprite kosong.
  const treeline = s2Layer('trees', 2120, 100, [sp('treeline', 0, 502, 1)]);

  // 5. landmark Surabaya (Suro & Boyo, Tugu Pahlawan, gedung merah) berdiri di depan pepohonan.
  //    Tepi chunk dikosongkan: pasangan cermin di sambungan tidak menampilkan landmark yang sama berdampingan.
  const landmarks = s2Layer('landmarks', 2600, 135, [
    sp('lm-gedung', 330, 482, 0.56), sp('lm-suroboyo', 1250, 490, 0.72), sp('lm-tugu-pahlawan', 2000, 490, 0.75),
  ]);

  // 6. pohon & semak tunggal di depan barisan pohon
  const shrubs = s2Layer('shrubs', 2172, 190, [
    sp('tree-big', 160, 500, 0.55), sp('bush-wide', 470, 500, 0.62), sp('tree-small', 820, 500, 0.62),
    sp('tree-big', 1200, 500, 0.5), sp('bush-small', 1560, 500, 0.8), sp('bush-wide', 1740, 500, 0.55),
  ]);

  // 7. tembok & 8. rel (sama-sama panjang → cermin). Sprite rel: 36 baris teratas kosong → digeser naik.
  const wall = s2Layer('wall', 1895, 280, [sp('wall', 0, 533, 0.9)]);
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
    clouds, skyline, mid, treeline, landmarks, shrubs, wall, tracks, power);
}

function scene2(ctx) {
  const el = h('section', { class: 'scene s2' },
    h('div', { class: 's2-wall' }),
    h('div', { class: 's2-window' },
      h('div', { class: 's2-outside' }, buildSurabayaParallax()),
      h('div', { class: 's2-glare' })),
    slot({ src: A.s2_window, label: 'Frame jendela (opsional)', className: 's2-frame overlay-optional', fit: 'fill' }),
    gasing('Gasing lihat jendela', 's2-gasing', 0.3));

  return {
    el,
    enter() {
      el.classList.add('is-running'); // mulai menggulir semua lapisan parallax
      gsap.to(el.querySelector('.s2-window'), { y: 2, duration: 0.18, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.from(el.querySelector('.s2-gasing'), { y: 60, opacity: 0, duration: 0.8, delay: 0.3 });
      gsap.delayedCall(2.2, () => ctx.showAction('Turun di Surabaya →', () => ctx.next()));
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
    h('button', { class: 'btn btn-ghost', onclick: () => tv.classList.toggle('is-expanded') }, '⤢ Perbesar TV'),
    h('button', { class: 'btn', onclick: () => ctx.restart() }, '↺ Ulangi dari awal'));

  const el = h('section', { class: 'scene s11' },
    bg(A.s11_bg, 'Background · Toko antik (sisi TV)', '#a8896b'),
    h('div', { class: 's11-floor' }),
    gasingGroup, tv, ball, endBar);

  let noiseRAF = 0;
  function startNoise() {
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
  const stopNoise = () => cancelAnimationFrame(noiseRAF);

  async function turnOnTV() {
    tv.classList.add('is-on');
    startNoise();
    await new Promise((r) => setTimeout(r, 900));
    const content = screen.querySelector('.crt-content');
    if (await mediaExists(A.s12_video)) {
      const v = h('video', { src: A.s12_video, playsinline: '', controls: '' });
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
        .add(() => g11.wobble())               // senggol tas, lalu Gasing meloncat
        .add(() => g11.hop(), '+=0.4')
        .to(ball, { y: floorY, duration: 0.7, ease: 'bounce.out' })
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
