// ============================================================
//  SCENE 3 (3D) — JALAN DI SURABAYA — Three.js
//  Jalan kota sore hari: deretan ruko kolonial, spanduk "Selamat Datang di
//  SURABAYA", gerobak soto Ambengan (uap mengepul) dan toko antik dengan pintu
//  terbuka yang bercahaya. Sama seperti toko di scene 4, Gasing adalah elemen DOM
//  (gasing3d.js) yang posisi + ukurannya diproyeksikan dari titik di trotoar 3D,
//  jadi ia benar-benar berjalan di jalan itu. Tas tenis dijinjing di sarung tangan
//  kirinya (bag: true) dan menjadi bagian dari elemen yang sama.
//
//  Alur: Gasing datang → ketuk gerobak (makan soto) → ketuk toko antik →
//  Gasing berjalan ke pintu, memudar ke dalam cahaya → onDone() → scene 4.
//
//  Dipakai oleh world3d.js (renderer dipakai bersama toko & koper).
// ============================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { createGasing3D, GESTURE_TIMING } from './gasing3d.js';
import { buildSotoServer } from './server3d.js';
import { CONFIG } from './config.js';
import { sfx } from './audio.js';
import { rng, std, box, put, mesh, canvasTex, dotTexture } from './shop3d.js';

const DEG = Math.PI / 180;
const WALL_Z = -3.6;                       // muka bangunan
const CURB_Z = 3.4;                        // tepi trotoar
const CART_SHIFT = 1.8;                    // gerobak digeser ke kanan supaya lebih terlihat (tidak tertutup Baso Booth)
const CART = new THREE.Vector3(-0.6 + CART_SHIFT, 0, 0.3);
const SHOP = { x: 4.9, w: 5.4, h: 5.2, d: 4.5 };
const DOOR = new THREE.Vector3(SHOP.x, 0.06, WALL_Z + 0.95);   // berdiri di teras
const PORCH_H = 0.06;

// Gasing (elemen DOM) berjalan di trotoar
const ACTOR_H = 1.55, ACTOR_FOOT = 0.1;
const START = { x: -9.8, z: 2.7 };
const STAND = { x: -3.5 + CART_SHIFT, z: 1.95 };        // menunggu di sini sebelum gerobak diketuk
const EAT_AT = { x: -0.45 + CART_SHIFT, z: 2.35 };        // berdiri tepat di depan gerobak (di depan bangku) saat makan
const EAT_TEXTS = ['Nyam...nyam...nyam...', 'Sotonya lezat sekali! mmm!'];   // dua gelembung pikiran berurutan saat makan soto
const EAT_HOPS = 4;   // lama makan soto: jumlah loncatan senang (×0,8 dtk). 4 = durasi dari branch teman; gelembung ke-2 muncul di pertengahan

// Penjual soto: '3d' = model toon (server3d.js); '2d' = gambar assets/scene3/penjual-soto.png sebagai sprite
const SERVER_STYLE = '3d';

const VIEWS = {
  //        target (t)           arah kamera (dir)    lebar/tinggi yang harus muat; p = variasi layar portrait
  // po = seberapa jauh titik pandang diturunkan (pecahan h) supaya objek naik di layar & caption di bawah tidak menutupi
  intro: { t: [0.8, 2.4, -1.0], dir: [-0.38, 0.42, 1], w: 19, h: 8.4, p: { t: [-2.0, 2.2, -0.5], w: 9.5, h: 7.5, po: 0.04 } },
  wide: { t: [1.2, 2.3, -0.8], dir: [-0.14, 0.1, 1], w: 15.5, h: 7.4, p: { t: [-1.7, 2.5, 0.2], w: 6.6, h: 6.0, po: 0.02 } },
  cart: { t: [-1.2 + CART_SHIFT, 1.3, 0.9], dir: [-0.1, 0.09, 1], w: 6.4, h: 3.6, p: { t: [-0.9 + CART_SHIFT, 1.7, 0.9], w: 5.2, h: 4.2, po: 0.02 } },
  after: { t: [1.9, 2.4, -0.8], dir: [-0.1, 0.1, 1], w: 14.2, h: 7.2, p: { t: [3.4, 2.5, -0.6], w: 7.4, h: 6.4, po: 0.02 } },
  shop: { t: [SHOP.x, 2.3, -2.6], dir: [-0.06, 0.08, 1], w: 7.4, h: 5.6, p: { w: 6.2, h: 5.6, po: 0.02 } },
  door: { t: [SHOP.x, 1.5, -3.0], dir: [0, 0.05, 1], w: 3.6, h: 2.7, p: { w: 3.4, h: 3.2, po: 0.02 } },
};

const sleepRaw = (s) => new Promise((r) => setTimeout(r, s * 1000));

/* ============================================================
   Tekstur kanvas
============================================================ */
function fitFont(g, text, weight, family, maxW, size) {
  do { g.font = `${weight} ${size}px ${family}`; size -= 4; } while (g.measureText(text).width > maxW && size > 20);
}
const DISPLAY = 'Fredoka, "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
const BODY = 'Nunito, "Trebuchet MS", sans-serif';

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#3f93d2'); gr.addColorStop(0.38, '#86c4ea'); gr.addColorStop(0.62, '#cfe3e6'); gr.addColorStop(0.8, '#f7e3b8'); gr.addColorStop(1, '#f6d8a4');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cloudTexture(seed) {
  const r = rng(seed);
  return canvasTex(256, 128, (g) => {
    for (let i = 0; i < 16; i++) {
      const x = 40 + r() * 176, y = 64 + (r() - 0.5) * 34, rad = 22 + r() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    }
  });
}

function pavingTexture() {
  const r = rng(11);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#cbbda2'; g.fillRect(0, 0, w, h);
    const n = 4, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 190 + Math.floor(r() * 26);
      g.fillStyle = `rgb(${v + 10},${v},${v - 20})`;
      g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(60,45,25,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 2 + r() * 5, 2 + r() * 5); }
  }, { repeat: [34, 4] });
}

function asphaltTexture() {
  const r = rng(5);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4c4b4d'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) { const v = 50 + Math.floor(r() * 50); g.fillStyle = `rgba(${v},${v},${v},.5)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  }, { repeat: [16, 5] });
}

function dashTexture() {
  return canvasTex(256, 32, (g, w, h) => {
    g.fillStyle = '#f4efe0'; g.fillRect(8, 6, 150, h - 12);
  }, { repeat: [30, 1] });
}

function stripeTexture(a, b, n = 8) {
  return canvasTex(256, 64, (g, w, h) => {
    const s = w / n;
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * s, 0, s + 1, h); }
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.18)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

function drawWindow(g, x, y, w, h, { trim, glass, shutter, arch }) {
  const sw = w * 0.5;
  for (const sx of [-1, 1]) {                       // daun jendela terbuka di kiri-kanan
    const lx = sx < 0 ? x - sw : x + w;
    g.fillStyle = shutter; g.fillRect(lx, y, sw, h);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1.5;
    for (let ly = y + 5; ly < y + h - 3; ly += 7) { g.beginPath(); g.moveTo(lx + 3, ly); g.lineTo(lx + sw - 3, ly); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.strokeRect(lx + 1, y + 1, sw - 2, h - 2);
  }
  g.fillStyle = trim;
  g.fillRect(x - 5, y - 5, w + 10, h + 12);
  if (arch) { g.beginPath(); g.arc(x + w / 2, y - 3, w / 2 + 5, Math.PI, 0); g.fill(); }
  const gr = g.createLinearGradient(x, y, x + w, y + h);
  gr.addColorStop(0, glass); gr.addColorStop(0.45, '#7aa0b5'); gr.addColorStop(1, glass);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  if (arch) { g.beginPath(); g.arc(x + w / 2, y, w / 2, Math.PI, 0); g.fill(); }
  g.strokeStyle = trim; g.lineWidth = 4;
  g.beginPath(); g.moveTo(x + w / 2, y - (arch ? w / 2 : 0)); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h * 0.42); g.lineTo(x + w, y + h * 0.42); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.22)';
  g.beginPath(); g.moveTo(x + 6, y + h - 6); g.lineTo(x + w * 0.45, y + 6); g.lineTo(x + w * 0.62, y + 6); g.lineTo(x + 22, y + h - 6); g.fill();
  g.fillStyle = trim; g.fillRect(x - 9, y + h + 4, w + 18, 7);   // ambang
}

function facadeTexture({ w, h, floors = 2, cols = 3, color, trim, shutter, glass = '#2c3e4c', seed = 1, ground = 'shutter', arch = false }) {
  const PX = 100;
  return canvasTex(Math.round(w * PX), Math.round(h * PX), (g, cw, ch) => {
    const r = rng(seed * 31 + 7);
    g.fillStyle = color; g.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 260; i++) {                  // noda & lumut
      g.fillStyle = r() < 0.55 ? `rgba(70,45,20,${0.02 + r() * 0.05})` : `rgba(255,255,255,${0.02 + r() * 0.04})`;
      g.fillRect(r() * cw, r() * ch, 6 + r() * 36, 12 + r() * 70);
    }
    const fh = ch / floors;
    for (let f = 1; f < floors; f++) {               // pita antar lantai
      g.fillStyle = trim; g.fillRect(0, f * fh - 8, cw, 16);
      g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, f * fh + 8, cw, 4);
    }
    const colW = cw / cols;
    for (let f = 0; f < floors - 1; f++) for (let c = 0; c < cols; c++) {
      const ww = Math.min(colW * 0.4, 66), wh = fh * 0.56;
      drawWindow(g, colW * (c + 0.5) - ww / 2, f * fh + fh * 0.2, ww, wh, { trim, glass, shutter, arch });
    }
    const gy = (floors - 1) * fh;                    // lantai dasar
    for (let c = 0; c < cols; c++) {
      const cx = colW * (c + 0.5);
      if (ground === 'shutter' && c !== Math.floor(cols / 2)) {
        const sw = colW * 0.8, sh = fh * 0.74, y0 = ch - sh - 4;
        g.fillStyle = '#9ba1a6'; g.fillRect(cx - sw / 2, y0, sw, sh);
        g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2;
        for (let y = y0 + 6; y < y0 + sh; y += 7) { g.beginPath(); g.moveTo(cx - sw / 2, y); g.lineTo(cx + sw / 2, y); g.stroke(); }
        g.strokeStyle = trim; g.lineWidth = 6; g.strokeRect(cx - sw / 2 - 3, y0 - 3, sw + 6, sh + 6);
      } else if (c === Math.floor(cols / 2)) {
        const dw = Math.min(colW * 0.58, 70), dh = fh * 0.72, y0 = ch - dh - 4;
        g.fillStyle = trim; g.fillRect(cx - dw / 2 - 6, y0 - 6, dw + 12, dh + 6);
        const dg = g.createLinearGradient(0, y0, 0, y0 + dh);
        dg.addColorStop(0, shutter); dg.addColorStop(1, 'rgba(0,0,0,.4)');
        g.fillStyle = shutter; g.fillRect(cx - dw / 2, y0, dw, dh);
        g.fillStyle = dg; g.fillRect(cx - dw / 2, y0, dw, dh);
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(cx - dw / 2 + 6, y0 + 8, dw - 12, dh * 0.4);
        g.strokeRect(cx - dw / 2 + 6, y0 + dh * 0.5, dw - 12, dh * 0.42);
      } else {
        drawWindow(g, cx - 34, gy + fh * 0.3, 68, fh * 0.46, { trim, glass, shutter, arch });
      }
    }
    const gr = g.createLinearGradient(0, ch - 90, 0, ch);  // kotor di dasar dinding
    gr.addColorStop(0, 'rgba(40,30,20,0)'); gr.addColorStop(1, 'rgba(40,30,20,.4)');
    g.fillStyle = gr; g.fillRect(0, ch - 90, cw, 90);
  });
}

/* ---------------- Toko bernama (scene 3): gambar assets/scene3/storefronts.webp ----------------
   Satu lembar berisi 5 muka toko. Tiap toko dipotong dari lembar itu (latar putih dibuat
   transparan), ditempel sebagai muka bangunan, lalu bagian-bagiannya diberi volume 3D:
   lisplang atas (kotak menonjol + atap limas), papan nama timbul, dan kanopi miring +
   rumbai bergerigi. Semua angka di STORE_ART = koordinat piksel di lembar gambar.
     crop    = [x0, y0, x1, y1]  seluruh toko (y1 = garis tanah, lantai abu-abu di bawahnya dibuang)
     wall    = [xKiri, xKanan]   lebar dinding (dipetakan ke lebar bangunan dalam meter)
     cornice = [x0, y0, x1, y1]  lisplang paling atas
     sign    = [x0, y0, x1, y1]  papan nama
     awn     = [x0, yAtas, x1, yMulaiGerigi, yBawahGerigi]  kanopi belang                         */
const STOREFRONT_SRC = 'assets/scene3/storefronts.webp';
const STORE_ART = {
  rawon: { crop: [13, 22, 467, 551], wall: [38, 439], cornice: [28, 22, 449, 58], sign: [56, 59, 421, 152], awn: [29, 306, 448, 337, 362], wallColor: '#f2d9bf', roof: 0x9a4b2c },
  sate: { crop: [476, 22, 928, 551], wall: [497, 903], cornice: [486, 22, 914, 58], sign: [516, 59, 885, 152], awn: [490, 306, 912, 337, 361], wallColor: '#dde3cc', roof: 0xa8532f },
  baso: { crop: [939, 22, 1392, 551], wall: [961, 1366], cornice: [950, 22, 1378, 58], sign: [980, 59, 1349, 152], awn: [954, 306, 1376, 337, 361], wallColor: '#f3e1cd', roof: 0x9c5536 },
  wilson: { crop: [105, 588, 657, 1090], wall: [140, 630], cornice: [125, 588, 645, 623], sign: [165, 625, 606, 712], awn: [131, 847, 644, 881, 907], wallColor: '#f6e2c9', roof: 0xa8532f },
  hoka: { crop: [677, 588, 1254, 1090], wall: [699, 1219], cornice: [684, 588, 1236, 624], sign: [725, 626, 1200, 712], awn: [690, 847, 1230, 881, 904], wallColor: '#cfe1ef', roof: 0x8e5a40 },
};

let storeSheet = null;                       // Promise<HTMLImageElement>, dimuat sekali
function loadStoreSheet() {
  storeSheet ??= new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = STOREFRONT_SRC;
  });
  return storeSheet;
}

/** Potong satu toko dari lembar → kanvas dengan latar putih transparan (flood fill dari tepi). */
function keyStoreCrop(img, A, cv) {
  const [x0, y0, x1, y1] = A.crop;
  const w = cv.width, h = cv.height;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, w, h);
  g.drawImage(img, x0, y0, w, h, 0, 0, w, h);
  const id = g.getImageData(0, 0, w, h), d = id.data;
  const white = (i) => d[i] > 236 && d[i + 1] > 236 && d[i + 2] > 236 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) < 14;
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);   // baris atas & bawah
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    if (!white(p * 4)) continue;
    d[p * 4 + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  // kikis 1 px pinggiran terang (sisa anti-alias latar putih)
  const clear = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x, i = p * 4;
    if (!d[i + 3]) continue;
    if ((!d[i - 1] || !d[i + 7] || !d[i - w * 4 + 3] || !d[i + w * 4 + 3]) && d[i] + d[i + 1] + d[i + 2] > 640) clear.push(i);
  }
  for (const i of clear) d[i + 3] = 0;
  g.putImageData(id, 0, 0);
  return { g, d, w, h };
}

/** Bentuk rumbai bergerigi: tiap belang kanopi diberi ujung bawah setengah lingkaran. */
function scallopMask(src, A, cv) {
  const [ax0, , ax1, aMid, aBot] = A.awn;
  const [cx0, cy0] = A.crop;
  const w = cv.width, h = cv.height;
  const yProbe = aMid - cy0 + 3;
  // klasifikasi belang gelap / terang di satu baris tepat di bawah bagian miring
  const lum = [];
  for (let x = 0; x < w; x++) {
    const i = (yProbe * src.w + (ax0 - cx0 + x)) * 4;
    lum.push(src.d[i + 3] ? 0.3 * src.d[i] + 0.59 * src.d[i + 1] + 0.11 * src.d[i + 2] : -1);
  }
  const vals = lum.filter((v) => v >= 0);
  const thr = (Math.min(...vals) + Math.max(...vals)) / 2;
  const runs = [];
  let s = -1, cls = null;
  for (let x = 0; x <= w; x++) {
    const c = x < w && lum[x] >= 0 ? lum[x] > thr : null;
    if (c !== cls) { if (cls !== null && x - s >= 3) runs.push([s, x - 1]); s = x; cls = c; }
  }
  const g = cv.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.drawImage(src.g.canvas, ax0 - cx0, aMid - cy0, w, h, 0, 0, w, h);
  g.globalCompositeOperation = 'destination-in';     // simpan piksel hanya di dalam bentuk gerigi
  g.fillStyle = '#000';
  g.beginPath();
  for (const [a, b] of runs) {
    const r = (b - a + 1) / 2, ry = Math.min(r * 0.9, h * 0.75), cx = a + r;
    g.moveTo(a - 0.5, 0); g.lineTo(b + 1.5, 0); g.lineTo(b + 1.5, h - ry);
    g.ellipse(cx + 0.5, h - ry, r + 1, ry, 0, 0, Math.PI);
    g.lineTo(a - 0.5, 0);
  }
  g.fill();
  g.globalCompositeOperation = 'source-over';
}

/** Di muka dinding, kanopi & rumbai lukisan ditimpa bayangan di bawah kanopi (yang terlihat kini kanopi 3D). */
function hidePaintedAwning(src, A) {
  const [ax0, aTop, ax1, , aBot] = A.awn;
  const [cx0, cy0] = A.crop;
  const { g, w } = src;
  const x0 = Math.max(0, ax0 - cx0), x1 = Math.min(w - 1, ax1 - cx0);
  const yA = aTop - cy0, yB = aBot - cy0 + 2;
  const id = g.getImageData(0, 0, w, src.h), d = id.data;
  for (let x = x0; x <= x1; x++) {
    const bi = ((yB + 2) * w + x) * 4;                     // warna tepat di bawah rumbai (bagian dalam bilik / dinding)
    for (let y = yA; y <= yB; y++) {
      const i = (y * w + x) * 4;
      if (!d[i + 3]) continue;
      const k = 0.55 + 0.3 * ((y - yA) / (yB - yA));       // makin ke atas makin gelap (bayangan kanopi)
      d[i] = d[bi] * k; d[i + 1] = d[bi + 1] * k; d[i + 2] = d[bi + 2] * k;
    }
  }
  g.putImageData(id, 0, 0);
}

function hipRoof(w, d, rise, color) {
  const geo = new THREE.CylinderGeometry(0.16, 1, rise, 4, 1);
  geo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(geo, std(color, { roughness: 0.85, flatShading: true, envMapIntensity: 0.2 }));
  roof.scale.set(w * 0.7071, 1, d * 0.7071);
  roof.castShadow = true;
  return roof;
}

/**
 * Toko bernama dari lembar gambar. `width` = lebar dinding (m); tinggi mengikuti proporsi gambar.
 * Titik asal grup: tengah-bawah muka dinding (z = 0 → muka depan, bangunan ke arah -z).
 */
function buildStorefront(kind, width, { depth = 5 } = {}) {
  const A = STORE_ART[kind];
  const [cx0, cy0, cx1, cy1] = A.crop;
  const s = width / (A.wall[1] - A.wall[0]);                    // meter per piksel
  const midX = (A.wall[0] + A.wall[1]) / 2;
  const X = (px) => (px - midX) * s, Y = (py) => (cy1 - py) * s;
  const g = new THREE.Group();

  // kanvas potongan (diisi setelah gambar termuat); semua tekstur bagian = klon dengan offset/repeat
  const cw = cx1 - cx0, ch = cy1 - cy0;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const base = new THREE.CanvasTexture(cv);
  base.colorSpace = THREE.SRGBColorSpace; base.anisotropy = 8;
  const texs = [base];
  const sub = (x0, y0, x1, y1) => {
    const t = base.clone();
    t.repeat.set((x1 - x0) / cw, (y1 - y0) / ch);
    t.offset.set((x0 - cx0) / cw, 1 - (y1 - cy0) / ch);
    texs.push(t);
    return t;
  };
  const cut = (map, o = {}) => std(0xffffff, { map, alphaTest: 0.5, roughness: 0.88, envMapIntensity: 0.2, ...o });

  // badan bangunan (sisi & atap datar), warna dinding diambil dari gambar
  const H = Y(A.cornice[3]) + 0.05;
  const sideM = std(new THREE.Color(A.wallColor).multiplyScalar(0.8), { roughness: 0.95, envMapIntensity: 0.2 });
  put(g, box(width, H, depth, sideM), 0, H / 2, -depth / 2);

  // muka toko (gambar penuh, latar transparan) sedikit di depan dinding
  const face = put(g, mesh(new THREE.PlaneGeometry(cw * s, ch * s), cut(base), { cast: false }), X((cx0 + cx1) / 2), Y((cy0 + cy1) / 2), 0.012);
  face.renderOrder = 1;

  // lisplang atas: kotak menonjol, muka depannya = potongan lisplang dari gambar
  const [kx0, ky0, kx1, ky1] = A.cornice;
  const trimM = std(new THREE.Color(A.wallColor).lerp(new THREE.Color(0xffffff), 0.35), { roughness: 0.85, envMapIntensity: 0.2 });
  const kD = 0.55, kW = (kx1 - kx0) * s, kH = (ky1 - ky0) * s;
  put(g, new THREE.Mesh(new THREE.BoxGeometry(kW, kH, kD), [trimM, trimM, trimM, trimM, cut(sub(kx0, ky0, kx1, ky1)), trimM]), X((kx0 + kx1) / 2), Y((ky0 + ky1) / 2), kD / 2 - 0.22)
    .castShadow = true;
  const rise = 1.0 + (kind.length % 3) * 0.15;
  put(g, hipRoof(kW + 0.3, depth + 0.3, rise, A.roof), X((kx0 + kx1) / 2), Y(ky0) + rise / 2 - 0.02, -depth / 2 + 0.05);

  // papan nama timbul
  const [sx0, sy0, sx1, sy1] = A.sign;
  const sW = (sx1 - sx0) * s, sH = (sy1 - sy0) * s, sD = 0.12;
  const edgeM = std(0x3a2a22, { roughness: 0.7 });
  put(g, new THREE.Mesh(new THREE.BoxGeometry(sW, sH, sD), [edgeM, edgeM, edgeM, edgeM, cut(sub(sx0, sy0, sx1, sy1), { roughness: 0.6 }), edgeM]), X((sx0 + sx1) / 2), Y((sy0 + sy1) / 2), sD / 2 + 0.02)
    .castShadow = true;

  // kanopi miring (bagian belang atas) + rumbai bergerigi di ujung depannya
  const [ax0, aTop, ax1, aMid, aBot] = A.awn;
  const aW = (ax1 - ax0) * s, dy = (aMid - aTop) * s, D = 0.62;
  const th = Math.atan2(D, dy), len = Math.hypot(D, dy);
  const ownTex = (w, h) => {           // kanvas sendiri: muka dinding di baris kanopi nanti ditimpa bayangan
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    texs.push(t);
    return t;
  };
  const stex = ownTex(ax1 - ax0, aMid - aTop);
  const slope = put(g, mesh(new THREE.PlaneGeometry(aW, len), cut(stex, { side: THREE.DoubleSide })), X((ax0 + ax1) / 2), Y(aTop) - dy / 2, D / 2 + 0.03);
  slope.rotation.x = -th;
  const vtex = ownTex(ax1 - ax0, aBot - aMid), vcv = vtex.image;
  const vH = (aBot - aMid) * s;
  put(g, mesh(new THREE.PlaneGeometry(aW, vH), cut(vtex, { side: THREE.DoubleSide })), X((ax0 + ax1) / 2), Y(aMid) - vH / 2, D + 0.03);
  // sirip samping kanopi (segitiga dinding → ujung depan)
  const finM = std(0xffffff, { roughness: 0.9, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const fx = X(side < 0 ? ax0 : ax1) - side * 0.04;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([fx, Y(aTop), 0.02, fx, Y(aMid), D + 0.03, fx, Y(aMid) - vH * 0.55, D + 0.03, fx, Y(aMid) - vH * 0.3, 0.02], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    g.add(mesh(geo, finM));
  }

  loadStoreSheet().then((img) => {
    const src = keyStoreCrop(img, A, cv);
    stex.image.getContext('2d').drawImage(cv, ax0 - cx0, aTop - cy0, stex.image.width, stex.image.height, 0, 0, stex.image.width, stex.image.height);
    scallopMask(src, A, vcv);
    hidePaintedAwning(src, A);
    // warna sirip = belang gelap kanopi
    let best = null;
    for (let x = ax0 - cx0 + 8; x < ax1 - cx0 - 8; x++) {
      const j = ((aTop - cy0 + 12) * src.w + x) * 4;
      const l = src.d[j] + src.d[j + 1] + src.d[j + 2];
      if (src.d[j + 3] && (!best || l < best.l)) best = { l, c: [src.d[j], src.d[j + 1], src.d[j + 2]] };
    }
    if (best) finM.color.setRGB(best.c[0] / 255, best.c[1] / 255, best.c[2] / 255, THREE.SRGBColorSpace);
    for (const t of texs) t.needsUpdate = true;
  }).catch((e) => console.warn('storefronts.webp gagal dimuat', e));

  return { group: g, height: H, scale: s, Y };
}

function welcomeTexture() {
  return canvasTex(2048, 420, (g, w, h) => {
    g.fillStyle = '#f7efdc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c1272d'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
    g.strokeStyle = '#c1272d'; g.lineWidth = 6; g.strokeRect(46, 52, w - 92, h - 104);
    g.fillStyle = '#7b1a1e'; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitFont(g, 'Selamat Datang di', 600, DISPLAY, 1300, 92);
    g.fillText('Selamat Datang di', w / 2, 120);
    g.fillStyle = '#c1272d';
    fitFont(g, 'SURABAYA', 700, DISPLAY, 1250, 230);
    g.fillText('SURABAYA', w / 2, 262);
    g.font = '100px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    g.fillText('🦈', 170, h / 2); g.fillText('🐊', w - 170, h / 2);
  });
}

function shopSignTexture() {
  return canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#1f3a2c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d4b062'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
    g.lineWidth = 2; g.strokeRect(28, 28, w - 56, h - 56);
    g.fillStyle = '#e6c474'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 118px Georgia, serif'; g.fillText('TOKO ANTIK', w / 2, h / 2 - 14);
    g.font = 'italic 32px Georgia, serif'; g.fillText('~ sejak 1926 ~', w / 2, h - 50);
  });
}

function cartSignTexture() {
  return canvasTex(1024, 280, (g, w, h) => {
    g.fillStyle = '#b8321f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f6e7c1'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#fff3d0'; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitFont(g, 'SOTO AMBENGAN', 700, DISPLAY, 860, 128);
    g.fillText('SOTO AMBENGAN', w / 2, h / 2 - 16);
    g.font = `600 40px ${BODY}`; g.fillText('~ khas Surabaya ~', w / 2, h - 52);
  });
}

function lampBoardTexture() {      // papan kecil "BUKA"
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#f2e4c2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6a2b'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#3b2a1a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 64px Georgia, serif'; g.fillText('BUKA', w / 2, h / 2 + 2);
  });
}

function interiorTexture() {      // bagian dalam toko yang terlihat lewat pintu terbuka
  const r = rng(77);
  return canvasTex(256, 512, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, h * 0.7);
    gr.addColorStop(0, '#ffe6b0'); gr.addColorStop(0.5, '#e8a85a'); gr.addColorStop(1, '#6a3a16');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(60,30,10,.55)';
    for (const y of [150, 270, 390]) g.fillRect(0, y, w, 8);        // rak
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) {
      const x = 14 + i * 40 + r() * 10, bh = 26 + r() * 44, bw = 14 + r() * 14;
      g.beginPath(); g.ellipse(x, 150 + row * 120 - bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(40,20,5,.7)'; g.beginPath(); g.arc(w / 2, 70, 26, 0, Math.PI * 2); g.fill();   // lampu gantung
    g.fillRect(w / 2 - 1.5, 0, 3, 50);
  });
}

function displayWindowTexture(seed) {
  const r = rng(seed);
  return canvasTex(256, 300, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#f3d08c'); gr.addColorStop(1, '#a86a2e');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(70,35,10,.8)'; g.fillRect(0, h * 0.72, w, 10);
    g.fillStyle = 'rgba(50,25,8,.82)';
    for (let i = 0; i < 4; i++) {                   // siluet barang antik
      const x = 38 + i * 58 + r() * 12, kind = Math.floor(r() * 3);
      if (kind === 0) { g.beginPath(); g.ellipse(x, h * 0.72 - 36, 20, 34, 0, 0, Math.PI * 2); g.fill(); g.fillRect(x - 8, h * 0.72 - 84, 16, 22); }
      else if (kind === 1) { g.beginPath(); g.arc(x, h * 0.72 - 32, 26, 0, Math.PI * 2); g.fill(); g.fillRect(x - 14, h * 0.72 - 6, 28, 6); }
      else { g.beginPath(); g.moveTo(x - 24, h * 0.72); g.lineTo(x + 24, h * 0.72); g.lineTo(x + 8, h * 0.72 - 62); g.lineTo(x - 8, h * 0.72 - 62); g.fill(); }
    }
    g.fillStyle = 'rgba(255,255,255,.2)';
    g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.3); g.lineTo(w * 0.5, 0); g.lineTo(w * 0.7, 0); g.lineTo(w * 0.2, h); g.fill();
  });
}

function shopFacadeTexture(W, H) {
  const PX = 100;
  return canvasTex(Math.round(W * PX), Math.round(H * PX), (g, cw, ch) => {
    const r = rng(19);
    const wy = (y) => (H - y) * PX;                       // y dunia → y kanvas
    g.fillStyle = '#2f4a3a'; g.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 280; i++) {
      g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.03 + r() * 0.07})` : `rgba(255,255,255,${0.02 + r() * 0.04})`;
      g.fillRect(r() * cw, r() * ch, 6 + r() * 30, 12 + r() * 60);
    }
    // lantai dasar: panel kayu jati
    g.fillStyle = '#4a2a17'; g.fillRect(0, wy(3.05), cw, wy(0) - wy(3.05));
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3;
    for (let x = 12; x < cw; x += 54) { g.beginPath(); g.moveTo(x, wy(3.05)); g.lineTo(x, wy(0)); g.stroke(); }
    g.fillStyle = '#b08a3a'; g.fillRect(0, wy(3.18), cw, 14);                 // pita emas
    g.fillStyle = '#6a3520'; g.fillRect(0, wy(0.8), cw, 8);
    // lantai atas: dua jendela lengkung dengan daun jendela cokelat
    for (const cx of [W * 0.27, W * 0.73]) {
      drawWindow(g, cx * PX - 38, wy(4.7), 76, 120, { trim: '#e8d6a8', glass: '#27343f', shutter: '#6a3520', arch: true });
    }
    g.fillStyle = '#e8d6a8'; g.beginPath(); g.arc(cw / 2, wy(4.2), 34, 0, Math.PI * 2); g.fill();   // jendela bulat
    g.fillStyle = '#27343f'; g.beginPath(); g.arc(cw / 2, wy(4.2), 26, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#e8d6a8'; g.lineWidth = 3; g.beginPath(); g.moveTo(cw / 2 - 26, wy(4.2)); g.lineTo(cw / 2 + 26, wy(4.2)); g.moveTo(cw / 2, wy(4.2) - 26); g.lineTo(cw / 2, wy(4.2) + 26); g.stroke();
    g.fillStyle = '#d4b062'; g.fillRect(0, wy(5.2) - 6, cw, 10);                 // gading atas
  });
}

/* ============================================================
   Model: bangunan, gerobak, pohon, tiang
============================================================ */
function buildHouse({ w, h, d = 5, floors = 2, cols = 3, color, trim, shutter, seed, balcony = false, awning = null, ac = false, arch = false, tex = null }) {
  const g = new THREE.Group();
  tex ??= facadeTexture({ w, h, floors, cols, color, trim, shutter, seed, arch });
  const front = std(0xffffff, { map: tex, roughness: 0.92, envMapIntensity: 0.2 });
  const side = std(new THREE.Color(color).multiplyScalar(0.78), { roughness: 0.95, envMapIntensity: 0.2 });
  const trimM = std(trim, { roughness: 0.8, envMapIntensity: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, front, side]);
  body.position.set(0, h / 2, -d / 2);
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  put(g, box(w + 0.06, 0.34, 0.1, std(0x8d8070)), 0, 0.17, 0.03);                       // plint
  put(g, box(w + 0.34, 0.22, 0.4, trimM), 0, h + 0.02, -0.04);                           // lisplang atas
  put(g, box(w + 0.18, 0.1, 0.24, trimM), 0, h - 0.18, -0.02);

  const rise = 1.0 + (seed % 3) * 0.15;                                                  // atap limas genteng
  put(g, hipRoof(w + 0.7, d + 0.5, rise, 0xa8532f), 0, h + 0.12 + rise / 2, -d / 2 - 0.05);

  const fh = h / floors;
  if (balcony) {                                                                          // balkon lantai atas
    const by = h - fh + 0.04;
    put(g, box(w * 0.46, 0.09, 0.78, trimM), 0, by, 0.38);
    put(g, box(w * 0.46, 0.06, 0.05, trimM), 0, by + 0.95, 0.74);
    for (let i = 0; i < 9; i++) put(g, box(0.035, 0.9, 0.035, trimM, { cast: false }), -w * 0.21 + (i * w * 0.42) / 8, by + 0.5, 0.74);
  }
  if (awning) {                                                                           // kanopi toko lantai dasar
    const a = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.05, 1.05), std(0xffffff, { map: stripeTexture(awning[0], awning[1], 10), roughness: 0.9 }));
    a.position.set(0, 2.55, 0.5); a.rotation.x = 0.16; a.castShadow = true; a.receiveShadow = true;
    g.add(a);
  }
  if (ac) {                                                                               // AC kecil di dinding
    put(g, box(0.62, 0.34, 0.3, std(0xe9e9e4, { roughness: 0.6 })), w * 0.3, h - fh * 0.42, 0.15);
  }
  return g;
}

function makeVase(h, color) {
  const pts = [[0, 0], [0.22, 0], [0.3, 0.14], [0.34, 0.34], [0.26, 0.58], [0.15, 0.74], [0.17, 0.9], [0.24, 1.0], [0.0, 1.0]]
    .map(([x, y]) => new THREE.Vector2(x * h * 0.5, y * h));
  const v = mesh(new THREE.LatheGeometry(pts, 20), std(color, { roughness: 0.35, envMapIntensity: 0.8 }));
  return v;
}

function buildWheel(r) {
  const g = new THREE.Group();
  const dark = std(0x2b2724, { roughness: 0.7 });
  g.add(mesh(new THREE.TorusGeometry(r, 0.045, 8, 28), dark));
  const hub = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 10), std(0xb9bec4, { metalness: 0.8, roughness: 0.3 }));
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  for (let i = 0; i < 8; i++) {
    const s = box(r * 2, 0.025, 0.025, std(0x8a5a33), { cast: false });
    s.rotation.z = (i * Math.PI) / 8;
    g.add(s);
  }
  return g;
}

function buildCart(anim, steamTex) {
  const g = new THREE.Group();
  const wood = std(0x8a5a33, { roughness: 0.7 });
  const woodDark = std(0x4f2f1a, { roughness: 0.8 });
  const steel = std(0xb9bec4, { metalness: 0.85, roughness: 0.28, envMapIntensity: 1 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0xd6ebe6, transparent: true, opacity: 0.16, roughness: 0.05, envMapIntensity: 1.2, depthWrite: false });

  put(g, box(2.0, 0.62, 1.0, wood), 0, 0.98, 0);                                     // badan
  put(g, box(2.06, 0.05, 1.06, woodDark), 0, 1.315, 0);                              // meja atas
  put(g, box(1.84, 0.05, 0.9, woodDark), 0, 0.48, 0);                                // rak bawah
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.82, 0.5), new THREE.MeshStandardMaterial({ map: cartSignTexture(), roughness: 0.7 }));
  sign.position.set(0, 0.98, 0.503);
  g.add(sign);
  for (const sx of [-0.92, 0.92]) for (const sz of [-0.44, 0.44]) put(g, box(0.07, 0.5, 0.07, woodDark), sx, 0.5, sz);   // kaki
  // jerigen & panci di rak bawah
  put(g, mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 14), std(0xd9d6cc, { roughness: 0.5 })), -0.45, 0.67, 0.05);
  put(g, mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 14), std(0x3a6b8a, { roughness: 0.5 })), 0.35, 0.64, -0.05);

  // roda besar (poros searah z), tuas dorong ke kanan, penopang di kiri
  for (const sz of [-0.62, 0.62]) { const w = buildWheel(0.5); w.position.set(0.4, 0.5, sz); g.add(w); }
  put(g, box(0.07, 0.07, 1.4, woodDark), 0.4, 0.5, 0);
  for (const sz of [-0.34, 0.34]) { const hnd = put(g, box(1.25, 0.06, 0.07, woodDark), 1.55, 0.86, sz); hnd.rotation.z = -0.08; }

  // etalase kaca (mangkuk soto, sate, emping, jeruk nipis)
  // (etalase dibuat ramping di kiri supaya wajah penjual terlihat di celah antara etalase & panci)
  const gx = -0.6, GW = 0.7;
  put(g, mesh(new THREE.BoxGeometry(GW, 0.62, 0.78), glassM, { cast: false }), gx, 1.66, 0.02);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(0.035, 0.62, 0.035, steel, { cast: false }), gx + sx * (GW / 2 - 0.015), 1.66, 0.02 + sz * 0.37);
  put(g, box(GW + 0.02, 0.03, 0.8, steel, { cast: false }), gx, 1.98, 0.02);
  const bowlM = std(0xf4f1e8, { roughness: 0.3 });
  const soupM = std(0xc9892f, { roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const bx = gx - 0.16 + (i % 2) * 0.32, bz = -0.12 + Math.floor(i / 2) * 0.3;
    put(g, mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.08, 14), bowlM), bx, 1.375, bz);
    put(g, mesh(new THREE.CircleGeometry(0.095, 14), soupM), bx, 1.418, bz).rotation.x = -Math.PI / 2;
  }
  for (let i = 0; i < 3; i++) put(g, mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.012, 14), std(0xe4b45a, { roughness: 0.6 })), gx - 0.12 + i * 0.01, 1.62 + i * 0.012, 0.15);   // emping
  put(g, mesh(new THREE.SphereGeometry(0.05, 10, 8), std(0x7bb83a)), gx + 0.14, 1.62, 0.12);                                // jeruk nipis
  put(g, mesh(new THREE.SphereGeometry(0.05, 10, 8), std(0x7bb83a)), gx + 0.22, 1.62, 0.22);

  // panci besar berkuah
  const potX = 0.58;
  put(g, mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.42, 20), steel), potX, 1.55, 0.05);
  put(g, mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 20), steel), potX, 1.76, 0.05).rotation.x = Math.PI / 2;
  put(g, mesh(new THREE.CircleGeometry(0.28, 20), soupM), potX, 1.745, 0.05).rotation.x = -Math.PI / 2;
  const ladle = put(g, box(0.03, 0.03, 0.5, steel), potX + 0.22, 1.82, 0.28); ladle.rotation.set(0.5, 0.4, 0);

  // atap terpal merah-putih + 4 tiang
  for (const sx of [-0.98, 0.98]) for (const sz of [-0.46, 0.46]) put(g, box(0.055, 1.3, 0.055, woodDark), sx, 1.97, sz);
  const canopyM = std(0xffffff, { map: stripeTexture('#c0392b', '#f6efe2', 8), roughness: 0.9 });
  const canopy = put(g, new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 1.5), canopyM), 0, 2.64, 0.02);
  canopy.rotation.z = 0.035; canopy.castShadow = true;
  put(g, box(2.4, 0.2, 0.04, canopyM), 0, 2.5, 0.77);
  put(g, box(2.4, 0.2, 0.04, canopyM), 0, 2.5, -0.73);
  // lampu bohlam
  const bulbM = new THREE.MeshBasicMaterial({ color: 0xfff0c0 });
  put(g, new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bulbM), -0.6, 2.38, 0.42);
  put(g, mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 4), woodDark, { cast: false }), -0.6, 2.5, 0.42);

  // bangku plastik di depan gerobak
  const stoolM = std(0xd8472f, { roughness: 0.4 });
  for (const [x, z] of [[0.15, 1.3], [0.95, 1.4]]) {
    put(g, mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), stoolM), x, 0.45, z);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const leg = put(g, mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.44, 6), stoolM), x + Math.cos(a) * 0.15, 0.22, z + Math.sin(a) * 0.15);
      leg.rotation.set(Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1);
    }
  }

  // uap dari panci
  const steam = [];
  const potTop = new THREE.Vector3(potX, 1.82, 0.05);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0, fog: false });
    const s = new THREE.Sprite(m);
    s.renderOrder = 6;
    g.add(s);
    steam.push({ s, m, ph: i / 14, sp: 0.2 + (i % 4) * 0.03 });
  }
  const st = { k: 1 };
  anim.push((t) => {
    for (const p of steam) {
      const u = (t * p.sp + p.ph) % 1;
      p.s.position.set(potTop.x + Math.sin(t * 0.9 + p.ph * 9) * 0.12 * u + u * 0.18, potTop.y + u * 1.25, potTop.z + Math.cos(t * 0.7 + p.ph * 7) * 0.06);
      const sc = 0.3 + u * 0.8;
      p.s.scale.set(sc, sc, 1);
      p.m.opacity = Math.sin(u * Math.PI) * 0.6 * Math.min(1, st.k);
    }
  });
  return { group: g, steam: st, bulb: new THREE.Vector3(-0.6, 2.38, 0.42) };
}

/** Tabung meruncing mengikuti kurva (jari-jari r0 di pangkal → r1 di ujung). */
function taperTube(points, r0, r1, mat, { seg = 12, radial = 9 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = geo.attributes.position, P = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    curve.getPointAt(u, P);
    const r = r0 + (r1 - r0) * Math.pow(u, 0.8);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(P).multiplyScalar(r).add(P);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return { mesh: mesh(geo, mat), curve };
}

function buildTree(seed, anim, scale = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const bark = std(0x5a4632, { roughness: 1 });
  const barkDark = std(0x43321f, { roughness: 1 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // batang: sedikit melengkung & meruncing, bercabang di ketinggian ±2.5 m (tidak ada dahan rendah)
  const lean = (r() - 0.5) * 0.25;
  const FORK = V(lean, 2.5, (r() - 0.5) * 0.1);
  g.add(taperTube([V(0, -0.05, 0), V(0.04, 0.9, 0.02), V(lean * 0.5 - 0.03, 1.8, 0.03), FORK], 0.3, 0.2, bark, { seg: 10, radial: 12 }).mesh);
  put(g, mesh(new THREE.CylinderGeometry(0.3, 0.44, 0.34, 12), barkDark), 0, 0.17, 0);          // pangkal akar melebar
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.6;
    const root = put(g, mesh(new THREE.CylinderGeometry(0.03, 0.09, 0.6, 6), barkDark), Math.cos(a) * 0.36, 0.08, Math.sin(a) * 0.36);
    root.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
  }
  put(g, mesh(new THREE.SphereGeometry(0.21, 12, 10), bark), FORK.x, FORK.y, FORK.z);              // simpul percabangan

  // 3 dahan besar menyebar ke atas-luar + 1 pucuk tengah; tiap dahan punya ranting sekunder
  const tips = [];
  const n = 3;
  const a0 = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5;
    const dx = Math.cos(a), dz = Math.sin(a) * 0.8;                      // sedikit dipipihkan ke arah jalan
    const reach = 1.55 + r() * 0.35, up = 1.35 + r() * 0.3;
    const pts = [
      FORK.clone(),
      V(FORK.x + dx * reach * 0.22, FORK.y + up * 0.35, FORK.z + dz * reach * 0.22),
      V(FORK.x + dx * reach * 0.62, FORK.y + up * 0.72, FORK.z + dz * reach * 0.62),
      V(FORK.x + dx * reach, FORK.y + up, FORK.z + dz * reach),
    ];
    const limb = taperTube(pts, 0.17, 0.05, bark);
    g.add(limb.mesh);
    tips.push(pts[3]);
    // ranting sekunder dari tengah dahan
    const base = limb.curve.getPointAt(0.5 + r() * 0.15);
    const b = a + (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.4);
    const end = V(base.x + Math.cos(b) * 0.85, base.y + 0.6 + r() * 0.3, base.z + Math.sin(b) * 0.65);
    g.add(taperTube([base, base.clone().lerp(end, 0.5).add(V(0, 0.1, 0)), end], 0.075, 0.025, bark, { seg: 6, radial: 7 }).mesh);
    tips.push(end);
  }
  const top = V(FORK.x + (r() - 0.5) * 0.3, FORK.y + 2.0, FORK.z + (r() - 0.5) * 0.2);
  g.add(taperTube([FORK.clone(), V(FORK.x, FORK.y + 0.9, FORK.z), top], 0.15, 0.04, bark, { seg: 8 }).mesh);
  tips.push(top);

  // mahkota: gumpalan daun di ujung tiap dahan + inti di atas percabangan.
  // Grup berporos di titik percabangan supaya ayunannya tidak menggeser pangkal dahan.
  const crown = new THREE.Group();
  crown.position.copy(FORK);
  g.add(crown);
  const greens = [0x35702f, 0x468636, 0x2a6029, 0x559a3e, 0x3d7c33];
  const addBlob = (p, rad, base) => {
    const geo = new THREE.IcosahedronGeometry(rad, rad > 1 ? 3 : 2);
    const pa = geo.attributes.position;
    const col = new Float32Array(pa.count * 3);
    const c0 = new THREE.Color(base);
    const c = new THREE.Color();
    for (let k = 0; k < pa.count; k++) {
      const vx = pa.getX(k), vy = pa.getY(k), vz = pa.getZ(k);
      const nn = 1 + 0.07 * Math.sin(vx * 5.1 + vy * 3.7) * Math.cos(vz * 4.3 + vx * 2.1);   // permukaan agak bergelombang
      const flat = vy < 0 ? 0.72 : 0.92;                                                     // bagian bawah gumpalan lebih datar
      pa.setXYZ(k, vx * nn, vy * nn * flat, vz * nn);
      const u = THREE.MathUtils.clamp((vy / rad + 1) / 2, 0, 1);                             // 0 = dasar gumpalan, 1 = puncak
      c.copy(c0).multiplyScalar(0.55 + u * 0.62);
      c.offsetHSL(0.012 * u, 0, 0.02 * u);
      col.set([c.r, c.g, c.b], k * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = mesh(geo, std(0xffffff, { roughness: 0.92, vertexColors: true, envMapIntensity: 0.25 }));
    m.position.copy(p).sub(FORK);
    crown.add(m);
  };
  addBlob(V(FORK.x, FORK.y + 1.8, FORK.z), 1.55, greens[0]);                                   // inti, menutup pucuk
  tips.forEach((p, i) => addBlob(V(p.x, p.y + 0.25, p.z), 0.95 + r() * 0.3, greens[(i + 1) % greens.length]));
  for (let i = 0; i < 6; i++) {                                                                  // pengisi celah antar dahan
    const a = (i / 6) * Math.PI * 2 + r() * 0.5, d = 1.1 + r() * 0.6;
    addBlob(V(FORK.x + Math.cos(a) * d, FORK.y + 1.5 + r() * 0.6, FORK.z + Math.sin(a) * d * 0.8), 0.8 + r() * 0.35, greens[i % greens.length]);
  }
  for (let i = 0; i < 3; i++) addBlob(V(FORK.x + (r() - 0.5) * 1.2, FORK.y + 2.6 + r() * 0.4, FORK.z + (r() - 0.5) * 1.0), 0.65 + r() * 0.3, greens[3]);   // puncak terang
  const ph = r() * 6;
  anim.push((t) => { crown.rotation.z = Math.sin(t * 0.8 + ph) * 0.012; crown.rotation.x = Math.sin(t * 0.6 + ph) * 0.008; });
  g.scale.setScalar(scale);
  return g;
}

function buildStreetLamp() {
  const g = new THREE.Group();
  const dark = std(0x24342b, { roughness: 0.6, metalness: 0.4 });
  put(g, mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.4, 8), dark), 0, 0.2, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.045, 0.07, 3.9, 8), dark), 0, 2.15, 0);
  const arm = put(g, mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 16, Math.PI / 2), dark), 0.45, 4.1, 0);
  arm.rotation.z = Math.PI / 2;
  const lantern = new THREE.Group();
  lantern.position.set(0.45, 4.0, 0);
  g.add(lantern);
  put(lantern, mesh(new THREE.CylinderGeometry(0.2, 0.13, 0.36, 6, 1), new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd98a, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 })), 0, 0, 0);
  put(lantern, mesh(new THREE.ConeGeometry(0.27, 0.2, 6), dark), 0, 0.28, 0);
  // batang penggantung: menyambung ujung lengan (y≈4.55) ke atap lentera (y≈4.38) supaya lampu tidak melayang
  put(g, mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 8), dark), 0.45, 4.46, 0);
  return g;
}

function buildPole(anim) {
  const g = new THREE.Group();
  const con = std(0x9d9a92, { roughness: 0.95 });
  put(g, mesh(new THREE.CylinderGeometry(0.09, 0.14, 7.2, 8), con), 0, 3.6, 0);
  put(g, box(1.5, 0.08, 0.1, std(0x4a3a2a)), 0, 6.5, 0);
  put(g, box(1.1, 0.08, 0.1, std(0x4a3a2a)), 0, 5.9, 0);
  void anim;
  return g;
}

function wire(a, b, sag) {
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= sag;
  const pts = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(24);
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2a2724 }));
}

/* ============================================================
   createStreet
============================================================ */
/**
 * Posisi speech bubble scene 3, relatif posisi dasar (kanan-atas maskot): x = geser ke kanan (−: kiri), y = geser ke bawah (−: atas),
 * pecahan lebar / tinggi scene. Bisa diatur lewat slider di panel debug (?debug → "💬 speech bubble"). free = true → abaikan anti-tabrakan maskot.
 */
export const BUBBLE_OFFSET = { x: -0.06, y: 0.11, free: true };   // free: true = tanpa anti-tabrakan (posisi persis sesuai x / y)

export function createStreet({ renderer, canvas, ui, onDone }) {
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xf3dcae, 30, 105);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 240);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const anim = [];            // (t, dt) => void
  const steamTex = dotTexture();

  /* ---------------- Cahaya (sore hari, hangat) ---------------- */
  scene.add(new THREE.HemisphereLight(0xdcecff, 0xa98b62, 0.9));
  const sun = new THREE.DirectionalLight(0xffdfae, 2.6);
  sun.position.set(-9, 12, 11);
  sun.target.position.set(1, 0, -1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 11, bottom: -9, near: 1, far: 48 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  /* ---------------- Tanah ---------------- */
  {
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(68, CURB_Z - WALL_Z), std(0xffffff, { map: pavingTexture(), roughness: 0.9, envMapIntensity: 0.15 }));
    walk.rotation.x = -Math.PI / 2; walk.position.set(0, 0, (CURB_Z + WALL_Z) / 2); walk.receiveShadow = true;
    scene.add(walk);
    put(scene, box(68, 0.2, 0.3, std(0xb4ad9f, { roughness: 0.9 })), 0, 0.0, CURB_Z + 0.1);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(68, 40), std(0xffffff, { map: asphaltTexture(), roughness: 0.95, envMapIntensity: 0.1 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, -0.16, CURB_Z + 0.25 + 20); road.receiveShadow = true;
    scene.add(road);
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(68, 0.16), new THREE.MeshBasicMaterial({ map: dashTexture(), transparent: true }));
    dash.rotation.x = -Math.PI / 2; dash.position.set(0, -0.15, CURB_Z + 7.2);
    scene.add(dash);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(200, 80), std(0x7d745f, { roughness: 1 }));
    back.rotation.x = -Math.PI / 2; back.position.set(0, -0.02, WALL_Z - 40); back.receiveShadow = true;
    scene.add(back);
    // selokan di tepi trotoar
    put(scene, box(68, 0.03, 0.18, std(0x3a3733, { roughness: 1 }), { cast: false }), 0, 0.012, CURB_Z - 0.2);
  }

  /* ---------------- Deretan bangunan ---------------- */
  const FACADES = [
    { w: 4.2, h: 4.6, color: '#d8e4c4', trim: '#fbf5e4', shutter: '#4f7a5a', seed: 4, cols: 3, awning: ['#c0392b', '#f6efe2'] },
    { w: 4.6, h: 5.0, color: '#f2d3a8', trim: '#fbf3e0', shutter: '#5b7f9a', seed: 6, cols: 3, balcony: true },
    { w: 4.4, h: 4.7, color: '#c9dbe6', trim: '#fffaf0', shutter: '#8a4f3a', seed: 9, cols: 3, ac: true },
    { w: 5.0, h: 5.2, color: '#efe2b6', trim: '#fbf3e0', shutter: '#3f6a52', seed: 12, cols: 3, arch: true },
    { w: 4.6, h: 4.5, color: '#e6c9c0', trim: '#fff7ea', shutter: '#4a5f7a', seed: 15, cols: 3, awning: ['#2f6b4f', '#f6efe2'] },
    { w: 4.8, h: 5.0, color: '#d4e0c8', trim: '#fbf5e4', shutter: '#7a4a3a', seed: 18, cols: 3 },
  ];
  // toko bernama dari lembar gambar (lebar dinding dalam meter; tinggi mengikuti proporsi gambar)
  const STORE_W = { sate: 4.2, rawon: 4.3, wilson: 5.0, hoka: 5.0 };
  // Gambar toko lebih lebar dari dindingnya (pot tanaman, lisplang & kanopi menjorok ke samping).
  // Jarak antar bangunan = jumlah tonjolan kedua tetangga, supaya pot/lisplang tidak saling tembus;
  // celahnya ditutup dinding sekat yang sedikit menjorok ke dalam.
  const OV_HOUSE = 0.17, OV_SHOP = 0.22;                // tonjolan samping ruko biasa (lisplang) & toko antik (lis emas)
  const storeOv = (kind, w) => {
    const A = STORE_ART[kind], s = w / (A.wall[1] - A.wall[0]);
    return [(A.wall[0] - A.crop[0]) * s, (A.crop[2] - A.wall[1]) * s];
  };
  const gapFor = (ovA, ovB, bothPlain) => (bothPlain ? 0.08 : ovA + ovB + 0.04);
  const pierM = std(0xd9cdb6, { roughness: 0.95, envMapIntensity: 0.2 });
  const pier = (x0, x1, h) => {                         // dinding sekat di celah antar bangunan
    if (x1 - x0 < 0.15) return;
    put(scene, box(x1 - x0 + 0.04, h, 3, pierM), (x0 + x1) / 2, h / 2, WALL_Z - 0.14 - 1.5);
  };
  const placeStore = (kind, w, x) => {
    const st = buildStorefront(kind, w);
    st.group.position.set(x, 0, WALL_Z);
    scene.add(st.group);
    return st;
  };
  const place = (cfg, x) => {
    const b = buildHouse(cfg);
    b.position.set(x, 0, WALL_Z);
    scene.add(b);
    return b;
  };
  /** Satu deret bangunan dari `edge` ke arah `dir` (-1 kiri, +1 kanan). `first` = tetangga awal { ov, h, plain }. */
  const row = (edge, dir, items, first) => {
    let prev = first;
    const out = [];
    for (const it of items) {
      const [ovL, ovR] = it.kind ? storeOv(it.kind, it.w) : [OV_HOUSE, OV_HOUSE];
      const near = dir < 0 ? ovR : ovL, far = dir < 0 ? ovL : ovR;   // sisi yang menghadap tetangga sebelumnya / berikutnya
      const gap = gapFor(prev.ov, near, prev.plain && !it.kind);
      const x = edge + dir * (gap + it.w / 2);
      const st = it.kind ? placeStore(it.kind, it.w, x) : (place(it.cfg, x), null);
      const hh = st ? st.height : it.cfg.h;
      pier(Math.min(edge, edge + dir * gap), Math.max(edge, edge + dir * gap), Math.min(prev.h, hh) - 0.3);
      out.push({ ...it, x, st });
      edge += dir * (gap + it.w);
      prev = { ov: far, h: hh, plain: !it.kind };
    }
    return out;
  };

  // celah di belakang gerobak soto: Sate (kiri) | Baso | toko antik (kanan)
  const SATE_R = -2.38;                                  // tepi kanan dinding Sate Booth
  const basoR = SHOP.x - SHOP.w / 2;
  let basoW = 3.6;
  for (let k = 0; k < 3; k++) {                          // lebar Baso bergantung pada tonjolannya sendiri → iterasi singkat
    const [bl, br] = storeOv('baso', basoW);
    basoW = (basoR - (br + OV_SHOP + 0.04)) - (SATE_R + storeOv('sate', STORE_W.sate)[1] + bl + 0.04);
  }
  const [basoOvL, basoOvR] = storeOv('baso', basoW);
  const basoX1 = basoR - (basoOvR + OV_SHOP + 0.04), basoX0 = basoX1 - basoW;
  const baso = placeStore('baso', basoW, (basoX0 + basoX1) / 2);   // Baso Booth tepat di belakang gerobak soto
  pier(basoX1, basoR, Math.min(baso.height, SHOP.h) - 0.3);

  // deret kiri dimulai dari Sate (bersepanduk), lalu Rawon, lalu ruko biasa
  const left = [{ kind: 'sate', w: STORE_W.sate }, { kind: 'rawon', w: STORE_W.rawon }];
  for (let i = 2; i < 7; i++) left.push({ cfg: FACADES[i % FACADES.length], w: FACADES[i % FACADES.length].w });
  const sate = row(basoX0, -1, left, { ov: basoOvL, h: baso.height, plain: false })[0];   // tepi kanannya jatuh di SATE_R
  // deret kanan dari toko antik: Wilson, Hoka, lalu ruko biasa
  const right = [{ kind: 'wilson', w: STORE_W.wilson }, { kind: 'hoka', w: STORE_W.hoka }];
  for (let i = 2; i < 6; i++) right.push({ cfg: FACADES[(i + 3) % FACADES.length], w: FACADES[(i + 3) % FACADES.length].w });
  row(SHOP.x + SHOP.w / 2, 1, right, { ov: OV_SHOP, h: SHOP.h, plain: false });

  // spanduk selamat datang digantung di depan jendela lantai atas Sate Booth
  // (papan nama di atasnya, kanopi & bilik di bawahnya tetap terlihat)
  {
    const BW = Math.min(4.2, sate.w - 0.2), by = sate.st.Y(222);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(BW, 0.92), new THREE.MeshStandardMaterial({ map: welcomeTexture(), roughness: 0.95, side: THREE.DoubleSide }));
    banner.position.set(sate.x, by, WALL_Z + 0.32);
    banner.castShadow = true;
    scene.add(banner);
    const ropeM = std(0x2a2420);
    for (const sx of [-1, 1]) {
      put(scene, box(0.03, 0.03, 0.34, ropeM, { cast: false }), sate.x + sx * (BW / 2 - 0.06), by + 0.62, WALL_Z + 0.16);   // pengait di dinding
      put(scene, box(0.015, 0.2, 0.015, ropeM, { cast: false }), sate.x + sx * (BW / 2 - 0.06), by + 0.53, WALL_Z + 0.32);  // tali
    }
    anim.push((t) => { banner.rotation.x = Math.sin(t * 0.9) * 0.015; });
  }

  // dua lapis bangunan di belakang deretan ruko supaya tanah/cakrawala di kejauhan tidak terlihat
  {
    const r = rng(33);
    const palette = [
      { color: '#d9c9a6', trim: '#f6ecd2', shutter: '#6a5a45' },
      { color: '#cfd8c2', trim: '#f2f0dc', shutter: '#55705e' },
      { color: '#e3c7b3', trim: '#f8eddc', shutter: '#6b4a3c' },
      { color: '#c4d2da', trim: '#f4f1e6', shutter: '#4a5f72' },
    ];
    // lapis tengah (tinggi 7–10 m): 4 varian tekstur dipakai bersama supaya hemat memori
    const MID_H = [7, 9.5, 8, 10.5];
    const midTex = MID_H.map((h, i) => facadeTexture({ w: 7, h, floors: Math.round(h / 3.2), cols: 3, ...palette[i], seed: 40 + i, ground: 'window' }));
    for (let x = -62; x < 66; x += 6.4) {
      const v = Math.floor(r() * 4);
      const b = buildHouse({ w: 7, h: MID_H[v], d: 6, ...palette[v], seed: 40 + v, tex: midTex[v] });
      b.position.set(x + (r() - 0.5) * 0.8, 0, WALL_Z - 8.2 - r() * 1.6);
      b.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      scene.add(b);
    }
    // lapis belakang: blok tinggi yang menutup langit rendah di balik kabut
    const cols = ['#c8c0a8', '#bfb59c', '#c9bda4', '#b9b8a6'];
    for (let x = -80; x < 86; x += 8.2) {
      const hh = 11 + r() * 9;
      const m = mesh(new THREE.BoxGeometry(9, hh, 7), std(cols[Math.floor(r() * cols.length)], { roughness: 1, envMapIntensity: 0.1 }), { cast: false });
      m.position.set(x + r() * 2, hh / 2, WALL_Z - 20 - r() * 5);
      scene.add(m);
      const rf = mesh(new THREE.CylinderGeometry(0.3, 5.2, 1.8, 4), std(0x9a5a3c, { roughness: 1, envMapIntensity: 0.1 }), { cast: false });
      rf.rotation.y = Math.PI / 4;
      rf.position.set(m.position.x, hh + 0.9, m.position.z);
      scene.add(rf);
    }
  }

  /* ---------------- Toko antik ---------------- */
  const shopGroup = new THREE.Group();
  shopGroup.position.set(SHOP.x, 0, WALL_Z);
  scene.add(shopGroup);
  const doorMat = new THREE.MeshBasicMaterial({ map: interiorTexture() });
  const doorLight = new THREE.PointLight(0xffc477, 8, 9, 2);
  doorLight.position.set(0, 1.9, 1.0);
  {
    const { w: W, h: H, d: D } = SHOP;
    const wood = std(0x4a2a17, { roughness: 0.55 });
    const woodDark = std(0x2e1a0f, { roughness: 0.7 });
    const gold = std(0xc9a54a, { metalness: 0.8, roughness: 0.35, envMapIntensity: 1 });
    const tex = shopFacadeTexture(W, H);
    const front = std(0xffffff, { map: tex, roughness: 0.85, envMapIntensity: 0.2 });
    const side = std(0x2a3f32, { roughness: 0.95, envMapIntensity: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [side, side, side, side, front, side]);
    body.position.set(0, H / 2, -D / 2);
    body.castShadow = true; body.receiveShadow = true;
    shopGroup.add(body);

    // teras
    put(shopGroup, box(W + 0.3, PORCH_H, 1.8, std(0x8d8070, { roughness: 0.9 })), 0, PORCH_H / 2, 0.9);
    // pintu: bingkai, bagian dalam yang bercahaya, dua daun terbuka
    put(shopGroup, box(1.65, 0.12, 0.2, woodDark), 0, 2.55, 0.08);
    for (const sx of [-1, 1]) put(shopGroup, box(0.12, 2.5, 0.2, woodDark), sx * 0.78, 1.3, 0.08);
    const inner = put(shopGroup, new THREE.Mesh(new THREE.PlaneGeometry(1.44, 2.46), doorMat), 0, 1.28, 0.03);
    inner.renderOrder = 1;
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.7, 1.26, 0.1);
      pivot.rotation.y = sx < 0 ? -1.2 : 1.2;
      const leaf = put(pivot, box(0.7, 2.42, 0.05, wood), -sx * 0.35, 0, 0);
      put(pivot, box(0.5, 0.9, 0.02, woodDark), -sx * 0.35, 0.5, 0.03);
      put(pivot, box(0.5, 0.9, 0.02, woodDark), -sx * 0.35, -0.55, 0.03);
      void leaf;
      shopGroup.add(pivot);
    }
    // etalase kaca di kiri-kanan pintu
    for (const [sx, seed] of [[-1, 41], [1, 52]]) {
      const x = sx * 1.78;
      put(shopGroup, box(1.55, 1.8, 0.1, woodDark), x, 1.55, 0.04);
      const win = put(shopGroup, new THREE.Mesh(new THREE.PlaneGeometry(1.34, 1.58), new THREE.MeshBasicMaterial({ map: displayWindowTexture(seed) })), x, 1.55, 0.1);
      win.renderOrder = 1;
      put(shopGroup, box(1.4, 0.04, 0.05, gold), x, 1.55, 0.115);
      put(shopGroup, box(0.04, 1.6, 0.05, gold), x, 1.55, 0.115);
      put(shopGroup, box(1.7, 0.16, 0.3, woodDark), x, 0.62, 0.12);   // ambang etalase
    }
    // kanopi belang hijau-krem
    const aw = new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 0.06, 1.55), std(0xffffff, { map: stripeTexture('#2f6b4f', '#f1e6c9', 14), roughness: 0.9 }));
    aw.position.set(0, 2.82, 0.76); aw.rotation.x = 0.2; aw.castShadow = true; aw.receiveShadow = true;
    shopGroup.add(aw);
    put(shopGroup, box(W - 0.5, 0.2, 0.05, std(0xffffff, { map: stripeTexture('#2f6b4f', '#f1e6c9', 14), roughness: 0.9 })), 0, 2.62, 1.5);
    for (const sx of [-1, 1]) put(shopGroup, box(0.08, 2.6, 0.08, woodDark), sx * (W / 2 - 0.4), 1.3, 1.5);
    // papan nama
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.88), new THREE.MeshStandardMaterial({ map: shopSignTexture(), roughness: 0.6 }));
    sign.position.set(0, 3.64, 0.14);
    shopGroup.add(sign);
    put(shopGroup, box(3.62, 0.98, 0.1, woodDark), 0, 3.64, 0.08);
    // papan BUKA bergantung di pintu
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshStandardMaterial({ map: lampBoardTexture(), roughness: 0.8, side: THREE.DoubleSide }));
    board.position.set(0.52, 2.2, 0.6);
    shopGroup.add(board);
    put(shopGroup, mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.36, 4), woodDark, { cast: false }), 0.52, 2.5, 0.6);
    anim.push((t) => { board.rotation.y = Math.sin(t * 1.3) * 0.18; });
    // lentera di sisi pintu
    const lamp = put(shopGroup, new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })), -1.45, 2.45, 1.15);
    put(shopGroup, mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.4, 4), woodDark, { cast: false }), -1.45, 2.7, 1.15);
    anim.push((t) => { const f = 1 + Math.sin(t * 7) * 0.04 + Math.sin(t * 13.3) * 0.03; lamp.scale.setScalar(f); });
    // vas besar di teras
    put(shopGroup, makeVase(1.0, 0x2f5d7a), -2.5, PORCH_H, 1.15);
    put(shopGroup, makeVase(0.82, 0xa8452e), 2.5, PORCH_H, 1.2);
    put(shopGroup, makeVase(0.5, 0xe8dcc0), 2.15, PORCH_H, 1.45);
    // pediment segitiga
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2 - 0.15, 0); shape.lineTo(W / 2 + 0.15, 0); shape.lineTo(0, 1.15); shape.closePath();
    const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: false }), wood);
    ped.position.set(0, H, -0.32);
    ped.castShadow = true;
    shopGroup.add(ped);
    put(shopGroup, box(W + 0.4, 0.16, 0.55, gold), 0, H + 0.02, 0.05);
    const medal = put(shopGroup, mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 28), gold, { cast: false }), 0, H + 0.58, 0.1);
    medal.rotation.x = Math.PI / 2;
    put(shopGroup, mesh(new THREE.SphereGeometry(0.07, 10, 8), gold), 0, H + 1.22, 0.0);
    shopGroup.add(doorLight);
  }

  /* ---------------- Gerobak soto ---------------- */
  const cart = buildCart(anim, steamTex);
  cart.group.position.copy(CART);
  cart.group.rotation.y = 0.04;
  scene.add(cart.group);
  const cartLight = new THREE.PointLight(0xffc27a, 4, 5, 2);
  cartLight.position.set(CART.x + cart.bulb.x, cart.bulb.y - 0.2, CART.z + cart.bulb.z);
  scene.add(cartLight);
  anim.push((t) => { cartLight.intensity = 4 * (1 + Math.sin(t * 9) * 0.03); });

  /* ---------------- Penjual soto di balik gerobak ---------------- */
  let serverHop = () => {};
  let serverServe = (onReach) => { onReach?.(); return Promise.resolve(); };   // menyodorkan mangkuk soto (hanya versi 3D)
  let serverReset = () => {};
  if (SERVER_STYLE === '3d') {
    // model 3D toon (server3d.js), berdiri di tanah di sisi KIRI gerobak (Gasing makan di depan gerobak), menoleh ke arah Gasing
    const srv = buildSotoServer();
    srv.group.scale.setScalar(0.78);
    // ujung kerucut model ada di y ≈ -0.655 (satuan model) → ×0.78 ≈ 0.51, supaya menapak di tanah (y = 0)
    srv.group.position.set(CART.x - 2.2, 0.53, CART.z + 0.7);
    srv.group.rotation.y = 0.2;
    scene.add(srv.group);
    anim.push(srv.update);
    serverHop = srv.hop;
    serverServe = srv.serve;
    serverReset = srv.resetServe;  } else {
    // versi gambar 2D (disimpan, tidak aktif): sprite yang selalu menghadap kamera
    const SERVER_H = 1.2, SERVER_W = SERVER_H * 950 / 800;
    const serverTex = new THREE.TextureLoader().load('assets/scene3/penjual-soto.png');
    serverTex.colorSpace = THREE.SRGBColorSpace;
    const server = new THREE.Sprite(new THREE.SpriteMaterial({ map: serverTex, transparent: true, alphaTest: 0.05, color: 0xf4ebe0 }));
    server.scale.set(SERVER_W, SERVER_H, 1);
    server.renderOrder = 4;
    const SERVER_POS = new THREE.Vector3(CART.x + 0.1, 1.84, CART.z - 0.32);
    server.position.copy(SERVER_POS);
    scene.add(server);
    const serverFx = { hop: 0 };
    anim.push((t) => {
      server.position.y = SERVER_POS.y + Math.sin(t * 2.2) * 0.025 + serverFx.hop * 0.18;
      server.material.rotation = Math.sin(t * 1.4) * 0.04;
    });
    serverHop = () => gsap.fromTo(serverFx, { hop: 0 }, { hop: 1, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 1 });
  }

  /* ---------------- Pohon, lampu jalan, tiang listrik, bendera ---------------- */
  for (const [x, z, s, seed] of [[-9.4, -0.7, 1.0, 3], [10.2, -0.7, 1.05, 8], [-17.5, -0.4, 1.1, 14], [18.5, -0.6, 1.0, 21]]) {
    const tr = buildTree(seed, anim, s);
    tr.position.set(x, 0, z);
    scene.add(tr);
  }
  for (const x of [-5.6, 6.8, 16, -16]) {
    const lp = buildStreetLamp();
    lp.position.set(x, 0, CURB_Z - 0.35);
    lp.rotation.y = x < 0 ? 0 : Math.PI;
    scene.add(lp);
  }
  const poleA = buildPole(anim); poleA.position.set(-10.2, 0, CURB_Z - 0.6);
  const poleB = buildPole(anim); poleB.position.set(11.6, 0, CURB_Z - 0.6);
  scene.add(poleA, poleB);
  for (const [yy, off] of [[6.5, 0.7], [6.5, -0.7], [5.9, 0.5]]) {
    scene.add(wire(new THREE.Vector3(poleA.position.x + off, yy, poleA.position.z), new THREE.Vector3(poleB.position.x + off, yy, poleB.position.z), 0.7));
    scene.add(wire(new THREE.Vector3(poleB.position.x + off, yy, poleB.position.z), new THREE.Vector3(poleB.position.x + 14 + off, yy, poleB.position.z - 1), 0.7));
    scene.add(wire(new THREE.Vector3(poleA.position.x + off, yy, poleA.position.z), new THREE.Vector3(poleA.position.x - 14 + off, yy, poleA.position.z - 1), 0.7));
  }
  // umbul-umbul merah-putih di sepanjang jalan
  {
    const A = new THREE.Vector3(-10.2, 5.3, 2.4), B = new THREE.Vector3(11.6, 5.3, 2.4);
    const curve = new THREE.QuadraticBezierCurve3(A, A.clone().lerp(B, 0.5).setY(4.2), B);
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), new THREE.LineBasicMaterial({ color: 0x3a3430 })));
    const N = 46;
    const flags = [];
    const triGeo = new THREE.BufferGeometry();
    triGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.2, 0, 0, 0.2, 0, 0, 0, -0.42, 0], 3));
    triGeo.computeVertexNormals();
    const mats = [new THREE.MeshBasicMaterial({ color: 0xd23a32, side: THREE.DoubleSide }), new THREE.MeshBasicMaterial({ color: 0xf8f1e2, side: THREE.DoubleSide }), new THREE.MeshBasicMaterial({ color: 0xf2b134, side: THREE.DoubleSide })];
    for (let i = 0; i < N; i++) {
      const f = new THREE.Mesh(triGeo, mats[i % 3]);
      curve.getPoint((i + 0.5) / N, f.position);
      scene.add(f);
      flags.push({ f, ph: i * 0.7 });
    }
    anim.push((t) => { for (const p of flags) p.f.rotation.z = Math.sin(t * 1.6 + p.ph) * 0.18; });
  }

  /* ---------------- Awan & debu bercahaya ---------------- */
  {
    const clouds = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.SpriteMaterial({ map: cloudTexture(i + 3), transparent: true, depthWrite: false, opacity: 0.85, fog: false });
      const s = new THREE.Sprite(m);
      const sc = 34 + (i % 3) * 12;
      s.scale.set(sc, sc * 0.5, 1);
      s.position.set(-90 + i * 30, 12 + (i % 3) * 3, -78);
      scene.add(s);
      clouds.push(s);
    }
    anim.push((t, dt) => {
      for (const c of clouds) { c.position.x += dt * 0.45; if (c.position.x > 100) c.position.x = -100; }
    });
    const N = 90;
    const pos = new Float32Array(N * 3);
    const rg = rng(91);
    const base = Array.from({ length: N }, () => [-9 + rg() * 20, 0.6 + rg() * 5, -2.5 + rg() * 9, rg() * 6, 0.12 + rg() * 0.25]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: dotTexture(), color: 0xffe3a8, size: 0.07, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    dust.frustumCulled = false;
    scene.add(dust);
    anim.push((t) => {
      for (let i = 0; i < N; i++) {
        const [x, y, z, ph, sp] = base[i];
        pos[i * 3] = x + Math.sin(t * sp + ph) * 0.5 + t * 0.04 % 1;
        pos[i * 3 + 1] = y + Math.sin(t * sp * 0.8 + ph * 1.7) * 0.3;
        pos[i * 3 + 2] = z + Math.cos(t * sp * 0.9 + ph) * 0.4;
      }
      geo.attributes.position.needsUpdate = true;
    });
  }

  /* ---------------- Penanda "ketuk di sini" + cincin di tanah ---------------- */
  const ringTex = canvasTex(256, 256, (g) => {
    g.shadowColor = '#ffcf6b'; g.shadowBlur = 22;
    g.strokeStyle = '#ffd98a'; g.lineWidth = 12;
    g.beginPath(); g.ellipse(128, 128, 98, 98, 0, 0, Math.PI * 2); g.stroke();
  });
  const mkRing = (x, z, s) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); m.renderOrder = 3;
    scene.add(m);
    return m;
  };
  const cartRing = mkRing(CART.x + 0.3, CART.z + 0.35, 3.9);   // (toko antik tidak memakai cincin: bangunannya sendiri yang menyala, lihat "Sorotan bangunan toko")

  // kotak ketuk (tak terlihat) — lebih besar dari modelnya supaya mudah diketuk di HP
  const hitMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const cartHit = put(scene, new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.0, 2.2), hitMat), CART.x + 0.4, 1.5, CART.z + 0.3);
  const shopHit = put(shopGroup, new THREE.Mesh(new THREE.BoxGeometry(SHOP.w, 3.6, 2.2), hitMat), 0, 1.8, 0.9);

  /* ---------------- Sorotan bangunan toko ---------------- */
  // Pengganti cincin di tanah: seluruh bangunan toko menyala hangat (berdenyut pelan saat menunggu diketuk). Saat kursor di atasnya
  // bangunan terangkat sedikit (membal) dan bersinar lebih terang. Material toko diduplikat dulu supaya bangunan lain tidak ikut menyala.
  const HI_COLOR = new THREE.Color(0xffa94d);
  const shopHi = { hover: 0 };
  let shopWasHover = false;
  const hiMats = [];                                   // { mat, base } — base = warna asli (bahan tanpa emissive, mis. jendela/lampu)
  {
    const cloned = new Map();
    const swap = (m) => {
      if (m === doorMat || m === hitMat) return m;     // interior pintu diatur terpisah (applyFx); kotak ketuk tak terlihat
      if (!cloned.has(m)) {
        const c = m.clone();
        const emissive = 'emissive' in c && c.emissive.getHex() === 0;
        if (emissive) c.emissive.copy(HI_COLOR);
        hiMats.push({ mat: c, base: emissive ? null : c.color?.clone() ?? null });
        cloned.set(m, c);
      }
      return cloned.get(m);
    };
    shopGroup.traverse((o) => {
      if (!o.isMesh || o === shopHit) return;
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
  }
  /** g = tingkat sorotan 0…~1: bahan ber-emissive disinari warna hangat, bahan polos (jendela, lampu) dicerahkan. */
  function setShopHighlight(g = 0) {
    for (const { mat, base } of hiMats) {
      if (!base) mat.emissiveIntensity = g * 0.4;
      else mat.color.copy(base).multiplyScalar(1 + g * 0.45);
    }
    shopGroup.position.y = shopHi.hover * 0.1;
    shopGroup.scale.setScalar(1 + shopHi.hover * 0.015);
  }
  setShopHighlight(0);

  /* ---------------- Kamera ---------------- */
  function computeView(name) {
    const base = VIEWS[name];
    const portrait = camera.aspect < 0.85;
    const v = portrait && base.p ? { ...base, ...base.p } : base;
    const tanHalf = Math.tan((camera.fov / 2) * DEG);
    const pad = portrait ? 1.5 : 1.3;
    const dist = Math.max((v.h * pad) / 2 / tanHalf, (v.w * 1.08) / 2 / (tanHalf * camera.aspect));
    const target = new THREE.Vector3(...v.t);
    const pos = target.clone().addScaledVector(new THREE.Vector3(...v.dir).normalize(), dist);
    const look = target.clone().add(new THREE.Vector3(0, -v.h * (portrait ? (v.po ?? 0.2) : 0.12), 0));
    return { pos, look };
  }
  const cur = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  let currentView = 'wide';
  let camTween = null;
  function setView(name) {
    currentView = name;
    const v = computeView(name);
    cur.pos.copy(v.pos); cur.look.copy(v.look);
  }
  function flyTo(name, duration, ease = 'power2.inOut') {
    currentView = name;
    camTween?.kill();
    const v = computeView(name);
    const fp = cur.pos.clone(), fl = cur.look.clone();
    const p = { t: 0 };
    return new Promise((resolve) => {
      camTween = gsap.to(p, {
        t: 1, duration, ease,
        onUpdate: () => { cur.pos.lerpVectors(fp, v.pos, p.t); cur.look.lerpVectors(fl, v.look, p.t); },
        onComplete: () => { camTween = null; resolve(); },
      });
    });
  }

  /* ---------------- Gasing (DOM) yang berjalan di trotoar 3D ---------------- */
  // Tas tenis dijinjing sarung tangan kiri Gasing (satu elemen: createGasing3D({ bag: true }))
  let actorWrap = null, actor = null, bubbleEl = null, bubbleText = null, bubbleSvg = null;
  const bub = { w: 0, h: 0, tailX: 0, tailY: 0, y: null, side: 'r', maxW: 260, cl: 0, cr: 0, cb: 0 };   // ukuran awan (px) & posisi ujung ekor, relatif sudut kiri-atas elemen
  const A = { x: START.x, z: START.z, fade: 1, walking: false, hopAt: 0, baseH: 400, bubble: 0, text: 0 };
  const tmp = new THREE.Vector3();
  const pw = new THREE.Vector3();
  const canvasSize = { w: 1, h: 1 };

  const SVG_NS = 'http://www.w3.org/2000/svg';
  /* Gelembung pikiran: awan lengkung tak seragam (outline tebal) dibangun dari ukuran teks, jadi tidak gepeng / rusak untuk teks apa pun. */
  function setBubbleText(text) {
    bubbleText.textContent = text;
    layoutBubble(bub.side, bub.maxW);
  }
  /** side: 'r' = bubble di kanan Gasing (ekor ke kiri), 'l' = di kiri (ekor ke kanan). maxW = lebar teks maksimum (px) agar muat di sisi itu. */
  const BUBBLE_TAIL = 52;   // lebar area ekor (3 bulatan) di sisi yang menghadap Gasing
  function layoutBubble(side = 'r', maxW = 260) {
    if (!bubbleEl) return;
    bub.side = side; bub.maxW = maxW;
    bubbleText.style.width = 'max-content';
    bubbleText.style.maxWidth = Math.max(90, maxW) + 'px';   // teks panjang membungkus jadi beberapa baris, tidak keluar layar
    const tw = bubbleText.offsetWidth, th = bubbleText.offsetHeight;
    const LOBE = 10, PADX = 26, PADY = 17;
    const bw = tw + PADX * 2, bh = Math.max(th + PADY * 2, bw * 0.34);   // tinggi minimum → bentuk tidak gepeng
    const ox = LOBE + 4, oy = LOBE + 4;                                    // ruang untuk tonjolan & garis
    const cx = side === 'r' ? ox + BUBBLE_TAIL : ox;                      // sisi yang menghadap Gasing diberi ruang untuk ekor
    const W = BUBBLE_TAIL + bw + ox * 2, H = bh + oy * 2 + 46;   // +46: ruang ekor di bawah awan
    // titik di sepanjang keliling "pil" (stadium); antar titik digambar busur lingkaran → lengkungan awan yang halus, sambungan runcing rapi
    const r = bh / 2, L = Math.max(0, bw - bh), per = 2 * L + 2 * Math.PI * r;
    const at = (d) => {
      d = ((d % per) + per) % per;
      if (d < L) return { x: cx + r + d, y: oy };                                                    // sisi atas
      d -= L; if (d < Math.PI * r) { const a = -Math.PI / 2 + d / r; return { x: cx + r + L + r * Math.cos(a), y: oy + r + r * Math.sin(a) }; }   // ujung kanan
      d -= Math.PI * r; if (d < L) return { x: cx + r + L - d, y: oy + bh };                         // sisi bawah
      d -= L; const a = Math.PI / 2 + d / r; return { x: cx + r + r * Math.cos(a), y: oy + r + r * Math.sin(a) };                                // ujung kiri
    };
    const n = Math.max(8, Math.round(per / 44));
    let seed = 7 + text_len();
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ds = []; for (let i = 0; i < n; i++) ds.push(i * per / n + (rnd() - 0.5) * (per / n) * 0.14);   // jarak hampir merata (seimbang)
    let d = '';
    for (let i = 0; i < n; i++) {
      const p = at(ds[i]), q = at(i + 1 === n ? ds[0] + per : ds[i + 1]);
      const chord = Math.hypot(q.x - p.x, q.y - p.y), rr = (chord / 2) * (1.28 + rnd() * 0.3);   // tonjolan bervariasi tapi seimbang
      if (i === 0) d += `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      d += `A${rr.toFixed(1)} ${rr.toFixed(1)} 0 0 1 ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
    }
    // 3 bulatan ekor yang mengecil teratur (rasio ≈ 0,66) menjulur ke arah Gasing (samping), sedikit turun
    // ekor: dari sudut bawah awan menurun diagonal ke arah Gasing (kiri-bawah untuk bubble di kanan-atas; dicerminkan untuk sisi kiri)
    const bot = oy + bh, dir = side === 'r' ? -1 : 1, e0 = side === 'r' ? cx : cx + bw;
    const tails = [[e0 - dir * 18, bot + 16, 8.6], [e0 + dir * 2, bot + 30, 5.7], [e0 + dir * 18, bot + 41, 3.7]];
    bubbleSvg.setAttribute('width', W); bubbleSvg.setAttribute('height', H);
    bubbleSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    bubbleSvg.innerHTML = `<path class="sb-cloud" d="${d}Z"/>` + tails.map(([x, y, rad], i) => `<circle class="sb-dot sb-dot${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}"/>`).join('');
    Object.assign(bubbleText.style, { left: cx + PADX + 'px', top: oy + (bh - th) / 2 + 'px', width: tw + 'px' });
    Object.assign(bubbleEl.style, { width: W + 'px', height: H + 'px' });
    bub.cl = cx - LOBE; bub.cr = cx + bw + LOBE; bub.cb = oy + bh + LOBE;   // tepi awan (relatif elemen) untuk uji tabrakan dengan maskot
    bub.w = W; bub.h = H; bub.tailX = tails[2][0]; bub.tailY = tails[2][1] + tails[2][2];
    function text_len() { return (bubbleText.textContent || '').length; }
  }
  window.addEventListener('resize', () => layoutBubble(bub.side, bub.maxW));

  function spawnActor() {
    killActor();
    actorWrap = document.createElement('div');
    actorWrap.className = 'shop-actors';
    actor = createGasing3D({ label: 'Gasing berjalan di Surabaya sambil menjinjing tas tenis', className: 'shop-gasing', yaw: 0.4, bag: true });
    bubbleEl = document.createElement('div');
    bubbleEl.className = 'street-bubble';   // gelembung pikiran bergaya gambar tangan: awan SVG + 3 bulatan ekor
    bubbleText = document.createElement('span');
    bubbleText.className = 'street-bubble-text';
    bubbleSvg = document.createElementNS(SVG_NS, 'svg');
    bubbleEl.append(bubbleSvg, bubbleText);
    actorWrap.append(actor, bubbleEl);
    setBubbleText(EAT_TEXTS[0]);
    canvas.after(actorWrap);
    sizeActor();
  }
  function killActor() { actorWrap?.remove(); actorWrap = null; actor = null; bubbleEl = null; bubbleText = null; bubbleSvg = null; bub.y = null; }
  function sizeActor() {
    if (!actor) return;
    const h = Math.round(Math.min(canvasSize.h * 0.5, 560));
    A.baseH = h;
    actor.style.height = `${h}px`;
    actor.style.width = `${Math.round(h * 1000 / 1193)}px`;
  }
  function projectPoint(p) {
    tmp.copy(p).applyMatrix4(camera.matrixWorldInverse);
    const depthZ = -tmp.z;
    tmp.copy(p).project(camera);
    const tanHalf = Math.tan((camera.fov / 2) * DEG);
    return {
      sx: (tmp.x * 0.5 + 0.5) * canvasSize.w,
      sy: (-tmp.y * 0.5 + 0.5) * canvasSize.h,
      px: canvasSize.h / (2 * Math.max(0.3, depthZ) * tanHalf),
    };
  }
  function standAt(el, p, worldH, aspect, foot, tilt, opacity) {
    const { sx, sy, px } = projectPoint(p);
    const baseH = A.baseH;
    const s = (worldH * px) / baseH;
    const bw = baseH * aspect;
    el.style.opacity = String(opacity);
    el.style.transform =
      `translate3d(${(sx - bw / 2).toFixed(1)}px, ${(sy + foot * baseH * s - baseH).toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${s.toFixed(4)})`;
  }
  // Laporkan kecepatan Gasing (relatif kamera) supaya badannya menghadap arah gerak. Lompatan posisi (spawn/reset) diabaikan.
  const mv = { x: null, z: null, t: 0 };
  function reportMove(x, z, t) {
    if (!actor) { mv.x = null; return; }
    const dt = t - mv.t;
    if (mv.x != null && dt > 1e-4 && dt < 0.25) {
      const dx = x - mv.x, dz = z - mv.z;
      if (Math.hypot(dx, dz) < 1.5) {
        const e = camera.matrixWorld.elements;          // kolom 0 = kanan kamera, kolom 2 = menuju penonton
        const rl = Math.hypot(e[0], e[2]) || 1, bl = Math.hypot(e[8], e[10]) || 1;
        actor.move?.((dx * e[0] + dz * e[2]) / rl / dt, (dx * e[8] + dz * e[10]) / bl / dt);
      }
    }
    mv.x = x; mv.z = z; mv.t = t;
  }
  function placeActor(t) {
    if (!actor) return;
    reportMove(A.x, A.z, t);
    const tilt = A.walking ? Math.sin(t * 7.5) * 2.2 : 0;
    const y = A.z < WALL_Z + 2.2 ? DOOR.y : 0;       // di teras sedikit lebih tinggi
    standAt(actor, pw.set(A.x, y, A.z), ACTOR_H, 1000 / 1193, ACTOR_FOOT, tilt, A.fade);
    // gelembung pikiran di KANAN-ATAS Gasing (pindah ke kiri-atas bila tidak muat), jarak GAP px; ekor menunjuk ke Gasing,
    // awan tidak menyentuh maskot, dan seluruhnya dijepit di dalam layar. Dihitung ulang tiap frame → benar saat resize / Gasing bergerak.
    if (A.bubble > 0.001) {
      const r = actor.getBoundingClientRect(), wr = actorWrap.getBoundingClientRect();
      const GAP = Math.max(10, r.width * 0.16), EDGE = 8, MIN_W = 90;         // GAP = jarak ke maskot, relatif ukuran maskot (≈20 px pada ukuran normal)
      const OFF_X = wr.width * BUBBLE_OFFSET.x, OFF_Y = wr.height * BUBBLE_OFFSET.y;   // geser bubble relatif ukuran scene
      const left = r.left - wr.left, right = r.right - wr.left;
      const roomR = wr.width - right - GAP - EDGE, roomL = left - GAP - EDGE;
      const chrome = 18 + 2 * 14 + 2 * 26;                                     // ekor + margin awan + padding teks: di luar lebar teks
      const side = roomR - chrome >= 150 || roomR >= roomL ? 'r' : 'l';
      const maxW = Math.min(260, Math.max(MIN_W, (side === 'r' ? roomR : roomL) - chrome));
      if (side !== bub.side || Math.abs(maxW - bub.maxW) > 8) layoutBubble(side, maxW);
      const tx = side === 'r' ? right + GAP + OFF_X : left - GAP - OFF_X, ty = r.top - wr.top - GAP + OFF_Y;   // ujung ekor: sudut kanan-atas kotak maskot, digeser GAP ke luar
      let x = tx - bub.tailX, y = ty - bub.tailY;
      x = Math.max(EDGE, Math.min(wr.width - bub.w - EDGE, x));
      y = Math.max(EDGE, Math.min(wr.height - bub.h - 70, y));              // tidak menutupi tombol / petunjuk di bawah
      // anti-tabrakan: siluet maskot ≈ kolom kepala (sempit, di atas) + badan (lebar, di bawah), bukan seluruh kotaknya.
      // Awan & ujung ekor dinaikkan hanya bila masih menyentuh siluet (jarak aman M), supaya bisa sedekat mungkin tanpa menyentuh.
      const M = Math.max(5, r.width * 0.04), gT = r.top - wr.top, gB = r.bottom - wr.top;
      const bodyT = gT + r.height * 0.34;
      const parts = [[left + r.width * 0.34, gT, left + r.width * 0.66, bodyT], [left, bodyT, right, gB]];
      const clear = (yy) => {
        const boxes = [[x + bub.cl, yy, x + bub.cr, yy + bub.cb], [x + bub.tailX - 5, yy + bub.tailY - 10, x + bub.tailX + 5, yy + bub.tailY]];
        return !boxes.some((q) => parts.some((p) => q[0] < p[2] + M && q[2] > p[0] - M && q[1] < p[3] + M && q[3] > p[1] - M));
      };
      if (!BUBBLE_OFFSET.free) for (let g = 0; g < 160 && y > EDGE && !clear(y); g++) y -= 3;
      bub.y = y;
      const p = A.bubble, st = (a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
      bubbleEl.style.opacity = String(Math.min(1, p * 2.5));
      bubbleText.style.opacity = String(A.text);
      bubbleEl.style.transform = `translate3d(${x.toFixed(1)}px, ${bub.y.toFixed(1)}px, 0)`;
      const c = bubbleSvg.children;   // [awan, bulatan 0, 1, 2]: bulatan kecil muncul dulu, lalu awan
      c[3].style.transform = `scale(${st(0, 0.35).toFixed(3)})`;
      c[2].style.transform = `scale(${st(0.15, 0.5).toFixed(3)})`;
      c[1].style.transform = `scale(${st(0.3, 0.65).toFixed(3)})`;
      c[0].style.transform = `scale(${(0.4 + 0.6 * st(0.45, 1)).toFixed(3)})`;
    } else {
      bubbleEl.style.opacity = '0';
    }
  }

  /** Gasing berjalan menyusuri kurva yang melewati titik-titik [x, z] dengan kecepatan merata. */
  let walkTween = null;
  function walkAlong(points, duration, { delay = 0, ease = 'power1.inOut' } = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const p = { u: 0 };
    const v = new THREE.Vector3();
    return new Promise((resolve) => {
      walkTween = gsap.to(p, {
        u: 1, duration, delay, ease,
        onStart: () => { A.walking = true; actor?.setState?.('walk'); },
        onUpdate: () => { curve.getPointAt(p.u, v); A.x = v.x; A.z = v.z; },
        onComplete: () => { A.walking = false; actor?.setState?.('idle'); walkTween = null; resolve(); },
      });
    });
  }

  /* ---------------- State & alur ---------------- */
  let state = 'off';          // off | intro | cart | eating | shop | entering
  let runId = 0;
  let hoverTarget = false;
  let px = 0, py = 0, tpx = 0, tpy = 0;
  const fx = { door: 0 };
  const cartM = { o: 0 }, shopM = { o: 0 };
  const sleep = (s) => { const id = runId; return new Promise((r) => setTimeout(() => { if (id === runId) r(); }, s * 1000)); };

  function applyFx() {
    doorLight.intensity = 8 + fx.door * 38;
    doorMat.color.setScalar(1 + fx.door * 1.4);
  }

  function leave() {
    runId++;
    camTween?.kill(); camTween = null;
    walkTween?.kill(); walkTween = null;
    gsap.killTweensOf([A, fx, cartM, shopM, shopHi, cart.steam, cartRing.material]);
    killActor();
    fx.door = 0; applyFx();
    cart.steam.k = 1;
    serverReset();
    cartRing.material.opacity = 0;
    shopHi.hover = 0; shopWasHover = false; setShopHighlight(0);
    A.fade = 1; A.bubble = 0; A.text = 0; A.walking = false;
    state = 'off';
    canvas.style.cursor = 'default';
  }

  /** Scene 3: kamera turun dari atas, Gasing datang dari kiri; ketuk gerobak soto. */
  async function enter() {
    leave();
    const my = runId;
    state = 'intro';
    A.x = START.x; A.z = START.z;
    ui.hint(null); ui.counter?.(null);
    spawnActor();
    setView('intro');

    const cam = flyTo('wide', 3.8, 'power2.inOut');
    const walk = walkAlong([[START.x, START.z], [-7.0, 2.55], [STAND.x, STAND.z]], 4.0, { delay: 0.5, ease: 'power1.out' });
    await Promise.all([cam, walk]);
    if (my !== runId) return;

    actor?.hop();                      // tas ikut terayun
    await sleep(0.45);
    if (my !== runId) return;
    state = 'cart';
    gsap.to(cartM, { o: 1, duration: 0.5 });
    ui.hint('Ketuk gerobak soto');
    // satu gestur: menunjuk gerobak setelah jeda (hanya kalau gerobak belum diketuk)
    sleep(GESTURE_TIMING.lead).then(() => { if (my === runId && state === 'cart') actor?.gesture('pointCart'); });
  }

  /** Gerobak diketuk: Gasing menghampiri, kamera mendekat, makan soto sambil meloncat-loncat senang. */
  async function eat() {
    if (state !== 'cart') return;
    const my = runId;
    state = 'eating';
    ui.hint(null);
    canvas.style.cursor = 'default';
    gsap.to(cartM, { o: 0, duration: 0.3 });
    gsap.to(cart.steam, { k: 2.2, duration: 1.0 });
    const cam = flyTo('cart', 2.0, 'power2.inOut');
    await walkAlong([[A.x, A.z], [EAT_AT.x, EAT_AT.z]], 1.5, { ease: 'power1.inOut' });
    await cam;
    if (my !== runId) return;

    // penjual menyodorkan semangkuk soto; begitu tangannya sampai, Gasing mulai "makan" (animasi Gasing tidak diubah)
    const served = serverServe(() => {
      if (my !== runId) return;
      setBubbleText(EAT_TEXTS[0]);
      A.text = 0;
      gsap.fromTo(A, { bubble: 0 }, { bubble: 1, duration: 0.3, ease: 'power1.out' });
      gsap.to(A, { text: 1, duration: 0.25, delay: 0.3, ease: 'power1.out' });   // teks muncul setelah bubble selesai
      actor?.setState?.('eat');        // tas diletakkan, tangan memegang mangkuk & sendok
    });
    await served;                      // mangkuk dilepas penjual (Gasing sudah memegang mangkuknya sendiri)
    if (my !== runId) return;
    serverHop();                       // penjual ikut senang
    await sleep(0.7);                  // beri waktu: letakkan tas → angkat mangkuk → suapan pertama
    if (my !== runId) return;
    for (let i = 0; i < EAT_HOPS; i++) {   // ±0,8 dtk per loncatan; siklus suapan 2,6 dtk → scene baru berakhir setelah suapan ke-3
      actor?.hop();
      await sleep(0.8);
      if (my !== runId) return;
      if (i === (EAT_HOPS >> 1) - 1) {   // pertengahan makan: gelembung pertama → kedua
        gsap.to(A, { bubble: 0, duration: 0.2 });
        await sleep(0.3);
        if (my !== runId) return;
        setBubbleText(EAT_TEXTS[1]);
        A.text = 0;
        gsap.to(A, { bubble: 1, duration: 0.3, ease: 'power1.out' });
        gsap.to(A, { text: 1, duration: 0.25, delay: 0.3, ease: 'power1.out' });
      }
    }
    actor?.setState?.('idle');
    gsap.to(A, { bubble: 0, duration: 0.3 });
    gsap.to(cart.steam, { k: 1, duration: 1.5 });
    ui.caption(CONFIG.captions.s3_kenyang);
    await flyTo('after', 2.2, 'power2.inOut');
    if (my !== runId) return;
    state = 'shop';
    gsap.to(shopM, { o: 1, duration: 0.5 });
    ui.hint('Ketuk toko antik');
  }

  /** Toko diketuk: Gasing berjalan ke pintu, kamera mendekat, Gasing memudar ke dalam cahaya hangat → scene 4. */
  async function goShop() {
    if (state !== 'shop') return;
    const my = runId;
    state = 'entering';
    ui.hint(null);
    canvas.style.cursor = 'default';
    gsap.to(shopM, { o: 0, duration: 0.3 });
    flyTo('shop', 3.4, 'power2.inOut');
    gsap.to(fx, { door: 0.55, duration: 3.6, ease: 'power1.in', onUpdate: applyFx });
    gsap.to(A, { fade: 0, duration: 0.7, delay: 3.2, ease: 'power1.in' });
    await walkAlong([[A.x, A.z], [0.9, 2.3], [3.4, 1.7], [4.5, -0.7], [DOOR.x, DOOR.z]], 4.0, { ease: 'power1.inOut' });
    if (my !== runId) return;
    sfx('shop_bell');                  // bel pintu toko berbunyi saat Gasing tiba di ambang pintu
    ui.flash?.(0.8);
    gsap.to(fx, { door: 1, duration: 0.6, onUpdate: applyFx });
    flyTo('door', 0.9, 'power2.in');
    await sleep(0.8);
    if (my !== runId) return;
    onDone?.();
  }

  /* ---------------- Input ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  const targets = () => (state === 'cart' ? [cartHit] : state === 'shop' ? [shopHit] : []);
  const interactive = () => state === 'cart' || state === 'shop' || state === 'intro';
  function pickTarget(e) {
    const list = targets();
    if (!list.length) return false;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(list, true).length > 0;
  }
  canvas.addEventListener('pointerdown', (e) => { if (interactive()) down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointermove', (e) => {
    if (!interactive()) return;
    const r = canvas.getBoundingClientRect();
    tpx = ((e.clientX - r.left) / r.width) * 2 - 1;
    tpy = ((e.clientY - r.top) / r.height) * 2 - 1;
    if ((state === 'cart' || state === 'shop') && e.pointerType === 'mouse') {
      hoverTarget = pickTarget(e);
      canvas.style.cursor = hoverTarget ? 'pointer' : 'default';
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    const d = down; down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return;
    if (!pickTarget(e)) return;
    if (state === 'cart' || state === 'shop') sfx('btn_press');   // ketukan diterima
    if (state === 'cart') eat();
    else if (state === 'shop') goShop();
  });
  canvas.addEventListener('pointercancel', () => { down = null; });

  /* ---------------- Loop ---------------- */
  let lastT = 0;
  function update(t) {
    const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    for (const fn of anim) fn(t, dt);
    if (state === 'off') return;

    if (state === 'cart' || state === 'shop') { px += (tpx - px) * 0.05; py += (tpy - py) * 0.05; }
    camera.position.copy(cur.pos);
    if (state === 'cart' || state === 'shop') {
      camera.position.x += px * 0.35 + Math.sin(t * 0.3) * 0.04;
      camera.position.y += -py * 0.12 + Math.sin(t * 0.4) * 0.02;
    }
    camera.lookAt(cur.look);
    camera.updateMatrixWorld();

    if (A.walking && t - A.hopAt > 0.8) { actor?.hop(); A.hopAt = t; }
    placeActor(t);

    const pulse = 0.5 + Math.sin(t * 3) * 0.5;
    const hs = hoverTarget ? 0.07 : 0;
    cartRing.material.opacity = cartM.o * (0.35 + pulse * 0.4 + hs * 3);
    const rs = 1 + pulse * 0.05;
    cartRing.scale.setScalar(rs);
    // toko antik: kursor di atas bangunan → animasi angkat membal + sinar lebih terang; menunggu → denyut hangat pelan
    const overShop = state === 'shop' && hoverTarget;
    if (overShop !== shopWasHover) {
      shopWasHover = overShop;
      gsap.to(shopHi, overShop ? { hover: 1, duration: 0.45, ease: 'back.out(2.6)' } : { hover: 0, duration: 0.3, ease: 'power2.out' });
    }
    setShopHighlight(shopM.o * (0.18 + pulse * 0.22) + shopHi.hover * 0.45);
  }

  function resize(w, h) {
    canvasSize.w = w; canvasSize.h = h;
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.85 ? 50 : 35;
    camera.updateProjectionMatrix();
    if (!camTween) setView(currentView);
    sizeActor();
  }

  return { scene, camera, enter, leave, update, resize };
}
