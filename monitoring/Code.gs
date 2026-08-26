/**
 * ============================================================
 *  Monitoring FAST USTEDI — Google Apps Script (Backend Data)
 *  ------------------------------------------------------------
 *  Script ini dipasang sebagai Web App dan MELAYANI DATA
 *  untuk dashboard Monitoring FAST. Ia membaca data pendaftar
 *  dari Google Spreadsheet dan mengembalikannya sebagai JSON.
 *
 *  CARA MEMASANG (lihat README.md untuk langkah lengkap):
 *  1. Buka https://script.google.com → New project
 *  2. Hapus isi Code.gs bawaan, tempel seluruh file ini
 *  3. Ubah SHEET_ID / SHEET_NAME jika perlu
 *  4. Deploy → New deployment → Web app
 *     - Execute as : Me
 *     - Who has access : Anyone
 *  5. Salin URL Web App (berakhiran /exec)
 *  6. Tempel URL tersebut ke GAS_WEB_APP_URL di script.js
 *
 *  Endpoint:
 *    GET  ?action=getAll  → { ok, total, headers, rows }
 *    GET  ?action=ping    → { ok: true, pong: true }
 * ============================================================
 */

/** ID spreadsheet tujuan (dari URL pada tautan yang dibagikan) */
const SHEET_ID = "1ddnHgb67DdQmOfs4FTQQIGm1U8Qwah55gH-V1rVOks0";

/** Nama sheet/tab tempat data pendaftar disimpan */
const SHEET_NAME = "Pendaftar";

/** Batas maksimum baris yang dikirim ke dashboard (untuk keamanan) */
const MAX_ROWS = 5000;

/**
 * Handler GET — endpoint utama dashboard.
 * Contoh pemanggilan:
 *   https://script.google.com/macros/s/XXXX/exec?action=getAll
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "getAll";

  if (action === "ping") {
    return jsonOutput_({ ok: true, pong: true });
  }

  try {
    const sheet = getSheet_();
    const lastRow = sheet.getLastRow();

    if (lastRow < 1) {
      return jsonOutput_({ ok: true, total: 0, headers: [], rows: [] });
    }

    const lastCol = sheet.getLastColumn();
    const range = sheet.getRange(1, 1, Math.min(lastRow, MAX_ROWS + 1), lastCol);
    const values = range.getValues();

    const headers = values[0].map(function (h) {
      return String(h).trim();
    });

    // Seluruh baris data (baris 1 adalah header)
    const rows = values.slice(1).map(function (r) {
      const obj = {};
      headers.forEach(function (h, i) {
        let v = r[i];
        // Tanggal dikirim sebagai ISO string agar mudah diparse di browser
        if (v instanceof Date) {
          v = v.toISOString();
        }
        obj[h] = v == null ? "" : String(v);
      });
      return obj;
    });

    return jsonOutput_({
      ok: true,
      total: rows.length,
      headers: headers,
      rows: rows,
    });
  } catch (err) {
    return jsonOutput_({
      ok: false,
      error: "Terjadi kesalahan: " + err.message,
    });
  }
}

/**
 * (Opsional) Test menulis satu baris dari editor Apps Script.
 * Jalankan fungsi ini untuk memastikan akses ke sheet berfungsi.
 */
function testConnection() {
  const sheet = getSheet_();
  Logger.log("Sheet ditemukan: " + sheet.getName() + " | Baris: " + sheet.getLastRow());
}

/* ---------- Helper ---------- */

function getSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    // Jika sheet tidak ada, buat sheet kosong dengan header standar
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "Timestamp", "Nama Lengkap", "NIK", "Tempat Lahir", "Tanggal Lahir",
      "Jenis Kelamin", "Email", "No HP/WA", "Alamat", "Provinsi",
      "Kota/Kabupaten", "Kecamatan", "Kelurahan/Desa", "Kode Pos",
      "Asal Sekolah", "Jurusan", "Tahun Lulus", "Jalur Pendaftaran", "Program Studi",
    ]);
  }
  return sheet;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
