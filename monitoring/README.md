# 📊 Monitoring FAST — Dashboard Fakultas Sains dan Teknologi USTEDI

Dashboard pemantauan **Pencatatan Kegiatan** dan data **PMB (Penerimaan Mahasiswa Baru)** FAST USTEDI — versi lengkap pengganti halaman Google Sites [monitoringfast](https://sites.google.com/view/monitoringfast/monitoringfast).

## ✨ Fitur Utama

**🗓️ Pencatatan Kegiatan** (inti monitoring FAST):
- Form catat kegiatan: nama, tanggal, kategori, PIC, tempat, peserta, status, deskripsi, link dokumentasi
- KPI: total kegiatan, bulan ini, selesai/belum, total peserta, kategori teratas
- Grafik: per kategori, per status, tren 6 bulan
- Rekap tabel: cari, filter kategori/status/bulan, sortir, export CSV
- Mode lokal (tanpa backend) & mode cloud (tersinkron spreadsheet)

**📊 Data PMB**:
- Kartu KPI: total pendaftar, hari ini, 7 hari terakhir, bulan ini, prodi & jalur terpopuler
- Grafik: pendaftar per program studi, per jalur, tren 14 hari, jenis kelamin
- Statistik lanjutan dengan filter rentang tanggal/prodi/jalur (tren, top 10 provinsi, hari tersibuk)
- Tabel data lengkap: pencarian, filter, sortir, pilih kolom, paginasi
- Export CSV (kompatibel Excel)

**⏱️ Penyegaran otomatis** (mati / 30 dtk / 1 mnt / 5 mnt) • **📱 Responsif penuh**

---

## 📁 Struktur File

| File | Fungsi |
|------|--------|
| `index.html` | Struktur halaman dashboard |
| `style.css` | Seluruh styling (sidebar, kartu, grafik, tabel) |
| `script.js` | Logika: ambil data (CSV/Apps Script), statistik, grafik, tabel, export CSV |
| `Code.gs` | (Opsional) Google Apps Script — untuk spreadsheet privat |
| `kegiatan-import.csv` | Data 35 kegiatan lama — siap tempel ke sheet `Kegiatan` (fallback) |
| `README.md` | Dokumen ini |
| `LOGO FAST.png`, `Logo Ustedi.png` | Aset visual |

---

## ⚙️ Cara A — Spreadsheet Publik (data PMB, TANPA Apps Script) ✅

Dashboard memakai **CSV publik** dari Google Spreadsheet untuk data PMB — tidak perlu deploy apa pun.

1. Buka spreadsheet data pendaftar di Google Sheets.
2. Klik **Share / Bagikan** (kanan atas).
3. Ubah akses menjadi **Anyone with the link → Viewer**.
4. Selesai! Data PMB otomatis tampil di Dashboard & Data Pendaftar.
   > `SHEET_ID` sudah diisi di `script.js` (`DATA_SOURCE.sheetId`).

> ⚠️ **Perhatian**: dengan cara ini, siapa pun yang punya link bisa melihat isi spreadsheet (termasuk NIK). Jika tidak ingin data publik, gunakan **Cara B**.

## 🔒 Cara B — Apps Script (untuk Pencatatan Kegiatan)

Fitur **Pencatatan Kegiatan** menyimpan data baru ke spreadsheet **"MONITORING FAST TERBARU"** (sheet `Monitoring_FAST`) melalui backend Apps Script. Tanpa backend, dashboard menampilkan data spreadsheet (baca via CSV publik) dan penyimpanan baru jatuh ke mode lokal browser.

1. Buka **https://script.google.com** → klik **New project**.
2. Tempel seluruh isi `Code.gs` dari folder ini ke editor.
3. **Deploy → New deployment → ikon ⚙️ → Web app**.
   - `Execute as`: **Me**
   - `Who has access`: **Anyone**
4. Salin **Web app URL** (berakhiran `/exec`).
5. Di `script.js`, tempel URL ke `DATA_SOURCE.gasUrl`:
   ```js
   const DATA_SOURCE = {
     type: "csv",
     sheetId: "1ddnHgb67DdQmOfs4FTQQIGm1U8Qwah55gH-V1rVOks0",
     gasUrl: "https://script.google.com/macros/s/PASTE_URL_DISINI/exec",
   };
   ```
6. Selesai. Badge di seksi Kegiatan berubah menjadi **"☁️ Tersinkron dengan spreadsheet"**.

### 📌 Tujuan penyimpanan data

| Data | Spreadsheet | Sheet |
|------|-------------|-------|
| Kegiatan baru | `1HG1H9-_VZBBoml...` (MONITORING FAST TERBARU) | `Monitoring_FAST` |
| PMB (pendaftar) | `1ddnHgb67DdQmOfs...` | `Pendaftar` |

- ID kegiatan dibuat otomatis (`FAST-YYYYMMDD-NNN`), mengikuti pola data lama.
- Kolom ekstra form (kategori/tempat/peserta/dokumentasi) dirangkum ke kolom `Catatan`.
- Data lama (35 kegiatan) sudah berada di spreadsheet yang sama → otomatis terbaca, tanpa impor terpisah.

> 🔁 Setelah mengubah `Code.gs`, lakukan **Deploy → Manage deployments → ✏️ Edit → New version → Deploy** agar URL tetap sama.

---

## 🚀 Menjalankan / Publikasi

### Lokal (pratinjau)
```bash
open index.html
```
atau
```bash
python3 -m http.server 8080
# buka http://localhost:8080
```

### Online (GitHub Pages — sudah terpasang)
Folder ini di-deploy ke **GitHub Pages** dari repo `pmb-fast-usted-v2`:
- URL: `https://muhrafihdr.github.io/pmb-fast-usted-v2/monitoring/` atau `https://fastustedi.web.id/monitoring/`

Cukup push perubahan ke branch `main` — workflow `.github/workflows/pages.yml` otomatis deploy.

---

## 🧪 Uji Coba

1. Buka dashboard → cek kartu KPI & grafik muncul.
2. Klik **Muat Ulang** → data tersegarkan.
3. Isi formulir PMB di landing page (`fastustedi.web.id`) → beberapa saat kemudian dashboard menampilkan data baru (sesuai pengaturan **Auto**).
4. Gunakan **Export CSV** untuk mengunduh rekap.

---

## ✏️ Penyesuaian

- **Spreadsheet lain**: ubah `DATA_SOURCE.sheetId` di `script.js`.
- **Warna tema**: ubah variabel di `:root` pada `style.css` (`--primary`, `--accent`, dll).
- **Nama kolom**: jika header sheet berbeda, tambahkan alias di `COL_ALIAS` pada `script.js`.
- **Kolom yang tampil default** di tabel: atur `DEFAULT_COLS` pada `script.js`.
- **Interval auto-refresh default**: ubah atribut `selected` pada `<option value="60">` di `index.html`.

## ⚠️ Catatan Penting

- **NIK**: pastikan kolom NIK di spreadsheet berformat **teks**, bukan angka. Jika angka, digit ke-16 bisa berubah (presisi Excel). Dashboard menampilkan apa adanya.
- **Timestamp**: format `dd/MM/yyyy HH:mm:ss` (default Google Sheets id-ID) sudah didukung otomatis.

---

## 📞 Kontak

💬 WhatsApp: [0882-2899-5205](https://wa.me/6288228995205) • 📧 Email: fast.ustedi@gmail.com • 🌐 [fastustedi.web.id](https://fastustedi.web.id)

Selamat memantau! 🎓
