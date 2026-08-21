/**
 * ============================================================
 *  PMB FAST USTEDI — Google Apps Script
 *  ------------------------------------------------------------
 *  Script ini dipasang sebagai Web App dan menerima data
 *  formulir dari landing page, lalu menyimpannya ke Google
 *  Spreadsheet.
 *
 *  CARA MEMASANG (lihat README.md untuk langkah lengkap):
 *  1. Buka https://script.google.com
 *  2. Buat project baru, hapus isi Code.gs, tempel file ini
 *  3. Ubah SHEET_ID / SHEET_NAME jika perlu
 *  4. Jalankan fungsi setupHeaders() sekali (untuk membuat header)
 *  5. Deploy > New deployment > Web app
 *     - Execute as : Me
 *     - Who has access : Anyone
 *  6. Salin URL Web App ke GAS_WEB_APP_URL di script.js
 * ============================================================
 */

/** ID spreadsheet tujuan (dari URL pada tautan yang dibagikan) */
const SHEET_ID = "1ddnHgb67DdQmOfs4FTQQIGm1U8Qwah55gH-V1rVOks0";

/** Nama sheet/tab tempat data disimpan */
const SHEET_NAME = "Pendaftar";

/** Urutan header sesuai kolom di spreadsheet */
const HEADERS = [
  "Timestamp",
  "Nama Lengkap",
  "NIK",
  "Tempat Lahir",
  "Tanggal Lahir",
  "Jenis Kelamin",
  "Email",
  "No HP/WA",
  "Alamat",
  "Provinsi",
  "Kota/Kabupaten",
  "Kecamatan",
  "Kelurahan/Desa",
  "Kode Pos",
  "Asal Sekolah",
  "Jurusan",
  "Tahun Lulus",
  "Jalur Pendaftaran",
  "Program Studi",
];

/**
 * Menerima POST dari landing page.
 * Body: JSON string berisi data formulir.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getSheet_();

    sheet.appendRow([
      new Date(),                                    // Timestamp
      data.namaLengkap || "",
      data.nik || "",
      data.tempatLahir || "",
      data.tanggalLahir || "",
      data.jenisKelamin || "",
      data.email || "",
      data.noHp || "",
      data.alamat || "",
      data.provinsi || "",
      data.kabupaten || "",
      data.kecamatan || "",
      data.kelurahan || "",
      data.kodePos || "",
      data.asalSekolah || "",
      data.jurusanSekolah || "",
      data.tahunLulus || "",
      data.jalur || "",
      data.programStudi || "",
    ]);

    return jsonOutput_({
      status: "success",
      message: "Data pendaftaran berhasil disimpan.",
    });
  } catch (err) {
    return jsonOutput_({
      status: "error",
      message: "Terjadi kesalahan: " + err.message,
    });
  }
}

/**
 * Handler GET — berguna untuk mengecek bahwa Web App aktif.
 * Kunjungi URL Web App di browser; jika muncul tulisan "OK",
 * artinya deployment berhasil.
 */
function doGet() {
  return ContentService.createTextOutput("OK");
}

/**
 * Membuat header kolom pada sheet (jalankan sekali dari editor).
 * Aman dijalankan berulang — tidak akan menduplikasi header.
 */
function setupHeaders() {
  const sheet = getSheet_();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  // Format header agar tebal & berwarna
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#0d3b8c");
  headerRange.setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  Logger.log("Header siap di sheet: " + sheet.getName());
}

/**
 * (Opsional) Lihat data yang sudah masuk di log editor.
 */
function logData() {
  const sheet = getSheet_();
  const rows = sheet.getDataRange().getValues();
  Logger.log("Total baris: " + rows.length);
}

/* ---------- Helper ---------- */

function getSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
