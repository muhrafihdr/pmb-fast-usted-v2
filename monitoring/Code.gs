/**
 * ============================================================
 *  Monitoring FAST USTEDI — Google Apps Script (Backend)
 *  ------------------------------------------------------------
 *  MELAYANI DATA untuk dashboard Monitoring FAST:
 *   1. Baca data PMB (sheet "Pendaftar")       → doGet?action=getAll
 *   2. Baca data Kegiatan (sheet "Kegiatan")   → doGet?action=getKegiatan
 *      - Jika sheet Kegiatan masih kosong, OTOMATIS mengimpor
 *        data dari spreadsheet lama "MONITORING FAST TERBARU".
 *   3. Simpan kegiatan baru → doPost (JSON dengan _tipe:"kegiatan")
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

/** ID spreadsheet tujuan (utama — data PMB & Kegiatan baru) */
const SHEET_ID = "1ddnHgb67DdQmOfs4FTQQIGm1U8Qwah55gH-V1rVOks0";

/** ID spreadsheet LAMA (MONITORING FAST TERBARU — data kegiatan historis) */
const SPREADSHEET_LAMA_ID = "1HG1H9-_VZBBoml_WXpMqJ7aHuIQCRHH0545q94LqOls";

/** Nama sheet/tab */
const PMB_SHEET = "Pendaftar";
const KEGIATAN_SHEET = "Kegiatan";

/** Urutan header kolom PMB (jangan diubah — dipakai landing page PMB) */
const PMB_HEADERS = [
  "Timestamp", "Nama Lengkap", "NIK", "Tempat Lahir", "Tanggal Lahir",
  "Jenis Kelamin", "Email", "No HP/WA", "Alamat", "Provinsi",
  "Kota/Kabupaten", "Kecamatan", "Kelurahan/Desa", "Kode Pos",
  "Asal Sekolah", "Jurusan", "Tahun Lulus", "Jalur Pendaftaran", "Program Studi",
];

/** Urutan header kolom Kegiatan (skema lengkap monitoring) */
const KEGIATAN_HEADERS = [
  "Timestamp", "ID Monitoring", "Nama Kegiatan", "Tanggal Kegiatan", "Kategori",
  "Program", "Program Studi", "Bulan Laporan", "Tahun Laporan", "Periode",
  "Progres", "Penanggung Jawab", "Tempat", "Jumlah Peserta", "Prioritas",
  "Target", "Status Target", "Tindak Lanjut", "Hasil Output",
  "Catatan", "Evaluasi Feedback", "Link Dokumentasi",
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
      return getSheetData_(KEGIATAN_SHEET, KEGIATAN_HEADERS);
    }
    return getSheetData_(PMB_SHEET, PMB_HEADERS); // getAll (default)
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

    // --- Data Kegiatan ---
    if (data._tipe === "kegiatan") {
      const sheet = getSheet_(KEGIATAN_SHEET, KEGIATAN_HEADERS);
      sheet.appendRow([
        new Date(),                              // Timestamp
        data.idMonitoring || buatIdMonitoring_(sheet), // ID Monitoring
        data.namaKegiatan || "",
        data.tanggalKegiatan || "",
        data.kategori || "",
        data.program || "",
        data.programStudi || "",
        data.bulanLaporan || "",
        data.tahunLaporan || "",
        data.periode || "Bulanan",
        data.progres || "",
        data.pic || "",
        data.tempat || "",
        data.jumlahPeserta || "",
        data.prioritas || "",
        data.target || "",
        data.statusTarget || "",
        data.tindakLanjut || "",
        data.hasilOutput || "",
        data.catatan || "",
        data.evaluasiFeedback || "",
        data.linkDokumentasi || "",
      ]);
      return jsonOutput_({ status: "success", message: "Kegiatan berhasil dicatat." });
    }

    // --- Data PMB (backward-compatible dengan landing page) ---
    const sheet = getSheet_(PMB_SHEET, PMB_HEADERS);
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

/* ============================================================
   MIGRASI DATA LAMA (dari "MONITORING FAST TERBARU")
   ------------------------------------------------------------
   Jalankan sekali dari editor: pilih fungsi importKegiatanLama
   → Run. Atau biarkan otomatis: saat sheet Kegiatan kosong dan
   doGet?action=getKegiatan dipanggil, data lama ikut diimpor.
   ============================================================ */
function importKegiatanLama() {
  const ssLama = SpreadsheetApp.openById(SPREADSHEET_LAMA_ID);
  const sheetLama = ssLama.getSheetByName("Monitoring_FAST");
  if (!sheetLama) {
    // coba berdasarkan gid jika nama berbeda
    const byGid = ssLama.getSheets().filter(function (s) { return s.getSheetId() === 841580046; });
    if (!byGid.length) throw new Error("Sheet Monitoring_FAST tidak ditemukan di spreadsheet lama.");
    sheetLama = byGid[0];
  }

  const values = sheetLama.getDataRange().getValues();
  if (values.length < 2) {
    Logger.log("Spreadsheet lama kosong — tidak ada yang diimpor.");
    return 0;
  }

  const headers = values[0].map(function (h) { return String(h).trim(); });
  const target = getSheet_(KEGIATAN_SHEET, KEGIATAN_HEADERS);

  // Hindari duplikat berdasarkan ID Monitoring
  const existingIds = {};
  const targetData = target.getDataRange().getValues();
  targetData.forEach(function (row) { existingIds[String(row[1]).trim()] = true; });

  let count = 0;
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const o = {};
    headers.forEach(function (h, j) { o[h] = r[j] == null ? "" : r[j]; });

    const id = String(o["ID_Monitoring"] || "").trim();
    if (id && existingIds[id]) continue; // sudah ada

    target.appendRow([
      o["Timestamp_Input"] instanceof Date ? o["Timestamp_Input"] : new Date(o["Timestamp_Input"]),
      id,
      o["Kegiatan"] || "",
      "",
      "",
      o["Program"] || "",
      o["Program_Studi"] || "",
      o["Bulan_Laporan"] || "",
      o["Tahun_Laporan"] || "",
      o["Periode"] || "",
      o["Progres"] || "",
      o["Penanggung_Jawab"] || "",
      "",
      "",
      o["Prioritas"] || "",
      o["Target"] || "",
      o["Status_Target"] || "",
      o["Tindak_Lanjut"] || "",
      o["Hasil_Output"] || "",
      o["Catatan"] || "",
      o["Evaluasi_Feedback"] || "",
      "",
    ]);
    existingIds[id] = true;
    count++;
  }

  Logger.log("Impor selesai: " + count + " kegiatan ditambahkan.");
  return count;
}

/* Auto-impor saat sheet Kegiatan kosong (dipanggil dari getSheetData_) */
function autoImportKegiatan_() {
  try {
    importKegiatanLama();
  } catch (err) {
    Logger.log("Auto-impor dilewati: " + err.message);
  }
}

/* ============================================================
   Helper
   ============================================================ */
function getSheetData_(sheetName, defaultHeaders) {
  const sheet = getSheet_(sheetName, defaultHeaders);
  const lastRow = sheet.getLastRow();

  // Auto-impor data lama sekali saja (hanya jika sheet baru & kosong)
  if (sheetName === KEGIATAN_SHEET && lastRow <= 1) {
    autoImportKegiatan_();
    // muat ulang setelah impor
  }

  const rows2 = sheet.getLastRow();
  if (rows2 < 1) {
    return jsonOutput_({ ok: true, total: 0, headers: [], rows: [] });
  }
  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(1, 1, Math.min(rows2, MAX_ROWS + 1), lastCol).getValues();
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

function getSheet_(name, defaultHeaders) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (defaultHeaders && defaultHeaders.length) {
      sheet.appendRow(defaultHeaders);
      formatHeader_(sheet, defaultHeaders);
    }
  }
  return sheet;
}

function formatHeader_(sheet, headers) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight("bold");
  range.setBackground("#0d3b8c");
  range.setFontColor("#ffffff");
  sheet.setFrozenRows(1);
}

/** Membuat ID Monitoring otomatis: FAST-YYYYMMDD-NNN */
function buatIdMonitoring_(sheet) {
  const now = new Date();
  const ymd = now.getFullYear() + pad2_(now.getMonth() + 1) + pad2_(now.getDate());
  const prefix = "FAST-" + ymd + "-";
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][1]).match(new RegExp("^" + prefix + "(\\d+)$"));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return prefix + pad3_(max + 1);
}

function pad2_(n) { return String(n).padStart(2, "0"); }
function pad3_(n) { return String(n).padStart(3, "0"); }

/** Jalankan sekali (opsional) untuk menyiapkan header */
function setupHeaders() {
  getSheet_(PMB_SHEET, PMB_HEADERS);
  getSheet_(KEGIATAN_SHEET, KEGIATAN_HEADERS);
  Logger.log("Header siap: " + PMB_SHEET + " & " + KEGIATAN_SHEET);
}

/** Jalankan untuk mengecek koneksi ke spreadsheet */
function testConnection() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  Logger.log("Spreadsheet: " + ss.getName());
  Logger.log("Sheets: " + ss.getSheets().map(function (s) { return s.getName(); }).join(", "));
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
