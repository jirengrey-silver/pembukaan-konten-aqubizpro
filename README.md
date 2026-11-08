# QBizPro Social Media Content Studio

Aplikasi desktop Windows untuk membuat video konten media sosial produk IT: intro brand, review produk, dan promosi. Video dibuat untuk WhatsApp Story, Instagram Story/Reels/Feed, TikTok, YouTube, dan Facebook. Aplikasi berjalan sepenuhnya offline. Rendering dan ekspor dilakukan di komputer sendiri dengan FFmpeg.

**Status: Fase 1 + Brand Roulette Intro.**

## Fitur Fase 1

### Dashboard
- Buat proyek baru dari 10 preset ukuran:
  - Vertikal 1080×1920: WhatsApp Status, IG Story, Reels, TikTok, Shorts
  - Horizontal 1920×1080: YouTube, Facebook, Landscape
  - Persegi 1080×1080: IG Feed, FB Post
- Proyek terbaru lengkap dengan thumbnail.
- Aksi proyek: buka, ganti nama, duplikat, simpan sebagai template, ekspor/impor file `.qbzproj`, arsipkan, hapus. Proyek yang dihapus dipindahkan ke folder Trash.
- Halaman lain di dashboard:
  - Template (bawaan dan milik sendiri)
  - Aset brand, aset produk, dan semua aset (impor lewat dialog atau seret file ke halaman)
  - Pustaka animasi
  - Riwayat video hasil ekspor
  - Daftar preset beserta area amannya
  - Pengaturan: lokasi penyimpanan, versi FFmpeg, encoder GPU yang terdeteksi
- Pemulihan otomatis: kalau aplikasi tertutup sebelum proyek disimpan, dashboard menawarkan untuk memulihkan simpanan otomatis terakhir.

### Editor
- **Panel kiri:** Layer, Brand, Teks (7 gaya siap pakai), Media, Latar (warna, gradasi, gambar), Audio, Template, Animasi.
- **Pratinjau:**
  - Kontrol: putar/jeda, maju/mundur per frame, zoom, layar penuh.
  - Ganti ukuran atau platform kapan saja; posisi layer ikut menyesuaikan.
  - Panduan area aman per platform dan grid.
  - Klik objek untuk memilih, seret untuk memindah (dengan magnet ke tengah), tarik sudut untuk memperbesar.
- **Panel kanan (Properti):**
  - Teks: font, ketebalan, ukuran, rata, jarak huruf dan baris, warna, gradasi, outline, glow, kotak latar.
  - Gambar dan logo: penyesuaian ukuran, sudut membulat.
  - Bentuk: kotak atau elips.
  - Semua layer: posisi, skala, rotasi, opasitas, fade in/out, blur, bayangan, garis tepi.
- **Timeline multi-layer:**
  - Ruler untuk scrubbing.
  - Seret blok untuk memindah, seret tepinya untuk memotong; posisi menempel ke playhead dan tepi layer lain.
  - Menu klik kanan, zoom timeline, dan trek audio.
- **Lain-lain:** Undo/redo, simpan (`Ctrl+S`), dan simpan otomatis tiap 2 detik setelah ada perubahan.

### QBizPro Cinematic Brand Roulette (modul utama)
Storyboard 6 scene, total 12 detik, menjadi template bawaan proyek baru (60 fps):

| # | Scene | Waktu |
|---|---|---|
| 1 | Logo Reveal | 0–2 dtk |
| 2 | Orbit Activation | 2–4 dtk |
| 3 | Brand Roulette | 4–7 dtk |
| 4 | Brand Selection | 7–9 dtk |
| 5 | Brand Zoom In | 9–11 dtk |
| 6 | Product Review Transition | 11–12 dtk |

- **Logo QBizPro selalu di pusat orbit.** Ukuran bawaannya 10% dari sisi panjang layar dan bisa diubah.
- **Logo brand mengorbit dalam 3D:** ukuran dan kecerahan mengikuti kedalaman, motion blur muncul saat cepat, garis orbit di depan dan di belakang logo.
- **Putaran roulette:** easing khusus yang halus saat mulai dan saat berhenti.
  - Sudut putaran dihitung supaya brand terpilih selalu berhenti tepat di titik fokus, baik dipilih manual maupun acak.
  - Ini diuji otomatis pada 104 variasi.
- **Zoom ke product showcase tanpa potongan:** kartu brand terpilih berubah bentuk menjadi header halaman review.
- **Keyframe yang bisa diedit:**
  - 20 properti dianimasikan dengan keyframe: kamera (zoom, fokus, geser, rotasi), logo (opasitas, skala, putar 3D, cahaya), orbit (garis, radius, kemiringan, kemunculan brand, opasitas), progres putaran, efek (lens flare, sorot, sinar, kilatan), dan transisi showcase.
  - Di timeline: seret ◆ untuk menggeser, klik dua kali di track untuk menambah, Delete untuk menghapus.
  - Di panel Properti: ubah nilai di posisi playhead, atur easing, atau pindahkan key ke scene lain.
  - Keyframe disimpan relatif terhadap scene-nya, jadi ikut bergeser saat durasi scene diubah.
- **Logo selalu berupa gambar asli yang diunggah.** Brand tanpa logo tampil sebagai kotak kosong bergaris, dan aplikasi memberi peringatan sebelum ekspor.
- Logo contoh di `tests/fixtures/logos` adalah logo fiktif untuk uji dan pratinjau.

### Brand Roulette Intro (kotak misteri)
Animasi pembuka 8 tahap:
1. Cahaya pembuka
2. Garis orbit emas dan biru
3. Logo brand muncul satu per satu
4. Roulette berputar dengan motion blur
5. Putaran melambat sampai satu brand berhenti tepat di depan
6. Sorotan
7. Kamera zoom ke brand itu
8. Halaman review produk

Yang bisa diatur:
- Brand terpilih: acak (bisa diacak ulang) atau dipilih sendiri.
- Gerak: jumlah putaran, kecepatan awal, arah, dan durasi tiap tahap.
- Tampilan: jumlah logo yang mengorbit, ukuran logo, radius orbit, kemiringan 3D, gaya tile, efek zoom kamera.
- Logo tengah, warna, serta judul, subjudul, dan foto produk di halaman review.

Logo brand diunggah sendiri sebagai PNG atau SVG. Sebelum ada logo, nama brand ditulis di dalam tile.

### Ekspor
- **Video:** MP4 H.264 atau H.265, 24/30/60 fps, resolusi asli, 2/3, atau 1/2.
- **Pengaturan video:** bitrate, kecepatan/kualitas, folder tujuan, dan pilihan menyertakan audio.
- **Encoder:** GPU NVIDIA (NVENC), Intel (QSV), atau AMD (AMF) dipakai otomatis kalau tersedia di komputer. Kalau tidak, CPU yang dipakai.
- **Preset ekspor:** Story/Reels/TikTok, 60 fps, YouTube, ukuran kecil, dan H.265.
- **Selama ekspor:** perkiraan ukuran file, progres dengan sisa waktu, dan tombol batal.
- **Gambar:** satu frame bisa diekspor ke PNG atau JPG.

## Cara memakai (pengguna)
1. Unduh dari tab **Actions → Build Windows → run terbaru → Artifacts**, atau dari **Releases** bila sudah ada tag versi. Pilih `QBizPro-Studio-Setup-x.y.z.exe` untuk instal, atau `...-portable.zip` untuk versi tanpa instal.
2. Jalankan aplikasinya. Data disimpan di `Documents\QBizPro Studio`. Lokasi ini bisa diganti di Pengaturan.

## Pengembangan
Kebutuhan: Node.js 20 atau lebih baru.

```bash
npm install
npm start               # jalankan aplikasi
npm test                # uji mesin animasi, tampilan, dan ekspor MP4 sungguhan
npm run dist            # buat installer Windows (dist/)
npm run dist:portable   # buat versi zip portable
```

### Struktur
```
src/main/       proses utama Electron: penyimpanan, ekspor FFmpeg, IPC
  main.cjs      jendela, protokol qbz://, kanal IPC
  storage.cjs   proyek, template, aset, autosave, riwayat ekspor
  exporter.cjs  deteksi encoder (CPU/GPU) dan pipa frame ke FFmpeg
  preload.cjs   API window.qbz yang aman untuk tampilan
src/renderer/   tampilan aplikasi
  js/engine/    mesin gambar murni (scene, Brand Roulette), dipakai pratinjau dan ekspor
  js/ui/        dashboard, editor, panel, timeline, dialog ekspor
  fonts/        Sora, IBM Plex Sans/Mono, Montserrat, Orbitron (SIL OFL)
tests/          uji otomatis
```

Pratinjau dan ekspor memakai fungsi gambar yang sama (`renderFrame`). Hasil MP4 karena itu sama persis dengan yang terlihat di editor. Setiap frame digambar sesuai waktunya (deterministik), lalu dikirim ke FFmpeg.

## Rencana fase berikutnya
- **Fase 2:**
  - Template review produk, promo laptop, promo enterprise, dan countdown.
  - Animasi teks: typewriter, slide, glitch, neon, mask reveal, per huruf, per kata.
  - Motion dan keyframe dengan easing.
  - Video produk di dalam layer.
- **Fase 3:** transisi antar adegan, lebih banyak efek cahaya, dan pustaka preset gerak.
- **Fase 4–5:** antrean render, ekspor beberapa ukuran sekaligus, dan optimasi rendering.

Logo dan merek dagang pihak ketiga tidak disertakan di aplikasi. Pengguna mengunggah logo yang memang berhak dipakai.
