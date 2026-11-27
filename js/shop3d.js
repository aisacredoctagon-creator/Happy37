// ============================================================
//  SCENE 4 (3D) — DI DALAM TOKO ANTIK — Three.js
//  Ruangan toko antik utuh: rak, jam besar, gramofon, lampu gantung,
//  karpet, TV CRT (cikal bakal scene 11) dan etalase kaca berisi koper.
//
//  Dipakai oleh world3d.js (renderer dipakai bersama dengan scene koper).
//  Gasing (karakter) tetap elemen DOM dari gasing3d.js, tapi posisi &
//  ukurannya diproyeksikan dari titik di lantai 3D, jadi ia benar-benar
//  "berjalan" di dalam ruangan (lebih kecil saat jauh, lebih besar saat dekat).
// ============================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { createGasing3D, bagMouthOffset, GESTURE_TIMING } from './gasing3d.js';
import { mediaExists } from './assets.js';
import { CONFIG } from './config.js';
import { sfx, startLoop, stopLoopId } from './audio.js';
import { createTVPlayer } from './tv-player.js';

const DEG = Math.PI / 180;
const ROOM = { x: 7, back: -5, front: 16, h: 4.4 };
const CASE = { x: 1.2, z: -1.2, w: 3.0, d: 1.4, base: 0.98, glass: 1.0 };
const BED_Y = CASE.base + 0.02;           // permukaan beludru
const SUITCASE_Y = BED_Y + 0.08;          // koper duduk di atas bantalan beludru
const CASE_SCALE = 1.7 / 5;               // koper di world3d.js lebarnya 5 satuan → 1,7 m di etalase

// Gasing berjalan di lantai dari P0 ke P1
const WALK_FROM = new THREE.Vector3(-5.2, 0, 5.4);
const WALK_TO = new THREE.Vector3(-0.95, 0, -0.05);
const ACTOR_H = 1.55;                    // tinggi kotak elemen gasing (satuan dunia)
const ACTOR_FOOT = 0.1;                   // kaki gasing ± 10% dari dasar kotak

// ---- Scene 11–12: TV CRT di lantai toko, Gasing datang membawa tas tenis, bola menggelinding ke TV ----
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const TV_POS = new THREE.Vector3(4.3, 0, 0.9);
const TV_ROT = -0.6;                                             // menghadap ke kiri-depan (ke arah kamera & etalase)
const TV_FACE = new THREE.Vector3(Math.sin(TV_ROT), 0, Math.cos(TV_ROT));
const TV_SCREEN = { x: -0.12, y: 1.18, z: 0.41, w: 0.66, h: 0.5 };   // koordinat lokal TV
const TV_SCREEN_W = TV_POS.clone().add(new THREE.Vector3(TV_SCREEN.x, TV_SCREEN.y, TV_SCREEN.z).applyAxisAngle(Y_AXIS, TV_ROT));
// Scene 11: bola jatuh saat Gasing masih berjalan menuju TV, ketika progres jalan (0..1) mencapai nilai ini
const BALL_DROP_AT = 0.55;
const MARVEL_SPEED = 1.6;                         // scene 12: kecepatan gestur 'marvel' (1 = tempo normal; > 1 = lebih cepat, tetap terbaca jelas)
const BALL_ROLL_T = 4.4;
const BOUNCE_HITS = [1 / 2.75, 2 / 2.75, 2.5 / 2.75, 0.999];   // progres ease bounce.out saat bola menyentuh lantai
const BOUNCE_VOL = [1, 0.6, 0.35, 0.18];                        // volume SFX pantulan berurutan (relatif manifest)                          // detik bola menggelinding dari tas ke depan TV
const TV_PATH = { from: new THREE.Vector3(-5.0, 0, 3.3), to: new THREE.Vector3(-0.35, 0, 2.3) };   // jalur Gasing
const ACTOR_ASPECT = 1000 / 1193;                                // lebar/tinggi kotak elemen Gasing
const BALL_R = 0.11;
const BALL_END = TV_POS.clone().addScaledVector(TV_FACE, 1.3).add(new THREE.Vector3(0.05, 0, 0.05));
const BALL_PX = 40;                                              // diameter dasar elemen bola (px)

// Efek vintage di atas video (hanya saat video diputar). Nilai awal lalu diturunkan ±70%: video tetap jelas ditonton.
const TV_FILL = 0.88;   // fraksi jarak kamera "pas" untuk video 16:9 (<1 = zoom lebih dekat; 0,88 → ±6% tepi kiri/kanan video keluar layar, bingkai TV tidak terlihat)
const TV_FX = { grain: 0.05, grainEvery: 4, overlay: 0.28 };   // overlay = opacity garis scan/vinyet 3D bawaan layar (aslinya 1)

const VIEWS = {
  //        target                         arah kamera        lebar/tinggi yang harus muat (landscape / portrait)
  wide: { t: [0.5, 1.5, -1.5], dir: [-0.3, 0.09, 1], w: 11, h: 4.6, pw: 6.2 },
  idle: { t: [CASE.x - 0.2, 1.6, CASE.z], dir: [-0.1, 0.16, 1], w: 6.4, h: 4.1, pw: 5.0 },
  // scene 11: Gasing (kiri) dan TV (kanan) sama-sama terlihat
  tvWide: { t: [1.8, 1.0, 1.6], dir: [0.05, 0.1, 1], w: 9.2, h: 3.8, pw: 6.5, po: 0 },   // po = offset vertikal khusus portrait
  // scene 12: TV menyala, kamera mendekat; tvClose = layar hampir memenuhi bingkai
  tvMid: { t: TV_SCREEN_W.toArray(), dir: [TV_FACE.x, 0.1, TV_FACE.z], w: 2.9, h: 2.2, pw: 2.0 },
  // tvClose: kamera lurus ke layar; area video 16:9 (bukan bingkai) memenuhi seluruh viewport (lihat computeView, flag fill)
  tvClose: { t: TV_SCREEN_W.toArray(), dir: [TV_FACE.x, 0, TV_FACE.z], w: TV_SCREEN.w, h: TV_SCREEN.w * 9 / 16, pw: TV_SCREEN.w, fill: true },
};

/* ============================================================
   Util
============================================================ */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, envMapIntensity: 0.35, ...o });
const matCache = new Map();
const cmat = (hex, o = {}) => {
  const key = `${hex}:${o.roughness ?? 0.7}:${o.metalness ?? 0}`;
  if (!matCache.has(key)) matCache.set(key, std(hex, o));
  return matCache.get(key);
};

const M = {
  walnut: std(0x4a2a17, { roughness: 0.55 }),
  walnutDark: std(0x2e1a0f, { roughness: 0.7 }),
  mahogany: std(0x6a3520, { roughness: 0.5 }),
  oak: std(0x8a5a33, { roughness: 0.6 }),
  brass: std(0xc9a54a, { metalness: 0.85, roughness: 0.34, envMapIntensity: 1 }),
  gilt: std(0xb08a3a, { metalness: 0.6, roughness: 0.4, envMapIntensity: 0.8 }),
  velvet: std(0x8a1325, { roughness: 1 }),
  leather: std(0x7a4a2a, { roughness: 0.72 }),
  leatherLid: std(0x6b3f23, { roughness: 0.72 }),
  leatherDark: std(0x4a2a17, { roughness: 0.8 }),
  darkGlass: std(0x0c1210, { roughness: 0.12, metalness: 0.2, envMapIntensity: 1 }),
  dark: std(0x1a1512, { roughness: 0.9 }),
  marble: std(0xe9e4d8, { roughness: 0.35 }),
  steel: std(0x8a8f96, { metalness: 0.8, roughness: 0.3, envMapIntensity: 0.8 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xd6ebe6, transparent: true, opacity: 0.12, roughness: 0.04, metalness: 0,
    envMapIntensity: 1.4, depthWrite: false,
  }),
};

const box = (w, h, d, mat, { cast = true, recv = true } = {}) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = cast; m.receiveShadow = recv;
  return m;
};
const rbox = (w, h, d, mat, r = 0.02) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w * 0.45, h * 0.45, d * 0.45)), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
};
const put = (parent, obj, x = 0, y = 0, z = 0) => { obj.position.set(x, y, z); parent.add(obj); return obj; };
const mesh = (geo, mat, { cast = true, recv = true } = {}) => {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = recv;
  return m;
};

function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

/* ============================================================
   Tekstur kanvas
============================================================ */
function floorTexture(repeat) {
  const r = rng(7);
  return canvasTex(1024, 1024, (g, w, h) => {
    const cols = 8, pw = w / cols;
    for (let i = 0; i < cols; i++) {
      let y = -r() * 300;
      while (y < h) {
        const len = 280 + r() * 480;
        const hue = 22 + r() * 8, sat = 36 + r() * 12, lit = 22 + r() * 10;
        g.fillStyle = `hsl(${hue}, ${sat}%, ${lit}%)`;
        g.fillRect(i * pw, y, pw, len);
        g.strokeStyle = `hsla(${hue}, ${sat}%, ${lit - 9}%, .5)`;
        g.lineWidth = 1.2;
        for (let k = 0; k < 9; k++) {
          const x0 = i * pw + 6 + r() * (pw - 12);
          g.beginPath();
          g.moveTo(x0, y);
          g.bezierCurveTo(x0 + (r() - 0.5) * 14, y + len * 0.3, x0 + (r() - 0.5) * 14, y + len * 0.6, x0 + (r() - 0.5) * 10, y + len);
          g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,.55)';
        g.fillRect(i * pw, y, pw, 2);
        y += len;
      }
      g.fillStyle = 'rgba(0,0,0,.5)';
      g.fillRect(i * pw, 0, 2, h);
    }
  }, { repeat });
}

function wallTexture(repeat) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3d4f45'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(255,255,255,.045)'; g.fillRect(x, 0, 28, h); }
    const motif = (cx, cy) => {
      g.fillStyle = 'rgba(214,190,120,.2)';
      g.beginPath(); g.moveTo(cx, cy - 26); g.lineTo(cx + 15, cy); g.lineTo(cx, cy + 26); g.lineTo(cx - 15, cy); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(cx, cy, 5, 9, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(30,40,34,.5)'; g.fill();
      g.fillStyle = 'rgba(214,190,120,.2)';
      for (const [dx, dy] of [[-24, 0], [24, 0], [0, -34], [0, 34]]) { g.beginPath(); g.arc(cx + dx, cy + dy, 4, 0, Math.PI * 2); g.fill(); }
    };
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const cx = col * 128 + (row % 2 ? 0 : 64), cy = row * 128 + 64;
        for (const dx of [-256, 0, 256]) motif(cx + dx, cy);
      }
    }
  }, { repeat });
}

function rugTexture() {
  return canvasTex(1024, 704, (g, w, h) => {
    const rr = rng(31);
    g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, h);
    const inset = (m) => [m, m, w - 2 * m, h - 2 * m];
    g.fillStyle = '#14284b'; g.fillRect(...inset(26));
    g.fillStyle = '#7c1d22'; g.fillRect(...inset(84));
    g.strokeStyle = '#e8dcc0'; g.lineWidth = 5; g.strokeRect(...inset(70));
    g.fillStyle = '#d6b25e';
    const dia = (cx, cy, s) => { g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s, cy); g.lineTo(cx, cy + s); g.lineTo(cx - s, cy); g.closePath(); g.fill(); };
    for (let x = 80; x < w - 60; x += 52) { dia(x, 48, 12); dia(x, h - 48, 12); }
    for (let y = 100; y < h - 80; y += 52) { dia(48, y, 12); dia(w - 48, y, 12); }
    const cx = w / 2, cy = h / 2;
    const cols = ['#14284b', '#e8dcc0', '#d6b25e', '#7c1d22', '#14284b'];
    [250, 205, 160, 115, 70].forEach((s, i) => {
      g.fillStyle = cols[i];
      g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 1.5, cy); g.lineTo(cx, cy + s); g.lineTo(cx - s * 1.5, cy); g.closePath(); g.fill();
    });
    g.fillStyle = '#d6b25e';
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = sx > 0 ? 130 : w - 130, y = sy > 0 ? 150 : h - 150;
      dia(x, y, 44); g.fillStyle = '#14284b'; dia(x, y, 26); g.fillStyle = '#d6b25e';
    }
    // kain aus
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '255,235,200'},${0.03 + rr() * 0.05})`;
      g.fillRect(rr() * w, rr() * h, 2 + rr() * 6, 1.2);
    }
  });
}

function paintingTexture(seed) {
  const r = rng(seed);
  return canvasTex(320, 240, (g, w, h) => {
    const pal = pick(r, [['#e9c98f', '#c98a52'], ['#9fb7c4', '#e7d9b8'], ['#c9a0a0', '#f0d8b0'], ['#8fa89a', '#e6dcb8']]);
    const sky = g.createLinearGradient(0, 0, 0, h * 0.65);
    sky.addColorStop(0, pal[0]); sky.addColorStop(1, pal[1]);
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,248,220,.85)';
    g.beginPath(); g.arc(w * (0.2 + r() * 0.6), h * (0.22 + r() * 0.12), 20 + r() * 12, 0, Math.PI * 2); g.fill();
    for (let L = 0; L < 3; L++) {
      g.fillStyle = `hsl(${200 + L * 12}, ${14 + L * 6}%, ${58 - L * 15}%)`;
      g.beginPath(); g.moveTo(0, h);
      const y0 = h * (0.5 + L * 0.13);
      for (let x = 0; x <= w; x += 20) g.lineTo(x, y0 - r() * h * 0.2);
      g.lineTo(w, h); g.closePath(); g.fill();
    }
    const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,15,5,.55)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
}

function clockFaceTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f1e8d2'; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2a1c12'; g.lineWidth = 5; g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#2a1c12'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    R.forEach((t, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      g.fillText(t, 128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92);
    });
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      g.lineWidth = i % 5 ? 1.5 : 3;
      g.beginPath(); g.moveTo(128 + Math.cos(a) * 113, 128 + Math.sin(a) * 113); g.lineTo(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118); g.stroke();
    }
  });
}

function signTexture() {
  return canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#1f3a2c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d4b062'; g.lineWidth = 8; g.strokeRect(16, 16, w - 32, h - 32);
    g.lineWidth = 2; g.strokeRect(30, 30, w - 60, h - 60);
    g.fillStyle = '#e6c474'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 120px Georgia, serif'; g.fillText('TOKO ANTIK', w / 2, h / 2 - 12);
    g.font = 'italic 34px Georgia, serif'; g.fillText('~ sejak 1926 ~', w / 2, h - 52);
  });
}

export function tagTexture() {
  return canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#efe2c2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6a2b'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#3b2a1a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 40px Georgia, serif'; g.fillText('KOPER', w / 2, 58);
    g.font = 'bold 40px Georgia, serif'; g.fillText('ANTIK', w / 2, 100);
    g.font = 'italic 20px Georgia, serif'; g.fillText('No. 4', w / 2, 134);
  });
}

function markerTexture() {
  return canvasTex(256, 256, (g) => {
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 14;
    g.fillStyle = 'rgba(27,19,14,.8)'; g.beginPath(); g.arc(128, 128, 96, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 9; g.strokeStyle = '#f2b134'; g.beginPath(); g.arc(128, 128, 96, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#f2b134';
    g.beginPath(); g.moveTo(84, 104); g.lineTo(172, 104); g.lineTo(128, 170); g.closePath(); g.fill();
  });
}

function glowRectTexture() {
  return canvasTex(512, 384, (g, w, h) => {
    g.shadowColor = '#ffcf6b'; g.shadowBlur = 30;
    g.strokeStyle = '#ffd98a'; g.lineWidth = 12;
    g.beginPath(); g.roundRect(46, 46, w - 92, h - 92, 40); g.stroke();
  });
}

function dotTexture() {
  return canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
}

/* ============================================================
   Barang antik kecil (isi rak)
   Setiap pembuat mengembalikan { obj, w } — tepi kiri di x = 0, dasar di y = 0.
============================================================ */
const BOOK_COLORS = [0x7a2e2e, 0x2f4a3a, 0x3b3a63, 0x8a6a2b, 0x5a3b24, 0x9a4a2a, 0x242424, 0x6b5b3b, 0x4d2a4a];
const CERAMICS = [0xe8dcc0, 0x2f5d7a, 0xa8452e, 0x3d6b4f, 0xc9a54a, 0xe7e0d0, 0x6a4b8a, 0x1f3b5c];

function makeBooks(r) {
  const g = new THREE.Group();
  const n = 4 + Math.floor(r() * 6);
  let x = 0;
  for (let i = 0; i < n; i++) {
    const t = 0.045 + r() * 0.05, hh = 0.24 + r() * 0.16, d = 0.2 + r() * 0.08;
    const b = box(t, hh, d, cmat(pick(r, BOOK_COLORS), { roughness: 0.85 }));
    put(g, b, x + t / 2, hh / 2, 0);
    put(g, box(t + 0.002, 0.012, d + 0.002, M.gilt), x + t / 2, hh * 0.8, 0);
    x += t + 0.003;
    if (i === n - 1 && r() < 0.5) { b.rotation.z = -0.22; b.position.x += hh * 0.09; }
  }
  return { obj: g, w: x + 0.05 };
}

function makeVase(r) {
  const H = 0.22 + r() * 0.3, R = 0.07 + r() * 0.06;
  const prof = [
    [0, 0], [R * 0.6, 0], [R * (0.9 + r() * 0.5), H * 0.3], [R * (0.8 + r() * 0.6), H * 0.55],
    [R * (0.4 + r() * 0.3), H * 0.85], [R * (0.45 + r() * 0.3), H * 0.95], [R * 0.62, H],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const vase = mesh(new THREE.LatheGeometry(prof, 22), std(pick(r, CERAMICS), { roughness: 0.3, metalness: 0.05, side: THREE.DoubleSide, envMapIntensity: 0.6 }));
  const g = new THREE.Group();
  put(g, vase, R * 1.5, 0, 0);
  return { obj: g, w: R * 3 };
}

function makeJar(r) {
  const R = 0.07 + r() * 0.03, H = 0.14 + r() * 0.1;
  const g = new THREE.Group();
  const mat = cmat(pick(r, CERAMICS), { roughness: 0.4 });
  put(g, mesh(new THREE.CylinderGeometry(R, R * 0.9, H, 18), mat), R, H / 2, 0);
  put(g, mesh(new THREE.SphereGeometry(R * 0.85, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat), R, H, 0);
  put(g, mesh(new THREE.SphereGeometry(0.02, 10, 8), M.brass), R, H + R * 0.85, 0);
  return { obj: g, w: R * 2 };
}

function makeTeapot(r) {
  const R = 0.09 + r() * 0.03, x0 = R * 1.7;
  const g = new THREE.Group();
  const mat = cmat(pick(r, CERAMICS), { roughness: 0.3, metalness: 0.05 });
  const body = put(g, mesh(new THREE.SphereGeometry(R, 20, 14), mat), x0, R * 0.85, 0);
  body.scale.y = 0.85;
  put(g, mesh(new THREE.SphereGeometry(R * 0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat), x0, R * 1.62, 0);
  put(g, mesh(new THREE.SphereGeometry(0.02, 10, 8), M.brass), x0, R * 1.62 + R * 0.45, 0);
  const spout = put(g, mesh(new THREE.CylinderGeometry(0.014, 0.028, 0.1, 10), mat), x0 + R * 1.05, R * 0.95, 0);
  spout.rotation.z = -0.9;
  const handle = put(g, mesh(new THREE.TorusGeometry(R * 0.5, 0.013, 8, 16, Math.PI), mat), x0 - R * 0.95, R * 0.85, 0);
  handle.rotation.z = Math.PI / 2;
  return { obj: g, w: x0 + R + 0.1 };
}

function makeBust() {
  const g = new THREE.Group();
  put(g, box(0.15, 0.04, 0.13, M.dark), 0.1, 0.02, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.1, 14), M.marble), 0.1, 0.09, 0);
  const sh = put(g, mesh(new THREE.SphereGeometry(0.075, 16, 10), M.marble), 0.1, 0.17, 0);
  sh.scale.set(1.3, 0.55, 0.8);
  const head = put(g, mesh(new THREE.SphereGeometry(0.06, 18, 14), M.marble), 0.1, 0.25, 0);
  head.scale.y = 1.2;
  put(g, mesh(new THREE.ConeGeometry(0.012, 0.03, 8), M.marble), 0.1, 0.25, 0.058).rotation.x = Math.PI / 2;
  return { obj: g, w: 0.2 };
}

function makeCarriageClock(faceTex) {
  const g = new THREE.Group();
  put(g, rbox(0.15, 0.2, 0.1, M.brass, 0.02), 0.085, 0.1, 0);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.052, 24), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.5 }));
  put(g, face, 0.085, 0.115, 0.052);
  put(g, mesh(new THREE.TorusGeometry(0.062, 0.008, 8, 18), M.brass), 0.085, 0.2, 0).rotation.x = 0;
  return { obj: g, w: 0.18 };
}

function fillRow(parent, y, x0, x1, r, faceTex) {
  let x = x0 + 0.08;
  let guard = 0;
  while (x < x1 - 0.2 && guard++ < 40) {
    const k = r();
    const it = k < 0.38 ? makeBooks(r) : k < 0.6 ? makeVase(r) : k < 0.72 ? makeJar(r)
      : k < 0.83 ? makeTeapot(r) : k < 0.92 ? makeBust() : makeCarriageClock(faceTex);
    if (x + it.w > x1 - 0.04) { x += 0.08; continue; }
    put(parent, it.obj, x, y, (r() - 0.5) * 0.06);
    x += it.w + 0.05 + r() * 0.14;
  }
}

/* ============================================================
   Perabot
============================================================ */
function buildCRT() {
  const g = new THREE.Group();
  const wood = std(0x8a6440, { roughness: 0.55 });
  put(g, rbox(0.92, 0.7, 0.5, wood, 0.04), 0, 0.37, 0);
  put(g, rbox(0.6, 0.5, 0.3, M.dark, 0.05), 0, 0.37, -0.36);       // tabung belakang
  put(g, rbox(0.56, 0.44, 0.06, std(0x2a1c12), 0.03), -0.12, 0.38, 0.25); // bingkai layar
  put(g, rbox(0.5, 0.38, 0.05, M.darkGlass, 0.06), -0.12, 0.38, 0.275);    // layar (mati)
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, depthWrite: false }));
  put(g, refl, -0.2, 0.46, 0.302);
  for (const dy of [0.5, 0.34]) {                                         // knob
    const k = put(g, mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.04, 16), M.brass), 0.34, dy, 0.265);
    k.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 6; i++) put(g, box(0.16, 0.012, 0.01, M.dark), 0.34, 0.2 - i * 0.03, 0.255);   // kisi speaker
  for (const sx of [-0.36, 0.36]) put(g, mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.06, 8), M.walnutDark), sx, 0.0, 0.14);
  return g;
}

/* ---------- TV CRT besar di atas kabinet (scene 11–12) ---------- */
/** Bidang layar yang melengkung (cembung) seperti tabung CRT; tepinya rata dengan bingkai. */
function curvedScreen(w, h, bulge) {
  const geo = new THREE.PlaneGeometry(w, h, 20, 16);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i) / (w / 2), ny = p.getY(i) / (h / 2);
    p.setZ(i, bulge * Math.cos(nx * Math.PI / 2) * Math.cos(ny * Math.PI / 2));
  }
  geo.computeVertexNormals();
  return geo;
}

/** Garis scan + vinyet gelap di tepi layar (menimpa isi layar). */
function crtOverlayTexture() {
  return canvasTex(512, 384, (g, w, h) => {
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.82);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2);
  });
}

/** Isi layar bawaan kalau file video belum ada. */
function tvPlaceholderTexture(name, path) {
  return canvasTex(640, 480, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#e4572e'); gr.addColorStop(1, '#f2b134');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.fillStyle = '#fff8ec';
    g.font = '600 26px ui-monospace, Consolas, monospace';
    g.fillText('▶ PLACEHOLDER VIDEO', w / 2, 120);
    g.font = '700 54px Fredoka, "Segoe UI", sans-serif';
    g.fillText('Selamat Ulang Tahun,', w / 2, 225);
    g.font = '700 92px Fredoka, "Segoe UI", sans-serif';
    g.fillText(`${name}! 🎉`, w / 2, 335);
    g.font = '20px ui-monospace, Consolas, monospace';
    g.globalAlpha = 0.8;
    g.fillText(path, w / 2, 410);
  });
}

function buildTV() {
  const g = new THREE.Group();
  const Y0 = 0.75;                                   // permukaan kabinet
  const wood = std(0x8a6440, { roughness: 0.5 });
  const bezelMat = std(0x241810, { roughness: 0.6 });

  // kabinet rendah: kaki, badan, pintu + kenop kuningan, papan atas
  put(g, rbox(1.5, 0.5, 0.62, M.mahogany, 0.02), 0, 0.45, 0);
  put(g, rbox(1.6, 0.05, 0.72, M.walnut, 0.015), 0, 0.725, 0);
  for (const sx of [-1, 1]) {
    put(g, box(0.64, 0.38, 0.02, M.oak), sx * 0.35, 0.45, 0.315);
    put(g, mesh(new THREE.SphereGeometry(0.024, 10, 8), M.brass), sx * 0.09, 0.45, 0.338);
    for (const sz of [-1, 1]) {
      put(g, mesh(new THREE.CylinderGeometry(0.036, 0.022, 0.22, 10), M.walnutDark), sx * 0.66, 0.11, sz * 0.24);
    }
  }

  // badan TV: rumah kayu + tabung di belakang + empat kaki kecil
  put(g, rbox(1.0, 0.8, 0.7, wood, 0.07), 0, Y0 + 0.43, 0);
  put(g, rbox(0.7, 0.62, 0.5, M.dark, 0.09), -0.06, Y0 + 0.44, -0.55);
  for (const sx of [-0.4, 0.4]) for (const sz of [-0.24, 0.24]) {
    put(g, mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.04, 8), M.walnutDark), sx, Y0 + 0.02, sz);
  }
  // bingkai layar
  put(g, rbox(0.82, 0.64, 0.07, bezelMat, 0.05), TV_SCREEN.x, TV_SCREEN.y, 0.38);

  // panel kontrol di kanan: pelat, 2 kenop, speaker, LED
  put(g, box(0.2, 0.62, 0.012, M.walnutDark), 0.34, TV_SCREEN.y, 0.352);
  const knobs = [];
  for (const dy of [0.2, 0.06]) {
    const k = put(g, mesh(new THREE.CylinderGeometry(0.047, 0.054, 0.045, 18), M.brass), 0.34, TV_SCREEN.y + dy, 0.372);
    k.rotation.x = Math.PI / 2;
    const tick = put(k, box(0.008, 0.006, 0.05, M.dark), 0, 0.024, 0.02);   // garis penunjuk
    void tick;
    knobs.push(k);
  }
  for (let i = 0; i < 7; i++) put(g, box(0.14, 0.012, 0.01, M.dark), 0.34, TV_SCREEN.y - 0.1 - i * 0.032, 0.36);
  const led = put(g, new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3a1410 })), 0.34, TV_SCREEN.y - 0.08, 0.364);

  // antena kuping kelinci
  const ant = put(g, mesh(new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.dark), -0.1, Y0 + 0.83, -0.05);
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.rotation.z = -sx * 0.62;
    ant.add(pivot);
    put(pivot, mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.78, 6), M.steel, { cast: false }), 0, 0.39, 0);
    put(pivot, mesh(new THREE.SphereGeometry(0.014, 8, 6), M.steel, { cast: false }), 0, 0.78, 0);
  }

  // layar: kaca mati (selalu ada) + layar menyala (grup, bisa "dibuka" seperti TV tabung)
  const sw = TV_SCREEN.w, sh = TV_SCREEN.h;
  const geo = curvedScreen(sw, sh, 0.035);
  const offGlass = new THREE.Mesh(geo, std(0x0a100e, { roughness: 0.08, metalness: 0.2, envMapIntensity: 1.3 }));
  put(g, offGlass, TV_SCREEN.x, TV_SCREEN.y, TV_SCREEN.z - 0.005);

  const noiseData = new Uint8Array(128 * 96 * 4);
  const noiseTex = new THREE.DataTexture(noiseData, 128, 96, THREE.RGBAFormat);
  noiseTex.colorSpace = THREE.SRGBColorSpace;
  noiseTex.magFilter = noiseTex.minFilter = THREE.NearestFilter;
  noiseTex.generateMipmaps = false;
  noiseTex.needsUpdate = true;

  const onMat = new THREE.MeshBasicMaterial({ map: noiseTex, toneMapped: false });
  const screenGroup = new THREE.Group();
  screenGroup.position.set(TV_SCREEN.x, TV_SCREEN.y, TV_SCREEN.z);
  screenGroup.visible = false;
  g.add(screenGroup);
  const onMesh = new THREE.Mesh(geo, onMat);
  onMesh.name = 'tvScreen';
  screenGroup.add(onMesh);
  const overlayMat = new THREE.MeshBasicMaterial({ map: crtOverlayTexture(), transparent: true, depthWrite: false, toneMapped: false });
  // letterbox: bagian layar di luar [0,1] pada UV tekstur video dihitamkan (video 'contain', tidak gepeng / terpotong)
  // Area kosong (bar letterbox) diisi video yang SAMA (tekstur yang sama → sinkron, tanpa video kedua): dibesarkan 'cover', di-blur (16 tap) & digelapkan.
  // Dihitung di shader layar, jadi otomatis mengikuti bentuk lengkung layar dan tidak bocor ke bingkai. uBgOn = 0 → hitam (statis / placeholder).
  onMat.userData.u = {
    uBgOn: { value: 0 }, uTexRep: { value: new THREE.Vector2(1, 1) }, uTexOff: { value: new THREE.Vector2(0, 0) },
    uCover: { value: new THREE.Vector2(1, 1) },      // skala UV 'cover' pada tekstur video
    uBlur: { value: 0.03 }, uDark: { value: 0.6 },   // radius blur (UV tekstur; ≈ ±20 px di layar) & kegelapan
  };
  onMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, onMat.userData.u);
    sh.fragmentShader = 'uniform float uBgOn, uBlur, uDark; uniform vec2 uTexRep, uTexOff, uCover;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_MAP
        if (vMapUv.x < 0.0 || vMapUv.x > 1.0 || vMapUv.y < 0.0 || vMapUv.y > 1.0) {
          if (uBgOn > 0.5) {
            vec2 pUv = (vMapUv - uTexOff) / uTexRep;                 // UV bidang layar (0..1)
            vec2 cUv = vec2(0.5) + (pUv - vec2(0.5)) * uCover;        // 'cover'
            vec3 acc = vec3(0.0);
            for (int i = 0; i < 16; i++) {
              float fi = float(i), rr = sqrt((fi + 0.5) / 16.0) * uBlur, an = fi * 2.39996;
              acc += texture2D(map, clamp(cUv + vec2(cos(an) * 0.5625, sin(an)) * rr, 0.0, 1.0)).rgb;
            }
            vec3 bg = acc / 16.0 * uDark;
            #ifdef DECODE_VIDEO_TEXTURE
              bg = mix(pow(bg * 0.9478672986 + vec3(0.0521327014), vec3(2.4)), bg * 0.0773993808, vec3(lessThanEqual(bg, vec3(0.04045))));
            #endif
            diffuseColor.rgb = bg;
          } else diffuseColor.rgb = vec3(0.0);
        }
      #endif`);
  };
  // grain halus: tekstur derau 256² (dibuat sekali), hanya digeser offset-nya → tanpa unggahan per frame
  const grainData = new Uint8Array(256 * 256 * 4);
  for (let i = 0; i < grainData.length; i += 4) { const v = 70 + ((Math.random() * 120) | 0); grainData[i] = grainData[i + 1] = grainData[i + 2] = v; grainData[i + 3] = 255; }
  const grainTex = new THREE.DataTexture(grainData, 256, 256, THREE.RGBAFormat);
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping; grainTex.repeat.set(2.6, 2); grainTex.needsUpdate = true;
  const grainMat = new THREE.MeshBasicMaterial({ map: grainTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const overlay = new THREE.Mesh(geo, overlayMat);
  overlay.position.z = 0.002;
  screenGroup.add(overlay);
  const grainMesh = new THREE.Mesh(geo, grainMat);
  grainMesh.position.z = 0.003;
  screenGroup.add(grainMesh);

  // kilau kaca (selalu ada)
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false }));
  put(g, sheen, TV_SCREEN.x - 0.08, TV_SCREEN.y + 0.15, TV_SCREEN.z + 0.036);

  // cahaya biru-putih dari layar (intensitas 0 = mati; dibuat dari awal supaya jumlah lampu tetap → tanpa kompilasi ulang shader)
  const glow = new THREE.PointLight(0xaed6ff, 0, 5, 2);
  glow.position.set(TV_SCREEN.x, TV_SCREEN.y - 0.05, 0.95);
  g.add(glow);

  g.traverse((o) => { if (o.isMesh) o.userData.tv = true; });
  return { group: g, screenGroup, onMat, overlayMat, grainMat, grainTex, onMesh, offGlass, noiseData, noiseTex, led, glow, knobs };
}

function buildBookcase({ W, H, levels, seed, faceTex, crtLevel = -1 }) {
  const r = rng(seed);
  const g = new THREE.Group();
  const D = 0.6;
  put(g, box(0.06, H, D, M.mahogany), -W / 2 + 0.03, H / 2, 0);
  put(g, box(0.06, H, D, M.mahogany), W / 2 - 0.03, H / 2, 0);
  put(g, box(W, H, 0.03, M.walnutDark), 0, H / 2, -D / 2 + 0.015);
  put(g, box(W + 0.1, 0.1, D + 0.08, M.mahogany), 0, H + 0.05, 0.02);
  put(g, box(W + 0.04, 0.16, D + 0.02, M.mahogany), 0, 0.08, 0.005);
  const step = (H - 0.16) / levels;
  for (let i = 0; i < levels; i++) {
    const y = 0.16 + i * step;
    put(g, box(W - 0.12, 0.04, D, M.mahogany), 0, y + 0.02, 0);
    const row = new THREE.Group();
    put(g, row, 0, y + 0.04, 0);
    let x0 = -W / 2 + 0.06;
    if (i === crtLevel) {
      put(row, buildCRT(), x0 + 0.58, 0, 0.02);
      x0 += 1.2;
    }
    fillRow(row, 0, x0, W / 2 - 0.06, r, faceTex);
  }
  g.traverse((o) => { if (o.isMesh) o.userData.static = true; });
  return g;
}

function buildGrandfather(anim, faceTex) {
  const g = new THREE.Group();
  put(g, box(0.64, 0.46, 0.42, M.walnut), 0, 0.23, 0);
  put(g, box(0.54, 0.08, 0.36, M.mahogany), 0, 0.5, 0);
  put(g, box(0.46, 1.5, 0.32, M.mahogany), 0, 1.29, 0);
  put(g, box(0.32, 1.06, 0.02, M.darkGlass), 0, 1.22, 0.165);
  for (const [w, h, x, y] of [[0.36, 0.025, 0, 1.76], [0.36, 0.025, 0, 0.69], [0.025, 1.1, -0.17, 1.22], [0.025, 1.1, 0.17, 1.22]]) {
    put(g, box(w, h, 0.02, M.brass), x, y, 0.172);
  }
  const pend = new THREE.Group();
  put(g, pend, 0, 1.7, 0.1);
  put(pend, box(0.012, 0.62, 0.012, M.brass), 0, -0.31, 0);
  const bob = put(pend, mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.016, 28), M.brass), 0, -0.64, 0);
  bob.rotation.x = Math.PI / 2;
  anim.push((t) => { pend.rotation.z = Math.sin(t * Math.PI) * 0.22; });
  put(g, box(0.58, 0.68, 0.4, M.mahogany), 0, 2.38, 0);
  put(g, box(0.7, 0.08, 0.46, M.walnut), 0, 2.76, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8), M.brass), 0, 2.97, 0).rotation.set(0, 0, 0);
  put(g, mesh(new THREE.SphereGeometry(0.035, 12, 10), M.brass), 0, 3.2, 0);
  put(g, mesh(new THREE.SphereGeometry(0.03, 12, 10), M.brass), -0.3, 2.84, 0);
  put(g, mesh(new THREE.SphereGeometry(0.03, 12, 10), M.brass), 0.3, 2.84, 0);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.23, 40), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.5 }));
  put(g, face, 0, 2.38, 0.202);
  const hand = (len, w) => {
    const pivot = new THREE.Group();
    put(pivot, box(w, len, 0.006, M.dark, { cast: false }), 0, len / 2 - 0.02, 0);
    return pivot;
  };
  const hourH = put(g, hand(0.13, 0.016), 0, 2.38, 0.212);
  const minH = put(g, hand(0.19, 0.01), 0, 2.38, 0.216);
  anim.push(() => {
    const d = new Date();
    minH.rotation.z = -(d.getMinutes() + d.getSeconds() / 60) / 60 * Math.PI * 2;
    hourH.rotation.z = -((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2;
  });
  return g;
}

function buildGramophone(anim) {
  const g = new THREE.Group();
  put(g, mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 32), M.walnut), 0, 0.75, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.72, 14), M.walnutDark), 0, 0.38, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.04, 24), M.walnutDark), 0, 0.02, 0);
  put(g, rbox(0.5, 0.22, 0.5, M.mahogany, 0.025), 0, 0.89, 0);
  const disc = new THREE.Group();
  put(g, disc, 0, 1.012, 0);
  put(disc, mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 36), M.dark), 0, 0, 0);
  put(disc, mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.014, 20), std(0xa8452e)), 0, 0, 0);
  put(disc, box(0.02, 0.015, 0.012, M.brass), 0.04, 0.01, 0);
  anim.push((t, dt) => { disc.rotation.y -= dt * 3.4; });
  put(g, mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), M.brass), 0.16, 1.04, 0.05).rotation.set(Math.PI / 2, 0, 0.9);
  // corong
  const prof = [[0.03, 0], [0.04, 0.1], [0.07, 0.2], [0.13, 0.3], [0.22, 0.4], [0.34, 0.48]].map(([x, y]) => new THREE.Vector2(x, y));
  const horn = mesh(new THREE.LatheGeometry(prof, 32), std(0xc9a54a, { metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide, envMapIntensity: 1 }));
  const hornG = new THREE.Group();
  hornG.add(horn);
  put(g, hornG, -0.06, 1.06, -0.04);
  hornG.rotation.set(0.3, 0, -1.05);
  return g;
}

function buildTrunk(w, h, d, mat = M.leatherDark) {
  const g = new THREE.Group();
  put(g, rbox(w, h, d, mat, 0.04), 0, h / 2, 0);
  for (const sx of [-0.3, 0.3]) put(g, rbox(0.06, h + 0.01, d + 0.012, M.brass, 0.01), sx * w, h / 2, 0);
  put(g, rbox(w + 0.01, 0.025, d + 0.01, M.brass, 0.01), 0, h * 0.62, 0);
  put(g, rbox(0.1, 0.09, 0.03, M.brass, 0.01), 0, h * 0.62, d / 2 + 0.01);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, rbox(0.07, 0.07, 0.07, M.brass, 0.02), sx * (w / 2 - 0.03), h - 0.03, sz * (d / 2 - 0.03));
  return g;
}

function buildFern(seed) {
  const r = rng(seed);
  const g = new THREE.Group();
  put(g, mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.42, 20), std(0x9a4a2a, { roughness: 0.6 })), 0, 0.21, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.05, 20), std(0x7a3a20)), 0, 0.43, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 16), std(0x2a1a10)), 0, 0.42, 0);
  const leaf = std(0x2f6b3a, { roughness: 0.6 });
  const leaf2 = std(0x3d8248, { roughness: 0.6 });
  for (let i = 0; i < 22; i++) {
    // tilt = sudut daun di atas horizontal (rotation.x negatif → ujung daun naik, bukan terkulai ke bawah)
    const a = (i / 22) * Math.PI * 2 + r() * 0.4, tilt = 0.55 + r() * 0.65, len = 0.45 + r() * 0.35;
    const holder = new THREE.Group();
    put(g, holder, 0, 0.44, 0);
    holder.rotation.set(0, a, 0);
    const l = mesh(new THREE.SphereGeometry(1, 10, 6), i % 2 ? leaf : leaf2, { recv: false });
    l.scale.set(0.085, 0.022, len / 2);
    const piv = new THREE.Group();
    holder.add(piv);
    piv.rotation.x = -tilt;
    put(piv, l, 0, 0, len / 2);
  }
  return g;
}

function buildPendant(len, x, z, anim, lights) {
  const g = new THREE.Group();
  g.position.set(x, ROOM.h, z);
  put(g, mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 6), M.dark, { cast: false }), 0, -len / 2, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12), M.brass, { cast: false }), 0, -0.01, 0);
  const prof = [[0.03, 0.3], [0.08, 0.28], [0.16, 0.2], [0.25, 0.07], [0.29, 0]].map(([x1, y]) => new THREE.Vector2(x1, y));
  const shade = mesh(new THREE.LatheGeometry(prof, 28), std(0x2f5d4a, { metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide, envMapIntensity: 0.8 }), { cast: false });
  put(g, shade, 0, -len - 0.3, 0);
  put(g, mesh(new THREE.TorusGeometry(0.29, 0.008, 6, 28), M.brass, { cast: false }), 0, -len - 0.3, 0).rotation.x = Math.PI / 2;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }));
  put(g, bulb, 0, -len - 0.2, 0);
  const light = new THREE.PointLight(0xffb060, 18, 14, 2);
  put(g, light, 0, -len - 0.28, 0);
  lights.push(light);
  anim.push((t) => { g.rotation.z = Math.sin(t * 0.7 + x) * 0.012; g.rotation.x = Math.cos(t * 0.6 + z) * 0.01; });
  return g;
}

function buildFloorLamp(lights) {
  const g = new THREE.Group();
  put(g, mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.05, 20), M.brass), 0, 0.025, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.02, 0.026, 1.5, 10), M.brass), 0, 0.78, 0);
  put(g, mesh(new THREE.SphereGeometry(0.05, 12, 10), M.brass), 0, 0.55, 0);
  const shade = mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.34, 28, 1, true),
    std(0xf0d6a0, { roughness: 0.9, side: THREE.DoubleSide, emissive: 0xff9f45, emissiveIntensity: 0.65 }), { cast: false });
  put(g, shade, 0, 1.66, 0);
  put(g, mesh(new THREE.TorusGeometry(0.3, 0.008, 6, 28), M.brass, { cast: false }), 0, 1.49, 0).rotation.x = Math.PI / 2;
  const light = new THREE.PointLight(0xffb868, 12, 10, 2);
  put(g, light, 0, 1.62, 0);
  lights.push(light);
  return g;
}

/* ---------- Perabot sisi kiri ruangan ---------- */
function globeTexture() {
  const r = rng(31);
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#b9a578'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#6f8a5a';
    for (let i = 0; i < 34; i++) {
      g.beginPath();
      g.ellipse(r() * w, h * (0.15 + r() * 0.7), 14 + r() * 46, 8 + r() * 26, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(70,45,20,0.45)'; g.lineWidth = 1.5;
    for (let x = 0; x <= w; x += w / 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += h / 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
}

function buildGlobe(anim) {
  const g = new THREE.Group();
  put(g, mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.05, 20), M.walnutDark), 0, 0.025, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.022, 0.034, 0.78, 10), M.walnut), 0, 0.42, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.05, 14), M.brass), 0, 0.82, 0);
  const tilt = new THREE.Group();
  put(g, tilt, 0, 1.12, 0);
  tilt.rotation.z = 0.41;
  const ball = put(tilt, mesh(new THREE.SphereGeometry(0.27, 28, 20), new THREE.MeshStandardMaterial({ map: globeTexture(), roughness: 0.5, envMapIntensity: 0.5 })), 0, 0, 0);
  put(tilt, mesh(new THREE.TorusGeometry(0.31, 0.012, 8, 40), M.brass), 0, 0, 0).rotation.y = Math.PI / 2;
  put(tilt, mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.7, 8), M.brass), 0, 0, 0);
  anim.push((t, dt) => { ball.rotation.y += dt * 0.25; });
  return g;
}

function buildDresser(w, h, d, seed, faceTex) {
  const g = new THREE.Group();
  put(g, box(w - 0.1, 0.1, d - 0.08, M.walnutDark), 0, 0.05, 0);                    // plinth
  put(g, box(w, h - 0.15, d, M.mahogany), 0, 0.1 + (h - 0.15) / 2, 0);
  put(g, box(w + 0.06, 0.05, d + 0.05, M.walnut), 0, h - 0.025, 0.01);              // papan atas
  const dh = (h - 0.3) / 2;
  for (let row = 0; row < 2; row++) for (let c = 0; c < 3; c++) {
    const x = (c - 1) * (w / 3), y = 0.16 + dh * (row + 0.5);
    put(g, box(w / 3 - 0.07, dh - 0.05, 0.02, M.oak), x, y, d / 2 + 0.005);
    put(g, mesh(new THREE.SphereGeometry(0.026, 10, 8), M.brass), x, y, d / 2 + 0.03);
  }
  for (const sx of [-1, 1]) put(g, mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.1, 8), M.walnutDark), sx * (w / 2 - 0.08), 0.0, d / 2 - 0.08);
  fillRow(put(g, new THREE.Group(), 0, h, 0), 0, -w / 2 + 0.04, w / 2 - 0.04, rng(seed), faceTex);
  return g;
}

function buildWardrobe(w, h, d) {
  const g = new THREE.Group();
  put(g, box(w, 0.14, d, M.walnutDark), 0, 0.07, 0);
  put(g, box(w - 0.04, h - 0.4, d - 0.04, M.mahogany), 0, 0.14 + (h - 0.4) / 2, 0);
  put(g, box(w + 0.12, 0.14, d + 0.1, M.walnut), 0, h - 0.07, 0.02);               // lis atas
  put(g, box(w * 0.55, 0.12, 0.06, M.mahogany), 0, h + 0.05, d / 2 - 0.05);         // mahkota
  for (const sx of [-1, 1]) {
    put(g, box(w / 2 - 0.1, h - 0.7, 0.025, M.oak), sx * (w / 4), 0.14 + (h - 0.4) / 2, d / 2);
    put(g, box(w / 2 - 0.26, h - 0.95, 0.02, M.walnut), sx * (w / 4), 0.14 + (h - 0.4) / 2, d / 2 + 0.02);
    put(g, mesh(new THREE.SphereGeometry(0.03, 10, 8), M.brass), sx * 0.09, 1.25, d / 2 + 0.04);
  }
  return g;
}

function buildHatboxes() {
  const g = new THREE.Group();
  let y = 0;
  [[0.26, 0.22, 0xe7dcc0, 0x8a1325, 0.0], [0.21, 0.19, 0x2f5d4a, 0xc9a54a, 0.03], [0.16, 0.16, 0xa8452e, 0xe7dcc0, -0.02]].forEach(([R, H, c1, c2, dx]) => {
    put(g, mesh(new THREE.CylinderGeometry(R, R, H, 24), cmat(c1, { roughness: 0.7 })), dx, y + H / 2, 0);
    put(g, mesh(new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.05, 24), cmat(c2, { roughness: 0.6 })), dx, y + H, 0);
    y += H + 0.05;
  });
  return g;
}

function buildSideTable(faceTex, seed) {
  const g = new THREE.Group();
  put(g, mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 28), M.walnut), 0, 0.74, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.72, 12), M.walnutDark), 0, 0.38, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.04, 20), M.walnutDark), 0, 0.02, 0);
  put(g, mesh(new THREE.TorusGeometry(0.4, 0.012, 6, 28), M.brass), 0, 0.745, 0).rotation.x = Math.PI / 2;
  fillRow(put(g, new THREE.Group(), 0, 0.76, 0), 0, -0.34, 0.34, rng(seed), faceTex);
  return g;
}

function buildUmbrellaStand() {
  const g = new THREE.Group();
  put(g, mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.55, 18, 1, true), std(0x2f4a6a, { roughness: 0.4, side: THREE.DoubleSide })), 0, 0.275, 0);
  put(g, mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 18), M.dark), 0, 0.015, 0);
  put(g, mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 20), M.brass), 0, 0.5, 0).rotation.x = Math.PI / 2;
  [[-0.04, 0.02, 0.18, 0x1a1512], [0.05, -0.02, -0.25, 0x6a3520], [0.0, 0.05, 0.05, 0x242424]].forEach(([x, z, tz, c], i) => {
    const cane = put(g, mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.05 + i * 0.08, 8), cmat(c, { roughness: 0.5 })), x, 0.78, z);
    cane.rotation.z = tz * 0.5;
    put(g, mesh(new THREE.SphereGeometry(0.025, 8, 6), M.brass), x - Math.sin(tz * 0.5) * (0.52 + i * 0.04), 0.78 + 0.52 + i * 0.04, z);
  });
  return g;
}

function buildFrame(w, h, tex, frameMat = M.gilt) {
  const g = new THREE.Group();
  const b = 0.07;
  put(g, box(w + 2 * b, b, 0.05, frameMat), 0, h / 2 + b / 2, 0);
  put(g, box(w + 2 * b, b, 0.05, frameMat), 0, -h / 2 - b / 2, 0);
  put(g, box(b, h, 0.05, frameMat), -w / 2 - b / 2, 0, 0);
  put(g, box(b, h, 0.05, frameMat), w / 2 + b / 2, 0, 0);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  pic.receiveShadow = true;
  put(g, pic, 0, 0, 0.015);
  return g;
}

/* ============================================================
   createShop
============================================================ */
/**
 * @param {THREE.Group} o.caseRoot  koper besar milik world3d.js (lebar 5 satuan). Di sini ia dikecilkan
 *                                  (CASE_SCALE) & diletakkan di etalase; scene 5–10 memakai koper yang SAMA.
 * @param {Function}    o.onOpen    dipanggil saat koper diketuk → world3d mengambil alih kamera tanpa fade.
 */
export function createShop({ renderer, canvas, ui, caseRoot, onOpen }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0805);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.02, 80);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const anim = [];            // (t, dt) => void
  const lights = [];
  const faceTex = clockFaceTexture();

  /* ---------------- Ruangan ---------------- */
  const depth = ROOM.front - ROOM.back, cz = (ROOM.front + ROOM.back) / 2;
  {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, depth),
      std(0xffffff, { map: floorTexture([ROOM.x, depth / 2]), roughness: 0.55, envMapIntensity: 0.5 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, cz); floor.receiveShadow = true;
    scene.add(floor);

    const wallMat = (rx, ry) => std(0xffffff, { map: wallTexture([rx, ry]), roughness: 0.95 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.h), wallMat(ROOM.x * 2 / 1.0, ROOM.h / 1.0));
    back.position.set(0, ROOM.h / 2, ROOM.back); back.receiveShadow = true;
    scene.add(back);
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(depth, ROOM.h), wallMat(depth / 1.0, ROOM.h / 1.0));
      w.rotation.y = -sx * Math.PI / 2; w.position.set(sx * ROOM.x, ROOM.h / 2, cz); w.receiveShadow = true;
      scene.add(w);
      put(scene, box(0.08, 1.15, depth, M.walnut, { cast: false }), sx * (ROOM.x - 0.04), 0.575, cz);
      put(scene, box(0.14, 0.08, depth, M.mahogany, { cast: false }), sx * (ROOM.x - 0.07), 1.19, cz);
      put(scene, box(0.1, 0.18, depth, M.walnutDark, { cast: false }), sx * (ROOM.x - 0.05), 0.09, cz);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, depth), std(0x24160e, { roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, ROOM.h, cz);
    scene.add(ceil);
    for (let z = ROOM.back + 2; z < ROOM.front; z += 4) put(scene, box(ROOM.x * 2, 0.26, 0.3, M.walnutDark, { cast: false }), 0, ROOM.h - 0.13, z);

    // lambris dinding belakang
    put(scene, box(ROOM.x * 2, 1.15, 0.08, M.walnut, { cast: false }), 0, 0.575, ROOM.back + 0.04);
    put(scene, box(ROOM.x * 2, 0.08, 0.14, M.mahogany, { cast: false }), 0, 1.19, ROOM.back + 0.07);
    put(scene, box(ROOM.x * 2, 0.18, 0.1, M.walnutDark, { cast: false }), 0, 0.09, ROOM.back + 0.05);
    for (let x = -6.3; x <= 6.4; x += 1.4) put(scene, box(1.1, 0.78, 0.02, M.oak, { cast: false }), x, 0.6, ROOM.back + 0.09);

    // karpet
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4.4),
      std(0xffffff, { map: rugTexture(), roughness: 1, envMapIntensity: 0.1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(1.0, 0.012, 1.0); rug.receiveShadow = true;
    scene.add(rug);
  }

  /* ---------------- Dinding belakang ---------------- */
  {
    // rak kiri (berisi TV CRT) & kanan
    const left = buildBookcase({ W: 2.7, H: 3.4, levels: 4, seed: 11, faceTex, crtLevel: 1 });
    left.position.set(-4.0, 0, ROOM.back + 0.33);
    scene.add(left);
    const right = buildBookcase({ W: 2.7, H: 3.4, levels: 4, seed: 23, faceTex });
    right.position.set(5.2, 0, ROOM.back + 0.33);
    scene.add(right);

    // jam besar
    const clock = buildGrandfather(anim, faceTex);
    clock.position.set(-1.85, 0, ROOM.back + 0.3);
    scene.add(clock);

    // papan nama + lukisan
    const sign = new THREE.Group();
    put(sign, box(2.5, 0.62, 0.06, M.walnut), 0, 0, 0);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 0.5), new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.6 }));
    put(sign, face, 0, 0, 0.032);
    for (const sx of [-1, 1]) put(sign, box(0.014, 0.55, 0.014, M.dark, { cast: false }), sx * 1.0, 0.55, -0.01);
    sign.position.set(1.4, 3.7, ROOM.back + 0.1);
    scene.add(sign);

    const frames = [
      [0.9, 1.15, 2, -0.5, 2.3], [1.25, 0.9, 5, 0.9, 2.5], [0.75, 0.95, 8, 2.225, 2.25], [0.6, 0.6, 14, 3.225, 2.65],
    ];
    for (const [w, h, seed, x, y] of frames) {
      const f = buildFrame(w, h, paintingTexture(seed));
      f.position.set(x, y, ROOM.back + 0.04);
      scene.add(f);
    }

    // meja gramofon
    const gramo = buildGramophone(anim);
    gramo.position.set(3.75, 0, -2.0);
    scene.add(gramo);

    // peti & koper tua
    const trunk = buildTrunk(1.1, 0.55, 0.65);
    trunk.position.set(3.1, 0, -3.8); trunk.rotation.y = 0.12;
    scene.add(trunk);
    const trunk2 = buildTrunk(0.85, 0.42, 0.55, M.leather);
    trunk2.position.set(3.2, 0.55, -3.8); trunk2.rotation.y = -0.2;
    scene.add(trunk2);

    const fern = buildFern(5);
    fern.position.set(4.7, 0, -3.3);
    scene.add(fern);

    // lampu berdiri
    const fl = buildFloorLamp(lights);
    fl.position.set(-2.9, 0, -3.1);
    scene.add(fl);

    // sisi kiri ruangan: lemari, laci berisi pajangan, globe, kotak topi, tempat payung, lukisan dinding
    const wardrobe = buildWardrobe(1.3, 2.7, 0.62);
    wardrobe.position.set(-6.2, 0, ROOM.back + 0.33);
    scene.add(wardrobe);

    const dresser = buildDresser(1.8, 1.0, 0.55, 41, faceTex);
    dresser.position.set(-6.62, 0, -2.6); dresser.rotation.y = Math.PI / 2;
    scene.add(dresser);
    for (const [w, h, seed, z, y] of [[0.9, 1.1, 21, -2.95, 2.25], [0.6, 0.8, 33, -1.95, 2.1]]) {
      const f = buildFrame(w, h, paintingTexture(seed));
      f.position.set(-ROOM.x + 0.1, y, z); f.rotation.y = Math.PI / 2;
      scene.add(f);
    }

    // barang di lantai kiri (area yang terlihat kamera, di luar jalur jalan Gasing)
    const globe = buildGlobe(anim);
    globe.position.set(-4.05, 0, -3.6);
    scene.add(globe);

    const lowTrunk = buildTrunk(1.0, 0.5, 0.6);
    lowTrunk.position.set(-3.7, 0, -0.9); lowTrunk.rotation.y = 0.3;
    scene.add(lowTrunk);
    const topTrunk = buildTrunk(0.72, 0.36, 0.46, M.leather);
    topTrunk.position.set(-3.65, 0.5, -0.92); topTrunk.rotation.y = -0.15;
    scene.add(topTrunk);

    const hats = buildHatboxes();
    hats.position.set(-3.0, 0, -2.0); hats.rotation.y = 0.4;
    scene.add(hats);

    const umb = buildUmbrellaStand();
    umb.position.set(-4.7, 0, -3.9);
    scene.add(umb);

    const table = buildSideTable(faceTex, 52);
    table.position.set(-3.4, 0, 0.9);
    scene.add(table);
  }

  /* ---------------- Lampu gantung ---------------- */
  scene.add(buildPendant(1.15, -3.2, -2.2, anim, lights));
  scene.add(buildPendant(1.0, 4.3, -0.6, anim, lights));
  scene.add(buildPendant(1.3, -1.0, 3.4, anim, lights));

  /* ---------------- TV CRT di lantai (dipakai scene 11–12; mati selama scene 4–10) ---------------- */
  const tv = buildTV();
  tv.group.position.copy(TV_POS);
  tv.group.rotation.y = TV_ROT;
  scene.add(tv.group);

  const ballShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshBasicMaterial({
      map: canvasTex(64, 64, (g) => {
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      }),
      transparent: true, depthWrite: false, opacity: 0.6,
    }));
  ballShadow.rotation.x = -Math.PI / 2;
  ballShadow.renderOrder = 2;
  ballShadow.visible = false;
  scene.add(ballShadow);

  // statis TV: diisi acak tiap frame selama noiseOn
  const tvCtl = { noiseOn: false, playable: false, content: null, contentPromise: null, watching: false, live: false, lastT: -1, gn: 0 };
  anim.push(() => {
    if (!tvCtl.noiseOn) return;
    const d = tv.noiseData;
    for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 255) | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    tv.noiseTex.needsUpdate = true;
  });

  // layar TV saat video tampil: perbarui tekstur video hanya bila ada frame baru
  anim.push(() => {
    const c = tvCtl.content;
    if (!tvCtl.live || !c?.video) return;
    const v = c.video;
    if (v.currentTime !== tvCtl.lastT || v.seeking) { tvCtl.lastT = v.currentTime; c.tex.needsUpdate = true; }   // unggah ke GPU hanya saat ada frame baru
    if (!v.paused && ++tvCtl.gn % TV_FX.grainEvery === 0) tv.grainTex.offset.set(Math.random(), Math.random());     // grain berganti pelan → flicker lembut
  });

  /* ---------------- Etalase + koper ---------------- */
  const vitrine = new THREE.Group();
  vitrine.position.set(CASE.x, 0, CASE.z);
  scene.add(vitrine);
  // Penutup kaca (kaca, tiang, rangka atas): terangkat & memudar saat koper diketuk
  const cover = new THREE.Group();
  vitrine.add(cover);
  const coverMats = [];
  const fadeable = (m) => {
    const c = m.clone();
    c.transparent = true;
    coverMats.push({ m: c, o: c.opacity });
    return c;
  };
  const brassC = fadeable(M.brass), darkC = fadeable(M.walnutDark), glassC = fadeable(M.glass);
  glassC.depthWrite = false;
  {
    const { w: CW, d: CD, base, glass: GH } = CASE;
    put(vitrine, box(CW + 0.1, 0.1, CD + 0.1, M.walnutDark), 0, 0.05, 0);
    put(vitrine, box(CW, base - 0.16, CD, M.walnut), 0, 0.1 + (base - 0.16) / 2, 0);
    // panel hias di muka etalase
    for (const sx of [-0.7, 0.7]) {
      put(vitrine, box(1.2, 0.62, 0.03, M.mahogany), sx, 0.5, CD / 2 + 0.005);
      put(vitrine, box(1.02, 0.44, 0.02, M.oak), sx, 0.5, CD / 2 + 0.025);
      put(vitrine, mesh(new THREE.SphereGeometry(0.035, 10, 8), M.brass), sx, 0.5, CD / 2 + 0.05);
    }
    put(vitrine, box(CW + 0.1, 0.06, CD + 0.1, M.mahogany), 0, base - 0.03, 0);
    // alas beludru + bantalan
    put(vitrine, box(CW - 0.1, 0.02, CD - 0.1, M.velvet, { cast: false }), 0, base + 0.01, 0);
    put(vitrine, rbox(2.35, 0.08, 1.5, M.velvet, 0.03), 0, BED_Y + 0.04, 0);
    // kaca + tiang
    const gy = base + GH / 2;
    const pane = (w, h, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassC);
      m.position.set(x, y, z); m.rotation.y = ry; m.renderOrder = 5;
      cover.add(m);
    };
    pane(CW, GH, 0, gy, CD / 2 - 0.02);
    pane(CW, GH, 0, gy, -CD / 2 + 0.02, Math.PI);
    pane(CD, GH, -CW / 2 + 0.02, gy, 0, -Math.PI / 2);
    pane(CD, GH, CW / 2 - 0.02, gy, 0, Math.PI / 2);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(CW, CD), glassC);
    top.rotation.x = -Math.PI / 2; top.position.set(0, base + GH, 0); top.renderOrder = 5;
    cover.add(top);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      put(cover, box(0.06, GH, 0.06, brassC), sx * (CW / 2 - 0.03), gy, sz * (CD / 2 - 0.03));
    }
    put(cover, box(CW + 0.04, 0.06, CD + 0.04, brassC), 0, base + GH + 0.03, 0);
    put(cover, box(CW - 0.08, 0.025, CD - 0.08, darkC), 0, base + GH + 0.075, 0);
  }
  /** t = 0: tertutup · t = 1: terangkat & hilang. */
  function setCover(t) {
    cover.position.y = t * 1.1;
    for (const { m, o } of coverMats) m.opacity = o * (1 - t);
    cover.visible = t < 0.999;
  }

  // Koper besar dari world3d.js, dikecilkan & diletakkan di atas bantalan beludru
  caseRoot.scale.setScalar(CASE_SCALE);
  caseRoot.position.set(CASE.x, SUITCASE_Y, CASE.z);
  caseRoot.rotation.y = -0.12;
  scene.add(caseRoot);

  // lampu sorot untuk koper
  const spot = new THREE.SpotLight(0xffe1b0, 220, 0, 0.42, 0.7, 2);
  spot.position.set(CASE.x - 0.15, 3.7, CASE.z + 0.6);
  spot.target.position.set(CASE.x, SUITCASE_Y + 0.2, CASE.z);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 0.6; spot.shadow.camera.far = 6;
  spot.shadow.bias = -0.0004;
  scene.add(spot, spot.target);
  {
    const fix = new THREE.Group();
    fix.position.copy(spot.position);
    put(fix, mesh(new THREE.CylinderGeometry(0.015, 0.015, ROOM.h - spot.position.y, 6), M.dark, { cast: false }), 0, (ROOM.h - spot.position.y) / 2, 0);
    const cone = put(fix, mesh(new THREE.CylinderGeometry(0.08, 0.17, 0.26, 20, 1, true), std(0x1a1512, { metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }), { cast: false }), 0, 0.04, 0);
    put(fix, new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c9 })), 0, -0.07, 0);
    scene.add(fix);
    void cone;
  }
  // berkas cahaya
  let beamMat = null;
  {
    const dir = spot.target.position.clone().sub(spot.position);
    const len = dir.length();
    const rad = Math.tan(0.42) * len * 0.78;
    const geo = new THREE.ConeGeometry(rad, len, 40, 1, true);
    geo.translate(0, -len / 2, 0);            // puncak di y = 0, dasar di y = -len
    beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { color: { value: new THREE.Color(1.0, 0.8, 0.5) }, strength: { value: 0.2 }, H: { value: len } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying float vH;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vH = position.y;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 color; uniform float strength; uniform float H;
        varying vec3 vN; varying vec3 vV; varying float vH;
        void main(){ float f = abs(dot(normalize(vN), normalize(vV)));
          float fade = clamp(1.0 + vH / H, 0.0, 1.0);
          gl_FragColor = vec4(color, pow(f, 1.6) * fade * strength); }`,
    });
    const beam = new THREE.Mesh(geo, beamMat);
    beam.position.copy(spot.position);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
    beam.renderOrder = 4;
    scene.add(beam);
  }

  // Saat koper dibuka (scene 5–10) cahaya "naik" ke koper: sorot melebar + lampu isi dari depan,
  // supaya tutup yang terangkat, catatan & kereta tetap terang.
  const caseLight = new THREE.PointLight(0xffe2b8, 0, 0, 2);
  caseLight.position.set(CASE.x - 0.4, 2.9, CASE.z + 1.9);
  scene.add(caseLight);
  function setCaseLighting(k) {
    spot.angle = 0.42 + k * 0.4;
    // Saat koper terbuka cahaya diredupkan (spot 220 → 50, lampu isi 12 → 6) supaya warna merah kereta tidak pucat / silau
    spot.intensity = 220 - k * 170;
    caseLight.intensity = k * 6;
    if (beamMat) beamMat.uniforms.strength.value = 0.2 * (1 - k);
  }

  /* ---------------- Cahaya umum ---------------- */
  scene.add(new THREE.HemisphereLight(0xffe6c4, 0x2a1a10, 0.7));
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.9);
  fill.position.set(-4, 6, 9);
  scene.add(fill);

  /* ---------------- Debu beterbangan ---------------- */
  const DUST = 160;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = Array.from({ length: DUST }, (_, i) => rng(i * 97 + 5));
  const dustBase = Array.from({ length: DUST }, (_, i) => {
    const r = dustSeed[i];
    return [CASE.x - 2.2 + r() * 5, 0.4 + r() * 3.2, CASE.z - 2 + r() * 4.5, r() * 6, 0.1 + r() * 0.25];
  });
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: dotTexture(), color: 0xffd9a0, size: 0.06, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  dust.frustumCulled = false;
  scene.add(dust);
  anim.push((t) => {
    for (let i = 0; i < DUST; i++) {
      const [x, y, z, ph, sp] = dustBase[i];
      dustPos[i * 3] = x + Math.sin(t * sp + ph) * 0.35;
      dustPos[i * 3 + 1] = y + Math.sin(t * sp * 0.8 + ph * 1.7) * 0.25 - ((t * sp * 0.05) % 1) * 0.0;
      dustPos[i * 3 + 2] = z + Math.cos(t * sp * 0.9 + ph) * 0.35;
    }
    dustGeo.attributes.position.needsUpdate = true;
  });

  /* ---------------- Penanda "ketuk di sini" ---------------- */
  const markerMat = new THREE.SpriteMaterial({ map: markerTexture(), transparent: true, depthTest: false, depthWrite: false });
  const marker = new THREE.Sprite(markerMat);
  marker.scale.set(0.5, 0.5, 1);
  marker.renderOrder = 20;
  const markerY = CASE.base + CASE.glass + 0.36;
  marker.position.set(CASE.x, markerY, CASE.z);
  scene.add(marker);

  const glowMat = new THREE.MeshBasicMaterial({ map: glowRectTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.9), glowMat);
  glow.rotation.x = -Math.PI / 2; glow.rotation.z = 0.12;
  glow.position.set(CASE.x, BED_Y + 0.085, CASE.z);
  glow.renderOrder = 3;
  scene.add(glow);

  /* ---------------- Kamera ---------------- */
  function computeView(name) {
    const v = VIEWS[name];
    const portrait = camera.aspect < 0.85;
    const tanHalf = Math.tan((camera.fov / 2) * DEG);
    if (v.fill) {            // area video persis memenuhi viewport (contain, tanpa bingkai; overscan ±12% agar tepi cembung kaca CRT keluar dari viewport)
      const dist = Math.max(v.h / 2 / tanHalf, v.w / 2 / (tanHalf * camera.aspect)) * TV_FILL;
      const target = new THREE.Vector3(...v.t);
      return { pos: target.clone().add(new THREE.Vector3(...v.dir).normalize().multiplyScalar(dist)), look: target };
    }
    const w = portrait ? v.pw : v.w;
    const pad = portrait ? 1.5 : 1.3;
    const dist = Math.max((v.h * pad) / 2 / tanHalf, (w * 1.08) / 2 / (tanHalf * camera.aspect));
    const target = new THREE.Vector3(...v.t);
    const pos = target.clone().add(new THREE.Vector3(...v.dir).normalize().multiplyScalar(dist));
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

  /* ---------------- Gasing (DOM) yang berjalan di lantai 3D ---------------- */
  // Gasing berjalan di lantai (scene 4: ke etalase · scene 11: masuk menjinjing tas tenis di sarung tangan kirinya,
  // lihat createGasing3D({ bag: true })). Bola tenis adalah elemen DOM juga, diproyeksikan dari titik di lantai 3D
  // dengan fungsi yang sama.
  let actorWrap = null, actor = null, ballEl = null;
  let walkPath = { from: WALK_FROM, to: WALK_TO };
  const actorState = { u: 0, fade: 1, walking: false, baseH: 400, hopAt: 0 };
  const ball = { x: 0, y: BALL_R, z: 0, rot: 0, vis: false, prevX: null, prevZ: null };
  const tmp = new THREE.Vector3();
  const pw = new THREE.Vector3();
  const canvasSize = { w: 1, h: 1 };

  function spawnActor({ tv = false } = {}) {
    killActor();
    actorWrap = document.createElement('div');
    actorWrap.className = 'shop-actors';
    actor = createGasing3D({ label: tv ? 'Gasing menjinjing tas tenis' : 'Gasing masuk ke toko antik', className: 'shop-gasing', yaw: 0.55, bag: true });   // tas di punggung juga di scene 4
    actorWrap.append(actor);
    if (tv) {
      ballEl = document.createElement('i');
      ballEl.className = 'shop-ball';
      ballEl.setAttribute('aria-hidden', 'true');
      actorWrap.append(ballEl);
    }
    canvas.after(actorWrap);
    sizeActor();
  }
  function killActor() { actorWrap?.remove(); actorWrap = null; actor = null; ballEl = null; }
  function sizeActor() {
    if (!actor) return;
    const h = Math.round(Math.min(canvasSize.h * 0.5, 560));
    actorState.baseH = h;
    actor.style.height = `${h}px`;
    actor.style.width = `${Math.round(h * ACTOR_ASPECT)}px`;
  }
  /** Piksel per satuan dunia pada kedalaman titik p (sekaligus mengisi `tmp` dengan posisi layar). */
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
  /** Taruh elemen DOM berdiri di titik lantai p: tinggi `worldH` satuan dunia, "kaki" di `foot` (pecahan tinggi elemen). */
  function standAt(el, p, worldH, aspect, foot, tilt, opacity) {
    const { sx, sy, px } = projectPoint(p);
    const baseH = actorState.baseH;
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
    const u = actorState.u;
    const weave = Math.sin(u * Math.PI * 3.2) * 0.22 * (1 - u);
    const x = THREE.MathUtils.lerp(walkPath.from.x, walkPath.to.x, u);
    const z = THREE.MathUtils.lerp(walkPath.from.z, walkPath.to.z, u) + weave;
    reportMove(x, z, t);
    const tilt = actorState.walking ? Math.sin(t * 7.5) * 2.2 : 0;
    standAt(actor, pw.set(x, 0, z), ACTOR_H, ACTOR_ASPECT, ACTOR_FOOT, tilt, actorState.fade);
    if (ballEl) placeBall();
  }
  /** Bola tenis: elemen DOM bulat yang berguling (diputar sesuai jarak tempuh) + bayangan 3D di lantai. */
  function placeBall() {
    ballEl.style.opacity = ball.vis ? '1' : '0';
    ballShadow.visible = ball.vis;
    if (!ball.vis) { ball.prevX = null; return; }
    if (ball.prevX != null) {
      const dx = ball.x - ball.prevX, dz = ball.z - ball.prevZ;
      ball.rot += Math.hypot(dx, dz) / BALL_R * (180 / Math.PI) * (dx >= 0 ? 1 : -1);
    }
    ball.prevX = ball.x; ball.prevZ = ball.z;
    const { sx, sy, px } = projectPoint(pw.set(ball.x, ball.y, ball.z));
    const s = (BALL_R * 2 * px) / BALL_PX;
    ballEl.style.transform =
      `translate3d(${(sx - BALL_PX / 2).toFixed(1)}px, ${(sy - BALL_PX / 2).toFixed(1)}px, 0) scale(${s.toFixed(4)}) rotate(${ball.rot.toFixed(1)}deg)`;
    const air = Math.max(0, ball.y - BALL_R);
    ballShadow.position.set(ball.x, 0.014, ball.z);
    ballShadow.scale.setScalar(1 / (1 + air * 2.2));
    ballShadow.material.opacity = 0.6 / (1 + air * 3);
  }

  /* ---------------- State & alur ---------------- */
  let state = 'off';          // off | intro | ready | zoom
  let runId = 0;
  let walkTween = null;
  let hoverCase = false;
  let px = 0, py = 0, tpx = 0, tpy = 0;

  // efek peralihan ke dunia koper: 0 → 1
  const fx = { cover: 0, light: 0 };
  const applyFx = () => { setCover(fx.cover); setCaseLighting(fx.light); };

  let ballTl = null;
  const ballSt = { h: 0, v: 0 };
  const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

  /** TV mati, bola disembunyikan, video dijeda & diulang dari awal. */
  function tvReset() {
    ballTl?.kill(); ballTl = null;
    gsap.killTweensOf([tv.screenGroup.scale, tv.onMat.color, tv.glow, ballSt]);
    tvCtl.noiseOn = false; tvCtl.playable = false; tvCtl.watching = false; tvCtl.live = false; stopLoopId('tvstatic');
    gsap.killTweensOf([tv.overlayMat, tv.grainMat]); tv.overlayMat.opacity = 1; tv.grainMat.opacity = 0;
    tvCtl.content?.player?.abort();                // video dihentikan, musik & ambience kembali
    tv.screenGroup.visible = false; tv.screenGroup.scale.set(1, 1, 1);
    tv.offGlass.visible = true;
    tv.onMat.color.setRGB(1, 1, 1);
    tv.onMat.map = tv.noiseTex; tv.onMat.userData.u.uBgOn.value = 0;
    tv.glow.intensity = 0;
    tv.led.material.color.set(0x3a1410);
    const v = tvCtl.content?.video;
    if (v) { v.pause(); v.currentTime = 0; }
    ball.vis = false; ball.prevX = null; ball.rot = 0;
    ballShadow.visible = false;
    ui.hideEnd?.();
  }

  function leave() {
    runId++;
    camTween?.kill(); camTween = null;
    walkTween?.kill(); walkTween = null;
    gsap.killTweensOf([actorState, markerMat, glowMat, fx]);
    tvReset();
    killActor();
    state = 'off';
    canvas.style.cursor = 'default';
  }

  /** Scene 4: kamera masuk, Gasing berjalan ke etalase. */
  async function enter() {
    leave();
    const my = runId;
    state = 'intro';
    walkPath = { from: WALK_FROM, to: WALK_TO };
    fx.cover = 0; fx.light = 0; applyFx();
    actorState.u = 0; actorState.fade = 1; actorState.walking = false;
    markerMat.opacity = 0; glowMat.opacity = 0;
    ui.hint(null); ui.counter(null);
    spawnActor();
    setView('wide');

    const walk = new Promise((resolve) => {
      walkTween = gsap.to(actorState, {
        u: 1, duration: 4.2, delay: 0.6, ease: 'power1.out',
        onStart: () => { actorState.walking = true; actor?.setState?.('walk'); },
        onComplete: () => { actorState.walking = false; actor?.setState?.('idle'); walkTween = null; resolve(); },
      });
    });
    await Promise.all([flyTo('idle', 4.6, 'power2.inOut'), walk]);
    if (my !== runId) return;

    actor?.hop();
    await new Promise((r) => setTimeout(r, 450));
    if (my !== runId) return;
    state = 'ready';
    gsap.to(markerMat, { opacity: 1, duration: 0.5 });
    ui.hint('Ketuk koper di etalase');
    // satu gestur: menunjuk koper setelah jeda (hanya kalau koper belum diketuk)
    sleep(GESTURE_TIMING.lead).then(() => { if (my === runId && state === 'ready') actor?.gesture('pointCase'); });
  }

  /** Koper diketuk: penutup kaca terangkat, cahaya naik, Gasing memudar — dan kamera diserahkan ke world3d (tanpa fade). */
  function openCase() {
    if (state !== 'ready') return;
    state = 'handoff';
    ui.hint(null);
    canvas.style.cursor = 'default';
    gsap.to(actorState, {   // (tanpa loncatan ekstra setelah koper diketuk; juga tanpa SFX 'hop' pengiringnya)
      fade: 0, duration: 0.7, delay: 0.25,
      onComplete: () => { if (state === 'handoff') { killActor(); state = 'off'; } },
    });
    gsap.to(markerMat, { opacity: 0, duration: 0.3 });
    gsap.to(glowMat, { opacity: 0, duration: 0.3 });
    camTween?.kill(); camTween = null;
    loadTVContent();                    // preload video TV sejak koper diketuk (jauh sebelum scene 12)
    gsap.to(fx, { cover: 1, duration: 1.4, delay: 0.1, ease: 'power2.inOut', onStart: () => sfx('glass_up'), onUpdate: applyFx });
    gsap.to(fx, { light: 1, duration: 2.0, ease: 'power1.inOut', onUpdate: applyFx });
    onOpen?.();
  }

  /** Langsung ke mode koper tanpa animasi (mis. ?scene=6): penutup terbuka, cahaya penuh, tanpa Gasing. */
  function showCaseMode() {
    leave();
    fx.cover = 1; fx.light = 1; applyFx();
    markerMat.opacity = 0; glowMat.opacity = 0;
    ui.hint(null);
  }

  /** Pose kamera dunia saat ini (untuk penyerahan mulus ke world3d). */
  function getCamPose() { return { pos: camera.position.clone(), look: cur.look.clone() }; }

  /* ---------------- Scene 11–12: bola tenis jatuh, menggelinding ke TV CRT ---------------- */
  /** Isi layar TV: video ucapan kalau ada, kalau tidak → layar placeholder. Dimuat sekali. */
  function loadTVContent() {
    tvCtl.contentPromise ??= (async () => {
      try { await Promise.all([document.fonts.load('700 54px Fredoka'), document.fonts.load('700 92px Fredoka')]); } catch { /* pakai font cadangan */ }
      const src = CONFIG.assets.s12_video;
      if (await mediaExists(src)) {
        const video = document.createElement('video');
        // Dimuat sebagai blob: video selalu bisa di-seek (slider timeline) walau server statis tidak mendukung HTTP Range (serve.ps1). Gagal → URL langsung.
        let url = src;
        try { const res = await fetch(src); if (res.ok) url = URL.createObjectURL(await res.blob()); } catch { /* pakai URL langsung */ }
        video.src = url; video.preload = 'auto'; video.loop = false;
        video.playsInline = true; video.setAttribute('playsinline', '');
        // VideoTexture langsung (frame video diunggah ke GPU apa adanya, tanpa salinan kanvas 2D yang berat). Letterbox 'contain' lewat transform UV;
        // area di luar video dihitamkan di shader layar (lihat tv.onMat.onBeforeCompile).
        const tex = new THREE.VideoTexture(video);
        tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
        const fit = () => {
          const va = video.videoWidth / video.videoHeight, sa = TV_SCREEN.w / TV_SCREEN.h;
          if (!isFinite(va) || !va) return;
          const u = tv.onMat.userData.u;
          if (va > sa) { const f = sa / va; tex.repeat.set(1, 1 / f); tex.offset.set(0, -(1 - f) / 2 / f); u.uCover.value.set(f, 1); }      // video lebih lebar → bar atas/bawah (diisi background blur)
          else { const f = va / sa; tex.repeat.set(1 / f, 1); tex.offset.set(-(1 - f) / 2 / f, 0); u.uCover.value.set(1, f); }              // video lebih tinggi → bar kiri/kanan
          u.uTexRep.value.copy(tex.repeat); u.uTexOff.value.copy(tex.offset);
        };
        video.addEventListener('loadedmetadata', fit); fit();
        video.addEventListener('loadeddata', () => { tex.needsUpdate = true; });
        const player = createTVPlayer(video, { onExit: afterWatching });
        return { tex, video, player };
      }
      return { tex: tvPlaceholderTexture(CONFIG.recipient, src), video: null };
    })();
    return tvCtl.contentPromise;
  }

  /** Bola keluar dari tas, memantul, lalu menggelinding ke depan TV. Resolve saat berhenti. */
  function dropBall() {
    // titik jatuh = posisi Gasing SAAT INI (boleh sedang berjalan), bukan titik akhir jalur
    const au = actorState.u, weave0 = Math.sin(au * Math.PI * 3.2) * 0.22 * (1 - au);
    const ax = THREE.MathUtils.lerp(walkPath.from.x, walkPath.to.x, au), az = THREE.MathUtils.lerp(walkPath.from.z, walkPath.to.z, au) + weave0;
    // bola keluar dari mulut tas yang menggantung di sarung tangan kiri Gasing (posisi relatif ke kotak elemen Gasing)
    const mouth = actor?.bagMouthOffset?.(ACTOR_ASPECT) ?? bagMouthOffset(ACTOR_ASPECT);   // posisi aktual (ikut arah hadap Gasing)
    const bx = ax + mouth.x * ACTOR_H, bz = az + 0.05;
    const startY = (mouth.y - ACTOR_FOOT) * ACTOR_H;
    const bounce = gsap.parseEase('bounce.out');
    let said = false, pv = 0;   // pv: progres pantulan sebelumnya (deteksi lantai)
    ball.vis = true; ball.prevX = null;
    sfx('ball_pop');                         // bola melompat keluar dari tas
    ballSt.h = 0; ballSt.v = 0;
    const apply = () => {
      const { h, v } = ballSt;                       // h = jarak mendatar (melambat) · v = pantulan vertikal
      ball.x = THREE.MathUtils.lerp(bx, BALL_END.x, h);
      ball.z = THREE.MathUtils.lerp(bz, BALL_END.z, h);
      const s = Math.min(1, v / 0.2);
      ball.y = BALL_R + (startY - BALL_R) * (1 - bounce(v)) + (v < 0.2 ? 0.2 * 4 * s * (1 - s) : 0);   // melompat keluar dulu, lalu jatuh
      // SFX pantulan tepat saat bola menyentuh lantai: titik sentuh ease bounce.out sudah pasti (v = 1/2.75, 2/2.75, 2.5/2.75, 1),
      // jadi dipicu saat progres melewatinya — tidak bergantung FPS. Makin akhir makin pelan.
      let hit = -1;   // beberapa titik bisa terlewati dalam satu frame (FPS rendah) → bunyikan yang terakhir saja
      for (let k = 0; k < BOUNCE_HITS.length; k++) if (pv < BOUNCE_HITS[k] && v >= BOUNCE_HITS[k]) hit = k;
      if (hit >= 0) sfx('ball_bounce', { volume: BOUNCE_VOL[hit] });
      pv = v;
      if (!said && h > 0.78) { said = true; ui.setStage(12); }
    };
    apply();
    return new Promise((resolve) => {
      ballTl = gsap.timeline({ onComplete: () => { ballTl = null; resolve(); } })
        .to(ballSt, { h: 1, duration: BALL_ROLL_T, ease: 'power1.out', onUpdate: apply }, 0)   // kecepatan awal ≈ kecepatan jalan Gasing (momentum), lalu melambat
        .to(ballSt, { v: 1, duration: 1.5, ease: 'none', onUpdate: apply }, 0);
    });
  }

  /** TV menyala: layar membuka → statis → isi (video / placeholder), kamera mendekat, confetti, tombol akhir. */
  async function turnOnTV(my) {
    const content = await loadTVContent();
    if (my !== runId) return;
    tvCtl.content = content;
    const { screenGroup, onMat, glow, led } = tv;
    tv.offGlass.visible = false;
    screenGroup.visible = true;
    onMat.map = tv.noiseTex; onMat.needsUpdate = true;
    tvCtl.noiseOn = true;
    sfx('tv_on'); startLoop('tvstatic');   // klik TV + desis statis selama layar bersalju
    led.material.color.set(0x7cff5b);
    gsap.fromTo(screenGroup.scale, { y: 0.02 }, { y: 1, duration: 0.4, ease: 'power3.out' });
    gsap.fromTo(onMat.color, { r: 3, g: 3, b: 3 }, { r: 1, g: 1, b: 1, duration: 0.6 });
    gsap.to(glow, { intensity: 2.6, duration: 0.8 });
    await sleep(0.9);
    if (my !== runId) return;

    tvCtl.noiseOn = false;
    stopLoopId('tvstatic');
    onMat.map = content.tex; onMat.needsUpdate = true;
    onMat.userData.u.uBgOn.value = content.video ? 1 : 0;   // background blur hanya untuk video
    if (content.video) gsap.to(tv.overlayMat, { opacity: TV_FX.overlay, duration: 0.8 });   // garis scan / vinyet 3D diredam saat video tampil
    gsap.fromTo(onMat.color, { r: 2.4, g: 2.4, b: 2.4 }, { r: 1, g: 1, b: 1, duration: 0.5 });
    const video = content.video;
    if (video) { tvCtl.live = true; tvCtl.lastT = -1; gsap.to(tv.grainMat, { opacity: TV_FX.grain, duration: 0.8 }); }   // frame pertama + grain tipis; video diputar otomatis setelah zoom
    // (confetti TIDAK di sini: baru muncul setelah video selesai, bersamaan dengan pop-up)
    // bersorak, lalu melambai terima kasih (tangan kanan saja; tas tetap dijinjing)
    actor?.gesture('marvel', { speed: MARVEL_SPEED });   // satu gestur: kagum/kaget melihat TV, dipercepat
    const mid = flyTo('tvMid', 2.6, 'power2.inOut');
    await sleep(1.5);
    if (my !== runId) return;
    if (!video) { ui.confetti?.(); ui.showEnd?.(null); return; }   // tanpa video (placeholder): perilaku lama
    await mid;                                      // confetti & gestur kagum selesai → zoom in ke layar, video langsung diputar otomatis
    await sleep(0.6);
    if (my !== runId) return;
    startWatching();
  }

  /** Pemain memilih menonton (ketuk TV / tombol): zoom in halus → video diputar dengan kontrol minimalis. */
  async function startWatching() {
    const c = tvCtl.content;
    if (!c?.player || tvCtl.watching || state !== 'tv') return;
    const my = runId;
    tvCtl.watching = true;
    ui.hideEnd?.(); ui.hint(null);
    c.player.prime();                              // putar ulang dari tombol (gestur): izinkan play() setelah zoom
    sfx('whoosh');
    await flyTo('tvClose', 1.5, 'power2.inOut');
    if (my !== runId || !tvCtl.watching) return;
    c.player.start();
  }
  /** Video selesai / ditutup: zoom out halus, kembali ke alur normal (tombol putar ulang tersedia). */
  async function afterWatching({ ended }) {
    const my = runId;
    tvCtl.watching = false;
    if (ended) await sleep(0.5);
    if (my !== runId) return;
    sfx('whoosh');
    flyTo('tvMid', 1.5, 'power2.inOut');
    await sleep(0.9);
    if (my !== runId || tvCtl.watching) return;
    ui.showEnd?.(startWatching, '↻ Putar ulang');   // pop-up tombol baru muncul SETELAH video selesai / ditutup
    if (ended) ui.confetti?.();                      // confetti + SFX-nya (tepat 1×) bersamaan dengan pop-up, hanya saat video benar-benar selesai
  }

  /**
   * Scene 11 → 12. `pose` (opsional) = pose kamera dunia saat koper selesai ditutup di scene 10 →
   * kamera mundur dari koper, penutup kaca turun kembali, lalu Gasing berjalan masuk membawa tas tenis (tanpa fade).
   * Tanpa `pose` (loncat langsung / debug) → mulai dari sudut lebar. at12 → langsung bola sudah di dekat TV.
   */
  async function enterTV({ pose = null, at12 = false } = {}) {
    leave();
    const my = runId;
    state = 'tv';
    ui.hint(null); ui.counter(null);
    walkPath = TV_PATH;
    Object.assign(actorState, { u: at12 ? 1 : 0, fade: 1, walking: false });
    markerMat.opacity = 0; glowMat.opacity = 0;
    spawnActor({ tv: true });
    loadTVContent();

    let camDone = Promise.resolve();
    if (pose) {
      cur.pos.copy(pose.pos); cur.look.copy(pose.look);
      fx.cover = 1; fx.light = 1; applyFx();
      gsap.to(fx, { cover: 0, duration: 1.7, delay: 0.5, ease: 'power2.inOut', onStart: () => sfx('glass_down'), onUpdate: applyFx });
      gsap.to(fx, { light: 0, duration: 2.4, delay: 0.3, ease: 'power1.inOut', onUpdate: applyFx });
      camDone = flyTo('tvWide', 4.2, 'power2.inOut');
    } else {
      fx.cover = 0; fx.light = 0; applyFx();
      setView('tvWide');
    }

    if (at12) {
      Object.assign(ball, { vis: true, x: BALL_END.x, y: BALL_R, z: BALL_END.z });
      await sleep(0.8);
    } else {
      let dropping = null;
      const walk = new Promise((resolve) => {
        walkTween = gsap.to(actorState, {
          u: 1, duration: 3.8, delay: pose ? 1.6 : 0.6, ease: 'power1.out',
          onStart: () => { actorState.walking = true; actor?.setState?.('walk'); },
          onUpdate: () => {
            if (dropping || actorState.u < BALL_DROP_AT) return;       // titik pemicu: bola jatuh MENDADAK, jalan tidak berhenti
            ui.caption(CONFIG.captions[11]);
            actor?.wobble();                                           // tas tersentak
            actor?.gesture('startle');                                 // kaget
            dropping = dropBall();
          },
          onComplete: () => { actorState.walking = false; actor?.setState?.('idle'); walkTween = null; resolve(); },
        });
      });
      await Promise.all([camDone, walk]);
      if (my !== runId) return;
      if (!dropping) dropping = dropBall();                          // jaga-jaga bila titik pemicu terlewat
      await dropping;
      if (my !== runId) return;
      await sleep(0.5);
    }
    if (my !== runId) return;
    await turnOnTV(my);
  }

  /* ---------------- Input ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  const interactive = () => state === 'intro' || state === 'ready';
  function pickCase(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects([caseRoot, marker], true).length > 0;
  }
  const tvTappable = () => false;   // tanpa tombol / ketuk "tonton TV": video diputar otomatis
  function pickTV(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(tv.group, true).length > 0;
  }
  canvas.addEventListener('pointerdown', (e) => { if (interactive() || tvTappable()) down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointermove', (e) => {
    if (!interactive()) return;
    const r = canvas.getBoundingClientRect();
    tpx = ((e.clientX - r.left) / r.width) * 2 - 1;
    tpy = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (state === 'ready' && e.pointerType === 'mouse') {
      hoverCase = pickCase(e);
      canvas.style.cursor = hoverCase ? 'pointer' : 'default';
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    const d = down; down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return;
    if (state === 'ready') { if (pickCase(e)) openCase(); }
    else if (tvTappable() && pickTV(e)) startWatching();     // ketuk TV → mulai menonton
  });
  canvas.addEventListener('pointercancel', () => { down = null; });

  /* ---------------- Loop ---------------- */
  let lastT = 0;
  /** ownCamera = false → world3d yang mengatur kamera (scene 5–10); toko hanya menghidupkan suasana. */
  function update(t, ownCamera = true) {
    const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    for (const fn of anim) fn(t, dt);

    if (state === 'handoff') placeActor(t);   // Gasing memudar sementara kamera sudah dipegang world3d
    if (!ownCamera || state === 'off' || state === 'handoff') return;

    // Debug: kamera bebas untuk memeriksa seluruh ruangan (window.__shop.free = { pos:[x,y,z], look:[x,y,z], fov })
    const free = window.__shop?.free;
    if (free) {
      camera.position.set(...free.pos);
      camera.lookAt(...free.look);
      if (free.fov && camera.fov !== free.fov) { camera.fov = free.fov; camera.updateProjectionMatrix(); }
      camera.updateMatrixWorld();
      return;
    }

    if (state === 'ready') {
      px += (tpx - px) * 0.05; py += (tpy - py) * 0.05;
    }
    camera.position.copy(cur.pos);
    if (state === 'ready') {
      camera.position.x += px * 0.35 + Math.sin(t * 0.3) * 0.04;
      camera.position.y += -py * 0.12 + Math.sin(t * 0.4) * 0.02;
    }
    camera.lookAt(cur.look);
    camera.updateMatrixWorld();

    if (actorState.walking && t - actorState.hopAt > 0.8) { actor?.hop(); actorState.hopAt = t; }
    placeActor(t);

    if (state === 'ready') {
      const pulse = 0.5 + Math.sin(t * 3) * 0.5;
      marker.position.y = markerY + Math.sin(t * 2.4) * 0.07;
      const s = 0.5 + pulse * 0.04 + (hoverCase ? 0.07 : 0);
      marker.scale.set(s, s, 1);
      glowMat.opacity = 0.35 + pulse * 0.4 + (hoverCase ? 0.25 : 0);
    }
  }

  function resize(w, h) {
    canvasSize.w = w; canvasSize.h = h;
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.85 ? 50 : 35;
    camera.updateProjectionMatrix();
    if (!camTween) setView(currentView);
    sizeActor();
  }

  if (new URLSearchParams(location.search).has('debug')) window.__shop = { scene, camera, ROOM, free: null };

  /** Dipanggil di dalam klik "Tutup Koper" (gestur pengguna): membuka kunci putar video untuk autoplay bersuara di scene 12. */
  function primeTV() { tvCtl.content?.player?.prime(); }

  return { scene, camera, enter, enterTV, leave, update, resize, getCamPose, showCaseMode, primeTV };
}
// Dipakai ulang oleh street3d.js (scene 3)
export { rng, std, box, rbox, put, mesh, canvasTex, markerTexture, dotTexture };
