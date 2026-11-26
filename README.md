# Selamat Ulang Tahun — website interaktif

Website cerita interaktif 12 scene (2D + 3D Three.js) berdasarkan storyboard Figma.
Scene 3 (jalan Surabaya) dan scene 4 (toko antik) sekarang berupa dunia **3D** utuh; versi 2D-nya tetap ada sebagai cadangan kalau WebGL gagal.
Situs statis murni: HTML + CSS + ES modules. Three.js & GSAP dimuat dari CDN (butuh internet).

## Menjalankan

Module JS tidak bisa dibuka langsung via `file://`, jadi pakai server lokal:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Lalu buka http://localhost:5173

- `?scene=N` → langsung loncat ke scene N (1–12), mis. `http://localhost:5173/?scene=6`
- `?debug` → **debug mode**: muncul panel kecil di kiri atas untuk loncat antar scene (animasi juga tetap normal walau tab di latar)
  - tombol ◀ ▶, grid scene 1–12, `↻ ulang` (mulai ulang scene ini), centang *lewati fade transisi*
  - keyboard: `[` / `]` = scene sebelum / sesudah, `` ` `` = sembunyikan panel
  - bisa dipakai dari layar awal (langsung loncat tanpa menekan "Mulai"), memotong transisi/animasi yang sedang jalan, dan URL ikut diperbarui jadi `?debug&scene=N`
  - `?scene=N` kini juga bisa langsung ke scene 7, 8, 10 dan 12 (sebelumnya hanya 5, 6, 9 dan 11)
  - di console: `__debug.jump(n)` dan `__debug.scene`

## Struktur

| File | Isi |
|---|---|
| `js/config.js` | **Edit di sini**: nama, data tiket, kode koper (default 1‑2‑3‑4), narasi, 9 bagian kereta + teksnya, path aset |
| `js/main.js` | Pengatur alur scene, HUD, transisi, catatan, confetti |
| `js/debug.js` | Panel debug untuk loncat scene (aktif dengan `?debug`) |
| `js/scenes2d.js` | Scene 2D: 1–2 (+ scene 3, 4 dan 11–12 versi 2D, hanya sebagai cadangan kalau WebGL / dunia 3D gagal) |
| `js/street3d.js` | **Scene 3 (3D)**: jalan Surabaya sore hari — deretan ruko kolonial, spanduk "Selamat Datang di SURABAYA", umbul-umbul merah-putih, pohon & lampu jalan, **gerobak soto Ambengan** (uap mengepul, etalase mangkuk) dan **toko antik** dengan pintu terbuka yang bercahaya. Gasing (yang menjinjing tas tenis, `bag: true`) adalah elemen DOM yang diproyeksikan ke trotoar 3D (cara yang sama dengan toko). Konstanta di atas file (`CART`, `SHOP`, `STAND`, `EAT_AT`, `VIEWS`) mengatur posisi dan sudut kamera; `VIEWS.*.p` = variasi layar portrait. Dibangun malas (lazy) saat scene 3 pertama dibuka |
| `js/shop3d.js` | **Scene 4 dan 11–12 (3D)**: interior toko antik — rak, jam besar, gramofon, lampu gantung, karpet, etalase kaca berisi koper, dan **TV CRT besar di atas kabinet** (layar cembung, garis scan, antena, statis → video). Konstanta di bagian atas file (`CASE`, `WALK_FROM/WALK_TO`, `TV_POS/TV_ROT`, `TV_PATH`, `BAG_OFF`, `VIEWS`) mengatur posisi etalase, TV, jalur Gasing, dan sudut kamera |
| `js/world3d.js` | Scene 3D: 5–10 (koper, gembok, bagian kereta, cetakan, kereta); pemilik renderer & **koper**. Koper itu diletakkan *di dalam* scene toko (`shop3d.js`, skala `CASE_SCALE`) sehingga scene 4 → 5 satu ruang yang sama dan toko jadi latar scene 5–10. Kamera dihitung dalam satuan lokal koper (`applyCam`). Kalau toko gagal dibangun → pakai scene mandiri (meja + gradien) |
| `js/gasing3d.js` | Karakter **Gasing 3D** (Saucer Sprout, dari `saucer-sprout.html`) yang dipakai di semua scene 2D. Opsi `bag: true` → Gasing **menjinjing tas tenis** di sarung tangan kirinya: tas ada di scene 3D yang sama, menggantung dari tali jinjing, ikut melayang bersama sarung tangan dan berayun seperti bandul saat Gasing meloncat (`hop()`) atau tas disenggol (`wobble()`). `bagMouthOffset()` memberi posisi mulut tas (tempat bola tenis keluar di scene 11). Konstanta `BAG_S` / `BAG_GRIP` di atas file mengatur ukuran tas & titik genggam |
| *(gasing3d.js, animasi tangan)* | **Sarung tangan gaya Mickey** (desain final di `preview/hand-preview-src.js`; `preview/hand-preview.html` = acuan visual): telapak elipsoid, **3 jari × 3 ruas** + **jempol 3 pivot** (jempol pendek, melintang di depan jari saat mengepal — diatur lewat ARAH tiap ruas), manset bantal yang diam di pergelangan, skala `GS`, tanpa garis di punggung tangan, tinta `HAND_INK` = 0.03 / `GS` (sama tipis dengan tubuh). Tangan kanan = referensi, kiri = cermin (parent scale.x = −1); semua gerak ditulis di kerangka kanan (`x > 0` = menjauh dari badan). **Pose istirahat**: kepalan menggantung di sisi badan setinggi bibir piring, pusat ≈ (±3.1, −0.2, 0.1), punggung tangan ke luar, jempol ke depan (`Q_HANG`). **Gerak**: bahu virtual `SH` + panjang lengan `ARM` → posisi dalam koordinat polar (maju `fw`, naik `lat`, jari-jari `r`) sehingga selalu berbusur; **jalan** = bandul maju-mundur ±`WALK_AMP` (z ≈ ±1.6, lintasan U, kiri-kanan berlawanan fase, pergelangan tertinggal, kepalan mengendur-mengencang). Semua kanal dipegaskan **under-damped** (`OMEGA`/`ZETA`: lengan → pergelangan → jari → ujung jari makin lambat, jempol paling akhir lewat `FDELAY`), telapak squash & stretch, fidget idle acak 3–7 detik. `g.setState('idle' | 'walk' | 'eat')`, `hop()`, `wobble()`, **`g.gesture(nama, { hand, intensity, onDone })`** (katalog `GESTURES`: `wave`, `greet`, `wait`, `point`, `cheer`, `marvel`, `pointCart`, `pointShop`, `yum`, `hmm`, `pointCase`, `ooh`, `startle`, `wow`; posisi tiap key ditulis `p:[x,y,z]` di kerangka kanan, `c` = closure jari relatif kepalan, `q` = pose orientasi). **Tas** (`bag: true`): tangan kiri diangkat (`CARRY_R`) supaya dasar tas tidak tembus lantai (y = −2.09); tali tas lewat terowongan kepalan (`TUN`); titik genggam saat menjinjing = `BAG_HOLD` (dipakai `bagMouthOffset()` untuk posisi bola tenis scene 11 — ukur ulang bila `GS`/`TUN`/`CARRY_R`/`Q_HANG` berubah); tangan kiri pembawa tas hanya micro-adjust (`G_LOCK_*`). **Makan** (`EAT_T` = 2.6 s): sendok digenggam tangan kanan dan kepalanya mencapai ≤ 0.15 dari titik mulut (dilacak dari mulut sebenarnya, ikut tilt/yaw/loncat; cek `__gasingDebug.hands()[0].eat.headToMouth`), mulut Gasing terbuka (elips gelap + lidah) lalu mengunyah, tangan kiri menopang mangkuk dari bawah (skala `BOWL_S`): mangkuk adalah **anak tangan kiri** sehingga ikut kaku saat diam, loncat, atau berganti state; jari melingkar naik di dinding depan dan jempol di dinding luar. Bentuk pegangan **di-bake sekali** saat mount (telapak didorong keluar dari mangkuk, jari mengikuti dinding luar, cek tembus `__gasingDebug.hands()[0].bowl.maxPenetration`) lalu dicampur dengan bobot yang sama dengan posisi tangan dan skala mangkuk. Konstanta: `BOWLHAND`, `BOWL_HAND_TILT`, `BOWL_WRAP_T`, `BOWL_FINGER_SPREAD`, `BOWL_SNAP`, `P_CUP` / `TD_CUP` (pose awal). Panel `?debug` punya tombol **✋ gestur tangan** dan alat uji `__gasingDebug` (`freeze()`, `step(detik)`, `hands()`). **Anatomi & physics**: tiap jari punya tiga closure bertahap (pangkal → tengah → ujung, pegas makin lambat, `MID_LAG`/`TIP_LAG`), batas sendi lunak per ruas `JOINT_LIM`/`JOINT_SOFT` (tanpa hiperekstensi saat overshoot), tangan mengikuti badan lewat pegas `FOLLOW_OMEGA`/`FOLLOW_ZETA` dengan jarak maks `FOLLOW_MAX` (kaku saat makan / menggapai tas), dan transisi state memakai redaman kritis `STATE_OMEGA`. Konstanta yang mudah di-tweak ada di atas `gasing3d.js`. |
| `js/bag3d.js` | Model **tas tenis + raket** 3D. `buildBagModel()` dipakai Gasing (lihat di atas); `createBag3D()` = tas berdiri sendiri (halaman preview `tas-raket.html`) |
| `js/assets.js` | Sistem slot aset + placeholder otomatis |
| `css/style.css` | Semua style + layout responsif (portrait HP) |

## Alur cerita

1. Tiket kereta ke Surabaya (ketuk tiket)
2. Lihat landmark Surabaya dari jendela kereta
3. **3D** Jalan Surabaya: kamera turun dari atas, Gasing datang menenteng tas → ketuk gerobak soto (Gasing menghampiri, kamera mendekat, makan sambil meloncat + gelembung "Nyam!") → ketuk toko antik (Gasing berjalan ke teras, memudar ke dalam cahaya pintu, lalu masuk scene 4 lewat fade krem)
4. **3D** Masuk ke toko antik — Gasing berjalan ke etalase; ketuk koper → penutup kaca terangkat dan kamera terbang langsung ke gembok (tanpa fade; scene 5–10 tetap berlatar toko)
5. **3D** Gembok kode 4 digit (atas = +1, bawah = −1)
6. **3D** Koper terbuka: 9 bagian kereta di tutup, cetakan di bawah
7. **3D** Ketuk bagian → kamera zoom (belum terbaca)
8. **3D** Zoom lagi → catatan 8 kalimat, ✕ untuk kembali & bagian terpasang ke cetakan
9. **3D** Semua terpasang → kereta melayang, drag untuk putar 360°
10. **3D** Setelah diputar (≥ `rotateThresholdDeg`) → tombol "Tutup Koper"
11. **3D, masih di toko yang sama (tanpa fade hitam)** Koper tertutup → kamera mundur, penutup kaca turun lagi, cahaya sorot kembali redup → Gasing berjalan masuk menenteng tas tenis → bola tenis melompat keluar, memantul, dan menggelinding
12. **3D** Bola berhenti di depan TV CRT → TV menyala (statis → video ucapan), kamera mendekat. Tombol "Perbesar TV" / "Ulangi dari awal"; ketuk layar TV untuk jeda/putar video

Teks transisi 10 → 11 ada di `CONFIG.captions.t11`. Kalau toko 3D gagal dibangun, transisi 10 → 11 kembali memakai fade hitam + scene 2D lama.

## Mengganti aset placeholder

Cukup taruh file dengan nama berikut — website otomatis memakainya. Yang belum ada tampil sebagai kotak placeholder berlabel.

| Path | Keterangan |
|---|---|
| `assets/characters/gasing.png` | Karakter 2D lama. Sekarang hanya **cadangan** kalau WebGL gagal + ikon tab |
| `assets/scene1/bg-stasiun.jpg` | Background stasiun |
| `assets/scene2/view-landmark-surabaya.jpg` | Pemandangan dari jendela (lebar, ujung kiri-kanan nyambung untuk loop) |
| `assets/scene2/jendela-kereta.png` | Frame jendela transparan (opsional) |
| `assets/scene3/bg-jalan-surabaya.jpg` | Background jalan/gang — hanya versi 2D cadangan (scene 3 3D dibangun prosedural) |
| `assets/scene3/gerobak-soto-ambengan.png` | Gerobak soto — hanya versi 2D cadangan |
| `assets/scene3/toko-antik-luar.png` | Toko antik tampak luar — hanya versi 2D cadangan |
| `assets/scene3/tas-raket-tenis.png` | Tas + raket tenis (juga dipakai di scene 11) |
| `assets/scene4/bg-toko-antik.jpg` | Interior toko antik — *hanya dipakai versi 2D cadangan* (scene 4 3D dibangun prosedural) |
| `assets/scene4/etalase.png` | Etalase — hanya versi 2D cadangan |
| `assets/scene4/koper.png` | Koper versi 2D — hanya versi 2D cadangan |
| `assets/scene5/bg-3d.jpg` | Background di belakang scene 3D (opsional) |
| `assets/scene11/bg-toko-antik.jpg` | Background scene bola & TV — hanya versi 2D cadangan (scene 11–12 3D memakai toko prosedural) |
| `assets/scene12/video-ulang-tahun.mp4` | **Video ucapan** yang diputar di layar TV CRT 3D (rasio bebas; dipotong "cover" ke layar 4:3). Belum ada → layar placeholder |
| `assets/audio/bgm.mp3` | Musik latar (opsional; tombol ♪ muncul otomatis) |

Model 3D (koper & bagian kereta) saat ini masih primitif Three.js — lihat `buildPartModel()` di `js/world3d.js` untuk menggantinya dengan model GLB nanti.

> Catatan: error 404 di console saat aset belum ada itu normal (website sedang mengecek file).
