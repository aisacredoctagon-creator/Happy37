// ============================================================
//  GASING 3D  ("Saucer Sprout")
//  Dipindahkan dari saucer-sprout.html (three r128 → r160),
//  versi terbaru: + sarung tangan melayang, warna bawah lebih cokelat.
//  Dipakai di semua scene 2D menggantikan gasing.png.
//
//  const g = createGasing3D({ label, className, yaw, bag });
//  parent.append(g);   // g.hop() → gasing meloncat (tas ikut terayun)
//                      // g.wobble() → senggol tas saja
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
import { sfx } from './audio.js';

/* ------------------------------------------------------------
   PROPORSI & UKURAN (acuan: foto referensi). Ubah di sini saja — semua turunan dihitung dari konstanta ini.
------------------------------------------------------------ */
const MASCOT_SCALE = 1.15;                        // ukuran keseluruhan maskot di dalam kotak elemennya (1 = ukuran lama); kaki tetap di tanah
const STEM_EXTRA = 0.3;                           // tangkai/kaki diperpanjang → badan (piringan, kubah, wajah) naik sebanyak ini (satuan model)
const HAND_REST = { x: 2.75, y: -0.45, z: 0.1 };  // pusat kepalan istirahat (kanan; kiri = cermin) → manset tepat di bawah piringan, sama tinggi kiri-kanan
const HAND_REACH_MAX = 3.9;                       // jarak maks pusat tangan dari pusat badan (gestur besar ditarik mendekat, batas lunak)
const HAND_REACH_SOFT = 0.5;                      // lebar zona lunak sebelum batas jangkauan
const SCREEN_LEVEL = 1;                           // 1 = tangan kiri dikoreksi supaya sejajar dengan tangan kanan DI LAYAR (kompensasi sudut kamera), 0 = sejajar di dunia 3D
const SCREEN_LEVEL_MAX = 0.6;                     // batas koreksi tinggi (satuan model)
// Kanvas: lebar minimum (setengah, satuan model) yang harus terlihat di kiri-kanan badan supaya tangan terjauh + jari tidak terpotong.
// Lebar kanvas (SPAN) dihitung dari sini setiap resize, jadi tetap cukup walau MASCOT_SCALE / ukuran elemen berubah.
const CANVAS_HALF_W = 6.0;
// Kejelasan gestur: satu gestur per scene, tempo lebih lambat, jeda jelas sebelum gestur (dipakai juga oleh scene)
export const GESTURE_TIMING = {
  tempo: 1.35,                                    // > 1 = gestur diputar lebih lambat (durasi × tempo), termasuk tahan di puncak
  lead: 0.6,                                      // detik jeda sebelum gestur scene dimulai (setelah momen pemicunya)
  fidget: [6, 10],                                // detik jeda antar-fidget idle (lebih jarang supaya tidak bersaing dengan gestur utama)
};
const POINT_SIDE_SIN = 0.3;                       // gestur menunjuk pindah ke tangan kiri (menunjuk ke kiri layar) bila badan menghadap kiri lebih dari ini (sin arah hadap)
const POINT_X = 3.0;                              // seberapa jauh tangan menunjuk dari badan (x, satuan model; istirahat = 2.75). Kecil = lebih dekat badan
// Framing (satuan model): tinggi/lebar pandang dibagi MASCOT_SCALE, tepi bawah pandang (tanah) tetap
const VIEW_BOTTOM = 0.55 - 5.5 / 2;
const FIT_W = 5.3 / MASCOT_SCALE, FIT_H = 5.5 / MASCOT_SCALE, TARGET_Y = VIEW_BOTTOM + FIT_H / 2;
const BAG_S = 0.75;                             // skala model tas relatif ke Gasing
const BAG_FLOOR_Y = -2.09 + 2.625;              // tinggi titik genggam saat tas diletakkan di tanah (dasar tas = (BH + HANDLE_H) × BAG_S di bawahnya)
// Titik genggam tali tas (terowongan kepalan tangan kiri) saat menjinjing, pose istirahat. DIUKUR dari rig tangan
// (ganti bila GS / TUN / ARM / CARRY_R / Q_HANG berubah): dipakai bagMouthOffset(); saat berjalan titiknya diambil langsung dari tangan.
const BAG_HOLD = { x: -1.0, y: 1.75 };           // titik gantung tas di punggung pada yaw awal (dipakai bagMouthOffset() statis / cadangan 2D)
// Tas tenis di PUNGGUNG (melayang, tidak menyentuh badan maupun tangan); diletakkan di lantai saat makan soto
const BAG_BACK = { dist: 2.65, y: 1.75 };          // titik gantung (puncak tali): jarak di belakang sumbu badan (searah punggung) & tinggi; muka tas ±0.3 dari badan
const BAG_FLOOR_POS = { x: -3.3, z: -1.2 };       // posisi tas di lantai saat makan, relatif badan (x + = kanan badan, z + = depan badan)
export const BAG_DOWN_T = 0.9; const BAG_UP_T = 0.9;           // detik transisi tas punggung → lantai dan lantai → punggung
const BAG_ARC = 0.35;                             // tas sedikit terangkat (busur) di tengah transisi
const BAG_FOLLOW = 9;                             // 1/s: seberapa cepat tas menyusul posisi & arah hadap badan (lag halus, tanpa overshoot)
const BAG_LAG_MAX = 0.45;                         // rad: tas boleh tertinggal paling jauh segini dari arah punggung (saat belok) → tidak pernah masuk ke area tangan
const BAG_HAND_SEP = 0.9;                         // rad: jarak sudut minimum (di sekeliling badan) antara tas dan tangan yang mendekat → tas menghindar, tidak tersentuh
const BAG_YAW = 0.3;
const BAG_SIDE_SEP_K = 0.5;                       // pengali BAG_HAND_SEP untuk tas dengan bagSide ≥ 0.5 rad (scene 1 & 2); di antara 0 dan 0.5 rad dicampur linear
const BAG_SIDE_RATE = 5;                          // 1/s: laju bagSide menyusul nilai baru (setBagSide) — ±0,5 dtk untuk 1,1 rad → 0
/* ------------------------------------------------------------
   TANGAN — desain sarung tangan (sumber kebenaran: preview/hand-preview-src.js)
   Kerangka lokal tangan: +Y ke arah jari, +X sisi jempol, +Z punggung tangan, jari menekuk ke −Z.
   Tangan kanan = referensi; tangan kiri = cermin (parent scale.x = −1, quaternion di-reflect). Semua gerak ditulis
   dalam "kerangka kanan" (RF): x > 0 = menjauh dari badan; tangan kiri otomatis dipantulkan.
------------------------------------------------------------ */
const GS = 0.85;                                  // skala sarung tangan (lebih kecil, ≈ 1/5 lebar piringan seperti referensi)
const HAND_INK = 0.03 / GS;                       // lebar tinta lokal → 0.03 di satuan dunia = sama tipis dengan tubuh maskot
const FINGER = [  // telunjuk, tengah, manis — tiap jari 3 ruas (pangkal, tengah, ujung)
  { x: 0.30, y: 0.38, z: 0.00, L: [0.21, 0.17, 0.15], R: [0.158, 0.150, 0.140] },
  { x: 0.00, y: 0.41, z: 0.00, L: [0.24, 0.19, 0.16], R: [0.163, 0.155, 0.145] },
  { x: -0.30, y: 0.37, z: 0.00, L: [0.21, 0.17, 0.14], R: [0.153, 0.145, 0.135] },
];
const THUMB = { x: 0.30, y: 0.02, z: -0.26, L: [0.22, 0.20, 0.17], R: [0.170, 0.158, 0.140] };   // metakarpal (tersembunyi) + 2 kapsul
const TUN = [0.05, 0.14, -0.28];                  // terowongan genggaman (lokal tangan): sendok / tali tas lewat sini
const SPOON_HEAD_L = [1.35, 0.14, -0.28];         // kepala sendok relatif ke tangan (lokal)
// pose jari (c1/c2/c3 = tekukan pangkal/tengah/ujung, rad, + = ke telapak; td = ARAH tiap ruas jempol di kerangka tangan)
const TD_FIST = [[0.15, 0.38, -0.91], [-0.97, 0.20, -0.10], [-0.62, -0.78, 0.05]];
const TD_CUP = [[0.55, 0.55, -0.35], [0.20, 0.85, -0.45], [-0.10, 0.90, -0.40]];
const P_FIST = { c1: [1.30, 1.38, 1.42], c2: [1.60, 1.68, 1.72], c3: [1.10, 1.15, 1.15], spread: 0 };
const P_OPEN = { c1: [-0.05, -0.04, -0.06], c2: [0.05, 0.04, 0.06], c3: [0.04, 0.03, 0.05], spread: 1, thumb: [-0.85, 0.08, 0.1] };   // thumb = Euler [abd, flex1, flex2]
const P_GRIP = { c1: [1.00, 1.05, 1.10], c2: [1.30, 1.35, 1.40], c3: [0.90, 0.95, 1.00], spread: 0 };            // genggam sendok (jempol = TD_FIST)
// pose cadangan tangan mangkuk di applyPose (praktis tak terpakai: jari tangan mangkuk saat makan = hasil bake bakeBowlGrip, dicampur lewat blendBowlGrip)
const P_CUP = { c1: [1.15, 1.20, 1.25], c2: [0.55, 0.60, 0.65], c3: [0.35, 0.40, 0.45], spread: 0.15 };         // menopang mangkuk (jempol = TD_CUP)

// Posisi & bahu (kerangka kanan). Istirahat: tangan menggantung di sisi badan setinggi bibir piring, pusat ≈ (3.1, −0.2, 0.1).
const ARM = 3.0, SH = { x: HAND_REST.x, y: HAND_REST.y + ARM, z: HAND_REST.z };   // bahu virtual & panjang lengan (tangan melayang, tanpa lengan)
const CARRY_R = 1.72;                             // radius istirahat tangan pembawa tas: diangkat supaya dasar tas tidak tembus lantai
const WALK_AMP = 0.55;                            // ayunan jalan ±rad di sekitar bahu (z ≈ ±1.6)
const WALK_W = 7.85;                              // rad/s — seirama loncatan kecil ±0.8 detik
const NCH = 24;                                   // jumlah kanal pegas per tangan
// kanal: 0 fw (maju), 1 lat (naik/keluar), 2 r (jari-jari), 3-5 wx/wy/wz (pergelangan), 6 ox, 18 oy, 17 oz (offset orientasi dunia),
//        19 oq (campur ke pose orientasi), 7 spread, 8..11 closure jempol/telunjuk/tengah/manis, 13..16 closure ruas ujung, 12 squash
const CH = { fw: 0, lat: 1, r: 2, wx: 3, wy: 4, wz: 5, ox: 6, spread: 7, sq: 12, oz: 17, oy: 18, oq: 19 };
const C_CLOSE = 8, C_TIP = 13, C_MID = 20;       // closure ruas pangkal / ujung / tengah (20..23)
const OMEGA = [15, 15, 15, 17, 17, 17, 14, 11, 11.5, 11.5, 11.5, 11.5, 20, 9.5, 9.5, 9.5, 9.5, 14, 14, 12, 10.5, 10.5, 10.5, 10.5];   // frekuensi alami (rad/s): lengan → pergelangan → pangkal → tengah → ujung jari
const ZETA = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.55, 0.5, 0.5, 0.5, 0.5, 0.5, 0.45, 0.42, 0.42, 0.42, 0.42, 0.55, 0.55, 0.6, 0.46, 0.46, 0.46, 0.46];   // redaman (<1 = overshoot)
// Sendi jari: batas tekuk per ruas (rad, + = ke telapak). Dipakai sebagai batas LUNAK (mendekati batas dengan halus, tanpa
// hiperekstensi saat pegas overshoot). Semua pose yang ada (kepalan, terbuka, sendok, mangkuk) berada di dalam batas ini.
const JOINT_LIM = { c1: [-0.12, 1.55], c2: [0, 1.85], c3: [0, 1.35], spread: [-0.4, 1.6] };
const JOINT_SOFT = 0.08;                          // lebar zona lunak di dekat batas (rad)
const MID_LAG = 0.015, TIP_LAG = 0.03;            // detik: ruas tengah & ujung menyusul pangkal pada gestur (gerak mengalir bertahap)
// Gerak sekunder: tangan melayang mengikuti badan lewat pegas (semi-implicit, substep), sedikit tertinggal lalu overshoot halus.
const FOLLOW_OMEGA = 16;                          // rad/s: makin besar makin cepat menyusul badan
const FOLLOW_ZETA = 0.72;                         // < 1 = overshoot halus, 1 = kritis (tanpa overshoot)
const FOLLOW_MAX = 0.35;                          // jarak maks tangan tertinggal dari badan (satuan model) — tidak bisa "lepas"
// Transisi antar state (idle/walk/eat) & kesiapan mangkuk: redaman kritis (mulai & berhenti halus, tanpa letupan/overshoot)
// Arah hadap saat bergerak (lihat el.move): badan berputar ke arah kecepatan lewat jalur sudut terpendek
const TURN_RATE = 9;                              // rad/s laju mendekati arah target (makin besar makin cepat menoleh)
const TURN_MAX_SPEED = 7;                         // rad/s batas kecepatan putar (belok tajam / putar balik tetap halus)
const MOVE_MIN_SPEED = 0.3;                       // satuan dunia/s: di bawah ini dianggap diam → arah terakhir dipertahankan (tanpa jitter)
const MOVE_TIMEOUT = 0.2;                         // detik: tanpa laporan kecepatan selama ini = berhenti
const WALK_REF_SPEED = 2.2;                       // satuan dunia/s: kecepatan jalan "normal" (amplitudo ayunan × 1)
const SWING_SPEED_K = [0.6, 1.3];                 // batas pengali amplitudo ayunan tangan dari kecepatan
const STATE_OMEGA = 13;                           // rad/s (≈ 0.18 s menuju 63%)
const Z_GRIP = 0.88;                              // ζ lengan saat memegang tas/mangkuk/sendok
const FDELAY = [0.09, 0.02, 0.04, 0.06];          // tunda tiap jari pada gestur: jempol, telunjuk, tengah, manis (jempol paling akhir)
const REST_K = [[1, 0.97, 1, 0.95], [1, 1, 0.96, 0.98]];   // kepalan istirahat kiri/kanan (tidak simetris, tidak pernah rapat sempurna)
const G_BOTH_LAG = 0.09;                          // tangan kiri tertinggal sekian detik pada gestur 'both'
const G_LOCK_MOT = 0.03, G_LOCK_FIN = 0.3;        // tangan kiri yang memegang tas: gestur hanya micro-adjust
const BODY_R = { loX: 2.35, loZ: 2.1, hiX: 1.75, hiZ: 1.6 };   // elips badan (bibir bawah → kubah) tempat tangan tidak boleh masuk
const LIM = { fw: [-1.2, 1.6], lat: [-0.9, 3.4], r: [0.9, 5.0], w: 1.2, wLock: 0.15 };

// Makan (kerangka dunia-badan, satuan model). Koreografi T = 2.6 s: menyendok 0–.18, mengangkat .18–.55, di mulut .55–.68, kembali .68–1.
export const EAT_T = 2.6;
const BOWL_S = 1.3;                               // skala mangkuk
// Pembagian tangan saat makan soto. BOWL_SIDE = sisi LAYAR tangan pemegang mangkuk: +1 = kanan layar (= tangan KIRI Gasing, Gasing menghadap kamera),
// −1 = kiri layar. Tangan lainnya memegang sendok. Koreografi ditulis di kerangka tangan masing-masing (RF; tangan kiri = cermin), jadi cukup ganti ini.
const BOWL_SIDE = 1;
const BOWL_X = 1.0;                               // jarak mangkuk dari sumbu badan (ke sisi BOWL_SIDE)
const BOWL_Z = 3.0;                               // jarak mangkuk ke DEPAN badan. 2.55 sebelumnya membuat mangkuk memotong bibir badan (28 titik tembus) → 3.0 = jarak bebas ≈ 0.24
const BOWL_C = [BOWL_SIDE * BOWL_X, -0.05 + STEM_EXTRA, BOWL_Z];              // pusat bibir mangkuk (dunia-badan)
const BOWL_APPEAR = 0.55;                         // bobot makan eW (0–1) di mana mangkuk mulai muncul; terlalu kecil → mangkuk sempat memotong badan saat tangan menjemput/melepas
// ---- Pegangan mangkuk (tangan BOWL_SIDE). Di-bake sekali saat mount (bakeBowlGrip), lalu statis di ruang lokal tangan (mangkuk = anak tangan).
// Nilai di kerangka tangan pemegang (RF), relatif ke pusat bibir mangkuk, satuan model: +x = ke luar (menjauhi badan), +y = atas, +z = ke kamera.
const GRIP_PALM = { x: -0.1, y: -0.75, z: 0.5 };  // pusat telapak: di bawah dasar mangkuk, sisi depan; x − = ke dalam (kiri layar), telapak boleh sedikit masuk ke dasar (tak terlihat)
const GRIP_AIM = { yaw: 0.55, pitch: 0.15 };       // arah jari (rad): 0 = lurus ke DALAM (= ke kiri layar untuk tangan kanan layar); yaw + = condong ke kamera, pitch + = naik
const GRIP_CURL = [1.25, 1.35, 1.05];              // tekukan maks pangkal/tengah/ujung jari (rad, di dalam JOINT_LIM); jari menutup bersama sampai menyentuh dinding luar
const GRIP_GAP = 0.03;                             // celah permukaan jari/ibu jari ↔ dinding luar mangkuk (> 0 → tidak pernah menembus)
// Jempol tangan mangkuk saat makan soto = POSE LAYAR tetap (bukan fisika): digambar DI ATAS mangkuk (tanpa depth test) supaya tumpang-tindih
// dengan geometri mangkuk tidak terlihat. Kerangka kamera depan: x = kanan layar, y = atas, z = ke kamera (satuan model).
//   x, y, z   : geser pangkal jempol dari posisi bawaannya
//   rot       : arah ruas pangkal di bidang layar (derajat; 0 = ke kanan, 90 = ke atas, 180 = ke kiri)
//   bend1/2   : tekukan sendi tengah / ujung (derajat, + = berlawanan jarum jam → ujung menghadap ke KIRI)
//   tilt      : condong ruas ke arah kamera (derajat)
// Bisa disetel langsung lewat slider "👍 jempol soto" di panel debug (?debug), lalu salin nilainya ke sini.
export const THUMB_SOTO = { x: 0.11, y: -0.06, z: -0.02, rot: 190, bend1: -40, bend2: -40, tilt: 23 };
const THUMB_OVERLAY_BASE = false;                  // false = ruas pangkal jempol TIDAK di-overlay (masuk/menyatu ke telapak); true = seluruh jempol di atas mangkuk
const THUMB_OVERLAY_RO = 10;                       // renderOrder garis tepi jempol (isi = +1): digambar paling akhir, di atas mangkuk
const BOWL_EAT_K = 0.85;                           // skala mangkuk soto relatif ukuran asli (BOWL_S). Pose jari dihitung pada ukuran asli; tangan digeser supaya jari tetap menempel
const GRIP_PALM_DROP_MAX = 0.4;                    // telapak turun otomatis maks sejauh ini bila jari belum muat di bawah mangkuk
const EAT_D0 = [-0.85, -0.38, -0.40], EAT_D1 = [-0.72, 0.30, -0.62];   // arah sendok: menyendok / di mulut
const BOWL_DIP = [0.12, -0.14, 0.05];

const FLAT = [0, 0, 0, 0];
const OPENC = [-1, -1, -1, -1];                   // closure relatif terhadap kepalan (1) → telapak terbuka
const POINTC = [0, -1, 0, 0];                     // telunjuk lurus, lainnya tetap menggenggam
const PRESET_NAMES = ['hang', 'palm', 'side', 'cheer'];
const END = (t) => ({ t, fw: 0, lat: 0, r: 0, wx: 0, wy: 0, wz: 0, ox: 0, oy: 0, oz: 0, oq: 0, spread: 0, sq: 0, c: FLAT });

/**
 * Katalog gestur (kerangka kanan; tangan kiri dipantulkan otomatis). keys: waypoint TARGET — `p:[x,y,z]` = posisi tangan
 * (diubah ke busur di sekitar bahu), kanal lain mewarisi key sebelumnya; smoothstep antar key, pegas under-damped menambah
 * overshoot & lag. `c` = closure jari relatif kepalan ([jempol, telunjuk, tengah, manis]; −1 = terbuka). `q` = pose orientasi
 * ('palm' telapak ke penonton, 'side' jari ke luar, 'cheer'), dicampur lewat `oq`. osc: osilator meluruh (waggle, jari berkibar).
 * hold: jendela moving-hold. hand: 'right' | 'left' | 'both' | 'any' (fidget). loop: ulang sampai diganti.
 */
// Posisi tujuan tangan per gestur (kerangka kanan: [x menjauh dari badan, y tinggi relatif badan, z ke kamera]; piringan hijau ≈ y 0, tepinya x ≈ 2.3).
// Ubah di sini untuk menyetel jarak/tinggi tiap gestur; tangan kiri otomatis dicerminkan.
const POINT_CASE_TILT = 0.25;                    // rad: telunjuk scene 4 sedikit diangkat ke arah koper (di atas & kanan Gasing)
const MARVEL_NEAR_K = 0.88;                      // scene 2: 'marvelNear' = marvel dengan jarak ke badan × ini (0.88 ≈ 12% lebih dekat); scene 12 tetap pakai 'marvel'
const GP = {
  point: [2.9, 0.35, 0.9],        // scene 1: menunjuk tiket, sejajar piringan
  pointCase: [3.0, 1.0, 1.0],     // scene 4: menunjuk koper
  wave: [2.8, 1.3, 1.0],          // layar awal: sengaja sama dengan marvel (tinggi & kedekatan ke badan) — ubah keduanya bersama
  greet: [2.9, 1.4, 0.8],
  cheer: [3.0, 3.3, 0.4], marvel: [2.8, 1.3, 1.0], ooh: [3.0, 1.6, 0.9], startle: [2.8, 2.4, 0.9], startleReach: [2.4, 0.9, 2.3], yum: [2.8, 1.2, 0.9],
};
const GESTURES = {
  wave: { hand: 'right', q: 'palm', hold: [0.55, 2.0], keys: [
    { t: 0 },
    { t: 0.14, p: [3.2, -0.9, 0.3], c: [0, 0, 0, 0] },                                            // antisipasi: turun sedikit
    { t: 0.55, p: GP.wave, oq: 1, c: OPENC, spread: 0.6 },                                // naik berbusur, telapak ke penonton
    { t: 2.0 },
    END(2.6)],
    osc: [{ c: 'wz', amp: 0.55, hz: 2.7, t0: 0.55, t1: 2.0, decay: 1.2 }, { c: 'lat', amp: 0.05, hz: 2.7, t0: 0.55, t1: 2.0, decay: 1.2 },
      { c: 'curl', amp: 0.3, hz: 2.7, ph: 0.9, t0: 0.55, t1: 2.0, decay: 1.0 }] },
  greet: { hand: 'right', q: 'palm', hold: [0.45, 1.0], keys: [{ t: 0 }, { t: 0.45, p: GP.greet, oq: 1, c: OPENC, spread: 0.3 }, { t: 1.1 }, END(1.5)],
    osc: [{ c: 'wz', amp: 0.4, hz: 2.4, t0: 0.45, t1: 1.1, decay: 1.5 }] },
  wait: { hand: 'right', q: 'palm', loop: true, keys: [
    { t: 0 }, { t: 0.7, p: [2.8, 0.2, 1.2], oq: 0.5, c: [0, -0.4, -0.4, -0.4] }, { t: 1.5, p: [2.9, 0.4, 1.3], oq: 0.6 }, END(2.4)],
    osc: [{ c: 'curl', amp: 0.35, hz: 5 / 2.4, ph: 0.9, t0: 0, t1: 99 }] },
  point: { hand: 'right', q: 'side', screen: true, hold: [0.45, 0.85], keys: [
    { t: 0 }, { t: 0.13, p: [3.2, -0.7, 0.3] },
    { t: 0.45, p: GP.point, oq: 1, c: POINTC, wz: -0.08 },
    { t: 0.85 }, END(1.25)] },
  cheer: { hand: 'both', q: 'cheer', hold: [0.5, 0.95], keys: [
    { t: 0 }, { t: 0.14, p: [3.1, -0.9, 0.5] },
    { t: 0.5, p: GP.cheer, oq: 1, c: OPENC, spread: 1.4, sq: 0.05 },
    { t: 0.95 }, { t: 1.2, p: [3.6, 2.2, 0.5], spread: 0.4 }, END(1.7)] },
  marvel: { hand: 'both', q: 'palm', hold: [0.6, 1.8], keys: [{ t: 0 }, { t: 0.6, p: GP.marvel, oq: 1, wx: -0.3, spread: 0.5, c: OPENC }, { t: 1.8 }, END(2.4)],
    osc: [{ c: 'curl', amp: 0.18, hz: 1.2, ph: 0.8, t0: 0.6, t1: 1.8 }] },
  pointCart: { hand: 'right', q: 'side', screen: true, hold: [0.6, 1.5], keys: [
    { t: 0 }, { t: 0.15, p: [3.2, -0.7, 0.3] },
    { t: 0.6, p: [POINT_X, 1.2, 0.9], oq: 1, c: POINTC, wz: -0.08 },
    { t: 1.5 }, { t: 1.7, p: [POINT_X - 0.3, 0.4, 0.6], c: [0, -0.4, 0, 0] }, END(2.2)] },
  pointShop: { hand: 'right', q: 'side', screen: true, hold: [0.5, 1.1], keys: [
    { t: 0 }, { t: 0.14, p: [3.2, -0.7, 0.3] },
    { t: 0.5, p: [POINT_X, 1.2, 0.9], oq: 1, c: POINTC, wz: -0.08 },
    { t: 1.1 },
    { t: 1.35, p: [POINT_X - 0.2, 1.6, 0.9], wx: 0.6, wz: 0.1, c: [0, -0.5, -0.5, -0.5] },      // memanggil: telapak ke atas
    { t: 2.3 }, END(2.8)],
    osc: [{ c: 'curl', amp: 0.5, hz: 2.6, ph: 0.8, t0: 1.35, t1: 2.3, decay: 0.8 }, { c: 'wz', amp: 0.18, hz: 2.6, t0: 1.35, t1: 2.3 }] },
  yum: { hand: 'both', q: 'palm', keys: [{ t: 0 }, { t: 0.12, p: [3.2, -0.5, 0.4] }, { t: 0.4, p: GP.yum, oq: 1, spread: 0.7, c: OPENC, sq: 0.04 }, { t: 0.62 }, END(1.05)] },
  hmm: { hand: 'right', q: 'palm', hold: [0.7, 1.7], keys: [
    { t: 0 }, { t: 0.7, p: [0.9, 0.4, 2.0], oq: 1, c: POINTC, wz: -0.3 }, { t: 1.8 }, END(2.4)],
    osc: [{ c: 'curl', amp: 0.12, hz: 1.6, ph: 0, t0: 0.9, t1: 1.7 }] },
  pointCase: { hand: 'right', q: 'side', screen: true, hold: [0.55, 1.1], keys: [
    { t: 0 }, { t: 0.14, p: [3.2, -0.7, 0.3] },
    { t: 0.55, p: GP.pointCase, oq: 1, c: POINTC, wz: -0.08, oz: POINT_CASE_TILT }, { t: 1.2 }, END(1.7)] },
  ooh: { hand: 'both', q: 'palm', hold: [0.45, 1.1], keys: [
    { t: 0 }, { t: 0.14, p: [3.2, -0.4, 0.4] },
    { t: 0.45, p: GP.ooh, oq: 1, wx: -0.4, spread: 1, c: OPENC }, { t: 1.2 }, END(1.8)] },
  // startle (scene 11, bola jatuh): kaget (tangan naik) → tangan mengulur ke DEPAN badan ke arah bola (telapak terbuka)
  startle: { hand: 'right', q: 'palm', hold: [0.55, 1.0], keys: [
    { t: 0 }, { t: 0.18, p: GP.startle, oq: 1, wz: -0.4, spread: 1.1, c: OPENC, sq: 0.12 },
    { t: 0.55, p: GP.startleReach, oq: 1, wx: -0.35, spread: 0.9, c: OPENC },
    { t: 1.05 }, { t: 1.3, p: [3.6, 1.2, 0.6], spread: 0.3 }, END(1.8)] },
  wow: { hand: 'right', q: 'palm', hold: [0.55, 1.4], keys: [
    { t: 0 }, { t: 0.55, p: [1.8, 1.5, 2.0], oq: 1, wx: -0.2, spread: 0.6, c: OPENC }, { t: 1.5 }, END(2.1)] },
  // fidget idle (kecil; dipilih acak, tidak berulang berturut-turut)
  flex: { hand: 'any', fid: true, keys: [{ t: 0 }, { t: 0.35, c: [-0.3, -0.5, -0.5, -0.5] }, { t: 0.8 }, END(1.3)] },
  roll: { hand: 'any', fid: true, keys: [{ t: 0 }, { t: 0.5, wx: 0.45, wz: -0.12 }, { t: 1.0, wx: -0.3 }, END(1.6)] },
  nudge: { hand: 'any', fid: true, keys: [{ t: 0 }, { t: 0.45, fw: 0.1, lat: 0.1, r: -0.2, wz: -0.1 }, { t: 0.9 }, END(1.6)] },
  tap: { hand: 'any', fid: true, keys: [{ t: 0 }, { t: 0.3, c: [0, -0.3, -0.3, -0.3] }, { t: 1.0 }, END(1.4)],
    osc: [{ c: 'curl', amp: 0.3, hz: 3, ph: 0.9, t0: 0.3, t1: 1.0 }] },
};

// marvelNear: salinan marvel dengan tangan sedikit lebih dekat ke badan (dipakai scene 2 saja)
GP.marvelNear = [GP.marvel[0] * MARVEL_NEAR_K, GP.marvel[1], GP.marvel[2]];
GESTURES.marvelNear = { ...GESTURES.marvel, keys: GESTURES.marvel.keys.map((k) => (k.p ? { ...k, p: GP.marvelNear } : k)) };

// ---- geometri polar bahu (kerangka kanan): arah = (cos fw · sin lat, −cos fw · cos lat, sin fw). Istirahat = lurus ke bawah.
const polR = { fw: 0, lat: 0, r: 0 }, pos3 = { x: 0, y: 0, z: 0 };
function toPolar(x, y, z, o) {
  const dx = x - SH.x, dy = y - SH.y, dz = z - SH.z;
  o.r = Math.max(1e-4, Math.hypot(dx, dy, dz));
  o.fw = Math.asin(Math.max(-1, Math.min(1, dz / o.r)));
  o.lat = Math.atan2(dx, -dy);
}
function fromPolar(fw, lat, r, o) {
  const cf = Math.cos(fw);
  o.x = SH.x + r * cf * Math.sin(lat);
  o.y = SH.y - r * cf * Math.cos(lat);
  o.z = SH.z + r * Math.sin(fw);
}
(function compileGestures() {
  for (const name in GESTURES) {
    const def = GESTURES[name];
    let prev = new Float32Array(NCH);
    def.k = def.keys.map((o) => {
      const v = Float32Array.from(prev);   // posisi gestur p:[x,y,z] relatif badan: y + STEM_EXTRA (ikut badan yang naik)
      for (const n in o) {
        if (n === 't') continue;
        if (n === 'c') o.c.forEach((x, i) => { v[C_CLOSE + i] = x; v[C_TIP + i] = x; });
        else if (n === 'p') { toPolar(o.p[0], o.p[1] + STEM_EXTRA, o.p[2], polR); v[CH.fw] = polR.fw; v[CH.lat] = polR.lat; v[CH.r] = polR.r - ARM; }
        else v[CH[n]] = o[n];
      }
      if ('fw' in o || 'lat' in o || 'r' in o) { if ('fw' in o) v[CH.fw] = o.fw; if ('lat' in o) v[CH.lat] = o.lat; if ('r' in o) v[CH.r] = o.r; }
      prev = v;
      return { t: o.t, v };
    });
    def.dur = def.k[def.k.length - 1].t;
    def.oscIdx = (def.osc || []).map((o) => (o.c === 'curl' ? -1 : CH[o.c]));
    def.qi = Math.max(0, PRESET_NAMES.indexOf(def.q || 'hang'));
  }
})();
export const GESTURE_NAMES = Object.keys(GESTURES).filter((n) => !GESTURES[n].fid);
const FIDGET_NAMES = Object.keys(GESTURES).filter((n) => GESTURES[n].fid);

const smooth01 = (u) => { u = u < 0 ? 0 : u > 1 ? 1 : u; return u * u * (3 - 2 * u); };
function sampleKeys(k, tt, c) {
  const n = k.length;
  if (tt <= k[0].t) return k[0].v[c];
  if (tt >= k[n - 1].t) return k[n - 1].v[c];
  let i = 1;
  while (k[i].t < tt) i++;
  const a = k[i - 1], b = k[i], u = smooth01((tt - a.t) / (b.t - a.t));
  return a.v[c] + (b.v[c] - a.v[c]) * u;
}
// tangan tidak boleh menembus badan: dorong keluar dari elips (lebar di bibir, menyempit di kubah)
function pushOutOfBody(p) {
  const by = p.y - STEM_EXTRA;                     // ketinggian relatif badan
  if (by < -1.7 || by > 2.5) return;
  const k = smooth01((by - 0.7) / 0.4);
  const rx = BODY_R.loX + (BODY_R.hiX - BODY_R.loX) * k, rz = BODY_R.loZ + (BODY_R.hiZ - BODY_R.loZ) * k;
  const e = (p.x / rx) ** 2 + (p.z / rz) ** 2;
  if (e >= 1) return;
  if (e < 1e-6) { p.z = rz; return; }
  const f = 1 / Math.sqrt(e);
  p.x *= f; p.z *= f;
}
const clampN = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
// jam bersama (bisa dibekukan oleh __gasingDebug untuk mengambil frame deterministik)
const clockMode = { frozen: false, t: 0, offset: 0 };
const nowS = () => (clockMode.frozen ? clockMode.t : performance.now() / 1000 + clockMode.offset);

/**
 * Posisi mulut tas (tempat bola tenis keluar) relatif terhadap kotak elemen Gasing yang membawa tas.
 * Satuan = tinggi elemen: x dari TENGAH elemen (kanan = +), y dari DASAR elemen (atas = +).
 * @param {number} [aspect] lebar/tinggi elemen
 */
export function bagMouthOffset(aspect = 1000 / 1193) {
  const vis = Math.max(FIT_H, FIT_W / aspect);   // tinggi pandang (satuan model) setelah framing
  const x = BAG_HOLD.x - BAG_DIMS.HANDLE_X * BAG_S;
  const y = BAG_HOLD.y - BAG_DIMS.HANDLE_H * BAG_S;
  return { x: x / vis, y: (y - (TARGET_Y - vis / 2)) / vis };
}

let threePromise;
const loadThree = () => (threePromise ??= import('three'));

const instances = new Set();
let raf = 0;

function tick(frameNow) {
  for (const inst of instances) {     // Set aman dimodifikasi (delete) saat diiterasi
    if (!inst.el.isConnected) {
      // belum sempat dipasang (≤ 8 detik) → tunggu; sudah pernah dipasang lalu dilepas → buang
      if (inst.seen || performance.now() - inst.born > 8000) inst.dispose();
      continue;
    }
    inst.seen = true;
    inst.render(frameNow);
  }
}
function loop() {
  raf = 0;
  tick(nowS());        // saat dibekukan (debug) jam tidak maju, tapi kanvas tetap digambar ulang tiap frame
  if (instances.size) raf = requestAnimationFrame(loop);
}
const ensureLoop = () => { if (!raf) raf = requestAnimationFrame(loop); };

/** Semua elemen Gasing 3D yang sedang tampil (dipakai panel debug). */
export const getGasingEls = () => [...instances].filter((i) => i.el.isConnected).map((i) => i.el);

// Alat uji (hanya ?debug): bekukan waktu & maju per langkah tetap supaya frame gestur bisa diambil deterministik.
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
  window.__gasingDebug = {
    freeze(on = true) {
      if (on === clockMode.frozen) return;
      if (on) clockMode.t = nowS();
      else clockMode.offset = clockMode.t - performance.now() / 1000;   // lanjut dari waktu virtual terakhir (tidak mundur)
      clockMode.frozen = on;
    },
    step(seconds = 0.1, dt = 1 / 60) {
      if (!clockMode.frozen) this.freeze(true);
      const n = Math.max(1, Math.round(seconds / dt));
      for (let i = 0; i < n; i++) { clockMode.t += dt; tick(clockMode.t); }
    },
    hands() { return [...instances].filter((i) => i.el.isConnected).map((i) => i.info()); },
    view(az, elv, zoom, tgt) { instances.forEach((i) => i.setView?.(az, elv, zoom, tgt)); },   // kamera uji: depan (0,0), samping (-90,0), belakang (180,0), atas (0,80)
    count: () => instances.size,
    thumbSoto: THUMB_SOTO,                       // pose jempol soto (objek yang sama dengan konstanta; diubah slider panel debug)
  };
}

/**
 * @param {object} [o]
 * @param {string} [o.label]      teks alt / aria-label
 * @param {string} [o.className]  class tambahan (mis. 's1-gasing')
 * @param {number} [o.yaw]        radian; > 0 = badan menghadap sedikit ke kanan layar
 * @param {boolean} [o.bag]       true → menjinjing tas tenis + raket di sarung tangan kiri
 */
export function createGasing3D({ label = 'Karakter Gasing', className = '', yaw = 0, bag = false, bagSide = 0 } = {}) {
  const el = document.createElement('div');
  el.className = `gasing gasing3d ${className}`.trim();
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  // Panggilan sebelum model 3D siap ditahan sebentar (≤ 2 detik) lalu diputar ulang — dulu hop/wobble hilang begitu saja.
  const early = [];            // [nama, args, waktu]
  const sinceEarly = (e) => performance.now() - e[2];
  el.hop = (o) => { early.push(['hop', [o], performance.now()]); if (early.length > 8) early.shift(); };
  el.wobble = () => { early.push(['wobble', [], performance.now()]); if (early.length > 8) early.shift(); };
  el.gesture = (name, o) => {
    const prev = early.findIndex((e) => e[0] === 'gesture');
    if (prev >= 0) { const [old] = early.splice(prev, 1); old[1][1]?.onDone?.({ cancelled: true }); }   // yang terbaru menang
    early.push(['gesture', [name, o], performance.now()]);
  };
  let pendingState = 'idle';   // setState sebelum model 3D siap
  el.setState = (s) => { pendingState = s; };
  el.move = () => {};   // kecepatan sebelum model siap diabaikan (dikirim ulang tiap frame oleh pemanggil)
  let pendingBagSide = null;   // setBagSide sebelum model 3D siap
  el.setBagSide = (v) => { pendingBagSide = v; };

  const showFallback = () => {
    el.classList.add('is-fallback');
    // gambar statis: tidak ada gestur. onDone tetap dipanggil (cancelled) supaya rantai pemanggil tidak menggantung.
    early.forEach((e) => { if (e[0] === 'gesture') Promise.resolve().then(() => e[1][1]?.onDone?.({ cancelled: true, fallback: true })); });
    early.length = 0;
    el.hop = el.wobble = el.setBagSide = () => {};
    el.gesture = (name, o) => { Promise.resolve().then(() => o?.onDone?.({ cancelled: true, fallback: true })); };
    const img = new Image();
    img.src = CONFIG.assets.gasing;
    img.alt = label;
    img.draggable = false;
    el.replaceChildren(img);
    if (bag) el.append(slot({ src: CONFIG.assets.s3_tas, label: 'Tas + raket tenis', className: 'gasing-bag-fallback' }));
  };

  loadThree()
    .then((THREE) => {
      const inst = mount(THREE, el, yaw, bag, bagSide);
      if (!inst) return showFallback();
      el.hop = inst.hop;
      el.wobble = inst.wobble;
      el.setState = inst.setState;
      el.gesture = inst.gesture;
      el.move = inst.move;
      el.setBagSide = inst.setBagSide;
      if (pendingBagSide != null) inst.setBagSide(pendingBagSide);
      el.bagMouthOffset = inst.bagMouth;   // posisi mulut tas AKTUAL (ikut arah hadap); fallback: bagMouthOffset() statis
      if (pendingState !== 'idle') inst.setState(pendingState);
      instances.add(inst);
      early.forEach((e) => { if (sinceEarly(e) < 2000) inst[e[0]](...e[1]); else if (e[0] === 'gesture') e[1][1]?.onDone?.({ cancelled: true }); });
      early.length = 0;
      ensureLoop();
    })
    .catch((err) => { console.warn('Gasing 3D gagal, pakai gambar 2D:', err); showFallback(); });

  return el;
}

/* ------------------------------------------------------------
   Membangun model + renderer untuk satu elemen
------------------------------------------------------------ */
function mount(THREE, el, yaw, withBag = false, bagSide = 0) {
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
  const viewTarget = TARGET.clone(); let viewZoom = 1;
  const viewDir = HOME_DIR.clone();                 // arah kamera; bisa diganti lewat __gasingDebug.view() (hanya ?debug) untuk memeriksa dari sudut lain
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
  body.position.y = STEM_EXTRA;                    // tangkai lebih panjang → badan naik

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
  legPivot.scale.y = (0.83 + STEM_EXTRA) / 0.83;   // tangkai memanjang sampai tanah yang sama
  foot.scale.y = 1 / legPivot.scale.y;            // kaki bulat tidak ikut gepeng
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

  // ---- Mulut: senyum kecil di kubah, di bawah mata; saat makan diganti mulut terbuka (rongga gelap + lidah)
  let mouthA = null, setMouth = () => {};
  {
    const s = surf(0.02, 0.56);
    const anchor = new THREE.Group();
    anchor.position.copy(s.p);
    anchor.quaternion.setFromUnitVectors(new V3(0, 0, 1), s.n);
    const smile = new THREE.Group(); anchor.add(smile);
    const pts = [[-0.24, 0.05, -0.01], [-0.12, -0.02, 0.03], [0.0, -0.045, 0.045], [0.12, -0.02, 0.03], [0.24, 0.05, -0.01]]
      .map((p) => new V3(p[0], p[1], p[2]));
    smile.add(new THREE.Mesh(taperTube(pts, (t) => 0.032 - 0.01 * Math.abs(t - 0.5), 40, 14), browMat));
    const capGeo = new THREE.SphereGeometry(0.027, 12, 10);
    [pts[0], pts[4]].forEach((p) => {
      const c = new THREE.Mesh(capGeo, browMat);
      c.position.copy(p); smile.add(c);
    });
    const mOpen = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshBasicMaterial({ color: col(0x2A1010) }));
    mOpen.position.set(0, -0.03, 0.035); anchor.add(mOpen);
    const mInk = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshBasicMaterial({ color: col(0x121210), side: THREE.BackSide }));
    mInk.scale.setScalar(1.12); mOpen.add(mInk);
    const mTongue = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: col(0xD96A7A) }));
    anchor.add(mTongue);
    mOpen.visible = mTongue.visible = false;
    setMouth = (o) => {   // 0 = senyum tertutup, 1 = terbuka lebar
      smile.visible = o < 0.08; mOpen.visible = o >= 0.08; mTongue.visible = o > 0.35;
      if (o < 0.08) return;
      const w = 0.16 + 0.07 * o, h = 0.012 + 0.2 * o;
      mOpen.scale.set(w, h, 0.05); mOpen.position.y = -0.03 - 0.05 * o;
      mTongue.scale.set(w * 0.62, h * 0.42, 0.03); mTongue.position.set(0, -0.03 - 0.05 * o - h * 0.45, 0.06);
    };
    body.add(anchor);
    mouthA = anchor;
  }

  // ---- Sarung tangan kartun (gaya Mickey) yang melayang, tidak menempel ke badan. Sumber kebenaran: preview/hand-preview-src.js
  // Rig: root (manset, tetap) → wrist (pivot di manset) → hand (telapak elipsoid, 3 jari × 3 ruas, jempol 3 pivot, properti).
  const Q = THREE.Quaternion, E = THREE.Euler, M4 = THREE.Matrix4;
  const qE = (x, y, z, o = 'XYZ') => new Q().setFromEuler(new E(x, y, z, o));
  const basisQ = (x, y, z) => new Q().setFromRotationMatrix(new M4().makeBasis(new V3(...x), new V3(...y), new V3(...z)));
  const mulQ = (...qs) => qs.reduce((a, b) => a.clone().multiply(b));
  const _dx = new V3(), _dz = new V3(), _dm = new M4(), _up0 = new V3(0, 0, 1), _up1 = new V3(1, 0, 0);
  // kuaternion yang +Y-nya searah d (dipakai untuk mengatur jempol lewat ARAH tiap ruas, bukan sudut Euler)
  const dirQInto = (d, out) => {
    const up = Math.abs(d.z) < 0.9 ? _up0 : _up1;
    _dx.crossVectors(d, up).normalize(); _dz.crossVectors(_dx, d);
    return out.setFromRotationMatrix(_dm.makeBasis(_dx, d, _dz));
  };
  // orientasi tangan (kerangka kanan): menggantung seperti foto referensi — punggung tangan ke luar badan (+X), jempol ke depan (+Z),
  // jari ke bawah, kepalan miring ke depan 0.5 rad dan condong ke luar 0.2 rad.
  const Q_HANG0 = basisQ([0, 0, 1], [0, -1, 0], [1, 0, 0]);
  const Q_HANG = mulQ(qE(0, 0, 0.2), qE(-0.5, 0, 0), Q_HANG0);
  const Q_PALM = qE(0, Math.PI, 0);                                        // telapak ke penonton, jari ke atas
  const QP = [Q_HANG, Q_PALM, mulQ(qE(0, 0, -Math.PI / 2), Q_PALM), mulQ(qE(0, 0, -0.25), Q_PALM)];   // urutan = PRESET_NAMES
  const AX_X = new V3(1, 0, 0);
  // arah tiap ruas jempol saat terbuka (dari sudut Euler preview) → bisa dicampur dengan TD_FIST / TD_CUP
  const TD_OPEN = (() => {
    const t = P_OPEN.thumb, qb = qE(-t[1], 0, t[0], 'ZXY'), qm = qE(-t[2], 0, 0, 'ZXY'), qt = qE(-(t[2] * 0.85), 0, 0, 'ZXY');
    const Y = new V3(0, 1, 0), qbm = qb.clone().multiply(qm);
    return [Y.clone().applyQuaternion(qb), Y.clone().applyQuaternion(qbm), Y.clone().applyQuaternion(qbm.clone().multiply(qt))].map((d) => [d.x, d.y, d.z]);
  })();

  function digit(parent, mat, o) {   // rantai 3 ruas: pangkal → tengah → ujung (pivot di sendi), kapsul + bola buku jari
    const base = new THREE.Group(); base.position.set(o.x, o.y, o.z); parent.add(base);
    base.add(part(new THREE.SphereGeometry(o.R[0], 22, 16), mat, HAND_INK));
    const mk = (grp, i) => { const seg = part(new THREE.CapsuleGeometry(o.R[i], o.L[i], 8, 20), mat, HAND_INK); seg.position.y = o.L[i] / 2; grp.add(seg); };
    mk(base, 0);
    const mid = new THREE.Group(); mid.position.y = o.L[0]; base.add(mid); mk(mid, 1);
    const tip = new THREE.Group(); tip.position.y = o.L[1]; mid.add(tip); mk(tip, 2);
    return { base, mid, tip };
  }
  function makeGlove() {
    const mat = toon(0xE9EBEC), root = new THREE.Group();
    const wrist = new THREE.Group(); wrist.position.set(0, -0.52, 0); root.add(wrist);   // pivot di manset
    const hand = new THREE.Group(); hand.position.set(0, 0.52, 0); wrist.add(hand);
    const palmGeo = new THREE.SphereGeometry(1, 40, 28); palmGeo.scale(0.50, 0.47, 0.36);
    const palm = part(palmGeo, mat, HAND_INK); palm.position.y = 0.05; hand.add(palm);
    const fingers = FINGER.map((o) => digit(hand, mat, o));
    const thumb = digit(hand, mat, THUMB);
    // manset: bantal bulat yang diam di pergelangan (tidak ikut menekuk dengan telapak)
    const pr = [[0, -0.12], [0.22, -0.12], [0.29, -0.08], [0.30, 0], [0.29, 0.08], [0.22, 0.12], [0, 0.12]].map((p) => new THREE.Vector2(p[0], p[1]));
    const cuff = part(new THREE.LatheGeometry(pr, 36), toon(0xF1F2F2), HAND_INK); cuff.position.y = -0.55; root.add(cuff);
    const props = new THREE.Group(); hand.add(props);
    return { root, wrist, hand, fingers, thumb, props };
  }
  // ---- Properti makan soto: sendok (tangan kanan, di terowongan genggaman) & mangkuk (di dunia, dipegang tangan kiri)
  function makeSpoon() {
    const g = new THREE.Group(), met = toon(0xD9DFE3);
    const hd = part(new THREE.CylinderGeometry(0.05, 0.065, 1.5, 14), met, 0.03); hd.rotation.z = Math.PI / 2; g.add(hd);   // gagang sepanjang X
    const hg = new THREE.SphereGeometry(1, 28, 18); hg.scale(0.40, 0.30, 0.09);
    const head = part(hg, met, 0.03); head.position.set(0.95, 0, 0); g.add(head);
    const sc = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), toon(0xE9B23C)); sc.scale.set(0.27, 0.2, 0.03); sc.position.set(0.95, 0, 0.07); g.add(sc);   // kuah di sendok
    g.userData = { head, scoop: sc };
    return g;
  }
  function makeBowl() {
    const g = new THREE.Group(), cer = toon(0xF3EDDD), W = 0.03;
    const bg = new THREE.SphereGeometry(1, 44, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); bg.scale(0.7, 0.48, 0.7);
    g.add(part(bg, cer, W));
    g.add(part(new THREE.TorusGeometry(0.7, 0.045, 14, 48).rotateX(Math.PI / 2), cer, W));
    const foot = part(new THREE.CylinderGeometry(0.27, 0.31, 0.07, 24), toon(0xC9B58F), W); foot.position.y = -0.49; g.add(foot);
    const broth = new THREE.Mesh(new THREE.CircleGeometry(0.64, 36).rotateX(-Math.PI / 2), toon(0xE9B23C)); broth.position.y = -0.06; g.add(broth);
    const bit = (x, z, hex, r) => {   // daun bawang & irisan telur di kuah
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), toon(hex));
      m.scale.y = 0.45; m.position.set(x, -0.045, z); g.add(m);
    };
    bit(-0.2, 0.1, 0x6FA33A, 0.07); bit(0.12, -0.18, 0x6FA33A, 0.06); bit(0.25, 0.2, 0x6FA33A, 0.07);
    bit(-0.05, -0.05, 0xFFF4D0, 0.17); bit(-0.05, -0.05, 0xF1B52F, 0.07);
    return g;
  }

  // Tangan kiri = cermin tangan kanan (parent scale.x = −1; quaternion di-reflect). Semua gerak dihitung di kerangka kanan (RF).
  // handRig berputar mengikuti arah hadap badan (heading − yaw awal) → ayunan & pose tangan relatif badan, bukan sumbu dunia
  const handRig = new THREE.Group(); scene.add(handRig);
  const mirrorL = new THREE.Group(); mirrorL.scale.x = -1; handRig.add(mirrorL);
  const hands = [];     // [0] = kiri, [1] = kanan
  [-1, 1].forEach((side) => {
    const G = makeGlove();
    const holder = new THREE.Group(); holder.scale.setScalar(GS); holder.add(G.root);
    (side < 0 ? mirrorL : handRig).add(holder);
    const tun = new THREE.Object3D(); tun.position.set(TUN[0], TUN[1], TUN[2]); G.hand.add(tun);   // titik genggam tali tas / sendok
    let spoon = null, bowl = null;
    if (side === BOWL_SIDE) { bowl = makeBowl(); bowl.visible = false; G.props.add(bowl); }   // mangkuk = ANAK tangan pemegang mangkuk (transform lokal di-bake di bakeBowlGrip)
    else {   // sendok di tangan lainnya (disembunyikan sampai state 'eat')
      spoon = makeSpoon(); spoon.position.set(TUN[0] + 0.35, TUN[1], TUN[2]); spoon.visible = false; G.props.add(spoon);
    }
    hands.push({
      side, ph: side < 0 ? 0.2 : 2.4, G, holder, tun, spoon, bowl, wrist: G.wrist, hand: G.hand,
      propW: 0, ready: 0, readyS: { x: 0, v: 0 }, eW: 0, init: false, spd: 0, qp: Q_HANG.clone(),
      fp: new V3(), fv: new V3(), finit: false,   // gerak sekunder: titik ikut-badan (pegas) & kecepatannya
      tunOff: new V3(0, -0.17, 0), p: new Float32Array(NCH), v: new Float32Array(NCH), t: new Float32Array(NCH),   // pegas per kanal: posisi, kecepatan, target
    });
  });
  // pose jari dari closure (0 = terbuka, 1 = kepalan) per jari, dicampur ke pose makan (genggam sendok / menopang mangkuk) lewat eW
  const _td = new V3(), _tq = [new Q(), new Q(), new Q()], _tqi = new Q();
  const softLim = (x, lo, hi) => {   // batas lunak: linear di tengah, melengkung mulus ke batas (tidak pernah melewatinya)
    const k = JOINT_SOFT;
    if (x < lo + k) return lo + k * Math.exp((x - lo - k) / k);
    if (x > hi - k) return hi - k * Math.exp((hi - k - x) / k);
    return x;
  };
  function applyPose(H, kk, kt, spread, eW, km = kk) {
    const EP = H.side === BOWL_SIDE ? P_CUP : P_GRIP, TDE = H.side === BOWL_SIDE ? TD_CUP : TD_FIST, G = H.G;
    const sp = softLim(mix(spread, EP.spread, eW), JOINT_LIM.spread[0], JOINT_LIM.spread[1]);
    for (let i = 0; i < 3; i++) {
      const f = G.fingers[i];
      f.base.position.set(FINGER[i].x, FINGER[i].y, FINGER[i].z);        // reset (collider mangkuk bisa menggeser)
      const kb = clampN(kk[i + 1], -0.1, 1.12), kM = clampN(km[i + 1], -0.1, 1.12), kT = clampN(kt[i + 1], -0.1, 1.12);
      // pangkal → tengah → ujung punya closure sendiri (pegas makin lambat) → ruas bergerak bertahap; lalu batas sendi
      const c1 = softLim(mix(mix(P_OPEN.c1[i], P_FIST.c1[i], kb), EP.c1[i], eW), JOINT_LIM.c1[0], JOINT_LIM.c1[1]);
      const c2 = softLim(mix(mix(P_OPEN.c2[i], P_FIST.c2[i], kM), EP.c2[i], eW), JOINT_LIM.c2[0], JOINT_LIM.c2[1]);
      const c3 = softLim(mix(mix(P_OPEN.c3[i], P_FIST.c3[i], kT), EP.c3[i], eW), JOINT_LIM.c3[0], JOINT_LIM.c3[1]);
      f.base.rotation.set(-c1, 0, sp * 0.3 * (i === 0 ? -1 : i === 2 ? 1 : 0), 'ZXY');
      f.mid.rotation.set(-c2, 0, 0); f.tip.rotation.set(-c3, 0, 0);
    }
    // jempol: ARAH tiap ruas (kerangka tangan) = campuran terbuka → kepalan (closure), lalu → pose makan
    for (let j = 0; j < 3; j++) {
      const kTh = clampN((j === 0 ? kk : j === 1 ? km : kt)[0], 0, 1.05);   // tiap ruas jempol menyusul ruas sebelumnya; 0..1.05 = tanpa hiperekstensi
      _td.set(mix(mix(TD_OPEN[j][0], TD_FIST[j][0], kTh), TDE[j][0], eW), mix(mix(TD_OPEN[j][1], TD_FIST[j][1], kTh), TDE[j][1], eW),
        mix(mix(TD_OPEN[j][2], TD_FIST[j][2], kTh), TDE[j][2], eW)).normalize();
      dirQInto(_td, _tq[j]);
    }
    G.thumb.base.quaternion.copy(_tq[0]);
    G.thumb.mid.quaternion.copy(_tqi.copy(_tq[0]).invert().multiply(_tq[1]));
    G.thumb.tip.quaternion.copy(_tqi.copy(_tq[1]).invert().multiply(_tq[2]));
  }

  // ---- Pegangan mangkuk: collider sesuai makeBowl() × BOWL_S + penyelesai lilit jari (dipakai hanya saat bake).
  // Mangkuk dianggap PADAT: badan (setengah elipsoid), bibir + ruang di atas mulut, dan kaki → tidak ada jari di dalam / menembus mangkuk.
  const BW = { a: 0.7 * BOWL_S, b: 0.48 * BOWL_S, rim: 0.045 * BOWL_S, up: 0.35 * BOWL_S, footY: -0.49 * BOWL_S, footH: 0.035 * BOWL_S, footR: 0.31 * BOWL_S };
  const BW_EAT = Object.fromEntries(Object.entries(BW).map(([k, v]) => [k, v * BOWL_EAT_K]));   // mangkuk soto yang tampil (diperkecil)
  function bowlHit(p, c, r, B = BW) {                     // true bila bola (p, r) [dunia] menyentuh mangkuk (ukuran B) berpusat bibir c
    const BW = B, x = p.x - c.x, y = p.y - c.y, z = p.z - c.z, h = Math.hypot(x, z);
    if (y <= r && (x / (BW.a + r)) ** 2 + (Math.min(y, 0) / (BW.b + r)) ** 2 + (z / (BW.a + r)) ** 2 < 1) return true;
    if (y > -r && y < BW.up + r && h < BW.a + BW.rim + r) return true;
    return Math.abs(y - BW.footY) < BW.footH + r && h < BW.footR + r;
  }
  function bowlClear(p, c, r, B = BW) {                  // jarak bebas bola (p, r) ke mangkuk (negatif = tembus sedalam itu)
    let lo = -0.6, hi = 0.6;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (bowlHit(p, c, m, B)) hi = m; else lo = m; }
    return lo - r;
  }
  const bowlDepth = (p, c, r, B = BW) => Math.max(0, -bowlClear(p, c, r, B));   // kedalaman tembus (0 = bebas)
  const _sg = new V3();
  const segHit = (p0, d, len, r, c) => {                 // ruas kapsul p0 → p0 + d·len (radius r) menyentuh mangkuk?
    for (let k = 0; k <= 4; k++) { _sg.copy(p0).addScaledVector(d, (len * k) / 4); if (bowlHit(_sg, c, r)) return true; }
    return false;
  };
  /**
   * Jari i menutup seperti jari sungguhan: semua sendi aktif menekuk bersama (+0.02 rad/langkah, maks GRIP_CURL). Begitu ruas k menyentuh
   * dinding luar, sendi 0..k berhenti dan sendi sesudahnya terus menutup sampai ikut menyentuh → jari melengkung mengikuti kurva mangkuk.
   * Ruas di bidang tekuk tangan: arah = cos φ·Fw + sin φ·Nw (Fw = arah jari lurus, Nw = normal telapak), φ = jumlah tekukan.
   */
  function wrapFinger(H, i, c, Fw, Nw) {
    const o = FINGER[i], p0 = H.G.hand.localToWorld(new V3(o.x, o.y, o.z)), d = new V3(), q = new V3();
    const hitFrom = (cs, m) => {                         // ruas pertama (≥ m) yang menyentuh, atau −1
      let phi = 0; q.copy(p0);
      for (let j = 0; j < 3; j++) {
        phi += cs[j]; d.copy(Fw).multiplyScalar(Math.cos(phi)).addScaledVector(Nw, Math.sin(phi));
        if (j >= m && segHit(q, d, o.L[j] * GS, o.R[j] * GS + GRIP_GAP, c)) return j;
        q.addScaledVector(d, o.L[j] * GS);
      }
      return -1;
    };
    const cs = [0, 0, 0];
    if (hitFrom(cs, 0) >= 0) return { cs, blocked: true };
    for (let m = 0, guard = 0; m < 3 && guard < 400; guard++) {
      const nx = cs.map((v, j) => (j >= m ? Math.min(GRIP_CURL[j], v + 0.02) : v));
      if (nx.every((v, j) => v === cs[j])) break;
      const h = hitFrom(nx, m);
      if (h < 0) for (let j = 0; j < 3; j++) cs[j] = nx[j]; else m = h + 1;
    }
    return { cs, blocked: false };
  }
  // State karakter (setState): 'idle' | 'walk' | 'eat' → menentukan gerak sarung tangan
  let stateName = 'idle', wWalk = 0, wEat = 0, eatT = 0, prevEu = 0, spoonFlip = false;
  // arah hadap: heading (rad, 0 = menghadap kamera, + = ke kanan layar). Mulai dari yaw awal (gaya), lalu mengikuti gerak.
  let heading = yaw, headingT = yaw, mvR = 0, mvT = 0, mvAt = -10, moveSpd = 0, speedK = 1;
  const wrapPI = (a) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
  /** Laporan kecepatan dari pemanggil (relatif kamera): vRight = ke kanan layar, vToward = mendekati kamera (satuan dunia/s). */
  const move = (vRight, vToward) => {
    if (!Number.isFinite(vRight) || !Number.isFinite(vToward)) return;
    mvR = vRight; mvT = vToward; mvAt = nowS();
  };
  const sWalk = { x: 0, v: 0 }, sEat = { x: 0, v: 0 };
  // pegas teredam kritis (semi-implicit, substep, berbasis dt): menuju target tanpa overshoot, kecepatan kontinu → tanpa letupan
  function critDamp(S, target, om, dt) {
    const n = Math.min(14, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) { S.v += ((target - S.x) * om * om - 2 * om * S.v) * h; S.x += S.v * h; }
    if (!Number.isFinite(S.x) || !Number.isFinite(S.v)) { S.x = target; S.v = 0; }
    return S.x;
  }
  const setState = (s) => { stateName = s; };
  // Pegas under-damped per kanal: k = ω², c = 2ζω. Substep ≤ 8 ms + dt dibatasi → stabil di frame lambat / tab latar / HiDPI.
  // Nilai tidak finite langsung dikembalikan ke target (tidak pernah menyebarkan NaN).
  function springChannel(P, V, T, c, om, ze, dt) {
    const n = Math.min(14, Math.ceil(dt / 0.008)), h = dt / n, k = om * om, cc = 2 * ze * om;
    let p = P[c], v = V[c];
    const tg = Number.isFinite(T[c]) ? T[c] : 0;
    for (let i = 0; i < n; i++) { v += ((tg - p) * k - v * cc) * h; p += v * h; }
    if (!Number.isFinite(p) || !Number.isFinite(v) || Math.abs(p) > 50) { p = tg; v = 0; }
    P[c] = p; V[c] = clampN(v, -120, 120);
  }
  const acc = new Float32Array(NCH);            // akumulator gestur (dipakai ulang)
  const sstep = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const mix = (a, b, u) => a + (b - a) * u;

  // ---- Koreografi makan (kerangka dunia-badan; objek hasil dipakai ulang — tanpa alokasi per frame)
  const _pw = new V3(), _mB = new V3(), _mS = new V3(), mouthW = new V3();
  const qA = new Q(), qFin = new Q(), _eu = new E(), _fd = new V3(), _lv = new V3(), _qy = new Q(), AX_Y = new V3(0, 1, 0);
  const screenW = (G, hi) => (G && G.def.screen && (G.hand === "both" || (G.hand === "right") === (hi === 1)) ? G.w : 0);
  const _eHead = new V3(), _eD = new V3(), _eY = new V3(), _eZ = new V3(), _eM = new M4(), _mt = new V3(), _BD = new V3();
  const _D0 = new V3(...EAT_D0).normalize(), _D1 = new V3(...EAT_D1).normalize(), _UPREF = new V3(0, -0.2, 1), _SHL = new V3(...SPOON_HEAD_L);
  // Pegangan mangkuk hasil bake (kerangka kanan): off = telapak − pusat bibir mangkuk, q = orientasi tangan, lalu sudut tiap ruas jari/jempol
  const BOWL_RF = new V3(BOWL_SIDE * BOWL_C[0], BOWL_C[1], BOWL_C[2]);   // mangkuk di kerangka tangan pemegangnya (RF: x = side × x dunia)
  // orientasi tangan penopang (RF): jari (+y lokal) mengarah ke DALAM, condong ke kamera (GRIP_AIM); telapak (−z lokal) menghadap ke atas (dasar mangkuk)
  const GRIP_F = new V3(-Math.cos(GRIP_AIM.yaw) * Math.cos(GRIP_AIM.pitch), Math.sin(GRIP_AIM.pitch), Math.sin(GRIP_AIM.yaw) * Math.cos(GRIP_AIM.pitch)).normalize();
  const GRIP_N = new V3(0, 1, 0).addScaledVector(GRIP_F, -GRIP_F.y).normalize();
  const Q_BOWL_RF = basisQ(new V3().crossVectors(GRIP_F, GRIP_N.clone().negate()).toArray(), GRIP_F.toArray(), GRIP_N.clone().negate().toArray());
  const GRIP = { off: new V3(), q: Q_BOWL_RF.clone(), pos: [], base: [], mid: [], tip: [], tb: null, tm: null, tt: null, td: null, maxPen: 0, blocked: 0, drop: 0 };
  const spoonRes = { pos: new V3(), q: new Q() }, bowlRes = { pos: new V3(), q: GRIP.q };
  const backOut = (u, k = 1.4) => { const c = k + 1; return 1 + c * Math.pow(u - 1, 3) + k * Math.pow(u - 1, 2); };
  /** Sendok: kepala sendok dari mangkuk → mulut (busur) → kembali; kembalikan pos & orientasi tangan kanan (kerangka badan). */
  function eatSpoon(u, mB) {
    const BD = _BD.set(-BOWL_RF.x + BOWL_DIP[0], BOWL_C[1] + BOWL_DIP[1], BOWL_C[2] + BOWL_DIP[2]);   // mangkuk di kerangka tangan SENDOK (sisi berlawanan → x RF = −BOWL_RF.x)
    const mouthT = _mt.copy(mB); mouthT.z += 0.1;           // kepala sendok berhenti 0.1 di depan titik mulut
    const e2 = smooth01, dipK = e2(u / 0.1) * (1 - e2((u - 0.14) / 0.08));
    if (u < 0.18) { _eHead.copy(BD); _eHead.y -= 0.04 * dipK; _eD.copy(_D0); }                                  // menyendok
    else if (u < 0.55) {                                                                                         // mengangkat (busur)
      const s = (u - 0.18) / 0.37, k = backOut(e2(s), 0.9), arc = Math.sin(Math.PI * e2(s));
      _eHead.lerpVectors(BD, mouthT, k); _eHead.x += 0.28 * arc; _eHead.y += 0.55 * arc; _eHead.z += 0.35 * arc;
      _eD.lerpVectors(_D0, _D1, e2(Math.min(1, s * 1.2))).normalize();
    } else if (u < 0.68) {                                                                                       // sendok di mulut
      _eHead.copy(mouthT); _eHead.x += 0.02 * Math.sin((u - 0.55) * 28); _eHead.y += 0.03 * Math.sin((u - 0.55) * 18); _eD.copy(_D1);
    } else {                                                                                                     // kembali
      const k = e2((u - 0.68) / 0.32), arc = Math.sin(Math.PI * k);
      _eHead.lerpVectors(mouthT, BD, k); _eHead.x += 0.18 * arc; _eHead.y += 0.3 * arc; _eHead.z += 0.25 * arc;
      _eD.lerpVectors(_D1, _D0, k).normalize();
    }
    // tangan: sumbu X lokal = arah sendok, Y lokal condong ke atas-depan; posisi = kepala − (kepala sendok lokal × GS)
    _eY.copy(_UPREF).addScaledVector(_eD, -_UPREF.dot(_eD)).normalize(); _eZ.crossVectors(_eD, _eY);
    spoonRes.q.setFromRotationMatrix(_eM.makeBasis(_eD, _eY, _eZ));
    spoonRes.pos.copy(_SHL).multiplyScalar(GS).applyQuaternion(spoonRes.q).negate().add(_eHead);
    return spoonRes;
  }
  /** Telapak kiri (kerangka kanan RF). Mangkuk anak tangan → ikut kaku; seluruh tangan + mangkuk turun sedikit saat sendok masuk. */
  function eatBowl(u) {
    const dip = (u > 0.02 && u < 0.2 ? Math.sin(((u - 0.02) / 0.18) * Math.PI) : 0) * 0.05
      + (u > 0.55 && u < 0.68 ? Math.sin(((u - 0.55) / 0.13) * Math.PI * 2) * 0.012 : 0);
    bowlRes.pos.set(BOWL_RF.x + GRIP.off.x, BOWL_RF.y - dip + GRIP.off.y, BOWL_RF.z + GRIP.off.z);
    return bowlRes;
  }
  /**
   * BAKE pegangan mangkuk (sekali saat mount): telapak di bawah dasar mangkuk (GRIP_PALM), orientasi Q_BOWL_RF; tiap jari menutup sampai
   * menyentuh dinding luar (wrapFinger); jempol = pose layar THUMB_SOTO (thumbSotoPose, digambar di atas mangkuk). Bila ada jari yang tidak muat, telapak turun sedikit.
   * Hasil (sudut sendi + posisi telapak) disimpan di ruang LOKAL tangan; saat runtime tinggal dicampur dengan bobot eW (blendBowlGrip).
   */
  function bakeBowlGrip() {
    const H = hands.find((h) => h.side === BOWL_SIDE), G = H.G, bowlC = new V3(...BOWL_C);
    const handRF = new V3(), Fw = new V3(), Nw = new V3();
    H.wrist.rotation.set(0, 0, 0); H.wrist.scale.set(1, 1, 1);
    G.fingers.forEach((fg, i) => { fg.base.position.set(FINGER[i].x, FINGER[i].y, FINGER[i].z); fg.base.rotation.set(0, 0, 0); fg.mid.rotation.set(0, 0, 0); fg.tip.rotation.set(0, 0, 0); });
    let res = null, drop = 0;
    for (; drop <= GRIP_PALM_DROP_MAX + 1e-6; drop += 0.03) {
      handRF.set(BOWL_RF.x + GRIP_PALM.x, BOWL_RF.y + GRIP_PALM.y - drop, BOWL_RF.z + GRIP_PALM.z);
      H.holder.position.copy(handRF); H.holder.quaternion.copy(Q_BOWL_RF); scene.updateMatrixWorld(true);
      Fw.set(0, 1, 0).transformDirection(G.hand.matrixWorld); Nw.set(0, 0, -1).transformDirection(G.hand.matrixWorld);
      res = G.fingers.map((_, i) => wrapFinger(H, i, bowlC, Fw, Nw));
      if (!res.some((r) => r.blocked)) break;
    }
    drop = Math.min(drop, GRIP_PALM_DROP_MAX);
    res.forEach((r, i) => { const fg = G.fingers[i]; fg.base.rotation.set(-r.cs[0], 0, 0); fg.mid.rotation.set(-r.cs[1], 0, 0); fg.tip.rotation.set(-r.cs[2], 0, 0); });
    scene.updateMatrixWorld(true);
    // mangkuk soto diperkecil (BOWL_EAT_K): pose jari TETAP; tangan digeser menuju pusat mangkuk sampai jarak bebas jari = seperti pada ukuran asli
    const fingerClear = (B) => {
      let m = 9;
      G.fingers.forEach((fg, i) => [fg.base, fg.mid, fg.tip].forEach((grp, j) => { for (let k = 0; k <= 4; k++) m = Math.min(m, bowlClear(grp.localToWorld(new V3(0, (FINGER[i].L[j] * k) / 4, 0)), bowlC, FINGER[i].R[j] * GS, B)); }));
      return m;
    };
    const clear0 = fingerClear(BW), toC = new V3();
    G.fingers.forEach((fg) => toC.add(fg.tip.localToWorld(new V3(0, 0.1, 0))));
    toC.multiplyScalar(-1 / 3).add(bowlC).normalize();                 // dari ujung jari (rata-rata) → pusat bibir mangkuk
    const base0 = handRF.clone();
    for (let sh = 0; sh <= 0.6; sh += 0.005) {
      handRF.set(base0.x + BOWL_SIDE * toC.x * sh, base0.y + toC.y * sh, base0.z + toC.z * sh);
      H.holder.position.copy(handRF); scene.updateMatrixWorld(true);
      if (fingerClear(BW_EAT) <= clear0) break;
    }
    // jempol: pose layar (THUMB_SOTO) diubah ke kerangka tangan pada pose pegangan → ikut kaku dengan tangan & mangkuk
    GRIP.w2h = new M4().copy(G.hand.matrixWorld).invert();
    GRIP.tb0w = G.hand.localToWorld(new V3(THUMB.x, THUMB.y, THUMB.z));
    thumbSotoPose();
    const tq = GRIP.td.map((d) => dirQInto(d, new Q()));
    G.thumb.base.quaternion.copy(tq[0]);
    G.thumb.mid.quaternion.copy(tq[0].clone().invert().multiply(tq[1]));
    G.thumb.tip.quaternion.copy(tq[1].clone().invert().multiply(tq[2]));
    G.thumb.base.position.set(THUMB.x, THUMB.y, THUMB.z);
    scene.updateMatrixWorld(true);
    GRIP.q.copy(Q_BOWL_RF); GRIP.off.copy(handRF).sub(BOWL_RF); GRIP.drop = drop; GRIP.blocked = res.filter((r) => r.blocked).length;
    G.fingers.forEach((fg, i) => { GRIP.pos[i] = fg.base.position.clone(); GRIP.base[i] = fg.base.quaternion.clone(); GRIP.mid[i] = fg.mid.quaternion.clone(); GRIP.tip[i] = fg.tip.quaternion.clone(); });
    GRIP.tb = G.thumb.base.quaternion.clone(); GRIP.tm = G.thumb.mid.quaternion.clone(); GRIP.tt = G.thumb.tip.quaternion.clone();
    // mangkuk di ruang lokal tangan: orientasi RF mangkuk = identitas, pusat bibir = BOWL_RF
    H.bowl.quaternion.copy(GRIP.q).invert();
    H.bowl.position.copy(GRIP.off).negate().applyQuaternion(H.bowl.quaternion).divideScalar(GS);
    // kedalaman tembus jari & ibu jari (radius asli, tanpa celah) — harus 0
    let pen = 0;   // jari saja (jempol = pose layar di atas mangkuk, sengaja tidak fisik)
    G.fingers.forEach((d, i) => { const o = FINGER[i]; [d.base, d.mid, d.tip].forEach((grp, j) => { for (let k = 0; k <= 4; k++) pen = Math.max(pen, bowlDepth(grp.localToWorld(new V3(0, (o.L[j] * k) / 4, 0)), bowlC, o.R[j] * GS, BW_EAT)); }); });
    GRIP.maxPen = pen;
  }
  /** Campur sudut jari/jempol tangan kiri ke pegangan hasil bake dengan bobot w (0 = pose biasa, 1 = memegang mangkuk). */
  /** THUMB_SOTO (kerangka kamera) → GRIP.td (arah ruas, kerangka tangan) & GRIP.tpos (pangkal, lokal tangan). Murah → dihitung tiap frame (slider debug langsung terlihat). */
  function thumbSotoPose() {
    const P = THUMB_SOTO, D = Math.PI / 180, tz = Math.tan(P.tilt * D);
    let th = P.rot * D;
    GRIP.td = GRIP.td || [new V3(), new V3(), new V3()];
    for (let j = 0; j < 3; j++) {
      if (j === 1) th += P.bend1 * D; else if (j === 2) th += P.bend2 * D;
      GRIP.td[j].set(Math.cos(th), Math.sin(th), tz).normalize().transformDirection(GRIP.w2h);
    }
    GRIP.tpos = (GRIP.tpos || new V3()).set(GRIP.tb0w.x + P.x, GRIP.tb0w.y + P.y, GRIP.tb0w.z + P.z).applyMatrix4(GRIP.w2h);
  }
  const THUMB_POS0 = new V3(THUMB.x, THUMB.y, THUMB.z);
  function blendBowlGrip(H, w) {
    const G = H.G;
    for (let i = 0; i < 3; i++) {
      const f = G.fingers[i];
      f.base.position.lerp(GRIP.pos[i], w);
      f.base.quaternion.slerp(GRIP.base[i], w); f.mid.quaternion.slerp(GRIP.mid[i], w); f.tip.quaternion.slerp(GRIP.tip[i], w);
    }
    // jempol: campur ARAH tiap ruas (kerangka tangan) lalu bangun ulang kuaternion seperti applyPose. Slerp kuaternion relatif per ruas
    // bisa mengambil jalan memutar (puntiran bebas dari dirQInto) → ujung jempol melompat; arah ruas selalu berubah mulus.
    const T = G.thumb;
    thumbSotoPose();
    T.base.position.lerpVectors(THUMB_POS0, GRIP.tpos, w);
    _bq.copy(T.base.quaternion); _bd[0].set(0, 1, 0).applyQuaternion(_bq);
    _bq.multiply(T.mid.quaternion); _bd[1].set(0, 1, 0).applyQuaternion(_bq);
    _bq.multiply(T.tip.quaternion); _bd[2].set(0, 1, 0).applyQuaternion(_bq);
    for (let j = 0; j < 3; j++) {
      const a = _bd[j], b = GRIP.td[j], om = Math.acos(clampN(a.dot(b), -1, 1));
      if (om < 1e-4) a.copy(b);
      else { const s0 = Math.sin((1 - w) * om) / Math.sin(om), s1 = Math.sin(w * om) / Math.sin(om); a.multiplyScalar(s0).addScaledVector(b, s1).normalize(); }
      dirQInto(a, _tq[j]);
    }
    T.base.quaternion.copy(_tq[0]);
    T.mid.quaternion.copy(_tqi.copy(_tq[0]).invert().multiply(_tq[1]));
    T.tip.quaternion.copy(_tqi.copy(_tq[1]).invert().multiply(_tq[2]));
  }
  const _bq = new Q(), _bd = [new V3(), new V3(), new V3()];
  // Jempol tangan mangkuk: material isi sendiri (klon) supaya bisa digambar tanpa depth test tanpa memengaruhi bagian sarung tangan lain.
  // Overlay: semua garis tepi jempol dulu (renderOrder RO), lalu semua isi (RO + 1) → siluet utuh dengan garis tepi penuh, tanpa garis di sambungan ruas.
  const thumbMeshes = [];
  {
    const H = hands.find((h) => h.side === BOWL_SIDE), fill = new THREE.MeshToonMaterial().copy(H.G.thumb.base.children[0].children[0].material);
    // hanya ruas tengah & ujung (thumb.mid berisi tip) yang di-overlay; ruas pangkal tetap ber-depth → bagian di dalam telapak tertutup telapak (menyatu, tanpa garis sambungan)
    (THUMB_OVERLAY_BASE ? H.G.thumb.base : H.G.thumb.mid).traverse((o) => { if (o.isMesh) { if (o.material.isMeshToonMaterial) o.material = fill; thumbMeshes.push(o); } });
  }
  let thumbOverlay = false;
  function setThumbOverlay(H, on) {
    if (on === thumbOverlay) return;
    thumbOverlay = on;
    for (const m of thumbMeshes) {
      const ink = !m.material.isMeshToonMaterial;
      m.material.depthTest = !on; m.material.depthWrite = !on;
      m.renderOrder = on ? THUMB_OVERLAY_RO + (ink ? 0 : 1) : 0;
    }
  }
  // mulut Gasing saat makan: tertutup sampai .34, membuka .34–.5, lebar sampai .58, menutup .58–.64, .12 sampai .68, mengunyah sampai .88
  function mouthOpenAt(u) {
    const e2 = smooth01;
    if (u > 0.34 && u < 0.5) return e2((u - 0.34) / 0.16);
    if (u >= 0.5 && u < 0.58) return 1;
    if (u >= 0.58 && u < 0.64) return 1 - 0.88 * e2((u - 0.58) / 0.06);
    if (u >= 0.64 && u < 0.68) return 0.12;
    if (u >= 0.68 && u < 0.88) return 0.02 + 0.2 * chewAt(u);
    return 0;
  }
  const chewAt = (u) => (u > 0.68 && u < 0.88 ? Math.pow(Math.sin(((u - 0.68) / 0.2) * Math.PI * 2), 2) : 0);
  bakeBowlGrip();

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

  // ---- Tas tenis di punggung (opsional, bag: true). Rantai: swing (titik gantung = puncak tali, melayang di belakang badan,
  // berayun seperti bandul) → yawG (arah hadap) → bagG (skala) → tas. Tangan tidak pernah memegang tas.
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
    carry = { model, swing, yawG, bagG, bagShadow, th: 0, om: 0, px: null, pvx: 0, wobAt: -10, phase: 'held', bt: 0, bt0: 0, t0: 0, want: false, wGround: 0, head: yaw, init: false, tp: new V3(), rp: new V3() };
  }

  // ---- Framing: badan utuh selalu pas di dalam kotak elemen.
  // Sarung tangan melayang jauh di samping badan, jadi canvas dibuat SPAN× lebih lebar dari elemen
  // (di-tengah-kan, boleh keluar kotak) — ukuran badan tetap sama seperti tanpa sarung tangan.
  // Dengan tas, sisi kiri butuh ruang lebih untuk tas yang berayun.
  let SPAN = withBag ? 2.5 : 2.3;                   // dihitung ulang di resize() dari CANVAS_HALF_W (ini hanya nilai awal/minimum)
  const SPAN_MIN = SPAN;
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
    // lebar kanvas = cukup untuk ±CANVAS_HALF_W satuan model (dulu tetap 2.3× elemen → ujung telunjuk "point" terpotong di tepi kanvas)
    {
      const t0 = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const d0 = Math.max(FIT_H / (2 * t0), FIT_W / (2 * t0 * (w / h)));
      const elemW = 2 * d0 * t0 * (w / h);                // lebar elemen dalam satuan model (di kedalaman target)
      SPAN = Math.max(SPAN_MIN, (2 * CANVAS_HALF_W) / elemW);
      canvas.style.width = `${SPAN * 100}%`;
      canvas.style.marginLeft = `${-((SPAN - 1) / 2) * 100}%`;
    }
    const cw = Math.round(w * SPAN);
    // canvas kini lebih besar dari elemen → batasi jumlah piksel supaya tetap ringan di layar HiDPI
    renderer.setPixelRatio(Math.max(0.75, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(1.5e6 / (w * SPAN * h * VS)))));
    renderer.setSize(cw, Math.round(h * VS), false);
    camera.aspect = (w * SPAN) / h;
    camera.setViewOffset(w * SPAN, h, 0, -PAD_T * h, w * SPAN, h * VS);
    camera.updateProjectionMatrix();
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(FIT_H / (2 * t), FIT_W / (2 * t * (w / h)));
    camera.position.copy(viewTarget).addScaledVector(viewDir, d / viewZoom);
    camera.lookAt(viewTarget);
    camera.updateMatrixWorld();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  // ---- Animasi
  let hopStart = -10;
  // Senggol tas: bandul diberi dorongan + raket bergoyang di dalam tas
  let disposed = false;
  let lastWobble = -10;
  const wobble = () => {
    if (!carry || disposed) return;
    const t = nowS();
    if (t - lastWobble < 0.25) return;                 // batas laju: dorongan beruntun tidak menumpuk
    lastWobble = t;
    carry.om = clampN(carry.om + (carry.om > 0 ? -1 : 1) * 2.6, -9, 9);
    carry.wobAt = t;
  };
  // o.silent: tanpa boing (pemanggil membunyikannya sendiri, mis. scene 0 menyinkronkan boing dengan lengkung loncat di DOM) · o.volume: pengali volume boing
  const hop = (o) => {
    if (disposed) return;
    const t = nowS();
    if (t - hopStart > 0.75) { hopStart = t; wobble(); if (el.isConnected && !o?.silent) sfx('hop', o?.volume != null ? { volume: o.volume } : undefined); }   // bunyi tepat saat loncatan benar-benar dimulai
  };
  // Sisi tas (rad) bisa diubah saat berjalan: scene 0 menunggu dengan tas di samping badan (bagSide, seperti scene 1–2), lalu 0 = tas di punggung
  // (sama seperti scene 3/4/11 yang berjalan) begitu Gasing berbalik & melangkah. Menyusul halus (BAG_SIDE_RATE) → tas tidak melompat.
  let bagSideNow = bagSide, bagSideTo = bagSide;
  const setBagSide = (v) => { if (Number.isFinite(v)) bagSideTo = v; };

  // ---- Mesin gestur: ga = gestur aktif, gb = gestur yang sedang memudar (diinterupsi), gf = fidget idle.
  // Digerakkan sepenuhnya oleh render() (tanpa timer/Promise) → tidak ada yang tertinggal saat dispose().
  const TAU = Math.PI * 2;
  let ga = null, gb = null, gf = null, nextFid = GESTURE_TIMING.fidget[0] + Math.random() * 3, lastFid = '', curNow = 0;
  const finishG = (G, cancelled) => {
    if (!G || G.done) return;
    G.done = true;
    const cb = G.onDone; G.onDone = null;
    if (cb) { try { cb({ cancelled }); } catch (err) { console.error(err); } }
  };
  /**
   * Mainkan gestur. o: { hand: 'left'|'right'|'both', intensity (0–1.6), onDone({cancelled}) }.
   * Yang baru menggantikan yang lama (yang lama memudar silang 0.15 s, tidak snap). Nama sama dalam 0.15 s diabaikan.
   */
  const gesture = (name, o = {}) => {
    const def = GESTURES[name];
    if (disposed || !def || def.fid) { o.onDone?.({ cancelled: true }); return false; }
    if (ga && ga.name === name && ga.t < 0.15) { o.onDone?.({ cancelled: true, duplicate: true }); return false; }
    if (gb) gb = null;
    if (ga) { finishG(ga, true); ga.fading = true; gb = ga; }
    // gestur menunjuk mengikuti arah hadap di layar: menghadap kiri → tangan kiri menunjuk ke kiri (kecuali tangan kiri sedang menjinjing tas)
    let hand = o.hand || def.hand;
    if (def.screen && !o.hand && Math.sin(heading) < -POINT_SIDE_SIN ) hand = 'left';
    ga = { def, name, t: 0, w: 0, k: clampN(o.intensity ?? 1, 0, 1.6), fade: 1, fading: false, onDone: o.onDone || null, done: false, hand, speed: clampN(o.speed ?? 1, 0.25, 3) };
    return true;
  };
  const stepG = (G, dt) => {
    G.t += G.def.fid ? dt : dt * (G.speed ?? 1) / GESTURE_TIMING.tempo;   // gestur utama diperlambat (speed per panggilan: > 1 = lebih cepat)
    if (G.fading) { G.fade -= dt / 0.15; if (G.fade <= 0) return false; }
    if (!G.def.loop && G.t >= G.def.dur) return false;
    G.w = smooth01(G.t / 0.06) * (G.def.loop ? 1 : smooth01((G.def.dur - G.t) / 0.18)) * Math.max(0, G.fade);
    return true;
  };
  function stepGestures(dt, canFid) {
    if (ga && !stepG(ga, dt)) { const d = ga; ga = null; finishG(d, false); }
    if (gb && !stepG(gb, dt)) gb = null;
    if (gf) {
      if (ga || !canFid) gf.fading = true;
      if (!stepG(gf, dt)) { gf = null; nextFid = curNow + GESTURE_TIMING.fidget[0] + Math.random() * (GESTURE_TIMING.fidget[1] - GESTURE_TIMING.fidget[0]); }
    } else if (canFid && !ga && curNow >= nextFid) {
      let name;
      do { name = FIDGET_NAMES[(Math.random() * FIDGET_NAMES.length) | 0]; } while (name === lastFid && FIDGET_NAMES.length > 1);
      lastFid = name;
      gf = { def: GESTURES[name], name, t: 0, w: 0, k: 0.8 + Math.random() * 0.4, fade: 1, fading: false, done: false, onDone: null, hand: Math.random() < 0.5 ? 'left' : 'right' };
    }
  }
  /** Tambahkan kontribusi gestur G untuk tangan hi ke `acc`. mot/fin = skala gerak lengan/pergelangan dan jari. */
  function addGesture(G, hi, mot, fin) {
    const def = G.def, hand = G.hand;
    if ((hand === 'right' && hi !== 1) || (hand === 'left' && hi !== 0)) return false;
    let tt = G.t - (hand === 'both' && hi === 0 ? G_BOTH_LAG : 0);   // asimetri: tangan kiri menyusul
    if (tt < 0) tt = 0;
    if (def.loop) tt %= def.dur;
    const k = def.k, mm = G.w * G.k * mot * amp, ff = G.w * G.k * fin;
    for (let c = 0; c < 7; c++) acc[c] += sampleKeys(k, tt, c) * mm;          // fw, lat, r, wx, wy, wz, ox
    for (let c = 17; c < 20; c++) acc[c] += sampleKeys(k, tt, c) * mm;        // oz, oy, oq
    acc[7] += sampleKeys(k, tt, 7) * ff;                                       // spread
    acc[12] += sampleKeys(k, tt, 12) * G.w * G.k * amp;
    for (let i = 0; i < 4; i++) {
      const ti = Math.max(0, tt - FDELAY[i]);      // jari tertinggal bertahap
      acc[C_CLOSE + i] += sampleKeys(k, ti, C_CLOSE + i) * ff;
      acc[C_MID + i] += sampleKeys(k, Math.max(0, ti - MID_LAG), C_CLOSE + i) * ff;
      acc[C_TIP + i] += sampleKeys(k, Math.max(0, ti - TIP_LAG), C_TIP + i) * ff;
    }
    if (def.hold) {                                // moving hold: drift mikro di puncak pose
      const hs = smooth01((tt - def.hold[0]) / 0.15) * (1 - smooth01((tt - def.hold[1]) / 0.2));
      if (hs > 0) {
        acc[0] += hs * 0.03 * Math.sin(tt * 4.1) * mm;
        acc[1] += hs * 0.035 * Math.sin(tt * 3.3 + 1) * mm;
        acc[5] += hs * 0.05 * Math.sin(tt * 3.7 + 2) * mm;
      }
    }
    if (def.osc) {
      for (let j = 0; j < def.osc.length; j++) {
        const o = def.osc[j];
        if (!def.loop && (tt < o.t0 || tt > o.t1)) continue;
        const ts = tt - o.t0;
        const win = def.loop ? 1 : smooth01(ts / 0.12) * (1 - smooth01((tt - (o.t1 - 0.18)) / 0.18));
        const dec = o.decay ? Math.exp(-o.decay * ts) : 1;
        if (o.c === 'curl') {
          for (let i = 0; i < 4; i++) {
            const v = o.amp * Math.sin(TAU * o.hz * (ts - FDELAY[i]) + i * (o.ph || 0)) * win * dec * ff;
            acc[C_CLOSE + i] += v; acc[C_MID + i] += v; acc[C_TIP + i] += v;
          }
        } else {
          acc[def.oscIdx[j]] += o.amp * Math.sin(TAU * o.hz * ts) * win * dec * mm;
        }
      }
    }
    return true;
  }
  let lastNow = null;
  let nextBlink = 1.2 + Math.random() * 1.5, blinkAt = -1;
  const look = new V3(), local = new V3();
  // arah ke penonton: dari HOME_DIR (tetap), BUKAN camera.position — resize() melewati pengaturan kamera bila elemen belum berukuran saat mount (mata salah arah)
  const lookDir = HOME_DIR.clone();
  const phase = Math.random() * 6; // supaya dua gasing tidak bergerak kompak
  let first = true;

  function render(now) {
    if (disposed) return;
    const t = now + phase;
    const dt = lastNow == null ? 0.016 : Math.min(0.1, Math.max(0.001, now - lastNow));
    lastNow = now;
    curNow = now;
    const hp = (now - hopStart) / 0.75;
    let hy = 0, sq = 0;
    if (hp >= 0 && hp < 1) {
      hy = Math.sin(hp * Math.PI) * 0.9;
      sq = hp < 0.12 ? -Math.sin((hp / 0.12) * Math.PI) * 0.12 : Math.sin(((hp - 0.12) / 0.88) * Math.PI) * 0.08 * (1 - hp);
    }
    root.position.y = Math.sin(t * 1.5) * 0.09 * amp + hy;
    root.position.x = Math.sin(t * 0.5) * 0.06 * amp;

    // ---- arah hadap: ikut arah kecepatan (ambang + timeout → diam = arah terakhir), jalur sudut terpendek, laju putar dibatasi
    {
      const spd = now - mvAt < MOVE_TIMEOUT ? Math.hypot(mvR, mvT) : 0;
      moveSpd += (spd - moveSpd) * (1 - Math.exp(-dt * 8));
      if (spd > MOVE_MIN_SPEED) headingT = Math.atan2(mvR, mvT);
      if (stateName === 'eat') headingT = 0;        // sequence makan soto: menghadap kamera (putar lewat sudut terpendek); setelahnya ikut gerak lagi
      const d = wrapPI(headingT - heading);
      const step = clampN(d * (1 - Math.exp(-dt * TURN_RATE)), -TURN_MAX_SPEED * dt, TURN_MAX_SPEED * dt);
      heading = wrapPI(heading + step);
      root.rotation.y = heading;
      handRig.rotation.y = heading - yaw;          // pose tangan dirancang pada yaw awal → putar rig sebesar selisihnya
      handRig.updateMatrixWorld(true);
      const kT = moveSpd > MOVE_MIN_SPEED ? clampN(moveSpd / WALK_REF_SPEED, SWING_SPEED_K[0], SWING_SPEED_K[1]) : 1;
      speedK += (kT - speedK) * (1 - Math.exp(-dt * 4));
    }

    // bobot tiap state (halus berpindah): idle = sisanya
    wWalk = clampN(critDamp(sWalk, stateName === 'walk' ? 1 : 0, STATE_OMEGA, dt), 0, 1);
    wEat = clampN(critDamp(sEat, stateName === 'eat' ? 1 : 0, STATE_OMEGA, dt), 0, 1);
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
      // held (punggung) → lowering → down (lantai) → raising → held. Progres bt 0..1 berbasis dt, bisa berbalik di tengah jalan.
      const C = carry, want = stateName === 'eat';
      // progres dihitung dari JAM (bukan akumulasi dt yang dibatasi) → tetap tepat waktu walau frame lambat / tab sempat di latar
      if (C.want !== want) { C.want = want; C.bt0 = C.bt; C.t0 = now; }
      C.bt = clampN(C.bt0 + (now - C.t0) * (want ? 1 / BAG_DOWN_T : -1 / BAG_UP_T), 0, 1);
      C.phase = C.bt >= 1 ? 'down' : C.bt <= 0 ? 'held' : want ? 'lowering' : 'raising';
      wGround = smooth01(C.bt); bagDown = C.bt >= 1;
      C.wGround = wGround;
    }
    const kProp = 1 - Math.exp(-dt * 10);
    stepGestures(dt, stateName === 'idle' && wWalk < 0.05 && wEat < 0.05 && !hpOn);

    // ---- Makan: jam berjalan hanya saat tas sudah diletakkan (atau tidak membawa tas); fase u dalam siklus EAT_T
    const eatGo = stateName === 'eat' && (!carry || carry.phase === 'down');
    if (eatGo) eatT += dt; else if (stateName !== 'eat') eatT = 0;
    const eu = (eatT % EAT_T) / EAT_T;
    // SFX makan, disinkronkan dengan fase koreografi: sendok menyendok di mangkuk (u ≈ 0.04) · sendok sampai di mulut (u ≈ 0.55)
    if (eatGo && el.isConnected) {
      const pu = prevEu;
      if (pu < 0.04 && eu >= 0.04) sfx(spoonFlip ? 'spoon_a' : 'spoon_b'), (spoonFlip = !spoonFlip);
      if (pu < 0.55 && eu >= 0.55) { sfx('nom'); el.dispatchEvent(new CustomEvent('spoonmouth')); }   // sendok sampai di mulut (u ≈ 0.55): scene 3 memakainya untuk memunculkan gelembung pertama
    }
    prevEu = eatGo ? eu : 0;
    mouthA.getWorldPosition(mouthW);               // titik mulut DUNIA (ikut tilt badan, yaw, dan loncatan)
    const mB = handRig.worldToLocal(_mB.copy(mouthW)).sub(root.position);   // titik mulut di kerangka rig tangan (ikut arah hadap)
    _mS.copy(mB); _mS.x *= -BOWL_SIDE;               // titik mulut di kerangka (RF) tangan sendok
    const es = eatSpoon(eu, _mS), eb = eatBowl(eu);

    // kompensasi sudut kamera: cari tinggi dunia tangan kiri yang membuat proyeksinya sejajar dengan tangan kanan di layar (pose istirahat)
    let levelDy = 0;
    if (SCREEN_LEVEL) {
      _lv.set(HAND_REST.x, HAND_REST.y, HAND_REST.z); handRig.localToWorld(_lv).project(camera); const ya = _lv.y;
      _lv.set(-HAND_REST.x, HAND_REST.y, HAND_REST.z); handRig.localToWorld(_lv).project(camera); const y0 = _lv.y;
      _lv.set(-HAND_REST.x, HAND_REST.y + 1, HAND_REST.z); handRig.localToWorld(_lv).project(camera); const y1 = _lv.y;
      if (Number.isFinite(ya + y0 + y1) && Math.abs(y1 - y0) > 1e-6) levelDy = clampN((ya - y0) / (y1 - y0), -SCREEN_LEVEL_MAX, SCREEN_LEVEL_MAX) * SCREEN_LEVEL;
    }

    hands.forEach((H, hi) => {
      const p = H.ph, s = H.side;
      const holdBag = false;                        // tas ada di punggung: tangan tidak pernah memegang tas
      const calm = holdBag ? 0.35 : 1;
      const r0 = holdBag ? CARRY_R : ARM;           // tangan pembawa tas diangkat: dasar tas tidak boleh tembus lantai
      let fw = 0, lat = 0, rr = 0, wx = 0, wz = 0, clos = 0;

      // idle: tangan menggantung di sisi badan, bergoyang pelan seperti bandul; jari "bernapas"
      fw += Math.sin(t * 1.3 + p) * 0.03 * amp;
      lat += Math.sin(t * 0.9 + p * 1.7) * 0.02 * amp;
      clos += Math.sin(t * 1.1 + p) * 0.015 * amp;

      // walk: bandul maju-mundur di sekitar bahu virtual (lintasan busur U), kiri-kanan berlawanan fase;
      // pergelangan tertinggal, kepalan sedikit mengendur lalu mengencang
      if (wWalk > 0.001) {
        const ph = t * WALK_W + (s > 0 ? 0 : Math.PI);
        const A = WALK_AMP * amp * calm * wWalk * speedK, sw = Math.sin(ph);   // amplitudo mengikuti kecepatan jalan
        fw += A * sw;
        lat += wWalk * calm * Math.sin(ph - 0.3) * 0.035 * amp;
        wx += -(A * Math.sin(ph - 0.55) - A * sw) * 0.8;
        wz += wWalk * Math.sin(ph - 0.9) * 0.08 * amp;
        clos -= wWalk * Math.sin(ph - 1.1) * 0.04 * amp;
      }

      // makan: tangan BOWL_SIDE = mangkuk di dalam tangan (kalau membawa tas: tas diletakkan dulu), tangan lainnya = sendok
      const bowlReady = carry ? (bagDown ? 1 : 0) : 1;   // mangkuk & sendok baru diambil setelah tas sampai di lantai
      H.ready = clampN(critDamp(H.readyS, bowlReady, STATE_OMEGA, dt), 0, 1);
      const eW = wEat * (carry ? H.ready : 1);
      H.eW = eW;

      // hop: tangan terlempar naik & mengembang di udara (jari merentang), lalu turun saat mendarat
      const jAmp = (holdBag ? 0.5 : 1) * (1 - reach) * (1 - eW * 0.6) * (1 - wWalk);   // saat berjalan: hanya gestur tangan "Walk", tanpa overlay hop (jempol ngebug)
      rr -= (jUp * 0.55 - jLand * 0.2) * jAmp;
      lat += jUp * 0.15 * jAmp;
      clos -= jUp * 0.5 * jAmp;
      if (holdBag) { wz += wShake * 0.18; rr -= wShake * 0.07; }

      // menggapai tas di tanah (meletakkan / mengangkat): terowongan genggaman tepat di atas tali tas
      if (holdBag && reach > 0.001) {
        const C = carry;
        handRig.worldToLocal(_fd.set(C.restX - H.tunOff.x, BAG_FLOOR_Y - H.tunOff.y, C.restZ - H.tunOff.z)).sub(root.position);   // dunia → kerangka rig
        toPolar(s * _fd.x, _fd.y, _fd.z, polR);
        fw = mix(fw, polR.fw, reach); lat = mix(lat, polR.lat, reach); rr = mix(rr, polR.r - r0, reach);
        wx *= 1 - reach; wz *= 1 - reach;
      }

      // ---- Layer gestur (aditif di atas state) + pegas under-damped di ruang polar bahu → gerak berbusur.
      // Tangan kiri yang masih memegang tas hanya boleh micro-adjust; tangan berproperti (mangkuk/sendok) bergerak lebih kecil.
      const lockL = holdBag && carry.phase !== 'down';
      const grip = holdBag ? 1 : eW;
      const mot = (lockL ? G_LOCK_MOT : 1) * (1 - 0.6 * H.propW), fin = (lockL ? G_LOCK_FIN : 1) * (s === BOWL_SIDE ? 1 - sstep(0, 0.35, eW) : 1);   // tangan mangkuk: jari lepas dari gestur saat mulai memegang
      acc.fill(0);
      let qi = 0;                                    // pose orientasi dari gestur yang sedang berlaku untuk tangan ini
      // gestur "ruang layar" (menunjuk): arah dibaca relatif KAMERA, bukan arah hadap badan → selalu terbaca dari sudut mana pun
      const scr = Math.min(1, screenW(ga, hi) + screenW(gb, hi));
      if (ga && addGesture(ga, hi, mot, fin) && ga.w > 0.02) qi = ga.def.qi;
      if (gb && addGesture(gb, hi, mot, fin) && !qi && gb.w > 0.02) qi = gb.def.qi;
      if (gf && addGesture(gf, hi, mot, fin) && !qi && gf.w > 0.02) qi = gf.def.qi;

      const P = H.p, V = H.v, T = H.t;
      T[0] = clampN(fw + acc[0], LIM.fw[0], LIM.fw[1]);
      T[1] = clampN(lat + acc[1], LIM.lat[0], LIM.lat[1]);
      T[2] = clampN(r0 + rr + acc[2], LIM.r[0], LIM.r[1]);
      const wl = lockL ? LIM.wLock : LIM.w;
      T[3] = clampN(wx + acc[3], -wl, wl); T[4] = clampN(acc[4], -wl, wl); T[5] = clampN(wz + acc[5], -wl, wl);
      T[6] = clampN(acc[6], -1.6, 1.6); T[18] = clampN(acc[18], -1.6, 1.6); T[17] = clampN(acc[17], -1.6, 1.6);
      T[19] = clampN(acc[19], 0, 1.05);
      T[7] = acc[7];
      const drag = clampN(V[5] * 0.05, -0.2, 0.2);   // jari terseret oleh gerak pergelangan (follow-through)
      for (let i = 0; i < 4; i++) {
        const k0 = REST_K[hi][i] + clos;
        T[C_CLOSE + i] = clampN(k0 + acc[C_CLOSE + i] + drag * (0.3 + 0.2 * i), -0.2, 1.12);
        T[C_MID + i] = clampN(k0 + acc[C_MID + i] + drag * (0.2 + 0.15 * i), -0.2, 1.12);   // ruas tengah menyusul pangkal
        T[C_TIP + i] = clampN(k0 + acc[C_TIP + i], -0.2, 1.12);      // ruas ujung menekuk lebih lambat (ω lebih kecil) → menyusul
      }
      T[12] = Math.min(0.09, H.spd * 0.012) * amp + acc[12];     // squash dari kecepatan
      if (!H.init) { H.init = true; for (let c = 0; c < NCH; c++) { P[c] = T[c]; V[c] = 0; } }
      const zA = ZETA[0] + (Z_GRIP - ZETA[0]) * grip, zW = ZETA[3] + (0.8 - ZETA[3]) * grip;
      for (let c = 0; c < NCH; c++) springChannel(P, V, T, c, OMEGA[c], c < 3 ? zA : c < 6 ? zW : ZETA[c], dt);
      H.spd += (Math.hypot(V[0] * P[2], V[1] * P[2], V[2]) - H.spd) * (1 - Math.exp(-dt * 12));

      // ---- posisi (RF) dari bahu virtual + orientasi: pose gantung (pitch mengikuti lengan) → pose gestur → offset dunia
      fromPolar(P[0], P[1], P[2], pos3);
      if (eW < 0.5) pushOutOfBody(pos3);            // tangan tidak menembus badan (pose makan sengaja di depan badan)
      {   // jangkauan: tangan tetap dekat badan (batas lunak); tidak berlaku saat makan / menggapai tas
        const dx = pos3.x, dy = pos3.y - (0.6 + STEM_EXTRA), dz = pos3.z, d = Math.hypot(dx, dy, dz), k0 = HAND_REACH_MAX - HAND_REACH_SOFT;
        if (d > k0) {
          const dn = HAND_REACH_MAX - HAND_REACH_SOFT * Math.exp(-(d - k0) / HAND_REACH_SOFT);
          const f = 1 + (dn / d - 1) * (1 - Math.max(eW, reach));
          pos3.x = dx * f; pos3.y = (0.6 + STEM_EXTRA) + dy * f; pos3.z = dz * f;
        }
      }
      H.qp.slerp(QP[qi], 1 - Math.exp(-dt * 12));
      qA.setFromAxisAngle(AX_X, -0.9 * P[0]).multiply(Q_HANG);
      qA.slerp(H.qp, clampN(P[19], 0, 1.05));
      qFin.setFromEuler(_eu.set(P[6], P[18], P[17])).multiply(qA);

      if (eW > 0.001) {
        // pose makan (kerangka badan → RF): kanan = sendok dengan kepala di mulut, kiri = mangkuk di dalam tangan
        const e = s === BOWL_SIDE ? eb : es;        // keduanya sudah dalam RF tangan masing-masing
        pos3.x = mix(pos3.x, e.pos.x, eW); pos3.y = mix(pos3.y, e.pos.y, eW); pos3.z = mix(pos3.z, e.pos.z, eW);
        qFin.slerp(e.q, eW);
      }
      // gerak sekunder: titik ikut-badan mengejar root.position lewat pegas (sedikit tertinggal & overshoot halus), dibatasi FOLLOW_MAX.
      // Saat makan / menggapai tas tangan harus tepat di mulut / tali → kembali kaku ke badan.
      if (!H.finit) { H.finit = true; H.fp.copy(root.position); H.fv.set(0, 0, 0); }
      {
        const n = Math.min(14, Math.ceil(dt / 0.008)), h = dt / n, k = FOLLOW_OMEGA * FOLLOW_OMEGA, c = 2 * FOLLOW_ZETA * FOLLOW_OMEGA;
        for (let i = 0; i < n; i++) {
          H.fv.x += ((root.position.x - H.fp.x) * k - H.fv.x * c) * h; H.fp.x += H.fv.x * h;
          H.fv.y += ((root.position.y - H.fp.y) * k - H.fv.y * c) * h; H.fp.y += H.fv.y * h;
          H.fv.z += ((root.position.z - H.fp.z) * k - H.fv.z * c) * h; H.fp.z += H.fv.z * h;
        }
        _fd.copy(H.fp).sub(root.position);
        const L = _fd.length();
        if (!Number.isFinite(L)) { H.fp.copy(root.position); H.fv.set(0, 0, 0); _fd.set(0, 0, 0); }
        else if (L > FOLLOW_MAX) { _fd.multiplyScalar(FOLLOW_MAX / L); H.fp.copy(root.position).add(_fd); }
        _fd.multiplyScalar(1 - Math.max(eW, reach));   // kaku saat makan / menggapai tas
      }
      const lvl = hi === 0 && !holdBag ? levelDy * (1 - Math.max(eW, reach)) : 0;   // tidak saat makan / menggapai / menjinjing tas
      H.holder.position.set(pos3.x + s * (root.position.x + _fd.x), pos3.y + root.position.y + _fd.y + lvl, pos3.z + root.position.z + _fd.z);
      H.holder.quaternion.copy(qFin);
      if (scr > 0.001 && Math.abs(handRig.rotation.y) > 1e-4) {   // batalkan putaran arah hadap untuk tangan yang menunjuk (tangan kiri: ruang cermin → arah putar terbalik)
        const a = -s * handRig.rotation.y * scr;
        _qy.setFromAxisAngle(AX_Y, a);
        H.holder.position.applyAxisAngle(AX_Y, a);
        H.holder.quaternion.premultiply(_qy);
      }
      H.wrist.rotation.set(P[3], P[4], P[5]);
      const sqz = clampN(P[12], -0.15, 0.15) * (s === BOWL_SIDE ? 1 - eW : 1);   // tangan pemegang mangkuk tidak ikut squash (mangkuk anak tangan)
      H.wrist.scale.set(1 + sqz, 1 - sqz * 0.5, 1 - sqz * 0.5);   // squash & stretch, volume terjaga

      // jari: closure per jari (telunjuk dulu, jempol paling akhir; ruas ujung lebih lambat) → sudut ruas
      const kk = P.subarray(C_CLOSE, C_CLOSE + 4), km = P.subarray(C_MID, C_MID + 4), kt = P.subarray(C_TIP, C_TIP + 4);
      applyPose(H, kk, kt, P[7], s !== BOWL_SIDE ? eW : 0, km);
      if (s === BOWL_SIDE && eW > 0.001) blendBowlGrip(H, eW);
      else if (s === BOWL_SIDE) H.G.thumb.base.position.copy(THUMB_POS0);   // pegangan mangkuk: sudut hasil bake, satu bobot dengan mangkuk
      H.holder.updateMatrixWorld(true);

      // titik genggam (terowongan) relatif ke pusat tangan — dipakai saat menggapai tas
      H.tun.getWorldPosition(local); H.G.root.getWorldPosition(_pw);
      H.tunOff.copy(local).sub(_pw);

      // properti: sendok (tangan kanan) muncul halus saat makan; mangkuk (anak tangan kiri) memakai bobot eW yang SAMA dengan
      // pose jari & posisi tangan → tidak ada selisih waktu antara tangan dan mangkuk saat masuk/keluar
      if (H.spoon) {
        const propT = stateName === 'eat' ? (carry ? (bagDown ? 1 : 0) : 1) : 0;
        H.propW += (propT - H.propW) * kProp;
        H.spoon.visible = H.propW > 0.02; H.spoon.scale.setScalar(Math.max(0.001, sstep(0, 1, H.propW)));
        H.spoon.userData.scoop.visible = eu > 0.14 && eu < 0.62;   // kuah di sendok: ada setelah menyendok, hilang saat di mulut
      } else {
        H.propW = eW;
        const bw = sstep(BOWL_APPEAR, 1, eW);       // mangkuk baru muncul/membesar setelah tangan hampir di tempatnya (sebelum itu tangan melintasi bibir badan)
        H.bowl.visible = bw > 0.02; H.bowl.scale.setScalar(Math.max(0.001, bw) * BOWL_S * BOWL_EAT_K / GS);
        setThumbOverlay(H, H.bowl.visible);
      }
    });

    // mulut terbuka & kunyah saat makan (mengikuti koreografi sendok); kembali tersenyum setelahnya
    {
      const eWr = smooth01(hands[1].eW), mo = mouthOpenAt(eu) * eWr, ch = chewAt(eu) * eWr;
      setMouth(mo);
      body.scale.set(1 - ch * 0.015, 1 + ch * 0.03, 1 - ch * 0.015);
    }

    // tas: menggantung dari genggaman sarung tangan kiri, berayun seperti bandul — atau diletakkan di tanah
    if (carry) {
      // target: punggung (di belakang arah hadap) ⇄ lantai (samping-belakang kiri), dicampur w + busur kecil; lalu disusul dengan lag halus
      const C = carry, w = C.wGround;
      // arah tas menyusul arah hadap (jalur terpendek), tapi tertinggal paling jauh BAG_LAG_MAX
      C.head += wrapPI(heading - C.head) * (1 - Math.exp(-dt * BAG_FOLLOW));
      C.head = heading + clampN(wrapPI(C.head - heading), -BAG_LAG_MAX, BAG_LAG_MAX);
      if (!C.init) { C.init = true; C.rp.copy(root.position); }
      C.rp.lerp(root.position, 1 - Math.exp(-dt * BAG_FOLLOW));       // ikut naik-turun / loncat badan dengan lag halus
      // posisi dalam koordinat POLAR di sekitar sumbu badan (sudut & jari-jari dicampur, bukan garis lurus):
      // jalur punggung ⇄ lantai melingkar di luar badan dan di luar jangkauan tangan, tidak memotong badan saat berbelok
      bagSideNow += (bagSideTo - bagSideNow) * (1 - Math.exp(-dt * BAG_SIDE_RATE));
      if (Math.abs(bagSideTo - bagSideNow) < 1e-3) bagSideNow = bagSideTo;
      const aBack = Math.PI + bagSideNow, rBack = BAG_BACK.dist;   // bagSide (rad, opsi createGasing3D / setBagSide): geser tas ke samping badan supaya terlihat saat menghadap kamera (+ = kiri layar)
      const aFloor = Math.atan2(BAG_FLOOR_POS.x, BAG_FLOOR_POS.z), rFloor = Math.hypot(BAG_FLOOR_POS.x, BAG_FLOOR_POS.z);
      // sudut tas RELATIF terhadap arah hadap (lag terbatas + transisi ke lantai); tangan ikut berputar dengan badan, jadi selama
      // sudut relatif ini dijaga di sektor punggung, tas tidak pernah masuk jalur tangan — termasuk saat belok tajam
      let a = heading + aBack + wrapPI(C.head - heading) + wrapPI(aFloor - aBack) * w;
      const r = mix(rBack, rFloor, w);
      // tas menghindari tangan yang mendekat (sudut di sekeliling badan), selalu menghindar ke arah punggung (tidak berbalik sisi)
      const handSep = BAG_HAND_SEP * mix(1, BAG_SIDE_SEP_K, clampN(Math.abs(bagSideNow) / 0.5, 0, 1));   // tas yang sengaja digeser ke samping (bagSide) boleh lebih dekat ke tangan (jarak aslinya tetap lega); kontinu terhadap bagSide → tanpa lompatan saat sisi berubah
      for (const H of hands) {
        H.G.root.getWorldPosition(_lv);
        const hx = _lv.x - C.rp.x, hz = _lv.z - C.rp.z;
        if (Math.hypot(hx, hz) < 1.2) continue;          // tangan di depan badan (makan, gestur dekat wajah) tidak di jalur tas
        const ah = Math.atan2(hx, hz), d = wrapPI(a - ah);
        if (Math.abs(d) < handSep) a = ah + Math.sign(wrapPI(heading + aBack - ah) || 1) * handSep;
      }
      const rel = wrapPI(a - heading);
      if (C.rel == null) C.rel = rel;
      C.rel += wrapPI(rel - C.rel) * (1 - Math.exp(-dt * BAG_FOLLOW * 2));   // dihaluskan di kerangka badan (tanpa lompatan)
      a = heading + C.rel;
      const arc = Math.sin(Math.PI * w) * BAG_ARC;
      C.tp.set(C.rp.x + Math.sin(a) * r, mix(BAG_BACK.y + C.rp.y, BAG_FLOOR_Y, w) + arc, C.rp.z + Math.cos(a) * r);
      C.swing.position.copy(C.tp);
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
      C.yawG.rotation.y = C.head + BAG_YAW + (Math.sin(t * 0.9 + 2) * 0.08 * amp + C.th * 0.5) * k;   // tas ikut arah hadap (dengan lag)
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
    const kGaze = 1 - Math.exp(-dt * 7.7);
    eyes.forEach((e) => {
      e.anchor.getWorldPosition(local).addScaledVector(look, 60);
      e.anchor.worldToLocal(local).normalize();
      e.gaze[0] += (local.x * 1.8 - e.gaze[0]) * kGaze;   // berbasis dt (= 0.12 per frame di 60 Hz)
      e.gaze[1] += (local.y * 1.8 - e.gaze[1]) * kGaze;
      placePupil(e);
    });

    renderer.render(scene, camera);
    if (first) { first = false; canvas.classList.add('is-ready'); }
  }

  function dispose() {
    disposed = true;
    finishG(ga, true); finishG(gb, true);       // onDone tepat sekali, tidak ada callback ke instance mati
    ga = gb = gf = null;
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

  // info() dipakai __gasingDebug (?debug): posisi tangan (dunia model), apakah semua nilai finite, gestur aktif
  const info = () => ({
    gesture: ga?.name ?? null, fidget: gf?.name ?? null, state: stateName, disposed,
    heading: +heading.toFixed(3), headingTarget: +headingT.toFixed(3), speed: +moveSpd.toFixed(3), swingK: +speedK.toFixed(3),
    finite: hands.every((H) => H.p.every(Number.isFinite) && Number.isFinite(H.holder.position.x + H.holder.position.y + H.holder.position.z)),
    hands: hands.map((H) => { H.G.root.getWorldPosition(_pw); return [_pw.x, _pw.y, _pw.z].map((n) => +n.toFixed(3)); }),
    tunnel: hands.map((H) => { H.tun.getWorldPosition(_pw); return [_pw.x, _pw.y, _pw.z].map((n) => +n.toFixed(3)); }),
    bowlBodyGap: (() => {   // jarak bebas terkecil permukaan mangkuk → badan (bibir + dasar gelap, model sederhana di ruang lokal badan, ikut kemiringan). > 0 = tidak menembus
      const H = hands.find((h) => h.bowl); if (!H.bowl.visible) return null;
      let m = 1e9;
      const add = (lx, ly, lz) => {   // titik mangkuk (lokal mangkuk, skala sudah di-bake di H.bowl) → ruang lokal badan
        _lv.set(lx, ly, lz); H.bowl.localToWorld(_lv); body.worldToLocal(_lv);
        const { x, y, z } = _lv;
        const lip = (Math.hypot(x / 2.26, z / 2.0) - 1) * 2.0;                                  // bibir (pendekatan: elips 2.26 × 2.0)
        const un = (Math.sqrt((x / 2.0) ** 2 + ((y + 0.04) / 1.2) ** 2 + (z / 1.75) ** 2) - 1) * 1.75;   // bagian bawah (elipsoid)
        const g = y > -0.25 && y < 0.33 ? Math.min(lip, y < -0.04 ? un : lip) : (y <= -0.25 ? un : 9);
        if (g < m) m = g;
      };
      for (let i = 0; i < 36; i++) { const a = i / 36 * 6.2832; add(0.7 * Math.cos(a), 0, 0.7 * Math.sin(a)); }                     // bibir
      for (let j = 1; j <= 4; j++) for (let i = 0; i < 24; i++) { const th = j / 4 * 1.5708, a = i / 24 * 6.2832; add(0.7 * Math.cos(a) * Math.cos(th), -0.48 * Math.sin(th), 0.7 * Math.sin(a) * Math.cos(th)); }   // dinding bawah
      return +m.toFixed(3);
    })(),
    spoonHandBowlGap: (() => {   // jarak bebas terkecil tangan sendok (bola r ≈ 0.6·GS) → permukaan mangkuk; > 0 = tidak menyentuh
      const Hb = hands.find((h) => h.bowl), Hs = hands.find((h) => h.spoon); if (!Hb.bowl.visible) return null;
      Hs.G.root.getWorldPosition(_lv); Hb.bowl.worldToLocal(_lv);
      const x = _lv.x, y = _lv.y, z = _lv.z, h = Math.hypot(x, z), d = y > 0 ? (h < 0.7 ? y : Math.hypot(h - 0.7, y)) : (Math.sqrt((x / 0.7) ** 2 + (y / 0.48) ** 2 + (z / 0.7) ** 2) - 1) * 0.7;
      return +(d * BOWL_S * BOWL_EAT_K - 0.6 * GS).toFixed(3);
    })(),
    bowl: (() => {   // pegangan mangkuk: bobot, kedalaman tembus hasil bake (harus ≈ 0), posisi mangkuk relatif telapak (lokal, harus konstan)
      const H = hands.find((h) => h.bowl), f = H.G.fingers[0].base.quaternion, rel = H.hand.worldToLocal(H.bowl.getWorldPosition(new V3()));
      return { grip: +H.eW.toFixed(3), visible: H.bowl.visible, scale: +H.bowl.scale.x.toFixed(3), maxPenetration: +GRIP.maxPen.toFixed(4), blockedFingers: GRIP.blocked, palmDrop: +GRIP.drop.toFixed(2), thumbSoto: { ...THUMB_SOTO },
        rel: [rel.x, rel.y, rel.z].map((n) => +n.toFixed(4)), indexQ: [f.x, f.y, f.z, f.w].map((n) => +n.toFixed(4)),
        thumbQ: [H.G.thumb.base, H.G.thumb.mid, H.G.thumb.tip].map((g) => [g.quaternion.x, g.quaternion.y, g.quaternion.z, g.quaternion.w].map((n) => +n.toFixed(4))) };
    })(),
    eat: (() => {   // jarak kepala sendok ke titik mulut (dunia) — harus ≤ 0.15 saat sendok di mulut
      const sp = hands.find((h) => h.spoon)?.spoon; if (!sp || !sp.visible) return null;
      sp.userData.head.getWorldPosition(_pw); mouthA.getWorldPosition(mouthW);
      return { u: +((eatT % EAT_T) / EAT_T).toFixed(3), headToMouth: +_pw.distanceTo(mouthW).toFixed(3) };
    })(),
    bag: carry ? (() => {   // fase tas + pusat badan tas (dunia) + jarak bebas terkecil ke tangan & badan (perkiraan kotak → bola)
      const c = carry.bagG.localToWorld(new V3(0, BAG_DIMS.BH / 2, 0)), half = [BAG_DIMS.BW / 2, BAG_DIMS.BH / 2, BAG_DIMS.BD / 2].map((v) => v * BAG_S);
      const toLocal = (p) => carry.bagG.worldToLocal(p.clone()).sub(new V3(0, BAG_DIMS.BH / 2, 0)).multiplyScalar(BAG_S);
      const boxDist = (p) => { const q = toLocal(p); return Math.hypot(Math.max(0, Math.abs(q.x) - half[0]), Math.max(0, Math.abs(q.y) - half[1]), Math.max(0, Math.abs(q.z) - half[2])); };
      const handGap = Math.min(...hands.map((H) => boxDist(H.G.root.getWorldPosition(new V3())) - 0.6 * GS));
      return { phase: carry.phase, th: +carry.th.toFixed(3), center: [c.x, c.y, c.z].map((n) => +n.toFixed(2)), handGap: +handGap.toFixed(3), bottomY: +(carry.bagG.getWorldPosition(new V3()).y).toFixed(3) };
    })() : null,
  });
  // setView(azimut°, elevasi°) memutar kamera mengelilingi karakter (0,0 = dari depan); tanpa argumen = kamera game
  const setView = (az, elv = 0, zoom = 1, tgt = null) => {
    viewZoom = zoom; viewTarget.copy(tgt ? new V3(tgt[0], tgt[1], tgt[2]) : TARGET);
    if (az == null) { viewDir.copy(HOME_DIR); viewZoom = 1; viewTarget.copy(TARGET); }
    else { const a = az * Math.PI / 180, e = elv * Math.PI / 180; viewDir.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)); }
    resize();
  };
  /** Posisi mulut tas aktual relatif kotak elemen (satuan sama dengan bagMouthOffset()); null kalau tidak membawa tas. */
  const bagMouth = (aspect = el.clientWidth / el.clientHeight || 1000 / 1193) => {
    if (!carry) return null;
    const vis = Math.max(FIT_H, FIT_W / aspect), p = carry.swing.position;
    const x = p.x - BAG_DIMS.HANDLE_X * BAG_S, y = p.y - BAG_DIMS.HANDLE_H * BAG_S;
    return { x: x / vis, y: (y - (TARGET_Y - vis / 2)) / vis };
  };
  const inst = { el, seen: false, born: performance.now(), render, dispose, hop, wobble, setState, gesture, info, setView, move, bagMouth, setBagSide };
  return inst;
}
