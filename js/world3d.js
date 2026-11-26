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
  const wheels = [0, 1, 2, 3].map((i) => {
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
    // panah atas / bawah
    for (const dir of [1, -1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.07, 3), M.brass);
      cone.position.set(0, dir * 0.255, -0.03);
      if (dir < 0) cone.rotation.z = Math.PI;
      cone.userData = { wheel: i, dir };
      lock.add(cone);
      cone.position.x = g.position.x;
      cone.position.z = 0.12;
      lockTargets.push(cone);
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
  // Pegangan di atas tutup
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 10, 28, Math.PI), M.leatherDark);
  handle.position.set(0, HL, D - 0.5);
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

  const tileTargets = [];
  const parts = CONFIG.parts.map((cfg, i) => {
    const model = buildPartModel(cfg.id);
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
    gm.traverse((o) => {
      if (o.isMesh) {
        o.material = M.ghost;
        o.castShadow = false;
        o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 35), M.ghostEdge));
      }
    });
    ghost.add(gm);
    train.add(ghost);

    // Tile di dalam tutup (grid 3x3)
    const col = colFor(cfg.id), row = rowFor(cfg.id);
    const tile = new THREE.Group();
    tile.position.set((col - 1) * 1.55, (1 - row) * 1.02, 0);
    lidInner.add(tile);
    const tileMat = new THREE.MeshStandardMaterial({ color: 0xefe4cc, roughness: 0.9, emissive: 0xffc46b, emissiveIntensity: 0 });
    const card = at(box(1.46, 0.94, 0.04, tileMat, 0.03), 0, 0, 0.02);
    tile.add(card);
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.28),
      new THREE.MeshStandardMaterial({ map: plaqueTexture(cfg), roughness: 0.8 }));
    plaque.position.set(0, -0.29, 0.045);
    tile.add(plaque);

    const s = Math.min(1.25 / size.x, 0.46 / size.y, 0.85);
    obj.scale.setScalar(s);
    obj.position.set(0, 0.13, 0.045 + (size.z * s) / 2);
    tile.add(obj);

    const home = { pos: obj.position.clone(), quat: obj.quaternion.clone(), scale: obj.scale.clone() };
    tile.traverse((o) => { o.userData.part = i; });
    tileTargets.push(tile);

    return { cfg, i, obj, ghost, tile, tileMat, plaque, center, home, placed: false };
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
    let target, dir, w, hgt;
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
      case 'train': target = new THREE.Vector3(0, FLOAT_Y + 0.4, 0); dir = new THREE.Vector3(0, 0.35, 1); w = 5.4; hgt = 2.6; break;
      default: throw new Error('view? ' + v.name);
    }
    const tanHalf = Math.tan((cam.fov / 2) * DEG);
    const portrait = cam.aspect < 0.85;
    const hPad = portrait ? 1.5 : 1.3; // sisakan ruang untuk caption di bawah
    const dist = Math.max((hgt * hPad) / 2 / tanHalf, (w * 1.08) / 2 / (tanHalf * cam.aspect));
    const pos = target.clone().add(dir.normalize().multiplyScalar(dist));
    const look = target.clone().add(tmpV.set(0, -hgt * (portrait ? 0.2 : 0.12), 0));
    return { pos, look };
  }

  let currentView = { name: 'intro' };
  let camTween = null;
  const camPos = new THREE.Vector3();   // pose kamera dalam ruang lokal koper
  const tmpLook = new THREE.Vector3();
  function applyCam() {
    base.updateWorldMatrix(true, false);
    cam.position.copy(camPos);
    base.localToWorld(cam.position);
    base.localToWorld(tmpLook.copy(lookAt));
    cam.lookAt(tmpLook);
  }
  function setView(v) {
    currentView = v;
    const { pos, look } = computeView(v);
    camPos.copy(pos);
    lookAt.copy(look);
    applyCam();
  }
  /** Mulai dari pose kamera dunia tertentu (mis. kamera toko saat koper diketuk) → mulus tanpa lompatan. */
  function setViewFromWorld(pose) {
    base.updateWorldMatrix(true, false);
    camPos.copy(toLocalPos(pose.pos.clone()));
    lookAt.copy(toLocalPos(pose.look.clone()));
    applyCam();
  }
  function flyTo(v, duration = 1.2, ease = 'power2.inOut') {
    currentView = v;
    camTween?.kill();
    const { pos, look } = computeView(v);
    const fp = camPos.clone(), fl = lookAt.clone();
    const p = { t: 0 };
    return new Promise((resolve) => {
      camTween = gsap.to(p, {
        t: 1, duration, ease,
        onUpdate: () => {
          camPos.lerpVectors(fp, pos, p.t);
          lookAt.lerpVectors(fl, look, p.t);
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
    gsap.killTweensOf([lidPivot.rotation, trainRoot.position, train.rotation,
      ...latches.map((l) => l.rotation), ...wheels.map((w) => w.group.rotation),
      ...parts.map((p) => p.obj.position)]);
    placeTween?.kill(); placeTween = null;
    camTween?.kill(); camTween = null;
    lidPivot.rotation.x = 0;
    latches.forEach((l) => { l.rotation.x = 0; l.position.z = D / 2 + 0.01; });
    wheels.forEach((w) => { w.idx = 0; w.group.rotation.x = 0; });
    trainRoot.position.set(0, MOULD_Y, 0);
    train.rotation.set(0, 0, 0);
    parts.forEach((p) => {
      p.tile.add(p.obj);
      p.obj.position.copy(p.home.pos);
      p.obj.quaternion.copy(p.home.quat);
      p.obj.scale.copy(p.home.scale);
      p.ghost.visible = true;
      p.placed = false;
      p.tileMat.color.set(0xefe4cc);
      p.tileMat.emissiveIntensity = 0;
    });
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
  // from: 'start' = alur normal (scene 7 → 8) | 'note' = langsung ke scene 8 (kamera sudah di plakat; dipakai debug)
  async function openPart(i, from = 'start') {
    const p = parts[i];
    state = 'busy';
    ui.counter(null);
    if (from === 'start') {
      ui.setStage(7);
      ui.flash(1.0);
      await flyTo({ name: 'part1', index: i }, 1.1, 'power2.inOut');
      await wait(0.45);
      await flyTo({ name: 'part2', index: i }, 0.9, 'power2.inOut');
    }
    ui.setStage(8);
    await ui.openNote(p.cfg);
    ui.flash(0.6);
    await flyTo({ name: 'open' }, 1.0, 'power2.inOut');
    await placePart(p);
  }

  function placeInstant(p) {
    train.add(p.obj);
    p.obj.position.copy(p.center);
    p.obj.quaternion.identity();
    p.obj.scale.setScalar(1);
    p.ghost.visible = false;
    p.placed = true;
    p.tileMat.color.set(0x9c8f78);
    placedCount++;
  }

  let placeTween = null;
  function placePart(p) {
    return new Promise((resolve) => {
      train.attach(p.obj);
      const a = p.obj.position.clone();
      const b = p.center.clone();
      const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 1.4, 0.6));
      const qa = p.obj.quaternion.clone(), qb = new THREE.Quaternion();
      const sa = p.obj.scale.x;
      const t = { v: 0 };
      p.tileMat.color.set(0x9c8f78);
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
          gsap.fromTo(p.obj.position, { y: b.y + 0.08 }, { y: b.y, duration: 0.35, ease: 'bounce.out' });
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
    gsap.to(trainRoot.position, { y: FLOAT_Y, z: 0.6, duration: 1.8, ease: 'power2.inOut', onComplete: () => { floating = true; } });
    await flyTo({ name: 'train' }, 1.9);
    state = 'train';
    ui.setStage(9);
    ui.hint('⟲ drag untuk memutar kereta');
  }

  async function closeCase() {
    state = 'busy';
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
    if (state === 'lock') hover = !!pick(e, lockTargets);
    else if (state === 'parts') {
      const hit = pick(e, tileTargets);
      if (hit && !parts[hit.object.userData.part].placed) { hover = true; hoverTile = hit.object.userData.part; }
    } else if (state === 'train') canvas.style.cursor = 'grab';
    if (state !== 'train') canvas.style.cursor = hover ? 'pointer' : 'default';
  }
  function onUp(e) {
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

  let hoverTile = null;
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => { down = null; });

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
      const pulse = 0.12 + Math.sin(t * 3) * 0.08;
      parts.forEach((p) => { if (!p.placed) p.tileMat.emissiveIntensity = p.i === hoverTile ? 0.45 : pulse; });
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
    } else {                              // n === 8: plakat + catatan bagian pertama
      setView({ name: 'part2', index: 0 });
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
   MODEL BAGIAN KERETA (placeholder primitif)
   Koordinat kereta: x = panjang (lokomotif di +x), y = atas.
   Ganti isi fungsi ini dengan model GLB bila sudah ada.
============================================================ */
const CARS = { loco: 1.3, car1: -0.15, car2: -1.6 };
const L = 1.35;

function colFor(id) { return id.startsWith('loco') ? 2 : id.startsWith('car1') ? 1 : 0; }
function rowFor(id) { return id.endsWith('roof') ? 0 : id.endsWith('body') ? 1 : 2; }

function buildPartModel(id) {
  const [car, kind] = id.split('-');
  const cx = CARS[car];
  const isLoco = car === 'loco';
  const g = new THREE.Group();
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
  const add = (geo, mat, x, y, z, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };

  if (kind === 'wheels') {
    const dark = std(0x2d2f33, { metalness: 0.6, roughness: 0.4 });
    const steel = std(0x8a8f96, { metalness: 0.8, roughness: 0.3 });
    add(new RoundedBoxGeometry(L - 0.1, 0.1, 0.56, 2, 0.03), dark, cx, 0.24, 0);
    for (const sx of [-0.4, 0.4]) {
      add(new THREE.BoxGeometry(0.42, 0.08, 0.5), dark, cx + sx, 0.15, 0);
      for (const sz of [-0.28, 0.28]) {
        add(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 20), steel, cx + sx - 0.12, 0.12, sz, [Math.PI / 2, 0, 0]);
        add(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 20), steel, cx + sx + 0.12, 0.12, sz, [Math.PI / 2, 0, 0]);
      }
    }
    add(new THREE.BoxGeometry(0.12, 0.06, 0.08), dark, cx - L / 2 - 0.02, 0.24, 0);
  }

  if (kind === 'body') {
    const bodyCol = isLoco ? 0xd9442b : 0xf1e6cf;
    const stripe = isLoco ? 0xf6f0e2 : 0x1f4e8f;
    const glass = std(0x1d2a33, { metalness: 0.3, roughness: 0.15 });
    add(new RoundedBoxGeometry(L, 0.48, 0.66, 3, 0.05), std(bodyCol), cx, 0.53, 0);
    add(new THREE.BoxGeometry(L + 0.01, 0.06, 0.67), std(stripe), cx, 0.41, 0);
    if (isLoco) {
      add(new RoundedBoxGeometry(0.34, 0.4, 0.62, 3, 0.1), std(bodyCol), cx + L / 2 + 0.1, 0.49, 0);
      add(new THREE.BoxGeometry(0.06, 0.16, 0.5), glass, cx + L / 2 + 0.25, 0.6, 0);
      add(new THREE.SphereGeometry(0.05, 12, 12), std(0xfff3b0, { emissive: 0xffe066, emissiveIntensity: 1.2 }), cx + L / 2 + 0.27, 0.4, 0);
      add(new THREE.BoxGeometry(0.3, 0.16, 0.68), glass, cx + 0.35, 0.62, 0);
    } else {
      for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.2, 0.15, 0.68), glass, cx - 0.45 + k * 0.3, 0.62, 0);
    }
  }

  if (kind === 'roof') {
    const roofCol = isLoco ? 0x8a2a1c : 0x9aa3ab;
    const roof = add(new THREE.CylinderGeometry(0.34, 0.34, L, 24, 1, false, 0, Math.PI), std(roofCol, { side: THREE.DoubleSide }), cx, 0.77, 0, [0, 0, Math.PI / 2]);
    roof.scale.set(0.38, 1, 1);
    if (isLoco) {
      const metal = std(0x3a3d42, { metalness: 0.7 });
      add(new THREE.BoxGeometry(0.4, 0.04, 0.04), metal, cx - 0.1, 0.96, 0, [0, 0, 0.5]);
      add(new THREE.BoxGeometry(0.4, 0.04, 0.04), metal, cx + 0.2, 0.96, 0, [0, 0, -0.5]);
      add(new THREE.BoxGeometry(0.5, 0.03, 0.3), metal, cx + 0.05, 1.04, 0);
    } else {
      add(new RoundedBoxGeometry(0.35, 0.08, 0.3, 2, 0.02), std(0xc9ced3), cx - 0.3, 0.9, 0);
      add(new RoundedBoxGeometry(0.35, 0.08, 0.3, 2, 0.02), std(0xc9ced3), cx + 0.3, 0.9, 0);
    }
  }
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
