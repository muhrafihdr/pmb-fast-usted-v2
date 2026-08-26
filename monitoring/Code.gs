/**
 * ============================================================
 *  Monitoring FAST USTEDI — Google Apps Script (Backend)
 *  ------------------------------------------------------------
 *  MELAYANI DATA untuk dashboard Monitoring FAST:
 *   1. Baca data PMB (sheet "Pendaftar")  → doGet?action=getAll
 *   2. Baca data Kegiatan (sheet "Kegiatan") → doGet?action=getKegiatan
 *   3. Simpan kegiatan baru → doPost (body JSON dengan _tipe:"kegiatan")
 *   4. (Backward-compatible) Simpan PMB → doPost (body JSON PMB lama)
 *
 *  CARA MEMASANG (dua pilihan):
 *  A. Pasang sebagai script BARU:
 *     1. https://script.google.com → New project → tempel file ini
 *     2. Deploy → New deployment → ⚙️ Web app
 *        - Execute as : Me | Who has access : Anyone
 *     3. Salin URL /exec → tempel ke DATA_SOURCE.gasUrl di script.js
 *  B. Perbarui script PMB yang SUDAH berjalan (URL tidak berubah):
 *     1. Buka project Apps Script PMB (yang ber-URL AKfycbzo4MNSZGeE...)
 *     2. Ganti Code.gs dengan file ini
 *     3. Deploy → Manage deployments → ✏️ Edit → New version → Deploy
 * ============================================================
 */

/** ID spreadsheet tujuan (dari URL pada tautan yang dibagikan) */
const SHEET_ID = "1ddnHgb67DdQmOfs4FTQQIGm1U8Qwah55gH-V1rVOks0";

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

/** Urutan header kolom Kegiatan */
const KEGIATAN_HEADERS = [
  "Timestamp", "Nama Kegiatan", "Tanggal Kegiatan", "Kategori",
  "Penanggung Jawab", "Tempat", "Jumlah Peserta", "Deskripsi",
  "Status", "Link Dokumentasi",
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
        new Date(),                            // Timestamp
        data.namaKegiatan || "",
        data.tanggalKegiatan || "",
        data.kategori || "",
        data.pic || "",
        data.tempat || "",
        data.jumlahPeserta || "",
        data.deskripsi || "",
        data.status || "",
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
   Helper
   ============================================================ */
function getSheetData_(sheetName, defaultHeaders) {
  const sheet = getSheet_(sheetName, defaultHeaders);
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

/** Jalankan sekali (opsional) untuk menyiapkan header kedua sheet */
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
