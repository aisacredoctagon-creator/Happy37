// ============================================================
//  PENJUAL SOTO 3D — "Bu Soto"
//  Karakter kartun berkepala adonan oranye, rambut cokelat dengan dua rol rambut pink,
//  mata besar, mulut terbuka lebar, kerah renda merah berbintik, kerucut cokelat di bawah,
//  dan sepasang sarung tangan putih yang melayang (tangan kanan melambai).
//
//  const s = buildSotoServer();
//  scene.add(s.group);
//  anim.push(s.update);   // (t, dt) → napas, kedip, lambaian
//  s.hop();               // meloncat senang (mis. saat soto disajikan)
//
//  Gaya sama dengan Gasing: MeshToonMaterial + garis tinta (sisi belakang didorong keluar).
//  Satuan model: alas kepala di y = 0, tinggi kepala+sanggul ≈ 1.4, lebar ≈ 1.3.
// ============================================================
import * as THREE from 'three';
import { gsap } from 'gsap';

const V3 = THREE.Vector3;

// Toon ramp: bayangan, badan, highlight tipis
let gradTex = null;
function grad() {
  if (gradTex) return gradTex;
  const ramp = [150, 150, 150, 215, 215, 215, 215, 255];
  const data = new Uint8Array(ramp.length * 4);
  ramp.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  gradTex = new THREE.DataTexture(data, ramp.length, 1, THREE.RGBAFormat);
  gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter;
  gradTex.generateMipmaps = false;
  gradTex.needsUpdate = true;
  return gradTex;
}
const toon = (hex) => new THREE.MeshToonMaterial({ color: hex, gradientMap: grad() });
const flat = (hex) => new THREE.MeshBasicMaterial({ color: hex });

const inkMat = (w) => new THREE.ShaderMaterial({
  uniforms: { w: { value: w } },
  vertexShader: 'uniform float w;void main(){vec3 p=position+normalize(normal)*w;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
  fragmentShader: 'void main(){gl_FragColor=vec4(0.18,0.09,0.05,1.0);}',
  side: THREE.BackSide,
});
function part(geo, mat, w = 0) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  if (w) g.add(new THREE.Mesh(geo, inkMat(w)));
  return g;
}

// Tabung yang radiusnya berubah sepanjang kurva
function taperTube(points, radiusAt, tubSeg = 40, radSeg = 16) {
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
  g.userData.start = curve.getPointAt(0);
  g.userData.end = curve.getPointAt(1);
  return g;
}

const ORANGE = 0xe57f32, HAIR = 0x3e2216, ROLLER = 0xf28fb0, ROLLER_IN = 0x7a3a48;
const IRIS = 0x7a3414;
const GLOVE = 0xe4e6e8, COLLAR = 0xe8483f, DOT = 0xf6b768, CONE = 0x9a6a2e;
const Z_SQUASH = 0.82;          // kepala sedikit pipih dari depan ke belakang

/* ------------------------------------------------------------
   SARUNG TANGAN — SALINAN PERSIS dari gasing3d.js (makeGlove / digit / applyPose + konstanta jari), tanpa aset baru.
   Kerangka lokal tangan: +Y ke arah jari, +X sisi jempol, +Z punggung tangan, jari menekuk ke −Z.
   Gestur = telapak terbuka menghadap penonton (Q_PALM, sama dengan gestur 'wave'/'marvel' Gasing); melambai = wrist.rotation.z.
------------------------------------------------------------ */
const HAND_S = 0.28;                                // skala (satuan Gasing → satuan Bu Soto): lebar telapak ≈ 1/5 lebar kepala, seperti Gasing ≈ 1/5 piringan
const HAND_INK = 0.012 / HAND_S;                    // tinta lokal → ≈ 0.012 di satuan model (sama seperti sarung tangan sebelumnya)
const FINGER = [  // telunjuk, tengah, manis — tiap jari 3 ruas (pangkal, tengah, ujung)
  { x: 0.30, y: 0.38, z: 0.00, L: [0.21, 0.17, 0.15], R: [0.158, 0.150, 0.140] },
  { x: 0.00, y: 0.41, z: 0.00, L: [0.24, 0.19, 0.16], R: [0.163, 0.155, 0.145] },
  { x: -0.30, y: 0.37, z: 0.00, L: [0.21, 0.17, 0.14], R: [0.153, 0.145, 0.135] },
];
const THUMB = { x: 0.30, y: 0.02, z: -0.26, L: [0.22, 0.20, 0.17], R: [0.170, 0.158, 0.140] };
const TD_FIST = [[0.15, 0.38, -0.91], [-0.97, 0.20, -0.10], [-0.62, -0.78, 0.05]];
const TD_CUP = [[0.55, 0.55, -0.35], [0.20, 0.85, -0.45], [-0.10, 0.90, -0.40]];
const P_FIST = { c1: [1.30, 1.38, 1.42], c2: [1.60, 1.68, 1.72], c3: [1.10, 1.15, 1.15] };
const P_OPEN = { c1: [-0.05, -0.04, -0.06], c2: [0.05, 0.04, 0.06], c3: [0.04, 0.03, 0.05], thumb: [-0.85, 0.08, 0.1] };   // thumb = Euler [abd, flex1, flex2]
const P_CUP = { c1: [1.15, 1.20, 1.25], c2: [0.55, 0.60, 0.65], c3: [0.35, 0.40, 0.45], spread: 0.15 };
const JOINT_LIM = { c1: [-0.12, 1.55], c2: [0, 1.85], c3: [0, 1.35], spread: [-0.4, 1.6] };
const JOINT_SOFT = 0.08;

const qE = (x, y, z, o = 'XYZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, o));
const Q_PALM = qE(0, Math.PI, 0);                   // telapak ke penonton, jari ke atas (sama dengan Q_PALM Gasing)
// Orientasi tangan penopang mangkuk (kerangka glove kanan): telapak ke atas (−Z lokal = +Y), jari menjulur KELUAR ke arah Gasing
// (+X, condong sedikit ke penonton), manset di sisi badan Bu Soto, jempol di belakang (−Z). Jari menekuk melingkari mangkuk (pose P_CUP Gasing).
const Q_BOWL = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new V3(0.287, 0, -0.958), new V3(0.958, 0, 0.287), new V3(0, -1, 0)));
// posisi pusat bibir mangkuk relatif titik pusat telapak (kerangka glove): alas mangkuk bertumpu di atas telapak, jari menekuk melingkari sisinya
const BOWL_ON_HAND = { x: 0.0, y: 0.27, z: 0.0 };
const mix = (a, b, u) => a + (b - a) * u;
const softLim = (x, lo, hi) => {                    // batas lunak: linear di tengah, melengkung mulus ke batas
  const k = JOINT_SOFT;
  if (x < lo + k) return lo + k * Math.exp((x - lo - k) / k);
  if (x > hi - k) return hi - k * Math.exp((hi - k - x) / k);
  return x;
};
const _dx = new V3(), _dz = new V3(), _dm = new THREE.Matrix4(), _up0 = new V3(0, 0, 1), _up1 = new V3(1, 0, 0);
// kuaternion yang +Y-nya searah d (jempol diatur lewat ARAH tiap ruas, bukan sudut Euler)
const dirQInto = (d, out) => {
  const up = Math.abs(d.z) < 0.9 ? _up0 : _up1;
  _dx.crossVectors(d, up).normalize(); _dz.crossVectors(_dx, d);
  return out.setFromRotationMatrix(_dm.makeBasis(_dx, d, _dz));
};
// arah tiap ruas jempol saat terbuka (dari sudut Euler P_OPEN.thumb) → dicampur dengan TD_FIST / TD_CUP
const TD_OPEN = (() => {
  const t = P_OPEN.thumb, qb = qE(-t[1], 0, t[0], 'ZXY'), qm = qE(-t[2], 0, 0, 'ZXY'), qt = qE(-(t[2] * 0.85), 0, 0, 'ZXY');
  const Y = new V3(0, 1, 0), qbm = qb.clone().multiply(qm);
  return [Y.clone().applyQuaternion(qb), Y.clone().applyQuaternion(qbm), Y.clone().applyQuaternion(qbm.clone().multiply(qt))].map((d) => [d.x, d.y, d.z]);
})();
const _td = new V3(), _tq = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], _tqi = new THREE.Quaternion();

/** Pose jari seperti applyPose() Gasing. k = closure 0 (telapak terbuka) → 1 (kepalan); spread = kipasan jari; cup 0..1 = menuju pose menopang mangkuk. */
function poseHand(G, spread = 0.6, k = 0, cup = 0) {
  const sp = softLim(mix(spread, P_CUP.spread, cup), JOINT_LIM.spread[0], JOINT_LIM.spread[1]);
  for (let i = 0; i < 3; i++) {
    const f = G.fingers[i];
    const c1 = softLim(mix(mix(P_OPEN.c1[i], P_FIST.c1[i], k), P_CUP.c1[i], cup), JOINT_LIM.c1[0], JOINT_LIM.c1[1]);
    const c2 = softLim(mix(mix(P_OPEN.c2[i], P_FIST.c2[i], k), P_CUP.c2[i], cup), JOINT_LIM.c2[0], JOINT_LIM.c2[1]);
    const c3 = softLim(mix(mix(P_OPEN.c3[i], P_FIST.c3[i], k), P_CUP.c3[i], cup), JOINT_LIM.c3[0], JOINT_LIM.c3[1]);
    f.base.rotation.set(-c1, 0, sp * 0.3 * (i === 0 ? -1 : i === 2 ? 1 : 0), 'ZXY');
    f.mid.rotation.set(-c2, 0, 0); f.tip.rotation.set(-c3, 0, 0);
  }
  for (let j = 0; j < 3; j++) {
    _td.set(mix(mix(TD_OPEN[j][0], TD_FIST[j][0], k), TD_CUP[j][0], cup), mix(mix(TD_OPEN[j][1], TD_FIST[j][1], k), TD_CUP[j][1], cup),
      mix(mix(TD_OPEN[j][2], TD_FIST[j][2], k), TD_CUP[j][2], cup)).normalize();
    dirQInto(_td, _tq[j]);
  }
  G.thumb.base.quaternion.copy(_tq[0]);
  G.thumb.mid.quaternion.copy(_tqi.copy(_tq[0]).invert().multiply(_tq[1]));
  G.thumb.tip.quaternion.copy(_tqi.copy(_tq[1]).invert().multiply(_tq[2]));
}

export function buildSotoServer() {
  const group = new THREE.Group();       // posisi dunia (diatur pemanggil)
  const root = new THREE.Group();        // loncat + napas
  group.add(root);
  const head = new THREE.Group();        // goyang kepala
  root.add(head);

  /* ---- Kepala: tonjolan bawah lebar (pipi + mulut), kubah atas lebih sempit ---- */
  const prof = new THREE.SplineCurve([
    [0.0, 0.0], [0.34, 0.02], [0.56, 0.09], [0.66, 0.22], [0.64, 0.36], [0.56, 0.46],
    [0.53, 0.52], [0.54, 0.66], [0.5, 0.84], [0.4, 1.0], [0.24, 1.1], [0.0, 1.14],
  ].map(([x, y]) => new THREE.Vector2(x, y))).getPoints(60);
  const headGeo = new THREE.LatheGeometry(prof, 72);
  headGeo.scale(1, 1, Z_SQUASH);
  headGeo.computeVertexNormals();
  {
    // satukan normal di sambungan lathe supaya garis tinta tidak retak
    const na = headGeo.attributes.normal, P = prof.length, n = new V3();
    for (let j = 0; j < P; j++) {
      const i0 = j, i1 = 72 * P + j;
      n.set(na.getX(i0) + na.getX(i1), na.getY(i0) + na.getY(i1), na.getZ(i0) + na.getZ(i1)).normalize();
      na.setXYZ(i0, n.x, n.y, n.z); na.setXYZ(i1, n.x, n.y, n.z);
    }
  }
  const headMesh = part(headGeo, toon(ORANGE), 0.016);
  head.add(headMesh);

  // titik di permukaan kepala (raycast dari depan) untuk menempelkan wajah
  const probe = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  probe.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  function surf(x, y) {
    ray.set(new V3(x, y, 5), new V3(0, 0, -1));
    const hit = ray.intersectObject(probe)[0];
    return hit ? { p: hit.point.clone(), n: hit.face.normal.clone().normalize() } : { p: new V3(x, y, 0.45), n: new V3(0, 0, 1) };
  }
  function anchorAt(x, y, inset = 0) {
    const s = surf(x, y);
    const a = new THREE.Group();
    a.position.copy(s.p).addScaledVector(s.n, -inset);
    a.quaternion.setFromUnitVectors(new V3(0, 0, 1), s.n);
    head.add(a);
    return a;
  }

  /* ---- Permukaan kepala secara analitik (dari profil lathe) ---- */
  // r & normal profil pada ketinggian y → titik/normal permukaan di sudut phi (0 = depan, + = kanan layar)
  function profAt(y) {
    y = Math.min(prof[prof.length - 1].y, Math.max(0, y));
    let i = 0;
    while (i < prof.length - 2 && prof[i + 1].y < y) i++;
    const a = prof[i], b = prof[i + 1];
    const t = b.y > a.y ? (y - a.y) / (b.y - a.y) : 0;
    const dr = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dr, dy) || 1;
    return { r: a.x + (b.x - a.x) * t, nr: dy / L, ny: -dr / L };
  }
  function headPt(phi, y, off = 0) {
    const { r, nr, ny } = profAt(y);
    const rr = Math.max(0, r + nr * off), yy = y + ny * off;
    return {
      p: new V3(rr * Math.sin(phi), yy, rr * Math.cos(phi) * Z_SQUASH),
      n: new V3(nr * Math.sin(phi), ny, (nr * Math.cos(phi)) / Z_SQUASH).normalize(),
    };
  }
  const surfZ = (x, y) => { const { r } = profAt(y); return Math.sqrt(Math.max(0, r * r - x * x)) * Z_SQUASH; };

  // Stiker wajah: gambar kanvas (garis vektor halus) di atas petak yang mengikuti lengkung kepala
  function decal(cx, cy, w, h, draw, { off = 0.005, px = 1400, order = 2 } = {}) {
    const cw = Math.round(w * px), ch = Math.round(h * px);
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const c = cv.getContext('2d');
    c.translate(cw / 2, ch / 2);
    c.scale(px, -px);                 // satuan model, y ke atas
    c.lineCap = 'round'; c.lineJoin = 'round';
    draw(c);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(w, h, 36, 24);
    const pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = cx + pa.getX(i), y = cy + pa.getY(i);
      pa.setXYZ(i, x, y, surfZ(x, y) + off);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({
      map: tex, gradientMap: grad(), transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    m.renderOrder = order;
    head.add(m);
    return m;
  }

  /* ---- Rambut: satu cangkang halus dengan garis rambut membulat + belahan, kilau, sanggul, rol pink ---- */
  {
    const hairMat = toon(HAIR);
    const T = 0.042;                                         // tebal rambut
    // garis rambut: tinggi di dahi, turun membingkai wajah di samping, rendah di belakang; belahan di kiri layar
    const hairline = (phi) => 0.47 + 0.56 * Math.exp(-((phi / 1.4) ** 2)) + 0.035 * Math.exp(-(((phi + 0.32) / 0.18) ** 2));
    const TOP = prof[prof.length - 1].y;

    // cangkang
    const U = 120, Vn = 26;
    const pos = [], idx = [];
    for (let i = 0; i <= U; i++) {
      const phi = -Math.PI + (i / U) * Math.PI * 2;
      const y0 = hairline(phi);
      for (let j = 0; j <= Vn; j++) {
        const v = j / Vn;
        const y = y0 + (TOP - y0) * (1 - (1 - v) ** 1.6);
        const { p } = headPt(phi, y, T);
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < U; i++) {
      for (let j = 0; j < Vn; j++) {
        const a = i * (Vn + 1) + j, b = (i + 1) * (Vn + 1) + j;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const shell = new THREE.BufferGeometry();
    shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    shell.setIndex(idx);
    shell.computeVertexNormals();
    {
      // sambungan phi = ±π (belakang) → samakan normal supaya garis tinta tidak retak
      const na = shell.attributes.normal, n = new V3();
      for (let j = 0; j <= Vn; j++) {
        const i0 = j, i1 = U * (Vn + 1) + j;
        n.set(na.getX(i0) + na.getX(i1), na.getY(i0) + na.getY(i1), na.getZ(i0) + na.getZ(i1)).normalize();
        na.setXYZ(i0, n.x, n.y, n.z); na.setXYZ(i1, n.x, n.y, n.z);
      }
    }
    head.add(part(shell, hairMat, 0.014));

    // tepi garis rambut yang membulat (tabung tertutup mengikuti hairline)
    const rimPts = [];
    for (let i = 0; i < 160; i++) {
      const phi = -Math.PI + (i / 160) * Math.PI * 2;
      rimPts.push(headPt(phi, hairline(phi), T * 0.5).p);
    }
    const rimGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true, 'centripetal'), 220, T * 0.55, 12, true);
    head.add(part(rimGeo, hairMat, 0.01));

    // kilau rambut: garis terang tipis yang menyapu dari belahan ke samping, mengikuti lengkung garis rambut
    {
      const shineMat = flat(0x7a4a30);
      for (const [a0, a1, dy, w] of [[-0.28, 0.95, 0.1, 0.011], [-0.36, -1.0, 0.1, 0.009], [-0.2, 0.55, 0.19, 0.008]]) {
        const pts = [];
        for (let k = 0; k <= 24; k++) {
          const phi = a0 + (a1 - a0) * (k / 24);
          pts.push(headPt(phi, Math.min(TOP - 0.06, hairline(phi) + dy), T + 0.004).p);
        }
        head.add(new THREE.Mesh(taperTube(pts, (t) => w * Math.sin(Math.PI * (0.1 + 0.85 * t)) + 0.0015, 48, 8), shineMat));
      }
    }

    // sanggul + ikatan di pangkalnya
    const bunGeo = new THREE.SphereGeometry(0.24, 36, 24);
    bunGeo.scale(1, 0.88, 0.92);
    const bun = part(bunGeo, hairMat, 0.014);
    bun.position.set(0, 1.2, -0.12);
    head.add(bun);
    const tie = part(new THREE.TorusGeometry(0.15, 0.035, 12, 36).rotateX(Math.PI / 2 - 0.35), toon(0x2f1810), 0.008);
    tie.position.set(0, 1.08, -0.08);
    head.add(tie);

    // rol rambut: tabung bergaris yang miring keluar, ujung berlubang terlihat dari depan
    const rollMat = new THREE.MeshToonMaterial({ color: ROLLER, gradientMap: grad(), side: THREE.DoubleSide });
    const ridgeMat = toon(0xd9708f);
    for (const sx of [-1, 1]) {
      const roll = new THREE.Group();
      roll.add(part(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 32, 1, true), rollMat, 0.012));
      for (const y of [-0.09, 0, 0.09]) {
        const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.162, 0.012, 8, 32).rotateX(Math.PI / 2), ridgeMat);
        ridge.position.y = y;
        roll.add(ridge);
      }
      const face = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.16, 32), toon(0xf8b3c8));
      face.rotation.x = -Math.PI / 2; face.position.y = 0.18;
      roll.add(face);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.082, 24), flat(ROLLER_IN));
      hole.rotation.x = -Math.PI / 2; hole.position.y = 0.16;
      roll.add(hole);
      roll.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(sx * 0.62, 0.32, 0.72).normalize());
      roll.position.set(sx * 0.38, 1.05, -0.06);
      head.add(roll);
    }
  }

  /* ---- Mata: putih besar, iris cokelat, pupil, kilau, garis kelopak + bulu mata lentik ---- */
  const lids = [];
  {
    const EA = 0.13, EB = 0.17, EC = 0.08;
    const eyeGeo = new THREE.SphereGeometry(1, 36, 24); eyeGeo.scale(EA, EB, EC);
    const irisGeo = new THREE.SphereGeometry(1, 28, 18); irisGeo.scale(0.1, 0.135, 0.05);
    const pupilGeo = new THREE.SphereGeometry(1, 20, 14); pupilGeo.scale(0.072, 0.095, 0.03);
    const glintGeo = new THREE.SphereGeometry(0.025, 14, 10);
    const lashMat = flat(0x2a140c);
    for (const sx of [-1, 1]) {
      const a = anchorAt(sx * 0.19, 0.66, 0.035);
      const lid = new THREE.Group(); a.add(lid);
      lid.add(part(eyeGeo, toon(0xfffdf6), 0.01));
      // Arah pandang: lurus ke depan kepala, sedikit ke dalam (ke arah hidung) supaya menatap penonton.
      // (Normal permukaan di posisi mata menghadap ke luar → kalau iris mengikuti normal, mata jadi juling ke luar.)
      const gaze = new V3(-sx * 0.09, -0.02, 1).normalize().applyQuaternion(a.quaternion.clone().invert());
      const k = 1 / Math.sqrt((gaze.x / EA) ** 2 + (gaze.y / EB) ** 2 + (gaze.z / EC) ** 2);
      const onBall = gaze.clone().multiplyScalar(k);                                     // titik di permukaan bola mata
      const ballN = new V3(onBall.x / (EA * EA), onBall.y / (EB * EB), onBall.z / (EC * EC)).normalize();
      const look = new THREE.Group();
      look.position.copy(onBall);
      look.quaternion.setFromUnitVectors(new V3(0, 0, 1), ballN);
      lid.add(look);
      const iris = part(irisGeo, toon(IRIS), 0);
      iris.position.z = -0.033;
      look.add(iris);
      const pupil = new THREE.Mesh(pupilGeo, flat(0x3a1408));
      pupil.position.z = -0.009;
      look.add(pupil);
      const glint = new THREE.Mesh(glintGeo, flat(0xffffff));
      glint.position.set(0.035, 0.05, 0.016);
      look.add(glint);
      const glint2 = new THREE.Mesh(glintGeo, flat(0xffffff));
      glint2.scale.setScalar(0.45);
      glint2.position.set(-0.03, -0.045, 0.012);
      look.add(glint2);
      lids.push(lid);

      // garis kelopak atas: menebal ke sudut luar, lalu dua bulu mata lentik
      const lidPts = [];
      for (let k = 0; k <= 10; k++) {
        const ang = (165 - k * 14.5) * Math.PI / 180;
        lidPts.push(new V3(sx * EA * 0.98 * Math.cos(ang), EB * 0.98 * Math.sin(ang), 0.042));
      }
      a.add(new THREE.Mesh(taperTube(lidPts, (t) => 0.006 + 0.011 * t, 40, 10), lashMat));
      const E = lidPts[lidPts.length - 1];
      const capE = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 10), lashMat);
      capE.position.copy(E); a.add(capE);
      for (const [k, dx, dy] of [[10, 0.075, 0.055], [8, 0.055, 0.07]]) {
        const s = lidPts[k];
        const pts = [s.clone(), s.clone().add(new V3(sx * dx * 0.45, dy * 0.55, 0.004)), s.clone().add(new V3(sx * dx, dy, 0.0))];
        a.add(new THREE.Mesh(taperTube(pts, (t) => 0.012 * (1 - t) + 0.003, 20, 8), lashMat));
      }
    }
  }

  /* ---- Alis: lengkung lembut, tebal di tengah, ujung luar meruncing ---- */
  for (const sx of [-1, 1]) {
    decal(sx * 0.2, 0.885, 0.32, 0.16, (c) => {
      c.scale(sx, 1);
      c.beginPath();
      c.moveTo(-0.115, -0.02);
      c.quadraticCurveTo(-0.02, 0.07, 0.135, 0.0);       // tepi atas
      c.quadraticCurveTo(-0.01, 0.03, -0.105, -0.045);   // tepi bawah
      c.quadraticCurveTo(-0.13, -0.035, -0.115, -0.02);  // pangkal membulat
      c.fillStyle = '#3a1d12';
      c.fill();
    });
  }

  /* ---- Pipi merona (gradasi lembut) ---- */
  for (const sx of [-1, 1]) {
    decal(sx * 0.4, 0.4, 0.26, 0.18, (c) => {
      c.scale(1, 0.62);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 0.12);
      g.addColorStop(0, 'rgba(240, 96, 150, 0.85)');
      g.addColorStop(0.55, 'rgba(240, 96, 150, 0.55)');
      g.addColorStop(1, 'rgba(240, 96, 150, 0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, 0.12, 0, Math.PI * 2); c.fill();
      // kilau kecil di pipi
      c.fillStyle = 'rgba(255, 235, 240, 0.8)';
      c.beginPath(); c.ellipse(-sx * 0.035, 0.035, 0.018, 0.012, 0, 0, Math.PI * 2); c.fill();
    }, { order: 1 });
  }

  /* ---- Mulut: senyum terbuka berbentuk D, gigi atas, lidah, lesung di sudut ---- */
  decal(0, 0.24, 0.62, 0.34, (c) => {
    const edge = () => {
      c.beginPath();
      c.moveTo(-0.22, 0.065);
      c.quadraticCurveTo(0, 0.005, 0.22, 0.065);                 // bibir atas: sedikit melengkung
      c.bezierCurveTo(0.21, -0.19, -0.21, -0.19, -0.22, 0.065);  // dagu bulat
      c.closePath();
    };
    edge(); c.lineWidth = 0.036; c.strokeStyle = '#5b1320'; c.stroke();    // bingkai luar
    edge(); c.fillStyle = '#4a0f22'; c.fill();                               // rongga
    c.save();
    edge(); c.clip();
    const throat = c.createLinearGradient(0, 0.06, 0, -0.14);
    throat.addColorStop(0, '#3a0a1a'); throat.addColorStop(1, '#6a1830');
    c.fillStyle = throat; c.fillRect(-0.3, -0.2, 0.6, 0.3);
    c.beginPath(); c.ellipse(0.015, -0.145, 0.155, 0.09, 0, 0, Math.PI * 2);                   // lidah
    c.fillStyle = '#e4527d'; c.fill();
    c.beginPath(); c.ellipse(-0.04, -0.095, 0.055, 0.02, -0.15, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255, 186, 208, 0.7)'; c.fill();
    c.beginPath(); c.moveTo(0.015, -0.075); c.quadraticCurveTo(0.025, -0.105, 0.02, -0.13);
    c.lineWidth = 0.008; c.strokeStyle = '#b8325e'; c.stroke();
    c.beginPath();                                                                          // gigi atas
    c.moveTo(-0.3, 0.12); c.lineTo(0.3, 0.12); c.lineTo(0.3, 0.045);
    c.quadraticCurveTo(0, -0.05, -0.3, 0.045); c.closePath();
    c.fillStyle = '#fffaf0'; c.fill();
    c.restore();
    edge(); c.lineWidth = 0.016; c.strokeStyle = '#6e1828'; c.stroke();     // garis dalam yang rapi
    for (const s of [-1, 1]) {                                               // lesung di sudut bibir
      c.beginPath();
      c.moveTo(s * 0.205, 0.105);
      c.quadraticCurveTo(s * 0.26, 0.09, s * 0.255, 0.035);
      c.lineWidth = 0.014; c.strokeStyle = '#8a3a1c'; c.stroke();
    }
  }, { order: 2 });

  /* ---- Kerah renda merah berbintik + kerucut cokelat di bawah ---- */
  {
    const collar = new THREE.Group();
    collar.position.y = -0.02;
    const N = 11;
    const petalGeo = new THREE.SphereGeometry(0.11, 20, 14); petalGeo.scale(1, 0.75, 0.8);
    const dotGeo = new THREE.SphereGeometry(0.022, 10, 8);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const p = part(petalGeo, toon(COLLAR), 0.01);
      p.position.set(Math.sin(a) * 0.22, -0.04 + (i % 2) * 0.02, Math.cos(a) * 0.2);
      collar.add(p);
      for (const [dx, dy] of [[0.03, 0.03], [-0.04, -0.02]]) {
        const d = new THREE.Mesh(dotGeo, toon(DOT));
        d.position.set(p.position.x + dx * Math.cos(a), p.position.y + dy, p.position.z + 0.075 * Math.cos(a) - dx * Math.sin(a) + 0.01);
        collar.add(d);
      }
    }
    root.add(collar);
    const cone = part(new THREE.ConeGeometry(0.13, 0.55, 20).rotateX(Math.PI), toon(CONE), 0.01);
    cone.position.y = -0.38;
    root.add(cone);
  }

  /* ---- Sarung tangan putih melayang (kiri menahan, kanan melambai) ---- */
  // Rig sama dengan Gasing: root (manset, tetap) → wrist (pivot di manset) → hand (telapak elipsoid, 3 jari × 3 ruas, jempol 3 ruas).
  // Tangan kiri = cermin (scale.x = −1) dari tangan kanan, persis seperti Gasing.
  function digit(parent, mat, o) {
    const base = new THREE.Group(); base.position.set(o.x, o.y, o.z); parent.add(base);
    base.add(part(new THREE.SphereGeometry(o.R[0], 22, 16), mat, HAND_INK));
    const mk = (grp, i) => { const seg = part(new THREE.CapsuleGeometry(o.R[i], o.L[i], 8, 20), mat, HAND_INK); seg.position.y = o.L[i] / 2; grp.add(seg); };
    mk(base, 0);
    const mid = new THREE.Group(); mid.position.y = o.L[0]; base.add(mid); mk(mid, 1);
    const tip = new THREE.Group(); tip.position.y = o.L[1]; mid.add(tip); mk(tip, 2);
    return { base, mid, tip };
  }
  function makeGlove(side) {
    const mat = toon(0xE9EBEC), root = new THREE.Group();
    // Beda dari Gasing: manset ikut tangan (anak wrist) dan pivot di dasar manset, jadi manset ikut mengayun saat melambai
    // (pada Gasing manset diam di pergelangan). Posisi telapak tetap di titik asal root.
    const wrist = new THREE.Group(); wrist.position.set(0, -0.67, 0); root.add(wrist);   // pivot di dasar manset
    const hand = new THREE.Group(); hand.position.set(0, 0.67, 0); wrist.add(hand);
    const palmGeo = new THREE.SphereGeometry(1, 40, 28); palmGeo.scale(0.50, 0.47, 0.36);
    const palm = part(palmGeo, mat, HAND_INK); palm.position.y = 0.05; hand.add(palm);
    const fingers = FINGER.map((o) => digit(hand, mat, o));
    const thumb = digit(hand, mat, THUMB);
    // manset: bantal bulat di pergelangan, menempel pada tangan (ikut bergerak bersama wrist)
    const pr = [[0, -0.12], [0.22, -0.12], [0.29, -0.08], [0.30, 0], [0.29, 0.08], [0.22, 0.12], [0, 0.12]].map((p) => new THREE.Vector2(p[0], p[1]));
    const cuff = part(new THREE.LatheGeometry(pr, 36), toon(0xF1F2F2), HAND_INK); cuff.position.y = 0.12; wrist.add(cuff);
    const holder = new THREE.Group(); holder.scale.setScalar(HAND_S); holder.quaternion.copy(Q_PALM); holder.add(root);
    const g = new THREE.Group(); g.add(holder);
    if (side < 0) g.scale.x = -1;
    g.userData.G = { fingers, thumb, wrist, holder };
    poseHand(g.userData.G, 0.6, 0);          // telapak terbuka (OPENC) seperti gestur 'wave'
    return g;
  }
  const gloveL = makeGlove(-1);    // kiri layar, agak rendah
  gloveL.position.set(-0.86, 0.12, 0.12);
  gloveL.rotation.z = 0.5;
  root.add(gloveL);
  poseHand(gloveL.userData.G, 0.5, 0.05);   // tangan kiri: telapak terbuka santai (seperti 'marvel' Gasing)
  const gloveR = makeGlove(1);     // kanan layar, melambai
  gloveR.position.set(0.9, 0.52, 0.12);
  gloveR.rotation.z = -0.2;
  root.add(gloveR);

  /* ---- Mangkuk soto yang disodorkan (hanya tampil saat serve()) ---- */
  const bowl = new THREE.Group();
  {
    const shell = part(new THREE.SphereGeometry(0.17, 22, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon(0xf4f1e8), 0.01);
    shell.children[0].material.side = THREE.DoubleSide;
    bowl.add(shell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 24), toon(0x3a6b8a));
    rim.rotation.x = Math.PI / 2;
    bowl.add(rim);
    const soup = new THREE.Mesh(new THREE.CircleGeometry(0.155, 22), toon(0xc9892f));
    soup.rotation.x = -Math.PI / 2; soup.position.y = -0.025;
    bowl.add(soup);
    const foot = part(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 14), toon(0xf4f1e8), 0.008);
    foot.position.y = -0.185;
    bowl.add(foot);
  }
  bowl.visible = false;
  root.add(bowl);

  // garis tinta & bayangan: karakter tidak memberi/menerima bayangan (di bawah terpal tetap cerah)
  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  /* ---- Animasi ---- */
  const fx = { hop: 0, wave: 0, give: 0, bowl: 0 };
  // sodoran mangkuk: sarung tangan kanan menjulur ke depan-kanan (ke arah Gasing) + badan condong sedikit (satuan model, kerangka root)
  const GIVE = { gx: 0.05, gy: -0.5, gz: 0.6, lx: 0.35, lz: 0.4 };
  let wavePhase = 0;
  let nextBlink = 2 + Math.random() * 2, blinkT = -1;
  function update(t, dt = 1 / 60) {
    root.position.y = Math.sin(t * 2.1) * 0.02 + fx.hop * 0.22;
    root.scale.set(1 + fx.hop * -0.04, 1 + Math.sin(t * 2.1) * 0.012 + fx.hop * 0.06, 1);
    head.rotation.z = Math.sin(t * 1.3) * 0.045;
    head.rotation.y = Math.sin(t * 0.7) * 0.08;
    // fase diakumulasi (bukan t * speed) supaya perubahan kecepatan tidak membuat tangan melompat
    wavePhase += dt * (2.0 + fx.wave * 1.6);
    // lambaian seperti gestur 'wave' Gasing: telapak terbuka ke penonton, pergelangan (wrist.z) mengayun + jari berkibar sedikit
    // hold (0 → 1, mengikuti fx.bowl): tangan berubah dari melambai → menopang mangkuk (telapak ke atas, jari melingkar seperti P_CUP Gasing)
    const hold = Math.min(1, fx.bowl);
    const GR = gloveR.userData.G;
    const wv = Math.sin(wavePhase) * (0.42 + fx.wave * 0.2);
    GR.wrist.rotation.z = wv * (1 - hold);
    GR.holder.quaternion.slerpQuaternions(Q_PALM, Q_BOWL, hold);
    poseHand(GR, mix(0.6, 0.15, hold), Math.max(0, 0.1 + 0.12 * Math.sin(wavePhase + 0.9)) * (1 - hold), hold);
    gloveR.rotation.z = -0.2;
    gloveR.position.y = 0.52 + Math.sin(wavePhase * 0.5) * 0.02 + fx.wave * 0.1;
    gloveL.position.y = 0.12 + Math.sin(t * 2.1 + 1) * 0.03;
    gloveL.rotation.z = 0.5 + Math.sin(t * 1.6) * 0.06;
    // sodoran mangkuk (give 0 → 1): tangan kanan menjulur & tegak menopang mangkuk, badan condong ke depan
    const gv = fx.give;
    if (gv > 0 || fx.bowl > 0) {
      gloveR.position.x = 0.9 + gv * GIVE.gx;
      gloveR.position.y += gv * GIVE.gy;
      gloveR.position.z = 0.12 + gv * GIVE.gz;
      gloveR.rotation.z += (0.05 - gloveR.rotation.z) * gv;
      root.position.x = gv * GIVE.lx;
      root.position.z = gv * GIVE.lz;
      bowl.visible = fx.bowl > 0.01;
      bowl.scale.setScalar(Math.max(0.001, fx.bowl));
      bowl.position.set(gloveR.position.x + BOWL_ON_HAND.x, gloveR.position.y + BOWL_ON_HAND.y, gloveR.position.z + BOWL_ON_HAND.z);
    } else {
      root.position.x = 0; root.position.z = 0; bowl.visible = false;
    }
    // kedip
    if (blinkT < 0 && t > nextBlink) blinkT = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const k = blinkT < 0.07 ? 1 - blinkT / 0.07 : blinkT < 0.14 ? (blinkT - 0.07) / 0.07 : 1;
      for (const l of lids) l.scale.y = Math.max(0.08, k);
      if (blinkT >= 0.14) { blinkT = -1; nextBlink = t + 2.2 + Math.random() * 3; for (const l of lids) l.scale.y = 1; }
    }
  }
  function hop() {
    gsap.fromTo(fx, { hop: 0 }, { hop: 1, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 1 });
    gsap.fromTo(fx, { wave: 0 }, { wave: 1, duration: 0.6, yoyo: true, repeat: 1, repeatDelay: 1.2 });
  }
  /**
   * Menyajikan soto: mangkuk muncul di tangan → tangan menjulur ke arah pembeli → onReach() (tangan sudah di ujung) →
   * ditahan sebentar → mangkuk dilepas (pembeli sudah memegangnya sendiri) → tangan kembali.
   * Mengembalikan Promise yang selesai saat mangkuk dilepas.
   */
  function serve(onReach) {
    gsap.killTweensOf(fx, 'give,bowl');
    return new Promise((resolve) => {
      const tl = gsap.timeline();
      tl.fromTo(fx, { bowl: 0 }, { bowl: 1, duration: 0.3, ease: 'back.out(2)' })
        .to(fx, { give: 1, duration: 0.8, ease: 'power2.inOut' }, '+=0.1')
        .add(() => onReach?.())
        .to({}, { duration: 0.7 })
        .to(fx, { bowl: 0, duration: 0.15, ease: 'power1.in' })
        .add(() => resolve())
        .to(fx, { give: 0, duration: 0.6, ease: 'power2.inOut' }, '+=0.1');
    });
  }
  function resetServe() { gsap.killTweensOf(fx, 'give,bowl'); fx.give = 0; fx.bowl = 0; }
  function dispose() {
    group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); } });
    gsap.killTweensOf(fx);
  }
  return { group, update, hop, serve, resetServe, fx, dispose };
}
