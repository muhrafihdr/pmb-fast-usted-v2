/**
 * ============================================================
 *  Monitoring FAST USTEDI — Google Apps Script (Backend)
 *  ------------------------------------------------------------
 *  MELAYANI DATA untuk dashboard Monitoring FAST:
 *   1. Baca data PMB (sheet "Pendaftar")          → doGet?action=getAll
 *   2. Baca data Kegiatan (sheet "Monitoring_FAST") → doGet?action=getKegiatan
 *   3. Simpan kegiatan baru → doPost (JSON dengan _tipe:"kegiatan")
 *      → DITULIS ke spreadsheet "MONITORING FAST TERBARU"
 *        (sheet Monitoring_FAST — skema asli fakultas)
 *   4. (Backward-compatible) Simpan PMB → doPost (JSON PMB lama)
 *
 *  CARA MEMASANG:
 *   1. https://script.google.com → New project → tempel file ini
 *   2. Deploy → New deployment → ⚙️ Web app
 *      - Execute as : Me | Who has access : Anyone
 *   3. Salin URL /exec → tempel ke DATA_SOURCE.gasUrl di script.js
 *   (Atau: ganti Code.gs project PMB yang sudah berjalan lalu
 *    Deploy → Manage deployments → ✏️ New version → Deploy)
 * ============================================================
 */

/** ID spreadsheet PMB (data pendaftar) */
const PMB_SHEET_ID = "1ddnHgb67DdQmOfs4FTQQIGm1U8Qwah55gH-V1rVOks0";
const PMB_SHEET = "Pendaftar";

/** ID spreadsheet KEGIATAN (MONITORING FAST TERBARU — otoritatif) */
const KEGIATAN_SHEET_ID = "1HG1H9-_VZBBoml_WXpMqJ7aHuIQCRHH0545q94LqOls";
const KEGIATAN_SHEET = "Monitoring_FAST";

/** Urutan header kolom PMB (jangan diubah — dipakai landing page PMB) */
const PMB_HEADERS = [
  "Timestamp", "Nama Lengkap", "NIK", "Tempat Lahir", "Tanggal Lahir",
  "Jenis Kelamin", "Email", "No HP/WA", "Alamat", "Provinsi",
  "Kota/Kabupaten", "Kecamatan", "Kelurahan/Desa", "Kode Pos",
  "Asal Sekolah", "Jurusan", "Tahun Lulus", "Jalur Pendaftaran", "Program Studi",
];

/** Urutan header kolom Monitoring_FAST (skema asli fakultas) */
const KEGIATAN_HEADERS = [
  "ID_Monitoring", "Timestamp_Input", "Bulan_Laporan", "Tahun_Laporan", "Periode",
  "Program_Studi", "Program", "Kegiatan", "Progres", "Tindak_Lanjut",
  "Target", "Status_Target", "Prioritas", "Penanggung_Jawab", "Hasil_Output",
  "Catatan", "Evaluasi_Feedback", "Updated_At",
];

/** Batas maksimum baris yang dikirim ke dashboard */
const MAX_ROWS = 5000;

/* ============================================================
   GET — baca data untuk dashboard
   ============================================================ */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "getAll";

  if (action === "ping") {
    return jsonOutput_({ ok: true, pong: true });
  }

  try {
    if (action === "getKegiatan") {
      return getSheetData_(KEGIATAN_SHEET_ID, KEGIATAN_SHEET);
    }
    return getSheetData_(PMB_SHEET_ID, PMB_SHEET); // getAll (default)
  } catch (err) {
    return jsonOutput_({ ok: false, error: "Terjadi kesalahan: " + err.message });
  }
}

/* ============================================================
   POST — simpan data (PMB atau Kegiatan)
   ============================================================ */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // --- Data Kegiatan → spreadsheet MONITORING FAST TERBARU ---
    if (data._tipe === "kegiatan") {
      const sheet = getSheet_(KEGIATAN_SHEET_ID, KEGIATAN_SHEET);
      const sekarang = new Date();

      // Bulan/Tahun laporan: dari form, atau diturunkan dari Tanggal Kegiatan
      let bulan = data.bulanLaporan || "";
      let tahun = data.tahunLaporan || "";
      if ((!bulan || !tahun) && data.tanggalKegiatan) {
        const d = new Date(data.tanggalKegiatan);
        if (!isNaN(d)) {
          if (!bulan) bulan = NAMA_BULAN_[d.getMonth()];
          if (!tahun) tahun = String(d.getFullYear());
        }
      }

      // Info tambahan (kategori/tempat/peserta/link) disisipkan ke Catatan
      const infoTambahan = [];
      if (data.kategori) infoTambahan.push("Kategori: " + data.kategori);
      if (data.tempat) infoTambahan.push("Tempat: " + data.tempat);
      if (data.jumlahPeserta) infoTambahan.push("Jumlah Peserta: " + data.jumlahPeserta);
      if (data.linkDokumentasi && data.linkDokumentasi !== data.hasilOutput) {
        infoTambahan.push("Dokumentasi: " + data.linkDokumentasi);
      }
      const catatan = [data.catatan || ""].concat(infoTambahan).filter(Boolean).join(" | ");

      sheet.appendRow([
        data.idMonitoring || buatIdMonitoring_(sheet), // ID_Monitoring
        sekarang,                                      // Timestamp_Input
        bulan || NAMA_BULAN_[sekarang.getMonth()],     // Bulan_Laporan
        tahun || String(sekarang.getFullYear()),       // Tahun_Laporan
        data.periode || "Bulanan",                     // Periode
        data.programStudi || "Program Studi Digabung", // Program_Studi
        data.program || "",                            // Program
        data.namaKegiatan || "",                       // Kegiatan
        data.progres || "",                            // Progres
        data.tindakLanjut || "",                       // Tindak_Lanjut
        data.target || "",                             // Target
        data.statusTarget || "",                       // Status_Target
        data.prioritas || "",                          // Prioritas
        data.pic || "",                                // Penanggung_Jawab
        data.hasilOutput || data.linkDokumentasi || "",// Hasil_Output
        catatan,                                       // Catatan
        data.evaluasiFeedback || "",                   // Evaluasi_Feedback
        sekarang,                                      // Updated_At
      ]);
      return jsonOutput_({ status: "success", message: "Kegiatan berhasil dicatat." });
    }

    // --- Data PMB (backward-compatible dengan landing page) ---
    const sheet = getSheet_(PMB_SHEET_ID, PMB_SHEET);
    sheet.appendRow([
      new Date(),
      data.namaLengkap || "", data.nik || "", data.tempatLahir || "",
      data.tanggalLahir || "", data.jenisKelamin || "", data.email || "",
      data.noHp || "", data.alamat || "", data.provinsi || "",
      data.kabupaten || "", data.kecamatan || "", data.kelurahan || "",
      data.kodePos || "", data.asalSekolah || "", data.jurusanSekolah || "",
      data.tahunLulus || "", data.jalur || "", data.programStudi || "",
    ]);
    return jsonOutput_({ status: "success", message: "Data pendaftaran berhasil disimpan." });
  } catch (err) {
    return jsonOutput_({ status: "error", message: "Terjadi kesalahan: " + err.message });
  }
}

const NAMA_BULAN_ = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/* ============================================================
   Helper
   ============================================================ */
function getSheetData_(spreadsheetId, sheetName) {
  const sheet = getSheet_(spreadsheetId, sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return jsonOutput_({ ok: true, total: 0, headers: [], rows: [] });
  }
  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(1, 1, Math.min(lastRow, MAX_ROWS + 1), lastCol).getValues();
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const rows = values.slice(1).map(function (r) {
    const obj = {};
    headers.forEach(function (h, i) {
      let v = r[i];
      if (v instanceof Date) v = v.toISOString();
      obj[h] = v == null ? "" : String(v);
    });
    return obj;
  });
  return jsonOutput_({ ok: true, total: rows.length, headers: headers, rows: rows });
}

function getSheet_(spreadsheetId, sheetName) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

/** Membuat ID Monitoring otomatis: FAST-YYYYMMDD-NNN (berdasarkan sheet tujuan) */
function buatIdMonitoring_(sheet) {
  const now = new Date();
  const ymd = now.getFullYear() + pad2_(now.getMonth() + 1) + pad2_(now.getDate());
  const prefix = "FAST-" + ymd + "-";
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 0; i < data.length; i++) {
    const m = String(data[i][0]).match(new RegExp("^" + prefix + "(\\d+)$"));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return prefix + pad3_(max + 1);
}

function pad2_(n) { return String(n).padStart(2, "0"); }
function pad3_(n) { return String(n).padStart(3, "0"); }

/** Jalankan untuk mengecek koneksi ke kedua spreadsheet */
function testConnection() {
  const pmb = SpreadsheetApp.openById(PMB_SHEET_ID);
  const keg = SpreadsheetApp.openById(KEGIATAN_SHEET_ID);
  Logger.log("Spreadsheet PMB: " + pmb.getName() + " → " + pmb.getSheets().map(function (s) { return s.getName(); }).join(", "));
  Logger.log("Spreadsheet Kegiatan: " + keg.getName() + " → " + keg.getSheets().map(function (s) { return s.getName(); }).join(", "));
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
