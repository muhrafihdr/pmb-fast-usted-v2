/* =========================================================
   FAST USTEDI — Komponen UI Bersama (ui.js)
   ---------------------------------------------------------
   Header, footer, tombol SSO, toast, dan utilitas tampilan
   yang dipakai bersama oleh portal, berita, pmb, academy,
   dan admin. Menjaga tampilan tetap konsisten.

   Setiap halaman menyetel variabel berikut SEBELUM ui.js:
     window.FAST_PAGE = {
       modul : "berita",              // untuk penanda menu aktif
       nav   : [{label,href}, ...],   // tautan khusus halaman
       simpul: ["judul halaman"]      // breadcrumb (opsional)
     };
   ========================================================= */
(function () {
  "use strict";

  var CFG = window.FAST_CONFIG;
  var PAGE = window.FAST_PAGE || {};
  var BASE = window.FAST_BASE || "/";
  var SITE_DATA = null;

  /* ---------------- Utilitas ---------------- */
  function el(tag, attr, isi) {
    var n = document.createElement(tag);
    if (attr) Object.keys(attr).forEach(function (k) {
      if (k === "class") n.className = attr[k];
      else if (k === "html") n.innerHTML = attr[k];
      else if (k === "text") n.textContent = attr[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attr[k]);
      else if (attr[k] != null) n.setAttribute(k, attr[k]);
    });
    if (isi != null) n.innerHTML = isi;
    return n;
  }

  function aman(teks) {
    return String(teks == null ? "" : teks)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli",
    "Agustus","September","Oktober","November","Desember"];
  var HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

  function tanggal(nilai, gaya) {
    if (!nilai) return "";
    var d = (nilai instanceof Date) ? nilai : new Date(nilai);
    if (isNaN(d.getTime())) return String(nilai);
    gaya = gaya || "panjang";
    if (gaya === "iso") return d.toISOString().slice(0, 10);
    if (gaya === "pendek") return d.getDate() + " " + BULAN[d.getMonth()].slice(0, 3) + " " + d.getFullYear();
    if (gaya === "hari") return HARI[d.getDay()] + ", " + d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
    return d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
  }

  function relatif(nilai) {
    var d = new Date(nilai);
    if (isNaN(d.getTime())) return "";
    var selisih = Math.floor((Date.now() - d.getTime()) / 1000);
    if (selisih < 60) return "baru saja";
    if (selisih < 3600) return Math.floor(selisih / 60) + " menit lalu";
    if (selisih < 86400) return Math.floor(selisih / 3600) + " jam lalu";
    if (selisih < 604800) return Math.floor(selisih / 86400) + " hari lalu";
    return tanggal(d, "pendek");
  }

  function singkat(teks, n) {
    teks = String(teks || "").replace(/\s+/g, " ").trim();
    return teks.length > n ? teks.slice(0, n - 1).trim() + "…" : teks;
  }

  /* ---------------- Toast ---------------- */
  var wadahToast = null;
  function toast(pesan, jenis, durasi) {
    if (!wadahToast) {
      wadahToast = el("div", { class: "fast-toasts", role: "status", "aria-live": "polite" });
      document.body.appendChild(wadahToast);
    }
    var t = el("div", { class: "fast-toast fast-toast-" + (jenis || "info") }, aman(pesan));
    wadahToast.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("tampil"); });
    setTimeout(function () {
      t.classList.remove("tampil");
      setTimeout(function () { t.remove(); }, 300);
    }, durasi || 3600);
  }

  /* ---------------- Header ---------------- */
  function bangunHeader() {
    var host = document.getElementById("fast-header");
    if (!host) return;

    var header = el("header", { class: "fnav", id: "fnav" });
    var inner = el("div", { class: "fnav-inner" });

    /* Merek */
    var merek = el("a", { href: BASE, class: "fnav-brand", "aria-label": "FAST USTEDI" });
    merek.innerHTML =
      '<img src="' + BASE + 'assets/img/logo-fast.png" alt="Logo FAST" />' +
      '<span class="fnav-brand-teks"><strong>FAST</strong><small>USTEDI</small></span>';
    inner.appendChild(merek);

    /* Menu utama */
    var menu = el("nav", { class: "fnav-menu", id: "fnavMenu", "aria-label": "Navigasi utama" });

    CFG.layanan.forEach(function (l) {
      var aktif = (PAGE.modul === l.id) || (l.id === "berita" && PAGE.modul === "berita");
      menu.appendChild(el("a", {
        href: BASE + l.id + "/",
        class: "fnav-layanan" + (aktif ? " aktif" : ""),
        title: l.tagline
      }, '<span aria-hidden="true">' + l.ikon + "</span> " + aman(l.nama)));
    });

    if (Array.isArray(PAGE.nav)) {
      var pemisah = el("span", { class: "fnav-sep", "aria-hidden": "true" });
      menu.appendChild(pemisah);
      PAGE.nav.forEach(function (n) {
        if (n.khusus) {
          menu.appendChild(el("a", { href: n.href, class: "fnav-link fnav-khusus" }, aman(n.label)));
        } else {
          menu.appendChild(el("a", { href: n.href, class: "fnav-link" }, aman(n.label)));
        }
      });
    }
    inner.appendChild(menu);

    /* Area pengguna (SSO) */
    var area = el("div", { class: "fnav-user", id: "fnavUser" });
    inner.appendChild(area);

    /* Tombol menu mobile */
    var toggle = el("button", {
      class: "fnav-toggle", id: "fnavToggle",
      "aria-label": "Buka menu", "aria-expanded": "false"
    }, "<span></span><span></span><span></span>");
    inner.appendChild(toggle);

    header.appendChild(inner);
    host.appendChild(header);

    toggle.addEventListener("click", function () {
      var buka = menu.classList.toggle("buka");
      toggle.classList.toggle("aktif", buka);
      toggle.setAttribute("aria-expanded", String(buka));
    });

    var onScroll = function () {
      header.classList.toggle("tergulir", window.scrollY > 24);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    renderPengguna(area);
  }

  /* ---------------- Widget pengguna (SSO) ---------------- */
  function renderPengguna(host) {
    host.innerHTML = "";
    if (!window.FAST || !window.FAST.auth) return;
    var A = window.FAST.auth;
    var s = A.sesi();

    if (!s) {
      var masuk = el("a", { href: BASE + "#masuk", class: "btn btn-garis btn-kecil" }, "Masuk SSO");
      host.appendChild(masuk);
      return;
    }

    var kotak = el("div", { class: "fnav-akun" });
    var tombol = el("button", { class: "fnav-akun-tombol", "aria-haspopup": "true", "aria-expanded": "false" });
    var ava = s.gambar
      ? '<img src="' + aman(s.gambar) + '" alt="" />'
      : '<span class="fnav-ava-huruf">' + aman((s.nama || s.email || "?").charAt(0).toUpperCase()) + "</span>";
    tombol.innerHTML =
      '<span class="fnav-ava">' + ava + "</span>" +
      '<span class="fnav-akun-nama">' + aman(singkat(s.nama || s.email, 18)) + "</span>" +
      '<span class="fnav-karet" aria-hidden="true">▾</span>';
    kotak.appendChild(tombol);

    var drop = el("div", { class: "fnav-drop", hidden: "hidden" });
    drop.innerHTML =
      '<div class="fnav-drop-kepala">' +
        "<strong>" + aman(s.nama || s.email) + "</strong>" +
        "<small>" + aman(s.email) + "</small>" +
        '<div class="fnav-peran">' +
          (s.peran || []).map(function (p) {
            var d = CFG.roles[p];
            return '<span class="tag-peran">' + aman(d ? d.label : p) + "</span>";
          }).join("") +
        "</div>" +
      "</div>";

    if (A.boleh("admin")) {
      drop.appendChild(el("a", { href: BASE + "admin/", class: "fnav-drop-item" }, "⚙️ Panel Admin"));
    }
    if (A.boleh("berita")) {
      drop.appendChild(el("a", { href: BASE + "admin/#/berita", class: "fnav-drop-item" }, "📰 Kelola Berita"));
    }
    if (A.boleh("blog")) {
      drop.appendChild(el("a", { href: BASE + "admin/#/blog", class: "fnav-drop-item" }, "✍️ Kelola Blog"));
    }
    if (A.boleh("academy")) {
      drop.appendChild(el("a", { href: BASE + "admin/#/academy", class: "fnav-drop-item" }, "🧠 Kelola Academy"));
    }
    drop.appendChild(el("a", { href: BASE + "pmb/#status", class: "fnav-drop-item" }, "🎓 Status Pendaftaran"));
    drop.appendChild(el("button", {
      class: "fnav-drop-item fnav-drop-keluar", type: "button",
      onclick: function () {
        A.keluar();
        toast("Anda telah keluar dari SSO.", "info");
      }
    }, "🚪 Keluar"));

    kotak.appendChild(drop);

    tombol.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var tersembunyi = drop.hasAttribute("hidden");
      drop.toggleAttribute("hidden", !tersembunyi);
      tombol.setAttribute("aria-expanded", String(tersembunyi));
    });
    document.addEventListener("click", function () { drop.setAttribute("hidden", "hidden"); });
    drop.addEventListener("click", function (ev) { ev.stopPropagation(); });

    host.appendChild(kotak);
  }

  /* ---------------- Footer ---------------- */
  function bangunFooter() {
    var host = document.getElementById("fast-footer");
    if (!host) return;
    var cmsSite = window.FAST.cms ? window.FAST.cms.ambil("site.json") : null;
    var site = cmsSite || SITE_DATA || null;
    var o = (site && site.org) ? site.org : CFG.org;
    var igData = Object.assign({}, CFG.org.instagram || {}, (o && o.instagram) || {});
    var daftarProdi = (site && site.programStudi && site.programStudi.length)
      ? site.programStudi
      : [{ nama: "S1 Informatika" }, { nama: "S1 Sains Data" }, { nama: "S1 Teknik Industri" }];
    var ig = function (url, label) {
      if (!url) return "";
      return '<a href="' + aman(url) + '" target="_blank" rel="noopener">' + aman(label) + "</a>";
    };
    host.innerHTML =
      '<footer class="ffoot">' +
        '<div class="wadah ffoot-grid">' +
          '<div class="ffoot-kolom ffoot-merek">' +
            '<img src="' + BASE + 'assets/img/logo-fast.png" alt="Logo FAST" class="ffoot-logo" />' +
            "<p><strong>" + aman(o.fakultas) + " (FAST)</strong><br />" + aman(o.kampus) + "</p>" +
          "</div>" +
          '<div class="ffoot-kolom">' +
            "<h4>Layanan</h4>" +
            CFG.layanan.map(function (l) {
              return '<a href="' + BASE + l.id + '/">' + l.ikon + " " + aman(l.nama) + "</a>";
            }).join("") +
            '<a href="' + BASE + 'monitoring/">📊 Monitoring</a>' +
          "</div>" +
          '<div class="ffoot-kolom">' +
            "<h4>Program Studi</h4>" +
            daftarProdi.map(function (p) { return "<p>" + aman(p.nama) + "</p>"; }).join("") +
          "</div>" +
          '<div class="ffoot-kolom">' +
            "<h4>Kontak</h4>" +
            '<p><a href="https://wa.me/' + aman(o.whatsapp) + '" target="_blank" rel="noopener">💬 ' + aman(o.teleponTampil) + "</a></p>" +
            '<p><a href="mailto:' + aman(o.email) + '">📧 ' + aman(o.email) + "</a></p>" +
            "<p>📍 " + aman(o.alamat) + "</p>" +
            "<h4>Instagram</h4>" +
            ig(igData.informatika, "Informatika") +
            ig(igData.sainsdata, "Sains Data") +
            ig(igData.teknikindustri, "Teknik Industri") +
          "</div>" +
        "</div>" +
        '<div class="ffoot-bawah"><div class="wadah">' +
          "<p>© <span id=\"fast-tahun\"></span> " + aman(o.fakultas) + " " + aman(o.singkatan) + " · " + aman(o.kampus) + "</p>" +
          '<p class="ffoot-sso">Sistem terintegrasi SSO · <a href="' + BASE + 'docs/SSO.md">Dokumentasi</a> · <a href="' + BASE + 'admin/" class="ffoot-admin" title="Panel pengelolaan konten">🔒 Admin</a></p>' +
        "</div></div>" +
      "</footer>";
    var th = document.getElementById("fast-tahun");
    if (th) th.textContent = new Date().getFullYear();
  }

  /* ---------------- Modal masuk (SSO) ---------------- */
  function bangunModalMasuk() {
    if (document.getElementById("fastModalMasuk")) return;
    var m = el("div", { class: "fmodal", id: "fastModalMasuk", hidden: "hidden", role: "dialog", "aria-modal": "true", "aria-labelledby": "fastModalJudul" });
    m.innerHTML =
      '<div class="fmodal-latar" data-tutup></div>' +
      '<div class="fmodal-kotak">' +
        '<button class="fmodal-tutup" data-tutup aria-label="Tutup">✕</button>' +
        '<div class="fmodal-kepala">' +
          '<img src="' + BASE + 'assets/img/logo-fast.png" alt="FAST" />' +
          '<h2 id="fastModalJudul">Masuk dengan SSO</h2>' +
          "<p>Satu akun untuk seluruh layanan FAST USTEDI — Berita, PMB, dan Academy.</p>" +
        "</div>" +
        '<div class="fmodal-isi">' +
          '<div class="sso-tombol">' +
            '<div id="ssoGoogle"></div>' +
            '<button type="button" class="btn btn-github btn-blok" id="ssoGithub">' +
              '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>' +
              "Masuk dengan GitHub" +
            "</button>" +
          "</div>" +
          '<div class="sso-pemisah"><span>atau</span></div>' +
          '<form class="sso-demo" id="ssoDemo" autocomplete="off">' +
            "<label for=\"ssoEmailDemo\">Mode demo (pengembangan)</label>" +
            '<div class="sso-demo-baris">' +
              '<input type="email" id="ssoEmailDemo" placeholder="nama@ustedi.ac.id" value="admin@ustedi.ac.id" />' +
              '<button type="submit" class="btn btn-utama btn-kecil">Masuk</button>' +
            "</div>" +
            '<small>Demo admin: <code>admin@ustedi.ac.id</code> · editor: <code>berita@ustedi.ac.id</code> · academy: <code>academy@ustedi.ac.id</code></small>' +
          "</form>" +
          '<p class="sso-catatan" id="ssoCatatan"></p>' +
        "</div>" +
      "</div>";
    document.body.appendChild(m);

    function tutup() { m.setAttribute("hidden", "hidden"); document.body.style.overflow = ""; }
    m.querySelectorAll("[data-tutup]").forEach(function (b) { b.addEventListener("click", tutup); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") tutup(); });
    m._buka = function () { m.removeAttribute("hidden"); document.body.style.overflow = "hidden"; };
    m._tutup = tutup;

    /* Tombol Google resmi */
    window.FAST.auth.siapkanTombol(document.getElementById("ssoGoogle"), {
      onSuccess: function () { toast("Berhasil masuk. Selamat datang!", "sukses"); m._tutup(); }
    });

    /* GitHub */
    document.getElementById("ssoGithub").addEventListener("click", function () {
      window.FAST.auth.masuk("github")
        .then(function () { toast("Berhasil masuk dengan GitHub.", "sukses"); m._tutup(); })
        .catch(function (e) { toast(e.message, "galat", 5200); });
    });

    /* Demo */
    document.getElementById("ssoDemo").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = document.getElementById("ssoEmailDemo").value.trim();
      var peta = {
        "admin@ustedi.ac.id": ["admin"],
        "berita@ustedi.ac.id": ["berita"],
        "pmb@ustedi.ac.id": ["pmb"],
        "academy@ustedi.ac.id": ["academy"]
      };
      window.FAST.auth.masuk("demo", { email: email, peran: peta[email.toLowerCase()] })
        .then(function () { toast("Mode demo aktif sebagai " + email, "info"); m._tutup(); })
        .catch(function (e) { toast(e.message, "galat"); });
    });

    /* Catatan status provider */
    var st = window.FAST.auth.providerAktif();
    var catatan = document.getElementById("ssoCatatan");
    if (!st.google) {
      var gt = document.getElementById("ssoGoogle");
      if (gt) gt.innerHTML = '<p class="sso-belum">Google SSO belum dikonfigurasi — isi <code>sso.googleClientId</code> di <code>assets/js/config.js</code>.</p>';
    }
    if (!st.github) {
      var gh = document.getElementById("ssoGithub");
      if (gh) { gh.disabled = true; gh.title = "Isi sso.githubClientId di config.js"; }
    }
    if (catatan) {
      catatan.innerHTML = "Dokumentasi pemasangan SSO: <a href=\"" + BASE + "docs/SSO.md\">docs/SSO.md</a>";
    }
  }

  function bukaModalMasuk() {
    bangunModalMasuk();
    var m = document.getElementById("fastModalMasuk");
    if (m && m._buka) m._buka();
  }

  /* ---------------- Sinkronisasi identitas dari site.json ---------------- */
  function muatIdentitasSitus() {
    if (!window.FAST || !window.FAST.data) return;
    window.FAST.data.json("site.json").then(function (site) {
      if (!site) return;
      SITE_DATA = site;
      if (site.org) {
        Object.keys(site.org).forEach(function (k) {
          if (k === "instagram" && site.org.instagram && typeof site.org.instagram === "object") {
            CFG.org.instagram = Object.assign({}, CFG.org.instagram || {}, site.org.instagram);
          } else if (site.org[k] !== undefined && site.org[k] !== null) {
            CFG.org[k] = site.org[k];
          }
        });
      }
      var f = document.getElementById("fast-footer");
      if (f) { f.innerHTML = ""; bangunFooter(); }
    }).catch(function () { /* footer tetap memakai data bawaan */ });
  }

  /* ---------------- Inisialisasi ---------------- */
  function init() {
    bangunHeader();
    bangunFooter();
    muatIdentitasSitus();
    if (window.location.hash === "#masuk" || window.location.hash === "#login") {
      bukaModalMasuk();
    }
    window.addEventListener("hashchange", function () {
      if (window.location.hash === "#masuk" || window.location.hash === "#login") bukaModalMasuk();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.FAST = window.FAST || {};
  window.FAST.ui = {
    el: el, aman: aman, tanggal: tanggal, relatif: relatif, singkat: singkat,
    toast: toast, bukaModalMasuk: bukaModalMasuk, renderPengguna: renderPengguna,
    segarkanHeader: function () {
      var a = document.getElementById("fnavUser");
      if (a) renderPengguna(a);
    },
    segarkanFooter: function () {
      var f = document.getElementById("fast-footer");
      if (f) { f.innerHTML = ""; bangunFooter(); }
    }
  };
})();
