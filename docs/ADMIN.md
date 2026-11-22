# Panduan Panel Admin FAST USTEDI

Panel admin tersedia di `/admin/` dan memiliki tautan **🔒 Admin** di bagian bawah footer setiap halaman.

## Masuk

1. Buka `https://fastustedi.web.id/admin/`.
2. Masukkan username dan password administrator.
3. Kata sandi tersembunyi secara default. Gunakan tombol mata di kanan kolom untuk menampilkan sementara.

Kredensial tidak ditampilkan di halaman mana pun. Di dalam kode, hanya sidik SHA-256 dengan penggaraman yang disimpan, bukan kata sandi asli.

> Panel ini menggunakan autentikasi sisi klien. Karena situs berupa berkas statis, siapa pun yang memiliki akses ke perangkat dapat membaca kode. Untuk perlindungan yang lebih kuat, pindahkan autentikasi ke backend.

## Modul yang tersedia

| Modul | Fungsi |
|---|---|
| Ringkasan | Statistik konten dan status perubahan |
| Blog | Membuat, mengedit, menghapus, dan menerbitkan artikel blog; unggah gambar sampul dengan tombol **Choose File** |
| Berita | Mengelola berita fakultas |
| Halaman & Profil | Identitas, kontak, hero, pengumuman, statistik, keunggulan, program studi, SEO |
| Academy | Katalog kelas, kuota, jadwal, biaya, manfaat, silabus |
| PMB | Tahun akademik, status, jadwal, jalur, biaya, alur, berkas, FAQ |
| Data & Publikasi | Cadangan, impor, unduh, reset, dan publikasi ke GitHub |

## Cara menyimpan konten

Perubahan dari panel disimpan sebagai *override* di `localStorage` browser dengan kunci `fast_cms_data_v1`. Semua halaman publik otomatis membaca override tersebut melalui `assets/js/cms.js`.

Artinya:

- Perubahan **langsung terlihat di perangkat yang sama**.
- Pengunjung lain **belum melihat perubahan** sampai konten diterbitkan.
- Gunakan **Data & Publikasi → Unduh Cadangan** untuk menyimpan berkas JSON.
- Gunakan **Terbitkan ke GitHub** untuk mengirim perubahan ke repositori. Setelah deploy GitHub Pages/Netlify selesai, perubahan berlaku untuk semua pengunjung.

## Publikasi ke GitHub

1. Buat Personal Access Token (classic) dengan scope `repo`, atau fine-grained token dengan izin **Contents: Read and write** pada repositori situs.
2. Buka **Data & Publikasi**.
3. Isi owner, repositori, branch, folder data, dan token.
4. Klik **Terbitkan Sekarang**.

Token hanya disimpan di `sessionStorage` tab tersebut dan dikirim langsung ke GitHub API.

## Status artikel

- **Terbit** — tampil di halaman publik.
- **Draf** — disimpan di panel, tidak tampil di daftar maupun halaman artikel publik.

## Mengembalikan ke data bawaan

- **Reset** pada satu berkas di menu Data & Publikasi.
- **Reset Semua** untuk menghapus seluruh override lokal.

Data bawaan tetap tersimpan di folder `data/` repositori dan tidak pernah diubah oleh reset ini.

## Mengganti kredensial admin

Kredensial tidak disimpan sebagai teks biasa. Berkas `assets/js/admin.js` hanya memuat dua sidik SHA-256:

```js
var HASH_USER = "…";
var HASH_PASS = "…";
```

Untuk mengganti username/password, buat sidik baru dengan format berikut:

```bash
node -e "const c=require('crypto'); for(const s of ['FAST::USER::USERNAME_BARU','FAST::PASS::PASSWORD_BARU']) console.log(c.createHash('sha256').update(s).digest('hex'))"
```

Ganti nilai `HASH_USER` dan `HASH_PASS` dengan hasil perintah tersebut, lalu deploy ulang. Jangan menulis username atau password asli di dokumentasi, commit, atau berkas publik.

> **Penting:** kredensial yang sama juga dipakai oleh menu **Monitoring FAST**. Setelah mengganti hash, perbarui nilai `HASH_USER` dan `HASH_PASS` di `assets/js/monitoring.js` agar menu tersebut tetap bisa dibuka dengan kredensial baru.

> Setelah mengganti hash, sesi admin lama tetap berlaku sampai kedaluwarsa (maksimal 2 jam) atau pengguna menekan tombol keluar.

## Akses Monitoring FAST

Menu **🔒 Monitoring FAST** tampil di navigasi utama setiap halaman publik. Menu ini tidak langsung membuka tautan apa pun; pengguna harus memasukkan **username dan password yang sama dengan Panel Admin** terlebih dahulu.

- Setelah verifikasi berhasil, dashboard dibuka di tab yang sama pada halaman lokal **`/monitoring-fast/`**.
- Halaman tersebut menempelkan (embed) aplikasi dashboard Google Apps Script resmi di dalam iframe — **bukan** mengarahkan ke Google Sites.
- Akses berlaku 2 jam dan disimpan di `sessionStorage` (berakhir saat tab ditutup).
- Setelah 5 percobaan gagal, akses dikunci selama 60 detik.
- URL halaman diatur di `assets/js/config.js` pada `monitoring.url`, sedangkan URL aplikasi yang di-embed ada di `monitoring.appUrl`. Gerbang loginnya ada di `assets/js/monitoring.js`.

> Karena situs ini statis, gerbang ini melindungi navigasi di sisi klien. Aplikasi dashboard Google Apps Script tetap dapat diakses langsung apabila seseorang mengetahui URL `monitoring.appUrl`. Untuk perlindungan penuh, gunakan autentikasi di sisi server atau batasi akses deployment Apps Script sesuai kebutuhan.
