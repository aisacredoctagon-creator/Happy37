# Tugas: terapkan desain tangan baru Gasing (maskot hijau 3D) ke project

Repo: D:\Claude\Happy37\Happy37 (situs statis Three.js r160, `js/gasing3d.js`).
JANGAN commit atau push apa pun. Hindari bug, dan perbaiki bila menemukan bug (termasuk bug lama yang terlihat saat verifikasi).

## Sumber kebenaran
- `preview/hand-preview-src.js` = kode preview final yang sudah disetujui user (bentuk tangan, jempol, pose, makan, collider mangkuk, outline).
- `preview/hand-preview.html` = buka di browser untuk melihat hasil akhir (tombol pose + kamera Depan/Samping/Belakang/Atas/Bawah).
- Bila teks prompt ini berbeda dengan preview, PREVIEW MENANG. Jangan mengubah file di folder `preview/`.
- Baca dulu `js/gasing3d.js` (rig polar spring: az/el/r, OMEGA/ZETA, GESTURES, FDELAY, TIP_FOLLOW, G_LOCK, pushOutOfBody, `amp` untuk prefers-reduced-motion; API createGasing3D, setState('idle'|'walk'|'eat'), hop(), wobble(), gesture(), bagMouthOffset()). Pertahankan API publik dan perilaku scene lain.

## 1. Bentuk sarung tangan (gaya Mickey)
- Sarung tangan putih, outline tinta tipis, TANPA garis di punggung tangan. Telapak = elipsoid skala (0.50, 0.47, 0.36). Manset = lathe bantal yang tetap di pergelangan. Skala sarung tangan GS = 1.2.
- Kerangka lokal tangan: +Y ke arah jari, +X sisi jempol, +Z punggung tangan, jari menekuk ke −Z. Tangan kiri = cermin tangan kanan (parent scale.x = −1, quaternion di-reflect).
- 3 jari, tiap jari 3 ruas (pangkal, tengah, ujung) berupa kapsul + bola sendi, urutan Euler 'ZXY' pada pangkal. Nilai:
  - telunjuk x 0.30 y 0.38, L [0.21,0.17,0.15], R [0.158,0.150,0.140]
  - tengah x 0.00 y 0.41, L [0.24,0.19,0.16], R [0.163,0.155,0.145]
  - manis x −0.30 y 0.37, L [0.21,0.17,0.14], R [0.153,0.145,0.135]
- Outline: HARUS sama tipis dengan outline tubuh maskot. Tubuh memakai inverted hull 0.03 (satuan dunia). Karena tangan diskalakan GS, lebar ink lokal tangan = 0.03 / GS = 0.025.

## 2. Jempol (ikuti referensi user)
- 3 pivot: metakarpal pendek (tersembunyi di bantalan telapak) + 2 kapsul terlihat. Akar (0.30, 0.02, −0.26). Panjang ruas 0.22 / 0.20 / 0.17, radius 0.170 / 0.158 / 0.140. Jempol HARUS lebih pendek dari jari.
- Pada kepalan, jempol MELINTANG di depan jari (di atas ruas tengah telunjuk dan jari tengah), tidak mencuat ke samping dan tidak menyatu dengan jari. Atur lewat ARAH tiap ruas dalam kerangka tangan (bukan sudut Euler): kepalan (0.15,0.38,−0.91), (−0.97,0.20,−0.10), (−0.62,−0.78,0.05).
- TANPA garis tinta tambahan di sambungan ruas jempol (hanya siluet kapsul).
- Bentuk jempol yang sama untuk kepalan idle/jalan, tunjuk, dan genggam sendok.

## 3. Idle dan jalan (ikuti foto referensi user)
- Posisi istirahat: tangan menggantung di sisi badan setinggi bibir piring, pusat ≈ (±3.1, −0.2, 0.1). Dari samping tangan di TENGAH badan; dari depan/belakang di kedua sisi.
- Orientasi: kepalan, punggung tangan ke luar badan, jempol ke depan, jari ke bawah, pitch maju 0.5 rad, condong keluar 0.2 rad (Q_HANG di preview).
- Ayunan jalan = bandul maju-mundur sepanjang sumbu depan-belakang badan (z). Bahu virtual (±3.1, 2.8, 0.1), panjang lengan 3.0, amplitudo ±0.55 rad (z ≈ ±1.6), lintasan busur U (terendah di tengah, ujung naik ±0.5). Dari samping tangan berayun kiri-kanan hampir selebar badan; dari depan terlihat maju-mundur. Kiri-kanan berlawanan fase. Kepalan berputar mengikuti lengan (pitch ≈ −0.9 × sudut lengan), pergelangan tertinggal ≈ 0.55 rad, kepalan sedikit mengendur lalu mengencang.
- Kalibrasi ulang bahu virtual polar dan LIM.r di gasing3d.js, dan SEMUA gestur lama (point, wave, cheer, ooh, startle, hop, dst.) karena titik awal tangan berubah. Gestur tetap berbeda per scene.
- Tangan pembawa tas (bag:true): grip di y ≈ −0.2 membuat dasar tas (2.625 di bawah titik genggam pada BAG_S 0.75) tembus lantai (y = −2.09). Default: tangan kiri pembawa tas diangkat sampai dasar tas tepat di lantai (titik genggam ≥ ≈ 0.54), tangan kanan memakai posisi di atas. Alternatif: perpendek tali / perkecil tas. Laporkan pilihanmu; pastikan bagMouthOffset() dan scene 11 tetap benar. Tangan yang menjinjing tas tetap menggenggam tali dan hanya micro-adjust.

## 4. Scene makan
- Tangan kanan memegang sendok dengan GRIP (jempol bentuk kepalan). Kepala sendok HARUS mencapai ≤ 0.15 dari titik mulut (MOUTH ≈ (0.02, 0.56, 1.12)); verifikasi dengan proyeksi, jangan menebak. Terowongan genggaman di lokal tangan (0.05, 0.14, −0.28).
- Koreografi, T = 2.6 s: menyendok 0–0.18, mengangkat (busur) 0.18–0.55, sendok di mulut 0.55–0.68, kembali 0.68–1 (kunyah 0.68–0.88; kuah di sendok hilang setelah ≈ 0.62).
- Mulut Gasing terbuka saat makan: senyum tertutup sampai 0.34; membuka 0.34–0.5; lebar sampai 0.58; menutup 0.58–0.64; 0.12 sampai 0.68; mengunyah 0.02 + 0.2·chew sampai 0.88; lalu kembali tersenyum. Gunakan mulut terbuka (elips gelap + lidah) menggantikan tabung senyum.
- Tangan kiri memegang mangkuk dengan mangkuk berada DI DALAM tangan. Skala mangkuk 1.3. Orientasi = basis (x=(0,0,−1), y=(1,0,0), z=(0,−1,0)) diputar +0.22 rad mengelilingi sumbu Z dunia. Posisi telapak relatif ke pusat bibir mangkuk ≈ (−0.12, −0.80, +0.20).
- Collider mangkuk ↔ tangan (WAJIB; jari/tangan tidak boleh menembus mangkuk): mangkuk = setengah elipsoid (semi-axis 0.7·S × 0.48·S × 0.7·S) di bawah bibir + silinder berjari-jari 0.7·S di atas bibir. Telapak diperiksa di 5 titik permukaan atasnya dan didorong keluar. Jari (bukan jempol): lengkung mulus mengikuti kontur dinding luar, arah target per ruas = campuran arah awal jari dan arah naik dengan t = 0.3 / 0.65 / 0.95, diproyeksikan ke bidang singgung, ujung ditempel ke permukaan (snap maks 0.5), lalu titik tengah dan ujung didorong keluar bila menembus (3 iterasi). Pangkal jari direnggangkan ×1.22 hanya saat memegang mangkuk dan di-reset tiap kali pose jari ditetapkan. Jempol memakai dorong-keluar per ruas. Acuan: pushOutBowl, bowlNormal, snapBowl, collideBowl di preview.
- Tali tas/strap dan properti lain di scene makan tidak boleh menembus tangan.

## 5. Verifikasi (WAJIB sebelum melapor)
- Jalankan situs (`serve.ps1`, http://localhost:5173, `?debug&scene=N`, `__gasingDebug`). Cek tiap scene, terutama makan dan scene yang membawa tas, dari depan, samping, dan belakang.
- Bandingkan dengan preview: jempol melintang di depan jari, kepalan menggantung sesuai foto referensi, ayunan U, mulut terbuka, mangkuk di dalam tangan tanpa tembus, outline tangan = outline tubuh.
- Cek tidak ada error di console, tidak ada regresi pada gestur lama, prefers-reduced-motion tetap berfungsi, dan frame rate tidak turun.
- Tulis laporan singkat: apa yang diubah, keputusan (terutama tas dan lantai), dan hal yang belum bisa diverifikasi. Jangan commit atau push.
