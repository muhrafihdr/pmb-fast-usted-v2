/* =========================================================
   FAST USTEDI — Lapisan Konten CMS (cms.js)
   ---------------------------------------------------------
   Panel admin menyimpan perubahan konten sebagai "override"
   di localStorage. Lapisan ini membuat seluruh halaman publik
   otomatis membaca versi terbaru tanpa perlu build ulang.

   Alur data:
     data/*.json (bawaan)  ->  override localStorage  ->  halaman
     Jika tidak ada override, berkas JSON bawaan dipakai.

   API publik (window.FAST.cms):
     ambil(path)          -> objek override atau null
     simpan(path, objek)  -> simpan override
     hapus(path)          -> hapus override satu berkas
     semua()              -> salinan semua override
     export()             -> paket cadangan
     import(paket)        -> pulihkan paket cadangan
     reset()              -> hapus semua override
     terapkan()           -> sinkronkan identitas ke FAST_CONFIG
   ========================================================= */
(function () {
  "use strict";

  var KEY = "fast_cms_data_v1";
  var VERSI = 1;
  var mem = baca();

  function salin(obj) {
    if (obj == null) return obj;
    try { return JSON.parse(JSON.stringify(obj)); }
    catch (e) { return obj; }
  }

  function kunci(path) {
    return String(path == null ? "" : path)
      .replace(/^\/+/, "")
      .replace(/^data\//, "");
  }

  function baca() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { versi: VERSI, diperbarui: null, file: {} };
      var d = JSON.parse(raw);
      if (!d || typeof d !== "object" || !d.file || typeof d.file !== "object") {
        return { versi: VERSI, diperbarui: null, file: {} };
      }
      d.versi = VERSI;
      return d;
    } catch (e) {
      return { versi: VERSI, diperbarui: null, file: {} };
    }
  }

  function simpanKePenyimpanan() {
    try {
      localStorage.setItem(KEY, JSON.stringify(mem));
    } catch (e) {
      throw new Error("Penyimpanan browser penuh atau diblokir. Hapus gambar besar atau gunakan mode privat.");
    }
  }

  function kabari() {
    try {
      window.dispatchEvent(new CustomEvent("fast:cms", { detail: mem.file }));
    } catch (e) { /* browser lama */ }
  }

  function terapkan() {
    if (!window.FAST_CONFIG || !window.FAST_CONFIG.org) return;
    var site = mem.file["site.json"];
    if (!site || !site.org) return;
    var org = site.org;
    Object.keys(org).forEach(function (k) {
      if (k === "instagram" && org.instagram && typeof org.instagram === "object") {
        window.FAST_CONFIG.org.instagram = Object.assign(
          {}, window.FAST_CONFIG.org.instagram || {}, org.instagram
        );
      } else if (org[k] !== undefined && org[k] !== null) {
        window.FAST_CONFIG.org[k] = org[k];
      }
    });
  }

  function ambil(path) {
    var k = kunci(path);
    return mem.file[k] ? salin(mem.file[k]) : null;
  }

  function simpan(path, objek) {
    var k = kunci(path);
    if (!k) throw new Error("Nama berkas konten tidak valid.");
    if (objek == null || typeof objek !== "object") {
      throw new Error("Konten harus berupa objek JSON.");
    }
    /* Pastikan dapat diserialisasi sebelum disimpan. */
    JSON.stringify(objek);
    mem.file[k] = salin(objek);
    mem.diperbarui = new Date().toISOString();
    simpanKePenyimpanan();
    terapkan();
    kabari();
    return salin(mem.file[k]);
  }

  function hapus(path) {
    var k = kunci(path);
    if (!mem.file[k]) return false;
    delete mem.file[k];
    mem.diperbarui = new Date().toISOString();
    simpanKePenyimpanan();
    terapkan();
    kabari();
    return true;
  }

  function semua() { return salin(mem.file); }

  function daftar() { return Object.keys(mem.file).sort(); }

  function exportPaket() {
    return {
      aplikasi: "FAST USTEDI CMS",
      versi: VERSI,
      diekspor: new Date().toISOString(),
      file: salin(mem.file)
    };
  }

  function importPaket(paket) {
    if (!paket || typeof paket !== "object") {
      throw new Error("Berkas cadangan tidak valid.");
    }
    var sumber = paket.file && typeof paket.file === "object" ? paket.file : paket;
    var bersih = {};
    Object.keys(sumber).forEach(function (k) {
      var nama = kunci(k);
      if (!nama || !/\.json$/i.test(nama)) return;
      var nilai = sumber[k];
      if (!nilai || typeof nilai !== "object") return;
      JSON.stringify(nilai);
      bersih[nama] = salin(nilai);
    });
    if (!Object.keys(bersih).length) {
      throw new Error("Tidak ada berkas konten yang dapat dipulihkan.");
    }
    mem = { versi: VERSI, diperbarui: new Date().toISOString(), file: bersih };
    simpanKePenyimpanan();
    terapkan();
    kabari();
    return daftar();
  }

  function reset() {
    mem = { versi: VERSI, diperbarui: null, file: {} };
    try { localStorage.removeItem(KEY); } catch (e) { /* abaikan */ }
    terapkan();
    kabari();
  }

  terapkan();

  window.FAST = window.FAST || {};
  window.FAST.cms = {
    kunci: kunci,
    ambil: ambil,
    simpan: simpan,
    hapus: hapus,
    semua: semua,
    daftar: daftar,
    export: exportPaket,
    exportPaket: exportPaket,
    import: importPaket,
    importPaket: importPaket,
    reset: reset,
    terapkan: terapkan,
    ada: function (path) { return !!mem.file[kunci(path)]; },
    jumlah: function () { return Object.keys(mem.file).length; },
    diperbarui: function () { return mem.diperbarui; },
    kunciPenyimpanan: KEY
  };
})();
