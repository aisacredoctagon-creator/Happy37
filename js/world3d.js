// ============================================================
//  DUNIA 3D (Scene 5–10) — Three.js
//  Semua model di sini masih placeholder prosedural (primitif).
//  Nanti bisa diganti GLB: lihat fungsi build* di bawah.
// ============================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { gsap } from 'gsap';
import { CONFIG } from './config.js';
import { createShop, tagTexture } from './shop3d.js';
import { createStreet } from './street3d.js';

const DEG = Math.PI / 180;
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

// Ukuran koper
const W = 5, D = 3.4, HB = 0.9, HL = 0.55, T = 0.08;
const LID_OPEN = -105 * DEG;
const FOAM_TOP = T + 0.42;
const POCKET_D = 0.2;               // kedalaman kantong cetakan di busa bawah
const MOULD_Y = FOAM_TOP - 0.04;
const TRAIN_SCALE = 0.85;
const FLOAT_Y = 1.95;
// Kartu bagian di tutup koper: sengaja tidak putih bersih (lampu toko + tone mapping membuatnya silau)
const TILE_COLOR = 0x958a74;
const PLAQUE_TINT = 0x9e9786;

export function createWorld({ canvas, ui, onDone, onShopOpen, onStreetDone }) {
  /* ---------------- Renderer / scene / camera ---------------- */
  // Perangkat sentuh (HP/tablet): lebih ringan — tanpa antialias, pixel ratio ≤ 1.5, bayangan PCF biasa
  const lowPower = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = lowPower ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = gradientTexture('#4a3426', '#140d09');
  new THREE.TextureLoader().load(CONFIG.assets.s5_bg3d, (tx) => {
    tx.colorSpace = THREE.SRGBColorSpace;
    scene.background = tx;
  }, undefined, () => { /* belum ada → pakai gradient */ });
  scene.fog = new THREE.Fog(0x1a110c, 18, 45);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
  const lookAt = new THREE.Vector3();

  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a2a1e, 0.85));
  const sun = new THREE.DirectionalLight(0xffe2b8, 1.9);
  sun.position.set(4, 9, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const warm = new THREE.PointLight(0xffb36b, 6, 12, 2);
  warm.position.set(-3, 4, 3);
  scene.add(warm);

  // Meja kayu
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.85 }));
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);

  /* ---------------- Material ---------------- */
  const M = {
    // envMapIntensity: di dalam toko ada environment map; dikecilkan supaya kulit tidak pucat (tak berpengaruh di scene mandiri)
    leather: new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.72, envMapIntensity: 0.3 }),
    leatherDark: new THREE.MeshStandardMaterial({ color: 0x5a341d, roughness: 0.8, envMapIntensity: 0.3 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a54a, metalness: 0.85, roughness: 0.32 }),
    lining: new THREE.MeshStandardMaterial({ color: 0x7d1f2a, roughness: 0.95, envMapIntensity: 0.3 }),
    ghost: new THREE.MeshBasicMaterial({ color: 0x0b0c0f, transparent: true, opacity: 0.55, depthWrite: false }),
    ghostEdge: new THREE.LineBasicMaterial({ color: 0xe8c87a, transparent: true, opacity: 0.55 }),
  };

  const box = (w, h, d, mat, r = 0.025) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w * 0.45, h * 0.45, d * 0.45)), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };

  /* ---------------- KOPER: base ---------------- */
  // `base` (beserta tutup, gembok, kereta) adalah satu grup. Normalnya ia diletakkan DI DALAM etalase
  // scene toko antik (js/shop3d.js, skala mengecil) sehingga scene 4 → 5 satu ruang yang sama dan toko
  // menjadi latar scene 5–10. Kalau toko gagal dibangun → pakai scene mandiri (meja + gradien) di bawah.
  const base = new THREE.Group();
  let shop = null;
  let mode = 'case'; // 'shop' = shop3d yang mengatur kamera | 'street' = street3d (scene 3) | 'case' = dunia koper yang mengatur kamera
  // Jalan Surabaya (scene 3) dibangun saat pertama dibutuhkan, supaya tidak memperlambat pemuatan awal
  let street = null;
  const getStreet = () => (street ??= createStreet({ renderer, canvas, ui, onDone: () => onStreetDone?.() }));
  try {
    shop = createShop({
      renderer, canvas, ui, caseRoot: base,
      onOpen: () => { onShopOpen?.(); enter(5, { seamless: true }); },
    });
  } catch (err) {
    console.warn('Toko antik 3D gagal dibangun, scene koper berdiri sendiri:', err);
    shop = null;
  }
  if (!shop) scene.add(base);
  const cam = shop ? shop.camera : camera;
  base.add(at(box(W, T, D, M.leather), 0, T / 2, 0));
  base.add(at(box(W, HB, T, M.leather), 0, HB / 2, D / 2 - T / 2));
  base.add(at(box(W, HB, T, M.leather), 0, HB / 2, -D / 2 + T / 2));
  base.add(at(box(T, HB, D - 2 * T, M.leather), W / 2 - T / 2, HB / 2, 0));
  base.add(at(box(T, HB, D - 2 * T, M.leather), -W / 2 + T / 2, HB / 2, 0));
  // Busa bagian bawah dibangun setelah cetakan kereta (lihat buildFoamTray di bawah): ia butuh posisi ghost untuk memotong kantongnya.
  // pinggiran atas (trim)
  base.add(at(box(W + 0.02, 0.05, 0.1, M.leatherDark, 0.02), 0, HB - 0.025, D / 2 - 0.04));
  // sudut kuningan
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    base.add(at(box(0.22, 0.22, 0.22, M.brass, 0.06), sx * (W / 2 - 0.08), 0.1, sz * (D / 2 - 0.08)));
  }

  // Latch
  const latches = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    g.position.set(sx * 1.9, HB - 0.06, D / 2 + 0.01);
    const plate = at(box(0.34, 0.26, 0.06, M.brass, 0.03), 0, 0, 0.03);
    g.add(plate);
    base.add(g);
    return g;
  });

  /* ---------------- GEMBOK KODE ---------------- */
  const lock = new THREE.Group();
  lock.position.set(0, HB * 0.48, D / 2);
  base.add(lock);
  lock.add(at(box(1.3, 0.64, 0.06, M.brass, 0.05), 0, 0, 0.03));
  lock.add(at(box(1.16, 0.4, 0.04, new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.9 }), 0.02), 0, 0, 0.065));

  const WHEEL_R = 0.16, WHEEL_W = 0.17, STEP = 36 * DEG;
  // Bingkai jendela: hanya digit tengah yang terlihat jelas
  for (const sy of [1, -1]) {
    lock.add(at(box(1.04, 0.14, 0.03, M.brass, 0.012), 0, sy * 0.123, 0.305));
  }
  const digitMats = Array.from({ length: 10 }, (_, i) => new THREE.MeshStandardMaterial({
    map: digitTexture(i), roughness: 0.55, metalness: 0.05,
  }));
  const lockTargets = [];
  // Panah (desain Figma): segitiga #FAEDB7 di tengah bilah bingkai (y = ±0.123), di depan permukaannya (z 0.305 + 0.015)
  // Tombol timbul (tebal 0.014 + bevel) supaya terasa seperti tombol fisik yang bisa ditekan (lihat pressArrow / releaseArrow)
  const ARROW_Y = 0.123, ARROW_Z = 0.318, ARROW_Z_PRESSED = 0.311, ARROW_W = 0.07, ARROW_H = 0.06;
  const ARROW_GEO = new THREE.ExtrudeGeometry(new THREE.Shape([
    new THREE.Vector2(0, ARROW_H / 2), new THREE.Vector2(-ARROW_W / 2, -ARROW_H / 2), new THREE.Vector2(ARROW_W / 2, -ARROW_H / 2),
  ]), { depth: 0.014, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
  const arrowMat = new THREE.MeshStandardMaterial({ color: 0xf2d98a, emissive: 0xc9a54a, emissiveIntensity: 0.12, roughness: 0.6, metalness: 0 });
  const ARROW_REST = arrowMat.color.clone(), ARROW_DOWN = arrowMat.color.clone().multiplyScalar(0.72);
  // Tiga keadaan tombol:
  //   rest  – diam
  //   hover – kursor di atasnya: membesar sedikit, terangkat & bersinar
  //   press – ditekan: mengecil, tenggelam ke bingkai & menggelap. Lepas → memantul kembali (overshoot kecil).
  const ARROW_STATE = {
    rest:  { s: 1,    z: ARROW_Z,         c: ARROW_REST, e: 0.12 },
    hover: { s: 1.14, z: ARROW_Z + 0.006, c: ARROW_REST, e: 0.45 },
    press: { s: 0.86, z: ARROW_Z_PRESSED, c: ARROW_DOWN, e: 0 },
  };
  const setArrow = (a, name, { duration = 0.18, ease = 'power2.out' } = {}) => {
    const st = ARROW_STATE[name];
    gsap.killTweensOf([a.scale, a.position, a.material.color, a.material]);
    gsap.to(a.scale, { x: st.s, y: st.s, duration, ease });
    gsap.to(a.position, { z: st.z, duration, ease });
    gsap.to(a.material.color, { r: st.c.r, g: st.c.g, b: st.c.b, duration });
    gsap.to(a.material, { emissiveIntensity: st.e, duration });
  };
  let pressedArrow = null, hoveredArrow = null;
  const pressArrow = (a) => setArrow(a, 'press', { duration: 0.06 });
  // lepas: kalau kursor masih di atasnya → kembali ke hover, kalau tidak → rest
  const releaseArrow = (a) => setArrow(a, a === hoveredArrow ? 'hover' : 'rest', { duration: 0.38, ease: 'elastic.out(1.1, 0.4)' });
  function hoverArrowAt(a) {
    if (a === hoveredArrow) return;
    const prev = hoveredArrow;
    hoveredArrow = a;
    if (prev && prev !== pressedArrow) setArrow(prev, 'rest', { duration: 0.22 });
    if (a && a !== pressedArrow) setArrow(a, 'hover');
  }
  const wheels =[0, 1, 2, 3].map((i) => {
    const g = new THREE.Group();
    g.position.set((i - 1.5) * 0.24, 0, 0.13);
    lock.add(g);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R * 0.99, WHEEL_R * 0.99, WHEEL_W * 0.98, 10), M.brass);
    core.rotation.z = Math.PI / 2;
    g.add(core);
    const faceH = 2 * WHEEL_R * Math.tan(18 * DEG);
    for (let d = 0; d < 10; d++) {
      const piv = new THREE.Group();
      piv.rotation.x = -d * STEP;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(WHEEL_W, faceH), digitMats[d]);
      face.position.z = WHEEL_R;
      face.userData.wheel = i;
      piv.add(face);
      g.add(piv);
      lockTargets.push(face);
    }
    core.userData.wheel = i;
    lockTargets.push(core);
    // panah atas / bawah: segitiga kuning-emas yang sama, diletakkan di bingkai kuningan tepat di atas / bawah angka
    for (const dir of [1, -1]) {
      const arrow = new THREE.Mesh(ARROW_GEO, arrowMat.clone());   // material sendiri → bisa menggelap sendiri-sendiri saat ditekan
      arrow.position.set(g.position.x, dir * ARROW_Y, ARROW_Z);
      if (dir < 0) arrow.rotation.z = Math.PI;
      arrow.userData = { wheel: i, dir };
      lock.add(arrow);
      lockTargets.push(arrow);
    }
    return { group: g, idx: 0 };
  });

  /* ---------------- KOPER: tutup (lid) ---------------- */
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, HB, -D / 2);
  base.add(lidPivot);
  lidPivot.add(at(box(W, T, D, M.leather), 0, HL - T / 2, D / 2));
  lidPivot.add(at(box(W, HL, T, M.leather), 0, HL / 2, D - T / 2));
  lidPivot.add(at(box(W, HL, T, M.leather), 0, HL / 2, T / 2));
  lidPivot.add(at(box(T, HL, D - 2 * T, M.leather), W / 2 - T / 2, HL / 2, D / 2));
  lidPivot.add(at(box(T, HL, D - 2 * T, M.leather), -W / 2 + T / 2, HL / 2, D / 2));
  for (const sx of [-1, 1]) for (const sz of [0, 1]) {
    lidPivot.add(at(box(0.22, 0.22, 0.22, M.brass, 0.06), sx * (W / 2 - 0.08), HL - 0.1, sz ? D - 0.08 : 0.08));
  }
  // Pegangan: menempel di muka depan tutup (satu bidang dengan gembok), melengkung di dalam tinggi tutup, tepat di atas gembok
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 10, 28, Math.PI), M.leatherDark);
  handle.position.set(0, HL - 0.1, D + 0.03);   // dicerminkan atas-bawah: lengkung ∪ menggantung dari sisi atas muka tutup
  handle.rotation.z = Math.PI;
  handle.castShadow = true;
  lidPivot.add(handle);

  // Tali kulit, stiker perjalanan & label — terlihat jelas dari etalase (scene 4)
  for (const sx of [-1.47, 1.47]) {
    lidPivot.add(at(box(0.2, 0.03, D + 0.03, M.leatherDark, 0.01), sx, HL + 0.005, D / 2));
    lidPivot.add(at(box(0.2, HL, 0.04, M.leatherDark, 0.01), sx, HL / 2, D + 0.01));
    base.add(at(box(0.2, HB + 0.02, 0.04, M.leatherDark, 0.01), sx, HB / 2, D / 2 + 0.01));
  }
  for (const [col, x, z, rot, s] of [[0x2f5d7a, -0.8, 1.25, 0.3, 0.32], [0xa8452e, 2.05, 1.0, 0.1, 0.26], [0xe3b341, 0.55, 0.85, 0.6, 0.23]]) {
    const st = new THREE.Mesh(new THREE.CircleGeometry(s, 24), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }));
    st.rotation.set(-Math.PI / 2, 0, rot);
    st.position.set(x, HL + 0.025, z);
    st.receiveShadow = true;
    lidPivot.add(st);
  }
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.34), new THREE.MeshStandardMaterial({ map: tagTexture(), roughness: 0.8, side: THREE.DoubleSide }));
  tag.rotation.x = -0.14; tag.castShadow = true;
  lidPivot.add(at(tag, -0.9, HL - 0.3, D + 0.09));
  lidPivot.add(at(box(0.012, 0.28, 0.012, M.leatherDark), -0.9, HL - 0.03, D + 0.075));

  // Frame dalam tutup: x kanan, y atas (saat terbuka), z keluar ke arah kamera
  const lidInner = new THREE.Group();
  lidInner.position.set(0, HL - T, D / 2);
  lidInner.rotation.x = Math.PI / 2;
  lidPivot.add(lidInner);
  const liningPlane = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * T, D - 2 * T), M.lining);
  liningPlane.position.z = 0.002;
  liningPlane.receiveShadow = true;
  lidInner.add(liningPlane);

  /* ---------------- KERETA + CETAKAN ---------------- */
  const trainRoot = new THREE.Group(); // diangkat saat floating
  trainRoot.position.set(0, MOULD_Y, 0);
  base.add(trainRoot);
  const train = new THREE.Group(); // diputar user
  train.scale.setScalar(TRAIN_SCALE);
  trainRoot.add(train);
  // Selama bagian-bagian dipasang (scene 6–8) cetakan kereta + bagian yang sudah terpasang "terbaring miring" di busa
  // (sisi berlogo menghadap ke atas, atap ke arah tutup). Setelah semua terpasang kereta berputar tegak kembali (assemble()).
  // Rotasi −90° pada sumbu x: z lokal → y dunia, y lokal → −z dunia. Posisi: bertumpu di permukaan busa & berpusat di tengah kedalaman koper.
  // y turun sedalam kantong busa (POCKET_D) → kereta "terbenam" di cetakannya, bukan melayang di atas permukaan busa.
  const SIDE_POSE = { rx: -Math.PI / 2, y: 0.34 - POCKET_D + 0.012, z: 0.45 };
  function setTrainSideways() {
    train.rotation.set(SIDE_POSE.rx, 0, 0);
    train.position.set(0, SIDE_POSE.y, SIDE_POSE.z);
  }
  setTrainSideways();

  const tileTargets = [];
  const parts = CONFIG.parts.map((cfg, i) => {
    const model = buildPartModel(cfg.id, cfg);
    const bb = new THREE.Box3().setFromObject(model);
    const center = bb.getCenter(new THREE.Vector3());
    const size = bb.getSize(new THREE.Vector3());
    model.position.sub(center);

    const obj = new THREE.Group();
    obj.add(model);

    // Ghost di cetakan
    const ghost = new THREE.Group();
    ghost.position.copy(center);
    const gm = model.clone(true);
    const carved = [];
    gm.traverse((o) => { if (o.userData.isEngrave) carved.push(o); });
    carved.forEach((o) => o.removeFromParent());   // cetakan tidak perlu stiker tulisan
    gm.traverse((o) => {
      if (o.isMesh) {
        o.material = M.ghost;
        o.castShadow = false;
        // detail kecil (pegas, rusuk, kisi…) tanpa garis tepi → cetakan tetap bersih
        if (!o.userData.fine) o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 35), M.ghostEdge));
      }
    });
    ghost.add(gm);
    train.add(ghost);

    // Tulisan terukir di badan bagian ini (scene 7 → 8: "ultra zoom-in")
    const engrave = model.userData.engrave;

    // Tile di dalam tutup (grid 3x3)
    const col = colFor(cfg.id), row = rowFor(cfg.id);
    const tile = new THREE.Group();
    tile.position.set((col - 1) * 1.55, (1 - row) * 1.02, 0);
    lidInner.add(tile);
    const tileMat = new THREE.MeshStandardMaterial({ color: TILE_COLOR, roughness: 0.95, emissive: 0xffc46b, emissiveIntensity: 0, envMapIntensity: 0.3 });
    const card = at(box(1.46, 0.94, 0.04, tileMat, 0.03), 0, 0, 0.02);
    tile.add(card);
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.28),
      new THREE.MeshStandardMaterial({ map: plaqueTexture(cfg), color: PLAQUE_TINT, roughness: 0.9, envMapIntensity: 0.3 }));
    plaque.position.set(0, -0.29, 0.045);
    tile.add(plaque);

    const s = Math.min(1.25 / size.x, 0.46 / size.y, 0.85);
    obj.scale.setScalar(s);
    obj.position.set(0, 0.13, 0.045 + (size.z * s) / 2);
    tile.add(obj);

    const home = { pos: obj.position.clone(), quat: obj.quaternion.clone(), scale: obj.scale.clone() };
    tile.traverse((o) => { o.userData.part = i; });
    tileTargets.push(tile);

    return { cfg, i, obj, ghost, tile, tileMat, plaque, engrave, center, home, placed: false, glow: { v: 0 }, glowMats: null };
  });

  /* ---------------- BUSA BAWAH: nampan berkantong (moulding) ---------------- */
  // Dua lapis, seperti koper instrumen sungguhan: lapisan dasar polos + lapisan atas hasil EKSTRUSI yang
  // dilubangi mengikuti jejak tiap gerbong (kantong dengan sudut membulat & takik jari di sisi depan).
  // Kantong dihitung dari posisi ghost sebenarnya → selalu pas walaupun kereta digeser / diskalakan.
  buildFoamTray();
  function buildFoamTray() {
    const PD = POCKET_D;                  // kedalaman kantong
    const Y0 = FOAM_TOP - PD;             // lantai kantong
    const BT = 0.022;                     // tebal bevel (tepi busa membulat)
    const IW = W - 2 * T, ID = D - 2 * T;

    // jejak (x,z) tiap gerbong dalam ruang lokal koper
    base.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(base.matrixWorld).invert();
    const cols = [0, 1, 2].map(() => new THREE.Box3());
    parts.forEach((p) => {
      p.ghost.updateWorldMatrix(true, true);
      const rel = new THREE.Matrix4();
      p.ghost.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        rel.multiplyMatrices(inv, o.matrixWorld);
        cols[colFor(p.cfg.id)].union(o.geometry.boundingBox.clone().applyMatrix4(rel));
      });
    });

    const MARGIN = 0.07, GAP = 0.16, R = 0.1;
    const pockets = cols.map((b) => ({ x0: b.min.x - MARGIN, x1: b.max.x + MARGIN, z0: b.min.z - MARGIN, z1: b.max.z + MARGIN }));
    pockets.sort((a, b) => a.x0 - b.x0);
    for (let i = 1; i < pockets.length; i++) {     // sisakan sekat busa antar kantong
      const over = pockets[i - 1].x1 + GAP - pockets[i].x0;
      if (over > 0) { pockets[i - 1].x1 -= over / 2; pockets[i].x0 += over / 2; }
    }

    // kantong → Path 2D (x, y = −z, karena mesh nanti diputar −90° pada sumbu x). Takik jari bulat di tepi depan (z maks).
    function pocketPath({ x0, x1, z0, z1 }, notchR) {
      const yb = -z1, yt = -z0, xc = (x0 + x1) / 2, r = Math.min(R, (x1 - x0) / 4, (yt - yb) / 4);
      const p = new THREE.Path();
      p.moveTo(x0 + r, yb);
      if (notchR) { p.lineTo(xc - notchR, yb); p.absarc(xc, yb, notchR, Math.PI, 2 * Math.PI, false); }
      p.lineTo(x1 - r, yb); p.absarc(x1 - r, yb + r, r, -Math.PI / 2, 0, false);
      p.lineTo(x1, yt - r); p.absarc(x1 - r, yt - r, r, 0, Math.PI / 2, false);
      p.lineTo(x0 + r, yt); p.absarc(x0 + r, yt - r, r, Math.PI / 2, Math.PI, false);
      p.lineTo(x0, yb + r); p.absarc(x0 + r, yb + r, r, Math.PI, Math.PI * 1.5, false);
      return p;
    }

    const ow = IW - 2 * BT, od = ID - 2 * BT;
    const outline = new THREE.Shape();
    outline.moveTo(-ow / 2, -od / 2); outline.lineTo(ow / 2, -od / 2); outline.lineTo(ow / 2, od / 2); outline.lineTo(-ow / 2, od / 2); outline.closePath();
    pockets.forEach((pk) => outline.holes.push(pocketPath(pk, 0.2)));

    // Kantong kecil untuk aksesori di depan (kunci, kain lap, dsb.) — mengisi ruang kosong di depan gerbong
    const frontZ = Math.max(...pockets.map((pk) => pk.z1)) + 0.42;
    const accZ1 = ID / 2 - 0.16;
    if (accZ1 - frontZ > 0.3) {
      const accW = 1.2, gapX = 0.3;
      [[-IW / 2 + 0.3, -IW / 2 + 0.3 + accW], [-IW / 2 + 0.3 + accW + gapX, -IW / 2 + 0.3 + 2 * accW + gapX]].forEach(([ax0, ax1]) =>
        outline.holes.push(pocketPath({ x0: ax0, x1: ax1, z0: frontZ, z1: accZ1 }, 0)));
    }

    const layer = new THREE.ExtrudeGeometry(outline, {
      depth: PD - 2 * BT, bevelEnabled: true, bevelThickness: BT, bevelSize: BT, bevelOffset: 0, bevelSegments: 2, curveSegments: 10,
    });
    layer.rotateX(-Math.PI / 2);        // y bentuk → −z dunia, ekstrusi → naik (+y)
    // Butiran busa: noise halus sebagai map + bump, supaya permukaannya tidak terlihat seperti plastik polos.
    // UV lapisan atas = koordinat bentuk (1 satuan = 1 ulangan); UV lapisan dasar 0..1 per sisi → repeat disesuaikan ukurannya.
    const grain = (rx, ry) => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, 128, 128);
      let s = 7;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 1400; i++) {
        const v = 150 + Math.floor(rnd() * 105), r = 0.6 + rnd() * 1.5;
        g.fillStyle = `rgba(${v},${v},${v},0.55)`;
        g.beginPath(); g.arc(rnd() * 128, rnd() * 128, r, 0, 7); g.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.anisotropy = 4;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const foamLayerMat = new THREE.MeshStandardMaterial({ color: 0x1d1f23, map: grain(7, 7), roughness: 1, envMapIntensity: 0.3 });
    foamLayerMat.bumpMap = foamLayerMat.map; foamLayerMat.bumpScale = 1.4;
    const foamFloorMat = foamLayerMat.clone();
    foamFloorMat.color.set(0x141519);   // dasar kantong sedikit lebih gelap → kedalaman terbaca
    foamFloorMat.map = grain(IW * 7, ID * 7); foamFloorMat.bumpMap = foamFloorMat.map;

    const top = new THREE.Mesh(layer, foamLayerMat);
    top.position.y = Y0 + BT;
    top.castShadow = top.receiveShadow = true;
    base.add(top);

    // lapisan dasar (lantai kantong), sedikit menyusup ke bawah lapisan atas supaya tak ada celah
    base.add(at(box(IW, Y0 - T + 0.02, ID, foamFloorMat, 0.01), 0, T + (Y0 - T + 0.02) / 2, 0));
  }


  /* ---------------- Kamera / view ---------------- */
  // Semua view dihitung dalam satuan LOKAL koper (lebar koper = 5), lalu dikonversi ke dunia
  // tiap frame (applyCam). Di dalam toko koper itu diskalakan & sedikit diputar — kamera ikut.
  const tmpV = new THREE.Vector3();
  const baseInv = new THREE.Matrix4();
  const toLocalPos = (v) => base.worldToLocal(v);
  const toLocalDir = (v) => v.transformDirection(baseInv);
  function computeView(v) {
    base.updateWorldMatrix(true, true);
    baseInv.copy(base.matrixWorld).invert();
    let target, dir, w, hgt, up = null;
    switch (v.name) {
      case 'intro': target = new THREE.Vector3(0, 0.4, 0); dir = new THREE.Vector3(0.25, 1.1, 1.4); w = 10; hgt = 7; break;
      case 'lock': target = toLocalPos(lock.getWorldPosition(new THREE.Vector3())); dir = new THREE.Vector3(0, 0.16, 1); w = 1.45; hgt = 0.95; break;
      case 'closed': target = new THREE.Vector3(0, 0.6, 0); dir = new THREE.Vector3(0, 0.85, 1.2); w = 6.2; hgt = 3.6; break;
      case 'open': target = new THREE.Vector3(0, 2.25, -0.7); dir = new THREE.Vector3(0, 0.5, 1); w = 5.6; hgt = 5.3; break;
      case 'part1': {
        const p = parts[v.index];
        target = toLocalPos(p.tile.getWorldPosition(new THREE.Vector3()));
        dir = toLocalDir(p.tile.getWorldDirection(new THREE.Vector3())).add(new THREE.Vector3(0, 0.15, 0));
        w = 3.0; hgt = 2.0; break;
      }
      case 'part2': {
        const p = parts[v.index];
        target = toLocalPos(p.plaque.getWorldPosition(new THREE.Vector3()));
        dir = toLocalDir(p.plaque.getWorldDirection(new THREE.Vector3()));
        w = 1.4; hgt = 0.5; break;
      }
      case 'engrave': {
        // "Ultra zoom-in": kamera mendekat ke plat kecil di badan bagian kereta sampai tulisan terukirnya memenuhi layar.
        // Plat bisa menghadap ke atas (atap) → kamera ikut memutar arah "atas"-nya supaya tulisan tetap terbaca tegak.
        const p = parts[v.index], pl = p.engrave.spot;
        pl.updateWorldMatrix(true, false);
        target = toLocalPos(pl.getWorldPosition(new THREE.Vector3()));
        const n = toLocalDir(pl.getWorldDirection(new THREE.Vector3()));
        up = toLocalDir(new THREE.Vector3(0, 1, 0).transformDirection(pl.matrixWorld)).normalize();
        const tileN = toLocalDir(p.tile.getWorldDirection(new THREE.Vector3()));
        dir = n.clone().add(tileN.multiplyScalar(p.engrave.tilt));
        if (!p.engrave.tilt) dir.add(new THREE.Vector3(0, 0.08, 0));   // tulisan di sisi: sedikit dari atas, seperti view kartu
        const sc = pl.getWorldScale(new THREE.Vector3()).x / base.getWorldScale(new THREE.Vector3()).x;   // satuan model → satuan lokal koper
        w = pl.geometry.parameters.width * sc * 1.12;
        hgt = pl.geometry.parameters.height * sc;
        break;
      }
      case 'train': target = new THREE.Vector3(0, FLOAT_Y + 0.4, 0); dir = new THREE.Vector3(0, 0.35, 1); w = 5.4; hgt = 2.6; break;      default: throw new Error('view? ' + v.name);
    }
    const tanHalf = Math.tan((cam.fov / 2) * DEG);
    const portrait = cam.aspect < 0.85;
    const hPad = portrait ? 1.5 : 1.3; // sisakan ruang untuk caption di bawah
    const dist = Math.max((hgt * hPad) / 2 / tanHalf, (w * 1.08) / 2 / (tanHalf * cam.aspect));
    const pos = target.clone().add(dir.normalize().multiplyScalar(dist));
    const upV = up ?? new THREE.Vector3(0, 1, 0);
    const look = target.clone().addScaledVector(upV, -hgt * (portrait ? 0.2 : 0.12));
    return { pos, look, up: upV };
  }

  let currentView = { name: 'intro' };
  let camTween = null;
  const camPos = new THREE.Vector3();   // pose kamera dalam ruang lokal koper
  const tmpLook = new THREE.Vector3();
  const camUpL = new THREE.Vector3(0, 1, 0);   // arah "atas" kamera dalam ruang lokal koper (berubah di view 'engrave' untuk plat di atap)
  function applyCam() {
    base.updateWorldMatrix(true, false);
    cam.position.copy(camPos);
    base.localToWorld(cam.position);
    base.localToWorld(tmpLook.copy(lookAt));
    cam.up.copy(camUpL).transformDirection(base.matrixWorld);
    cam.lookAt(tmpLook);
  }
  function setView(v) {
    currentView = v;
    const { pos, look, up } = computeView(v);
    camPos.copy(pos);
    lookAt.copy(look);
    camUpL.copy(up);
    applyCam();
  }
  /** Mulai dari pose kamera dunia tertentu (mis. kamera toko saat koper diketuk) → mulus tanpa lompatan. */
  function setViewFromWorld(pose) {
    base.updateWorldMatrix(true, false);
    camPos.copy(toLocalPos(pose.pos.clone()));
    lookAt.copy(toLocalPos(pose.look.clone()));
    camUpL.set(0, 1, 0);
    applyCam();
  }
  function flyTo(v, duration = 1.2, ease = 'power2.inOut') {
    currentView = v;
    camTween?.kill();
    const { pos, look, up } = computeView(v);
    const fp = camPos.clone(), fl = lookAt.clone(), fu = camUpL.clone();
    const p = { t: 0 };
    return new Promise((resolve) => {
      camTween = gsap.to(p, {
        t: 1, duration, ease,
        onUpdate: () => {
          camPos.lerpVectors(fp, pos, p.t);
          lookAt.lerpVectors(fl, look, p.t);
          camUpL.lerpVectors(fu, up, p.t).normalize();
          applyCam();
        },
        onComplete: () => { camTween = null; resolve(); },
      });
    });
  }

  /* ---------------- State ---------------- */
  let state = 'idle';
  let placedCount = 0;
  let rotAccum = 0, rotVel = 0, closeShown = false;
  let floating = false;

  // epoch naik setiap reset() → rangkaian async lama (unlock / openPart / assemble / closeCase) yang
  // masih menunggu jadi "menggantung" dan tidak lanjut membajak kamera / state setelah lompat scene.
  let epoch = 0;
  const wait = (s) => {
    const e = epoch;
    return new Promise((r) => setTimeout(() => { if (e === epoch) r(); }, s * 1000));
  };

  function reset() {
    epoch++;
    gsap.killTweensOf([lidPivot.rotation, trainRoot.position, train.rotation, train.position,
      ...latches.map((l) => l.rotation), ...wheels.map((w) => w.group.rotation),
      ...parts.map((p) => p.obj.position)]);
    placeTween?.kill(); placeTween = null;
    camTween?.kill(); camTween = null;
    lidPivot.rotation.x = 0;
    latches.forEach((l) => { l.rotation.x = 0; l.position.z = D / 2 + 0.01; });
    wheels.forEach((w) => { w.idx = 0; w.group.rotation.x = 0; });
    trainRoot.position.set(0, MOULD_Y, 0);
    setTrainSideways();
    parts.forEach((p) => {
      p.tile.add(p.obj);
      p.obj.position.copy(p.home.pos);
      p.obj.quaternion.copy(p.home.quat);
      p.obj.scale.copy(p.home.scale);
      p.ghost.visible = true;
      p.placed = false;
      p.tileMat.color.set(TILE_COLOR);
      p.tileMat.emissiveIntensity = 0;
      gsap.killTweensOf([p.glow, p.obj.scale]);   // hapus sisa efek hover scene 10
      p.glow.v = 0;
      if (p.glowMats) for (const { m, c } of p.glowMats) m.emissive.copy(c);
    });
    hoverPart = null;
    camUpL.set(0, 1, 0);
    cam.up.set(0, 1, 0);
    placedCount = 0; rotAccum = 0; rotVel = 0; closeShown = false; floating = false;
    ui.counter(null); ui.hint(null); ui.hideAction();
  }

  /** Scene 4. Melempar error kalau toko tidak tersedia → main.js memakai scene 2D sebagai cadangan. */
  function enterShop() {
    if (!shop) throw new Error('Toko antik 3D tidak tersedia');
    resize();
    reset();
    street?.leave();
    state = 'idle';
    mode = 'shop';
    return shop.enter();
  }

  /** Scene 3. Melempar error kalau gagal dibangun → main.js memakai scene 2D sebagai cadangan. */
  function enterStreet() {
    const s = getStreet();
    shop?.leave();
    reset();
    state = 'idle';
    mode = 'street';
    resize();
    return s.enter();
  }

  /**
   * Masuk ke dunia koper pada stage tertentu (5, 6, atau 9).
   * seamless: dipanggil saat koper diketuk di toko → kamera langsung terbang dari posisi sekarang ke gembok.
   */
  async function enter(stage = 5, { seamless = false } = {}) {
    mode = 'case';
    street?.leave();
    const startPose = shop && seamless ? shop.getCamPose() : null;
    if (shop && !seamless) shop.showCaseMode();
    reset();
    if (stage >= 6) {
      CONFIG.lockCode.forEach((d, i) => { wheels[i].idx = d; wheels[i].group.rotation.x = d * STEP; });
      lidPivot.rotation.x = LID_OPEN;
      latches.forEach((l) => { l.rotation.x = -0.9; });
    }
    if (stage >= 9) {
      parts.forEach((p) => placeInstant(p));
      setView({ name: 'open' });
      return assemble();
    }
    if (stage >= 6) {
      setView({ name: 'open' });
      toParts();
      return;
    }
    if (startPose) setViewFromWorld(startPose);
    else setView({ name: 'intro' });
    ui.setStage(5);
    state = 'busy';
    await flyTo({ name: 'lock' }, startPose ? 3.1 : 2.2, startPose ? 'power2.inOut' : 'power3.inOut');
    state = 'lock';
    ui.hint('▲ / ▼ ketuk roda angka');
  }

  function toParts() {
    state = 'parts';
    ui.setStage(6);
    ui.counter(`${placedCount}/9 bagian terpasang`);
    ui.hint(null);
  }

  /* ---- Scene 5: gembok ---- */
  function spin(i, dir) {
    const w = wheels[i];
    w.idx += dir;
    gsap.to(w.group.rotation, { x: w.idx * STEP, duration: 0.28, ease: 'back.out(1.6)' });
    const code = wheels.map((x) => ((x.idx % 10) + 10) % 10);
    if (code.every((d, k) => d === CONFIG.lockCode[k])) unlock();
  }

  async function unlock() {
    state = 'busy';
    ui.hint(null);
    ui.caption('Klik! Kodenya benar…');
    await wait(0.35);
    latches.forEach((l, k) => gsap.to(l.rotation, { x: -0.9, duration: 0.35, delay: k * 0.12, ease: 'back.out(3)' }));
    await wait(0.5);
    await flyTo({ name: 'closed' }, 1.0);
    gsap.to(lidPivot.rotation, { x: LID_OPEN, duration: 1.8, ease: 'power2.inOut' });
    await flyTo({ name: 'open' }, 2.0, 'power2.inOut');
    toParts();
  }

  /* ---- Scene 6–8: buka bagian & pasang ---- */
  // Alur per bagian (desain Figma "Ultra zoom-in"):
  //   scene 7: zoom ke kartu bagian
  //   scene 8: "ultra zoom-in" ke tulisan kecil yang terukir di badan bagian → judul + 8 kalimat terbaca; tombol ✕ untuk menutup, lalu bagian dipasang
  // from: 'start' = alur normal | 'note' = langsung ke scene 8 (kamera sudah di tulisan; dipakai debug)
  async function openPart(i, from = 'start') {
    const p = parts[i];
    state = 'busy';
    ui.counter(null);
    if (from === 'start') {
      ui.setStage(7);
      ui.flash(1.0);
      await flyTo({ name: 'part1', index: i }, 1.1, 'power2.inOut');
      await wait(0.3);
      await flyTo({ name: 'engrave', index: i }, 1.1, 'power3.inOut');
    }
    ui.setStage(8);
    await ui.openNote(p.cfg, { engraved: true });
    ui.flash(0.6);
    await flyTo({ name: 'open' }, 1.2, 'power2.inOut');
    await placePart(p);
  }

  function placeInstant(p) {
    train.add(p.obj);
    p.obj.position.copy(p.center);
    p.obj.quaternion.identity();
    p.obj.scale.setScalar(1);
    p.ghost.visible = false;
    p.placed = true;
    p.tileMat.color.set(0x5c5448);
    placedCount++;
  }

  let placeTween = null;
  function placePart(p) {
    return new Promise((resolve) => {
      train.attach(p.obj);
      const a = p.obj.position.clone();
      const b = p.center.clone();
      // arah "atas / depan" dunia (koper) dinyatakan dalam sumbu lokal kereta, karena kereta sedang terbaring miring
      const invQ = train.quaternion.clone().invert();
      const toLocal = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(invQ);
      const mid = a.clone().lerp(b, 0.5).add(toLocal(0, 1.4, 0.6));
      const qa = p.obj.quaternion.clone(), qb = new THREE.Quaternion();
      const sa = p.obj.scale.x;
      const t = { v: 0 };
      p.tileMat.color.set(0x5c5448);
      p.tileMat.emissiveIntensity = 0;
      placeTween = gsap.to(t, {
        v: 1, duration: 1.15, ease: 'power2.inOut',
        onUpdate: () => {
          const u = t.v, iu = 1 - u;
          p.obj.position.set(
            iu * iu * a.x + 2 * iu * u * mid.x + u * u * b.x,
            iu * iu * a.y + 2 * iu * u * mid.y + u * u * b.y,
            iu * iu * a.z + 2 * iu * u * mid.z + u * u * b.z);
          p.obj.quaternion.slerpQuaternions(qa, qb, u);
          p.obj.scale.setScalar(sa + (1 - sa) * u);
        },
        onComplete: () => {
          p.ghost.visible = false;
          p.placed = true;
          placedCount++;
          const bo = toLocal(0, 0.08, 0);   // pantulan kecil "ke atas" (dunia)
          gsap.fromTo(p.obj.position, { x: b.x + bo.x, y: b.y + bo.y, z: b.z + bo.z }, { x: b.x, y: b.y, z: b.z, duration: 0.35, ease: 'bounce.out' });
          if (placedCount >= parts.length) assemble();
          else {
            toParts();
            ui.caption(`Terpasang! Tinggal ${parts.length - placedCount} bagian lagi.`);
          }
          resolve();
        },
      });
    });
  }

  /* ---- Scene 9–10: kereta melayang & diputar ---- */
  async function assemble() {
    state = 'busy';
    ui.counter(null);
    ui.caption('Semua bagian terpasang!');
    await wait(0.5);
    // kereta yang terbaring miring berputar tegak kembali (bentuk seperti sebelumnya) sambil terangkat melayang
    gsap.to(train.rotation, { x: 0, duration: 1.7, ease: 'power2.inOut' });
    gsap.to(train.position, { y: 0, z: 0, duration: 1.7, ease: 'power2.inOut' });
    gsap.to(trainRoot.position, { y: FLOAT_Y, z: 0.6, duration: 1.8, ease: 'power2.inOut', onComplete: () => { floating = true; } });
    await flyTo({ name: 'train' }, 1.9);
    state = 'train';
    ui.setStage(9);
    ui.hint(HINT_TRAIN);
  }

  async function closeCase() {
    state = 'busy';
    setHover(null);
    floating = false;
    ui.hideAction();
    ui.hint(null);
    ui.caption('Menutup koper…');
    const fullTurns = Math.round(train.rotation.y / (2 * Math.PI)) * 2 * Math.PI;
    gsap.to(train.rotation, { y: fullTurns, x: 0, duration: 1.0, ease: 'power2.inOut' });
    await flyTo({ name: 'open' }, 1.0);
    // kereta direbahkan lagi ke posisi terbaring miring seperti sebelum dirakit, sambil turun ke cetakan
    gsap.to(train.rotation, { x: SIDE_POSE.rx, y: fullTurns, z: 0, duration: 1.1, ease: 'power2.inOut' });
    gsap.to(train.position, { x: 0, y: SIDE_POSE.y, z: SIDE_POSE.z, duration: 1.1, ease: 'power2.inOut' });
    await new Promise((r) => gsap.to(trainRoot.position, { y: MOULD_Y, z: 0, duration: 1.1, ease: 'power2.inOut', onComplete: r }));
    gsap.to(lidPivot.rotation, { x: 0, duration: 1.4, ease: 'power2.inOut' });
    await flyTo({ name: 'closed' }, 1.5);
    latches.forEach((l, k) => gsap.to(l.rotation, { x: 0, duration: 0.3, delay: k * 0.12 }));
    await wait(0.9);
    state = 'done';
    if (shop) {
      // Tetap di ruang toko yang sama: kamera mundur dari koper, penutup kaca turun lagi, lalu masuk scene 11 (tanpa fade hitam)
      const pose = { pos: cam.position.clone(), look: tmpLook.clone() };
      mode = 'shop';
      onDone?.(true);
      shop.enterTV({ pose }).catch((err) => console.error(err));
    } else {
      onDone?.(false);
    }
  }

  /* ---------------- Input ---------------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;

  function pick(e, targets) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    return ray.intersectObjects(targets, true)[0] ?? null;
  }

  function onDown(e) {
    if (mode !== 'case') return;
    down ={ x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0 };
    if (state === 'lock') {
      const hit = pick(e, lockTargets);
      if (hit?.object.userData.dir) { pressedArrow = hit.object; pressArrow(pressedArrow); canvas.setPointerCapture(e.pointerId); }
    }
    if (state === 'train') canvas.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (mode !== 'case') return;
    if (down) {
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
      down.lx = e.clientX; down.ly = e.clientY;
      down.moved += Math.abs(dx) + Math.abs(dy);
      if (state === 'train') {
        const d = dx * 0.011;
        train.rotation.y += d;
        train.rotation.x = THREE.MathUtils.clamp(train.rotation.x + dy * 0.004, -0.35, 0.35);
        rotVel = d;
        trackRotation(d);
      }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    let hover = false;
    hoverTile = null;
    if (state !== 'lock') hoverArrowAt(null);
    if (state === 'lock') {
      const hit = pick(e, lockTargets);
      hover = !!hit;
      hoverArrowAt(hit?.object.userData.dir ? hit.object : null);   // hanya panah yang punya animasi hover
    } else if (state === 'parts') {
      const hit = pick(e, tileTargets);
      if (hit && !parts[hit.object.userData.part].placed) { hover = true; hoverTile = hit.object.userData.part; }
    } else if (state === 'train') {
      // scene 10: bagian kereta di bawah kursor menyala + terangkat; ketuk → surat (lihat setHover / openLetter)
      const i = closeShown ? partAt(e) : null;
      setHover(i);
      canvas.style.cursor = i !== null ? 'pointer' : 'grab';
    }
    if (state !== 'train') {
      canvas.style.cursor = hover ? 'pointer' : 'default';
      if (hoverPart !== null) setHover(null);
    }
  }
  function releasePressed() {
    if (pressedArrow) { releaseArrow(pressedArrow); pressedArrow = null; }
  }
  function onUp(e) {
    releasePressed();
    if (mode !== 'case') return;
    const wasTap = down && down.moved < 10;
    down = null;
    if (!wasTap) return;
    if (state === 'lock') {
      const hit = pick(e, lockTargets);
      if (!hit) return;
      const ud = hit.object.userData;
      let dir = ud.dir;
      if (!dir) {
        const c = wheels[ud.wheel].group.getWorldPosition(new THREE.Vector3());
        dir = hit.point.y >= c.y ? 1 : -1;
      }
      spin(ud.wheel, dir);
    } else if (state === 'parts') {
      const hit = pick(e, tileTargets);
      if (hit && !parts[hit.object.userData.part].placed) openPart(hit.object.userData.part);
    } else if (state === 'train' && closeShown) {      // scene 10: ketuk bagian kereta → surat
      const i = partAt(e);
      if (i !== null) openLetter(i);
    }
  }

  function trackRotation(d) {
    rotAccum += Math.abs(d);
    if (!closeShown && rotAccum >= CONFIG.rotateThresholdDeg * DEG) {
      closeShown = true;
      ui.setStage(10);
      ui.showAction('Tutup Koper', closeCase);
    }
  }

  /* ---- Scene 10: hover bagian kereta → surat ----
     Kursor di atas satu bagian: bagian itu menyala hangat + terangkat sedikit, dan label di bawah menyebut namanya.
     Ketuk: muncul pop-up surat (judul + 8 kalimat, sama dengan tulisan terukir di scene 8). */
  const GLOW = new THREE.Color(0xb4601c);
  const GLOW_MAX = 0.55, LIFT = 0.09;
  const HINT_TRAIN = '⟲ drag untuk memutar kereta';
  let hoverPart = null;

  // indeks bagian di bawah pointer (null kalau tidak ada)
  function partAt(e) {
    const hit = pick(e, parts.map((p) => p.obj));
    if (!hit) return null;
    for (let o = hit.object; o; o = o.parent) {
      const p = parts.find((q) => q.obj === o);
      if (p) return p.i;
    }
    return null;
  }
  // material bagian yang ikut menyala (bukan stiker transparan: tulisan / detail sisi); warna emissive asli disimpan
  function glowMats(p) {
    if (!p.glowMats) {
      const set = new Set();
      p.obj.traverse((o) => {
        const m = o.material;
        if (o.isMesh && m && !Array.isArray(m) && m.isMeshStandardMaterial && !m.transparent) set.add(m);
      });
      p.glowMats = [...set].map((m) => ({ m, c: m.emissive.clone() }));
    }
    return p.glowMats;
  }
  function applyGlow(p) { for (const { m, c } of glowMats(p)) m.emissive.copy(c).lerp(GLOW, p.glow.v); }
  // gerak hover per jenis bagian (supaya tidak saling menembus): atap naik, roda turun, badan sedikit membesar
  const hoverMove = (p) => (p.cfg.id.endsWith('roof') ? { dy: LIFT, s: 1 } : p.cfg.id.endsWith('wheels') ? { dy: -LIFT * 0.8, s: 1 } : { dy: 0, s: 1.05 });
  function setHover(i) {
    if (i === hoverPart) return;
    const prev = hoverPart !== null ? parts[hoverPart] : null;
    hoverPart = i;
    if (prev) {
      gsap.to(prev.glow, { v: 0, duration: 0.3, onUpdate: () => applyGlow(prev) });
      gsap.to(prev.obj.position, { y: prev.center.y, duration: 0.3, ease: 'power2.out' });
      gsap.to(prev.obj.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'power2.out' });
    }
    if (i !== null) {
      const p = parts[i], { dy, s } = hoverMove(p);
      gsap.to(p.glow, { v: GLOW_MAX, duration: 0.25, onUpdate: () => applyGlow(p) });
      gsap.to(p.obj.position, { y: p.center.y + dy, duration: 0.3, ease: 'back.out(2)' });
      gsap.to(p.obj.scale, { x: s, y: s, z: s, duration: 0.3, ease: 'back.out(2)' });
    }
    ui.hint(i !== null ? `✉ ${parts[i].cfg.name} — ketuk untuk membaca suratnya` : HINT_TRAIN);
  }
  async function openLetter(i) {
    const p = parts[i], e = epoch;
    state = 'busy';
    setHover(null);
    canvas.style.cursor = 'default';
    await ui.openNote(p.cfg);                 // pop-up kertas: judul + 8 kalimat
    if (e !== epoch) return;                  // scene dibongkar saat pop-up terbuka → jangan lanjut
    state = 'train';
  }

  let hoverTile = null;
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => { down = null; releasePressed(); });
  canvas.addEventListener('pointerleave', () => { if (!down) { hoverArrowAt(null); setHover(null); } });

  /* ---------------- Loop / resize ---------------- */
  function resize() {
    const w = canvas.clientWidth, hh = canvas.clientHeight;
    if (!w || !hh) return;
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh;
    camera.updateProjectionMatrix();
    shop?.resize(w, hh);
    street?.resize(w, hh);
    if (mode === 'case' && !camTween) setView(currentView);
  }
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));   // iOS: ukuran baru baru tersedia sesaat setelah rotasi

  const clock = new THREE.Clock();
  let raf = 0, running = false, lastT = 0;
  // Tab disembunyikan → hentikan render sama sekali; kembali → lanjut tanpa lonjakan waktu
  document.addEventListener('visibilitychange', () => {
    if (!running) return;
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) { lastT = clock.getElapsedTime(); frame(); }
  });
  function frame() {
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    const dt = Math.min(t - lastT, 0.1);   // detik sejak frame lalu (dibatasi supaya tidak meloncat setelah jeda)
    lastT = t;
    if (mode === 'street') {
      street.update(t);
      renderer.render(street.scene, street.camera);
      return;
    }
    if (mode === 'shop') {
      shop.update(t);
      renderer.render(shop.scene, shop.camera);
      return;
    }
    if (shop) {                          // dunia koper di dalam toko: kamera diatur di sini, ambience toko tetap hidup
      applyCam();
      cam.updateMatrixWorld();
      shop.update(t, false);
    }
    if (floating) trainRoot.position.y = FLOAT_Y + Math.sin(t * 1.6) * 0.07;
    if (state === 'train' && !down && Math.abs(rotVel) > 0.0002) {
      // rotVel = putaran per "frame 60 Hz"; skala dengan dt supaya sama di 60 Hz maupun 120 Hz
      const k = dt * 60;
      rotVel *= Math.pow(0.94, k);
      train.rotation.y += rotVel * k;
      trackRotation(rotVel * k);
    }
    if (state === 'parts') {
      const pulse = 0.05 + Math.sin(t * 3) * 0.035;
      parts.forEach((p) => { if (!p.placed) p.tileMat.emissiveIntensity = p.i === hoverTile ? 0.25 : pulse; });
    }
    renderer.render(shop ? shop.scene : scene, cam);
  }

  /**
   * Masuk ke scene 3D mana pun (5–10) — dipakai ?scene=N dan panel debug.
   * 5/6/9 memakai enter(); 7, 8, 10 adalah keadaan di tengah alur sehingga disusun manual.
   */
  async function enterStage(n) {
    if (n <= 6 || n === 9) return enter(n <= 5 ? 5 : n);
    if (n === 10) {                       // kereta jadi, sudah diputar → tombol Tutup Koper
      await enter(9);
      closeShown = true;
      ui.setStage(10);
      ui.showAction('Tutup Koper', closeCase);
      return;
    }
    await enter(6);                       // koper terbuka, bagian-bagian di tutup
    if (n === 7) {                        // kamera dekat bagian pertama
      state = 'busy';
      ui.counter(null);
      ui.setStage(7);
      setView({ name: 'part1', index: 0 });
    } else {                              // n === 8: tulisan terukir pada bagian pertama (kamera sudah di plat)
      setView({ name: 'engrave', index: 0 });
      openPart(0, 'note');
    }
  }

  /** Scene 11 / 12 (loncat langsung). Melempar error kalau toko tidak tersedia → main.js memakai scene 2D. */
  function enterTV(n) {
    if (!shop) throw new Error('Toko antik 3D tidak tersedia');
    resize();
    reset();
    street?.leave();
    state = 'idle';
    mode = 'shop';
    return shop.enterTV({ at12: n === 12 });
  }

  return {
    enter,
    enterStage,
    enterShop,
    enterStreet,
    enterTV,
    reset,
    start() { if (running) return; running = true; resize(); clock.start(); lastT = 0; frame(); },
    stop() { running = false; cancelAnimationFrame(raf); raf = 0; reset(); shop?.leave(); street?.leave(); },
  };
}

/* ============================================================
   MODEL BAGIAN KERETA — InterCity 225 (London King's Cross ⇄ Edinburgh)
   • Lokomotif listrik Class 91, livery Virgin Trains East Coast (mengikuti foto 91114 "Durham Cathedral"): badan merah,
     "swoosh" putih-perak bermotif kotak-kotak yang menyapu turun dari tepi atap belakang lalu mengalir menjadi pita tipis
     di bawah sampai hidung, kabin hitam, hidung baji dengan bajak (plough) perak, atap biru-gelap dengan ceruk pantograf.
   • DUA gerbong penumpang Mk4 livery InterCity (foto gerbong): atas marun-tua, bawah putih-abu, garis merah,
     garis oranye tipis di bawah atap, pintu ujung abu-abu, jendela bersudut bulat (tampak kursi merah di dalamnya).
       gerbong 1 = RFM (dapur/first: jendela lonjong dapur + 4 jendela), gerbong 2 = TS (jendela penuh).
   Koordinat kereta: x = panjang (lokomotif di +x, hidung menghadap +x), y = atas.
   Di dalam buildPartModel, "f" = jarak sepanjang gerbong ke arah +x relatif ke pusat gerbong.
   Ukuran keseluruhan (miniatur) sama seperti sebelumnya. Ganti isi fungsi ini dengan model GLB bila sudah ada.
============================================================ */
// Jarak antar gerbong 0.2: kopling, buffer & peredam sambungan tiap gerbong menjorok ≤ 0.1 sehingga tidak saling bertabrakan
const CARS = { loco: 1.4, car1: -0.15, car2: -1.7 };
const L = 1.35;                 // panjang badan (tanpa hidung)
const NOSE_LEN = 0.3;           // panjang hidung di depan badan loko
const F = L / 2 + NOSE_LEN;     // ujung depan hidung (f)
const TOP = 0.8;                // tinggi atap badan
const FLOOR = 0.29;             // tinggi lantai badan
const BS = 0.015;               // bevel profil loko (permukaan keluar sebesar ini dari outline)
const NOSE_TIP_Y = 0.395;       // ujung baji hidung (setinggi ujung hidung di foto)
const NOSE_TOP_F = F - 0.16;    // lereng hidung mencapai tepi atap di sini
const NOSE_K = (F - NOSE_TOP_F) / (TOP - NOSE_TIP_Y);   // kemiringan lereng: Δf per Δy
// Profil samping loko (f, y): belakang tegak, hidung baji (lereng kaca depan di atas ujung, bibir tegak pendek di bawah)
const LOCO_PROFILE = [[-L / 2, FLOOR], [F - 0.015, FLOOR], [F, FLOOR + 0.035], [F, NOSE_TIP_Y], [NOSE_TOP_F, TOP], [-L / 2, TOP]];
const IC = {
  // Warna sengaja digelapkan/dijenuhkan: lampu & tone mapping di toko membuat warna tampak lebih pucat
  red: 0x9c0d14,        // merah Virgin
  silver: 0xa9adb3,     // bajak & panel hidung perak
  black: 0x141619,
  glass: 0x1c2530,
  roofLoco: 0x1e2530,   // atap loko biru-gelap (foto)
  roofCoach: 0x4a4e55,  // atap gerbong abu-gelap
  coachEnd: 0xd4d5d3,   // dinding ujung gerbong putih-abu
  under: 0x1d1f23,      // rangka bawah hitam
};

function colFor(id) { return id.startsWith('loco') ? 2 : id.startsWith('car1') ? 1 : 0; }
function rowFor(id) { return id.endsWith('roof') ? 0 : id.endsWith('body') ? 1 : 2; }

// Normal "berlipat": rata-rata normal antar-faset yang sudutnya < angle (permukaan lengkung halus, tepi tajam tetap tajam).
// (toCreasedNormals bawaan three r160 membulatkan posisi ke 0.01 → terlalu kasar untuk model sekecil ini.)
function creased(geo, angle = 0.6) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const p = geo.attributes.position, n = p.count, cos = Math.cos(angle);
  const fn = new Float32Array(n * 3), map = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const key = (i) => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    c.sub(b); a.sub(b); c.cross(a).normalize();
    for (let k = 0; k < 3; k++) {
      c.toArray(fn, (i + k) * 3);
      const h = key(i + k);
      if (!map.has(h)) map.set(h, []);
      map.get(h).push(i + k);
    }
  }
  const out = new Float32Array(n * 3), s = new THREE.Vector3(), m = new THREE.Vector3(), o = new THREE.Vector3();
  for (const list of map.values()) {
    for (const i of list) {
      m.fromArray(fn, i * 3); s.set(0, 0, 0);
      for (const j of list) { o.fromArray(fn, j * 3); if (o.dot(m) >= cos) s.add(o); }
      if (s.lengthSq() < 1e-12) s.copy(m);
      s.normalize().toArray(out, i * 3);
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return geo;
}

// Profil samping (x,y) → ekstrusi melintang (lebar total = width), pusat di z = 0
function profileGeo(pts, width, bevel = 0.03, bevelSize = BS) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const depth = width - 2 * bevel;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize, bevelSegments: 3, curveSegments: 4,
  });
  geo.translate(0, 0, -depth / 2);
  return creased(geo);
}

// Atap melengkung (penampang kubah) memanjang sepanjang x, pusat di x = 0.
// Dengan bevel, ukuran luar tetap halfW / peak (penampang dikecilkan sebesar bevelSize sebelum diekstrusi).
// shear: ujung depan (+x) dimiringkan mengikuti lereng hidung (x berkurang NOSE_K per satuan tinggi di atas yRef).
function domeGeo(len, halfW, y0, peak, bevel = 0, shear = null) {
  const bsz = bevel * 0.6;
  const hw = halfW - bsz, pk = peak - bsz;
  const k = y0 + (pk - y0) * 0.78;
  const s = new THREE.Shape();
  s.moveTo(-hw, y0);
  s.bezierCurveTo(-hw, k, -hw * 0.55, pk, 0, pk);
  s.bezierCurveTo(hw * 0.55, pk, hw, k, hw, y0);
  s.lineTo(-hw, y0);
  const depth = len - 2 * bevel;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bsz, bevelSegments: 3, curveSegments: 12,
  });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(Math.PI / 2);   // sumbu ekstrusi (z) → x
  if (shear) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > 0) p.setX(i, p.getX(i) - (p.getY(i) - shear.yRef) * shear.k);
  }
  return creased(geo, 0.75);
}

// Pegas ulir (tabung heliks) berdiri tegak, pusat di titik asal
function coilGeo(r, h, turns, wire) {
  const curve = new THREE.Curve();
  curve.getPoint = (t, v = new THREE.Vector3()) => {
    const a = t * turns * Math.PI * 2;
    return v.set(Math.cos(a) * r, (t - 0.5) * h, Math.sin(a) * r);
  };
  return new THREE.TubeGeometry(curve, Math.ceil(turns * 14), wire, 5, false);
}

// Persegi panjang bersudut bulat (Shape) berpusat di titik asal
function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Logo Virgin (PNG merah transparan dari assets) → versi putih; dimuat sekali, dipakai semua tekstur
let logoPromise = null;
function loadVirginLogo() {
  return (logoPromise ??= new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
        for (let i = 0; i < px.length; i += 4) {
          // alpha asli × "kemerahan" (piksel putih latar → transparan), warna → putih hangat
          const k = Math.min(1, Math.max(0, (255 - px[i + 1]) / 215));
          px[i + 3] = Math.round(px[i + 3] * k);
          px[i] = 250; px[i + 1] = 248; px[i + 2] = 244;
        }
        g.putImageData(d, 0, 0);
        resolve(c);
      } catch { resolve(null); }
    };
    im.onerror = () => resolve(null);
    im.src = CONFIG.assets.train_logo;
  }));
}

/* ---- Tekstur sisi ----
   SATU bidang transparan per sisi berisi semua detail cat (pita, swoosh, jendela, pintu, logo, tulisan) → tidak ada kotak
   tipis bertumpuk (z-fighting). dir = +1: sumbu u tekstur searah +f; −1: berlawanan (sisi −z, bidang diputar 180°).
   Tulisan & logo selalu terbaca kiri→kanan di kedua sisi; posisinya yang dicerminkan. */
const SIDE_PPU = 1300;   // piksel per satuan model

function sideCanvas(f0, f1, dir) {
  const W = Math.round((f1 - f0) * SIDE_PPU), H = Math.round((TOP - FLOOR) * SIDE_PPU), U = SIDE_PPU;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const px = (f) => ((dir > 0 ? f - f0 : f1 - f) / (f1 - f0)) * W;
  const py = (y) => ((TOP - y) / (TOP - FLOOR)) * H;
  const R = (fa, fb, ya, yb) => {
    const x0 = Math.min(px(fa), px(fb));
    return [x0, py(Math.max(ya, yb)), Math.abs(px(fb) - px(fa)), Math.abs(py(ya) - py(yb))];
  };
  const rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  const fillR = (fa, fb, ya, yb, style, r = 0) => {
    const [x, y, w, h] = R(fa, fb, ya, yb);
    g.fillStyle = style;
    if (r) { rr(x, y, w, h, r * U); g.fill(); } else g.fillRect(x, y, w, h);
  };
  const vline = (f, ya, yb, w, style) => fillR(f - w / 2, f + w / 2, ya, yb, style);
  // teks di kotak [fa, fb] (dipadatkan bila tak muat), garis dasar yb, tinggi huruf size (satuan model)
  const text = (str, fa, fb, yb, size, style, { family = 'Georgia, "Times New Roman", serif', weight = 'bold', align = 'left', sx = 0 } = {}) => {
    const x0 = Math.min(px(fa), px(fb)), w = Math.abs(px(fb) - px(fa));
    g.save();
    g.font = `${weight} ${Math.round(size * U)}px ${family}`;
    const tw = g.measureText(str).width, s = sx || Math.min(1, w / tw);
    g.translate(align === 'center' ? x0 + (w - tw * s) / 2 : x0, py(yb));
    g.scale(s, 1);
    g.fillStyle = style; g.textBaseline = 'alphabetic';
    g.fillText(str, 0, 0);
    g.restore();
    return s;
  };
  return { c, g, W, H, U, px, py, R, rr, fillR, vline, text };
}

function canvasTex(c) {
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 8;
  return tx;
}

// Kaca jendela kecil (kabin / pintu loko): abu-kebiruan + kilau miring
function glassPane(k, x, y, w, h, r) {
  const { g } = k;
  g.fillStyle = '#0d0e10'; k.rr(x - 3, y - 3, w + 6, h + 6, r + 3); g.fill();
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, '#8a939c'); gr.addColorStop(1, '#3a4149');
  g.fillStyle = gr; k.rr(x, y, w, h, r); g.fill();
  g.save(); k.rr(x, y, w, h, r); g.clip();
  g.fillStyle = 'rgba(255,255,255,.22)';
  g.beginPath(); g.moveTo(x + w * 0.2, y); g.lineTo(x + w * 0.55, y); g.lineTo(x + w * 0.15, y + h); g.lineTo(x - w * 0.2, y + h); g.fill();
  g.restore();
}

/* ---------- Loko: semua posisi diambil dari foto referensi (badan x 45…1420, y 113…258 piksel) ---------- */
function locoSideTexture(dir) {
  const k = sideCanvas(-L / 2, F, dir), { g, U } = k;
  const SPAN = F + L / 2;
  const fI = (x) => -L / 2 + ((x - 45) / 1375) * SPAN;          // x foto → f
  const yI = (y) => TOP - ((y - 113) / 145) * (TOP - FLOOR);     // y foto → y model
  const I = (x, y) => [k.px(fI(x)), k.py(yI(y))];
  const path = (cmds, close = true) => {
    g.beginPath();
    for (const [op, ...pts] of cmds) {
      const q = pts.flatMap(([x, y]) => I(x, y));
      if (op === 'M') g.moveTo(...q); else if (op === 'L') g.lineTo(...q); else g.bezierCurveTo(...q);
    }
    if (close) g.closePath();
  };
  const poly = (pts) => path(pts.map((p, i) => [i ? 'L' : 'M', p]));

  g.save();
  // potong mengikuti profil samping (hidung baji)
  g.beginPath();
  LOCO_PROFILE.forEach(([f, y], i) => (i ? g.lineTo(k.px(f), k.py(y)) : g.moveTo(k.px(f), k.py(y))));
  g.closePath(); g.clip();

  // 1) merah dasar (sedikit lebih terang di atas, seperti cat mengilap di foto)
  const red = g.createLinearGradient(0, 0, 0, k.H);
  red.addColorStop(0, '#ad121b'); red.addColorStop(0.55, '#9c0d14'); red.addColorStop(1, '#880b11');
  g.fillStyle = red; g.fillRect(0, 0, k.W, k.H);

  // 2) SWOOSH putih-perak: pita diagonal dari tepi atap (x 258–468) menyapu turun-kanan, lalu ekornya meruncing mulus
  //    menjadi pita bawah tipis yang mengalir sampai hidung. Merah di kiri & kanannya (persis foto).
  path([['M', [258, 110]], ['L', [468, 110]], ['C', [560, 175], [640, 235], [800, 249]], ['L', [1450, 249]], ['L', [1450, 266]],
    ['L', [445, 266]], ['L', [445, 258]], ['C', [380, 215], [300, 160], [258, 110]]]);
  g.save(); g.clip();
  const wg = g.createLinearGradient(0, 0, 0, k.H);
  wg.addColorStop(0, '#f2f2ef'); wg.addColorStop(0.6, '#dcddda'); wg.addColorStop(1, '#c2c4c6');
  g.fillStyle = wg; g.fillRect(0, 0, k.W, k.H);
  // motif kotak-kotak halus (seperti di foto)
  const cell = 0.02 * U;
  g.lineWidth = Math.max(1, cell * 0.07);
  for (let y = 0; y < k.H; y += cell) {
    for (let x = 0; x < k.W; x += cell) {
      g.strokeStyle = 'rgba(120,124,130,.16)'; g.strokeRect(x + cell * 0.18 + 1.5, y + cell * 0.18 + 1.5, cell * 0.64, cell * 0.64);
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.strokeRect(x + cell * 0.18, y + cell * 0.18, cell * 0.64, cell * 0.64);
    }
  }
  g.restore();

  // 3) garis kuning-oranye tipis di tepi atap (berhenti di kabin hitam)
  poly([[45, 112], [1160, 112], [1160, 116], [45, 116]]);
  g.fillStyle = '#e9a43c'; g.fill();

  // 4) kabin: area hitam melengkung dari tepi atap turun ke arah hidung
  path([['M', [1148, 108]], ['L', [1460, 108]], ['L', [1460, 171]], ['L', [1300, 171]], ['C', [1225, 171], [1180, 150], [1148, 108]]]);
  g.fillStyle = '#111317'; g.fill();
  {
    const [x0, y0] = I(1256, 124), [x1, y1] = I(1290, 160);
    glassPane(k, Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0, 0.008 * U);   // jendela samping kabin
    // jendela segitiga kecil mengikuti lereng kaca depan
    poly([[1301, 127], [1301, 158], [1333, 158]]);
    g.fillStyle = '#5c646d'; g.fill();
  }

  // 5) ujung belakang: kisi udara + pintu kabin belakang
  {
    const [x0, y0] = I(68, 123), [x1, y1] = I(125, 160);
    const x = Math.min(x0, x1), w = Math.abs(x1 - x0), h = y1 - y0;
    g.fillStyle = '#6e7174'; k.rr(x - 3, y0 - 3, w + 6, h + 6, 4); g.fill();
    g.fillStyle = '#c5c6c2'; g.fillRect(x, y0, w, h);
    g.fillStyle = 'rgba(60,62,66,.55)';
    for (let i = 1; i < 9; i++) g.fillRect(x + 2, y0 + (h * i) / 9, w - 4, Math.max(1.5, h * 0.025));
  }
  for (const x of [192, 250]) k.vline(fI(x), yI(255), yI(116), 0.003, 'rgba(50,4,8,.7)');   // celah pintu
  {
    const [x0, y0] = I(210, 123), [x1, y1] = I(237, 160);
    glassPane(k, Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0, 0.006 * U);
  }
  // segitiga peringatan kuning kecil
  const warn = (x, y) => {
    const [cx, cy] = I(x, y), s = 0.012 * U;
    g.fillStyle = '#f2c230'; g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s, cy + s * 0.8); g.lineTo(cx - s, cy + s * 0.8); g.closePath(); g.fill();
    g.fillStyle = '#1a1a1a'; g.fillRect(cx - s * 0.08, cy - s * 0.35, s * 0.16, s * 0.65);
  };
  warn(268, 128); warn(1238, 132);

  // 6) jendela kecil hitam (satu di atas swoosh, dua di merah)
  for (const [xa, xb] of [[365, 393], [722, 750], [1103, 1131]]) k.fillR(fI(xa), fI(xb), yI(175), yI(140), '#15171a', 0.005);

  // (plat nama, lambang salib & siluet katedral "Durham Cathedral" sengaja dihapus)

  // 9) pintu kabin depan: celah pintu (terlihat di merah, tertutup di area hitam) + plat kecil
  for (const x of [1241, 1304]) k.vline(fI(x), yI(250), yI(116), 0.003, 'rgba(50,4,8,.7)');
  k.fillR(fI(1312), fI(1348), yI(212), yI(190), '#e8e6e0', 0.003);
  g.fillStyle = 'rgba(160,20,26,.8)';
  for (let i = 0; i < 3; i++) { const [x0, y0] = I(1315, 195 + i * 5.5); g.fillRect(Math.min(x0, k.px(fI(1345))), y0, Math.abs(k.px(fI(1345)) - x0), 0.003 * U); }

  // 10) panel perak di bawah ujung hidung + nomor loko
  k.fillR(fI(1316), fI(1440), yI(251), yI(229), '#b9bcc0');
  k.fillR(fI(1316), fI(1440), yI(231), yI(229), 'rgba(0,0,0,.25)');
  for (const x of [1340, 1356]) { const [x0, y0] = I(x, 235), s = 0.016 * U; g.strokeStyle = '#4a4d52'; g.lineWidth = 2; g.strokeRect(Math.min(x0, x0 + (dir > 0 ? s : -s)), y0, s, s * 0.8); }
  k.text('91114', fI(1352), fI(1404), yI(257), 0.03, '#202226', { family: 'Georgia, serif', weight: '' });

  g.restore();
  const tx = canvasTex(k.c);

  // 11) logo Virgin (putih) + ekor goresan yang memanjang ke kiri (seperti di foto) — setelah PNG dimuat
  loadVirginLogo().then((logo) => {
    if (!logo) return;
    const h = 0.25 * U, w = ((h * logo.width) / logo.height) * 0.82;
    const [cxL, cyL] = I(855, 182);
    const lx = cxL - w / 2, ly = cyL - h / 2;
    // ekor: lanjutan ujung bawah huruf 'g' (piksel logo ≈ 59,207), meruncing ke kiri
    const S = [lx + w * 0.235, ly + h * 0.935];
    const C = [S[0] - 0.045 * U, S[1] + 0.014 * U], E = [S[0] - 0.17 * U, S[1] + 0.006 * U];
    const N = 40, top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      const x = u * u * S[0] + 2 * u * t * C[0] + t * t * E[0], y = u * u * S[1] + 2 * u * t * C[1] + t * t * E[1];
      const dx = 2 * u * (C[0] - S[0]) + 2 * t * (E[0] - C[0]), dy = 2 * u * (C[1] - S[1]) + 2 * t * (E[1] - C[1]);
      const len = Math.hypot(dx, dy) || 1, wv = 0.0105 * U * Math.pow(1 - t, 0.85) + 0.5;
      top.push([x - (dy / len) * wv, y + (dx / len) * wv]); bot.push([x + (dy / len) * wv, y - (dx / len) * wv]);
    }
    g.fillStyle = '#faf8f4';
    g.beginPath(); top.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); bot.reverse().forEach((p) => g.lineTo(...p)); g.closePath(); g.fill();
    g.drawImage(logo, lx, ly, w, h);
    tx.needsUpdate = true;
  });
  return tx;
}

/* ---------- Gerbong Mk4 (livery InterCity, foto gerbong) ---------- */
// Jendela penumpang: bingkai karet hitam bersudut bulat, interior krem dengan sandaran kursi merah, kaca gelap + kilau
function coachWindow(k, fa, fb, ya, yb, { r = 0.018, seats = true, frosted = false, tint = 'rgba(22,28,40,.36)' } = {}) {
  const { g, U } = k;
  const [x, y, w, h] = k.R(fa, fb, ya, yb), m = 0.0065 * U;
  g.fillStyle = '#0c0d0f'; k.rr(x - m, y - m, w + 2 * m, h + 2 * m, (r + 0.0065) * U); g.fill();
  g.save(); k.rr(x, y, w, h, r * U); g.clip();
  if (frosted) {
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#c9ccce'); gr.addColorStop(1, '#8d9296');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  } else {
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#dcc9a8'); gr.addColorStop(0.5, '#b89e7c'); gr.addColorStop(1, '#5c4838');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,248,228,.75)'; g.fillRect(x, y + h * 0.07, w, h * 0.045);   // lampu langit-langit
    if (seats) {
      const n = Math.max(1, Math.round(w / (0.042 * U))), sw = w / n;
      for (let i = 0; i < n; i++) {
        const sx = x + i * sw + sw * 0.1, top = y + h * 0.46;
        g.fillStyle = '#7a1a21'; k.rr(sx, top, sw * 0.8, h * 0.7, sw * 0.28); g.fill();
        g.fillStyle = 'rgba(240,232,220,.55)'; k.rr(sx + sw * 0.12, top + h * 0.04, sw * 0.56, h * 0.07, 2); g.fill();   // sarung sandaran kepala
      }
    }
  }
  g.fillStyle = tint; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.14)';
  g.beginPath(); g.moveTo(x + w * 0.18, y); g.lineTo(x + w * 0.45, y); g.lineTo(x + w * 0.12, y + h); g.lineTo(x - w * 0.15, y + h); g.fill();
  g.restore();
}

// kind: 'rfm' (gerbong 1, persis foto) | 'ts' (gerbong 2, jendela penuh)
function coachSideTexture(kind, dir) {
  const k = sideCanvas(-L / 2, L / 2, dir), { g, U } = k;
  g.save(); k.rr(0, 0, k.W, k.H, 0.022 * U); g.clip();
  const DL = [-0.648, -0.566], DR = [0.536, 0.618];   // pintu ujung kiri (berlivery) & kanan (abu-abu)
  // 1) badan bawah putih-abu
  const base = g.createLinearGradient(0, 0, 0, k.H);
  base.addColorStop(0, '#ebebe8'); base.addColorStop(1, '#c8c9c8');
  g.fillStyle = base; g.fillRect(0, 0, k.W, k.H);
  // 2) pita jendela marun-tua (dari pintu kiri sampai pintu abu-abu)
  const mar = g.createLinearGradient(0, k.py(0.786), 0, k.py(0.52));
  mar.addColorStop(0, '#4c282e'); mar.addColorStop(1, '#351b20');
  k.fillR(DL[0], DR[0], 0.52, 0.786, mar);
  // 3) garis oranye tipis di bawah atap + garis merah di badan putih
  k.fillR(-L / 2, L / 2, 0.787, 0.793, '#dd7a32');
  k.fillR(DL[0], DR[0], 0.468, 0.494, '#c8202a');
  // 4) pintu abu-abu (kanan), celah pintu, jendela pintu, garis kuning di ambang
  k.fillR(DR[0], DR[1], 0.298, 0.793, '#4b4f55');
  for (const f of [...DL, ...DR]) k.vline(f, 0.298, 0.786, 0.0035, 'rgba(0,0,0,.6)');
  k.fillR(DL[0] + 0.016, DL[1] - 0.016, 0.615, 0.735, '#0c0d0f', 0.008);
  k.fillR(DR[0] + 0.015, DR[1] - 0.015, 0.615, 0.735, '#0c0d0f', 0.008);
  if (kind === 'rfm') {
    k.text('CREW USE', DL[0] + 0.022, DL[1] - 0.022, 0.69, 0.011, '#e8e8e8', { family: 'Arial, sans-serif', align: 'center' });
    k.text('ONLY', DL[0] + 0.022, DL[1] - 0.022, 0.675, 0.011, '#e8e8e8', { family: 'Arial, sans-serif', align: 'center' });
  }
  for (const [a, b] of [DL, DR]) {
    k.fillR(a + 0.006, b - 0.006, 0.3, 0.306, '#f0c419');                     // garis kuning ambang pintu
    k.fillR(b - 0.016, b - 0.01, 0.47, 0.56, 'rgba(20,20,22,.7)', 0.002);     // pegangan pintu
  }
  // tombol pintu hijau/kuning kecil di samping pintu
  k.fillR(DL[1] + 0.006, DL[1] + 0.014, 0.58, 0.592, '#27a35a', 0.002);
  k.fillR(DR[0] - 0.014, DR[0] - 0.006, 0.58, 0.592, '#27a35a', 0.002);
  // 5) alas hitam
  k.fillR(-L / 2, L / 2, FLOOR, 0.298, '#141517');
  // 6) jendela
  const WY = [0.56, 0.715];
  if (kind === 'rfm') {
    coachWindow(k, -0.44, -0.3, 0.632, 0.7, { r: 0.034, seats: false, tint: 'rgba(70,24,30,.62)' });   // jendela lonjong dapur
    coachWindow(k, -0.005, 0.045, WY[0], WY[1], { seats: false });
    for (const [a, b] of [[0.065, 0.2], [0.22, 0.355], [0.375, 0.51]]) coachWindow(k, a, b, WY[0], WY[1]);
  } else {
    coachWindow(k, -0.548, -0.514, 0.6, 0.705, { r: 0.012, frosted: true });   // jendela toilet buram
    const n = 6, f0 = -0.49, f1 = 0.512, gap = 0.022, ww = (f1 - f0 - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) coachWindow(k, f0 + i * (ww + gap), f0 + i * (ww + gap) + ww, WY[0], WY[1]);
  }
  // 7) nomor gerbong + tanda kelas kecil di ujung kanan
  k.text(kind === 'rfm' ? '10324' : '12417', 0.33, 0.43, 0.418, 0.024, 'rgba(70,72,76,.85)', { family: 'Arial, sans-serif', weight: '' });
  k.fillR(0.626, 0.656, 0.7, 0.74, '#c8202a', 0.003);
  k.text(kind === 'rfm' ? 'H' : '1', 0.626, 0.656, 0.709, 0.028, '#ffffff', { family: 'Arial, sans-serif', align: 'center' });
  g.restore();
  return canvasTex(k.c);
}


/* ---- Tulisan terukir langsung di badan kereta ----
   Tidak ada plat tambahan: judul + 8 kalimat tiap bagian "diukir" ke permukaan bagian itu sendiri (atap, sisi badan, kotak
   peralatan roda). Berupa stiker transparan berisi huruf saja + peta tonjolan (huruf cekung) sehingga tampak terukir di cat / logam.
   Di kartu hanya tampak sebagai goresan halus; di "ultra zoom-in" (scene 8) kamera mendekat sampai huruf-hurufnya terbaca. */
const ENGRAVE_ASPECT = 1.5;

// ink: 'light' = huruf terang (atap gelap / baja gelap) | 'dark' = huruf gelap (cat badan merah yang terang)
function engraveMaterial(cfg, ink = 'light') {
  const W = 1536, H = Math.round(W / ENGRAVE_ASPECT);
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const colC = mk(), heiC = mk();
  const gc = colC.getContext('2d'), gh = heiC.getContext('2d');
  gh.fillStyle = '#808080'; gh.fillRect(0, 0, W, H);   // peta tinggi: datar; huruf = cekung (hitam)

  // huruf terukir: isian terang + tepi gelap di sisi kiri-atas + kilau tipis di sisi kanan-bawah; bayangan lembut pada peta tinggi
  const carve = (text, x, y, font) => {
    gc.font = font; gh.font = font;
    gc.textBaseline = 'alphabetic'; gh.textBaseline = 'alphabetic';
    if (ink === 'dark') {
      // huruf hampir hitam, halo tipis (halo putih tebal membuat huruf tampak keruh di atas cat merah)
      gc.fillStyle = 'rgba(0,0,0,.4)'; gc.fillText(text, x - 2, y - 2);
      gc.fillStyle = 'rgba(255,255,255,.3)'; gc.fillText(text, x + 2, y + 2);
      gc.fillStyle = '#0b0203'; gc.fillText(text, x, y);
    } else {
      gc.fillStyle = 'rgba(15,15,20,.8)'; gc.fillText(text, x - 2.5, y - 2.5);
      gc.fillStyle = 'rgba(255,255,255,.45)'; gc.fillText(text, x + 2.5, y + 2.5);
      gc.fillStyle = '#ece9df'; gc.fillText(text, x, y);
    }
    gh.shadowColor = '#000'; gh.shadowBlur = 5;
    gh.fillStyle = '#000'; gh.fillText(text, x, y);
    gh.shadowBlur = 0;
  };
  const MX = 70, maxW = W - 2 * MX;
  carve(cfg.name, MX, 130, 'bold 80px "Trebuchet MS", "Segoe UI", sans-serif');
  gc.fillStyle = ink === 'dark' ? '#2b0b0e' : 'rgba(15,15,20,.7)'; gc.fillRect(MX, 160, maxW, 4);
  gc.fillStyle = 'rgba(255,255,255,.5)'; gc.fillRect(MX, 164, maxW, 3);
  gh.fillStyle = '#000'; gh.fillRect(MX, 160, maxW, 6);
  // Isi teks: pakai ukuran huruf terbesar yang masih muat di blok (blok punya sisa ruang → huruf lebih besar = lebih mudah dibaca)
  let layout = null;
  for (let size = 54; size >= 32; size -= 2) {
    const font = `${size}px Georgia, "Times New Roman", serif`;
    gc.font = font;
    const lh = Math.round(size * 1.32), gap = Math.round(size * 0.22);   // gap = jeda antar kalimat
    const rows = [];
    let y = 250;
    for (const sentence of cfg.text) {
      let line = '';
      for (const word of sentence.split(' ')) {
        const test = line ? line + ' ' + word : word;
        if (gc.measureText(test).width > maxW && line) { rows.push([line, y]); y += lh; line = word; }
        else line = test;
      }
      if (line) { rows.push([line, y]); y += lh + gap; }
    }
    layout = { font, rows };
    if (y - gap <= H - 50) break;
  }
  for (const [text, yy] of layout.rows) carve(text, MX, yy, layout.font);

  const map = new THREE.CanvasTexture(colC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const bump = new THREE.CanvasTexture(heiC);
  bump.anisotropy = 8;
  // color = pengali peta warna → meredupkan huruf (lampu toko menyorot permukaan cukup terang sampai huruf putih silau)
  return new THREE.MeshStandardMaterial({
    map, color: ink === 'dark' ? 0xffffff : 0xa6a6a6, bumpMap: bump, bumpScale: 3, transparent: true, depthWrite: false,
    // huruf gelap: sepenuhnya matte (kilau lampu menambah terang di atas huruf hitam → tampak abu-abu / cokelat keruh)
    roughness: ink === 'dark' ? 1 : 0.5, metalness: ink === 'dark' ? 0 : 0.15, envMapIntensity: ink === 'dark' ? 0 : 0.2,
  });
}

function buildPartModel(id, cfg) {
  const [car, kind] = id.split('-');
  const cx = CARS[car];
  const isLoco = car === 'loco';
  const isTail = car === 'car2';      // gerbong paling belakang
  const X = (f) => cx + f;            // f → koordinat x dunia kereta
  const g = new THREE.Group();
  // envMapIntensity rendah: di dalam toko ada environment map terang; tanpa ini cat merah (roughness rendah) memantulkan ruangan
  // seperti lapisan bening putih → merah tampak pucat / salmon. (Logam di bagian roda memakai nilai lebih tinggi.)
  const matCache = new Map();
  const std = (color, o = {}) => {
    const key = color + JSON.stringify(o);
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.42, envMapIntensity: 0.25, ...o }));
    return matCache.get(key);
  };
  const add = (geo, mat, x, y, z, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };
  // detail kecil: tidak diberi garis tepi di cetakan (ghost) supaya cetakan tetap bersih
  const fine = (m) => { m.userData.fine = true; m.castShadow = false; return m; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 2, r);
  const cyl = (r, h, s = 16, r2 = r) => new THREE.CylinderGeometry(r, r2, h, s);
  // batang dari titik p0 ke p1 pada bidang XY
  const bar = (p0, p1, th, mat, z = 0, round = false) => {
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    const geo = round ? cyl(th / 2, len, 10) : box(len, th, th);
    return add(geo, mat, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, z, round ? [0, 0, ang - Math.PI / 2] : [0, 0, ang]);
  };
  const xAx = (geo, mat, x, y, z) => add(geo, mat, x, y, z, [0, 0, Math.PI / 2]);   // silinder bersumbu x
  const zAx = (geo, mat, x, y, z) => add(geo, mat, x, y, z, [Math.PI / 2, 0, 0]);   // silinder bersumbu z
  // stiker sisi (tekstur transparan) di kedua sisi: texPos untuk sisi +z, texNeg untuk sisi −z (bidang diputar 180°)
  // Jaraknya 0.0075 dari badan (≈0.002 satuan dunia) → cukup jauh untuk tidak z-fighting; tidak menerima bayangan (anti-acne)
  const decal = (texPos, texNeg, fc, fl, yc, h) => {
    for (const [sz, tex] of [[1, texPos], [-1, texNeg]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(fl, h), new THREE.MeshStandardMaterial({
        map: tex, transparent: true, roughness: 0.5, envMapIntensity: 0.25, depthWrite: false,
      }));
      m.position.set(X(fc), yc, sz * 0.3375);
      if (sz < 0) m.rotation.y = Math.PI;
      g.add(m);
    }
  };
  // isolator keramik berusuk (atap loko)
  const insulator = (x, y0, z, h, r = 0.014) => {
    const cream = std(0xe6dcc6, { roughness: 0.55 });
    add(cyl(r * 0.6, h, 10), cream, x, y0 + h / 2, z);
    const n = Math.max(2, Math.round(h / 0.014));
    for (let i = 0; i < n; i++) fine(add(cyl(r, 0.005, 12), cream, x, y0 + ((i + 0.6) * h) / (n + 0.4), z));
  };

  /* ---------------- BOGIE ----------------
     fc = pusat bogie (f), r = jari-jari roda, ax = setengah jarak as. Rangka samping di luar roda: dudukan di atas tiap kotak as,
     balok rendah di antaranya; suspensi sekunder di tengah (loko: pegas ulir ganda seperti di foto; gerbong: pegas udara). */
  const bogie = (fc, r, ax, type) => {
    const bx = X(fc), yC = r, WZ = 0.27, FZ = WZ + 0.045;
    const frame = std(0x2a2d31, { metalness: 0.35, roughness: 0.6 });
    const tyre = std(0x3d4147, { metalness: 0.55, roughness: 0.38 });
    const disc = std(0x26292d, { metalness: 0.3, roughness: 0.65 });
    const hub = std(0xa7acb3, { metalness: 0.5, roughness: 0.35 });
    const steel = std(0xb6bac0, { metalness: 0.55, roughness: 0.35 });
    const yellow = std(0xd9a514, { roughness: 0.5 });
    for (const a of [-ax, ax]) {
      zAx(cyl(0.016, 2 * WZ + 0.02, 8), frame, bx + a, yC, 0);                                  // as roda
      if (type === 'coach') for (const sz of [-1, 1]) fine(zAx(cyl(r * 0.62, 0.012, 20), steel, bx + a, yC, sz * 0.09));   // cakram rem di as
      for (const sz of [-1, 1]) {
        zAx(cyl(r, 0.036, 32), tyre, bx + a, yC, sz * WZ);                                        // ban/tapak
        fine(zAx(cyl(r + 0.009, 0.008, 32), tyre, bx + a, yC, sz * (WZ - 0.021)));               // flens (sisi dalam)
        zAx(cyl(r * 0.8, 0.04, 28), disc, bx + a, yC, sz * WZ);                                   // piringan roda (gelap, sedikit menonjol)
        zAx(cyl(r * 0.32, 0.048, 16), hub, bx + a, yC, sz * WZ);                                  // naf
        // kotak as (axle box) + tutup bulat + rusuk
        add(rbox(0.07, 0.075, 0.05, 0.012), frame, bx + a, yC, sz * (FZ + 0.006));
        fine(zAx(cyl(0.024, 0.062, 16), steel, bx + a, yC, sz * (FZ + 0.006)));
        for (const dy of [-0.026, 0.026]) fine(add(box(0.074, 0.007, 0.054), frame, bx + a, yC + dy, sz * (FZ + 0.006)));
        // dudukan rangka di atas kotak as
        add(rbox(0.15, 0.05, 0.04, 0.01), frame, bx + a, yC + 0.075, sz * FZ);
        if (type === 'loco') {
          // pegas primer ganda di kiri-kanan kotak as
          fine(add(coilGeo(0.014, 0.05, 4, 0.0035), steel, bx + a + Math.sign(a) * 0.05, yC + 0.02, sz * (FZ + 0.004)));   // di sisi luar
        }
      }
    }
    for (const sz of [-1, 1]) {
      add(rbox(2 * ax - 0.09, 0.05, 0.04, 0.01), frame, bx, yC + 0.02, sz * FZ);                // balok rendah di tengah
      for (const s of [-1, 1]) add(rbox(0.05, 0.04, 0.04, 0.01), frame, bx + s * (ax + 0.095), yC + 0.055, sz * FZ);   // ujung rangka
      if (type === 'loco') {
        // suspensi sekunder: dua pegas ulir besar dari balok sampai bawah badan (seperti di foto)
        const y0 = yC + 0.045, y1 = FLOOR - 0.004;
        for (const d of [-0.036, 0.036]) {
          fine(add(coilGeo(0.022, y1 - y0, 5.5, 0.0055), steel, bx + d, (y0 + y1) / 2, sz * FZ));
          fine(add(cyl(0.026, 0.008, 14), frame, bx + d, y1 - 0.004, sz * FZ));
        }
        // peredam vertikal kuning
        fine(add(cyl(0.009, y1 - y0 - 0.02, 10), yellow, bx + 0.085, (y0 + y1) / 2, sz * FZ));
      } else {
        // pegas udara (karet hitam) + dudukan, peredam yaw mendatar
        const rubber = std(0x151618, { roughness: 0.8 });
        fine(add(cyl(0.036, 0.05, 20), rubber, bx, yC + 0.07, sz * (FZ - 0.01)));
        fine(add(cyl(0.016, FLOOR - (yC + 0.095), 10), frame, bx, (yC + 0.095 + FLOOR) / 2, sz * (FZ - 0.01)));
        fine(xAx(cyl(0.009, 0.12, 10), yellow, bx + ax * 0.45, yC + 0.055, sz * (FZ + 0.025)));
      }
    }
    // bolster melintang (tipis supaya tidak menembus roda)
    add(box(0.05, 0.035, 2 * FZ), frame, bx, yC + 0.025, 0);
  };

  /* ---------------- RODA / BOGIE / BAWAH BADAN ---------------- */
  if (kind === 'wheels') {
    const frame = std(0x30343a, { metalness: 0.35, roughness: 0.55 });
    const under = std(IC.under, { roughness: 0.7 });
    const slit = std(0x0f1013, { roughness: 0.8 });
    const steel = std(0xb6bac0, { metalness: 0.55, roughness: 0.35 });
    // Lantai bawah badan lebar 0.48 (z ±0.24): lebih sempit dari roda & kotak peralatan → tidak ada sisi sebidang (z-fighting)
    const stub = (xEnd, dir) => add(box(0.07, 0.05, 0.1), frame, xEnd + dir * 0.035, 0.255, 0);   // kopling pendek
    if (isLoco) {
      const f0 = -L / 2 + 0.01, f1 = F - 0.18;
      add(rbox(f1 - f0, 0.07, 0.48, 0.02), frame, X((f0 + f1) / 2), 0.255, 0);
      bogie(-0.34, 0.12, 0.15, 'loco');
      bogie(0.5, 0.12, 0.15, 'loco');
      // tangki trafo di antara bogie: kotak abu-gelap dengan 3 × 3 kisi (seperti di foto)
      const gear = std(0x3b3f36, { roughness: 0.6, metalness: 0.2 });
      add(rbox(0.26, 0.12, 0.52, 0.015), gear, X(0.08), 0.16, 0);
      for (const sz of [-1, 1]) {
        for (let c = 0; c < 3; c++) for (let rI = 0; rI < 3; rI++) {
          fine(add(box(0.068, 0.012, 0.006), slit, X(0.08 + (c - 1) * 0.08), 0.12 + rI * 0.035, sz * 0.261));
        }
        fine(add(box(0.25, 0.006, 0.006), steel, X(0.08), 0.215, sz * 0.261));
      }
      // bajak (plough) perak di bawah hidung
      const silver = std(IC.silver, { metalness: 0.45, roughness: 0.4 });
      const pl = new THREE.Mesh(profileGeo([[F - 0.17, FLOOR + 0.01], [F - 0.008, FLOOR + 0.01], [F - 0.03, 0.055], [F - 0.105, 0.055]], 0.56, 0.02, 0.01), silver);
      pl.position.x = cx; pl.castShadow = true; g.add(pl);
      for (let i = 0; i < 3; i++) fine(add(box(0.01, 0.008, 0.3), slit, X(F - 0.02 - i * 0.008), 0.24 - i * 0.05, 0));   // celah bajak
      // ujung belakang: balok penyangga + buffer bulat bermahkota merah + kopling + selang
      const rx = -L / 2;
      add(rbox(0.05, 0.17, 0.6, 0.012), under, X(rx + 0.025), 0.205, 0);
      for (const sz of [-1, 1]) {
        xAx(cyl(0.022, 0.05, 14), steel, X(rx - 0.02), 0.2, sz * 0.21);
        xAx(cyl(0.045, 0.012, 22), std(0x17191c, { roughness: 0.5 }), X(rx - 0.05), 0.2, sz * 0.21);
        fine(xAx(cyl(0.034, 0.014, 22), std(0xb0141c, { roughness: 0.5 }), X(rx - 0.04), 0.2, sz * 0.21));
        fine(bar([X(rx - 0.005), 0.25], [X(rx - 0.04), 0.17], 0.012, std(0x111214, { roughness: 0.8 }), sz * 0.08, true));   // selang
      }
      stub(X(rx), -1);
    } else {
      add(rbox(L - 0.04, 0.07, 0.48, 0.02), frame, cx, 0.255, 0);
      bogie(-0.41, 0.1, 0.13, 'coach');
      bogie(0.41, 0.1, 0.13, 'coach');
      // peralatan bawah lantai (hitam) dengan garis panel + dua tangki udara
      add(rbox(0.22, 0.085, 0.46, 0.012), under, X(-0.06), 0.175, 0);
      for (const sz of [-1, 1]) for (let i = 0; i < 5; i++) fine(add(box(0.004, 0.07, 0.004), slit, X(-0.15 + i * 0.045), 0.175, sz * 0.231));
      for (const sz of [-1, 1]) xAx(cyl(0.034, 0.09, 16), under, X(0.135), 0.185, sz * 0.15);
      add(box(0.1, 0.02, 0.36), under, X(0.135), 0.215, 0);
      stub(X(L / 2), 1);
      stub(X(-L / 2), -1);
    }
  }

  /* ---------------- BADAN ---------------- */
  if (kind === 'body') {
    const red = std(IC.red, { roughness: 0.5 });
    if (isLoco) {
      // ---- badan merah + hidung baji (profil samping) ----
      const body = new THREE.Mesh(profileGeo(LOCO_PROFILE, 0.66), red);
      body.position.x = cx; body.castShadow = true;
      g.add(body);
      decal(locoSideTexture(1), locoSideTexture(-1), (F - L / 2) / 2, F + L / 2, (TOP + FLOOR) / 2, TOP - FLOOR);

      const black = std(0x101214, { roughness: 0.45 });
      const glass = std(0x3d4a58, { metalness: 0.6, roughness: 0.12, envMapIntensity: 0.9 });
      const silver = std(IC.silver, { metalness: 0.45, roughness: 0.4 });
      const lampW = std(0xfff6d0, { emissive: 0xffe9a0, emissiveIntensity: 1.2 });
      const lampR = std(0xff3a2a, { emissive: 0xff2010, emissiveIntensity: 0.7 });
      const steelB = std(0xb6bac0, { metalness: 0.55, roughness: 0.35 });
      // lereng hidung: titik A (ujung) → B (tepi atap); normal keluar (+f, +y)
      const A = [F, NOSE_TIP_Y], sd = [NOSE_TOP_F - F, TOP - NOSE_TIP_Y], slen = Math.hypot(sd[0], sd[1]);
      const sn = [sd[1] / slen, -sd[0] / slen], ang = Math.atan2(sd[1], sd[0]);
      const at = (t, d) => [A[0] + sd[0] * t + sn[0] * d, A[1] + sd[1] * t + sn[1] * d];
      const onSlope = (t0, t1, d, thick, w, mat, z = 0) => {
        const [f, y] = at((t0 + t1) / 2, d);
        return add(box((t1 - t0) * slen, thick, w), mat, X(f), y, z, [0, 0, ang]);
      };
      // bingkai hitam kabin + dua kaca depan + tiang tengah + wiper
      onSlope(0.2, 1.03, BS + 0.004, 0.008, 0.61, black);
      for (const sz of [-1, 1]) {
        onSlope(0.38, 0.95, BS + 0.009, 0.006, 0.262, glass, sz * 0.141);
        fine(onSlope(0.41, 0.43, BS + 0.013, 0.004, 0.17, black, sz * 0.15));
        fine(onSlope(0.36, 0.38, BS + 0.012, 0.003, 0.26, std(0x2a2d31), sz * 0.141));   // karet bawah kaca
      }
      // lampu depan di lereng bawah kaca: panel hitam + lampu sorot putih + lampu ekor merah
      for (const sz of [-1, 1]) {
        onSlope(0.05, 0.16, BS + 0.004, 0.008, 0.16, black, sz * 0.2);
        const [f1, y1] = at(0.105, BS + 0.01);
        fine(add(cyl(0.024, 0.008, 18), lampW, X(f1), y1, sz * 0.235, [0, 0, ang]));
        fine(add(cyl(0.017, 0.008, 18), lampR, X(f1), y1, sz * 0.16, [0, 0, ang]));
      }
      // bibir tegak di ujung hidung: pita perak + kisi tengah
      const fx = F + BS + 0.004;
      add(box(0.01, 0.07, 0.62), silver, X(fx), 0.36, 0);
      for (let i = 0; i < 3; i++) fine(add(box(0.012, 0.006, 0.16), black, X(fx + 0.002), 0.34 + i * 0.016, 0));

      // ujung belakang (tumpul): panel kuning peringatan, dua jendela kabin, lampu, pegangan
      const rx = X(-L / 2 - BS - 0.004);
      add(box(0.008, 0.21, 0.6), std(0xe2ad1c, { roughness: 0.5 }), rx, 0.405, 0);
      for (const sz of [-1, 1]) {
        add(box(0.008, 0.13, 0.2), black, rx, 0.655, sz * 0.15);
        add(box(0.01, 0.105, 0.175), glass, rx - 0.002, 0.655, sz * 0.15);
        fine(xAx(cyl(0.024, 0.01, 18), lampW, rx - 0.004, 0.36, sz * 0.23));
        fine(xAx(cyl(0.017, 0.01, 18), lampR, rx - 0.004, 0.36, sz * 0.15));
        fine(add(box(0.012, 0.03, 0.03), std(0x2a2d31), rx - 0.004, 0.33, sz * 0.05));        // soket jumper
      }
      fine(zAx(cyl(0.005, 0.12, 8), steelB, rx - 0.018, 0.55, 0));

      // pegangan tangan di samping pintu (belakang & kabin), kedua sisi
      const fI = (x) => -L / 2 + ((x - 45) / 1375) * (F + L / 2), yI = (y) => TOP - ((y - 113) / 145) * (TOP - FLOOR);
      for (const sz of [-1, 1]) {
        for (const [x, ya, yb] of [[200, 205, 140], [242, 205, 140], [1250, 215, 145], [1295, 215, 145]]) {
          const y0 = yI(ya), y1 = yI(yb);
          fine(add(cyl(0.0045, y1 - y0, 8), steelB, X(fI(x)), (y0 + y1) / 2, sz * 0.349));
          for (const y of [y0 + 0.006, y1 - 0.006]) fine(add(box(0.006, 0.006, 0.014), steelB, X(fI(x)), y, sz * 0.343));
        }
      }
    } else {
      // ---- gerbong Mk4: badan bersudut bulat (ujung putih-abu), stiker sisi berlivery InterCity ----
      add(new RoundedBoxGeometry(L, TOP - FLOOR, 0.66, 3, 0.025), std(IC.coachEnd, { roughness: 0.5 }), cx, (TOP + FLOOR) / 2, 0).castShadow = true;
      const kindS = car === 'car1' ? 'rfm' : 'ts';
      decal(coachSideTexture(kindS, 1), coachSideTexture(kindS, -1), 0, L, (TOP + FLOOR) / 2, TOP - FLOOR);
      // pita marun-tua di dinding ujung (bagian atas), lanjutan pita jendela
      for (const s of [-1, 1]) add(box(0.004, 0.12, 0.6), std(0x3a1d22, { roughness: 0.6 }), X(s * (L / 2 + 0.002)), 0.72, 0);
      // gangway di kedua ujung: bingkai karet hitam; ke gerbong lain → peredam (bellows) berlipat, ujung luar → pintu tertutup
      const rubber = std(0x18191c, { roughness: 0.85 });
      const ring = rrShape(0.42, 0.47, 0.07);
      ring.holes.push(rrShape(0.3, 0.37, 0.05));
      const ringGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.02, bevelEnabled: false, curveSegments: 5 });
      ringGeo.rotateY(Math.PI / 2);   // ekstrusi z → x
      const yG = 0.535;
      const ends = car === 'car1' ? [[1, false], [-1, true]] : [[1, true], [-1, false]];   // [arah, bersambung ke gerbong lain?]
      for (const [s, linked] of ends) {
        const xe = X(s * L / 2);
        add(ringGeo, rubber, s > 0 ? xe : xe - 0.02, yG, 0);
        if (linked) {
          add(box(0.07, 0.42, 0.44), rubber, xe + s * 0.055, yG, 0);
          for (let i = 0; i < 3; i++) fine(add(box(0.008, 0.44, 0.46), std(0x24262a, { roughness: 0.9 }), xe + s * (0.03 + i * 0.022), yG, 0));
        } else {
          add(box(0.008, 0.37, 0.3), std(0x3d4146, { roughness: 0.6 }), xe + s * 0.006, yG, 0);
          add(box(0.01, 0.1, 0.12), std(0x0d0e10, { roughness: 0.3 }), xe + s * 0.008, yG + 0.09, 0);
          if (isTail) for (const sz of [-1, 1]) fine(xAx(cyl(0.02, 0.01, 18), std(0xff3a2a, { emissive: 0xff2010, emissiveIntensity: 0.7 }), xe + s * 0.004, 0.36, sz * 0.23));
        }
      }
    }
  }

  /* ---------------- TUTUP ATAS BADAN: panel abu-gelap di tengah, bingkai merah di tepi (tempat tulisan terukir) ---------------- */
  let topY = 0, topFc = 0;   // permukaan panel (y) & pusatnya (f) — dipakai tulisan terukir di bawah
  if (kind === 'body') {
    const panelMat = std(0x34383e, { roughness: 0.55, metalness: 0.25, envMapIntensity: 0.3 });
    if (isLoco) {
      // atap badan loko sudah merah (puncak profil di TOP + BS): cukup panel gelap yang menyisakan bingkai merah tipis
      topFc = 0.075;
      topY = TOP + BS + 0.005;
      fine(add(rbox(1.35, 0.01, 0.5, 0.004), panelMat, X(topFc), topY, 0));
    } else {
      // gerbong: bingkai merah di seluruh tutup (puncak badan di y = TOP), panel gelap di dalamnya
      const rim = std(0x8a1219, { roughness: 0.5 });
      fine(add(rbox(L - 0.06, 0.006, 0.61, 0.002), rim, cx, TOP + 0.002, 0));
      topY = TOP + 0.004 + 0.005;
      fine(add(rbox(L - 0.17, 0.01, 0.5, 0.004), panelMat, cx, topY, 0));
    }
    topY += 0.005;
  }

  /* ---------------- ATAP ---------------- */
  if (kind === 'roof') {
    const grey = std(0x8d949c, { roughness: 0.55 });
    const dark = std(0x2b2f35, { roughness: 0.5, metalness: 0.3 });
    const dome = (f0, f1, peak, mat, bevel = 0, shear = null, y0 = TOP + 0.005) => {
      const m = new THREE.Mesh(domeGeo(f1 - f0, 0.325, y0, peak, bevel, shear), mat);
      m.position.x = X((f0 + f1) / 2); m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      return m;
    };
    if (isLoco) {
      const roofMat = std(IC.roofLoco, { roughness: 0.38 });
      // atap belakang (tinggi, sudut belakang membulat) → ceruk pantograf (rendah) → atap depan (tinggi) yang ujungnya miring
      // melanjutkan lereng kaca depan. (Profil seperti di foto.)
      const fr = 0.05, yRef = TOP + BS;
      const fFront = F + 0.012 - (yRef - NOSE_TIP_Y) * NOSE_K;   // lereng (yang menebal BS) setinggi yRef
      dome(-L / 2, -0.44, TOP + 0.1, roofMat, 0.03);
      dome(-0.44, fr, TOP + 0.045, roofMat);
      dome(fr, fFront, TOP + 0.1, roofMat, 0, { yRef, k: NOSE_K });
      // pantograf lengan tunggal di ceruk: rangka dasar di atas 4 isolator, lengan bawah naik ke depan (seperti di foto),
      // lengan atas kembali ke atas dasar, kepala kolektor dengan dua bilah & tanduk melengkung
      const metal = std(0x3a3d42, { metalness: 0.5, roughness: 0.45 });
      const shiny = std(0xc9ccd0, { metalness: 0.6, roughness: 0.3 });
      const by = TOP + 0.045, pf = -0.31;
      for (const df of [-0.09, 0.09]) for (const z of [-0.09, 0.09]) insulator(X(pf + df), by, z, 0.045);
      for (const z of [-0.09, 0.09]) add(box(0.24, 0.016, 0.022), metal, X(pf), by + 0.053, z);
      for (const df of [-0.11, 0.11]) add(box(0.022, 0.016, 0.2), metal, X(pf + df), by + 0.053, 0);
      const hinge = [X(pf - 0.08), by + 0.075], knee = [X(pf + 0.2), by + 0.26], head = [X(pf - 0.02), by + 0.43];
      zAx(cyl(0.012, 0.2, 10), metal, hinge[0], hinge[1], 0);
      for (const z of [-0.055, 0.055]) bar(hinge, knee, 0.02, metal, z, true);
      bar([hinge[0] + 0.03, hinge[1] - 0.01], [knee[0] - 0.02, knee[1] - 0.012], 0.008, shiny, 0, true);   // batang pendorong
      fine(zAx(cyl(0.01, 0.13, 10), metal, knee[0], knee[1], 0));
      bar(knee, head, 0.016, metal, 0, true);
      bar([knee[0] - 0.01, knee[1] + 0.012], [head[0] + 0.03, head[1] - 0.01], 0.006, shiny, 0, true);
      fine(bar([X(pf + 0.07), by + 0.06], [X(pf + 0.02), by + 0.15], 0.012, std(0xd9a514), 0.08, true));   // peredam
      add(rbox(0.07, 0.035, 0.07, 0.01), metal, X(pf), by + 0.075, 0);                                 // kotak pegas angkat
      // kepala kolektor
      add(box(0.03, 0.014, 0.12), metal, head[0], head[1] + 0.006, 0);
      for (const df of [-0.025, 0.025]) {
        add(box(0.016, 0.012, 0.34), shiny, head[0] + df, head[1] + 0.018, 0);
        for (const sz of [-1, 1]) fine(add(box(0.014, 0.01, 0.06), shiny, head[0] + df, head[1] + 0.003, sz * 0.19, [0.65 * sz, 0, 0]));   // tanduk
      }
      // pemutus sirkuit di depan pantograf: silinder kecil abu + silinder besar gelap di atas isolator (seperti di foto)
      insulator(X(-0.15), by, 0, 0.04, 0.012);
      insulator(X(-0.04), by, 0, 0.04, 0.012);
      xAx(cyl(0.018, 0.06, 14), grey, X(-0.17), by + 0.058, 0);
      xAx(cyl(0.029, 0.13, 18), dark, X(-0.065), by + 0.06, 0);
      fine(xAx(cyl(0.031, 0.006, 18), grey, X(-0.12), by + 0.06, 0));
      fine(xAx(cyl(0.031, 0.006, 18), grey, X(-0.01), by + 0.06, 0));
      fine(xAx(cyl(0.004, 0.14, 6), shiny, X(-0.27), by + 0.065, 0.13));                                         // konduktor atap
      // klakson & antena kecil di atap depan
      for (const z of [-0.07, 0.07]) fine(xAx(cyl(0.011, 0.04, 12, 0.007), grey, X(0.68), TOP + 0.105, z));
      fine(add(cyl(0.004, 0.05, 6), dark, X(0.62), TOP + 0.125, 0));
      // kisi ventilasi di atap belakang
      add(rbox(0.12, 0.012, 0.2, 0.004), dark, X(-0.56), TOP + 0.104, 0);
    } else {
      const roofMat = std(IC.roofCoach, { roughness: 0.45 });
      dome(-L / 2 + 0.01, L / 2 - 0.01, TOP + 0.1, roofMat, 0.02, null, TOP - 0.01);
      // talang air di kedua tepi
      for (const sz of [-1, 1]) fine(add(box(L - 0.08, 0.008, 0.008), dark, cx, TOP + 0.022, sz * 0.326));
      // unit AC rendah berkisi + ventilasi jamur kecil dekat ujung
      for (const df of [-0.3, 0.3]) {
        add(rbox(0.32, 0.035, 0.24, 0.012), grey, X(df), TOP + 0.105, 0);
        for (let i = 0; i < 5; i++) fine(add(box(0.006, 0.006, 0.2), dark, X(df - 0.12 + i * 0.06), TOP + 0.124, 0));
      }
      for (const df of [-0.56, 0.56]) for (const z of [-0.08, 0.08]) {
        fine(add(cyl(0.008, 0.02, 8), dark, X(df), TOP + 0.1, z));
        fine(add(cyl(0.02, 0.008, 14), grey, X(df), TOP + 0.112, z));
      }
    }
  }

  // Tulisan terukir langsung di badan kereta (tanpa plat tambahan): atap → di puncak kubah; badan → di area sisi yang polos;
  // roda → di permukaan atas lantai rangka. Ukuran blok teks (w) menyesuaikan permukaan; kamera 'engrave' menyesuaikan jaraknya.
  if (cfg) {
    const w = kind === 'body' ? 0.72 : 0.22;
    let tilt = 0;
    const spot = new THREE.Mesh(new THREE.PlaneGeometry(w, w / ENGRAVE_ASPECT), engraveMaterial(cfg, 'light'));
    if (kind === 'roof') {
      // puncak kubah (di luar pantograf / unit AC): loko di atap depan
      spot.position.set(X(isLoco ? 0.4 : 0), TOP + 0.1 + 0.004, 0);
      spot.rotation.x = -Math.PI / 2;                                                 // menghadap ke atas
      tilt = 0.12;                                                                    // kamera sedikit miring ke arah kartu
    } else if (kind === 'body') {
      // panel abu-gelap di tutup atas badan
      spot.position.set(X(topFc), topY, 0);
      spot.rotation.x = -Math.PI / 2;
      tilt = 0.12;
    } else {
      spot.position.set(cx, 0.29 + 0.004, 0);                                         // permukaan atas lantai rangka (y 0.29)
      spot.rotation.x = -Math.PI / 2;
      tilt = 0.12;
    }
    spot.castShadow = false; spot.receiveShadow = false;
    spot.userData.isEngrave = true;
    g.add(spot);
    g.userData.engrave = { spot, tilt };
  }
  // Badan & atap tidak menerima bayangan: peta bayangan spotlight toko beresolusi rendah, sehingga permukaan tipis di dekat
  // bagian lain (jendela, pita bawah, lantai) tampak bintik / bergaris (shadow acne). Tetap melempar bayangan ke meja.
  if (kind === 'body' || kind === 'roof') g.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
  return g;
}

/* ---------------- Tekstur kanvas ---------------- */
function gradientTexture(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}

function digitTexture(d) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 80;
  const g = c.getContext('2d');
  g.fillStyle = '#f3ead6'; g.fillRect(0, 0, 128, 80);
  g.fillStyle = '#d8c9a8'; g.fillRect(0, 0, 128, 4); g.fillRect(0, 76, 128, 4);
  g.fillStyle = '#2a1c12';
  g.font = 'bold 66px Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(d), 64, 44);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  return tx;
}

function plaqueTexture(cfg) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 440;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f0df'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#b08d4a'; g.lineWidth = 10; g.strokeRect(14, 14, c.width - 28, c.height - 28);
  g.fillStyle = '#3b2a1a';
  g.font = 'bold 76px Georgia, serif';
  g.textBaseline = 'top';
  g.fillText(cfg.name, 60, 46);
  g.font = '30px Georgia, serif';
  const words = cfg.text.join(' ').split(' ');
  let line = '', y = 160;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > c.width - 120) { g.fillText(line, 60, y); line = w; y += 40; }
    else line = test;
  }
  g.fillText(line, 60, y);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 8;
  return tx;
}
