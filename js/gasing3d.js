// ============================================================
//  GASING 3D  ("Saucer Sprout")
//  Dipindahkan dari saucer-sprout.html (three r128 → r160),
//  versi terbaru: + sarung tangan melayang, warna bawah lebih cokelat.
//  Dipakai di semua scene 2D menggantikan gasing.png.
//
//  const g = createGasing3D({ label, className, yaw, bag });
//  parent.append(g);   // g.hop() → gasing meloncat (tas ikut terayun)
//                      // g.wobble() → senggol tas saja
//                      // g.turnTo(rad) → badan berputar halus ke yaw ini (0 = menghadap penonton, π = membelakangi)
//                      // g.setState('idle' | 'walk' | 'eat') → gerak sarung tangan per state
//                      //   (idle: jari bernapas, walk: lengan berayun, eat: menyendok;
//                      //    hop = overlay: tangan terlempar naik saat meloncat)
//
//  - Tiap gasing punya canvas transparan sendiri; renderer otomatis
//    dibuang saat elemennya dilepas dari halaman (pergantian scene).
//  - bag: true → Gasing MENJINJING tas tenis + raket di sarung tangan kirinya. Tas ada di scene
//    yang sama, jadi ikut melayang bersama sarung tangan, berayun seperti bandul, dan ikut memudar.
//  - Kalau WebGL / CDN three gagal → otomatis kembali ke gasing.png (+ gambar tas kalau bag).
// ============================================================
import { CONFIG } from './config.js';
import { slot } from './assets.js';
import { buildBagModel, BAG_DIMS } from './bag3d.js';

// Framing & posisi sarung tangan kiri (satuan model) — dipakai mount() dan bagMouthOffset()
const FIT_W = 5.3, FIT_H = 5.5, TARGET_Y = 0.55;
const LEFT_HAND = { x: -3.1, y: 0.8 };
const BAG_S = 0.75;                             // skala model tas relatif ke Gasing
const BAG_GRIP = { x: -0.3, y: -0.05, z: -0.1 };   // titik genggam relatif ke pusat sarung tangan kiri
const BAG_FLOOR_Y = -2.09 + 2.625;                  // tinggi titik genggam saat tas diletakkan di tanah (dasar tas = (BH + HANDLE_H) × BAG_S di bawahnya)
// Properti makan (posisi dalam ruang lokal sarung tangan): mangkuk bertumpu di telapak kiri, sendok digenggam kanan
// Pose makan: offset DUNIA dari posisi istirahat sarung tangan (x + = ke kanan layar, z + = ke arah penonton).
// Sendok bolak-balik mangkuk ⇄ mulut; mangkuk ditahan tangan kiri di depan perut.
const EAT = {
  w: 4.4,
  spoon: { scoop: { x: -2.45, y: -1.65, z: 2.1, rz: 1.35 }, mouth: { x: -2.6, y: -1.05, z: 2.1, rz: 0.7 } },
  bowl: { x: 2.55, y: -1.75, z: 2.1, rz: -0.1 },
};
const PROP = {
  bowl: { x: 0.3, y: 0.8, z: -0.1, rx: 0.5, s: 1.05 },
  spoon: { x: 0, y: 0, z: 0.05, rz: 0 },
};

/**
 * Posisi mulut tas (tempat bola tenis keluar) relatif terhadap kotak elemen Gasing yang membawa tas.
 * Satuan = tinggi elemen: x dari TENGAH elemen (kanan = +), y dari DASAR elemen (atas = +).
 * @param {number} [aspect] lebar/tinggi elemen
 */
export function bagMouthOffset(aspect = 1000 / 1193) {
  const vis = Math.max(FIT_H, FIT_W / aspect);   // tinggi pandang (satuan model) setelah framing
  const x = LEFT_HAND.x + BAG_GRIP.x - BAG_DIMS.HANDLE_X * BAG_S;
  const y = LEFT_HAND.y + BAG_GRIP.y - BAG_DIMS.HANDLE_H * BAG_S;
  return { x: x / vis, y: (y - (TARGET_Y - vis / 2)) / vis };
}

let threePromise;
const loadThree = () => (threePromise ??= import('three'));

const instances = new Set();
let raf = 0;

function loop() {
  raf = 0;
  const now = performance.now();
  for (const inst of instances) {
    if (!inst.el.isConnected) {
      // belum sempat dipasang (≤ 8 detik) → tunggu; sudah pernah dipasang lalu dilepas → buang
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
 * @param {string} [o.className]  class tambahan (mis. 's1-gasing')
 * @param {number} [o.yaw]        radian; > 0 = badan menghadap sedikit ke kanan layar
 * @param {boolean} [o.bag]       true → menjinjing tas tenis + raket di sarung tangan kiri
 */
export function createGasing3D({ label = 'Karakter Gasing', className = '', yaw = 0, bag = false } = {}) {
  const el = document.createElement('div');
  el.className = `gasing gasing3d ${className}`.trim();
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  el.hop = () => {};
  el.wobble = () => {};
  el.turnTo = () => {};
  let pendingState = 'idle';   // setState sebelum model 3D siap
  el.setState = (s) => { pendingState = s; };

  const showFallback = () => {
    el.classList.add('is-fallback');
    const img = new Image();
    img.src = CONFIG.assets.gasing;
    img.alt = label;
    img.draggable = false;
    el.replaceChildren(img);
    if (bag) el.append(slot({ src: CONFIG.assets.s3_tas, label: 'Tas + raket tenis', className: 'gasing-bag-fallback' }));
  };

  loadThree()
    .then((THREE) => {
      const inst = mount(THREE, el, yaw, bag);
      if (!inst) return showFallback();
      el.hop = inst.hop;
      el.wobble = inst.wobble;
      el.turnTo = inst.turnTo;
      el.setState = inst.setState;
      if (pendingState !== 'idle') inst.setState(pendingState);
      instances.add(inst);
      ensureLoop();
    })
    .catch((err) => { console.warn('Gasing 3D gagal, pakai gambar 2D:', err); showFallback(); });

  return el;
}

/* ------------------------------------------------------------
   Membangun model + renderer untuk satu elemen
------------------------------------------------------------ */
function mount(THREE, el, yaw, withBag = false) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch { return null; }

  // Model ini dibuat di three r128 (tanpa color management & lampu "legacy").
  // Supaya tampilannya persis sama di r160: warna & output linear, intensitas lampu × π.
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
  const TARGET = new V3(0, TARGET_Y, 0);
  const HOME_DIR = new V3(1.5, 1.35, 8.2).normalize();
  scene.add(camera);

  // Cahaya ikut kamera → shading kartun selalu seperti gambar aslinya (terang dari kiri atas)
  scene.add(new THREE.AmbientLight(0xffffff, 0.38 * Math.PI));
  const key = new THREE.DirectionalLight(0xffffff, 0.72 * Math.PI);
  key.position.set(-4, 5, 4);
  camera.add(key);

  // Toon ramp: nada bayangan, nada badan, pita highlight tipis
  const ramp = [120, 120, 120, 120, 225, 225, 225, 255];
  const rampData = new Uint8Array(ramp.length * 4);
  ramp.forEach((v, i) => { rampData.set([v, v, v, 255], i * 4); });
  const grad = new THREE.DataTexture(rampData, ramp.length, 1, THREE.RGBAFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter;
  grad.generateMipmaps = false;
  grad.needsUpdate = true;
  const toon = (hex) => new THREE.MeshToonMaterial({ color: col(hex), gradientMap: grad });

  // Garis tinta: sisi belakang didorong keluar sepanjang normal
  const inkMat = (w) => new THREE.ShaderMaterial({
    uniforms: { w: { value: w } },
    vertexShader: 'uniform float w;void main(){vec3 p=position+normalize(normal)*w;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
    fragmentShader: 'void main(){gl_FragColor=vec4(0.07,0.07,0.05,1.0);}',
    side: THREE.BackSide,
  });
  const part = (geo, mat, w) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat));
    if (w) g.add(new THREE.Mesh(geo, inkMat(w)));
    return g;
  };

  // Tabung yang radiusnya berubah sepanjang kurva
  function taperTube(points, radiusAt, tubSeg = 64, radSeg = 28) {
    const curve = new THREE.CatmullRomCurve3(points);
    const fr = curve.computeFrenetFrames(tubSeg, false);
    const pos = [], nor = [], idx = [];
    for (let i = 0; i <= tubSeg; i++) {
      const t = i / tubSeg, P = curve.getPointAt(t), r = radiusAt(t);
      const N = fr.normals[i], B = fr.binormals[i];
      for (let j = 0; j <= radSeg; j++) {
        const a = (j / radSeg) * Math.PI * 2, s = Math.sin(a), c = -Math.cos(a);
        const nx = c * N.x + s * B.x, ny = c * N.y + s * B.y, nz = c * N.z + s * B.z;
        nor.push(nx, ny, nz);
        pos.push(P.x + r * nx, P.y + r * ny, P.z + r * nz);
      }
    }
    for (let i = 1; i <= tubSeg; i++) {
      for (let j = 1; j <= radSeg; j++) {
        const a = (radSeg + 1) * (i - 1) + (j - 1), b = (radSeg + 1) * i + (j - 1);
        const c = (radSeg + 1) * i + j, d = (radSeg + 1) * (i - 1) + j;
        idx.push(a, b, d, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    g.userData.end = curve.getPointAt(1);
    g.userData.start = curve.getPointAt(0);
    return g;
  }
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  const GREEN = 0xB3D34E, LIP = 0xBCD95A, UNDER = 0x5B401A, EYE = 0xFFFDF0, PUPIL = 0x383232;

  const root = new THREE.Group(); scene.add(root);   // hop + naik-turun
  root.rotation.y = yaw;
  const body = new THREE.Group(); root.add(body);    // kemiringan badan
  body.rotation.set(0.1, 0, 0.14);

  // ---- Kubah: bulb yang menyempit jadi leher, condong ke belakang
  const prof = new THREE.SplineCurve([
    [1.62, -0.06], [1.5, 0.14], [1.3, 0.34], [1.12, 0.55], [0.98, 0.76], [0.84, 0.98], [0.68, 1.16],
    [0.52, 1.3], [0.4, 1.42], [0.3, 1.5], [0.2, 1.55], [0.0, 1.58],
  ].map((p) => new THREE.Vector2(p[0], p[1] < 0.3 ? p[1] : 0.3 + (p[1] - 0.3) * 1.22))).getPoints(70);
  const SEG = 80;
  const domeGeo = new THREE.LatheGeometry(prof, SEG);
  {
    const pa = domeGeo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      pa.setXYZ(i, x * 1.06, y, z - 0.34 * ss(0.2, 1.83, y));
    }
    domeGeo.computeVertexNormals();
    // sambungkan normal di sambungan lathe supaya garis tinta tidak retak
    const na = domeGeo.attributes.normal, P = prof.length, n = new V3();
    for (let j = 0; j < P; j++) {
      const i0 = j, i1 = SEG * P + j;
      n.set(na.getX(i0) + na.getX(i1), na.getY(i0) + na.getY(i1), na.getZ(i0) + na.getZ(i1)).normalize();
      na.setXYZ(i0, n.x, n.y, n.z); na.setXYZ(i1, n.x, n.y, n.z);
    }
  }
  body.add(part(domeGeo, toon(GREEN), 0.03));

  // ---- Bibir bergulung di sekeliling kubah
  const lipGeo = new THREE.TorusGeometry(1.62, 0.38, 32, 140);
  lipGeo.rotateX(Math.PI / 2);
  lipGeo.scale(1.13, 0.72, 1.0);
  const lip = part(lipGeo, toon(LIP), 0.03);
  lip.position.y = 0.04;
  body.add(lip);

  // ---- Bagian bawah yang gelap
  const underGeo = new THREE.SphereGeometry(1, 72, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  underGeo.scale(2.0, 1.2, 1.75);
  const under = part(underGeo, toon(UNDER), 0.03);
  under.position.y = -0.04;
  body.add(under);

  // ---- Tanduk melengkung di atas, melebar sedikit di pangkal
  const hornPts = [[0, 1.18, -0.3], [-0.06, 1.55, -0.38], [-0.2, 1.9, -0.5], [-0.4, 2.18, -0.62], [-0.6, 2.36, -0.7]]
    .map((p) => new V3(p[0], 0.3 + (p[1] - 0.3) * 1.22, p[2]));
  const hornBase = hornPts[0].clone();
  const hornGeo = taperTube(hornPts, (t) => 0.335 + (0.1 - 0.335) * Math.pow(t, 0.85) + 0.2 * Math.exp(-t * 8), 90, 32);
  hornGeo.translate(-hornBase.x, -hornBase.y, -hornBase.z);
  const hornTipGeo = new THREE.SphereGeometry(0.1, 24, 16);
  const hornPivot = new THREE.Group();
  hornPivot.position.copy(hornBase);
  hornPivot.add(part(hornGeo, toon(GREEN), 0.028));
  const tip = part(hornTipGeo, toon(GREEN), 0.028);
  tip.position.copy(hornGeo.userData.end).sub(hornBase);
  hornPivot.add(tip);
  body.add(hornPivot);

  // ---- Satu kaki, melebar sedikit saat keluar dari mangkuk
  const legPts = [[0, -1.0, 0.15], [0, -1.3, 0.15], [0, -1.6, 0.15], [0, -1.83, 0.15]].map((p) => new V3(p[0], p[1], p[2]));
  const legBase = legPts[0].clone();
  const legGeo = taperTube(legPts, (t) => 0.22 - 0.03 * t + 0.13 * Math.exp(-t * 9), 48, 28);
  legGeo.translate(-legBase.x, -legBase.y, -legBase.z);
  const legPivot = new THREE.Group();
  legPivot.position.copy(legBase);
  legPivot.add(part(legGeo, toon(GREEN), 0.028));
  const foot = part(new THREE.SphereGeometry(0.19, 28, 18), toon(GREEN), 0.028);
  foot.position.copy(legGeo.userData.end).sub(legBase);
  legPivot.add(foot);
  body.add(legPivot);

  // ---- Mata, diletakkan dengan raycast ke permukaan kubah
  const probe = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial());
  probe.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  function surf(x, y) {
    ray.set(new V3(x, y, 5), new V3(0, 0, -1));
    const hit = ray.intersectObject(probe)[0];
    return hit ? { p: hit.point.clone(), n: hit.face.normal.clone().normalize() } : { p: new V3(x, y, 0.8), n: new V3(0, 0, 1) };
  }
  const EA = 0.39, EB = 0.575, EC = 0.27;
  const eyeGeo = new THREE.SphereGeometry(1, 48, 32); eyeGeo.scale(EA, EB, EC);
  const pupilGeo = new THREE.SphereGeometry(1, 28, 20); pupilGeo.scale(0.2, 0.25, 0.12);
  const eyeMat = toon(EYE), pupilMat = toon(PUPIL);
  const browMat = new THREE.MeshBasicMaterial({ color: col(0x121210) });
  const glintMat = new THREE.MeshBasicMaterial({ color: col(0xffffff) });
  const browGeo = taperTube(
    [[-0.15, 0.71, 0.2], [-0.07, 0.79, 0.27], [0.05, 0.8, 0.27], [0.14, 0.73, 0.2]].map((p) => new V3(p[0], p[1], p[2])),
    (t) => 0.045 - 0.022 * t, 32, 16);
  const browCapA = new THREE.SphereGeometry(0.045, 16, 12), browCapB = new THREE.SphereGeometry(0.023, 12, 10);
  const glintGeo = new THREE.SphereGeometry(0.048, 20, 14);

  const eyes = [];
  const _n = new V3();
  function placePupil(e) {
    let [u, v] = e.gaze; const L = Math.hypot(u, v); if (L > 1) { u /= L; v /= L; }
    const x = u * EA * 0.55, y = v * EB * 0.55;
    const z = EC * Math.sqrt(Math.max(0, 1 - (x / EA) ** 2 - (y / EB) ** 2));
    _n.set(x / (EA * EA), y / (EB * EB), z / (EC * EC)).normalize();
    e.pupil.position.set(x, y, z).addScaledVector(_n, 0.035);
    e.pupil.quaternion.setFromUnitVectors(new V3(0, 0, 1), _n);
  }
  function makeEye(sx, sy, roll, gaze) {
    const s = surf(sx, sy);
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), s.n);
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(s.n, roll));
    const anchor = new THREE.Group();
    anchor.position.copy(s.p).addScaledVector(s.n, -0.12);
    anchor.quaternion.copy(q);
    body.add(anchor);

    const lid = new THREE.Group(); anchor.add(lid);   // berkedip
    lid.add(part(eyeGeo, eyeMat, 0.026));
    const pupil = part(pupilGeo, pupilMat, 0.014);
    lid.add(pupil);
    const glint = new THREE.Mesh(glintGeo, glintMat);   // kilau bulat di kanan atas pupil
    glint.scale.z = 0.5;
    glint.position.set(0.08, 0.1, 0.1);
    pupil.add(glint);

    const brow = new THREE.Group(); anchor.add(brow);
    brow.add(new THREE.Mesh(browGeo, browMat));
    const ca = new THREE.Mesh(browCapA, browMat); ca.position.copy(browGeo.userData.start); brow.add(ca);
    const cb = new THREE.Mesh(browCapB, browMat); cb.position.copy(browGeo.userData.end); brow.add(cb);

    const e = { anchor, lid, pupil, brow, gaze: gaze.slice() };
    eyes.push(e);
    placePupil(e);
  }
  makeEye(-0.47, 1.1, 0, [0, 0]);
  makeEye(0.49, 1.1, 0, [0, 0]);

  // ---- Mulut: senyum kecil di kubah, di bawah mata
  {
    const s = surf(0.02, 0.56);
    const anchor = new THREE.Group();
    anchor.position.copy(s.p);
    anchor.quaternion.setFromUnitVectors(new V3(0, 0, 1), s.n);
    const pts = [[-0.24, 0.05, -0.01], [-0.12, -0.02, 0.03], [0.0, -0.045, 0.045], [0.12, -0.02, 0.03], [0.24, 0.05, -0.01]]
      .map((p) => new V3(p[0], p[1], p[2]));
    anchor.add(new THREE.Mesh(taperTube(pts, (t) => 0.032 - 0.01 * Math.abs(t - 0.5), 40, 14), browMat));
    const capGeo = new THREE.SphereGeometry(0.027, 12, 10);
    [pts[0], pts[4]].forEach((p) => {
      const c = new THREE.Mesh(capGeo, browMat);
      c.position.copy(p); anchor.add(c);
    });
    body.add(anchor);
  }

  // ---- Sarung tangan kartun yang melayang (telapak, jempol, tiga jari, manset), tidak menempel ke badan
  function makeHand() {
    const g = new THREE.Group();
    const mat = toon(0xE6E8E9), W = 0.075;
    const palmGeo = new THREE.SphereGeometry(1, 40, 28); palmGeo.scale(0.46, 0.4, 0.25);
    g.add(part(palmGeo, mat, W));
    // Tiap jari punya pivot di pangkalnya → bisa ditekuk (rotasi z; + = menekuk ke telapak)
    const digits = [];
    const digit = (pts, r0, r1) => {
      const base = new V3(pts[0][0], pts[0][1], pts[0][2]);
      const geo = taperTube(pts.map((p) => new V3(p[0], p[1], p[2]).sub(base)), (t) => r0 + (r1 - r0) * t, 40, 20);
      const pivot = new THREE.Group();
      pivot.position.copy(base);
      pivot.add(part(geo, mat, W));
      const cap = part(new THREE.SphereGeometry(r1, 20, 14), mat, W);
      cap.position.copy(geo.userData.end); pivot.add(cap);
      g.add(pivot);
      digits.push(pivot);
    };
    digit([[0.12, 0.18, 0], [0.2, 0.45, 0], [0.17, 0.78, 0]], 0.17, 0.13);          // jempol, berdiri
    digit([[-0.18, 0.14, 0], [-0.42, 0.3, 0], [-0.66, 0.42, 0]], 0.14, 0.105);      // jari atas
    digit([[-0.2, 0.0, 0], [-0.5, 0.05, 0], [-0.8, 0.06, 0]], 0.14, 0.105);         // jari tengah
    digit([[-0.18, -0.14, 0], [-0.46, -0.2, 0], [-0.74, -0.26, 0]], 0.14, 0.105);   // jari bawah
    g.userData.digits = digits;
    // manset di pergelangan
    const dir = new V3(0.62, -0.78, 0).normalize();
    const cuff = part(new THREE.CylinderGeometry(0.27, 0.31, 0.22, 36, 1, false), toon(0xEEF0F0), W);
    cuff.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
    cuff.position.copy(dir).multiplyScalar(0.5);
    g.add(cuff);
    return g;
  }
  // ---- Properti makan soto: mangkuk (tangan kiri) & sendok (tangan kanan), muncul hanya di state 'eat'
  function makeBowl() {
    const g = new THREE.Group();
    const cer = toon(0xF3EDDD), W = 0.03;
    const bowlGeo = new THREE.SphereGeometry(1, 44, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    bowlGeo.scale(0.66, 0.46, 0.66);
    g.add(part(bowlGeo, cer, W));
    const rim = part(new THREE.TorusGeometry(0.66, 0.045, 14, 48).rotateX(Math.PI / 2), cer, W);
    g.add(rim);
    const foot = part(new THREE.CylinderGeometry(0.26, 0.3, 0.07, 24), toon(0xC9B58F), W);
    foot.position.y = -0.47;
    g.add(foot);
    const band = part(new THREE.TorusGeometry(0.6, 0.022, 10, 48).rotateX(Math.PI / 2), toon(0x2F6F8F), 0);
    band.position.y = -0.1;
    g.add(band);
    // kuah soto + daun bawang & irisan telur
    const broth = new THREE.Mesh(new THREE.CircleGeometry(0.61, 36).rotateX(-Math.PI / 2), toon(0xE9B23C));
    broth.position.y = -0.06;
    g.add(broth);
    const bit = (x, z, hex, r) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), toon(hex));
      m.scale.y = 0.45; m.position.set(x, -0.045, z); g.add(m);
    };
    bit(-0.2, 0.1, 0x6FA33A, 0.07); bit(0.12, -0.18, 0x6FA33A, 0.06); bit(0.25, 0.2, 0x6FA33A, 0.07);
    bit(-0.05, -0.05, 0xFFF4D0, 0.17);
    bit(-0.05, -0.05, 0xF1B52F, 0.07);
    return g;
  }
  function makeSpoon() {
    const g = new THREE.Group();
    const met = toon(0xD9DFE3), W = 0.03;
    const handleGeo = new THREE.CylinderGeometry(0.045, 0.06, 1.15, 14);
    const handle = part(handleGeo, met, W);
    handle.position.y = 0.05;
    g.add(handle);
    const headGeo = new THREE.SphereGeometry(1, 28, 18); headGeo.scale(0.25, 0.34, 0.08);
    const head = part(headGeo, met, W);
    head.position.y = 0.8;
    g.add(head);
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), toon(0xE9B23C));   // kuah di sendok
    scoop.scale.set(0.13, 0.2, 0.03); scoop.position.set(0, 0.81, 0.075);
    g.add(scoop);
    return g;
  }

  const hands = [];
  [[-1, LEFT_HAND.x, LEFT_HAND.y, 0.2], [1, 3.1, 1.0, 2.4]].forEach(([side, x, y, ph]) => {
    const g = makeHand();
    g.scale.set(-side * 0.95, 0.95, 0.95);   // sarung tangan kanan = cermin dari referensi
    g.position.set(x, y, 0.5);
    scene.add(g);
    // mangkuk di tangan kiri, sendok di tangan kanan (disembunyikan sampai state 'eat')
    const prop = side < 0 ? makeBowl() : makeSpoon();
    if (side < 0) { prop.position.set(PROP.bowl.x, PROP.bowl.y, PROP.bowl.z); prop.rotation.set(PROP.bowl.rx, 0, 0); }
    else { prop.position.set(PROP.spoon.x, PROP.spoon.y, PROP.spoon.z); prop.rotation.set(0, 0, PROP.spoon.rz); }
    prop.visible = false;
    g.add(prop);
    // pegas posisi/rotasi (lembut, sedikit mengikuti)
    const S = () => ({ p: 0, v: 0 });
    hands.push({
      g, side, bx: x, by: y, ph, digits: g.userData.digits, prop, propW: 0, ready: 0, sp: { x: S(), y: S(), z: S(), rz: S() }, curl: 0.08, wag: 0.1, init: false,
    });
  });
  // State karakter (setState): 'idle' | 'walk' | 'eat' → menentukan gerak sarung tangan
  let stateName = 'idle', wWalk = 0, wEat = 0;
  const setState = (s) => { stateName = s; };
  let yawTarget = yaw;
  const turnTo = (a) => { yawTarget = a; };
  // pegas kritis-ringan: ω≈15 rad/s, ζ≈0.8 (substep supaya stabil di frame lambat)
  const K_SPR = 225, C_SPR = 24;
  const spring = (S, target, dt) => {
    const n = Math.ceil(dt / 0.01), h = dt / n;
    for (let i = 0; i < n; i++) { S.v += ((target - S.p) * K_SPR - S.v * C_SPR) * h; S.p += S.v * h; }
    return S.p;
  };
  const sstep = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const mix = (a, b, u) => a + (b - a) * u;

  // ---- Bayangan lembut di tanah
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const cx = sc.getContext('2d');
  const gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(20,28,8,0.42)'); gr.addColorStop(0.55, 'rgba(20,28,8,0.16)'); gr.addColorStop(1, 'rgba(20,28,8,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sc);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 3.6),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -2.1;
  scene.add(shadow);

  // ---- Tas tenis yang dijinjing sarung tangan kiri (opsional).
  // Rantai: swing (titik genggam, ikut sarung tangan, berayun seperti bandul) → yawG → bagG (skala) → tas.
  // Tali jinjing di tas dipegang tepat di titik genggam, jadi tas menggantung dari tangan.
  let carry = null;
  if (withBag) {
    const model = buildBagModel(THREE, toon, part, { handle: true, inkMul: 1 / BAG_S });
    const swing = new THREE.Group();
    const yawG = new THREE.Group();
    const bagG = new THREE.Group();
    bagG.scale.setScalar(BAG_S);
    bagG.position.set(-BAG_DIMS.HANDLE_X, -(BAG_DIMS.BH + BAG_DIMS.HANDLE_H), 0).multiplyScalar(BAG_S);
    bagG.add(model.bag); yawG.add(bagG); swing.add(yawG); scene.add(swing);
    const bagShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 1.5),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    bagShadow.rotation.x = -Math.PI / 2; bagShadow.position.y = -2.09;
    scene.add(bagShadow);
    carry = { model, swing, yawG, bagG, bagShadow, th: 0, om: 0, px: null, pvx: 0, wobAt: -10, phase: 'held', phT: 0, restX: 0, restZ: 0, wGround: 0 };
  }

  // ---- Framing: badan utuh selalu pas di dalam kotak elemen.
  // Sarung tangan melayang jauh di samping badan, jadi canvas dibuat SPAN× lebih lebar dari elemen
  // (di-tengah-kan, boleh keluar kotak) — ukuran badan tetap sama seperti tanpa sarung tangan.
  // Dengan tas, sisi kiri butuh ruang lebih untuk tas yang berayun.
  const SPAN = withBag ? 2.5 : 2.3;
  // Ruang ekstra di atas/bawah elemen supaya loncatan (tanduk + sarung tangan terangkat) tidak terpotong.
  // Skala & posisi badan tetap sama persis: kamera hanya diberi view offset ke area yang lebih tinggi.
  const PAD_T = 0.55, PAD_B = 0.1, VS = 1 + PAD_T + PAD_B;
  canvas.style.width = `${SPAN * 100}%`;
  canvas.style.height = `${VS * 100}%`;
  canvas.style.maxWidth = 'none';
  canvas.style.marginLeft = `${-((SPAN - 1) / 2) * 100}%`;
  canvas.style.marginTop = `${-PAD_T * 100}%`;
  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    const cw = Math.round(w * SPAN);
    // canvas kini lebih besar dari elemen → batasi jumlah piksel supaya tetap ringan di layar HiDPI
    renderer.setPixelRatio(Math.max(0.75, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(1.5e6 / (w * SPAN * h * VS)))));
    renderer.setSize(cw, Math.round(h * VS), false);
    camera.aspect = (w * SPAN) / h;
    camera.setViewOffset(w * SPAN, h, 0, -PAD_T * h, w * SPAN, h * VS);
    camera.updateProjectionMatrix();
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(FIT_H / (2 * t), FIT_W / (2 * t * (w / h)));
    camera.position.copy(TARGET).addScaledVector(HOME_DIR, d);
    camera.lookAt(TARGET);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  // ---- Animasi
  let hopStart = -10;
  // Senggol tas: bandul diberi dorongan + raket bergoyang di dalam tas
  const wobble = () => {
    if (!carry) return;
    carry.om += (carry.om > 0 ? -1 : 1) * 2.6;
    carry.wobAt = performance.now() / 1000;
  };
  const hop = () => {
    const t = performance.now() / 1000;
    if (t - hopStart > 0.75) { hopStart = t; wobble(); }
  };
  let lastNow = null;
  let nextBlink = 1.2 + Math.random() * 1.5, blinkAt = -1;
  const look = new V3(), local = new V3();
  const lookDir = camera.position.clone().sub(TARGET).normalize();
  const phase = Math.random() * 6; // supaya dua gasing tidak bergerak kompak
  let first = true;

  function render(now) {
    const t = now + phase;
    const dt = lastNow == null ? 0.016 : Math.min(0.1, Math.max(0.001, now - lastNow));
    lastNow = now;
    const hp = (now - hopStart) / 0.75;
    let hy = 0, sq = 0;
    if (hp >= 0 && hp < 1) {
      hy = Math.sin(hp * Math.PI) * 0.9;
      sq = hp < 0.12 ? -Math.sin((hp / 0.12) * Math.PI) * 0.12 : Math.sin(((hp - 0.12) / 0.88) * Math.PI) * 0.08 * (1 - hp);
    }
    root.position.y = Math.sin(t * 1.5) * 0.09 * amp + hy;
    root.position.x = Math.sin(t * 0.5) * 0.06 * amp;
    root.rotation.y += (yawTarget - root.rotation.y) * (1 - Math.exp(-dt * 6));   // berputar halus (turnTo)

    // bobot tiap state (halus berpindah): idle = sisanya
    const kS = 1 - Math.exp(-dt * 7);
    wWalk += ((stateName === 'walk' ? 1 : 0) - wWalk) * kS;
    wEat += ((stateName === 'eat' ? 1 : 0) - wEat) * kS;
    const wIdle = Math.max(0, 1 - wWalk - wEat);
    const hpOn = hp >= 0 && hp < 1;
    const jUp = hpOn ? Math.sin(hp * Math.PI) : 0;                                     // tangan terangkat saat meloncat
    const jLand = hpOn && hp > 0.7 ? Math.sin(((hp - 0.7) / 0.3) * Math.PI) : 0;       // tangan turun sedikit saat mendarat
    const wp0 = carry ? (now - carry.wobAt) / 0.6 : -1;
    const wShake = wp0 >= 0 && wp0 < 1 ? Math.sin(wp0 * Math.PI * 4) * (1 - wp0) : 0;  // sarung tangan kiri tersentak saat tas disenggol

    // ---- Tas: fase "diletakkan" saat makan, "diangkat lagi" setelahnya (hanya kalau membawa tas)
    //   held → lowering (tangan turun, tas menyentuh tanah) → down (tangan bebas pegang mangkuk) → raising → held
    let reach = 0, wGround = 0, bagDown = false;
    if (carry) {
      const C = carry, want = stateName === 'eat';
      if (want && (C.phase === 'held' || C.phase === 'raising')) {
        if (C.phase === 'held') { C.restX = C.swing.position.x; C.restZ = C.swing.position.z; }
        C.phase = 'lowering'; C.phT = now;
      } else if (!want && (C.phase === 'down' || C.phase === 'lowering')) {
        C.phase = 'raising'; C.phT = now;
      }
      const e = now - C.phT;
      if (C.phase === 'lowering') {
        reach = 1; wGround = sstep(0.3, 0.58, e);
        if (e >= 0.62) C.phase = 'down';
      } else if (C.phase === 'down') {
        wGround = 1; bagDown = true;
      } else if (C.phase === 'raising') {
        reach = e < 0.55 ? 1 : 0; wGround = 1 - sstep(0.5, 0.8, e);
        if (e >= 0.9) C.phase = 'held';
      }
      C.wGround = wGround;
    }
    const kProp = 1 - Math.exp(-dt * 10);

    hands.forEach((H, hi) => {
      const p = H.ph, s = H.side;
      const holdBag = !!carry && hi === 0;          // tangan kiri memegang tas → geraknya lebih tertahan
      const calm = holdBag ? 0.35 : 1;
      let tx = 0, ty = 0, tz = 0, trz = 0, curl = 0.08, wag = 0.1;

      // idle: melayang pelan & jari bergerak seperti bernapas (kecil saja — tangan harus terasa "menempel" ke badan)
      tx += Math.sin(t * 0.9 + p) * 0.05 * amp;
      ty += (Math.sin(t * 1.25 + p) * 0.1 + Math.sin(t * 0.6 + p * 2) * 0.05) * amp;
      tz += Math.sin(t * 0.8 + p) * 0.08 * amp;

      // walk: lengan berayun berlawanan, seirama langkah (±0.8 detik per loncatan kecil)
      if (wWalk > 0.001) {
        const ph = t * 7.85 + (s > 0 ? 0 : Math.PI);
        const sw = Math.sin(ph) * amp * calm;
        tx += -s * wWalk * sw * 0.3;
        ty += wWalk * (0.5 - 0.5 * Math.cos(2 * ph)) * 0.14 * amp * calm;   // sin² → mulus, tanpa patahan
        tz += wWalk * sw * 0.45;
        trz += wWalk * sw * 0.3;
        curl += wWalk * 0.16;
        wag = wag * (1 - wWalk) + 0.06 * wWalk;
      }

      // eat: kanan = sendok (mangkuk ⇄ mulut), kiri = mangkuk di depan perut
      // (kalau membawa tas: tas diletakkan dulu, baru tangan kiri memegang mangkuk)
      const bowlReady = holdBag ? (bagDown ? 1 : 0) : 1;
      H.ready += (bowlReady - H.ready) * kProp;
      const eW = wEat * (holdBag ? H.ready : 1);
      if (eW > 0.001) {
        if (s > 0) {
          const u = 0.5 - 0.5 * Math.cos(t * EAT.w) * (0.35 + 0.65 * amp);   // 0 = menyendok, 1 = ke mulut
          const A = EAT.spoon.scoop, B = EAT.spoon.mouth;
          tx += eW * mix(A.x, B.x, u); ty += eW * mix(A.y, B.y, u); tz += eW * mix(A.z, B.z, u);
          trz += eW * mix(A.rz, B.rz, u);
          curl += eW * 0.5;
        } else {
          tx += eW * EAT.bowl.x; ty += eW * EAT.bowl.y; tz += eW * EAT.bowl.z;
          trz += eW * EAT.bowl.rz;
          curl += eW * 0.35;
        }
        wag = wag * (1 - eW) + 0.05 * eW;
      }

      // hop: tangan terlempar naik & mengembang di udara (jari merentang), lalu turun saat mendarat
      const jAmp = (holdBag ? 0.5 : 1) * (1 - reach) * (1 - eW * 0.6);
      ty += (jUp * 0.6 - jLand * 0.18) * jAmp;
      tx += -s * -jUp * 0.25 * jAmp;
      trz += jUp * s * -0.3 * jAmp;
      curl -= jUp * 0.4 * jAmp;

      if (holdBag) { trz += wShake * 0.18; ty += wShake * 0.07; }

      // menggapai tas di tanah (meletakkan / mengangkat): genggaman tangan tepat di atas tali tas
      if (holdBag && reach > 0.001) {
        const C = carry;
        const rx = C.restX - BAG_GRIP.x - H.bx - root.position.x;
        const ry = BAG_FLOOR_Y - BAG_GRIP.y - H.by - root.position.y;
        const rz = C.restZ - BAG_GRIP.z - 0.5;
        tx = mix(tx, rx, reach); ty = mix(ty, ry, reach); tz = mix(tz, rz, reach);
        trz = mix(trz, 0, reach);
      }

      // pegas: gerak halus + sedikit mengikuti; badan membawa tangan secara kaku (tidak tertinggal)
      const sp = H.sp;
      if (!H.init) { H.init = true; sp.x.p = tx; sp.y.p = ty; sp.z.p = tz; sp.rz.p = trz; }
      const ox = spring(sp.x, tx, dt), oy = spring(sp.y, ty, dt), oz = spring(sp.z, tz, dt), orz = spring(sp.rz, trz, dt);
      H.g.position.set(H.bx + root.position.x + ox, H.by + root.position.y + oy, 0.5 + oz);
      H.g.rotation.set(Math.sin(t * 0.9 + p) * 0.06 * amp, Math.sin(t * 0.7 + p) * 0.1 * amp,
        s * -0.22 + orz + Math.sin(t * 1.1 + p) * 0.08 * amp);

      // jari: menekuk sesuai state (dihaluskan), dengan gelombang kecil beda fase tiap jari
      const kc = 1 - Math.exp(-dt * 9);
      H.curl += (curl - H.curl) * kc;
      H.wag += (wag - H.wag) * kc;
      H.digits.forEach((d, i) => {
        d.rotation.z = H.curl + Math.sin(t * 2.4 + p + i * 0.9) * H.wag * amp;
      });

      // properti: mangkuk / sendok muncul (membesar halus) hanya saat makan
      const propT = stateName === 'eat' ? (holdBag ? (bagDown ? 1 : 0) : 1) : 0;
      H.propW += (propT - H.propW) * kProp;
      H.prop.visible = H.propW > 0.02;
      H.prop.scale.setScalar(Math.max(0.001, sstep(0, 1, H.propW)) * (s < 0 ? PROP.bowl.s : 1));
    });

    // tas: menggantung dari genggaman sarung tangan kiri, berayun seperti bandul — atau diletakkan di tanah
    if (carry) {
      const L = hands[0].g, C = carry, w = C.wGround;
      C.swing.position.set(
        mix(L.position.x + BAG_GRIP.x, C.restX ?? 0, w),
        mix(L.position.y + BAG_GRIP.y, BAG_FLOOR_Y, w),
        mix(L.position.z + BAG_GRIP.z, C.restZ ?? 0, w));
      if (C.px == null || w > 0.98) { C.px = C.swing.position.x; C.pvx = 0; }
      const vx = (C.swing.position.x - C.px) / dt;
      const ax = Math.max(-30, Math.min(30, (vx - C.pvx) / dt));
      C.px = C.swing.position.x; C.pvx = vx;
      C.om += (-16 * C.th - 2.4 * C.om - 0.5 * ax) * dt;      // bandul teredam; tangan yang bergerak menyeret tas
      C.th += C.om * dt;
      if (w > 0.98) { C.th = 0; C.om = 0; }                    // sudah di tanah → diam
      const k = 1 - w;
      C.swing.rotation.z = (C.th + Math.sin(t * 1.1) * 0.025 * amp) * k;
      C.swing.rotation.x = Math.sin(t * 0.8 + 1) * 0.03 * amp * k;
      C.yawG.rotation.y = 0.3 + (Math.sin(t * 0.9 + 2) * 0.08 * amp + C.th * 0.5) * k;
      const wp = (now - C.wobAt) / 0.6;
      C.model.update(t, wp >= 0 && wp < 1 ? Math.sin(wp * Math.PI * 4) * (1 - wp) * k : 0, amp);
      C.bagG.getWorldPosition(local);
      C.bagShadow.position.x = local.x;
      C.bagShadow.position.z = local.z;
    }
    root.scale.set(1 - sq * 0.6, 1 + sq, 1 - sq * 0.6);
    body.rotation.z = 0.14 + Math.sin(t * 0.8) * 0.04 * amp;
    body.rotation.x = 0.1 + Math.sin(t * 0.6 + 1) * 0.03 * amp;
    hornPivot.rotation.z = Math.sin(t * 2.1) * 0.07 * amp - hy * 0.12;
    hornPivot.rotation.x = Math.sin(t * 1.7 + 0.5) * 0.04 * amp;
    legPivot.rotation.z = Math.sin(t * 2.4 + 1.3) * 0.05 * amp + (hp >= 0 && hp < 1 ? Math.sin(hp * Math.PI * 2) * 0.25 : 0);
    const lift = root.position.y;
    shadow.scale.setScalar(1 - lift * 0.35);
    shadow.material.opacity = Math.max(0.35, 1 - lift * 0.7);

    // alis naik saat meloncat
    const browUp = hp >= 0 && hp < 1 ? Math.sin(hp * Math.PI) * 0.12 : 0;
    eyes.forEach((e) => { e.brow.position.y = browUp; });

    // berkedip
    if (t > nextBlink) { blinkAt = t; nextBlink = t + 2.4 + Math.random() * 3.2; }
    const b = (t - blinkAt) / 0.16;
    const lidY = b >= 0 && b < 1 ? Math.max(0.08, Math.abs(Math.cos(b * Math.PI))) : 1;
    eyes.forEach((e) => { e.lid.scale.y = lidY; });

    root.updateMatrixWorld(true);

    // kedua mata selalu menatap lurus ke penonton (sejajar, tidak juling)
    look.copy(lookDir);
    eyes.forEach((e) => {
      e.anchor.getWorldPosition(local).addScaledVector(look, 60);
      e.anchor.worldToLocal(local).normalize();
      e.gaze[0] += (local.x * 1.8 - e.gaze[0]) * 0.12;
      e.gaze[1] += (local.y * 1.8 - e.gaze[1]) * 0.12;
      placePupil(e);
    });

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

  const inst = { el, seen: false, born: performance.now(), render, dispose, hop, wobble, setState, turnTo };
  return inst;
}
