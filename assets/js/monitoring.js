/* =========================================================
   FAST USTEDI — Gerbang Monitoring FAST  ·  monitoring.js
   ---------------------------------------------------------
   Menu "Monitoring FAST" di navigasi utama dikunci dengan
   username & password yang SAMA dengan Panel Admin.

   Keamanan:
     - Tidak ada username/password asli di berkas ini.
     - Hanya sidik SHA-256 (dengan penggaraman sama seperti
       admin.js) yang disimpan.
     - Akses berlaku 2 jam dan disimpan di sessionStorage.
     - Setelah 5 percobaan gagal, akses dikunci 60 detik.

   Catatan: situs ini statis, sehingga gerbang ini melindungi
   antarmuka/navigasi di sisi klien. URL tujuan tetap dapat
   diakses langsung apabila seseorang mengetahuinya.
   ========================================================= */
(function () {
  "use strict";

  var CFG = window.FAST_CONFIG || {};
  var MON = CFG.monitoring || {};
  var NAMA = MON.nama || "Monitoring FAST";
  var URL_TUJUAN = MON.url || "https://sites.google.com/view/monitoringfast/monitoringfast";
  var MASA_BUKA = (Number(MON.masaBukaMenit) || 120) * 60 * 1000;

  var KUNCI_BUKA = "fast_monitoring_buka_v1";
  var KUNCI_GAGAL = "fast_monitoring_gagal_v1";
  var MAKS_GAGAL = 5;
  var KUNCI_MENIT = 60 * 1000;

  /* Sidik SHA-256 dari "FAST::USER::<username>" dan
     "FAST::PASS::<password>" — identik dengan Panel Admin.
     Bila kredensial admin diganti, ganti nilai di sini juga. */
  var HASH_USER = "bc9d601db153add2ff6a87b078e908882038a089caff1afa59b8ea622fed167f";
  var HASH_PASS = "c91f2c36f9483adeed7c9d884ffd6a46dc85c9e85bb1f46c0361e81496c6f1ed";

  var SVG_LOCK =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="4" y="10" width="16" height="11" rx="2"></rect>' +
      '<path d="M8 10V7a4 4 0 0 1 8 0v3"></path>' +
    "</svg>";
  var SVG_EYE =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>' +
      '<circle cx="12" cy="12" r="3"></circle>' +
    "</svg>";
  var SVG_EYE_OFF =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>' +
      '<line x1="1" y1="1" x2="23" y2="23"></line>' +
    "</svg>";

  var modal = null;
  var pemicu = null;

  function aman(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------------- Sesi akses ---------------- */
  function bacaBuka() {
    try {
      var raw = sessionStorage.getItem(KUNCI_BUKA);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.exp || Date.now() > s.exp) {
        sessionStorage.removeItem(KUNCI_BUKA);
        return null;
      }
      return s;
    } catch (e) {
      return null;
    }
  }

  function tulisBuka(s) {
    try {
      if (s) sessionStorage.setItem(KUNCI_BUKA, JSON.stringify(s));
      else sessionStorage.removeItem(KUNCI_BUKA);
    } catch (e) { /* sessionStorage bisa diblokir */ }
  }

  function sudahBuka() {
    return !!bacaBuka();
  }

  /* ---------------- Batas percobaan ---------------- */
  function bacaGagal() {
    try {
      var g = JSON.parse(localStorage.getItem(KUNCI_GAGAL) || "{}");
      return { n: Number(g.n) || 0, sampai: Number(g.sampai) || 0 };
    } catch (e) {
      return { n: 0, sampai: 0 };
    }
  }

  function tulisGagal(g) {
    try { localStorage.setItem(KUNCI_GAGAL, JSON.stringify(g)); } catch (e) { /* abaikan */ }
  }

  function statusKunci() {
    var g = bacaGagal();
    if (g.sampai && Date.now() < g.sampai) {
      return Math.ceil((g.sampai - Date.now()) / 1000);
    }
    if (g.sampai && Date.now() >= g.sampai) {
      g.n = 0; g.sampai = 0; tulisGagal(g);
    }
    return 0;
  }

  /* ---------------- Sidik & pembanding ---------------- */
  function heks(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
      return ("0" + b.toString(16)).slice(-2);
    }).join("");
  }

  function hashTeks(teks) {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(teks))
        .then(heks);
    }
    return Promise.reject(new Error(
      "Verifikasi akses memerlukan HTTPS atau localhost. Buka situs melalui alamat https://…"
    ));
  }

  function samakan(a, b) {
    a = String(a || "");
    b = String(b || "");
    if (a.length !== b.length) return false;
    var beda = 0;
    for (var i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return beda === 0;
  }

  /* ---------------- Tampilan modal ---------------- */
  function pasangModal() {
    if (modal && document.body.contains(modal)) return modal;

    modal = document.createElement("div");
    modal.className = "fmodal";
    modal.id = "fastModalMonitoring";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "monJudul");
    modal.innerHTML =
      '<div class="fmodal-latar" data-tutup></div>' +
      '<div class="fmodal-kotak">' +
        '<button class="fmodal-tutup" type="button" data-tutup aria-label="Tutup">✕</button>' +
        '<div class="fmodal-kepala">' +
          '<span class="mon-ikon" aria-hidden="true">' + SVG_LOCK + "</span>" +
          '<h2 id="monJudul">' + aman(NAMA) + "</h2>" +
          "<p>Akses terbatas. Masukkan username dan password admin untuk membuka dashboard " + aman(NAMA) + ".</p>" +
        "</div>" +
        '<div class="mon-pesan" id="monPesan" hidden></div>' +
        '<form id="monForm" autocomplete="off" novalidate>' +
          '<div class="mon-field">' +
            '<label for="monUser">Username</label>' +
            '<input type="text" id="monUser" name="username" autocomplete="username" ' +
              'placeholder="Username admin" required spellcheck="false" />' +
          "</div>" +
          '<div class="mon-field mon-pass">' +
            '<label for="monPass">Password</label>' +
            '<input type="password" id="monPass" name="password" autocomplete="current-password" ' +
              'placeholder="Password admin" required />' +
            '<button type="button" id="monToggle" aria-label="Tampilkan kata sandi" ' +
              'aria-pressed="false" title="Tampilkan kata sandi">' + SVG_EYE + "</button>" +
          "</div>" +
          '<button type="submit" class="btn btn-utama btn-blok" id="monBtn">' +
            '<span class="teks-btn">Buka Dashboard</span>' +
          "</button>" +
        "</form>" +
        '<div class="mon-sukses" id="monSukses" hidden>' +
          "<p>Akses diberikan. Klik tombol berikut untuk membuka dashboard.</p>" +
          '<a class="btn btn-utama btn-blok" id="monTautan" href="' + aman(URL_TUJUAN) + '" ' +
            'target="_blank" rel="noopener">Buka ' + aman(NAMA) + "</a>" +
        "</div>" +
        '<p class="mon-catatan">Gunakan username dan password yang sama dengan Panel Admin. ' +
          "Akses berlaku " + Math.round(MASA_BUKA / 60000) + " menit.</p>" +
      "</div>";
    document.body.appendChild(modal);

    modal.querySelectorAll("[data-tutup]").forEach(function (b) {
      b.addEventListener("click", tutup);
    });

    var inputPass = modal.querySelector("#monPass");
    var toggle = modal.querySelector("#monToggle");
    toggle.addEventListener("click", function () {
      var tampil = inputPass.type === "password";
      inputPass.type = tampil ? "text" : "password";
      toggle.innerHTML = tampil ? SVG_EYE_OFF : SVG_EYE;
      toggle.setAttribute("aria-pressed", String(tampil));
      toggle.setAttribute("aria-label", tampil ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
      toggle.setAttribute("title", tampil ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
    });

    modal.querySelector("#monForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      cobaMasuk();
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !modal.hidden) tutup();
    });

    return modal;
  }

  function pesan(teks, info) {
    var p = modal && modal.querySelector("#monPesan");
    if (!p) return;
    if (!teks) { p.hidden = true; p.textContent = ""; return; }
    p.hidden = false;
    p.textContent = teks;
    p.classList.toggle("info", !!info);
  }

  function setLoading(muat) {
    var btn = modal && modal.querySelector("#monBtn");
    var teks = btn && btn.querySelector(".teks-btn");
    if (btn) btn.disabled = !!muat;
    if (teks) teks.textContent = muat ? "Memeriksa…" : "Buka Dashboard";
  }

  function resetForm() {
    var form = modal.querySelector("#monForm");
    var sukses = modal.querySelector("#monSukses");
    if (form) { form.hidden = false; form.reset(); }
    if (sukses) sukses.hidden = true;
    pesan("");
    setLoading(false);
    var pass = modal.querySelector("#monPass");
    if (pass) pass.type = "password";
    var toggle = modal.querySelector("#monToggle");
    if (toggle) {
      toggle.innerHTML = SVG_EYE;
      toggle.setAttribute("aria-pressed", "false");
      toggle.setAttribute("aria-label", "Tampilkan kata sandi");
      toggle.setAttribute("title", "Tampilkan kata sandi");
    }
  }

  function bukaModal(ev) {
    pemicu = ev && ev.currentTarget ? ev.currentTarget : document.getElementById("fnavMonitoring");
    if (sudahBuka()) { bukaTujuan(); return; }

    pasangModal();
    resetForm();
    modal.hidden = false;
    document.body.style.overflow = "hidden";

    var tunggu = statusKunci();
    if (tunggu > 0) {
      pesan("Terlalu banyak percobaan. Coba lagi dalam " + tunggu + " detik.");
    }

    setTimeout(function () {
      var u = modal.querySelector("#monUser");
      if (u) u.focus();
    }, 60);
  }

  function tutup() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    if (pemicu && document.contains(pemicu)) {
      try { pemicu.focus({ preventScroll: true }); } catch (e) { pemicu.focus(); }
    }
  }

  function tampilkanSukses() {
    if (!modal) return;
    var form = modal.querySelector("#monForm");
    var sukses = modal.querySelector("#monSukses");
    if (form) form.hidden = true;
    if (sukses) sukses.hidden = false;
    pesan("");
  }

  function bukaTujuan() {
    var jendela = null;
    try { jendela = window.open(URL_TUJUAN, "_blank"); } catch (e) { jendela = null; }
    segarkanMenu();
    if (jendela) {
      try { jendela.opener = null; } catch (e) { /* abaikan */ }
      tutup();
      return;
    }
    /* Popup diblokir: tampilkan tombol tautan sebagai jalan keluar. */
    if (!modal) { pasangModal(); resetForm(); }
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    tampilkanSukses();
  }

  function cobaMasuk() {
    var user = (modal.querySelector("#monUser") || {}).value || "";
    var pass = (modal.querySelector("#monPass") || {}).value || "";
    user = user.trim();

    if (!user || !pass) {
      pesan("Isi username dan password terlebih dahulu.");
      return;
    }

    var tunggu = statusKunci();
    if (tunggu > 0) {
      pesan("Terlalu banyak percobaan. Coba lagi dalam " + tunggu + " detik.");
      return;
    }

    setLoading(true);
    pesan("");

    Promise.all([
      hashTeks("FAST::USER::" + user),
      hashTeks("FAST::PASS::" + pass)
    ]).then(function (h) {
      var cocok = samakan(h[0], HASH_USER) & samakan(h[1], HASH_PASS);
      if (!cocok) {
        var g = bacaGagal();
        g.n = (g.n || 0) + 1;
        if (g.n >= MAKS_GAGAL) {
          g.sampai = Date.now() + KUNCI_MENIT;
          g.n = 0;
          tulisGagal(g);
          pesan("Terlalu banyak percobaan. Akses dikunci selama 60 detik.");
        } else {
          tulisGagal(g);
          pesan("Username atau password salah. Sisa percobaan: " + (MAKS_GAGAL - g.n) + ".");
        }
        var inputPass = modal.querySelector("#monPass");
        if (inputPass) { inputPass.value = ""; inputPass.focus(); }
        setLoading(false);
        return;
      }

      tulisGagal({ n: 0, sampai: 0 });
      tulisBuka({ exp: Date.now() + MASA_BUKA, mulai: Date.now() });
      setLoading(false);
      segarkanMenu();
      if (window.FAST && window.FAST.ui && window.FAST.ui.toast) {
        window.FAST.ui.toast("Akses Monitoring FAST diberikan.", "sukses");
      }
      bukaTujuan();
    }).catch(function (e) {
      setLoading(false);
      pesan(e.message || "Gagal memverifikasi akses.");
    });
  }

  /* ---------------- Item navigasi ---------------- */
  function segarkanMenu() {
    var btn = document.getElementById("fnavMonitoring");
    if (!btn) return;
    var buka = sudahBuka();
    btn.classList.toggle("terbuka", buka);
    btn.title = buka
      ? "Akses terbuka untuk sesi ini — klik untuk membuka dashboard"
      : "Akses terbatas — perlu username & password admin";
    btn.setAttribute("aria-label", NAMA + (buka ? " (akses terbuka)" : " (terkunci)"));
  }

  function pasangMenu() {
    var menu = document.getElementById("fnavMenu");
    if (!menu || document.getElementById("fnavMonitoring")) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "fnavMonitoring";
    btn.className = "fnav-layanan fnav-monitoring";
    btn.setAttribute("aria-haspopup", "dialog");
    btn.innerHTML = SVG_LOCK + "<span>" + aman(NAMA) + "</span>";
    btn.addEventListener("click", bukaModal);

    var kontak = menu.querySelector('a[href$="#kontak"]');
    if (kontak) menu.insertBefore(btn, kontak);
    else menu.appendChild(btn);

    segarkanMenu();
  }

  function init() {
    pasangMenu();
    if (window.location.hash === "#monitoring" || window.location.hash === "#monitoringfast") {
      bukaModal();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.FAST = window.FAST || {};
  window.FAST.monitoring = {
    buka: bukaModal,
    sudahBuka: sudahBuka,
    url: URL_TUJUAN
  };
})();