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
  function makeGlove(side) {
    const g = new THREE.Group();
    const mat = toon(GLOVE), W = 0.012;
    const palmGeo = new THREE.SphereGeometry(1, 28, 20); palmGeo.scale(0.13, 0.15, 0.07);
    g.add(part(palmGeo, mat, W));
    const finger = (pts, r) => {
      const geo = taperTube(pts.map((p) => new V3(...p)), () => r, 20, 10);
      g.add(part(geo, mat, W));
      const tip = part(new THREE.SphereGeometry(r, 14, 10), mat, W);
      tip.position.copy(geo.userData.end);
      g.add(tip);
    };
    // jari terbuka ke atas, sedikit mengipas (seperti melambai di gambar)
    finger([[-0.07, 0.1, 0], [-0.11, 0.2, 0], [-0.13, 0.28, 0]], 0.036);
    finger([[-0.02, 0.12, 0], [-0.03, 0.24, 0], [-0.035, 0.32, 0]], 0.038);
    finger([[0.03, 0.12, 0], [0.05, 0.23, 0], [0.06, 0.3, 0]], 0.037);
    finger([[0.08, 0.09, 0], [0.12, 0.18, 0], [0.14, 0.24, 0]], 0.033);
    finger([[side * 0.11, -0.02, 0.02], [side * 0.18, 0.04, 0.03], [side * 0.22, 0.1, 0.03]], 0.04);   // jempol
    const cuff = part(new THREE.CylinderGeometry(0.1, 0.115, 0.1, 24), toon(0xf0f1f2), W);
    cuff.position.y = -0.18;
    g.add(cuff);
    if (side < 0) g.scale.x = -1;
    return g;
  }
  const gloveL = makeGlove(-1);    // kiri layar, agak rendah
  gloveL.position.set(-0.86, 0.12, 0.12);
  gloveL.rotation.z = 0.5;
  root.add(gloveL);
  const gloveR = makeGlove(1);     // kanan layar, melambai
  gloveR.position.set(0.9, 0.52, 0.12);
  gloveR.rotation.z = -0.35;
  root.add(gloveR);

  // garis tinta & bayangan: karakter tidak memberi/menerima bayangan (di bawah terpal tetap cerah)
  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  /* ---- Animasi ---- */
  const fx = { hop: 0, wave: 0 };
  let wavePhase = 0;
  let nextBlink = 2 + Math.random() * 2, blinkT = -1;
  function update(t, dt = 1 / 60) {
    root.position.y = Math.sin(t * 2.1) * 0.02 + fx.hop * 0.22;
    root.scale.set(1 + fx.hop * -0.04, 1 + Math.sin(t * 2.1) * 0.012 + fx.hop * 0.06, 1);
    head.rotation.z = Math.sin(t * 1.3) * 0.045;
    head.rotation.y = Math.sin(t * 0.7) * 0.08;
    // fase diakumulasi (bukan t * speed) supaya perubahan kecepatan tidak membuat tangan melompat
    wavePhase += dt * (2.0 + fx.wave * 1.6);
    gloveR.rotation.z = -0.35 + Math.sin(wavePhase) * (0.28 + fx.wave * 0.2);
    gloveR.position.y = 0.52 + Math.sin(wavePhase * 0.5) * 0.02 + fx.wave * 0.1;
    gloveL.position.y = 0.12 + Math.sin(t * 2.1 + 1) * 0.03;
    gloveL.rotation.z = 0.5 + Math.sin(t * 1.6) * 0.06;
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
  function dispose() {
    group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); } });
    gsap.killTweensOf(fx);
  }
  return { group, update, hop, fx, dispose };
}
