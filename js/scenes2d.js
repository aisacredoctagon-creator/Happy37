import { gsap } from 'gsap';
import { CONFIG } from './config.js';
import { slot, h, mediaExists } from './assets.js';
import { createGasing3D, bagMouthOffset, GESTURE_TIMING } from './gasing3d.js';

const A = CONFIG.assets;

// Gasing: karakter 3D (js/gasing3d.js). yaw > 0 = badan menghadap sedikit ke kanan layar.
// bag = true → Gasing menjinjing tas tenis + raket (model 3D js/bag3d.js) di sarung tangan kirinya.
// Kalau WebGL gagal → gasing.png + slot gambar assets/scene3/tas-raket-tenis.png
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

  const g = gasing('Gasing menunggu tiket', 's1-gasing', 0.35, true, S12_BAG_SIDE);   // tas raket di punggung (sama seperti scene lain)
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
function scene2(ctx) {
  const track = h('div', { class: 's2-track' },
    slot({ src: A.s2_view, label: 'View landmark Surabaya (lebar, bisa di-loop)', className: 's2-view', fit: 'cover' }),
    slot({ src: A.s2_view, label: 'View landmark Surabaya (lebar, bisa di-loop)', className: 's2-view', fit: 'cover' }));

  const g2 = gasing('Gasing lihat jendela', 's2-gasing', 0.3, true, S12_BAG_SIDE);   // tas raket di punggung (sama seperti scene lain)
  const el = h('section', { class: 'scene s2' },
    h('div', { class: 's2-wall' }),
    h('div', { class: 's2-window' },
      h('div', { class: 's2-outside' }, track, h('div', { class: 's2-poles' })),
      h('div', { class: 's2-glare' })),
    slot({ src: A.s2_window, label: 'Frame jendela (opsional)', className: 's2-frame overlay-optional', fit: 'fill' }),
    g2);

  let loop;
  return {
    el,
    enter() {
      gsap.delayedCall(1.2, () => g2.gesture('marvelNear'));   // kagum melihat pemandangan
      loop = gsap.to(track, { xPercent: -50, duration: 14, ease: 'none', repeat: -1 });
      gsap.to(el.querySelector('.s2-window'), { y: 2, duration: 0.18, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.from(el.querySelector('.s2-gasing'), { y: 60, opacity: 0, duration: 0.8, delay: 0.3 });
      gsap.delayedCall(2.2, () => ctx.showAction('Turun di Surabaya →', () => ctx.next()));
    },
    exit() { loop?.kill(); gsap.killTweensOf(el.querySelector('.s2-window')); },
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
        .add(() => { g11.wobble(); g11.gesture('startle'); })   // senggol tas (kaget), lalu Gasing meloncat
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
