// ============================================================
//  KONFIGURASI CERITA
//  Semua teks, kode koper, dan path aset ada di sini.
//  Aset 2D otomatis dicari di path yang tertulis; kalau file
//  belum ada, website menampilkan placeholder berlabel.
// ============================================================

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

  // 9 bagian kereta (Scene 6–8). `name` = nama bagian (petunjuk hover), `division` = judul surat (font Tenor Sans),
  // `tagline` = kata kunci opsional di bawah judul, `messages` = ucapan per orang ({ author: Cormorant Garamond Bold,
  // text: Cormorant Garamond Regular }), `closing` = kalimat penutup opsional. Urutan array = urutan bagian (jangan diubah).
  parts: [
    { id: 'loco-roof', name: 'Atap Lokomotif', division: 'Finance',
      messages: [
        { author: 'Rechi', text: 'Happy Birthday Pak Bram! Semoga panjang umur, sehat selalu, serta dalam keberkahan.' },
        { author: 'Claudia', text: 'Semoga sukses di setiap langkah serta setiap harapannya.' },
        { author: 'Angely', text: 'Terus menginspirasi, menyebarkan ilmu dan kebaikan untuk semua.' },
      ],
      closing: 'Happy your day, pak Bram! 🎉' },

    { id: 'car1-roof', name: 'Atap Gerbong 1', division: 'Material Curriculum',
      messages: [
        { author: 'Asrida', text: 'Selamat ulang tahun, Bapak. Kiranya Tuhan senantiasa merajut setiap musim kehidupan dengan kasih karunia, menuntun setiap langkah dengan hikmat-Nya, dan menjadikan hidup Bapak berkat yang tak lekang oleh waktu.' },
        { author: 'Yoani', text: 'Selamat ulang tahun, Bapak. Semoga selalu diberikan kesehatan, umur panjang, kebahagiaan, dan hati yang penuh sukacita. Sukses dan bahagia selalu, Pak.' },
        { author: 'Joni', text: 'selamat ulang tahun pak Bram, panjang umur dan sehat selalu' },
        { author: 'John', text: 'Selamat ulang tahun, Bapak. Semoga selalu diberikan kesehatan, umur panjang, kebahagiaan, dan hati yang penuh sukacita. Sukses dan bahagia selalu' },
      ] },

    { id: 'car2-roof', name: 'Atap Gerbong 2', division: 'Formal Education', tagline: 'Kebijaksanaan',
      messages: [
        { author: 'Ekklesia', text: 'Selamat ulang tahun Bapak ATH, semoga panjang umur, sehat selalu, ditambahkan hikmat dan kebijaksanaannya dalam memimpin Gasing Academy untuk lebih maju lagi. Tuhan memberkati selalu.' },
        { author: 'Hana', text: 'Semoga menjadi inspirasi untuk kemajuan Gasing Academy' },
        { author: 'Fera', text: 'Semoga senantiasa diberikan kebijaksanaan dan kekuatan untuk terus memimpin serta membawa Gasing Academy semakin berkembang dan memberikan dampak positif bagi banyak generasi.' },
        { author: 'Julfikri', text: 'Semoga di hari yang berbahagia ini, Bapak senantiasa diberikan kesehatan, kelancaran dalam setiap langkah, serta kesuksesan dan keberkahan selalu menyertai Bapak dalam memimpin dan berkarya.' },
        { author: 'Mega', text: 'Semoga sehat selalu, panjang umur dan memimpin Gasing menjadi lebih baik lagi.' },
      ] },

    { id: 'loco-body', name: 'Badan Lokomotif', division: 'Advance', tagline: 'PILAR',
      messages: [
        { author: 'Maya', text: 'Happy Birthday, Pak Bram! May God continue to bless you with wisdom and grace, and may your presence continue to inspire and strengthen those around you.' },
        { author: 'Ajeng', text: 'Terima kasih telah menjadi sosok yang tidak hanya menguatkan tim melalui kepemimpinan, tetapi juga menjadi tempat kami belajar, bertumbuh, dan menemukan arah dalam setiap perjalanan. Semoga Pak Bram senantiasa diberikan kesehatan dan kekuatan untuk terus menjadi pilar yang membawa banyak kebijaksanaan bagi orang-orang di sekitarnya.' },
        { author: 'Indra', text: 'Selamat ulang tahun, Pak Bram. Semoga senantiasa diberikan kesehatan, kebahagiaan, umur panjang, serta kesuksesan dan kelancaran dalam setiap langkah dan tanggung jawab. 🙏' },
      ] },

    { id: 'car1-body', name: 'Badan Gerbong 1', division: 'Material Product', tagline: 'Transformatif',
      messages: [
        { author: 'Gina', text: 'Selamat ulang tahun, Pak Bram! Sehat dan bahagia selalu, diberkahi setiap langkahnya, dilancarkan seluruh niat baiknya..' },
        { author: 'Icha', text: 'SELAMAT BERTAMBAH USIA PAK! Semoga diberkahi usia, rezeki dan setiap perjalanannya!!' },
        { author: 'Muti', text: 'Selamat bertambah usia, Pak Bram! Semoga selalu dikelilingi hal-hal baik, diberikan kesehatan, dan semakin sukses dalam setiap perjalanan, Pak!' },
        { author: 'Arina', text: 'Selamat ulang tahun, Pak! Semoga selalu diberikan kesehatan, kebahagiaan, dan kesuksesan dalam setiap langkahnya!' },
        { author: 'Pak Isa', text: 'Selamat Ulang Tahun untuk pa Bram. Di berkahi usianya sepanjang hari dan selalu di beri rejeki, kesehatan. Stay cool & humble... Bahagia dunia dan akhirat' },
      ] },

    { id: 'car2-body', name: 'Badan Gerbong 2', division: 'DGE', tagline: 'Excelsior!',
      messages: [
        { author: 'Nana', text: 'Selamat Ulang Tahun, Pak Bram! Semoga Pak Bram selalu diberikan kesehatan, kebahagiaan, dan semangat luar biasa untuk terus memimpin GASING Academy mewujudkan visi besarnya!' },
        { author: 'Billy', text: 'Selamat ulang tahun ke 37 Pak Bram, semoga diberi kesehatan dan terus menginspirasi banyak orang didalam dan diluar Gasing. God Bless.' },
        { author: 'Ibnu', text: 'Selamat ulang tahun ke-37, Pak Bram! Semoga selalu diberikan kesehatan, kesuksesan, dan semangat untuk terus membawa Gasing Academy menuju pencapaian yang lebih besar.' },
        { author: 'Oka', text: 'Selamat ulang tahun Pak Bram yang ke 37, semoga di tahun yang baru dan selanjutnya dapat menghasilkan karya yang menginspirasi.' },
      ] },

    { id: 'loco-wheels', name: 'Roda Lokomotif', division: 'Operasional',
      messages: [
        { author: 'Valen', text: 'happy birthday Pak Bram, semoga panjang umur, sehat selalu dan semakin sukses dalam memajukan Gasing di seluruh Indonesia bahkan mancanegara ✈️✈️.' },
        { author: 'Ridho', text: 'Selamat ulang tahun, Pak! Semoga sehat selalu, panjang umur, dan semakin sukses dalam segala hal. Semoga apa yang sedang diperjuangkan bisa berjalan lancar dan membawa banyak hal baik. Terima kasih atas arahan dan kepercayaannya selama ini. All the best, Pak! 🙏' },
        { author: 'Vefy', text: 'Semoga bertambahnya usia, Pak Bram diberikan kesehatan, panjang umur, semakin terdepan (kaya slogan Yamaha) dan terus menjadi panutan bagi seluruh tim GASING.' },
        { author: 'Safira', text: 'Happy Birthday, Pak bos. Semoga di usia yang baru ini kariernya makin melesat kayak mobil F1. Sehat selalu, makin bijaksana jadi Team Principal kita semua!!' },
        { author: 'Nia', text: 'Selamat ulang tahun, Pak! Semoga usia baru membawa lebih banyak kebahagiaan, kesehatan, dan kesuksesan, serta terus menjadi sosok pemimpin membawa perusahaan bertumbuh, juga menginspirasi karyawannya untuk ikut hebat bersama! 🎉🥳😂🎂🥳' },
      ] },

    { id: 'car1-wheels', name: 'Roda Gerbong 1', division: 'Sosmed', tagline: 'Inspiring',
      messages: [
        { author: 'Clara', text: 'Selamat ulang tahun yang ke 37, Pak Bram! Semoga dengan bertambahnya usia, Bapak dilimpahi lebih banyak berkat, rejeki, kesuksesan, kebijaksanaan, kesehatan, dan umur yang panjang. Semoga semua urusan diperlancar dan dipermudah serta semua tujuan yang ditempuh bisa menjadi berkat bagi banyak orang. God bless always, Pak!' },
      ],
      closing: 'P.S: Umur Bapak sekarang adalah salah satu Pasangan 10 :D' },

    { id: 'car2-wheels', name: 'Roda Gerbong 2', division: 'HR', tagline: 'Stewardship',
      messages: [
        { author: 'Melisa', text: 'Selamat ulang tahun, Pak Bram.. Semoga selalu sehat, bahagia, dan dimudahkan dalam setiap langkah, terima kasih atas kepercayaan dan bimbingan yang Bapak berikan kepada saya selama ini, semoga di usia yang baru ini, semakin banyak hal baik dan momen bahagia bersama keluarga, GBU' },
        { author: 'Fey', text: 'Happy Birthday Pak Bram! Terima kasih telah menjadi leader yang luar biasa! Kiranya bahagia selalu, memiliki hati yang luas, memiliki jiwa pemimpin yang selalu tangguh & melayani, God Bless Pak - Mazmur 78:72' },
      ] },
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
    train_loco_side: 'assets/train/loco-side.webp', // gambar livery sisi lokomotif (tampak samping, hidung di kanan); kalau gagal dimuat → livery prosedural di kode

    s11_bg: 'assets/scene11/bg-toko-antik.jpg',

    s12_video: 'assets/video akhir/1030.mp4',   // versi ringan 720p; asli di assets/video akhir/_backup/

    // musik, ambience & SFX: semua path/volume ada di js/audio-manifest.js (slot bgm lama = SOUNDS.journey di sana)
  },
};
