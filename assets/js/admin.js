/* =========================================================
   Panel Admin FAST USTEDI — admin.js
   ---------------------------------------------------------
   Area pengelolaan konten: blog, berita, halaman/profil,
   academy, PMB, serta cadangan/publikasi data.

   Keamanan:
     - Username & password tidak ditulis sebagai teks biasa;
       yang disimpan hanya sidik SHA-256 dengan penggaraman.
     - Kata sandi memakai input type="password" dan tersembunyi.
     - Sesi admin berlaku 2 jam dan disimpan di sessionStorage.
     - Setelah 5 percobaan gagal, login dikunci sementara.

   Catatan: karena situs ini statis, panel ini melindungi
   antarmuka pengelolaan konten, bukan menyimpan rahasia server.
   ========================================================= */
(function () {
  "use strict";

  var CFG = window.FAST_CONFIG;
  var U = window.FAST.ui;
  var C = window.FAST.cms;
  var D = window.FAST.data;
  var MD = window.FAST.md;

  var KUNCI_SESI = "fast_admin_session_v1";
  var KUNCI_GAGAL = "fast_admin_gagal_v1";
  var KUNCI_TOKEN = "fast_admin_gh_token_v1";
  var MASA_SESI = 2 * 60 * 60 * 1000;   /* 2 jam */
  var MAKS_GAGAL = 5;
  var KUNCI_MENIT = 60 * 1000;

  /* Sidik SHA-256 dari "FAST::USER::<username>" dan "FAST::PASS::<password>".
     Kredensial asli tidak pernah ditulis di berkas ini. */
  var HASH_USER = "bc9d601db153add2ff6a87b078e908882038a089caff1afa59b8ea622fed167f";
  var HASH_PASS = "ad5ea59f76cc5908ec80a22d2104d4a02c24d8498a829abaece2c647d8e96fac";

  var SES = bacaSesi();
  var state = {
    base: {},
    route: "ringkasan",
    current: null
  };

  /* =========================================================
     Utilitas umum
     ========================================================= */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function aman(v) {
    return U.aman(v);
  }

  function salin(o) {
    if (o == null) return o;
    try { return JSON.parse(JSON.stringify(o)); }
    catch (e) { return o; }
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function hariIni() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

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
      "Verifikasi login memerlukan HTTPS atau localhost. Buka panel melalui alamat https://… atau server lokal."
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

  function bacaSesi() {
    try {
      var raw = sessionStorage.getItem(KUNCI_SESI);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.exp || Date.now() > s.exp) {
        sessionStorage.removeItem(KUNCI_SESI);
        return null;
      }
      return s;
    } catch (e) {
      return null;
    }
  }

  function tulisSesi(s) {
    SES = s;
    try {
      if (s) sessionStorage.setItem(KUNCI_SESI, JSON.stringify(s));
      else sessionStorage.removeItem(KUNCI_SESI);
    } catch (e) { /* sessionStorage bisa diblokir */ }
  }

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

  function pesanLogin(teks, info) {
    var p = document.getElementById("loginPesan");
    if (!p) return;
    if (!teks) { p.hidden = true; p.textContent = ""; return; }
    p.hidden = false;
    p.textContent = teks;
    p.classList.toggle("info", !!info);
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

  /* =========================================================
     Login / sesi
     ========================================================= */
  /* Ikon SVG untuk tombol tampilkan/sembunyikan kata sandi. */
  var SVG_EYE =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>' +
      '<circle cx="12" cy="12" r="3"></circle>' +
    "</svg>";
  var SVG_EYE_OFF =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>' +
      '<line x1="1" y1="1" x2="23" y2="23"></line>' +
    "</svg>";

  function pasangLogin() {
    var form = document.getElementById("formLogin");
    var toggle = document.getElementById("togglePass");
    var inputPass = document.getElementById("loginPass");

    if (toggle && inputPass) {
      toggle.addEventListener("click", function () {
        var tampil = inputPass.type === "password";
        inputPass.type = tampil ? "text" : "password";
        toggle.innerHTML = tampil ? SVG_EYE_OFF : SVG_EYE;
        toggle.setAttribute("aria-pressed", String(tampil));
        toggle.setAttribute("aria-label", tampil ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
        toggle.setAttribute("title", tampil ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
        inputPass.focus();
      });
    }

    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        cobaMasuk();
      });
    }
  }

  function cobaMasuk() {
    var user = (document.getElementById("loginUser") || {}).value || "";
    var pass = (document.getElementById("loginPass") || {}).value || "";
    var btn = document.getElementById("btnLogin");
    var teksBtn = btn ? btn.querySelector(".teks-btn") : null;

    user = user.trim();
    if (!user || !pass) {
      pesanLogin("Isi username dan password terlebih dahulu.");
      return;
    }

    var tunggu = statusKunci();
    if (tunggu > 0) {
      pesanLogin("Terlalu banyak percobaan. Coba lagi dalam " + tunggu + " detik.");
      return;
    }

    if (btn) btn.disabled = true;
    if (teksBtn) teksBtn.innerHTML = '<span class="admin-spinner"></span> Memeriksa…';
    pesanLogin("");

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
          pesanLogin("Terlalu banyak percobaan. Login dikunci selama 60 detik.");
        } else {
          tulisGagal(g);
          pesanLogin("Username atau password salah. Sisa percobaan: " + (MAKS_GAGAL - g.n) + ".");
        }
        if (btn) btn.disabled = false;
        if (teksBtn) teksBtn.textContent = "Masuk";
        return;
      }

      tulisGagal({ n: 0, sampai: 0 });
      tulisSesi({ exp: Date.now() + MASA_SESI, mulai: Date.now() });
      if (btn) btn.disabled = false;
      if (teksBtn) teksBtn.textContent = "Masuk";
      tampilkanShell();
      U.toast("Berhasil masuk ke Panel Admin.", "sukses");
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      if (teksBtn) teksBtn.textContent = "Masuk";
      pesanLogin(e.message || "Gagal memverifikasi login.");
    });
  }

  function keluarAdmin(kedaluwarsa) {
    tulisSesi(null);
    tampilkanLogin();
    if (kedaluwarsa) pesanLogin("Sesi admin telah berakhir. Silakan masuk kembali.", true);
    U.toast(kedaluwarsa ? "Sesi admin berakhir." : "Anda telah keluar dari Panel Admin.", "info");
  }

  function tampilkanLogin() {
    var login = document.getElementById("adminLogin");
    var shell = document.getElementById("adminShell");
    if (login) login.hidden = false;
    if (shell) shell.hidden = true;
    var pass = document.getElementById("loginPass");
    if (pass) pass.value = "";
  }

  function tampilkanShell() {
    var login = document.getElementById("adminLogin");
    var shell = document.getElementById("adminShell");
    if (login) login.hidden = true;
    if (shell) shell.hidden = false;
    /* Pastikan panel admin langsung tampil dari bagian atas, bukan di bawah form login. */
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    pasangShell();
    route();
    perbaruiBadge();
  }

  function pasangShell() {
    if (pasangShell._sudah) return;
    pasangShell._sudah = true;

    var k = document.getElementById("adminKonten");
    var sidebar = document.getElementById("adminSidebar");
    var toggle = document.getElementById("adminMenuToggle");

    function keluarDanTutup() { if (sidebar) sidebar.classList.remove("buka"); }
    if (toggle && sidebar) {
      toggle.addEventListener("click", function () {
        sidebar.classList.toggle("buka");
      });
    }
    if (sidebar) {
      sidebar.addEventListener("click", function (ev) {
        if (ev.target.closest("a")) keluarDanTutup();
      });
    }

    ["adminKeluar", "adminKeluarAtas"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener("click", function () { keluarAdmin(false); });
    });

    window.addEventListener("hashchange", function () {
      if (SES) route();
    });

    setInterval(function () {
      if (SES && Date.now() > SES.exp) keluarAdmin(true);
    }, 30000);

    if (!k) return;
    k.addEventListener("click", tanganiKlik);
    k.addEventListener("submit", tanganiSubmit);
    k.addEventListener("change", function (ev) {
      if (!ev.target) return;
      if (ev.target.id === "fileImpor") imporCadangan(ev.target);
      if (ev.target.id === "postGambarFile") pilihGambar(ev.target);
    });

    k.addEventListener("input", function (ev) {
      if (ev.target && ev.target.getAttribute && ev.target.getAttribute("data-f") === "gambar") {
        var v = String(ev.target.value || "").trim();
        if (!v) perbaruiPratinjauGambar("");
        else if (/^(https?:\/\/|data:image\/|\/)/i.test(v)) perbaruiPratinjauGambar(v);
      }
    });
  }

  /* =========================================================
     Akses data & penyimpanan
     ========================================================= */
  function dataDasar(path) {
    var key = C.kunci(path);
    if (state.base[key]) return Promise.resolve(salin(state.base[key]));

    var urls = [CFG.localDataUrl(key), CFG.dataUrl(key)];
    function coba(i) {
      if (i >= urls.length) {
        return Promise.reject(new Error("Gagal memuat data " + key + " dari server."));
      }
      return fetch(urls[i], { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).then(function (obj) {
        state.base[key] = obj;
        return salin(obj);
      }).catch(function () {
        return coba(i + 1);
      });
    }
    return coba(0);
  }

  function dataEfektif(path) {
    var ov = C.ambil(path);
    if (ov) return Promise.resolve(ov);
    return dataDasar(path);
  }

  function simpanBerkas(path, obj) {
    var hasil = C.simpan(path, obj);
    perbaruiBadge();
    return hasil;
  }

  function resetBerkas(path) {
    C.hapus(path);
    perbaruiBadge();
  }

  function perbaruiBadge() {
    var n = C.jumlah();
    var b = document.getElementById("badgeData");
    if (b) { b.textContent = n; b.hidden = !n; }
  }

  function judul(teks, sub) {
    var j = document.getElementById("adminJudul");
    var s = document.getElementById("adminSubjudul");
    if (j) j.textContent = teks || "Panel Admin";
    if (s) s.textContent = sub || "";
  }

  function isi(html) {
    var k = document.getElementById("adminKonten");
    if (k) k.innerHTML = html;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function memuat(teks) {
    isi('<div class="pemuat"><span class="pemuat-lingkar"></span><span>' + aman(teks || "Memuat data…") + "</span></div>");
  }

  function aktifNav(id) {
    var semua = document.querySelectorAll("#adminNav a[data-nav]");
    Array.prototype.forEach.call(semua, function (a) {
      a.classList.toggle("aktif", a.getAttribute("data-nav") === id);
    });
  }

  function route() {
    if (!SES) { tampilkanLogin(); return; }
    var h = String(location.hash || "").replace(/^#\/?/, "");
    var bagian = h.split("/").filter(Boolean);
    var v = bagian[0] || "ringkasan";
    state.route = v;
    aktifNav(v);

    if (v === "blog" || v === "berita") {
      if (bagian[1] === "baru") return editorPost(v, null);
      if (bagian[1] === "edit" && bagian[2]) return editorPost(v, decodeURIComponent(bagian[2]));
      return daftarPost(v);
    }
    if (v === "academy") {
      if (bagian[1] === "baru") return editorAcademy(null);
      if (bagian[1] === "edit" && bagian[2]) return editorAcademy(decodeURIComponent(bagian[2]));
      return daftarAcademy();
    }
    if (v === "halaman") return halamanSitus();
    if (v === "pmb") return halamanPmb();
    if (v === "data") return halamanData();
    return ringkasan();
  }

  /* =========================================================
     Pembantu formulir
     ========================================================= */
  function field(label, name, value, opsi) {
    opsi = opsi || {};
    var id = "f_" + name + "_" + Math.random().toString(36).slice(2, 7);
    var tipe = opsi.tipe || "text";
    var input = "";

    if (tipe === "textarea") {
      input = '<textarea id="' + id + '" data-f="' + name + '" rows="' + (opsi.baris || 4) + '"' +
        (opsi.kode ? ' class="kode"' : "") + ">" + aman(value) + "</textarea>";
    } else if (tipe === "select") {
      var opts = (opsi.opsi || []).map(function (o) {
        var val = (o && typeof o === "object") ? o.nilai : o;
        var lab = (o && typeof o === "object") ? o.label : o;
        return '<option value="' + aman(val) + '"' +
          (String(value) === String(val) ? " selected" : "") + ">" + aman(lab) + "</option>";
      }).join("");
      input = '<select id="' + id + '" data-f="' + name + '">' + opts + "</select>";
    } else if (tipe === "checkbox") {
      return '<label class="ed-check"><input type="checkbox" data-f="' + name + '"' +
        (value ? " checked" : "") + " /> " + aman(label) + "</label>";
    } else {
      input = '<input id="' + id + '" data-f="' + name + '" type="' + aman(tipe) + '" value="' +
        aman(value == null ? "" : value) + '"' +
        (opsi.placeholder ? ' placeholder="' + aman(opsi.placeholder) + '"' : "") +
        (opsi.min != null ? ' min="' + aman(opsi.min) + '"' : "") +
        (opsi.max != null ? ' max="' + aman(opsi.max) + '"' : "") +
        (opsi.step != null ? ' step="' + aman(opsi.step) + '"' : "") + " />";
    }

    return '<div class="ed-field' + (opsi.penuh ? " penuh" : "") + '">' +
      '<label for="' + id + '">' + aman(label) + "</label>" + input +
      (opsi.petunjuk ? '<small>' + opsi.petunjuk + "</small>" : "") + "</div>";
  }

  function bacaForm(form) {
    var o = {};
    if (!form) return o;
    Array.prototype.forEach.call(form.querySelectorAll("[data-f]"), function (inp) {
      if (inp.closest(".ed-daftar")) return;
      var k = inp.getAttribute("data-f");
      if (!k) return;
      if (inp.type === "checkbox") o[k] = inp.checked;
      else if (inp.type === "number") o[k] = inp.value === "" ? 0 : Number(inp.value);
      else o[k] = String(inp.value || "").trim();
    });
    return o;
  }

  function barisHTML(kolom, item) {
    item = item || {};
    var isiBaris = kolom.map(function (c) {
      var v = item[c.k];
      if (v === undefined || v === null) v = c.bawaan != null ? c.bawaan : "";

      if (c.t === "hidden") {
        return '<input type="hidden" data-f="' + c.k + '" value="' + aman(v) + '" />';
      }
      if (c.t === "checkbox") {
        return '<label class="ed-sel ed-cek"><span>' + aman(c.label) + '</span>' +
          '<input type="checkbox" data-f="' + c.k + '"' + (v ? " checked" : "") + " /></label>";
      }
      if (c.t === "select") {
        var opts = (c.opsi || []).map(function (o) {
          var val = (o && typeof o === "object") ? o.nilai : o;
          var lab = (o && typeof o === "object") ? o.label : o;
          return '<option value="' + aman(val) + '"' +
            (String(v) === String(val) ? " selected" : "") + ">" + aman(lab) + "</option>";
        }).join("");
        return '<label class="ed-sel' + (c.lebar ? " lebar" : "") + '"><span>' + aman(c.label) +
          '</span><select data-f="' + c.k + '">' + opts + "</select></label>";
      }
      if (c.t === "textarea") {
        return '<label class="ed-sel' + (c.lebar ? " lebar" : "") + '"><span>' + aman(c.label) +
          '</span><textarea data-f="' + c.k + '" rows="' + (c.baris || 2) + '">' + aman(v) + "</textarea></label>";
      }
      return '<label class="ed-sel' + (c.lebar ? " lebar" : "") + '"><span>' + aman(c.label) +
        '</span><input type="' + (c.t || "text") + '" data-f="' + c.k + '" value="' + aman(v) + '"' +
        (c.ph ? ' placeholder="' + aman(c.ph) + '"' : "") +
        (c.min != null ? ' min="' + c.min + '"' : "") + " /></label>";
    }).join("");

    return '<div class="ed-baris">' + isiBaris +
      '<button type="button" class="ed-hapus" data-aksi="hapus-baris" aria-label="Hapus baris" title="Hapus baris">✕</button>' +
      "</div>";
  }

  var KOLOM = {
    cta: [
      { k: "label", label: "Label tombol", ph: "Daftar Kuliah" },
      { k: "href", label: "Tautan", ph: "/pmb/" },
      { k: "gaya", label: "Gaya", t: "select", bawaan: "btn-aksen", opsi: [
        { nilai: "btn-aksen", label: "Kuning" },
        { nilai: "btn-putih", label: "Putih" },
        { nilai: "btn-hijau", label: "Hijau" },
        { nilai: "btn-garis", label: "Garis" }
      ] }
    ],
    pengumuman: [
      { k: "id", t: "hidden" },
      { k: "teks", label: "Teks pengumuman", lebar: true, ph: "Informasi terbaru…" },
      { k: "tautan", label: "Tautan", ph: "/pmb/" },
      { k: "label", label: "Label tombol", ph: "Selengkapnya" },
      { k: "aktif", label: "Aktif", t: "checkbox", bawaan: true }
    ],
    statistik: [
      { k: "nilai", label: "Nilai", ph: "1.200+" },
      { k: "label", label: "Keterangan", ph: "Mahasiswa Aktif", lebar: true }
    ],
    keunggulan: [
      { k: "judul", label: "Judul", ph: "Keunggulan" },
      { k: "teks", label: "Penjelasan", t: "textarea", lebar: true, baris: 2 }
    ],
    prodi: [
      { k: "kode", label: "Kode", ph: "IF" },
      { k: "nama", label: "Nama prodi", ph: "S1 Informatika" },
      { k: "teks", label: "Deskripsi", t: "textarea", lebar: true, baris: 2 },
      { k: "instagram", label: "Instagram", ph: "https://instagram.com/…", lebar: true }
    ],
    jadwal: [
      { k: "label", label: "Tahap", ph: "Pendaftaran Dibuka" },
      { k: "nilai", label: "Keterangan", ph: "Sepanjang tahun" }
    ],
    jalur: [
      { k: "id", label: "ID", ph: "reguler-pagi" },
      { k: "nama", label: "Nama jalur", ph: "Kelas Reguler Pagi" },
      { k: "teks", label: "Deskripsi", t: "textarea", lebar: true, baris: 2 }
    ],
    prodiPmb: [
      { k: "kode", label: "Kode", ph: "IF" },
      { k: "nama", label: "Nama prodi", ph: "S1 Informatika" },
      { k: "jenjang", label: "Jenjang", ph: "S1" }
    ],
    biayaItem: [
      { k: "label", label: "Komponen", ph: "SPP" },
      { k: "nilai", label: "Keterangan", ph: "Diskon 50% khusus FAST" }
    ],
    langkah: [
      { k: "no", label: "No.", t: "number", bawaan: 1 },
      { k: "judul", label: "Judul langkah", ph: "Isi Formulir" },
      { k: "teks", label: "Penjelasan", t: "textarea", lebar: true, baris: 2 }
    ],
    faq: [
      { k: "t", label: "Pertanyaan", t: "textarea", lebar: true, baris: 2 },
      { k: "j", label: "Jawaban", t: "textarea", lebar: true, baris: 3 }
    ]
  };

  function daftarHTML(nama, items, labelTambah) {
    items = items || [];
    var rows = items.map(function (item) { return barisHTML(KOLOM[nama], item); }).join("");
    return '<div class="ed-daftar" data-list="' + nama + '">' + rows + "</div>" +
      '<button type="button" class="btn btn-garis btn-kecil" data-aksi="tambah-baris" data-list="' + nama + '">+ ' +
      aman(labelTambah || "Tambah baris") + "</button>";
  }

  function bacaDaftar(form, nama) {
    var host = form ? form.querySelector('.ed-daftar[data-list="' + nama + '"]') : null;
    if (!host) return [];
    return Array.prototype.map.call(host.querySelectorAll(".ed-baris"), function (row) {
      var o = {};
      Array.prototype.forEach.call(row.querySelectorAll("[data-f]"), function (inp) {
        var k = inp.getAttribute("data-f");
        if (!k) return;
        if (inp.type === "checkbox") o[k] = inp.checked;
        else if (inp.type === "number") o[k] = inp.value === "" ? 0 : Number(inp.value);
        else o[k] = String(inp.value || "").trim();
      });
      return o;
    });
  }

  function gambarEditor(p) {
    var nilai = p.gambar || "";
    return '<div class="ed-field penuh">' +
      '<label for="postGambar">Gambar Sampul</label>' +
      '<div class="ed-gambar-baris">' +
        '<input id="postGambar" type="text" data-f="gambar" value="' + aman(nilai) + '" placeholder="https://… atau pilih file gambar" />' +
        '<label class="btn btn-garis btn-kecil ed-pilih-berkas">Choose File<input type="file" id="postGambarFile" accept="image/jpeg,image/png,image/webp,image/gif" /></label>' +
        '<button type="button" class="btn btn-bahaya btn-kecil" data-aksi="hapus-gambar">Hapus Gambar</button>' +
      "</div>" +
      '<small>Pilih file JPG, PNG, WebP, atau GIF. Gambar otomatis diperkecil agar ringan. Bisa juga mengisi URL gambar secara manual.</small>' +
      '<div class="ed-gambar-pratinjau" id="pratinjauGambar"' + (nilai ? "" : " hidden") + '>' +
        '<img id="pratinjauGambarImg" src="' + aman(nilai) + '" alt="Pratinjau gambar sampul" />' +
      "</div>" +
    "</div>";
  }

  function perbaruiPratinjauGambar(nilai) {
    var box = document.getElementById("pratinjauGambar");
    var img = document.getElementById("pratinjauGambarImg");
    if (!box || !img) return;
    if (nilai) {
      img.src = nilai;
      box.hidden = false;
    } else {
      img.removeAttribute("src");
      box.hidden = true;
    }
  }

  function pasangGambar(nilai) {
    var input = document.querySelector('form[data-form="post"] [data-f="gambar"]');
    if (input) input.value = nilai || "";
    perbaruiPratinjauGambar(nilai || "");
  }

  function kompresGambar(img) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    if (!w || !h) return "";

    var maxSisi = 1200;
    var skala = Math.min(1, maxSisi / Math.max(w, h));
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    var cw = Math.max(1, Math.round(w * skala));
    var ch = Math.max(1, Math.round(h * skala));
    var data = "";

    function gambarUlang() {
      canvas.width = cw;
      canvas.height = ch;
      ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      data = canvas.toDataURL("image/webp", 0.82);
      if (!/^data:image\/webp/i.test(data)) data = canvas.toDataURL("image/jpeg", 0.82);
    }

    gambarUlang();

    var percobaan = 0;
    while (data.length > 700000 && percobaan < 4) {
      cw = Math.max(1, Math.round(cw * 0.78));
      ch = Math.max(1, Math.round(ch * 0.78));
      gambarUlang();
      percobaan++;
    }
    return data;
  }

  function pilihGambar(input) {
    var file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    if (!/^image\//i.test(file.type)) {
      U.toast("Berkas yang dipilih bukan gambar.", "galat");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      U.toast("Ukuran gambar maksimal 20 MB.", "galat");
      return;
    }

    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      try {
        var data = kompresGambar(img);
        URL.revokeObjectURL(url);
        if (!data) throw new Error("Gambar tidak dapat diproses.");
        if (data.length > 1800000) {
          throw new Error("Gambar terlalu besar setelah dikompres. Pilih gambar dengan ukuran lebih kecil.");
        }
        pasangGambar(data);
        U.toast("Gambar siap. Jangan lupa simpan artikel.", "sukses");
      } catch (e) {
        U.toast(e.message || "Gagal memproses gambar.", "galat", 5200);
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      U.toast("Gambar tidak dapat dibaca.", "galat");
    };
    img.src = url;
  }

  function keBaris(teks) {
    return String(teks || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function keTagar(teks) {
    return String(teks || "").split(",").map(function (s) {
      return s.trim().replace(/^#/, "");
    }).filter(Boolean);
  }

  function unduhJSON(nama, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2) + "\n"], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = String(nama || "data.json").replace(/[^a-z0-9._-]/gi, "-");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function unduhBerkas(path) {
    dataEfektif(path).then(function (obj) {
      unduhJSON(path.replace(/\//g, "-"), obj);
      U.toast("Berkas " + path + " diunduh.", "sukses");
    }).catch(function (e) { U.toast(e.message, "galat"); });
  }

  function imporCadangan(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        var daftar = C.import(obj);
        state.base = {};
        D.segarkan();
        U.toast("Cadangan dipulihkan: " + daftar.length + " berkas.", "sukses");
        perbaruiBadge();
        route();
      } catch (e) {
        U.toast(e.message || "Berkas cadangan tidak valid.", "galat", 5200);
      }
      input.value = "";
    };
    reader.onerror = function () { U.toast("Gagal membaca berkas.", "galat"); };
    reader.readAsText(file);
  }

  /* =========================================================
     Ringkasan
     ========================================================= */
  function ringkasan() {
    judul("Ringkasan", "Selamat datang di panel pengelolaan konten FAST USTEDI.");
    memuat("Menghitung konten…");

    Promise.all([
      dataEfektif("blog/index.json").catch(function () { return { item: [] }; }),
      dataEfektif("berita/index.json").catch(function () { return { item: [] }; }),
      dataEfektif("academy/index.json").catch(function () { return { item: [] }; }),
      dataEfektif("pmb/config.json").catch(function () { return {}; }),
      dataEfektif("site.json").catch(function () { return {}; })
    ]).then(function (hasil) {
      var blog = hasil[0].item || [];
      var berita = hasil[1].item || [];
      var academy = hasil[2].item || [];
      var pmb = hasil[3] || {};
      var site = hasil[4] || {};
      var drafBlog = blog.filter(function (x) { return x.status === "draf"; });

      var terbaru = blog.slice().sort(function (a, b) {
        return String(b.tanggal).localeCompare(String(a.tanggal));
      }).slice(0, 5);

      var barisTerbaru = terbaru.length ? terbaru.map(function (p) {
        return '<tr><td class="judul-sel"><strong>' + aman(p.judul) + "</strong><small>" +
          aman(p.penulis || "Humas FAST") + " · " + aman(p.tanggal || "-") + "</small></td>" +
          '<td><span class="admin-pill ' + (p.status === "draf" ? "aksen" : "hijau") + '">' +
          (p.status === "draf" ? "Draf" : "Terbit") + "</span></td>" +
          '<td class="aksi-sel"><a class="btn btn-garis btn-kecil" href="#/blog/edit/' +
          encodeURIComponent(p.slug) + '">Edit</a></td></tr>';
      }).join("") : '<tr><td colspan="3"><div class="admin-kosong">Belum ada artikel blog. Mulai dengan tombol di bawah.</div></td></tr>';

      var perubahan = C.daftar();

      isi(
        '<div class="admin-grid">' +
          kartuStat(blog.length, "Artikel Blog", drafBlog.length + " draf") +
          kartuStat(berita.length, "Berita", "Kabar fakultas") +
          kartuStat(academy.length, "Kelas Academy", academy.filter(function (x) { return x.status !== "selesai"; }).length + " aktif") +
          kartuStat(C.jumlah(), "Perubahan Lokal", "Berkas di browser") +
        "</div>" +

        '<div class="admin-kartu mt-3">' +
          '<div class="admin-kartu-kepala"><div><h2>Artikel Blog Terbaru</h2>' +
            '<p>Kelola tulisan yang tampil di halaman Blog FAST.</p></div>' +
            '<div class="admin-aksi"><a class="btn btn-utama btn-kecil" href="#/blog/baru">+ Tulis Artikel</a>' +
            '<a class="btn btn-garis btn-kecil" href="#/blog">Semua Artikel</a></div></div>' +
          '<div class="admin-tabel-bungkus"><table class="admin-tabel"><thead><tr><th>Artikel</th><th>Status</th><th class="aksi-sel">Aksi</th></tr></thead><tbody>' +
          barisTerbaru + "</tbody></table></div>" +
        "</div>" +

        '<div class="admin-grid mt-3">' +
          '<div class="admin-kartu">' +
            '<h2>Informasi Website</h2>' +
            '<p style="margin:8px 0 14px">' + aman(site.org && site.org.fakultas || "Fakultas Sains dan Teknologi") + " — " +
              aman(site.org && site.org.kampus || "USTEDI") + "</p>" +
            '<div class="admin-aksi"><a class="btn btn-garis btn-kecil" href="#/halaman">Edit Profil &amp; Halaman</a>' +
            '<a class="btn btn-garis btn-kecil" href="#/pmb">Edit Info PMB</a></div>' +
          "</div>" +
          '<div class="admin-kartu">' +
            '<h2>Status Publikasi</h2>' +
            '<p style="margin:8px 0 14px">' + (perubahan.length ?
              "Ada <strong>" + perubahan.length + "</strong> berkas konten yang diubah dan tersimpan di browser ini." :
              "Belum ada perubahan lokal. Konten yang tampil masih menggunakan data bawaan.") + "</p>" +
            '<div class="admin-aksi"><a class="btn btn-utama btn-kecil" href="#/data">Buka Data &amp; Publikasi</a></div>' +
          "</div>" +
        "</div>" +

        '<div class="admin-catatan kuning mt-3">' +
          "Perubahan dari panel ini disimpan di <strong>penyimpanan browser</strong> dan langsung terlihat di perangkat ini. " +
          "Untuk membuat perubahan berlaku bagi semua pengunjung, gunakan menu <strong>Data &amp; Publikasi</strong> untuk mengunduh cadangan atau menerbitkan ke repositori GitHub." +
        "</div>"
      );
      perbaruiBadge();
      perbaruiBadgeBlog(blog);
    }).catch(function (e) {
      isi('<div class="admin-catatan merah">Gagal memuat ringkasan: ' + aman(e.message) + "</div>");
    });
  }

  function kartuStat(nilai, label, ket) {
    return '<div class="admin-stat"><div class="nilai">' +
      aman(nilai) + '</div><div class="label">' + aman(label) + '</div><div class="ket">' +
      aman(ket || "") + "</div></div>";
  }

  function perbaruiBadgeBlog(blog) {
    var b = document.getElementById("badgeBlog");
    if (!b) return;
    var draf = (blog || []).filter(function (x) { return x.status === "draf"; }).length;
    b.textContent = draf;
    b.hidden = !draf;
  }

  /* =========================================================
     Daftar Blog / Berita
     ========================================================= */
  function daftarPost(jenis) {
    var blog = jenis === "blog";
    var label = blog ? "Blog" : "Berita";
    var path = jenis + "/index.json";
    judul("Kelola " + label, "Buat, edit, dan atur status terbit " + label.toLowerCase() + ".");
    memuat("Memuat " + label.toLowerCase() + "…");

    dataEfektif(path).then(function (idx) {
      idx.item = idx.item || [];
      idx.kategori = idx.kategori || [];
      var peta = {};
      idx.kategori.forEach(function (k) { peta[k.id] = k; });

      var item = idx.item.slice().sort(function (a, b) {
        return String(b.tanggal).localeCompare(String(a.tanggal));
      });

      var baris = item.length ? item.map(function (p) {
        var kat = peta[p.kategori] || { nama: p.kategori || "Umum", warna: "#0d3b8c" };
        var draf = p.status === "draf";
        return "<tr>" +
          '<td class="judul-sel"><strong>' + aman(p.judul) + "</strong><small>" +
            aman(p.slug) + " · " + aman(p.penulis || "Humas FAST") + "</small></td>" +
          '<td><span class="tag" style="background:' + aman(kat.warna) + '1a;color:' + aman(kat.warna) + '">' +
            aman(kat.nama) + "</span></td>" +
          "<td>" + aman(p.tanggal || "-") + "</td>" +
          '<td><span class="admin-pill ' + (draf ? "aksen" : "hijau") + '">' + (draf ? "Draf" : "Terbit") + "</span>" +
            (p.unggulan ? ' <span class="admin-pill biru">★ Utama</span>' : "") + "</td>" +
          '<td class="aksi-sel">' +
            '<a class="btn btn-garis btn-kecil" href="#/' + jenis + '/edit/' + encodeURIComponent(p.slug) + '">Edit</a> ' +
            '<a class="btn btn-garis btn-kecil" target="_blank" rel="noopener" href="/' + jenis + '/artikel.html?slug=' +
              encodeURIComponent(p.slug) + '">Lihat</a> ' +
            '<button type="button" class="btn btn-bahaya btn-kecil" data-aksi="post-hapus" data-jenis="' + jenis +
              '" data-slug="' + aman(p.slug) + '" data-judul="' + aman(p.judul) + '">Hapus</button>' +
          "</td></tr>";
      }).join("") : '<tr><td colspan="5"><div class="admin-kosong">Belum ada ' + label.toLowerCase() +
        '. Klik tombol “Tulis ' + label + '” untuk membuat yang pertama.</div></td></tr>';

      var kategoriPil = idx.kategori.length ? idx.kategori.map(function (k) {
        return '<span class="admin-pill biru" style="margin:3px 4px 3px 0">' + aman(k.nama) +
          ' <button type="button" data-aksi="kategori-hapus" data-jenis="' + jenis + '" data-id="' + aman(k.id) +
          '" title="Hapus kategori" style="color:inherit;font-weight:900;margin-left:2px">×</button></span>';
      }).join("") : '<span class="ed-petunjuk">Belum ada kategori.</span>';

      isi(
        '<div class="admin-kartu">' +
          '<div class="admin-kartu-kepala"><div><h2>' + label + " (" + idx.item.length + ")</h2>" +
            '<p>Artikel berstatus <strong>Draf</strong> tidak tampil di halaman publik.</p></div>' +
            '<div class="admin-aksi"><a class="btn btn-utama btn-kecil" href="#/' + jenis + '/baru">+ Tulis ' + label + "</a>" +
            '<a class="btn btn-garis btn-kecil" target="_blank" rel="noopener" href="/' + jenis + '/">Buka Halaman</a></div></div>' +
          '<div class="admin-tabel-bungkus"><table class="admin-tabel"><thead><tr>' +
            "<th>Judul</th><th>Kategori</th><th>Tanggal</th><th>Status</th><th class=\"aksi-sel\">Aksi</th>" +
          "</tr></thead><tbody>" + baris + "</tbody></table></div>" +
        "</div>" +

        '<div class="admin-kartu">' +
          '<div class="admin-kartu-kepala"><div><h2>Kategori</h2>' +
            "<p>Kategori dipakai untuk menyaring artikel di halaman publik.</p></div>" +
            '<button type="button" class="btn btn-garis btn-kecil" data-aksi="kategori-tambah" data-jenis="' + jenis + '">+ Tambah Kategori</button></div>' +
          "<div>" + kategoriPil + "</div>" +
        "</div>" +

        '<details class="ed-json admin-kartu">' +
          "<summary>Editor JSON " + label + " (opsional)</summary>" +
          '<p class="ed-petunjuk mt-1">Untuk pengguna mahir. Perubahan langsung disimpan setelah tombol ditekan.</p>' +
          '<textarea data-json-box="' + path + '" rows="18">' + aman(JSON.stringify(idx, null, 2)) + "</textarea>" +
          '<div class="admin-aksi-bawah"><button type="button" class="btn btn-utama btn-kecil" data-aksi="simpan-json" data-berkas="' +
            path + '">Simpan JSON</button></div>' +
        "</details>"
      );
      perbaruiBadgeBlog(jenis === "blog" ? idx.item : null);
    }).catch(function (e) {
      isi('<div class="admin-catatan merah">Gagal memuat ' + label.toLowerCase() + ": " + aman(e.message) + "</div>");
    });
  }

  function tambahKategori(jenis) {
    var nama = prompt("Nama kategori baru:");
    if (!nama) return;
    nama = nama.trim();
    if (!nama) return;
    dataEfektif(jenis + "/index.json").then(function (idx) {
      idx.kategori = idx.kategori || [];
      var id = D.slug(nama);
      var bentrok = idx.kategori.some(function (k) { return k.id === id; });
      if (bentrok) { U.toast("Kategori dengan nama serupa sudah ada.", "galat"); return; }
      idx.kategori.push({ id: id, nama: nama, warna: "#0d3b8c" });
      idx.diperbarui = nowISO();
      simpanBerkas(jenis + "/index.json", idx);
      U.toast("Kategori ditambahkan.", "sukses");
      daftarPost(jenis);
    }).catch(function (e) { U.toast(e.message, "galat"); });
  }

  function hapusKategori(jenis, id) {
    dataEfektif(jenis + "/index.json").then(function (idx) {
      idx.item = idx.item || [];
      idx.kategori = idx.kategori || [];
      var dipakai = idx.item.filter(function (p) { return p.kategori === id; }).length;
      if (dipakai) {
        U.toast("Kategori masih dipakai oleh " + dipakai + " artikel. Pindahkan artikel terlebih dahulu.", "galat", 5200);
        return;
      }
      var kat = idx.kategori.filter(function (k) { return k.id === id; })[0];
      if (!confirm("Hapus kategori “" + (kat ? kat.nama : id) + "”?")) return;
      idx.kategori = idx.kategori.filter(function (k) { return k.id !== id; });
      idx.diperbarui = nowISO();
      simpanBerkas(jenis + "/index.json", idx);
      U.toast("Kategori dihapus.", "sukses");
      daftarPost(jenis);
    }).catch(function (e) { U.toast(e.message, "galat"); });
  }

  /* =========================================================
     Editor Artikel Blog / Berita
     ========================================================= */
  function editorPost(jenis, slug) {
    var blog = jenis === "blog";
    var label = blog ? "Artikel Blog" : "Berita";
    judul((slug ? "Edit " : "Tulis ") + label, "Lengkapi judul, ringkasan, dan isi artikel. Format isi mendukung Markdown.");
    memuat("Menyiapkan editor…");

    var idxPromise = dataEfektif(jenis + "/index.json");
    var detailPromise = slug
      ? dataEfektif(jenis + "/" + slug + ".json").catch(function () { return null; })
      : Promise.resolve(null);

    Promise.all([idxPromise, detailPromise]).then(function (hasil) {
      var idx = hasil[0];
      var detail = hasil[1];
      idx.item = idx.item || [];
      idx.kategori = idx.kategori || [];

      var itemLama = slug ? idx.item.filter(function (x) { return x.slug === slug; })[0] : null;
      if (slug && !itemLama && !detail) {
        U.toast("Artikel tidak ditemukan.", "galat");
        location.hash = "#/" + jenis;
        return;
      }

      var p = salin(detail || itemLama || {});
      p.judul = p.judul || "";
      p.slug = p.slug || "";
      p.ringkasan = p.ringkasan || "";
      p.kategori = p.kategori || (idx.kategori[0] && idx.kategori[0].id) || "";
      p.penulis = p.penulis || "Humas FAST";
      p.tanggal = p.tanggal || hariIni();
      p.gambar = p.gambar || "";
      p.tagar = p.tagar || [];
      p.unggulan = !!p.unggulan;
      p.status = p.status || "publik";
      p.isi = p.isi || "";

      state.current = { jenis: jenis, slugLama: slug || null, index: idx, detail: detail };

      var opsiKategori = idx.kategori.map(function (k) {
        return { nilai: k.id, label: k.nama };
      });
      if (!opsiKategori.length) opsiKategori = [{ nilai: "umum", label: "Umum" }];

      isi(
        '<form class="ed-form" data-form="post">' +
          '<input type="hidden" data-f="jenis" value="' + jenis + '" />' +
          '<input type="hidden" data-f="slugLama" value="' + aman(slug || "") + '" />' +

          '<div class="ed-seksi">' +
            "<h2>Informasi Artikel</h2>" +
            '<p>Judul dan ringkasan akan tampil pada kartu daftar artikel.</p>' +
            '<div class="ed-baris-2">' +
              field("Judul", "judul", p.judul, { penuh: true, placeholder: "Judul artikel yang menarik" }) +
              field("Slug URL", "slug", p.slug, {
                placeholder: "otomatis-dari-judul",
                petunjuk: "Biarkan kosong untuk membuat slug otomatis dari judul."
              }) +
              field("Kategori", "kategori", p.kategori, { tipe: "select", opsi: opsiKategori }) +
              field("Penulis", "penulis", p.penulis, { placeholder: "Humas FAST" }) +
              field("Tanggal", "tanggal", p.tanggal, { tipe: "date" }) +
              field("Status", "status", p.status, { tipe: "select", opsi: [
                { nilai: "publik", label: "Terbit (publik)" },
                { nilai: "draf", label: "Draf (belum tampil)" }
              ] }) +
              gambarEditor(p) +
              field("Ringkasan", "ringkasan", p.ringkasan, {
                tipe: "textarea", penuh: true, baris: 3,
                petunjuk: "Ringkasan singkat 1–2 kalimat untuk kartu dan mesin pencari."
              }) +
              field("Tagar", "tagar", Array.isArray(p.tagar) ? p.tagar.join(", ") : (p.tagar || ""), {
                penuh: true, placeholder: "PMB, Beasiswa, Informatika",
                petunjuk: "Pisahkan dengan koma."
              }) +
              field("Jadikan artikel utama", "unggulan", p.unggulan, { tipe: "checkbox" }) +
            "</div>" +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Isi Artikel</h2>" +
            '<p>Gunakan Markdown: <code># Judul</code>, <code>**tebal**</code>, <code>- daftar</code>, <code>&gt; kutipan</code>, <code>[tautan](/pmb/)</code>.</p>' +
            field("Isi", "isi", p.isi, { tipe: "textarea", penuh: true, baris: 20, kode: true }) +
            '<div class="admin-aksi mt-2"><button type="button" class="btn btn-garis btn-kecil" data-aksi="pratinjau-post">Pratinjau</button></div>' +
            '<div class="ed-pratinjau" id="pratinjauPost" hidden></div>' +
          "</div>" +

          '<div class="ed-seksi">' +
            '<div class="admin-aksi-bawah" style="border-top:none;padding-top:0;margin-top:0">' +
              '<button type="submit" class="btn btn-utama">Simpan ' + label + "</button>" +
              '<a class="btn btn-garis" href="#/' + jenis + '">Batal</a>' +
              (slug ? '<a class="btn btn-garis" target="_blank" rel="noopener" href="/' + jenis +
                '/artikel.html?slug=' + encodeURIComponent(slug) + '">Lihat Artikel</a>' : "") +
              (slug ? '<button type="button" class="btn btn-bahaya" data-aksi="post-hapus" data-jenis="' + jenis +
                '" data-slug="' + aman(slug) + '" data-judul="' + aman(p.judul) + '">Hapus</button>' : "") +
            "</div>" +
          "</div>" +
        "</form>"
      );
    }).catch(function (e) {
      isi('<div class="admin-catatan merah">Gagal membuka editor: ' + aman(e.message) + "</div>");
    });
  }

  function simpanPost(form) {
    var d = bacaForm(form);
    var jenis = d.jenis || "blog";
    var blog = jenis === "blog";
    var label = blog ? "Artikel" : "Berita";

    if (!d.judul) { U.toast("Judul wajib diisi.", "galat"); return; }
    if (!d.isi) { U.toast("Isi artikel wajib diisi.", "galat"); return; }

    var idx = salin(state.current.index);
    idx.item = idx.item || [];
    idx.kategori = idx.kategori || [];

    var slugLama = state.current.slugLama;
    var slug = d.slug ? D.slug(d.slug) : D.slug(d.judul);
    if (!slug) slug = "artikel-" + Date.now().toString(36);

    var bentrok = idx.item.some(function (x) { return x.slug === slug && x.slug !== slugLama; });
    if (bentrok) {
      var dasar = slug;
      var n = 2;
      while (idx.item.some(function (x) { return x.slug === slug; })) {
        slug = dasar + "-" + n;
        n++;
      }
    }

    var detail = {
      slug: slug,
      judul: d.judul,
      ringkasan: d.ringkasan || "",
      kategori: d.kategori || "",
      penulis: d.penulis || "Humas FAST",
      tanggal: d.tanggal || hariIni(),
      gambar: d.gambar || "",
      tagar: keTagar(d.tagar),
      unggulan: !!d.unggulan,
      status: d.status === "draf" ? "draf" : "publik",
      isi: d.isi,
      diperbarui: nowISO()
    };

    var item = {
      slug: slug,
      judul: detail.judul,
      ringkasan: detail.ringkasan,
      kategori: detail.kategori,
      penulis: detail.penulis,
      tanggal: detail.tanggal,
      gambar: detail.gambar,
      tagar: detail.tagar,
      unggulan: detail.unggulan,
      status: detail.status,
      berkas: slug + ".json"
    };

    var posisi = -1;
    idx.item.forEach(function (x, i) { if (x.slug === slugLama) posisi = i; });
    if (posisi >= 0) idx.item[posisi] = item;
    else idx.item.unshift(item);

    idx.diperbarui = nowISO();

    var simpanDetail = slugLama && slugLama !== slug
      ? dataEfektif(jenis + "/" + slugLama + ".json").catch(function () { return null; })
      : Promise.resolve(null);

    simpanDetail.then(function (detailLama) {
      if (slugLama && slugLama !== slug) {
        C.hapus(jenis + "/" + slugLama + ".json");
        /* Bila detail lama tidak ada di berkas, tetap aman: indeks sudah diubah. */
        if (!detailLama) { /* tidak ada yang perlu disalin */ }
      }
      simpanBerkas(jenis + "/" + slug + ".json", detail);
      simpanBerkas(jenis + "/index.json", idx);
      U.toast(label + " berhasil disimpan.", "sukses");
      location.hash = "#/" + jenis;
    }).catch(function (e) {
      U.toast("Gagal menyimpan: " + e.message, "galat", 5200);
    });
  }

  function hapusPost(jenis, slug, judulPost) {
    if (!confirm("Hapus " + (jenis === "blog" ? "artikel" : "berita") + " “" + (judulPost || slug) + "”?\n\nTindakan ini menghapus entri dari daftar. Berkas data bawaan tidak diubah.")) return;
    dataEfektif(jenis + "/index.json").then(function (idx) {
      idx.item = (idx.item || []).filter(function (x) { return x.slug !== slug; });
      idx.diperbarui = nowISO();
      simpanBerkas(jenis + "/index.json", idx);
      C.hapus(jenis + "/" + slug + ".json");
      perbaruiBadge();
      U.toast("Entri dihapus dari daftar.", "sukses");
      daftarPost(jenis);
    }).catch(function (e) { U.toast(e.message, "galat"); });
  }

  /* =========================================================
     Halaman & Profil (data/site.json)
     ========================================================= */
  function halamanSitus() {
    judul("Halaman & Profil", "Atur identitas fakultas, hero, pengumuman, statistik, keunggulan, dan program studi.");
    memuat("Memuat pengaturan situs…");

    dataEfektif("site.json").then(function (site) {
      state.current = { site: salin(site) };
      var org = site.org || {};
      var ig = org.instagram || {};
      var hero = site.hero || {};
      var meta = site.meta || {};

      isi(
        '<form class="ed-form" data-form="site">' +

          '<div class="ed-seksi">' +
            "<h2>Identitas &amp; Kontak</h2>" +
            "<p>Data ini dipakai pada footer, halaman kontak, dan informasi institusi.</p>" +
            '<div class="ed-baris-2">' +
              field("Nama Universitas", "orgKampus", org.kampus) +
              field("Nama Fakultas", "orgFakultas", org.fakultas) +
              field("Singkatan", "orgSingkatan", org.singkatan) +
              field("Domain", "orgDomain", org.domain) +
              field("Alamat Kampus", "orgAlamat", org.alamat, { penuh: true }) +
              field("Nomor WhatsApp", "orgWhatsapp", org.whatsapp, { placeholder: "628…", petunjuk: "Format internasional tanpa tanda +." }) +
              field("Nomor Tampil", "orgTelepon", org.teleponTampil) +
              field("Email", "orgEmail", org.email, { tipe: "email" }) +
              field("Tahun Berdiri", "orgTahun", org.tahunBerdiri) +
              field("Jam Layanan", "orgJam", org.jamLayanan) +
              field("Instagram Informatika", "igInformatika", ig.informatika) +
              field("Instagram Sains Data", "igSainsData", ig.sainsdata) +
              field("Instagram Teknik Industri", "igTeknikIndustri", ig.teknikindustri) +
            "</div>" +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Hero Halaman Depan</h2>" +
            "<p>Teks utama yang tampil paling atas pada portal FAST.</p>" +
            '<div class="ed-baris-2">' +
              field("Label Kecil", "heroLabel", hero.label, { penuh: true }) +
              field("Judul Utama", "heroJudul", hero.judul) +
              field("Kata Sorot", "heroSorot", hero.sorot) +
              field("Deskripsi", "heroSub", hero.sub, { tipe: "textarea", penuh: true, baris: 3 }) +
            "</div>" +
            "<h3 style=\"margin:18px 0 10px\">Tombol Aksi</h3>" +
            daftarHTML("cta", hero.cta, "Tambah tombol") +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>SEO &amp; Metadata</h2>" +
            '<div class="ed-baris-2">' +
              field("Judul Halaman (title)", "metaTitle", meta.title, { penuh: true }) +
              field("Deskripsi (meta description)", "metaDescription", meta.description, { tipe: "textarea", penuh: true, baris: 3 }) +
            "</div>" +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Pengumuman</h2>" +
            "<p>Pengumuman aktif pertama akan tampil pada bilah di atas hero.</p>" +
            daftarHTML("pengumuman", site.pengumuman, "Tambah pengumuman") +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Statistik</h2>" +
            daftarHTML("statistik", site.statistik, "Tambah statistik") +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Keunggulan</h2>" +
            daftarHTML("keunggulan", site.keunggulan, "Tambah keunggulan") +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Program Studi</h2>" +
            daftarHTML("prodi", site.programStudi, "Tambah program studi") +
          "</div>" +

          '<div class="ed-seksi">' +
            '<div class="admin-aksi-bawah" style="border-top:none;padding-top:0;margin-top:0">' +
              '<button type="submit" class="btn btn-utama">Simpan Halaman</button>' +
              '<a class="btn btn-garis" href="#/ringkasan">Kembali</a>' +
            "</div>" +
            '<details class="ed-json">' +
              "<summary>Editor JSON lengkap (opsional)</summary>" +
              '<textarea data-json-box="site.json" rows="22">' + aman(JSON.stringify(site, null, 2)) + "</textarea>" +
              '<div class="admin-aksi-bawah"><button type="button" class="btn btn-garis btn-kecil" data-aksi="simpan-json" data-berkas="site.json">Simpan JSON</button></div>' +
            "</details>" +
          "</div>" +
        "</form>"
      );
    }).catch(function (e) {
      isi('<div class="admin-catatan merah">Gagal memuat halaman: ' + aman(e.message) + "</div>");
    });
  }

  function simpanSite(form) {
    var d = bacaForm(form);
    var site = salin(state.current.site || {});

    site.meta = site.meta || {};
    site.meta.title = d.metaTitle || "";
    site.meta.description = d.metaDescription || "";

    site.org = site.org || {};
    site.org.kampus = d.orgKampus || "";
    site.org.fakultas = d.orgFakultas || "";
    site.org.singkatan = d.orgSingkatan || "";
    site.org.domain = d.orgDomain || "";
    site.org.alamat = d.orgAlamat || "";
    site.org.whatsapp = d.orgWhatsapp || "";
    site.org.teleponTampil = d.orgTelepon || "";
    site.org.email = d.orgEmail || "";
    site.org.tahunBerdiri = d.orgTahun || "";
    site.org.jamLayanan = d.orgJam || "";
    site.org.instagram = {
      informatika: d.igInformatika || "",
      sainsdata: d.igSainsData || "",
      teknikindustri: d.igTeknikIndustri || ""
    };

    site.hero = site.hero || {};
    site.hero.label = d.heroLabel || "";
    site.hero.judul = d.heroJudul || "";
    site.hero.sorot = d.heroSorot || "";
    site.hero.sub = d.heroSub || "";
    site.hero.cta = bacaDaftar(form, "cta").map(function (c) {
      return { label: c.label, href: c.href, gaya: c.gaya || "btn-aksen" };
    });

    site.pengumuman = bacaDaftar(form, "pengumuman").map(function (p, i) {
      return {
        id: p.id || ("pengumuman-" + Date.now().toString(36) + "-" + i),
        teks: p.teks,
        tautan: p.tautan,
        label: p.label,
        aktif: !!p.aktif
      };
    });
    site.statistik = bacaDaftar(form, "statistik").map(function (s) {
      return { nilai: s.nilai, label: s.label };
    });
    site.keunggulan = bacaDaftar(form, "keunggulan").map(function (k) {
      return { judul: k.judul, teks: k.teks };
    });
    site.programStudi = bacaDaftar(form, "prodi").map(function (p) {
      return { kode: p.kode, nama: p.nama, teks: p.teks, instagram: p.instagram };
    });
    site.diperbarui = nowISO();
    site.versi = (Number(site.versi) || 1) + 1;

    simpanBerkas("site.json", site);
    state.current.site = salin(site);
    U.segarkanFooter();
    U.toast("Halaman & profil berhasil disimpan.", "sukses");
  }

  /* =========================================================
     Academy
     ========================================================= */
  function daftarAcademy() {
    judul("Kelola Academy", "Atur katalog pelatihan, kuota, jadwal, dan silabus.");
    memuat("Memuat kelas…");

    dataEfektif("academy/index.json").then(function (idx) {
      idx.item = idx.item || [];
      idx.kategori = idx.kategori || [];
      var peta = {};
      idx.kategori.forEach(function (k) { peta[k.id] = k; });

      var item = idx.item.slice().sort(function (a, b) {
        return String(a.mulai).localeCompare(String(b.mulai));
      });

      var baris = item.length ? item.map(function (c) {
        var kat = peta[c.kategori] || { nama: c.kategori || "Umum" };
        var penuh = c.status === "penuh" || (c.terdaftar >= c.kuota);
        return "<tr>" +
          '<td class="judul-sel"><strong>' + aman(c.judul) + "</strong><small>" +
            aman(c.id || "") + " · " + aman(c.slug) + "</small></td>" +
          "<td>" + aman(kat.nama) + "</td>" +
          "<td>" + aman(c.mulai || "-") + "</td>" +
          '<td><span class="admin-pill ' + (penuh ? "merah" : "hijau") + '">' +
            aman(c.status || (penuh ? "penuh" : "buka")) + "</span></td>" +
          '<td class="aksi-sel">' +
            '<a class="btn btn-garis btn-kecil" href="#/academy/edit/' + encodeURIComponent(c.slug) + '">Edit</a> ' +
            '<a class="btn btn-garis btn-kecil" target="_blank" rel="noopener" href="/academy/kelas.html?slug=' +
              encodeURIComponent(c.slug) + '">Lihat</a> ' +
            '<button type="button" class="btn btn-bahaya btn-kecil" data-aksi="academy-hapus" data-slug="' +
              aman(c.slug) + '" data-judul="' + aman(c.judul) + '">Hapus</button>' +
          "</td></tr>";
      }).join("") : '<tr><td colspan="5"><div class="admin-kosong">Belum ada kelas. Klik “Tambah Kelas”.</div></td></tr>';

      isi(
        '<div class="admin-kartu">' +
          '<div class="admin-kartu-kepala"><div><h2>Katalog Kelas (' + idx.item.length + ")</h2>" +
            "<p>Kelas berstatus selesai/penuh tetap tampil sesuai pengaturan halaman academy.</p></div>" +
            '<div class="admin-aksi"><a class="btn btn-utama btn-kecil" href="#/academy/baru">+ Tambah Kelas</a>' +
            '<a class="btn btn-garis btn-kecil" target="_blank" rel="noopener" href="/academy/">Buka Halaman</a></div></div>' +
          '<div class="admin-tabel-bungkus"><table class="admin-tabel"><thead><tr>' +
            "<th>Kelas</th><th>Kategori</th><th>Mulai</th><th>Status</th><th class=\"aksi-sel\">Aksi</th>" +
          "</tr></thead><tbody>" + baris + "</tbody></table></div>" +
        "</div>" +

        '<details class="ed-json admin-kartu">' +
          "<summary>Editor JSON Academy (opsional)</summary>" +
          '<textarea data-json-box="academy/index.json" rows="22">' + aman(JSON.stringify(idx, null, 2)) + "</textarea>" +
          '<div class="admin-aksi-bawah"><button type="button" class="btn btn-utama btn-kecil" data-aksi="simpan-json" data-berkas="academy/index.json">Simpan JSON</button></div>' +
        "</details>"
      );
    }).catch(function (e) {
      isi('<div class="admin-catatan merah">Gagal memuat academy: ' + aman(e.message) + "</div>");
    });
  }

  function editorAcademy(slug) {
    judul(slug ? "Edit Kelas" : "Tambah Kelas", "Lengkapi informasi kelas yang akan tampil di Faster Academy.");
    memuat("Menyiapkan editor kelas…");

    dataEfektif("academy/index.json").then(function (idx) {
      idx.item = idx.item || [];
      idx.kategori = idx.kategori || [];
      var lama = slug ? idx.item.filter(function (x) { return x.slug === slug; })[0] : null;
      if (slug && !lama) {
        U.toast("Kelas tidak ditemukan.", "galat");
        location.hash = "#/academy";
        return;
      }

      var c = salin(lama || {});
      c.judul = c.judul || "";
      c.slug = c.slug || "";
      c.kategori = c.kategori || (idx.kategori[0] && idx.kategori[0].id) || "";
      c.level = c.level || "Dasar";
      c.ringkasan = c.ringkasan || "";
      c.durasi = c.durasi || "";
      c.mode = c.mode || "Tatap Muka";
      c.biaya = c.biaya != null ? c.biaya : 0;
      c.biayaTampil = c.biayaTampil || "";
      c.kuota = c.kuota != null ? c.kuota : 20;
      c.terdaftar = c.terdaftar != null ? c.terdaftar : 0;
      c.mulai = c.mulai || hariIni();
      c.selesai = c.selesai || "";
      c.tutupPendaftaran = c.tutupPendaftaran || "";
      c.pengajar = c.pengajar || "";
      c.sertifikat = c.sertifikat !== false;
      c.unggulan = !!c.unggulan;
      c.status = c.status || "buka";
      c.manfaat = c.manfaat || [];
      c.silabus = c.silabus || [];

      state.current = { index: idx, slugLama: slug || null };

      var opsiKategori = idx.kategori.map(function (k) { return { nilai: k.id, label: k.nama }; });
      if (!opsiKategori.length) opsiKategori = [{ nilai: "umum", label: "Umum" }];

      isi(
        '<form class="ed-form" data-form="academy">' +
          '<input type="hidden" data-f="slugLama" value="' + aman(slug || "") + '" />' +
          '<div class="ed-seksi">' +
            "<h2>Informasi Kelas</h2>" +
            '<div class="ed-baris-2">' +
              field("Judul Kelas", "judul", c.judul, { penuh: true }) +
              field("Slug URL", "slug", c.slug, { placeholder: "otomatis-dari-judul" }) +
              field("Kategori", "kategori", c.kategori, { tipe: "select", opsi: opsiKategori }) +
              field("Level", "level", c.level, { tipe: "select", opsi: ["Dasar", "Menengah", "Lanjutan", "Umum"] }) +
              field("Ringkasan", "ringkasan", c.ringkasan, { tipe: "textarea", penuh: true, baris: 3 }) +
              field("Durasi", "durasi", c.durasi, { placeholder: "8 pertemuan (32 jam)" }) +
              field("Mode", "mode", c.mode, { tipe: "select", opsi: ["Tatap Muka", "Daring", "Hibrida"] }) +
              field("Pengajar", "pengajar", c.pengajar) +
              field("Status", "status", c.status, { tipe: "select", opsi: ["buka", "penuh", "selesai"] }) +
            "</div>" +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Jadwal, Biaya &amp; Kuota</h2>" +
            '<div class="ed-baris-2">' +
              field("Tanggal Mulai", "mulai", c.mulai, { tipe: "date" }) +
              field("Tanggal Selesai", "selesai", c.selesai, { tipe: "date" }) +
              field("Tutup Pendaftaran", "tutupPendaftaran", c.tutupPendaftaran, { tipe: "date" }) +
              field("Biaya (angka)", "biaya", c.biaya, { tipe: "number", min: 0 }) +
              field("Biaya Tampil", "biayaTampil", c.biayaTampil, { placeholder: "Rp750.000" }) +
              field("Kuota", "kuota", c.kuota, { tipe: "number", min: 0 }) +
              field("Terdaftar", "terdaftar", c.terdaftar, { tipe: "number", min: 0 }) +
              field("Sertifikat", "sertifikat", c.sertifikat, { tipe: "checkbox" }) +
              field("Jadikan unggulan", "unggulan", c.unggulan, { tipe: "checkbox" }) +
            "</div>" +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Manfaat &amp; Silabus</h2>" +
            '<div class="ed-baris-2">' +
              field("Manfaat", "manfaat", (c.manfaat || []).join("\n"), {
                tipe: "textarea", penuh: true, baris: 6,
                petunjuk: "Satu manfaat per baris."
              }) +
              field("Silabus", "silabus", (c.silabus || []).join("\n"), {
                tipe: "textarea", penuh: true, baris: 8,
                petunjuk: "Satu topik per baris."
              }) +
            "</div>" +
          "</div>" +

          '<div class="ed-seksi">' +
            '<div class="admin-aksi-bawah" style="border-top:none;padding-top:0;margin-top:0">' +
              '<button type="submit" class="btn btn-utama">Simpan Kelas</button>' +
              '<a class="btn btn-garis" href="#/academy">Batal</a>' +
              (slug ? '<a class="btn btn-garis" target="_blank" rel="noopener" href="/academy/kelas.html?slug=' +
                encodeURIComponent(slug) + '">Lihat Kelas</a>' : "") +
              (slug ? '<button type="button" class="btn btn-bahaya" data-aksi="academy-hapus" data-slug="' +
                aman(slug) + '" data-judul="' + aman(c.judul) + '">Hapus</button>' : "") +
            "</div>" +
          "</div>" +
        "</form>"
      );
    }).catch(function (e) {
      isi('<div class="admin-catatan merah">Gagal membuka kelas: ' + aman(e.message) + "</div>");
    });
  }

  function simpanAcademy(form) {
    var d = bacaForm(form);
    if (!d.judul) { U.toast("Judul kelas wajib diisi.", "galat"); return; }

    var idx = salin(state.current.index);
    idx.item = idx.item || [];
    var slugLama = state.current.slugLama;
    var slug = d.slug ? D.slug(d.slug) : D.slug(d.judul);
    if (!slug) slug = "kelas-" + Date.now().toString(36);

    var bentrok = idx.item.some(function (x) { return x.slug === slug && x.slug !== slugLama; });
    if (bentrok) {
      var dasar = slug;
      var n = 2;
      while (idx.item.some(function (x) { return x.slug === slug; })) {
        slug = dasar + "-" + n;
        n++;
      }
    }

    var item = {
      id: d.id || (slugLama && idx.item.filter(function (x) { return x.slug === slugLama; })[0] || {}).id ||
        ("ACD-" + Date.now().toString(36).toUpperCase()),
      slug: slug,
      judul: d.judul,
      kategori: d.kategori || "",
      level: d.level || "Dasar",
      ringkasan: d.ringkasan || "",
      durasi: d.durasi || "",
      mode: d.mode || "Tatap Muka",
      biaya: Number(d.biaya) || 0,
      biayaTampil: d.biayaTampil || "",
      kuota: Number(d.kuota) || 0,
      terdaftar: Number(d.terdaftar) || 0,
      mulai: d.mulai || "",
      selesai: d.selesai || "",
      tutupPendaftaran: d.tutupPendaftaran || "",
      pengajar: d.pengajar || "",
      sertifikat: !!d.sertifikat,
      unggulan: !!d.unggulan,
      status: d.status || "buka",
      manfaat: keBaris(d.manfaat),
      silabus: keBaris(d.silabus)
    };

    var posisi = -1;
    idx.item.forEach(function (x, i) { if (x.slug === slugLama) posisi = i; });
    if (posisi >= 0) idx.item[posisi] = item;
    else idx.item.unshift(item);
    idx.diperbarui = nowISO();

    simpanBerkas("academy/index.json", idx);
    U.toast("Kelas berhasil disimpan.", "sukses");
    location.hash = "#/academy";
  }

  function hapusAcademy(slug, judulKelas) {
    if (!confirm("Hapus kelas “" + (judulKelas || slug) + "”?")) return;
    dataEfektif("academy/index.json").then(function (idx) {
      idx.item = (idx.item || []).filter(function (x) { return x.slug !== slug; });
      idx.diperbarui = nowISO();
      simpanBerkas("academy/index.json", idx);
      U.toast("Kelas dihapus dari katalog.", "sukses");
      daftarAcademy();
    }).catch(function (e) { U.toast(e.message, "galat"); });
  }

  /* =========================================================
     PMB
     ========================================================= */
  function halamanPmb() {
    judul("Pengaturan PMB", "Atur tahun akademik, status pendaftaran, jadwal, jalur, biaya, dan FAQ.");
    memuat("Memuat pengaturan PMB…");

    dataEfektif("pmb/config.json").then(function (cfg) {
      state.current = { pmb: salin(cfg) };
      var biaya = cfg.biaya || {};

      isi(
        '<form class="ed-form" data-form="pmb">' +
          '<div class="ed-seksi">' +
            "<h2>Status Pendaftaran</h2>" +
            '<div class="ed-baris-2">' +
              field("Tahun Akademik", "tahunAkademik", cfg.tahunAkademik, { placeholder: "2026/2027" }) +
              field("Status", "statusPendaftaran", cfg.statusPendaftaran, { tipe: "select", opsi: [
                { nilai: "dibuka", label: "Dibuka" },
                { nilai: "ditutup", label: "Ditutup" },
                { nilai: "segera", label: "Segera dibuka" }
              ] }) +
              field("Catatan Status", "catatanStatus", cfg.catatanStatus, { tipe: "textarea", penuh: true, baris: 2 }) +
            "</div>" +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Jadwal</h2>" +
            daftarHTML("jadwal", cfg.jadwal, "Tambah jadwal") +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Jalur Pendaftaran</h2>" +
            daftarHTML("jalur", cfg.jalur, "Tambah jalur") +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Program Studi PMB</h2>" +
            daftarHTML("prodiPmb", cfg.programStudi, "Tambah program studi") +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Biaya</h2>" +
            '<div class="ed-baris-2">' +
              field("Catatan Biaya", "biayaCatatan", biaya.catatan, { tipe: "textarea", penuh: true, baris: 3 }) +
            "</div>" +
            "<h3 style=\"margin:16px 0 10px\">Rincian Biaya</h3>" +
            daftarHTML("biayaItem", biaya.item, "Tambah rincian biaya") +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Alur Pendaftaran</h2>" +
            daftarHTML("langkah", cfg.langkah, "Tambah langkah") +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>Berkas Persyaratan</h2>" +
            field("Daftar Berkas", "berkas", (cfg.berkas || []).join("\n"), {
              tipe: "textarea", penuh: true, baris: 7,
              petunjuk: "Satu persyaratan per baris."
            }) +
          "</div>" +

          '<div class="ed-seksi">' +
            "<h2>FAQ</h2>" +
            daftarHTML("faq", cfg.faq, "Tambah FAQ") +
          "</div>" +

          '<div class="ed-seksi">' +
            '<div class="admin-aksi-bawah" style="border-top:none;padding-top:0;margin-top:0">' +
              '<button type="submit" class="btn btn-utama">Simpan Pengaturan PMB</button>' +
              '<a class="btn btn-garis" href="#/ringkasan">Kembali</a>' +
            "</div>" +
            '<details class="ed-json">' +
              "<summary>Editor JSON PMB (opsional)</summary>" +
              '<textarea data-json-box="pmb/config.json" rows="22">' + aman(JSON.stringify(cfg, null, 2)) + "</textarea>" +
              '<div class="admin-aksi-bawah"><button type="button" class="btn btn-garis btn-kecil" data-aksi="simpan-json" data-berkas="pmb/config.json">Simpan JSON</button></div>' +
            "</details>" +
          "</div>" +
        "</form>"
      );
    }).catch(function (e) {
      isi('<div class="admin-catatan merah">Gagal memuat PMB: ' + aman(e.message) + "</div>");
    });
  }

  function simpanPmb(form) {
    var d = bacaForm(form);
    var cfg = salin(state.current.pmb || {});
    cfg.tahunAkademik = d.tahunAkademik || "";
    cfg.statusPendaftaran = d.statusPendaftaran || "dibuka";
    cfg.catatanStatus = d.catatanStatus || "";
    cfg.jadwal = bacaDaftar(form, "jadwal");
    cfg.jalur = bacaDaftar(form, "jalur");
    cfg.programStudi = bacaDaftar(form, "prodiPmb");
    cfg.biaya = {
      catatan: d.biayaCatatan || "",
      item: bacaDaftar(form, "biayaItem")
    };
    cfg.langkah = bacaDaftar(form, "langkah").map(function (l, i) {
      return { no: Number(l.no) || (i + 1), judul: l.judul, teks: l.teks };
    });
    cfg.berkas = keBaris(d.berkas);
    cfg.faq = bacaDaftar(form, "faq").map(function (f) {
      return { t: f.t, j: f.j };
    });
    cfg.diperbarui = nowISO();
    cfg.versi = (Number(cfg.versi) || 1) + 1;

    simpanBerkas("pmb/config.json", cfg);
    state.current.pmb = salin(cfg);
    U.toast("Pengaturan PMB berhasil disimpan.", "sukses");
  }

  /* =========================================================
     Data & Publikasi
     ========================================================= */
  function halamanData() {
    judul("Data & Publikasi", "Cadangkan, pulihkan, unduh, atau terbitkan konten ke repositori GitHub.");
    var files = C.daftar();
    var token = "";
    try { token = sessionStorage.getItem(KUNCI_TOKEN) || ""; } catch (e) { /* abaikan */ }

    var baris = files.length ? files.map(function (f) {
      return "<tr>" +
        '<td class="judul-sel"><strong>' + aman(f) + "</strong><small>Disimpan melalui Panel Admin</small></td>" +
        '<td><span class="admin-pill aksen">Lokal</span></td>' +
        '<td class="aksi-sel">' +
          '<button type="button" class="btn btn-garis btn-kecil" data-aksi="unduh-berkas" data-berkas="' + aman(f) + '">Unduh</button> ' +
          '<button type="button" class="btn btn-bahaya btn-kecil" data-aksi="reset-berkas" data-berkas="' + aman(f) + '">Reset</button>' +
        "</td></tr>";
    }).join("") : '<tr><td colspan="3"><div class="admin-kosong">Belum ada perubahan lokal. Konten masih memakai data bawaan.</div></td></tr>';

    isi(
      '<div class="admin-grid">' +
        kartuStat(files.length, "Berkas Diubah", "Tersimpan di browser") +
        kartuStat(C.diperbarui() ? U.tanggal(C.diperbarui(), "pendek") : "-", "Terakhir Diperbarui", "Perubahan lokal") +
        kartuStat("GitHub", "Repositori Tujuan", CFG.data.owner + "/" + CFG.data.repo) +
      "</div>" +

      '<div class="admin-kartu mt-3">' +
        '<div class="admin-kartu-kepala"><div><h2>Cadangan Konten</h2>' +
          "<p>Unduh cadangan untuk menyimpan perubahan, atau pulihkan dari berkas cadangan.</p></div>" +
          '<div class="admin-aksi">' +
            '<button type="button" class="btn btn-utama btn-kecil" data-aksi="ekspor">Unduh Cadangan</button>' +
            '<label class="btn btn-garis btn-kecil admin-unggah">Impor Cadangan<input type="file" id="fileImpor" accept="application/json" /></label>' +
            '<button type="button" class="btn btn-bahaya btn-kecil" data-aksi="reset-semua">Reset Semua</button>' +
          "</div></div>" +
        '<div class="admin-tabel-bungkus"><table class="admin-tabel"><thead><tr><th>Berkas</th><th>Status</th><th class="aksi-sel">Aksi</th></tr></thead><tbody>' +
          baris + "</tbody></table></div>" +
      "</div>" +

      '<div class="admin-kartu">' +
        '<div class="admin-kartu-kepala"><div><h2>Terbitkan ke GitHub</h2>' +
          "<p>Kirim perubahan lokal ke repositori agar berlaku untuk semua pengunjung. Diperlukan Personal Access Token dengan izin <strong>Contents: Read and write</strong>.</p></div></div>" +
        '<div class="ed-baris-2">' +
          field("Owner / Organisasi", "ghOwner", CFG.data.owner) +
          field("Repositori", "ghRepo", CFG.data.repo) +
          field("Branch", "ghBranch", CFG.data.branch) +
          field("Folder Data", "ghDataDir", CFG.data.dataDir) +
          field("Personal Access Token", "ghToken", token, { tipe: "password", penuh: true, placeholder: "ghp_… / github_pat_…" }) +
        "</div>" +
        '<div class="admin-catatan kuning mt-2">Token hanya disimpan di <strong>sessionStorage</strong> tab ini dan tidak dikirim ke mana pun selain GitHub API. Jangan gunakan token ini pada komputer bersama. Setelah terbit, tunggu proses deploy GitHub Pages/Netlify selesai.</div>' +
        '<div class="admin-aksi-bawah">' +
          '<button type="button" class="btn btn-utama" data-aksi="publish">Terbitkan Sekarang</button>' +
          '<span class="admin-status" id="statusPublish"></span>' +
        "</div>" +
      "</div>" +

      '<div class="admin-kartu">' +
        '<h2>Pemeliharaan</h2>' +
        '<p style="margin:8px 0 14px">Bersihkan cache data di memori lalu muat ulang tampilan panel. Perubahan lokal tidak dihapus.</p>' +
        '<button type="button" class="btn btn-garis btn-kecil" data-aksi="muat-ulang">Muat Ulang Data</button>' +
      "</div>" +

      '<div class="admin-catatan mt-3">' +
        "Ingin menyalin manual? Gunakan tombol <strong>Unduh</strong> pada tiap berkas, lalu letakkan hasilnya di folder <code>data/</code> sesuai nama berkas (mis. <code>blog/index.json</code>)." +
      "</div>"
    );
  }

  function b64utf8(teks) {
    var bytes = new TextEncoder().encode(teks);
    var bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  function githubPut(cfg, path, obj) {
    var full = (cfg.dataDir ? String(cfg.dataDir).replace(/\/+$/, "") + "/" : "") + path;
    var url = "https://api.github.com/repos/" + encodeURIComponent(cfg.owner) + "/" +
      encodeURIComponent(cfg.repo) + "/contents/" +
      full.split("/").map(encodeURIComponent).join("/");
    var headers = {
      Authorization: "Bearer " + cfg.token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };

    return fetch(url + "?ref=" + encodeURIComponent(cfg.branch), { headers: headers })
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) {
          return r.text().then(function (t) {
            throw new Error("Gagal membaca metadata GitHub (" + r.status + "): " + t.slice(0, 140));
          });
        }
        return r.json();
      })
      .then(function (meta) {
        var body = {
          message: "perbarui " + path + " via Panel FAST",
          content: b64utf8(JSON.stringify(obj, null, 2) + "\n"),
          branch: cfg.branch
        };
        if (meta && meta.sha) body.sha = meta.sha;
        return fetch(url, {
          method: "PUT",
          headers: Object.assign({ "Content-Type": "application/json" }, headers),
          body: JSON.stringify(body)
        });
      })
      .then(function (r) {
        if (!r.ok) {
          return r.text().then(function (t) {
            throw new Error("Gagal menerbitkan " + path + " (" + r.status + "): " + t.slice(0, 160));
          });
        }
        return r.json();
      });
  }

  function terbitkanGitHub(btn) {
    var cfg = {
      owner: (document.getElementById("ghOwner") || {}).value || "",
      repo: (document.getElementById("ghRepo") || {}).value || "",
      branch: (document.getElementById("ghBranch") || {}).value || "",
      dataDir: (document.getElementById("ghDataDir") || {}).value || "",
      token: (document.getElementById("ghToken") || {}).value || ""
    };
    var status = document.getElementById("statusPublish");
    function setStatus(t, jenis) {
      if (!status) return;
      status.textContent = t;
      status.className = "admin-status" + (jenis ? " " + jenis : "");
    }

    cfg.owner = cfg.owner.trim();
    cfg.repo = cfg.repo.trim();
    cfg.branch = cfg.branch.trim() || "main";
    cfg.dataDir = cfg.dataDir.trim();
    cfg.token = cfg.token.trim();

    if (!cfg.owner || !cfg.repo || !cfg.token) {
      setStatus("Isi owner, repositori, dan token terlebih dahulu.", "galat");
      U.toast("Data publikasi belum lengkap.", "galat");
      return;
    }

    var files = C.semua();
    var paths = Object.keys(files);
    if (!paths.length) {
      setStatus("Belum ada perubahan untuk diterbitkan.", "galat");
      return;
    }

    try { sessionStorage.setItem(KUNCI_TOKEN, cfg.token); } catch (e) { /* abaikan */ }

    btn.disabled = true;
    var i = 0;
    var sukses = 0;

    function lanjut() {
      if (i >= paths.length) {
        btn.disabled = false;
        setStatus("Berhasil menerbitkan " + sukses + " berkas ke GitHub.", "sukses");
        U.toast("Publikasi selesai: " + sukses + " berkas.", "sukses", 5200);
        return;
      }
      var p = paths[i++];
      setStatus("Menerbitkan " + p + " (" + i + "/" + paths.length + ")…");
      return githubPut(cfg, p, files[p]).then(function () {
        sukses++;
        return lanjut();
      });
    }

    Promise.resolve().then(lanjut).catch(function (e) {
      btn.disabled = false;
      setStatus(e.message || "Gagal menerbitkan.", "galat");
      U.toast(e.message || "Gagal menerbitkan ke GitHub.", "galat", 6200);
    });
  }

  /* =========================================================
     Penanganan aksi & formulir
     ========================================================= */
  function tanganiKlik(ev) {
    var b = ev.target.closest("[data-aksi]");
    if (!b) return;
    var aksi = b.getAttribute("data-aksi");

    if (aksi === "tambah-baris") {
      var nama = b.getAttribute("data-list");
      var host = document.querySelector('#adminKonten .ed-daftar[data-list="' + nama + '"]');
      if (host && KOLOM[nama]) host.insertAdjacentHTML("beforeend", barisHTML(KOLOM[nama], {}));
      return;
    }

    if (aksi === "hapus-baris") {
      var baris = b.closest(".ed-baris");
      if (baris) baris.remove();
      return;
    }

    if (aksi === "pratinjau-post") {
      var form = b.closest("form");
      var ta = form ? form.querySelector('[data-f="isi"]') : null;
      var pre = document.getElementById("pratinjauPost");
      if (ta && pre) {
        pre.innerHTML = MD.render(ta.value);
        pre.hidden = !pre.hidden;
        if (!pre.hidden) pre.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      return;
    }

    if (aksi === "post-hapus") {
      hapusPost(b.getAttribute("data-jenis"), b.getAttribute("data-slug"), b.getAttribute("data-judul"));
      return;
    }

    if (aksi === "kategori-tambah") { tambahKategori(b.getAttribute("data-jenis")); return; }
    if (aksi === "kategori-hapus") { hapusKategori(b.getAttribute("data-jenis"), b.getAttribute("data-id")); return; }
    if (aksi === "academy-hapus") { hapusAcademy(b.getAttribute("data-slug"), b.getAttribute("data-judul")); return; }

    if (aksi === "simpan-json") {
      var kotak = b.closest(".ed-json");
      var box = kotak ? kotak.querySelector("[data-json-box]") : null;
      var berkas = b.getAttribute("data-berkas") || (box && box.getAttribute("data-json-box"));
      if (!box || !berkas) return;
      try {
        var obj = JSON.parse(box.value);
        if (!obj || typeof obj !== "object") throw new Error("JSON harus berupa objek.");
        simpanBerkas(berkas, obj);
        state.base = {};
        U.toast("JSON " + berkas + " disimpan.", "sukses");
        route();
      } catch (e) {
        U.toast("JSON tidak valid: " + e.message, "galat", 6000);
      }
      return;
    }

    if (aksi === "hapus-gambar") {
      pasangGambar("");
      U.toast("Gambar dihapus dari formulir.", "info");
      return;
    }

    if (aksi === "unduh-berkas") { unduhBerkas(b.getAttribute("data-berkas")); return; }
    if (aksi === "reset-berkas") {
      var f = b.getAttribute("data-berkas");
      if (!confirm("Kembalikan " + f + " ke data bawaan? Perubahan lokal pada berkas ini akan dihapus.")) return;
      resetBerkas(f);
      U.toast("Berkas " + f + " dikembalikan ke bawaan.", "info");
      halamanData();
      return;
    }
    if (aksi === "ekspor") {
      unduhJSON("fast-konten-backup-" + hariIni() + ".json", C.export());
      U.toast("Cadangan diunduh.", "sukses");
      return;
    }
    if (aksi === "reset-semua") {
      if (!confirm("Hapus SEMUA perubahan lokal dan kembalikan seluruh konten ke data bawaan?")) return;
      C.reset();
      state.base = {};
      D.segarkan();
      U.toast("Semua perubahan lokal telah dihapus.", "info");
      halamanData();
      return;
    }
    if (aksi === "muat-ulang") {
      D.segarkan();
      state.base = {};
      U.toast("Cache data dimuat ulang.", "info");
      route();
      return;
    }
    if (aksi === "publish") { terbitkanGitHub(b); return; }
  }

  function tanganiSubmit(ev) {
    var form = ev.target.closest("[data-form]");
    if (!form) return;
    ev.preventDefault();
    var jenis = form.getAttribute("data-form");
    if (jenis === "post") simpanPost(form);
    else if (jenis === "site") simpanSite(form);
    else if (jenis === "academy") simpanAcademy(form);
    else if (jenis === "pmb") simpanPmb(form);
  }

  /* =========================================================
     Mulai
     ========================================================= */
  pasangLogin();
  if (SES) tampilkanShell();
  else tampilkanLogin();

})();
