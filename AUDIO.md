# Audio — SFX, ambience & musik

Semua suara diatur di **satu manifest**: `js/audio-manifest.js`. Mesin audionya `js/audio.js` (Web Audio API).
Kredit lengkap per file: `assets/audio/CREDITS.md`. Semua sumber **CC0 / domain publik**.

## Cara kerja singkat

- **Bus**: `music`, `ambience`, `sfx` → `master` → limiter (pengaman clipping). Volume awal bus di `BUSES` (manifest).
- **Mulai**: audio baru aktif setelah tombol **Mulai** (aturan autoplay, termasuk iOS). Tombol 🔇 (`#muteBtn`) yang sudah ada sekarang membisukan semua bus.
- **Per scene** (`SCENES` di manifest): musik & ambience crossfade otomatis saat scene berganti, termasuk saat dunia 3D maju sendiri (`setStage`) dan saat loncat lewat `?debug`. Saat scene dibongkar, semua one-shot & loop scene lama dihentikan/dipudarkan. Musik yang sama di scene berikutnya diteruskan tanpa diulang dari awal.
- **Muat per scene**: file scene aktif dimuat saat scene dimulai, file scene berikutnya dipreload di latar.
- **Sinkron animasi**: SFX dipanggil dari event animasi, bukan `setTimeout`: loncatan Gasing (`hop()`), fase siklus makan (sendok di mangkuk u≈0.04, sendok di mulut u≈0.55), titik sentuh lantai ease `bounce.out` bola, `onStart`/`onComplete` tween kaca etalase & tutup koper, dll.
- **Video ucapan TV (scene 12)**: `play` → musik & ambience turun ke `DUCK_LEVEL` (hampir hening), `pause`/`ended` → naik lagi.
- **Tab tidak aktif**: `AudioContext` di-suspend, dilanjutkan saat kembali.
- **File hilang**: hanya peringatan `[audio] …` di console; game tetap jalan.
- **Tidak menumpuk keras**: tiap SFX punya `maxVoices` & `minGap`; variasi pitch acak `pitch`.

## Mengganti suara

1. Taruh file baru (MP3, SFX sebaiknya mono) di `assets/audio/music|amb|sfx/`.
2. Ubah `file` id-nya di `SOUNDS` (`js/audio-manifest.js`) — atau timpa file lama dengan nama yang sama, tanpa mengubah kode.
3. Atur `volume` (0–1, relatif bus), `loop`, `pitch`, `maxVoices`, `minGap` di baris yang sama. Musik/ambience per scene diatur di `SCENES`.
4. Uji di `?debug` → **🔊 audio**: tombol putar tiap id (loop diputar 3 detik) + slider volume per bus.
5. Tambahkan kredit/lisensinya di `assets/audio/CREDITS.md` dan baris tabel di bawah.

Normalisasi yang dipakai (ffmpeg): musik `loudnorm=I=-20:TP=-2`, stereo 64 kbps · ambience loop dengan crossfade lalu `loudnorm=I=-24:TP=-3`, mono 48 kbps · SFX: hening di awal dibuang, puncak dinormalkan ke −4 dBFS + `alimiter`, mono 64 kbps. Keseimbangan akhir (musik paling pelan di latar, ambience di bawah musik, SFX paling jelas) diatur oleh `BUSES` + `volume` per id.

## Daftar suara

Volume = `volume` id di manifest (dikali volume bus: music 0.32 · ambience 0.22 · sfx 0.85 · master 0.9).

| Scene | Momen | Jenis | ID | Nama file | Volume | Loop | Durasi | Sumber/lisensi |
|---|---|---|---|---|---|---|---|---|
| 1–3, 11 | Musik perjalanan | musik | `journey` | music/journey.mp3 | 1.0 | ya | 171.4 s | Aureolus_Omicron, *4 Music Box Tracks* · CC0 |
| 4–10 | Musik toko antik | musik | `shop` | music/shop.mp3 | 0.9 | ya | 137.1 s | Aureolus_Omicron, *4 Music Box Tracks* · CC0 |
| 12 | Musik kejutan (di-duck saat video) | musik | `celebrate` | music/celebrate.mp3 | 1.0 | ya | 39.5 s | cynicmusic, *Happy Lullaby* · CC0 |
| 1 | Suasana stasiun | ambience | `station` | amb/station.mp3 | 0.8 | ya | 27.0 s | natalie, Wikimedia Commons · domain publik |
| 2 | Kereta melaju | ambience | `train` | amb/train.mp3 | 1.0 | ya | 40.0 s | Jidanni, Wikimedia Commons · CC0 |
| 3 | Jalan Surabaya | ambience | `street` | amb/street.mp3 | 0.8 | ya | 45.0 s | cori, Wikimedia Commons · domain publik |
| 4–12 | Detak jam toko antik | ambience | `clock` | amb/clock.mp3 | 0.7 | ya | 8.0 s | bart, OpenGameArt · CC0 |
| 12 | Statis TV (selama layar bersalju) | ambience | `tvstatic` | amb/tvstatic.mp3 | 0.9 | ya | 4.0 s | bretbernhoft, OpenGameArt · CC0 |
| Awal | Tombol Mulai | SFX | `ui_start` | sfx/ui_start.mp3 | 0.7 | – | 0.54 s | Kenney *Interface Sounds* · CC0 |
| Semua | Tombol aksi / ketuk gerobak, toko, koper / tombol akhir | SFX | `ui_click` | sfx/ui_click.mp3 | 0.6 | – | 0.08 s | Kenney *UI Audio* · CC0 |
| — | (cadangan tombol tutup; ✕ catatan memakai `note_close`) | SFX | `ui_close` | sfx/ui_close.mp3 | 0.6 | – | 0.15 s | Kenney *Interface Sounds* · CC0 |
| Semua | Transisi pindah scene (fade) · zoom ke bagian kereta | SFX | `whoosh` | sfx/whoosh.mp3 | 0.35 | – | 0.11 s | artisticdude, *Swishes* · CC0 |
| Semua | Gasing meloncat (juga langkah loncat saat berjalan) | SFX | `hop` | sfx/hop.mp3 | 0.2 | – | 0.42 s | EZduzziteh, *Boings* · CC0 |
| 1 | Pengumuman kedatangan (awal scene) | SFX | `station_chime` | sfx/station_chime.mp3 | 0.35 | – | 5.49 s | Lexcie, Wikimedia Commons · CC0 |
| 1 | Ketuk tiket | SFX | `paper` | sfx/paper.mp3 | 0.6 | – | 0.69 s | Kenney *RPG Audio* · CC0 |
| 1 | Stempel "BERANGKAT" mendarat | SFX | `stamp` | sfx/stamp.mp3 | 0.7 | – | 0.28 s | Kenney *RPG Audio* · CC0 |
| 3 | Sendok di mangkuk (bergantian a/b) | SFX | `spoon_a` | sfx/spoon_a.mp3 | 0.5 | – | 0.26 s | TinyWorlds, *cutlery sounds* · CC0 |
| 3 | Sendok di mangkuk (bergantian a/b) | SFX | `spoon_b` | sfx/spoon_b.mp3 | 0.5 | – | 0.16 s | TinyWorlds, *cutlery sounds* · CC0 |
| 3 | Suapan sampai di mulut | SFX | `nom` | sfx/nom.mp3 | 0.45 | – | 0.18 s | wubitog, *3 Pop Sounds* · CC0 |
| 3 | Gasing tiba di pintu toko antik | SFX | `shop_bell` | sfx/shop_bell.mp3 | 0.55 | – | 2.00 s | PWL, *Bell dings/chimes* · CC0 |
| 4 | Kaca etalase terangkat | SFX | `glass_up` | sfx/glass_up.mp3 | 0.6 | – | 0.28 s | Kenney *Interface Sounds* · CC0 |
| 11 | Kaca etalase turun lagi | SFX | `glass_down` | sfx/glass_down.mp3 | 0.6 | – | 0.12 s | Kenney *Interface Sounds* · CC0 |
| 5 | Roda angka gembok diputar | SFX | `lock_tick` | sfx/lock_tick.mp3 | 0.7 | – | 0.04 s | Kenney *Interface Sounds* · CC0 |
| 5 | Kode benar, gembok terbuka | SFX | `lock_open` | sfx/lock_open.mp3 | 0.8 | – | 0.25 s | Kenney *RPG Audio* · CC0 |
| 5 | Tutup koper membuka | SFX | `lid_open` | sfx/lid_open.mp3 | 0.6 | – | 0.82 s | Kenney *RPG Audio* · CC0 |
| 8 | Catatan terbuka | SFX | `note_open` | sfx/note_open.mp3 | 0.6 | – | 0.13 s | Kenney *RPG Audio* · CC0 |
| 8 | Catatan ditutup (✕) | SFX | `note_close` | sfx/note_close.mp3 | 0.6 | – | 0.21 s | Kenney *RPG Audio* · CC0 |
| 6–8 | Bagian kereta masuk cetakan | SFX | `part_place` | sfx/part_place.mp3 | 0.6 | – | 0.37 s | Kenney *Impact Sounds* · CC0 |
| 6–8 | Bagian kereta terpasang (chime) | SFX | `part_chime` | sfx/part_chime.mp3 | 0.45 | – | 0.29 s | Kenney *Interface Sounds* · CC0 |
| 9 | Semua bagian terpasang | SFX | `assembled` | sfx/assembled.mp3 | 0.6 | – | 1.60 s | PWL, *Bell dings/chimes* · CC0 |
| 10 | Tutup koper menutup | SFX | `lid_close` | sfx/lid_close.mp3 | 0.7 | – | 0.60 s | Kenney *RPG Audio* · CC0 |
| 10 | Pengait koper terkunci | SFX | `case_latch` | sfx/case_latch.mp3 | 0.7 | – | 0.45 s | Kenney *RPG Audio* · CC0 |
| 11 | Bola melompat keluar dari tas | SFX | `ball_pop` | sfx/ball_pop.mp3 | 0.6 | – | 0.26 s | wubitog, *3 Pop Sounds* · CC0 |
| 11 | Tiap pantulan bola (makin pelan) | SFX | `ball_bounce` | sfx/ball_bounce.mp3 | 0.75 | – | 0.12 s | Kenney *Impact Sounds* · CC0 |
| 12 | TV dinyalakan | SFX | `tv_on` | sfx/tv_on.mp3 | 0.7 | – | 0.32 s | Kenney *UI Audio* · CC0 |
| 12 | Confetti | SFX | `confetti` | sfx/confetti.mp3 | 0.5 | – | 2.90 s | wubitog, *3 Pop Sounds* · CC0 |

Total ukuran `assets/audio/`: **±3,7 MB** (musik 2,7 MB · ambience 0,7 MB · SFX 0,2 MB).

## Belum ada (perlu dicari sendiri bila diinginkan)

Tidak ditemukan versi CC0/domain publik yang bisa diunduh langsung (Freesound butuh login):
- **Bola menggelinding** di lantai kayu (scene 11) — kata kunci: "tennis ball rolling wood floor".
- **Pintu kereta / rem** saat tombol "Turun" (scene 2) — "train door hiss", "train brake".
- **Dengung kereta mainan melayang** saat diputar (scene 9) — "soft magic hum loop".
- **Riuh pasar / jalan Indonesia** yang lebih khas untuk scene 3 — "Indonesian street market ambience", "motorbike traffic Asia".
