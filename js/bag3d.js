// ============================================================
//  TAS TENIS 3D  (tas + raket di dalamnya, untuk karakter Gasing)
//  Gaya kartun yang sama dengan gasing3d.js: toon shading + garis tinta,
//  canvas transparan sendiri, renderer dibuang saat elemen dilepas dari halaman.
//
//  const bag = createBag3D({ label, className, yaw });
//  parent.append(bag);   // bag.wobble() → tas bergoyang, raket ikut oscillate
//                        // bag.setYaw(rad) → putar tas (dipakai halaman preview)
//
//  buildBagModel(THREE, toon, part, opts) → model tas yang sama sebagai THREE.Group,
//  dipakai juga oleh gasing3d.js supaya Gasing bisa MENJINJING tas di scene-nya sendiri
//  (tas ikut bergerak bersama sarung tangan, bukan elemen terpisah di sebelahnya).
//
//  Kalau WebGL / CDN three gagal → elemen jadi slot gambar biasa (CONFIG.assets.s3_tas)
//  atau kotak placeholder berlabel.
// ============================================================
import { CONFIG } from './config.js';
import { slot } from './assets.js';

// Ukuran tas (satuan model) — gasing3d.js memakainya untuk menghitung titik genggam & mulut tas.
export const BAG_DIMS = { BW: 1.5, BH: 2.5, BD: 1.0, HANDLE_X: -0.5, HANDLE_H: 1.0 };

let threePromise;
const loadThree = () => (threePromise ??= import('three'));

const instances = new Set();
let raf = 0;

function loop() {
  raf = 0;
  const now = performance.now();
  for (const inst of instances) {
    if (!inst.el.isConnected) {
      if (inst.seen || now - inst.born > 8000) inst.dispose();
      continue;
    }
    inst.seen = true;
    inst.render(now / 1000);
  }
  if (instances.size) raf = requestAnimationFrame(loop);
}
const ensureLoop = () => { if (!raf) raf = requestAnimationFrame(loop); };

/**
 * @param {object} [o]
 * @param {string} [o.label]      teks alt / aria-label
 * @param {string} [o.className]  class tambahan (mis. 's3-tas')
 * @param {number} [o.yaw]        radian; > 0 = tas menghadap sedikit ke kanan layar
 */
export function createBag3D({ label = 'Tas tenis + raket', className = '', yaw = 0.35 } = {}) {
  const el = document.createElement('div');
  el.className = `bag3d ${className}`.trim();
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  el.wobble = () => {};
  el.setYaw = () => {};

  const showFallback = () => {
    el.classList.add('is-fallback');
    el.replaceChildren(slot({ src: CONFIG.assets.s3_tas, label }));
  };

  loadThree()
    .then((THREE) => {
      const inst = mount(THREE, el, yaw);
      if (!inst) return showFallback();
      el.wobble = inst.wobble;
      el.setYaw = inst.setYaw;
      instances.add(inst);
      ensureLoop();
    })
    .catch((err) => { console.warn('Tas 3D gagal, pakai gambar 2D:', err); showFallback(); });

  return el;
}

/* ------------------------------------------------------------
   Model tas + raket (dipakai createBag3D dan gasing3d.js)
   Satuan lokal: tas berdiri dengan dasar di y = 0, tengah di x = z = 0.

   @param THREE
   @param toon  (hex) → material toon
   @param part  (geo, mat, inkWidth) → Group berisi mesh + garis tinta
   @param opts.handle   true → tambahkan tali jinjing di sisi kiri mulut tas (untuk dipegang Gasing)
   @param opts.inkMul   pengali tebal garis tinta (kalau model nanti diperkecil, mis. 1.4)
   @returns { bag, racketPivot, dims, handleTop, update(t, wob, amp) }
------------------------------------------------------------ */
export function buildBagModel(THREE, toon, part, { handle = false, inkMul = 1 } = {}) {
  const V3 = THREE.Vector3;
  const col = (hex) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
  const ink = (geo, mat, w = 0.03) => part(geo, mat, w * inkMul);
  const put = (parent, obj, x = 0, y = 0, z = 0) => { obj.position.set(x, y, z); parent.add(obj); return obj; };

  // Rounded box tanpa import addons: BoxGeometry yang sudut-sudutnya dibulatkan dengan normal halus,
  // jadi garis tinta tidak retak di tepi.
  function roundedBox(w, h, d, r, seg = 6) {
    const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
    const pa = g.attributes.position, na = g.attributes.normal;
    const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    const p = new V3(), c = new V3(), n = new V3();
    for (let i = 0; i < pa.count; i++) {
      p.fromBufferAttribute(pa, i);
      c.set(Math.max(-hx, Math.min(hx, p.x)), Math.max(-hy, Math.min(hy, p.y)), Math.max(-hz, Math.min(hz, p.z)));
      n.copy(p).sub(c);
      if (n.lengthSq() > 1e-10) {
        n.normalize();
        p.copy(c).addScaledVector(n, r);
        pa.setXYZ(i, p.x, p.y, p.z);
        na.setXYZ(i, n.x, n.y, n.z);
      }
    }
    g.computeBoundingSphere();
    return g;
  }

  // Kurva superellipse tertutup di bidang XZ (dasar mulut tas)
  const mouthPts = (a, b, n, count = 96) => {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      pts.push(new V3(Math.sign(c) * a * Math.abs(c) ** (2 / n), 0, Math.sign(s) * b * Math.abs(s) ** (2 / n)));
    }
    return pts;
  };

  // Warna
  const NAVY = 0x2b6f8e, NAVY_D = 0x1d4a63, NAVY_L = 0x4f93b0, CREAM = 0xf3ecd2;
  const CORAL = 0xe9573b, GRIP = 0x2a2a28;

  /* ---------------- Tas ---------------- */
  const { BW, BH, BD } = BAG_DIMS, BR = 0.16;
  const bag = new THREE.Group();

  put(bag, ink(roundedBox(BW, BH, BD, BR), toon(NAVY), 0.03), 0, BH / 2, 0);
  // alas gelap
  put(bag, ink(roundedBox(BW + 0.06, 0.5, BD + 0.06, BR), toon(NAVY_D), 0.03), 0, 0.25, 0);
  // garis krem pemisah alas
  put(bag, ink(roundedBox(BW + 0.075, 0.06, BD + 0.075, 0.03, 3), toon(CREAM), 0.02), 0, 0.52, 0);

  // Mulut tas: bagian dalam gelap + bibir resleting krem
  const A = BW / 2 - BR - 0.02, B = BD / 2 - BR - 0.02;
  const inner = new THREE.Mesh(
    new THREE.ShapeGeometry(new THREE.Shape(mouthPts(A, B, 4).map((p) => new THREE.Vector2(p.x, -p.z)))),
    new THREE.MeshBasicMaterial({ color: col(0x120d0a), side: THREE.DoubleSide }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = BH + 0.002;
  bag.add(inner);
  const rimCurve = new THREE.CatmullRomCurve3(mouthPts(A, B, 4), true);
  put(bag, ink(new THREE.TubeGeometry(rimCurve, 140, 0.065, 14, true), toon(CREAM), 0.025), 0, BH, 0);
  // gigi resleting kecil di bibir
  const zipPts = mouthPts(A + 0.0, B + 0.0, 4);
  for (let i = 0; i < zipPts.length; i += 3) {
    const t = i / zipPts.length * Math.PI * 2;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.075), new THREE.MeshBasicMaterial({ color: col(0x5f564a) }));
    tooth.position.set(zipPts[i].x, BH + 0.062, zipPts[i].z);
    tooth.rotation.y = -t + Math.PI / 2;
    bag.add(tooth);
  }
  // tarikan resleting
  {
    const pull = new THREE.Group();
    pull.position.set(A * 0.62, BH + 0.06, B * 0.995);
    pull.add(ink(roundedBox(0.12, 0.05, 0.1, 0.02, 2), toon(CORAL), 0.015));
    const tab = ink(roundedBox(0.07, 0.03, 0.22, 0.012, 2), toon(CORAL), 0.015);
    tab.position.set(0, 0.0, 0.14); pull.add(tab);
    bag.add(pull);
  }

  // Kantong depan + lambang bola tenis
  const pocket = ink(roundedBox(1.18, 0.86, 0.2, 0.09), toon(NAVY_L), 0.025);
  put(bag, pocket, 0, 1.0, BD / 2 + 0.05);
  put(bag, ink(roundedBox(1.08, 0.04, 0.05, 0.018, 2), toon(CREAM), 0.015), 0, 1.36, BD / 2 + 0.16);     // resleting kantong
  put(bag, ink(roundedBox(0.1, 0.05, 0.07, 0.02, 2), toon(CORAL), 0.012), 0.4, 1.32, BD / 2 + 0.19);
  const ballTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#d5e24a'; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.clip();
    g.strokeStyle = '#fffdf0'; g.lineWidth = 15;
    g.beginPath(); g.arc(-14, 128, 118, -1.0, 1.0); g.stroke();
    g.beginPath(); g.arc(270, 128, 118, Math.PI - 1.0, Math.PI + 1.0); g.stroke();
    g.restore();
    g.strokeStyle = '#121210'; g.lineWidth = 12; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  })();
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.27, 40), new THREE.MeshBasicMaterial({ map: ballTex, transparent: true }));
  emblem.position.set(0, 0.88, BD / 2 + 0.153);
  bag.add(emblem);

  // Cincin tali di kedua sisi + tab
  for (const sx of [-1, 1]) {
    put(bag, ink(roundedBox(0.06, 0.26, 0.2, 0.025, 2), toon(NAVY_D), 0.02), sx * (BW / 2 + 0.0), 2.05, 0);
    const ring = ink(new THREE.TorusGeometry(0.17, 0.045, 14, 40), toon(CREAM), 0.022);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(sx * (BW / 2 + 0.07), 1.97, 0);
    bag.add(ring);
  }

  // Kaki karet kecil
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    put(bag, ink(new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(GRIP), 0.02), sx * (BW / 2 - 0.2), -0.01, sz * (BD / 2 - 0.2)).scale.y = 0.6;
  }

  /* ---------------- Tali jinjing (di sisi kiri mulut, supaya raket tidak tertutup) ---------------- */
  // Lengkung tali di bidang Y–Z: kedua ujungnya di bibir resleting, puncaknya = titik genggam.
  const { HANDLE_X, HANDLE_H } = BAG_DIMS;
  const handleTop = new V3(HANDLE_X, BH + HANDLE_H, 0);
  if (handle) {
    const zEnd = B * Math.pow(1 - (HANDLE_X / A) ** 4, 0.25);                 // titik di bibir mulut pada x = HANDLE_X
    const strap = new THREE.CatmullRomCurve3([
      new V3(HANDLE_X, BH - 0.01, -zEnd),
      new V3(HANDLE_X, BH + HANDLE_H * 0.55, -zEnd * 0.8),
      new V3(HANDLE_X, BH + HANDLE_H, 0),
      new V3(HANDLE_X, BH + HANDLE_H * 0.55, zEnd * 0.8),
      new V3(HANDLE_X, BH - 0.01, zEnd),
    ]);
    bag.add(ink(new THREE.TubeGeometry(strap, 48, 0.062, 12, false), toon(CORAL), 0.026));
    for (const sz of [-1, 1]) {
      put(bag, ink(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 16), toon(CREAM), 0.02), HANDLE_X, BH + 0.02, sz * zEnd);   // kerah di pangkal tali
    }
  }

  /* ---------------- Raket (menyembul dari mulut tas) ---------------- */
  const racketPivot = new THREE.Group();
  racketPivot.position.set(0.12, BH - 0.08, 0.02);
  racketPivot.rotation.set(0.06, 0, -0.17);
  bag.add(racketPivot);

  const racket = new THREE.Group(); racketPivot.add(racket);
  const frameMat = toon(CORAL), creamMat = toon(CREAM), gripMat = toon(GRIP);

  const HX = 0.6, HY = 0.78, HC = 1.52, FR = 0.062;            // setengah lebar, setengah tinggi, tinggi pusat kepala, tebal bingkai
  const headPts = [];
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * Math.PI * 2;
    headPts.push(new V3(Math.cos(t) * HX, HC + Math.sin(t) * HY, 0));
  }
  const headCurve = new THREE.CatmullRomCurve3(headPts, true);
  racket.add(ink(new THREE.TubeGeometry(headCurve, 160, FR, 16, true), frameMat, 0.025));

  // pelindung bingkai di puncak kepala
  {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = Math.PI / 2 - 0.62 + (i / 14) * 1.24;
      pts.push(new V3(Math.cos(t) * HX, HC + Math.sin(t) * HY, 0));
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, FR + 0.022, 16, false);
    racket.add(ink(geo, creamMat, 0.022));
    for (const p of [pts[0], pts[pts.length - 1]]) {
      put(racket, ink(new THREE.SphereGeometry(FR + 0.022, 16, 12), creamMat, 0.022), p.x, p.y, p.z);
    }
  }

  // leher: dua lengan Y dari tangkai ke kepala + jembatan kecil
  const armY = (sx) => {
    const xr = 0.3 * sx;
    const yr = HC - HY * Math.sqrt(1 - (xr / HX) ** 2);
    return new THREE.CatmullRomCurve3([new V3(0.045 * sx, 0.25, 0), new V3(0.075 * sx, 0.55, 0), new V3(0.17 * sx, 0.78, 0), new V3(xr, yr + 0.01, 0)]);
  };
  for (const sx of [-1, 1]) racket.add(ink(new THREE.TubeGeometry(armY(sx), 40, FR * 0.92, 14, false), frameMat, 0.025));
  put(racket, ink(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 14).rotateZ(Math.PI / 2), frameMat, 0.022), 0, 0.82, 0);
  // tangkai + grip berlilit (sebagian besar di dalam tas)
  put(racket, ink(new THREE.CylinderGeometry(0.075, 0.075, 0.7, 18), frameMat, 0.022), 0, 0.3, 0);
  put(racket, ink(new THREE.CylinderGeometry(0.1, 0.105, 1.35, 18), gripMat, 0.022), 0, -0.75, 0);
  for (let i = 0; i < 6; i++) {
    const w = part(new THREE.TorusGeometry(0.103, 0.014, 6, 24), creamMat, 0);
    w.rotation.x = Math.PI / 2;
    w.position.y = -0.18 - i * 0.2;
    racket.add(w);
  }
  put(racket, ink(new THREE.CylinderGeometry(0.135, 0.135, 0.06, 18), gripMat, 0.02), 0, -1.45, 0);

  // senar: tekstur kanvas pada elips dalam bingkai
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 640;
    const g = c.getContext('2d');
    g.lineCap = 'round';
    const draw = (width, color) => {
      g.strokeStyle = color; g.lineWidth = width;
      g.beginPath();
      for (let i = 1; i < 9; i++) { const x = (i / 9) * 512; g.moveTo(x, 0); g.lineTo(x, 640); }
      for (let j = 1; j < 12; j++) { const y = (j / 12) * 640; g.moveTo(0, y); g.lineTo(512, y); }
      g.stroke();
    };
    draw(9, 'rgba(18,18,16,0.55)');
    draw(4, 'rgba(255,253,240,0.95)');
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    const strings = new THREE.Mesh(
      new THREE.CircleGeometry(1, 72),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    strings.scale.set(HX - 0.01, HY - 0.01, 1);
    // CircleGeometry UV memetakan lingkaran ke kotak [0,1]² → senar mengikuti elips
    strings.position.set(0, HC, 0);
    racket.add(strings);
  }

  /** Raket bergoyang sedikit di dalam tas. `wob` = ayunan sesaat (−1…1) setelah tas disenggol. */
  function update(t, wob, amp) {
    racketPivot.rotation.z = -0.17 + Math.sin(t * 1.3) * 0.018 * amp + wob * 0.1;
    racketPivot.rotation.x = 0.06 + Math.sin(t * 1.0 + 2) * 0.012 * amp;
  }

  return { bag, racketPivot, dims: { BW, BH, BD }, handleTop, update };
}

/* ------------------------------------------------------------
   Renderer mandiri untuk satu elemen (tas berdiri sendiri)
------------------------------------------------------------ */
function mount(THREE, el, yaw0) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch { return null; }

  // Sama seperti gasing3d.js: warna & output linear supaya shading kartun identik.
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  el.replaceChildren(canvas);

  const V3 = THREE.Vector3;
  const col = (hex) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const amp = reduceMotion ? 0.25 : 1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const TARGET = new V3(0, 2.45, 0);
  const HOME_DIR = new V3(0.9, 1.3, 8).normalize();   // sedikit dari atas supaya mulut tas terlihat
  scene.add(camera);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4 * Math.PI));
  const key = new THREE.DirectionalLight(0xffffff, 0.72 * Math.PI);
  key.position.set(-4, 5, 4);
  camera.add(key);

  // Toon ramp (sama dengan Gasing)
  const ramp = [120, 120, 120, 120, 225, 225, 225, 255];
  const rampData = new Uint8Array(ramp.length * 4);
  ramp.forEach((v, i) => { rampData.set([v, v, v, 255], i * 4); });
  const grad = new THREE.DataTexture(rampData, ramp.length, 1, THREE.RGBAFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter;
  grad.generateMipmaps = false;
  grad.needsUpdate = true;
  const toon = (hex) => new THREE.MeshToonMaterial({ color: col(hex), gradientMap: grad });

  const inkMat = (w) => new THREE.ShaderMaterial({
    uniforms: { w: { value: w } },
    vertexShader: 'uniform float w;void main(){vec3 p=position+normalize(normal)*w;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
    fragmentShader: 'void main(){gl_FragColor=vec4(0.07,0.07,0.05,1.0);}',
    side: THREE.BackSide,
  });
  const part = (geo, mat, w = 0.03) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat));
    if (w) g.add(new THREE.Mesh(geo, inkMat(w)));
    return g;
  };

  const root = new THREE.Group(); scene.add(root);
  root.rotation.y = yaw0;
  const tilt = new THREE.Group(); root.add(tilt);        // goyangan seluruh tas
  tilt.position.y = 0;

  const model = buildBagModel(THREE, toon, part);
  tilt.add(model.bag);

  /* ---------------- Bayangan di tanah ---------------- */
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const cx = sc.getContext('2d');
  const gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(20,28,8,0.45)'); gr.addColorStop(0.55, 'rgba(20,28,8,0.18)'); gr.addColorStop(1, 'rgba(20,28,8,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sc);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.4),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
  scene.add(shadow);

  /* ---------------- Framing ---------------- */
  const FIT_W = 2.9, FIT_H = 5.5;
  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(FIT_H / (2 * t), FIT_W / (2 * t * (w / h)));
    camera.position.copy(TARGET).addScaledVector(HOME_DIR, d);
    camera.lookAt(TARGET);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  /* ---------------- Animasi ---------------- */
  let wobbleStart = -10;
  const wobble = () => {
    const t = performance.now() / 1000;
    if (t - wobbleStart > 0.6) wobbleStart = t;
  };
  let yaw = yaw0;
  const setYaw = (v) => { yaw = v; };
  const phase = Math.random() * 6;
  let first = true;

  function render(now) {
    const t = now + phase;
    const wp = (now - wobbleStart) / 0.6;
    const wob = wp >= 0 && wp < 1 ? Math.sin(wp * Math.PI * 4) * (1 - wp) : 0;

    root.rotation.y += (yaw - root.rotation.y) * 0.2;
    tilt.rotation.z = Math.sin(t * 0.9) * 0.012 * amp + wob * 0.07;
    tilt.rotation.x = Math.sin(t * 0.7 + 1) * 0.008 * amp;
    model.update(t, wob, amp);

    renderer.render(scene, camera);
    if (first) { first = false; canvas.classList.add('is-ready'); }
  }

  function dispose() {
    instances.delete(inst);
    ro.disconnect();
    scene.traverse((o) => {
      o.geometry?.dispose();
      const m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose(); x.dispose(); });
    });
    grad.dispose(); shadowTex.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  const inst = { el, seen: false, born: performance.now(), render, dispose, wobble, setYaw };
  return inst;
}
