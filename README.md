# 🌐 Landing Page PMB — Fakultas Sains dan Teknologi USTEDI

Landing page pendaftaran mahasiswa baru (PMB) FAST USTEDI. Responsif (mobile & desktop), memakai logo FAST, logo USTEDI, dan foto gedung USTEDI, serta menyimpan data pendaftar ke **Google Spreadsheet**.

> 📊 **Dashboard Monitoring FAST** — halaman pemantauan data pendaftar (KPI, grafik, tabel, export CSV) tersedia di folder [`monitoring/`](monitoring/). Setelah deploy, akses di **`/monitoring/`** (mis. `https://muhrafihdr.github.io/pmb-fast-usted-v2/monitoring/`). Panduan setup ada di [`monitoring/README.md`](monitoring/README.md).

## 📁 Struktur File

| File | Fungsi |
|------|--------|
| `index.html` | Halaman utama (struktur & konten) |
| `style.css` | Seluruh styling, responsif mobile-first |
| `script.js` | Navigasi, validasi form, kirim data ke Google Sheets |
| `Code.gs` | Google Apps Script — penerima data & penulis ke spreadsheet |
| `netlify.toml` | Konfigurasi deploy Netlify (publish directory & header keamanan) |
| `Logo Ustedi.png` | Logo USTEDI (navbar kiri atas) |
| `gedung ustedi.jpeg` | Foto gedung USTEDI (background hero) |
| `LOGO FAST.png` | Cadangan (tidak dipakai di halaman saat ini) |

---

## ⚙️ Langkah 1 — Pasang Google Apps Script (wajib agar data tersimpan)

1. Buka **https://script.google.com** → klik **New project** (atau buka project yang sudah dipakai).
2. Hapus kode bawaan di `Code.gs`, lalu **tempel seluruh isi file `Code.gs`** dari folder ini (versi CRUD — melayani form PMB **dan** dashboard Monitoring).
3. Pastikan ID spreadsheet di dalamnya sudah benar:
   ```
   PMB_SHEET_ID = "1ddnHgb67DdQmOfs4FTQQIGm1U8Qwah55gH-V1rVOks0"        // data pendaftar
   KEGIATAN_SHEET_ID = "1HG1H9-_VZBBoml_WXpMqJ7aHuIQCRHH0545q94LqOls"  // Pencatatan Kegiatan
   ```
   > Spreadsheet tujuan pendaftar: https://docs.google.com/spreadsheets/d/1ddnHgb67DdQmOfs4FTQQIGm1U8Qwah55gH-V1rVOks0/edit
   > Spreadsheet tujuan kegiatan (dashboard): https://docs.google.com/spreadsheets/d/1HG1H9-_VZBBoml_WXpMqJ7aHuIQCRHH0545q94LqOls/edit

4. Jalankan fungsi **`setupHeaders`** sekali:
   - Pilih fungsi `setupHeaders` di dropdown atas → klik **Run**.
   - Saat diminta izin, pilih akun Google yang punya akses ke spreadsheet → **Allow**.
   - (Opsional) ubah nama sheet/tab, misalnya `Pendaftar` (`PMB_SHEET`) dan `Monitoring_FAST` (`KEGIATAN_SHEET`).

5. **Deploy sebagai Web App:**
   - Klik **Deploy** → **New deployment** → ikon ⚙️ → **Web app**.
   - `Description`: bebas, mis. `PMB FAST`.
   - `Execute as`: **Me**
   - `Who has access`: **Anyone** (agar formulir di website bisa mengirim)
   - Klik **Deploy** → salin **Web app URL** (berakhiran `/exec`).

6. **Hubungkan ke landing page:**
   Buka `script.js`, tempel URL tersebut di bagian paling atas:
   ```js
   const GAS_WEB_APP_URL = "https://script.google.com/macros/s/PASTE_URL_DISINI/exec";
   ```

7. Tes: buka halaman web → isi formulir → kirim → cek spreadsheet (baris baru muncul, kolom `Timestamp` terisi).

> 💡 Jika deploy versi baru setelah mengubah `Code.gs`, gunakan **Deploy → Manage deployments → ✏️ Edit → New version → Deploy** agar URL tetap sama.

---

## 🚀 Langkah 2 — Menjalankan Website

### 🌐 Publikasi online ke Netlify (disarankan)

> **PENTING:** Pastikan `GAS_WEB_APP_URL` di `script.js` **sudah terisi** sebelum deploy, karena file statis tidak bisa diedit setelah online — jika belum, formulir akan menampilkan pesan konfigurasi belum lengkap.

**Cara A — Netlify Drop (paling cepat, tanpa Git):**
1. Buka https://app.netlify.com/drop dan masuk/login (daftar gratis).
2. **Seret (drag & drop) seluruh folder website ini** (berisi `index.html`, `style.css`, `script.js`, `netlify.toml`, dan file gambar) ke halaman tersebut.
3. Tunggu proses deploy ±1 menit. Website langsung online di alamat seperti `https://nama-acak.netlify.app`.

**Cara B — Lewat GitHub (untuk update rutin):**
1. Upload folder website ke repository GitHub.
2. Buka https://app.netlify.com → **Add new site** → **Import an existing project** → pilih GitHub → pilih repository.
3. Netlify otomatis membaca `netlify.toml` (publish directory = root). Setiap push ke GitHub akan otomatis ter-deploy.

**Mengganti domain:**
- **Domain utama**: `https://fastustedi.web.id` (custom domain — sudah disambungkan ke situs Netlify ini, SSL otomatis aktif setelah nameserver diganti).
- **Domain cadangan**: `https://pmb-fast-usted-v2.netlify.app` tetap aktif sebagai alias.

**Mengarahkan domain dari SumoPOD (wajib, sekali saja):**
1. Login ke panel SumoPOD → menu **Domain** → pilih `fastustedi.web.id` → **Manage DNS / Nameservers**.
2. Ubah **nameserver** domain menjadi milik Netlify berikut:
   ```
   dns1.p09.nsone.net
   dns2.p09.nsone.net
   dns3.p09.nsone.net
   dns4.p09.nsone.net
   ```
3. Simpan, lalu tunggu propagasi DNS (biasanya 1–24 jam).
4. Netlify otomatis menerbitkan sertifikat SSL, dan website bisa diakses di `https://fastustedi.web.id`.
   > Status SSL bisa dicek di Netlify → **Site settings → Domain management**.

   *Alternatif (tanpa ganti nameserver):* biarkan DNS di SumoPOD, lalu tambahkan record:
   - `A` record `@` → `75.2.60.5`
   - `CNAME` record `www` → `pmb-fast-usted-v2.netlify.app`
   (nama record bisa berbeda tergantung panel SumoPOD, mis. `@` untuk root dan `www` untuk subdomain).

**Uji setelah online:**
1. Buka website, isi formulir percobaan, kirim.
2. Cek spreadsheet — baris baru harus muncul.
3. Kalau muncul error, lihat tabel Troubleshooting di bawah.

### Jalankan lokal (untuk pratinjau)
Buka langsung di browser:

```bash
open index.html
```

Atau dengan server lokal:

```bash
python3 -m http.server 8080
# lalu buka http://localhost:8080
```

---

## ✏️ Hal yang Bisa Disesuaikan

Cari penanda `✏️` di `index.html` untuk:

- **Daftar Program Studi** — sesuaikan dengan prodi resmi FAST USTEDI (ada di bagian *Program Studi* dan *dropdown formulir*).
- **Jalur Pendaftaran** — sesuaikan di dropdown formulir.
- **Kontak** — nomor WhatsApp, email, dan alamat kampus (bagian *Kontak* dan *Footer*).

Ganti juga:
- **Warna tema** di `style.css` bagian `:root` (`--primary`, `--accent`, dll).
- **Tahun akademik** di badge hero (`index.html`).

---

## 📊 Format Data di Spreadsheet

Setiap pendaftar menjadi **satu baris** dengan kolom:

`Timestamp, Nama Lengkap, NIK, Tempat Lahir, Tanggal Lahir, Jenis Kelamin, Email, No HP/WA, Alamat, Provinsi, Kota/Kabupaten, Kecamatan, Kelurahan/Desa, Kode Pos, Asal Sekolah, Jurusan, Tahun Lulus, Jalur Pendaftaran, Program Studi`

> Ingin menambah/mengubah kolom? Sesuaikan **`HEADERS`** di `Code.gs` **dan** kolom `appendRow` di fungsi `doPost`, lalu ulangi deploy (New version).

---

## 🛠️ Troubleshooting

| Masalah | Solusi |
|--------|--------|
| Data tidak masuk ke spreadsheet | Pastikan Web App di-deploy dengan `Execute as: Me` + `Anyone` dan URL di `script.js` sudah benar (akhiran `/exec`). |
| Muncul pesan "URL Web App belum dikonfigurasi" | Isi `GAS_WEB_APP_URL` di `script.js`. |
| CORS/error saat kirim | Pastikan memakai `Content-Type: text/plain` (sudah diatur di `script.js`) dan akses Web App = **Anyone**. |
| Spreadsheet tidak muncul di editor Apps Script | Buka spreadsheet tersebut di browser terlebih dahulu dengan akun yang sama. |
| Ingin ubah nama tab/sheet | Ubah `PMB_SHEET` / `KEGIATAN_SHEET` di `Code.gs`, lalu deploy versi baru. |

---

Selamat mencoba! 🎓 Jika ada pertanyaan, buka bagian **Kontak** di halaman atau hubungi pengembang/panitia PMB.
