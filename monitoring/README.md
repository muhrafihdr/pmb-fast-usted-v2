# 📊 Monitoring FAST — Dashboard Fakultas Sains dan Teknologi USTEDI

Dashboard pemantauan data pendaftar mahasiswa baru (PMB) FAST USTEDI — versi lengkap pengganti halaman Google Sites [monitoringfast](https://sites.google.com/view/monitoringfast/monitoringfast).

Dashboard membaca data langsung dari **Google Spreadsheet** (sheet `Pendaftar`, sumber data yang sama dengan landing page PMB) dan menampilkannya dalam bentuk:

- ✅ Kartu KPI: total pendaftar, hari ini, 7 hari terakhir, bulan ini, prodi & jalur terpopuler
- 📈 Grafik: pendaftar per program studi, per jalur, tren 14 hari, jenis kelamin
- 🔎 Statistik lanjutan dengan filter rentang tanggal, prodi, dan jalur (tren harian/bulanan otomatis, top 10 asal provinsi, hari tersibuk, rata-rata per hari)
- 🗂️ Tabel data lengkap: pencarian, filter, urutkan (klik kolom), pilih kolom, paginasi
- ⬇️ Export CSV (kompatibel Excel)
- ⏱️ Penyegaran otomatis (mati / 30 dtk / 1 mnt / 5 mnt)
- 📱 Responsif penuh (mobile & desktop), sidebar navigasi

---

## 📁 Struktur File

| File | Fungsi |
|------|--------|
| `index.html` | Struktur halaman dashboard |
| `style.css` | Seluruh styling (sidebar, kartu, grafik, tabel) |
| `script.js` | Logika: ambil data (CSV/Apps Script), statistik, grafik, tabel, export CSV |
| `Code.gs` | (Opsional) Google Apps Script — untuk spreadsheet privat |
| `README.md` | Dokumen ini |
| `LOGO FAST.png`, `Logo Ustedi.png` | Aset visual |

---

## ⚙️ Cara A — Spreadsheet Publik (termudah, TANPA Apps Script) ✅

Dashboard memakai **CSV publik** dari Google Spreadsheet — tidak perlu deploy apa pun.

1. Buka spreadsheet data pendaftar di Google Sheets.
2. Klik **Share / Bagikan** (kanan atas).
3. Ubah akses menjadi **Anyone with the link → Viewer**.
4. Selesai! Dashboard otomatis membaca data via:
   ```
   https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv
   ```
   > `SHEET_ID` sudah diisi di `script.js` (`DATA_SOURCE.sheetId`). Ganti jika memakai spreadsheet lain.

> ⚠️ **Perhatian**: dengan cara ini, siapa pun yang punya link bisa melihat isi spreadsheet (termasuk NIK). Jika tidak ingin data publik, gunakan **Cara B**.

## 🔒 Cara B — Apps Script (spreadsheet privat)

1. Buka **https://script.google.com** → klik **New project**.
2. Tempel seluruh isi `Code.gs` dari folder ini ke editor.
3. **Deploy → New deployment → ikon ⚙️ → Web app**.
   - `Execute as`: **Me**
   - `Who has access`: **Anyone**
4. Salin **Web app URL** (berakhiran `/exec`).
5. Di `script.js`, atur:
   ```js
   const DATA_SOURCE = {
     type: "apps-script",   // ubah dari "csv"
     sheetId: "1ddnHgb67DdQmOfs4FTQQIGm1U8Qwah55gH-V1rVOks0",
     gasUrl: "https://script.google.com/macros/s/PASTE_URL_DISINI/exec",
   };
   ```
6. Selesai.

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
