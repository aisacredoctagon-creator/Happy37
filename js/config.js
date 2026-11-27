// ============================================================
//  KONFIGURASI CERITA
//  Semua teks, kode koper, dan path aset ada di sini.
//  Aset 2D otomatis dicari di path yang tertulis; kalau file
//  belum ada, website menampilkan placeholder berlabel.
// ============================================================

const LOREM = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
  'Nisi ut aliquip ex ea commodo consequat duis aute irure dolor.',
  'In reprehenderit in voluptate velit esse cillum dolore eu fugiat.',
  'Nulla pariatur excepteur sint occaecat cupidatat non proident.',
  'Sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Curabitur pretium tincidunt lacus, nulla gravida orci a odio.',
];

export const CONFIG = {
  recipient: 'Pak Bram',

  ticket: {
    name: 'Pak Bram',
    date: '30 NOV 2026',
    from: 'Stasiun Gambir',
    fromCity: 'Jakarta',
    to: 'Stasiun Pasarturi',
    toCity: 'Surabaya',
    train: 'InterCity 225',
    seat: 'TO-37 / 1A',
    passengerType: 'Suite Class',
  },

  // Kode gembok koper (Scene 5)
  lockCode: [1, 2, 3, 4],

  // Minimal derajat putaran kereta sebelum tombol "Tutup" muncul (Scene 10)
  rotateThresholdDeg: 300,

  // Narasi per scene
  captions: {
    1: 'Sebuah tiket kereta menuju Surabaya. Ketuk tiketnya untuk berangkat!',
    2: 'Dari jendela kereta, landmark Surabaya mulai terlihat…',
    3: 'Sampai di Surabaya! Waktunya makan soto Ambengan dulu. Ketuk gerobaknya.',
    s3_kenyang: 'Kenyang! Sekarang mampir ke toko antik di seberang. Ketuk tokonya.',
    4: 'Di dalam toko antik… ada koper tua di etalase. Ketuk kopernya.',
    5: 'Kopernya terkunci. Ketuk bagian atas / bawah roda angka untuk mengubah kode.',
    6: 'Terbuka! Ada 9 bagian kereta dan cetakannya. Ketuk salah satu bagian.',
    7: 'Ada tanda merah kecil di bagian ini… ada tulisan terukir di sana. Zoom sedekat-dekatnya!',
    8: 'Tulisannya terukir di logam. Setelah selesai membaca, tutup (✕) untuk memasang bagian ini ke cetakan.',
    9: 'Keretanya jadi! Geser / drag untuk memutarnya 360°.',
    10: 'Arahkan kursor ke bagian kereta, lalu ketuk untuk membaca suratnya. Kalau sudah puas, tutup kopernya.',
    // transisi 10 → 11 (kamera mundur dari koper, Gasing datang membawa tas tenisnya)
    t11: 'Kopernya kembali tertutup. Gasing datang menenteng tas tenisnya…',
    11: 'Eh… bola tenis di tas Gasing jatuh dan menggelinding!',
    12: 'Bolanya berhenti di dekat TV tua…',
  },

  // 9 bagian kereta (Scene 6–8). `text` = 8 kalimat yang muncul saat di-zoom.
  parts: [
    { id: 'loco-roof',   name: 'Atap Lokomotif',   text: LOREM },
    { id: 'car1-roof',   name: 'Atap Gerbong 1',   text: LOREM },
    { id: 'car2-roof',   name: 'Atap Gerbong 2',   text: LOREM },
    { id: 'loco-body',   name: 'Badan Lokomotif',  text: LOREM },
    { id: 'car1-body',   name: 'Badan Gerbong 1',  text: LOREM },
    { id: 'car2-body',   name: 'Badan Gerbong 2',  text: LOREM },
    { id: 'loco-wheels', name: 'Roda Lokomotif',   text: LOREM },
    { id: 'car1-wheels', name: 'Roda Gerbong 1',   text: LOREM },
    { id: 'car2-wheels', name: 'Roda Gerbong 2',   text: LOREM },
  ],

  // Path aset. Ganti file di folder /assets dengan nama yang sama
  // (atau ubah path di sini). Yang belum ada → placeholder.
  assets: {
    gasing: 'assets/characters/gasing.png',

    // Scene 0 (halaman pembuka) — lapisan hasil bedah Figma "Frame 3" (1779×891), lihat js/scene0.js
    s0: {
      sky: 'assets/scene0/sky.png',
      clouds: ['assets/scene0/cloud-1.png', 'assets/scene0/cloud-2.png', 'assets/scene0/cloud-3.png'],
      treeL: 'assets/scene0/tree-left.png',
      treeR: 'assets/scene0/tree-right.png',
      skyline: 'assets/scene0/skyline.png',   // gedung kota + Monas di kanan
      train: 'assets/scene0/train.png',       // kereta di peron kanan (menghadap kanan)
      platform: 'assets/scene0/platform-wide.png', // atap peron + pagar putih (di depan kereta)
      station: 'assets/scene0/station.png',   // gedung Stasiun Gambir
      treeBush: 'assets/scene0/tree-bush-left.png',
      street: 'assets/scene0/street.png',     // trotoar + jalan + zebra cross
      planter: 'assets/scene0/planter.png',   // pot semak kanan
      plaque: 'assets/scene0/plaque.png',     // plakat biru "Sebuah perjalanan kecil untuk Pak Bram" + pin lokasi
      button: 'assets/scene0/button.png',     // tombol kuning "Mulai Perjalanan →"
      bus: 'assets/scene0/bus.png',           // bus yang sesekali lewat (menghadap kiri)
    },

    // Scene 1 berlapis (hasil bedah): langit → awan bergerak pelan → stasiun (PNG/WebP, langit transparan)
    s1_sky: 'assets/scene1/Sky.png',
    s1_clouds: ['assets/scene1/cloud-1.png', 'assets/scene1/cloud-2.png', 'assets/scene1/cloud-3.png'],
    s1_fg: 'assets/scene1/bg-stasiun5.webp',
    s1_signage: 'assets/scene1/signage-blank.png', // panel papan digital kosong (teks LED dianimasikan lewat HTML/CSS)
    s1_logo: 'assets/scene1/logo-gasing-railways.webp', // logo di kepala tiket (latar putih → di-multiply ke kertas)

    s2_parallax: 'assets/scene2/parallax/', // folder sprite parallax Surabaya (hasil bedah dari Figma)
    s2_room: 'assets/scene2/train-inside.png', // interior kereta, jendela transparan (1671×941); tali pegangan sudah dilepas (lihat s2_straps)
    s2_straps: [1, 2, 3, 4].map((n) => `assets/scene2/train-strap-${n}.png`), // 4 pegangan tangan (tali+segitiga) terpisah, diayun lewat CSS

    s2_bottle: 'assets/scene2/bottle.webp', // botol minum di meja bawah jendela kereta
    s2_poster_math: 'assets/scene2/poster-math.webp',     // poster "Kelas Matematika Dasar" (1024×1536) → bingkai kiri
    s2_poster_wilson: 'assets/scene2/poster-wilson.webp', // poster Wilson (1024×1536) → bingkai kanan

    s3_bg: 'assets/scene3/bg-jalan-surabaya.jpg',
    s3_gerobak: 'assets/scene3/gerobak-soto-ambengan.png',
    s3_toko: 'assets/scene3/toko-antik-luar.png',
    s3_tas: 'assets/scene3/tas-raket-tenis.png',

    s4_bg: 'assets/scene4/bg-toko-antik.jpg',
    s4_etalase: 'assets/scene4/etalase.png',
    s4_koper: 'assets/scene4/koper.png',

    s5_bg3d: 'assets/scene5/bg-3d.jpg', // background scene 3D (opsional)
    train_logo: 'assets/train/virgin-logo.png', // logo di sisi lokomotif (PNG transparan; diubah jadi putih di kode)

    s11_bg: 'assets/scene11/bg-toko-antik.jpg',

    s12_video: 'assets/scene12/video-ulang-tahun.mp4',

    bgm: 'assets/audio/bgm.mp3',
  },
};
