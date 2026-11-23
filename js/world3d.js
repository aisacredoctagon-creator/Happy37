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
const FOAM_TOP = T + 0.32;
const MOULD_Y = FOAM_TOP - 0.04;
const TRAIN_SCALE = 0.85;
const FLOAT_Y = 1.95;
// Kartu bagian di tutup koper: sengaja tidak putih bersih (lampu toko + tone mapping membuatnya silau)
const TILE_COLOR = 0x958a74;
const PLAQUE_TINT = 0x9e9786;

export function createWorld({ canvas, ui, onDone, onShopOpen, onStreetDone }) {
  /* ---------------- Renderer / scene / camera ---------------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    foam: new THREE.MeshStandardMaterial({ color: 0x26282d, roughness: 1, envMapIntensity: 0.3 }),
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
  base.add(at(box(W - 2 * T, FOAM_TOP - T, D - 2 * T, M.foam, 0.01), 0, T + (FOAM_TOP - T) / 2, 0));
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
  handle.position.set(0, 0.1, D + 0.03);
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
  const SIDE_POSE = { rx: -Math.PI / 2, y: 0.34, z: 0.45 };
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
        o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 35), M.ghostEdge));
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

  const clock = new THREE.Clock();
  let raf = 0, running = false;
  function frame() {
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
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
      rotVel *= 0.94;
      train.rotation.y += rotVel;
      trackRotation(rotVel);
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
    start() { if (running) return; running = true; resize(); clock.start(); frame(); },
    stop() { running = false; cancelAnimationFrame(raf); reset(); shop?.leave(); street?.leave(); },
  };
}

/* ============================================================
   MODEL BAGIAN KERETA — InterCity 225 (London King's Cross ⇄ Edinburgh), livery Virgin Trains East Coast
   Lokomotif listrik Class 91 (badan merah, panel hidung oranye-kuning, pita abu-abu di bawah,
   "swoosh" putih-abu di belakang, pantograf) menarik gerbong Mk4 (pita jendela hitam, pintu abu-abu)
   — gerbong 1 = RSB (buffet: sebagian jendela tertutup), gerbong 2 = DVT (Driving Van Trailer)
   dengan hidung yang sama di ujung lain.
   Koordinat kereta: x = panjang (lokomotif di +x), y = atas.
   Di dalam buildPartModel, "f" = jarak sepanjang gerbong ke arah hidung (relatif ke pusat gerbong).
   Ganti isi fungsi ini dengan model GLB bila sudah ada.
============================================================ */
// Jarak antar gerbong 0.2 (bukan 0.1): kopling & peredam sambungan tiap gerbong menjorok ≤ 0.1 sehingga tidak saling bertabrakan
const CARS = { loco: 1.4, car1: -0.15, car2: -1.7 };
const L = 1.35;                 // panjang badan (tanpa hidung)
const NOSE_LEN = 0.28;          // panjang hidung di depan badan
const F = L / 2 + NOSE_LEN;     // ujung depan (f)
const TOP = 0.8;                // tinggi atap badan
const FLOOR = 0.29;             // tinggi lantai badan
const BS = 0.015;               // bevel profil hidung (permukaan keluar sebesar ini dari outline)
const IC = {
  // Warna sengaja digelapkan/dijenuhkan: lampu & tone mapping di toko membuat warna tampak lebih pucat
  red: 0x9c0d14,        // merah Virgin
  grey: 0x8f9399,       // pita bawah & swoosh abu-abu perak
  black: 0x141619,
  orange: 0xc86400,    // panel hidung oranye-kuning
  trim: 0xe0701a,       // garis tipis oranye di tepi atap
  glass: 0x1c2530,
  door: 0xb2b5ba,       // pintu gerbong abu-putih
  roofLoco: 0x30343a,
  roofCoach: 0x585e66,
};

function colFor(id) { return id.startsWith('loco') ? 2 : id.startsWith('car1') ? 1 : 0; }
function rowFor(id) { return id.endsWith('roof') ? 0 : id.endsWith('body') ? 1 : 2; }

// Profil samping (x,y) → ekstrusi melintang (lebar total = width), pusat di z = 0
function profileGeo(pts, width, bevel = 0.03, bevelSize = BS) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const depth = width - 2 * bevel;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize, bevelSegments: 3, curveSegments: 4,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

// Atap melengkung (penampang kubah) memanjang sepanjang x, pusat di x = 0
function domeGeo(len, halfW, y0, peak, bevel = 0) {
  const k = y0 + (peak - y0) * 0.78;
  const s = new THREE.Shape();
  s.moveTo(-halfW, y0);
  s.bezierCurveTo(-halfW, k, -halfW * 0.55, peak, 0, peak);
  s.bezierCurveTo(halfW * 0.55, peak, halfW, k, halfW, y0);
  s.lineTo(-halfW, y0);
  const depth = len - 2 * bevel;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 2, curveSegments: 12,
  });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(Math.PI / 2);   // sumbu ekstrusi (z) → x
  return geo;
}

// Titik & turunan kurva Bézier kubik P = [[x,y] x4] pada parameter t
function bezPt(P, t) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
}
function bezTan(P, t) {
  const u = 1 - t, a = 3 * u * u, b = 6 * u * t, c = 3 * t * t;
  return [a * (P[1][0] - P[0][0]) + b * (P[2][0] - P[1][0]) + c * (P[3][0] - P[2][0]),
    a * (P[1][1] - P[0][1]) + b * (P[2][1] - P[1][1]) + c * (P[3][1] - P[2][1])];
}

// "Swoosh" Virgin: area abu-abu yang melengkung mulus dari pita bawah ke atas (awalnya mendatar → tidak ada sudut tajam),
// dengan garis putih berbentuk bulan sabit (meruncing di kedua ujung) di tepi atasnya.
// P = kurva tepi atas area abu-abu (mulai di dasar kanvas, mendatar; berakhir di x = 0). flip → cermin horizontal.
function swooshPath(g, W, H, P, wmax, flip) {
  g.save();
  if (flip) { g.translate(W, 0); g.scale(-1, 1); }
  const N = 96, pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [x, y] = bezPt(P, t), [dx, dy] = bezTan(P, t);
    const len = Math.hypot(dx, dy) || 1;
    pts.push({ x: x * W, y: y * H, nx: -dy / len, ny: dx / len, t });
  }
  // abu-abu: di bawah kurva sampai tepi bawah & kiri
  g.fillStyle = '#8f9399';
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.lineTo(0, H + 2); g.lineTo(pts[0].x, H + 2);
  g.closePath(); g.fill();
  // garis putih: bulan sabit di sisi luar (merah) kurva, tebal maksimum di tengah, runcing di ujung
  const wAt = (t) => wmax * H * Math.pow(Math.sin(Math.PI * t), 0.85);
  g.fillStyle = '#e6e6e3';
  g.beginPath();
  pts.forEach((p, i) => { const q = [p.x - p.nx * 2, p.y - p.ny * 2]; i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
  for (let i = N; i >= 0; i--) { const p = pts[i], w = wAt(p.t); g.lineTo(p.x + p.nx * w, p.y + p.ny * w); }
  g.closePath(); g.fill();
  g.restore();
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

// Tekstur sisi gerbong — SATU bidang transparan per sisi berisi semua detail: pita abu-abu / alas hitam, garis oranye,
// swoosh, jendela, pintu, kisi, logo. (Sebelumnya detail ini kotak-kotak tipis yang ditumpuk → z-fighting / glitch.)
// kind: 'loco' | 'dvt' | 'rsb'. dir = +1: sumbu u tekstur searah f (arah hidung); −1: berlawanan (sisi seberang / bidang diputar).
const SIDE_PPU = 1200;   // piksel per satuan model
const hexCss = (n) => '#' + n.toString(16).padStart(6, '0');

function sideTexture(kind, dir) {
  const nose = kind !== 'rsb';
  const f0 = -L / 2, f1 = nose ? F - 0.03 : L / 2;
  const W = Math.round((f1 - f0) * SIDE_PPU), H = Math.round((TOP - FLOOR) * SIDE_PPU);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const px = (f) => ((dir > 0 ? f - f0 : f1 - f) / (f1 - f0)) * W;
  const py = (y) => ((TOP - y) / (TOP - FLOOR)) * H;
  const box = (fa, fb, ya, yb, color) => {
    const x0 = Math.min(px(fa), px(fb)), x1 = Math.max(px(fa), px(fb));
    g.fillStyle = color; g.fillRect(x0, py(yb), x1 - x0, py(ya) - py(yb));
  };
  const rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  // jendela: bingkai hitam membulat + kaca gradasi gelap
  const win = (fa, fb, ya, yb) => {
    const x0 = Math.min(px(fa), px(fb)), x1 = Math.max(px(fa), px(fb)), y0 = py(yb), y1 = py(ya), m = 0.006 * SIDE_PPU;
    g.fillStyle = hexCss(IC.black); rr(x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m, m * 3); g.fill();
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, '#2c3a49'); gr.addColorStop(1, '#131a23');
    g.fillStyle = gr; rr(x0, y0, x1 - x0, y1 - y0, m * 2); g.fill();
  };
  const door = (f) => {
    box(f - 0.075, f + 0.075, 0.30, 0.77, hexCss(IC.door));
    box(f - 0.0875, f - 0.0775, 0.295, 0.775, hexCss(IC.black));
    box(f + 0.0775, f + 0.0875, 0.295, 0.775, hexCss(IC.black));
    win(f - 0.035, f + 0.035, 0.59, 0.71);
    box(f + 0.024, f + 0.036, 0.40, 0.60, hexCss(IC.black));       // gagang
  };
  const step = (f) => box(f - 0.075, f + 0.075, FLOOR, FLOOR + 0.014, '#f2c230');   // langkah kuning

  // 1) swoosh (abu-abu melengkung + garis putih meruncing) di ujung belakang
  g.save();
  if (kind === 'loco') {
    const xa = Math.min(px(f0), px(0.45)), w = Math.abs(px(0.45) - px(f0));
    g.translate(xa, 0);
    swooshPath(g, w, ((TOP - 0.4) / (TOP - FLOOR)) * H, [[0.8, 1], [0.48, 1], [0.12, 0.9], [0, 0.2]], 0.07, dir < 0);
  } else {
    const xa = Math.min(px(f0), px(L / 2)), w = Math.abs(px(L / 2) - px(f0));
    g.translate(xa, 0);
    swooshPath(g, w, H, [[0.42, 1], [0.21, 1], [0.05, 0.86], [0, 0.25]], 0.06, dir < 0);
  }
  g.restore();

  // 2) pita bawah: loko / DVT abu-abu perak sampai hidung; gerbong RSB alas hitam
  if (nose) box(f0, f1, FLOOR, 0.40, hexCss(IC.grey));
  else box(f0, f1, FLOOR, 0.33, hexCss(IC.black));

  // 3) garis oranye tipis di tepi atap
  box(f0, nose ? F - 0.3 : f1, 0.771, 0.779, hexCss(IC.trim));

  // 4) detail per jenis
  if (kind === 'loco') {
    for (const f of [-0.38, 0.33]) win(f - 0.0225, f + 0.0225, 0.59, 0.69);          // kisi / jendela kecil
    for (const f of [0.45, 0.78]) box(f - 0.004, f + 0.004, 0.325, 0.775, '#4b1013');  // celah pintu kabin
    win(0.51, 0.73, 0.615, 0.735);                                                   // jendela samping kabin
  } else {
    const winBand = (fa, fb) => box(fa, fb, 0.565, 0.715, hexCss(IC.black));
    const ww = 0.0725;
    if (kind === 'dvt') {
      winBand(-0.37, -0.03);
      for (const f of [-0.3, -0.12]) win(f - ww, f + ww, 0.585, 0.695);
      // pintu bagasi geser besar
      box(-0.08, 0.28, 0.31, 0.79, '#a4a8ae');
      box(-0.09, -0.08, 0.30, 0.795, hexCss(IC.black)); box(0.28, 0.29, 0.30, 0.795, hexCss(IC.black));
      win(0.05, 0.15, 0.615, 0.705);
      door(-L / 2 + 0.12); step(-L / 2 + 0.12);
    } else {
      winBand(-0.43, 0.43);
      for (const f of [-0.33, -0.165, 0]) win(f - ww, f + ww, 0.585, 0.695);                  // area penumpang
      for (const f of [0.2, 0.33]) win(f - 0.04, f + 0.04, 0.625, 0.695);                     // jendela kecil servery
      for (const f of [-L / 2 + 0.12, L / 2 - 0.12]) { door(f); step(f); }
    }
  }

  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 8;
  // 5) logo Virgin (putih) di sisi loko — digambar setelah gambar PNG selesai dimuat
  if (kind === 'loco') {
    loadVirginLogo().then((logo) => {
      if (!logo) return;
      const h = 0.304 * SIDE_PPU, w = (h * logo.width) / logo.height;
      g.drawImage(logo, px(0.05) - w / 2, py(0.632) - h / 2, w, h);
      tx.needsUpdate = true;
    });
  }
  return tx;
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
  const isDVT = car === 'car2';
  const isRSB = car === 'car1';
  const nose = isLoco || isDVT;     // gerbong ber-hidung
  const sg = isLoco ? 1 : -1;       // arah hidung (+x loko, -x DVT)
  const X = (f) => cx + sg * f;     // f → koordinat x dunia kereta
  const g = new THREE.Group();
  // envMapIntensity rendah: di dalam toko ada environment map terang; tanpa ini cat merah (roughness rendah) memantulkan ruangan
  // seperti lapisan bening putih → merah tampak pucat / salmon. (Logam di bagian roda memakai nilai lebih tinggi.)
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.42, envMapIntensity: 0.25, ...o });
  const add = (geo, mat, x, y, z, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };
  // batang dari titik p0 ke p1 pada bidang XY (lengan pantograf)
  const bar = (p0, p1, th, mat, z = 0) => {
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    return add(new THREE.BoxGeometry(len, th, th), mat, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, z,
      [0, 0, Math.atan2(p1[1] - p0[1], p1[0] - p0[0])]);
  };
  const yAx = (geo, mat, x, y, z) => add(geo, mat, x, y, z, [0, 0, Math.PI / 2]);   // silinder bersumbu x
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

  /* ---------------- RODA / BOGIE / BAWAH BADAN ---------------- */
  if (kind === 'wheels') {
    const frame = std(0x30343a, { metalness: 0.35, roughness: 0.55 });
    const tyre = std(0x3a3e44, { metalness: 0.3, roughness: 0.5 });
    const hub = std(0xb9bec5, { metalness: 0.35, roughness: 0.35 });
    const spring = std(0xc7cbd0, { metalness: 0.4, roughness: 0.4 });
    const gear = std(IC.grey, { metalness: 0.2, roughness: 0.55 });
    const slit = std(0x1d2024);
    // lantai bawah badan
    // Lebar 0.48 (z ±0.24): lebih sempit dari jarak roda (z ±0.27) → roda tidak menembus lantai, DAN lebih sempit dari kotak
    // peralatan di bawahnya (loko z ±0.26, gerbong z ±0.25). Kalau sama lebar, sisi-sisinya sebidang → z-fighting (tepi bergerigi).
    add(new RoundedBoxGeometry(L - 0.06, 0.07, 0.48, 2, 0.02), frame, cx, 0.255, 0);
    // Jarak antar as roda dalam satu bogie 0.30 (> diameter roda 0.24) → ban tidak saling menempel / menyatu (tampak "bertabrakan" dari samping)
    const AX = [-0.15, 0.15];
    for (const sx of [-0.4, 0.4]) {
      const bx = cx + sx;
      add(new THREE.BoxGeometry(0.5, 0.05, 0.36), frame, bx, 0.18, 0);                 // rangka bogie
      for (const sz of [-1, 1]) {
        add(new THREE.BoxGeometry(0.5, 0.045, 0.04), frame, bx, 0.17, sz * 0.245);     // gelagar samping
        for (const ax of AX) {
          add(new THREE.CylinderGeometry(0.019, 0.019, 0.075, 10), spring, bx + ax, 0.225, sz * 0.25);  // pegas
          zAx(new THREE.CylinderGeometry(0.12, 0.12, 0.045, 28), tyre, bx + ax, 0.12, sz * 0.292);
          zAx(new THREE.CylinderGeometry(0.072, 0.072, 0.052, 20), hub, bx + ax, 0.12, sz * 0.292);
          zAx(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10), frame, bx + ax, 0.12, sz * 0.292);
        }
      }
      for (const ax of AX) zAx(new THREE.CylinderGeometry(0.018, 0.018, 0.58, 8), frame, bx + ax, 0.12, 0);   // as roda
    }
    // peralatan di bawah lantai: loko = kotak berkisi abu-abu besar (seperti di foto), gerbong = kotak kecil
    if (isLoco) {
      add(new RoundedBoxGeometry(0.46, 0.115, 0.52, 2, 0.015), gear, cx, 0.23, 0);
      for (const sz of [-1, 1]) for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(0.018, 0.07, 0.006), slit, cx - 0.19 + k * 0.076, 0.23, sz * 0.262);   // kisi udara
    } else {
      add(new RoundedBoxGeometry(0.26, 0.1, 0.5, 2, 0.02), frame, cx, 0.225, 0);
      zAx(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 12), spring, cx + 0.16, 0.2, 0);
    }
    // kopling pendek (menjorok 0.07) di ujung yang berhadapan dengan gerbong lain; jarak antar gerbong 0.2 → tidak bertabrakan
    const stub = (xEnd, dir) => add(new THREE.BoxGeometry(0.07, 0.05, 0.1), frame, xEnd + dir * 0.035, 0.255, 0);
    if (isLoco) stub(cx - L / 2, -1);
    else if (isDVT) stub(cx + L / 2, 1);
    else { stub(cx - L / 2, -1); stub(cx + L / 2, 1); }
    // kopling depan di bawah hidung: di belakang panel muka (tidak menembusnya) dan menempel di bawah lantai badan
    if (nose) add(new THREE.BoxGeometry(0.08, 0.05, 0.12), frame, X(F - 0.06), 0.255, 0);
  }

  /* ---------------- BADAN ---------------- */
  // Detail sisi (jendela, pintu, pita bawah, garis oranye, swoosh, logo) digambar dalam SATU tekstur per sisi
  // (lihat sideTexture) — tidak ada kotak tipis yang bertumpuk, jadi tidak ada z-fighting / bayangan-diri.
  if (kind === 'body') {
    const glass = std(IC.glass, { metalness: 0.35, roughness: 0.1 });
    const red = std(IC.red, { roughness: 0.55 });
    const orange = std(IC.orange, { roughness: 0.4 });
    const sideKind = isLoco ? 'loco' : isDVT ? 'dvt' : 'rsb';
    const f1 = nose ? F - 0.03 : L / 2;

    if (nose) {
      // ---- badan merah + hidung (profil samping), dicerminkan lewat sg ----
      const frontPts = [[F, FLOOR], [F, 0.57], [F - 0.1, 0.77], [F - 0.2, TOP]];
      const body = new THREE.Mesh(profileGeo([[-L / 2, FLOOR], ...frontPts, [-L / 2, TOP]].map(([f, y]) => [sg * f, y]), 0.66), red);
      body.position.x = cx; body.castShadow = true;
      g.add(body);

      // ---- muka depan: balok buffer, merah, pita perak + lampu, panel oranye-kuning besar ----
      const fx = F + BS + 0.004;
      const panel = (y0, y1, mat) => add(new THREE.BoxGeometry(0.012, y1 - y0, 0.64), mat, X(fx), (y0 + y1) / 2, 0);
      const yBeam = FLOOR - BS;
      panel(yBeam, 0.33, std(0x2c2f34, { roughness: 0.6 }));
      panel(0.33, 0.40, red);
      panel(0.40, 0.46, std(0xa9adb2, { metalness: 0.4, roughness: 0.4 }));
      panel(0.46, 0.585, orange);
      // lampu depan (putih) + lampu penanda (merah/oranye) + kisi di tengah
      const lampW = std(0xfff6d0, { emissive: 0xffe9a0, emissiveIntensity: 1.2 });
      const lampA = std(0xff3a2a, { emissive: 0xff2010, emissiveIntensity: 0.7 });
      for (const sz of [-1, 1]) {
        yAx(new THREE.CylinderGeometry(0.032, 0.032, 0.014, 18), lampW, X(fx + 0.008), 0.43, sz * 0.25);
        yAx(new THREE.CylinderGeometry(0.026, 0.026, 0.014, 18), lampA, X(fx + 0.008), 0.43, sz * 0.17);
      }
      add(new THREE.BoxGeometry(0.014, 0.045, 0.2), std(0x4a4f56, { roughness: 0.6 }), X(fx + 0.006), 0.43, 0);
      for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(0.018, 0.006, 0.19), std(0x1d2024), X(fx + 0.008), 0.415 + k * 0.015, 0);
      // buffer bulat hitam dengan cincin abu-abu
      for (const sz of [-1, 1]) {
        yAx(new THREE.CylinderGeometry(0.056, 0.056, 0.012, 22), std(0xb4b7bb), X(fx + 0.02), 0.305, sz * 0.25);
        yAx(new THREE.CylinderGeometry(0.047, 0.047, 0.03, 22), std(0x15171a, { roughness: 0.6 }), X(fx + 0.03), 0.305, sz * 0.25);
      }
      // kaca depan miring (+ bingkai gelap)
      const dx = 0.1, dy = 0.2, len = Math.hypot(dx, dy);
      const wc = [F - dx / 2, 0.57 + dy / 2];                       // titik tengah lereng (f, y)
      const nrm = [dy / len, dx / len];                             // normal keluar (f, y)
      const ang = Math.atan2(dy, -dx * sg);
      const slope = (d, l, w, mat) => add(new THREE.BoxGeometry(l, 0.012, w), mat,
        X(wc[0] + nrm[0] * d), wc[1] + nrm[1] * d, 0, [0, 0, ang]);
      slope(BS + 0.003, len + 0.01, 0.62, std(0x1d2126, { roughness: 0.5 }));
      slope(BS + 0.012, len - 0.03, 0.55, glass);
    } else {
      // ---- gerbong Mk4 (RSB): badan merah polos ----
      add(new RoundedBoxGeometry(L, TOP - FLOOR, 0.66, 3, 0.05), red, cx, (TOP + FLOOR) / 2, 0).castShadow = true;
    }
    // tekstur sisi: +z → sumbu u searah +x dunia (= sg·f), −z (bidang diputar 180°) → kebalikannya
    decal(sideTexture(sideKind, sg), sideTexture(sideKind, -sg), (-L / 2 + f1) / 2, f1 + L / 2, (TOP + FLOOR) / 2, TOP - FLOOR);

    // peredam sambungan (bellows) di ujung yang berhadapan dengan gerbong lain: menjorok 0.09, sisa celah 0.02 (tidak bersentuhan)
    for (const sx of (isLoco ? [-1] : isDVT ? [1] : [-1, 1])) {
      add(new THREE.BoxGeometry(0.1, 0.44, 0.5), std(0x23262b, { roughness: 0.9 }), cx + sx * (L / 2 + 0.04), 0.54, 0);
    }
  }

  /* ---------------- ATAP ---------------- */
  if (kind === 'roof') {
    const roofMat = std(nose ? IC.roofLoco : IC.roofCoach, { roughness: 0.4 });
    const grey = std(0x8d949c, { roughness: 0.55 });
    if (nose) {
      // kubah dari belakang sampai di atas kabin
      const len = (F - 0.22) + L / 2;
      const m = new THREE.Mesh(domeGeo(len, 0.325, TOP + BS - 0.01, TOP + 0.1, 0.02), roofMat);
      m.position.x = X((F - 0.22 - L / 2) / 2);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    } else {
      const m = new THREE.Mesh(domeGeo(L, 0.325, TOP - 0.01, TOP + 0.1), roofMat);
      m.position.x = cx; m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      // unit AC / ventilasi di atap
      for (const dx of [-0.3, 0.3]) add(new RoundedBoxGeometry(0.32, 0.035, 0.24, 2, 0.012), grey, cx + dx, TOP + 0.105, 0);
    }
    if (isLoco) {
      // pantograf lengan tunggal: dudukan isolator, lengan bawah & atas, kepala kolektor
      const metal = std(0x3a3d42, { metalness: 0.5, roughness: 0.45 });
      const head = std(0xc9ccd0, { metalness: 0.6, roughness: 0.3 });
      const cream = std(0xe9dcc0, { roughness: 0.6 });
      const bf = -0.42, by = TOP + 0.11;
      const base = [cx + bf, by + 0.03], knee = [cx + bf - 0.2, by + 0.28], top = [cx + bf + 0.01, by + 0.5];
      for (const z of [-0.08, 0.08]) {
        for (const f of [-0.08, 0.08]) add(new THREE.CylinderGeometry(0.02, 0.026, 0.06, 12), cream, cx + bf + f, by - 0.005, z);
        add(new THREE.BoxGeometry(0.24, 0.025, 0.035), metal, cx + bf, by + 0.03, z);
        bar(base, knee, 0.026, metal, z);
        bar(knee, top, 0.022, metal, z);
      }
      add(new THREE.BoxGeometry(0.07, 0.022, 0.4), head, top[0], top[1] + 0.012, 0);   // kepala kolektor
      add(new THREE.BoxGeometry(0.02, 0.03, 0.4), metal, top[0] - 0.03, top[1] + 0.008, 0);
      // peralatan atap
      add(new RoundedBoxGeometry(0.3, 0.04, 0.26, 2, 0.015), grey, cx + 0.12, TOP + 0.105, 0);
      yAx(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 14), grey, cx - 0.1, TOP + 0.13, 0.15);
    }
  }
  // Tulisan terukir langsung di badan kereta (tanpa plat tambahan): atap → di puncak kubah; badan → di area sisi yang polos;
  // roda → di sisi kotak peralatan di antara dua bogie. Ukuran blok teks (w) menyesuaikan permukaan; kamera 'engrave' menyesuaikan jaraknya.
  if (cfg) {
    let w = 0.22, tilt = 0;
    const spot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), null);   // diganti di bawah setelah ukuran diketahui
    let px = 0, py = 0, pz = 0;
    if (kind === 'roof') {
      // puncak kubah (di luar unit AC / pantograf). Kubah loko / DVT punya bevel ±0.012 → puncaknya lebih tinggi daripada kubah gerbong
      [px, py, pz] = [X(isLoco ? 0.5 : isDVT ? 0.1 : 0), (nose ? TOP + 0.112 : TOP + 0.1) + 0.004, 0];
      spot.rotation.x = -Math.PI / 2;                                                 // menghadap ke atas
      tilt = 0.12;                                                                    // kamera sedikit miring ke arah kartu (tidak menembus bibir tutup)
    } else if (kind === 'body') {
      const [f, y] = isLoco ? [0.335, 0.4735] : isDVT ? [0.55, 0.55] : [0, 0.45];     // area merah polos di sisi (di luar jendela / pintu / logo)
      [px, py, pz] = [X(f), y, 0.3425];                                               // tepat di atas stiker sisi (z 0.3375)
    } else {
      // roda: di bidang ATAS lantai rangka (rata & luas; sisi samping terlalu sempit sehingga tulisan tak terbaca)
      [px, py, pz] = [cx, 0.29 + 0.004, 0];                                           // permukaan atas lantai rangka (y 0.29)
      spot.rotation.x = -Math.PI / 2;                                                 // menghadap ke atas
      tilt = 0.12;                                                                    // kamera sedikit miring ke arah kartu
    }
    spot.geometry.dispose();
    spot.geometry = new THREE.PlaneGeometry(w, w / ENGRAVE_ASPECT);
    // cat merah badan yang terang → huruf gelap; atap & baja gelap → huruf terang
    spot.material = engraveMaterial(cfg, kind === 'body' ? 'dark' : 'light');
    spot.position.set(px, py, pz);
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
