import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const V3 = THREE.Vector3, Q = THREE.Quaternion, E = THREE.Euler;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setClearColor(0x000000, 0);
const col = (hex) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);

// ---------- scene / kamera / cahaya (sama dengan project: lampu ikut kamera) ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
scene.add(camera);
scene.add(new THREE.AmbientLight(0xffffff, 0.38 * Math.PI));
const key = new THREE.DirectionalLight(0xffffff, 0.72 * Math.PI);
key.position.set(-4, 5, 4); camera.add(key);

const ramp = [120, 120, 120, 120, 225, 225, 225, 255];
const rd = new Uint8Array(ramp.length * 4); ramp.forEach((v, i) => rd.set([v, v, v, 255], i * 4));
const grad = new THREE.DataTexture(rd, ramp.length, 1, THREE.RGBAFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
const toon = (hex) => new THREE.MeshToonMaterial({ color: col(hex), gradientMap: grad });
const inkMats = [];
const inkMat = (w) => { const m = new THREE.ShaderMaterial({
  uniforms: { w: { value: w } },
  vertexShader: 'uniform float w;void main(){vec3 p=position+normalize(normal)*w;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
  fragmentShader: 'void main(){gl_FragColor=vec4(0.07,0.07,0.05,1.0);}', side: THREE.BackSide }); inkMats.push(m); return m; };
const INKBASIC = new THREE.MeshBasicMaterial({ color: col(0x121210) });
const part = (geo, mat, w) => { const g = new THREE.Group(); g.add(new THREE.Mesh(geo, mat)); if (w) g.add(new THREE.Mesh(geo, inkMat(w))); return g; };

// ---------- SARUNG TANGAN (kerangka referensi = tangan kanan) ----------
// Sumbu lokal: +Y = arah jari, +X = sisi jempol, +Z = punggung tangan, jari menekuk ke −Z (telapak).
const WHITE = 0xE9EBEC, CUFF = 0xF1F2F2, INK = 0.055;
const FINGER = [  // telunjuk, tengah, manis — tiap jari 3 ruas (pangkal, tengah, ujung)
  { x: 0.30, y: 0.38, z: 0.00, L: [0.21, 0.17, 0.15], R: [0.158, 0.150, 0.140] },
  { x: 0.00, y: 0.41, z: 0.00, L: [0.24, 0.19, 0.16], R: [0.163, 0.155, 0.145] },
  { x: -0.30, y: 0.37, z: 0.00, L: [0.21, 0.17, 0.14], R: [0.153, 0.145, 0.135] },
];
const THUMB = { x: 0.30, y: 0.02, z: -0.26, L: [0.22, 0.20, 0.17], R: [0.170, 0.158, 0.140] };   // jempol: 3 ruas (metakarpal, pangkal, ujung)

// rantai 3 ruas: base → mid → tip (tiap pivot di sendi). Kapsul + bola sendi menutup sambungan.
function digit(parent, mat, o, ink) {
  const base = new THREE.Group(); base.position.set(o.x, o.y, o.z); parent.add(base);
  base.add(part(new THREE.SphereGeometry(o.R[0], 22, 16), mat, ink));                    // buku jari / pangkal
  const mk = (grp, i) => { const seg = part(new THREE.CapsuleGeometry(o.R[i], o.L[i], 8, 20), mat, ink); seg.position.y = o.L[i] / 2; grp.add(seg); };
  mk(base, 0);
  const crease = (grp, R) => { const m = new THREE.Mesh(new THREE.TorusGeometry(R * 1.0, 0.024, 8, 32).rotateX(Math.PI / 2), INKBASIC); grp.add(m); };
  const mid = new THREE.Group(); mid.position.y = o.L[0]; base.add(mid); mk(mid, 1); 
  const tip = new THREE.Group(); tip.position.y = o.L[1]; mid.add(tip); mk(tip, 2); if (o.crease) crease(tip, o.R[1]);
  return { base, mid, tip };
}

function makeGlove() {
  const mat = toon(WHITE), root = new THREE.Group();
  const wrist = new THREE.Group(); wrist.position.set(0, -0.52, 0); root.add(wrist);          // pivot di manset
  const hand = new THREE.Group(); hand.position.set(0, 0.52, 0); wrist.add(hand);
  const palmGeo = new THREE.SphereGeometry(1, 40, 28); palmGeo.scale(0.50, 0.47, 0.36);
  const palm = part(palmGeo, mat, INK); palm.position.y = 0.05; hand.add(palm);
  const fingers = FINGER.map((o) => digit(hand, mat, o, INK));
  const th = digit(hand, mat, THUMB, INK);
  // manset: bantal bulat yang diam di pergelangan (tidak ikut menekuk dengan telapak)
  const pr = [[0, -0.12], [0.22, -0.12], [0.29, -0.08], [0.30, 0], [0.29, 0.08], [0.22, 0.12], [0, 0.12]].map((p) => new THREE.Vector2(p[0], p[1]));
  const cuff = part(new THREE.LatheGeometry(pr, 36), toon(CUFF), INK); cuff.position.y = -0.55; root.add(cuff);
  const props = new THREE.Group(); hand.add(props);
  return { root, wrist, hand, palm, fingers, thumb: th, props, cuff };
}

// pose jari: c1/c2 = tekukan ruas pangkal/ujung (rad, + = ke telapak), spread, thumb [abd, flex, flex2]
const dirQ = (d) => { const up = Math.abs(d.z) < 0.9 ? new V3(0, 0, 1) : new V3(1, 0, 0);
  const X = new V3().crossVectors(d, up).normalize(); const Z = new V3().crossVectors(X, d);
  return new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, d, Z)); };
function setFingers(G, p) {
  G.fingers.forEach((f, i) => f.base.position.set(FINGER[i].x, FINGER[i].y, FINGER[i].z));   // reset (collider bisa menggeser)
  G.fingers.forEach((f, i) => {
    const sp = (p.spread || 0) * 0.3 * (i === 0 ? -1 : i === 2 ? 1 : 0);
    const c3 = p.c3 ? p.c3[i] : p.c2[i] * 0.7;                     // ruas ujung ikut menekuk (≈70% ruas tengah)
    f.base.rotation.set(-p.c1[i], 0, sp, 'ZXY');
    f.mid.rotation.set(-p.c2[i], 0, 0);
    f.tip.rotation.set(-c3, 0, 0);
  });
  const t = p.thumb;
  if (p.td) {   // jempol diatur lewat arah tiap ruas (kerangka tangan): metakarpal, pangkal, ujung
    const qs = p.td.map((d) => dirQ(new V3(...d).normalize()));
    G.thumb.base.quaternion.copy(qs[0]);
    G.thumb.mid.quaternion.copy(qs[0].clone().invert().multiply(qs[1]));
    G.thumb.tip.quaternion.copy(qs[1].clone().invert().multiply(qs[2]));
  } else
  { G.thumb.base.rotation.set(-t[1], t[3] || 0, t[0], 'ZXY');       // t = [abd, flex pangkal, flex tengah, roll]
  G.thumb.mid.rotation.set(-t[2], 0, t[4] || 0, 'ZXY');         // t[4]: tekuk menyamping ke arah jari
  G.thumb.tip.rotation.set(-(p.t3 !== undefined ? p.t3 : t[2] * 0.85), 0, t[5] || 0, 'ZXY'); }
  const w = p.wrist || [0, 0, 0];
  G.wrist.rotation.set(w[0], w[1], w[2]);
}

// ---------- properti ----------
function makeSpoon() {
  const g = new THREE.Group(), met = toon(0xD9DFE3);
  const h = part(new THREE.CylinderGeometry(0.05, 0.065, 1.5, 14), met, 0.03); h.rotation.z = Math.PI / 2; g.add(h);   // gagang sepanjang X
  const hg = new THREE.SphereGeometry(1, 28, 18); hg.scale(0.40, 0.30, 0.09);
  const head = part(hg, met, 0.03); head.position.set(0.95, 0, 0); g.add(head);
  const sc = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), toon(0xE9B23C)); sc.scale.set(0.27, 0.2, 0.03); sc.position.set(0.95, 0, 0.07); g.add(sc);
  return g;
}
function makeStrap() {   // tali jinjing tas: lingkaran di bidang (X,Y) lokal... digantung ke bawah dunia
  const g = new THREE.Group();
  const t = part(new THREE.TorusGeometry(0.55, 0.06, 12, 40), toon(0x2F6F8F), 0.03);
  g.add(t); return g;
}
function makeBowl() {
  const g = new THREE.Group(), cer = toon(0xF3EDDD);
  const bg = new THREE.SphereGeometry(1, 44, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); bg.scale(0.7, 0.48, 0.7);
  g.add(part(bg, cer, 0.03));
  g.add(part(new THREE.TorusGeometry(0.7, 0.045, 14, 48).rotateX(Math.PI / 2), cer, 0.03));
  const foot = part(new THREE.CylinderGeometry(0.27, 0.31, 0.07, 24), toon(0xC9B58F), 0.03); foot.position.y = -0.49; g.add(foot);
  const broth = new THREE.Mesh(new THREE.CircleGeometry(0.64, 36).rotateX(-Math.PI / 2), toon(0xE9B23C)); broth.position.y = -0.06; g.add(broth);
  return g;
}

// ---------- orientasi ----------
const basisQ = (x, y, z) => new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(...x), new V3(...y), new V3(...z)));
const qE = (x, y, z, o = 'XYZ') => new Q().setFromEuler(new E(x, y, z, o));
const mul = (...qs) => qs.reduce((a, b) => a.clone().multiply(b));
// menggantung: jari ke bawah, jempol ke penonton, punggung tangan ke luar badan
// menggantung seperti foto referensi: punggung tangan ke luar badan (+X), jempol ke depan (+Z), jari ke bawah,
// kepalan miring ke depan (pitch) dan sedikit condong ke luar di bawah (lean)
const Q_HANG0 = basisQ([0, 0, 1], [0, -1, 0], [1, 0, 0]);
const Q_HANG = mul(qE(0, 0, 0.2), qE(-0.5, 0, 0), Q_HANG0);
// telapak menghadap penonton, jari ke atas (jempol ke arah tengah badan)
const Q_PALM = qE(0, Math.PI, 0);

const UPREF0 = new V3(0, -0.2, 1);
const spoonQ = (D) => { const Y = UPREF0.clone().sub(D.clone().multiplyScalar(UPREF0.dot(D))).normalize(); const Z = new V3().crossVectors(D, Y);
  return new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(D, Y, Z)); };
const TD_FIST = [[0.15, 0.38, -0.91], [-0.97, 0.20, -0.10], [-0.62, -0.78, 0.05]];
const FIST = { c1: [1.30, 1.38, 1.42], c2: [1.60, 1.68, 1.72], c3: [1.10, 1.15, 1.15], spread: 0, thumb: [0.15, 1.40, 0.15, 0, 1.3, 0.4], td: TD_FIST };
const OPENP = { c1: [-0.05, -0.04, -0.06], c2: [0.05, 0.04, 0.06], c3: [0.04, 0.03, 0.05], spread: 1, thumb: [-0.85, 0.08, 0.1] };
const GRIP = { c1: [1.00, 1.05, 1.10], c2: [1.30, 1.35, 1.40], c3: [0.90, 0.95, 1.00], spread: 0, thumb: [0.95, 0.95, 0.6, 0], td: TD_FIST };
const TD_CUP = [[0.55, 0.55, -0.35], [0.20, 0.85, -0.45], [-0.10, 0.90, -0.40]];
const CUP = { c1: [1.15, 1.20, 1.25], c2: [0.55, 0.60, 0.65], c3: [0.35, 0.40, 0.45], spread: 0.15, thumb: [-0.5, 0.5, 0.4, 0], td: TD_CUP };
const POSES = {
  idle: { label: 'Idle — kepal menghadap bawah', body: true, p: FIST, q: Q_HANG, shoulder: true },
  walk: { label: 'Jalan — ayun lengan', body: true, p: FIST, q: Q_HANG, shoulder: true, anim: 'walk' },
  fistup: { label: 'Kepalan tegak (tampak depan jari)', p: FIST, q: new Q(), pos: [0, 0, 0] },
  fist: { label: 'Kepalan (dekat)', p: FIST, q: Q_HANG, pos: [0, 0, 0] },
  open: { label: 'Telapak terbuka (halo/stop)', p: OPENP, q: Q_PALM },
  point: { label: 'Tunjuk ke atas', p: { c1: [-0.05, 1.38, 1.42], c2: [0.05, 1.68, 1.72], c3: [0.04, 1.15, 1.15], spread: 0, thumb: [0.15, 1.40, 0.15, 0, 1.3, 0.4], td: TD_FIST }, q: Q_PALM },
  pointside: { label: 'Tunjuk ke samping', p: { c1: [-0.05, 1.38, 1.42], c2: [0.05, 1.68, 1.72], c3: [0.04, 1.15, 1.15], spread: 0, thumb: [-0.6, 0.2, 0.2] }, q: mul(qE(0, 0, -Math.PI / 2), Q_PALM) },
  thumbs: { label: 'Jempol', p: { c1: [1.30, 1.38, 1.42], c2: [1.60, 1.68, 1.72], c3: [1.10, 1.15, 1.15], spread: 0, thumb: [-0.12, 0.05, 0.0], t3: 0 }, q: Q_PALM },
  spoon: { label: 'Genggam sendok', p: GRIP, q: spoonQ(new V3(-0.9, 0.35, -0.25).normalize()), prop: 'spoon' },
  bag: { label: 'Genggam tali tas', p: GRIP, q: Q_HANG, prop: 'strap' },
  bowl: { label: 'Memegang mangkuk', p: CUP, q: mul(qE(0, -0.5, 0, 'XYZ'), qE(Math.PI / 2, 0, 0)), prop: 'bowl' },
  eat: { label: 'Makan soto (sendok ke mulut)', body: true, p: FIST, q: Q_HANG, anim: 'eat' },
  cheer: { label: 'Hore! (tangan terbuka ke atas)', p: { ...OPENP, spread: 1.4, thumb: [-1.0, 0.1, 0.1] }, q: mul(qE(0, 0, -0.25), Q_PALM) },
};

// ---------- panggung ----------
const stage = new THREE.Group(); scene.add(stage);
const gR = makeGlove(), gL = makeGlove();
const holderR = new THREE.Group(), holderL = new THREE.Group();           // posisi + orientasi
const mirrorL = new THREE.Group(); mirrorL.scale.x = -1;                     // tangan kiri = cermin
holderR.add(gR.root); holderL.add(gL.root); mirrorL.add(holderL);
stage.add(holderR, mirrorL);
const propsR = { spoon: makeSpoon(), strap: makeStrap(), bowl: makeBowl() };
const propsL = { spoon: makeSpoon(), strap: makeStrap(), bowl: makeBowl() };
for (const k in propsR) { propsR[k].visible = false; gR.props.add(propsR[k]); propsL[k].visible = false; gL.props.add(propsL[k]); }
// posisi properti dalam ruang lokal tangan (disetel visual)
const PROP_POS = { spoon: [0.05, 0.16, -0.30], strap: [0.0, 0.16, -0.30], bowl: [0, 0.2, -0.9] };

// badan referensi: profil kubah/bibir yang sama dengan gasing3d.js (satuan model project)
const bodyG = new THREE.Group(); stage.add(bodyG);
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const MOUTH = new V3(0.02, 0.56, 1.12);
let MTUBE, MOPEN, MTONGUE;
{
  const prof = new THREE.SplineCurve([[1.62, -0.06], [1.5, 0.14], [1.3, 0.34], [1.12, 0.55], [0.98, 0.76], [0.84, 0.98], [0.68, 1.16], [0.52, 1.3], [0.4, 1.42], [0.3, 1.5], [0.2, 1.55], [0.0, 1.58]]
    .map((p) => new THREE.Vector2(p[0], p[1] < 0.3 ? p[1] : 0.3 + (p[1] - 0.3) * 1.22))).getPoints(70);
  const dg = new THREE.LatheGeometry(prof, 64);
  const pa = dg.attributes.position;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); pa.setXYZ(i, x * 1.06, y, z - 0.34 * ss(0.2, 1.83, y)); }
  dg.computeVertexNormals();
  bodyG.add(part(dg, toon(0xB3D34E), 0.03));
  const lg = new THREE.TorusGeometry(1.62, 0.38, 24, 100); lg.rotateX(Math.PI / 2); lg.scale(1.13, 0.72, 1.0);
  bodyG.add(part(lg, toon(0xBCD95A), 0.03));
  const ug = new THREE.SphereGeometry(1, 56, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); ug.scale(2.0, 1.2, 1.75);
  const un = part(ug, toon(0x5B401A), 0.03); un.position.y = -0.04; bodyG.add(un);
  const probe = new THREE.Mesh(dg); probe.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const surf = (x, y) => { ray.set(new V3(x, y, 5), new V3(0, 0, -1)); const h = ray.intersectObject(probe)[0]; return h ? { p: h.point.clone(), n: h.face.normal.clone().normalize() } : { p: new V3(x, y, 0.8), n: new V3(0, 0, 1) }; };
  const eg = new THREE.SphereGeometry(1, 32, 24); eg.scale(0.39, 0.575, 0.27);
  [-0.47, 0.49].forEach((x) => { const sp = surf(x, 1.1); const a = new THREE.Group(); a.position.copy(sp.p); a.quaternion.setFromUnitVectors(new V3(0, 0, 1), sp.n);
    a.add(part(eg, toon(0xFFFDF0), 0.03));
    const pu = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14).scale(0.2, 0.25, 0.12), toon(0x383232)); pu.position.z = 0.24; a.add(pu); bodyG.add(a); });
  const ms = surf(0.02, 0.56); MOUTH.copy(ms.p);
  const mpts = [[-0.24, 0.05, -0.01], [-0.12, -0.02, 0.03], [0.0, -0.045, 0.045], [0.12, -0.02, 0.03], [0.24, 0.05, -0.01]].map((p) => new V3(...p));
  const ma = new THREE.Group(); ma.position.copy(ms.p); ma.quaternion.setFromUnitVectors(new V3(0, 0, 1), ms.n);
  MTUBE = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mpts), 30, 0.03, 8), new THREE.MeshBasicMaterial({ color: col(0x121210) })); ma.add(MTUBE);
  // mulut terbuka: elips gelap (rongga) + lidah; muncul saat makan, menggantikan senyum
  MOPEN = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshBasicMaterial({ color: col(0x2A1010) })); MOPEN.position.set(0, -0.03, 0.035); ma.add(MOPEN);
  MTONGUE = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: col(0xD96A7A) })); ma.add(MTONGUE);
  const ink = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshBasicMaterial({ color: col(0x121210), side: THREE.BackSide })); MOPEN.add(ink); ink.scale.setScalar(1.12);
  bodyG.add(ma);
}
function setMouth(o) {   // 0 = senyum tertutup, 1 = terbuka lebar
  MTUBE.visible = o < 0.08; MOPEN.visible = o >= 0.08; MTONGUE.visible = o > 0.35;
  const w = 0.16 + 0.07 * o, h = 0.012 + 0.2 * o;
  MOPEN.scale.set(w, h, 0.05); MOPEN.position.y = -0.03 - 0.05 * o;
  MTONGUE.scale.set(w * 0.62, h * 0.42, 0.03); MTONGUE.position.set(0, -0.03 - 0.05 * o - h * 0.45, 0.06);
}
const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(20,28,8,0.38)'); g.addColorStop(1, 'rgba(20,28,8,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.85; stage.add(shadow);
// properti makan di dunia (mangkuk) + tali tas (digantung ke bawah di dunia)
const BOWL_S = 1.3;
const bowlW = makeBowl(); bowlW.visible = false; bowlW.scale.setScalar(BOWL_S); stage.add(bowlW);
const spoonScoop = [propsR.spoon.children[2]];
const strapW = [makeStrap(), makeStrap()]; strapW.forEach((x) => { x.visible = false; stage.add(x); });

// ---------- state ----------
const S = { pose: 'idle', t: 0, playing: true, speed: 1, body: true };
const GS = 1.2;                                          // skala sarung tangan (project memakai 0.95)
const SH = { x: 3.1, y: 2.8, z: 0.1 }, ARM = 3.0;      // bahu virtual & panjang lengan (tangan melayang, tanpa lengan)
const TUN = new V3(0.05, 0.14, -0.28);                   // terowongan genggaman (lokal tangan): sendok/tali lewat sini
const SPOON_HEAD_L = new V3(1.35, 0.14, -0.28);          // kepala sendok relatif ke tangan (lokal)
const BOWL_C = new V3(-0.95, -0.05, 2.55);               // pusat bibir mangkuk (dunia, satuan model)
const BOWLHAND = { x: -0.12, y: -0.80, z: 0.20 };
const UPREF = new V3(0, -0.2, 1);
const e2 = (u) => (u < 0 ? 0 : u > 1 ? 1 : u * u * (3 - 2 * u));
const backOut = (u, k = 1.4) => { const c = k + 1; return 1 + c * Math.pow(u - 1, 3) + k * Math.pow(u - 1, 2); };

// pasang tangan dengan pos/orientasi DUNIA; tangan kiri berada di dalam cermin → koordinat di-reflect
function place(side, pos, q) {
  const h = side > 0 ? holderR : holderL;
  h.scale.setScalar(GS);
  if (side > 0) { h.position.copy(pos); h.quaternion.copy(q); }
  else { h.position.set(-pos.x, pos.y, pos.z); h.quaternion.set(q.x, -q.y, -q.z, q.w); }
}
const lerp3 = (a, b, u) => new V3().lerpVectors(a, b, u);
function handForSpoon(head, D) {
  const Y = UPREF.clone().sub(D.clone().multiplyScalar(UPREF.dot(D))).normalize();
  const Z = new V3().crossVectors(D, Y);
  const q = new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(D, Y, Z));
  const pos = head.clone().sub(SPOON_HEAD_L.clone().multiplyScalar(GS).applyQuaternion(q));
  return { q, pos };
}
const EAT = { T: 2.6, bowlDip: new V3(0.12, -0.14, 0.05), D0: new V3(-0.85, -0.38, -0.40).normalize(), D1: new V3(-0.72, 0.30, -0.62).normalize() };


// ---------- collider mangkuk ↔ tangan (mangkuk = elipsoid + silinder di atas bibir; jari = kapsul) ----------
const BOWL_A = 0.7 * BOWL_S, BOWL_B = 0.48 * BOWL_S;
function pushOutBowl(p, c, r) {                       // dorong titik p (bola radius r) keluar dari mangkuk; kembalikan titik baru
  const q = p.clone().sub(c), a = BOWL_A + r;
  if (q.y > 0) { const h = Math.hypot(q.x, q.z); if (h < a) { const k = a / Math.max(h, 1e-4); q.x *= k; q.z *= k; } }
  else { const b = BOWL_B + r; const k = Math.sqrt((q.x / a) ** 2 + (q.y / b) ** 2 + (q.z / a) ** 2); if (k < 1) q.divideScalar(Math.max(k, 1e-4)); }
  return q.add(c);
}
function bowlNormal(p, c, r) {
  const q = p.clone().sub(c);
  if (q.y > 0) return new V3(q.x, 0, q.z).normalize();
  const a = BOWL_A + r, b = BOWL_B + r;
  return new V3(q.x / (a * a), q.y / (b * b), q.z / (a * a)).normalize();
}
function snapBowl(p, c, r, maxD) {                     // tempelkan titik tepat ke permukaan (jika dekat)
  const q = p.clone().sub(c), a = BOWL_A + r;
  let k;
  if (q.y > 0) { const h = Math.hypot(q.x, q.z); k = h / a; } else { const b = BOWL_B + r; k = Math.sqrt((q.x / a) ** 2 + (q.y / b) ** 2 + (q.z / a) ** 2); }
  const out = q.clone().divideScalar(Math.max(k, 1e-4)).add(c);
  return out.distanceTo(p) < maxD ? out : p;
}
function collideBowl(side, G, qWorld, posWorld, bowlC) {
  // 1) telapak: titik-titik permukaan atas telapak tidak boleh masuk mangkuk
  const offs = [[0, 0.43, 0], [0.42, 0.32, 0], [-0.42, 0.32, 0], [0, 0.32, 0.42], [0, 0.32, -0.42]].map((v) => new V3(...v));
  let best = new V3();
  for (const o of offs) { const p = posWorld.clone().add(o); const dlt = pushOutBowl(p, bowlC, 0.04).sub(p); if (dlt.length() > best.length()) best = dlt; }
  place(side, posWorld.clone().add(best), qWorld);
  G.root.updateMatrixWorld(true);
  const toW = (v) => G.hand.localToWorld(v.clone()), toL = (v) => G.hand.worldToLocal(v.clone());
  // 2) tiap jari: rantai 3 ruas, titik ujung & tengah tiap ruas tidak boleh masuk mangkuk
  const digits = [...G.fingers.map((f, i) => ({ d: f, o: FINGER[i] })), { d: G.thumb, o: THUMB }];
  for (const { d, o } of digits) {
    const grps = [d.base, d.mid, d.tip];
    if (d !== G.thumb) { d.base.position.x = o.x * 1.22; d.base.updateMatrixWorld(true); }   // renggangkan jari agar tiap jari terbaca terpisah
    let start = toW(new V3(d === G.thumb ? o.x : o.x * 1.22, o.y, o.z));
    const dirsL = [];
    for (let i = 0; i < 3; i++) {
      const len = o.L[i] * GS, r = o.R[i] * GS * 1.02;
      let dir = new V3(0, 1, 0).transformDirection(grps[i].matrixWorld).normalize();
      if (d !== G.thumb) {                              // jari (bukan jempol): lengkung mulus mengikuti kontur dinding, naik bertahap
        if (i === 0) d._d0 = dir.clone();
        const t = [0.3, 0.65, 0.95][i];
        const H = d._d0.clone().multiplyScalar(1 - t).add(new V3(0, 1, 0).multiplyScalar(t)).normalize();
        const n = bowlNormal(start, bowlC, r);
        dir = H.addScaledVector(n, -H.dot(n)).normalize();
        const e0 = snapBowl(start.clone().addScaledVector(dir, len), bowlC, r, 0.5);
        dir = e0.sub(start).normalize();
      }
      let end = start.clone().addScaledVector(dir, len);
      for (let it = 0; it < 3; it++) {
        const mid = start.clone().add(end).multiplyScalar(0.5);
        const mp = pushOutBowl(mid, bowlC, r);
        if (mp.distanceTo(mid) > 1e-5) { dir = mp.clone().sub(start).normalize(); end = start.clone().addScaledVector(dir, len); }
        const ep = pushOutBowl(end, bowlC, r);
        if (ep.distanceTo(end) > 1e-5) { dir = ep.clone().sub(start).normalize(); end = start.clone().addScaledVector(dir, len); }
      }
      dirsL.push(toL(start.clone().add(dir)).sub(toL(start)).normalize());
      start = end;
    }
    const qs = dirsL.map((v) => dirQ(v));
    d.base.quaternion.copy(qs[0]);
    d.mid.quaternion.copy(qs[0].clone().invert().multiply(qs[1]));
    d.tip.quaternion.copy(qs[1].clone().invert().multiply(qs[2]));
    d.base.updateMatrixWorld(true);
  }
}

function apply() {
  const P = POSES[S.pose], t = S.t;
  const onBody = !!P.body && S.body;
  bodyG.visible = onBody; shadow.visible = onBody;
  const isEat = S.pose === 'eat';
  bowlW.visible = isEat;
  [propsR, propsL].forEach((pp) => { for (const k in pp) pp[k].visible = false; });
  if (P.prop && !isEat) { propsR[P.prop].visible = true; propsL[P.prop].visible = true; }
  strapW.forEach((x) => { x.visible = false; });
  for (const pp of [propsR, propsL]) {
    pp.spoon.position.copy(TUN).add(new V3(0.35, 0, 0)); pp.spoon.rotation.set(0, 0, 0);
    pp.bowl.position.set(0, 0.1, -0.85); pp.bowl.rotation.set(-Math.PI / 2, 0, 0);
  }

  if (isEat) {
    const u = (t % EAT.T) / EAT.T;
    // fase: 0–.18 menyendok, .18–.55 mengangkat (busur) ke mulut, .55–.74 tahan + "nyam", .74–1 kembali
    const bowl = BOWL_C.clone();
    const dipK = e2(u / 0.1) * (1 - e2((u - 0.14) / 0.08));
    const BD = BOWL_C.clone().add(EAT.bowlDip);
    let head, D, s;
    if (u < 0.18) { head = BD.clone().add(new V3(0.0, -0.04 * dipK, 0)); D = EAT.D0.clone(); s = 0; }
    else if (u < 0.55) {
      s = (u - 0.18) / 0.37; const k = backOut(e2(s), 0.9);
      head = lerp3(BD, MOUTH.clone().add(new V3(0, 0, 0.1)), k);
      const arc = Math.sin(Math.PI * Math.min(1, Math.max(0, e2(s)))) ;
      head.add(new V3(0.28 * arc, 0.55 * arc, 0.35 * arc));
      D = lerp3(EAT.D0, EAT.D1, e2(Math.min(1, s * 1.2))).normalize();
    } else if (u < 0.68) { s = 1; head = MOUTH.clone().add(new V3(0, 0, 0.1)); head.add(new V3(0.02 * Math.sin((u - 0.55) * 28), 0.03 * Math.sin((u - 0.55) * 18), 0)); D = EAT.D1.clone(); }
    else {
      s = (u - 0.68) / 0.32; const k = e2(s);
      head = lerp3(MOUTH.clone().add(new V3(0, 0, 0.1)), BD, k);
      const arc = Math.sin(Math.PI * k); head.add(new V3(0.18 * arc, 0.3 * arc, 0.25 * arc));
      D = lerp3(EAT.D1, EAT.D0, k).normalize();
    }
    const hr = handForSpoon(head, D);
    place(1, hr.pos, hr.q);
    // mangkuk + tangan kiri (menopang dari bawah, telapak ke atas); sedikit turun saat sendok masuk (overlap)
    const dip = (u > 0.02 && u < 0.2 ? Math.sin(((u - 0.02) / 0.18) * Math.PI) : 0) * 0.05 + (u > 0.55 && u < 0.68 ? Math.sin(((u - 0.55) / 0.13) * Math.PI * 2) * 0.012 : 0);
    bowl.y -= dip; bowlW.position.copy(bowl);
    const qBowl = mul(qE(0, 0, 0.22), basisQ([0, 0, -1], [1, 0, 0], [0, -1, 0]));        // profil: pergelangan di luar, jari menjulur ke tengah lalu melingkar naik, jempol di sisi penonton
    place(-1, bowl.clone().add(new V3(BOWLHAND.x, BOWLHAND.y + dip * 0.4, BOWLHAND.z)), qBowl);
    const bowlPosL = bowl.clone().add(new V3(BOWLHAND.x, BOWLHAND.y + dip * 0.4, BOWLHAND.z));
    // kuah di sendok: ada setelah menyendok, hilang saat di mulut
    propsR.spoon.visible = true; propsR.spoon.children[2].visible = (u > 0.14 && u < 0.62);
    setFingers(gR, GRIP);
    setFingers(gL, CUP);
    gL.root.updateMatrixWorld(true);
    collideBowl(-1, gL, qBowl, bowlPosL, bowl);
    // badan mengangguk kecil saat "nyam"
    const chew = (u > 0.68 && u < 0.88) ? Math.pow(Math.sin(((u - 0.68) / 0.2) * Math.PI * 2), 2) : 0;
    // mulut: terbuka saat sendok mendekat → menutup di sendok (kuah hilang) → mengunyah 2× → tersenyum
    let m = 0;
    if (u > 0.34 && u < 0.5) m = e2((u - 0.34) / 0.16);
    else if (u >= 0.5 && u < 0.58) m = 1;
    else if (u >= 0.58 && u < 0.64) m = 1 - 0.88 * e2((u - 0.58) / 0.06);
    else if (u >= 0.64 && u < 0.68) m = 0.12;
    else if (u >= 0.68 && u < 0.88) m = 0.02 + 0.2 * chew;
    setMouth(m);
    bodyG.scale.set(1 - chew * 0.015, 1 + chew * 0.03, 1 - chew * 0.015);
    return;
  }
  bodyG.scale.set(1, 1, 1); setMouth(0);

  if (P.shoulder) {
    // tangan menggantung dari bahu virtual; ayun = rotasi di sekitar bahu (busur), pergelangan & jari tertinggal
    const w = 2 * Math.PI * 1.1 * S.speed;
    const A = P.anim === 'walk' ? 0.55 : 0;
    const swing = (ph, lag) => Math.sin(w * t + ph - lag);
    const idleSway = (ph) => Math.sin(t * 1.3 + ph) * 0.03;
    const make = (ph) => {
      const phi = A * swing(ph, 0) + idleSway(ph);
      const phiW = A * swing(ph, 0.55) + idleSway(ph);
      const lift = 0;
      const lateral = A ? Math.sin(w * t + ph - 0.3) * 0.10 : 0;
      const pos = new V3(SH.x - lateral * 0.35, SH.y - ARM * Math.cos(phi) + lift, SH.z + ARM * Math.sin(phi));
      const q = mul(qE(-phi * 0.9, 0, 0), P.q);
      const wr = [-(phiW - phi) * 0.8, 0, A ? Math.sin(w * t + ph - 0.9) * 0.08 : 0];
      const loose = A ? Math.sin(w * t + ph - 1.1) * 0.08 : 0;
      const fp = { ...P.p, c1: P.p.c1.map((c, i) => c - loose * (0.6 + 0.2 * i)), c2: P.p.c2.map((c) => c - loose * 0.5), c3: P.p.c3 ? P.p.c3.map((c) => c - loose * 0.4) : undefined, wrist: wr };
      return { pos, q, fp };
    };
    const r = make(0), l = make(Math.PI);
    holderR.scale.setScalar(GS); holderL.scale.setScalar(GS);
    holderR.position.copy(r.pos); holderR.quaternion.copy(r.q); setFingers(gR, r.fp);
    holderL.position.copy(l.pos); holderL.quaternion.copy(l.q); setFingers(gL, l.fp);   // (di dalam cermin)
    return;
  }
  holderR.scale.setScalar(GS); holderL.scale.setScalar(GS);
  const dx = 1.35;
  holderR.position.set(dx, 0, 0); holderR.quaternion.copy(P.q); setFingers(gR, P.p);
  holderL.position.set(dx, 0, 0); holderL.quaternion.copy(P.q); setFingers(gL, P.p);
  if (P.prop === 'strap') {
    stage.updateMatrixWorld(true);
    [gR, gL].forEach((G, i) => {
      const T = G.hand.localToWorld(TUN.clone());
      const ax = new V3(1, 0, 0).transformDirection(G.hand.matrixWorld);
      const n = new V3().crossVectors(ax, new V3(0, 1, 0)); if (n.lengthSq() < 1e-4) n.set(0, 0, 1); n.normalize();
      strapW[i].visible = true; strapW[i].position.copy(T).add(new V3(0, -0.55, 0));
      strapW[i].quaternion.setFromUnitVectors(new V3(0, 0, 1), n);
    });
  }
}

// ---------- kamera & view ----------
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.12; controls.zoomSpeed = 0.7;
const HOME = new V3(1.5, 1.35, 8.2).normalize();
const VIEWS = { game: HOME, front: new V3(0, 0, 1), side: new V3(-1, 0, 0), top: new V3(0, 1, 0.001), back: new V3(0, 0.1, -1), bottom: new V3(0, -1, 0.001), bfront: new V3(0, -0.5, 1), three: new V3(0.8, 0.5, 1) };
let viewName = 'game';
function setView(n) {
  viewName = n; const P = POSES[S.pose]; const onBody = P.body && S.body;
  const target = onBody ? new V3(0, 0.8, 0.3) : new V3(0, 0.0, 0);
  const dist = onBody ? 13.5 : 7.2;
  controls.target.copy(target); camera.position.copy(target).addScaledVector(VIEWS[n].clone().normalize(), dist);
  camera.up.set(0, 1, 0); camera.lookAt(target); controls.update();
}
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas); resize();

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const poseBox = $('poses');
Object.entries(POSES).forEach(([k, v]) => {
  const b = document.createElement('button'); b.textContent = v.label; b.dataset.k = k;
  b.onclick = () => { S.pose = k; S.t = 0; document.querySelectorAll('#poses button').forEach((x) => x.classList.toggle('on', x.dataset.k === k)); apply(); setView(viewName); };
  poseBox.append(b);
});
document.querySelector('#poses button').classList.add('on');
document.querySelectorAll('#views button').forEach((b) => { b.onclick = () => { setView(b.dataset.v); document.querySelectorAll('#views button').forEach((x) => x.classList.toggle('on', x === b)); }; });
$('play').onclick = () => { S.playing = !S.playing; $('play').textContent = S.playing ? '⏸ Jeda' : '▶ Putar'; };
$('spd').oninput = (e) => { S.speed = +e.target.value; };
$('ink').onchange = (e) => { inkMats.forEach((m) => { m.visible = e.target.checked; }); };
$('body').onchange = (e) => { S.body = e.target.checked; apply(); setView(viewName); };
$('auto').onchange = (e) => { controls.autoRotate = e.target.checked; controls.autoRotateSpeed = 2.2; };
$('wire').onchange = (e) => { scene.traverse((o) => { if (o.isMesh && o.material.isMeshToonMaterial) o.material.wireframe = e.target.checked; }); };

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.playing && !window.__frozen) S.t += dt;
  apply(); controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
apply(); setView('game'); requestAnimationFrame(frame);
window.__prev = { S, POSES, setView, apply, setPose: (k) => { S.pose = k; S.t = 0; apply(); setView(viewName); }, setT: (t) => { S.t = t; apply(); }, controls, camera, render: () => { apply(); controls.update(); renderer.render(scene, camera); }, PROP_POS, propsR, gR, gL };
