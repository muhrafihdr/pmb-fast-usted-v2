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
| `script.js` | Logika: ambil data, statistik, grafik, tabel, export CSV |
| `Code.gs` | Google Apps Script — backend pembaca data spreadsheet |
| `README.md` | Dokumen ini |
| `LOGO FAST.png`, `Logo Ustedi.png`, `gedung ustedi.jpeg` | Aset visual |

---

## ⚙️ Langkah 1 — Pasang Google Apps Script (wajib)

1. Buka **https://script.google.com** → klik **New project**.
2. Hapus kode bawaan, lalu **tempel seluruh isi `Code.gs`** dari folder ini.
3. Pastikan `SHEET_ID` dan `SHEET_NAME` sesuai spreadsheet pendaftar:
   ```js
   const SHEET_ID   = "1ddnHgb67DdQmOfs4FTQQIGm1U8Qwah55gH-V1rVOks0";
   const SHEET_NAME = "Pendaftar";
   ```
4. **Deploy sebagai Web App:**
   - Klik **Deploy** → **New deployment** → ikon ⚙️ → **Web app**.
   - `Description`: bebas, mis. `Monitoring FAST`.
   - `Execute as`: **Me**
   - `Who has access`: **Anyone**
   - Klik **Deploy** → salin **Web app URL** (berakhiran `/exec`).

## ⚙️ Langkah 2 — Hubungkan ke Dashboard

Buka `script.js`, tempel URL di bagian paling atas:

```js
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/PASTE_URL_DISINI/exec";
```

> 🔁 Setelah mengubah `Code.gs`, lakukan **Deploy → Manage deployments → ✏️ Edit → New version → Deploy** agar URL tetap sama.

## 🚀 Langkah 3 — Menjalankan / Publikasi

### Lokal (pratinjau)
```bash
open index.html
```
atau
```bash
python3 -m http.server 8080
# buka http://localhost:8080
```

### Online (Netlify / GitHub Pages)
- **Netlify Drop:** buka https://app.netlify.com/drop → seret folder ini → selesai.
- **GitHub Pages:** push folder ini ke repo → aktifkan Pages di Settings → pilih branch & root.
- Domain utama FAST: `https://fastustedi.web.id` (jika ingin, sambungkan custom domain di Netlify).

> ⚠️ Pastikan `GAS_WEB_APP_URL` **sudah terisi sebelum deploy online**, karena file statis tidak bisa diedit setelah online.

---

## 🧪 Uji Coba

1. Buka dashboard → cek kartu KPI & grafik muncul.
2. Klik **Muat Ulang** → data tersegarkan.
3. Isi formulir PMB di landing page (`fastustedi.web.id`) → beberapa saat kemudian dashboard menampilkan data baru (sesuai pengaturan **Auto**).
4. Gunakan **Export CSV** untuk mengunduh rekap.

---

## ✏️ Penyesuaian

- **Warna tema**: ubah variabel di `:root` pada `style.css` (`--primary`, `--accent`, dll).
- **Nama kolom**: jika header sheet berbeda, tambahkan alias di `COL_ALIAS` pada `script.js`.
- **Kolom yang tampil default** di tabel: atur `DEFAULT_COLS` pada `script.js`.
- **Jumlah baris maksimal** yang dikirim ke dashboard: ubah `MAX_ROWS` di `Code.gs`.
- **Interval auto-refresh default**: ubah atribut `selected` pada `<option value="60">` di `index.html`.

## ⚠️ Catatan Penting

- **NIK**: pastikan kolom NIK di spreadsheet berformat **teks**, bukan angka. Jika angka, digit ke-16 bisa berubah (presisi Excel). Dashboard menampilkan apa adanya.
- **Timestamp**: Apps Script menulis waktu dalam UTC; dashboard menampilkan dalam zona waktu lokal (WIB).
- Data yang dikirim dashboard maksimal `MAX_ROWS` baris teratas — cukup untuk ribuan pendaftar.

---

## 📞 Kontak

💬 WhatsApp: [0882-2899-5205](https://wa.me/6288228995205) • 📧 Email: fast.ustedi@gmail.com • 🌐 [fastustedi.web.id](https://fastustedi.web.id)

Selamat memantau! 🎓
