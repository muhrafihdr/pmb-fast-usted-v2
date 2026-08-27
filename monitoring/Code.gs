/**
 * ============================================================
 *  Monitoring FAST USTEDI — Google Apps Script (Backend)
 *  ------------------------------------------------------------
 *  MELAYANI data untuk dashboard Monitoring FAST DAN landing page PMB:
 *
 *   GET:
 *     ?action=ping        → cek backend aktif ({ok:true,pong:true})
 *     ?action=getAll      → baca data PMB (sheet "Pendaftar")
 *     ?action=getKegiatan → baca data Kegiatan (sheet "Monitoring_FAST")
 *
 *   POST (JSON):
 *     { _tipe:"kegiatan",  _aksi:"create"|"update"|"delete", ... }
 *        → spreadsheet KEGIATAN  (1HG1H9-... / sheet Monitoring_FAST)
 *     { _tipe:"pendaftar", _aksi:"create"|"update"|"delete", ... }
 *        → spreadsheet PMB       (1ddnHgb67-... / sheet Pendaftar)
 *     { ...data PMB landing page (tanpa _tipe) }
 *        → backward-compatible: tulis ke spreadsheet PMB
 *
 *  CARA PASANG (sekali saja):
 *   1. Buka https://script.google.com → New project → tempel file ini
 *      (atau GANTI isi project Apps Script yang sudah dipakai landing
 *       page PMB, lalu Deploy → Manage deployments → ✏️ New version)
 *   2. Deploy → New deployment → ⚙️ Web app
 *      - Execute as : Me | Who has access : Anyone
 *   3. Salin URL /exec → tempel ke DATA_SOURCE.gasUrl di script.js
 *      (Jika memakai project lama, URL tetap sama setelah New version.)
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

const NAMA_BULAN_ = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

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
   POST — simpan / ubah / hapus (Kegiatan, Pendaftar, atau PMB legacy)
   ============================================================ */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    /* ---------- KEGIATAN → spreadsheet MONITORING FAST TERBARU ---------- */
    if (data._tipe === "kegiatan") {
      const sheet = getSheet_(KEGIATAN_SHEET_ID, KEGIATAN_SHEET);
      ensureHeader_(sheet, KEGIATAN_HEADERS);
      const aksi = data._aksi || "create";
      const id = String(data._key || "").replace(/^id:/, "").trim();

      if (aksi === "delete") {
        const idx = findRowIndex_(sheet, "ID_Monitoring", id);
        if (idx <= 0) throw new Error("Kegiatan dengan ID " + id + " tidak ditemukan.");
        sheet.deleteRow(idx);
        return jsonOutput_({ status: "success", message: "Kegiatan dihapus dari spreadsheet." });
      }

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
      const sekarang = new Date();
      const idMonitoring = id || data.idMonitoring || buatIdMonitoring_(sheet);

      const baris = [
        idMonitoring,                                    // ID_Monitoring
        sekarang,                                        // Timestamp_Input (update: dipertahankan di bawah)
        bulan || NAMA_BULAN_[sekarang.getMonth()],       // Bulan_Laporan
        tahun || String(sekarang.getFullYear()),         // Tahun_Laporan
        data.periode || "Bulanan",                       // Periode
        data.programStudi || "Program Studi Digabung",   // Program_Studi
        data.program || "",                              // Program
        data.namaKegiatan || "",                         // Kegiatan
        data.progres || "",                              // Progres
        data.tindakLanjut || "",                         // Tindak_Lanjut
        data.target || "",                               // Target
        data.statusTarget || "",                         // Status_Target
        data.prioritas || "",                            // Prioritas
        data.pic || "",                                  // Penanggung_Jawab
        data.hasilOutput || data.linkDokumentasi || "",  // Hasil_Output
        catatan,                                         // Catatan
        data.evaluasiFeedback || "",                     // Evaluasi_Feedback
        sekarang,                                        // Updated_At
      ];

      if (aksi === "update") {
        const idx = findRowIndex_(sheet, "ID_Monitoring", idMonitoring);
        if (idx <= 0) throw new Error("Kegiatan dengan ID " + idMonitoring + " tidak ditemukan.");
        const old = sheet.getRange(idx, 1, 1, KEGIATAN_HEADERS.length).getValues()[0];
        baris[1] = old[1]; // pertahankan Timestamp_Input asli
        sheet.getRange(idx, 1, 1, KEGIATAN_HEADERS.length).setValues([baris]);
      } else {
        sheet.appendRow(baris);
      }
      return jsonOutput_({ status: "success", message: "Kegiatan berhasil disimpan." });
    }

    /* ---------- PENDAFTAR (PMB) → spreadsheet Pendaftar ---------- */
    if (data._tipe === "pendaftar") {
      const sheet = getSheet_(PMB_SHEET_ID, PMB_SHEET);
      ensureHeader_(sheet, PMB_HEADERS);
      const aksi = data._aksi || "create";
      const tsKey = String(data._key || "").trim();

      if (aksi === "delete") {
        const idx = findRowIndex_(sheet, "Timestamp", tsKey);
        if (idx <= 0) throw new Error("Data pendaftar tidak ditemukan di spreadsheet.");
        sheet.deleteRow(idx);
        return jsonOutput_({ status: "success", message: "Data pendaftar dihapus dari spreadsheet." });
      }

      const nilai = PMB_HEADERS.map(function (h) {
        if (h === "Timestamp") {
          const d = toDateVal_(ambil_(data, "Timestamp"));
          return d ? d : new Date();
        }
        return ambil_(data, h);
      });

      if (aksi === "update") {
        const idx = findRowIndex_(sheet, "Timestamp", tsKey);
        if (idx <= 0) throw new Error("Data pendaftar tidak ditemukan di spreadsheet.");
        const old = sheet.getRange(idx, 1, 1, PMB_HEADERS.length).getValues()[0];
        // Kolom kosong di payload → pertahankan nilai lama
        const gabung = nilai.map(function (v, i) {
          return (v === "" || v == null) ? old[i] : v;
        });
        sheet.getRange(idx, 1, 1, PMB_HEADERS.length).setValues([gabung]);
      } else {
        sheet.appendRow(nilai);
      }
      return jsonOutput_({ status: "success", message: "Data pendaftar berhasil disimpan." });
    }

    /* ---------- PMB legacy (landing page — tanpa _tipe) ---------- */
    const sheet = getSheet_(PMB_SHEET_ID, PMB_SHEET);
    ensureHeader_(sheet, PMB_HEADERS);
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

/** Cari baris data (mulai baris 2) yang nilai kolomnya sama dengan value.
    Untuk kolom tanggal (Timestamp): dibandingkan sebagai waktu (toleransi 3 dtk)
    agar format sheet (mis. 8:58 vs 08:58) tidak jadi masalah. */
function findRowIndex_(sheet, headerName, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const target = String(headerName).toLowerCase();
  let col = -1;
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === target) { col = i; break; }
  }
  if (col < 0) return -1;
  const vals = sheet.getRange(2, col + 1, lastRow - 1, 1).getValues();
  const wantDate = looksLikeDate_(value) ? toDateVal_(value) : null;
  const wantStr = String(value == null ? "" : value).trim();
  for (let i = 0; i < vals.length; i++) {
    const cell = vals[i][0];
    if (cell instanceof Date || wantDate) {
      const cellDate = toDateVal_(cell);
      if (cellDate && wantDate && Math.abs(cellDate.getTime() - wantDate.getTime()) < 3000) {
        return i + 2;
      }
    } else if (normVal_(cell) === wantStr) {
      return i + 2;
    }
  }
  return -1;
}

/** Apakah string tampak seperti tanggal (untuk pencocokan berbasis waktu). */
function looksLikeDate_(v) {
  const s = String(v == null ? "" : v).trim();
  return /^\d{1,2}\/\d{1,2}\/\d{4}/.test(s) ||
    /^\d{4}-\d{2}-\d{2}/.test(s) ||
    /^\d{4}\/\d{2}\/\d{2}/.test(s);
}

/** Normalisasi nilai sel untuk perbandingan (Date → dd/MM/yyyy HH:mm:ss). */
function normVal_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return fmtDmy_(v);
  return String(v == null ? "" : v).trim();
}
function fmtDmy_(d) {
  return pad2_(d.getDate()) + "/" + pad2_(d.getMonth() + 1) + "/" + d.getFullYear() +
    " " + pad2_(d.getHours()) + ":" + pad2_(d.getMinutes()) + ":" + pad2_(d.getSeconds());
}

/** Ubah string tanggal (dd/MM/yyyy, ISO, dsb.) menjadi Date bila bisa. */
function toDateVal_(v) {
  if (v instanceof Date) return v;
  if (v == null || String(v).trim() === "") return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

/** Ambil nilai dari payload — peka huruf besar/kecil pada nama kolom. */
function ambil_(data, name) {
  if (data == null) return "";
  if (data[name] !== undefined && data[name] !== null) return data[name];
  const lower = String(name).toLowerCase();
  const keys = Object.keys(data);
  for (let i = 0; i < keys.length; i++) {
    if (String(keys[i]).toLowerCase() === lower) return data[keys[i]];
  }
  return "";
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

/** Pastikan baris header ada di baris 1 (aman dipanggil berulang). */
function ensureHeader_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    const first = String(sheet.getRange(1, 1).getValue());
    if (first !== headers[0]) {
      sheet.insertRowsBefore(1, 1);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  const hr = sheet.getRange(1, 1, 1, headers.length);
  hr.setFontWeight("bold");
  hr.setBackground("#0d3b8c");
  hr.setFontColor("#ffffff");
  sheet.setFrozenRows(1);
}

/** (Opsional) Buat header kedua sheet — jalankan sekali dari editor. */
function setupHeaders() {
  ensureHeader_(getSheet_(PMB_SHEET_ID, PMB_SHEET), PMB_HEADERS);
  ensureHeader_(getSheet_(KEGIATAN_SHEET_ID, KEGIATAN_SHEET), KEGIATAN_HEADERS);
  Logger.log("Header siap: " + PMB_SHEET + " & " + KEGIATAN_SHEET);
}

/** (Opsional) Cek koneksi ke kedua spreadsheet di log editor. */
function testConnection() {
  const pmb = SpreadsheetApp.openById(PMB_SHEET_ID);
  const keg = SpreadsheetApp.openById(KEGIATAN_SHEET_ID);
  Logger.log("Spreadsheet PMB: " + pmb.getName() + " → " + pmb.getSheets().map(function (s) { return s.getName(); }).join(", "));
  Logger.log("Spreadsheet Kegiatan: " + keg.getName() + " → " + keg.getSheets().map(function (s) { return s.getName(); }).join(", "));
}

function pad2_(n) { return String(n).padStart(2, "0"); }
function pad3_(n) { return String(n).padStart(3, "0"); }

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
