/* =========================================================
   FAST USTEDI — Konfigurasi Pusat (config.js)
   ---------------------------------------------------------
   Satu tempat untuk mengatur: identitas situs, repositori
   data GitHub, penyedia SSO, dan backend Google Apps Script.
   Dimuat paling pertama oleh semua halaman (berita / pmb /
   academy / admin / portal).
   ========================================================= */
(function () {
  "use strict";

  var CONFIG = {
    /* ---------- Identitas Institusi ---------- */
    org: {
      kampus: "Universitas Sains Teknologi Ekonomi Digital Indonesia",
      fakultas: "Fakultas Sains dan Teknologi",
      singkatan: "FAST",
      domain: "fastustedi.web.id",
      alamat: "JL. MR. Koesbiyono Tjondrowibowo, Gunungpati, Semarang",
      whatsapp: "6288228995205",
      teleponTampil: "0882-2899-5205",
      email: "fast.ustedi@gmail.com",
      tahunBerdiri: "2024",
      jamLayanan: "Senin–Jumat, 08.00–16.00",
      instagram: {
        informatika: "https://www.instagram.com/informatika.ustedi/",
        sainsdata: "https://www.instagram.com/sainsdata.ustedi/",
        teknikindustri: "https://www.instagram.com/teknikindustri.ustedi/"
      }
    },

    /* ---------- Tiga Layanan Utama ---------- */
    layanan: [
      {
        id: "berita",
        nama: "Berita FAST",
        url: "/berita/",
        ikon: "📰",
        warna: "#0d3b8c",
        tagline: "Kabar, agenda, dan prestasi Fakultas Sains dan Teknologi"
      },
      {
        id: "pmb",
        nama: "PMB FAST",
        url: "/pmb/",
        ikon: "🎓",
        warna: "#f5b301",
        tagline: "Penerimaan Mahasiswa Baru — daftar online, mudah & cepat"
      },
      {
        id: "academy",
        nama: "Fast Academy",
        url: "https://script.google.com/macros/s/AKfycbxTc4rtNssp0LhMGoki5HW8PzXGcHeCmduIZ-xv4vrhisEWEd77s3qkzeuM16XjlFhzEQ/exec",
        ikon: "🧠",
        warna: "#16a34a",
        tagline: "Pelatihan, sertifikasi, dan kelas keterampilan digital"
      },
      {
        id: "blog",
        nama: "Blog FAST",
        url: "/blog/",
        ikon: "✍️",
        warna: "#0891b2",
        tagline: "Artikel, wawasan, dan gagasan sivitas akademika FAST"
      }
    ],

    /* ---------- Sumber Data (tersimpan di GitHub) ----------
       `repo`  : repositori publik tempat seluruh konten disimpan.
       `branch`: cabang yang dibaca & ditulis.
       `dataDir`: folder akar data JSON di dalam repositori.
       Konten publik (berita, katalog academy, konfigurasi situs,
       daftar peran pengguna) dibaca dari sini. Data pribadi
       pendaftar (NIK, dsb.) TIDAK disimpan di GitHub publik —
       tetap di Google Spreadsheet melalui Apps Script demi privasi.
    --------------------------------------------------------- */
    data: {
      owner: "muhrafihdr",
      repo: "pmb-fast-usted-v2",
      branch: "main",
      dataDir: "data",
      /* Repositori privat opsional untuk data sensitif (kosongkan bila tak ada). */
      privateRepo: "",
      /* Bila true, permintaan data diambil dari situs yang sama (origin),
         bukan raw.githubusercontent.com — lebih cepat & bebas cache CORS. */
      preferLocal: true
    },

    /* ---------- Google Apps Script (data PMB / pendaftar) ---------- */
    gas: {
      webAppUrl:
        "https://script.google.com/macros/s/AKfycbx6rfVnvF9VDRPG0KRtTclmA1VVRRCdNK5ERWl95udC4rir0G0qCi1stdVTMLYoaG0UQA/exec"
    },

    /* ---------- SSO (Single Sign-On) ----------
       Isi `googleClientId` dengan OAuth Client ID dari Google Cloud
       Console (lihat docs/SSO.md langkah demi langkah) dan
       `githubClientId` dengan Client ID GitHub OAuth App.
       Jika dikosongkan, situs otomatis berjalan dalam MODE DEMO
       (login lokal tanpa provider eksternal) agar tetap bisa diuji.
    --------------------------------------------------------- */
    sso: {
      /* Contoh: "1234567890-abc.apps.googleusercontent.com" */
      googleClientId: "",
      /* Contoh: "Ov23liXXXXXXXXXXXXXX" */
      githubClientId: "",
      /* Endpoint penukaran kode OAuth GitHub (Netlify Function). */
      githubProxy: "/.netlify/functions/oauth",
      /* Domain email yang otomatis diizinkan masuk (tanpa daftar peran). */
      allowedDomains: ["ustedi.ac.id", "student.ustedi.ac.id", "gmail.com"],
      /* Peran bawaan untuk pengguna yang lolos domain tapi belum terdaftar. */
      defaultRole: "viewer",
      /* Umur sesi (menit). */
      sessionMinutes: 480,
      /* Izinkan login demo (tanpa provider) — berguna saat pengembangan. */
      allowDemo: true,
      /* Kunci penyimpanan sesi (dibagi antar ketiga situs -> efek SSO). */
      storageKey: "fast_sso_session",
      redirectKey: "fast_sso_redirect"
    },

    /* ---------- Peran & Hak Akses ---------- */
    roles: {
      admin: { label: "Administrator", boleh: ["berita", "blog", "pmb", "academy", "admin"] },
      berita: { label: "Editor Berita", boleh: ["berita", "blog"] },
      blog: { label: "Editor Blog", boleh: ["blog"] },
      pmb: { label: "Operator PMB", boleh: ["pmb"] },
      academy: { label: "Pengelola Academy", boleh: ["academy"] },
      viewer: { label: "Pengguna Terdaftar", boleh: ["portal"] }
    },

    /* ---------- Versi aset (cache-busting) ---------- */
    versi: "20260219"
  };

  /* Ekspos sebagai global. */
  window.FAST_CONFIG = CONFIG;

  /* Helper singkat untuk membangun URL data GitHub. */
  window.FAST_CONFIG.dataUrl = function (relativePath) {
    var d = CONFIG.data;
    return (
      "https://raw.githubusercontent.com/" +
      d.owner + "/" + d.repo + "/" + d.branch + "/" +
      (d.dataDir ? d.dataDir + "/" : "") +
      String(relativePath).replace(/^\/+/, "")
    );
  };

  /* URL data lokal (same-origin) — dipakai bila preferLocal aktif. */
  window.FAST_CONFIG.localDataUrl = function (relativePath) {
    var d = CONFIG.data;
    var base = window.FAST_BASE || "/";
    return (
      base +
      (d.dataDir ? d.dataDir + "/" : "") +
      String(relativePath).replace(/^\/+/, "")
    );
  };

  /* Apakah provider SSO sudah dikonfigurasi? */
  window.FAST_CONFIG.ssoAktif = function () {
    return !!(CONFIG.sso.googleClientId || CONFIG.sso.githubClientId);
  };
})();
