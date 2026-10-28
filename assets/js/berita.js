/* =========================================================
   Berita FAST — logika daftar & detail artikel
   ========================================================= */
(function () {
  "use strict";

  var D = window.FAST.data;
  var U = window.FAST.ui;
  var MD = window.FAST.md;
  var el = U.el;

  var PER_HALAMAN = 6;

  /* =========================================================
     MODE DAFTAR (berita/index.html)
     ========================================================= */
  function modeDaftar() {
    var induk = document.getElementById("daftarBerita");
    if (!induk) return false;

    var state = { semua: [], kategori: "semua", cari: "", tampil: PER_HALAMAN, petaKategori: {} };
    var kotakKategori = document.getElementById("filterKategori");
    var tombolLagi = document.getElementById("muatLagi");
    var inputCari = document.getElementById("cari");

    D.json("berita/index.json").then(function (idx) {
      state.petaKategori = {};
      (idx.kategori || []).forEach(function (k) { state.petaKategori[k.id] = k; });
      state.semua = (idx.item || []).filter(function (x) {
        return x.status !== "draf";
      }).slice().sort(function (a, b) {
        return String(b.tanggal).localeCompare(String(a.tanggal));
      });

      /* Pil kategori */
      if (kotakKategori) {
        kotakKategori.innerHTML = "";
        var semua = el("button", { class: "aktif", type: "button" }, "Semua");
        semua.addEventListener("click", function () { pilihKategori("semua", semua); });
        kotakKategori.appendChild(semua);
        (idx.kategori || []).forEach(function (k) {
          var b = el("button", { type: "button" }, k.ikon ? k.ikon + " " + k.nama : k.nama);
          b.addEventListener("click", function () { pilihKategori(k.id, b); });
          kotakKategori.appendChild(b);
        });
      }

      gambar();
    }).catch(function () {
      induk.innerHTML = '<div class="kosong"><div class="kosong-ikon">⚠️</div><h3>Gagal memuat berita</h3><p>Periksa koneksi atau berkas <code>data/berita/index.json</code>.</p></div>';
    });

    function pilihKategori(id, tombol) {
      state.kategori = id;
      state.tampil = PER_HALAMAN;
      if (kotakKategori) {
        kotakKategori.querySelectorAll("button").forEach(function (b) { b.classList.remove("aktif"); });
        tombol.classList.add("aktif");
      }
      gambar();
    }

    function cocok(b) {
      if (b.status === "draf") return false;
      if (state.kategori !== "semua" && b.kategori !== state.kategori) return false;
      if (!state.cari) return true;
      var q = state.cari.toLowerCase();
      var teks = [b.judul, b.ringkasan, (b.tagar || []).join(" "), b.penulis].join(" ").toLowerCase();
      return teks.indexOf(q) >= 0;
    }

    function gambar() {
      var hasil = state.semua.filter(cocok);
      if (!hasil.length) {
        induk.innerHTML = '<div class="kosong"><div class="kosong-ikon">🔍</div><h3>Tidak ada berita ditemukan</h3><p>Coba ubah kata kunci atau pilih kategori lain.</p></div>';
        if (tombolLagi) tombolLagi.hidden = true;
        return;
      }

      var potong = hasil.slice(0, state.tampil);
      induk.innerHTML = "";

      /* Berita utama = item pertama */
      induk.appendChild(kartuUtama(potong[0]));
      potong.slice(1).forEach(function (b) { induk.appendChild(kartuKecil(b)); });

      if (tombolLagi) {
        tombolLagi.hidden = hasil.length <= state.tampil;
        tombolLagi.textContent = "Muat Berita Lainnya (" + (hasil.length - state.tampil) + ")";
      }
    }

    function labelKategori(b) {
      return state.petaKategori[b.kategori] || { nama: b.kategori || "Umum", warna: "#0d3b8c" };
    }

    function kartuUtama(b) {
      var kat = labelKategori(b);
      var a = el("a", { href: "artikel.html?slug=" + encodeURIComponent(b.slug), class: "berita-utama" });
      a.innerHTML =
        '<div class="bu-sampul"' + (b.gambar ? ' style="background:url(' + U.aman(b.gambar) + ') center/cover"' : "") + ">" +
          (b.gambar ? "" : "📰") + "</div>" +
        '<div class="bu-isi">' +
          '<div class="fleks" style="gap:10px">' +
            '<span class="tag" style="background:' + U.aman(kat.warna) + '1a;color:' + U.aman(kat.warna) + '">' + U.aman(kat.nama) + "</span>" +
            '<span class="tag tag-abu">⭐ Utama</span>' +
          "</div>" +
          "<h2>" + U.aman(b.judul) + "</h2>" +
          '<p style="color:var(--teks-redup)">' + U.aman(b.ringkasan || "") + "</p>" +
          '<div class="berita-meta" style="margin-top:16px">' +
            "<span>✍️ " + U.aman(b.penulis || "Humas FAST") + "</span>" +
            "<span>📅 " + U.tanggal(b.tanggal) + "</span>" +
          "</div>" +
        "</div>";
      return a;
    }

    function kartuKecil(b) {
      var kat = labelKategori(b);
      var a = el("a", { href: "artikel.html?slug=" + encodeURIComponent(b.slug), class: "berita-kartu" });
      a.innerHTML =
        '<div class="berita-sampul"' + (b.gambar ? ' style="background:url(' + U.aman(b.gambar) + ') center/cover"' : "") + ">" + (b.gambar ? "" : "📰") + "</div>" +
        '<div class="berita-isi">' +
          '<div class="berita-meta">' +
            '<span class="tag" style="background:' + U.aman(kat.warna) + '1a;color:' + U.aman(kat.warna) + '">' + U.aman(kat.nama) + "</span>" +
            "<span>📅 " + U.tanggal(b.tanggal, "pendek") + "</span>" +
          "</div>" +
          "<h3>" + U.aman(b.judul) + "</h3>" +
          '<p class="berita-ringkas">' + U.aman(b.ringkasan || "") + "</p>" +
          '<div class="berita-meta" style="margin-top:12px"><span>✍️ ' + U.aman(b.penulis || "Humas FAST") + "</span></div>" +
        "</div>";
      return a;
    }

    if (inputCari) {
      var jeda;
      inputCari.addEventListener("input", function () {
        clearTimeout(jeda);
        jeda = setTimeout(function () {
          state.cari = inputCari.value.trim();
          state.tampil = PER_HALAMAN;
          gambar();
        }, 220);
      });
    }
    if (tombolLagi) {
      tombolLagi.addEventListener("click", function () {
        state.tampil += PER_HALAMAN;
        gambar();
      });
    }
    return true;
  }

  /* =========================================================
     MODE ARTIKEL (berita/artikel.html)
     ========================================================= */
  function modeArtikel() {
    var induk = document.getElementById("artikel");
    if (!induk) return false;

    var slug = new URLSearchParams(location.search).get("slug");
    if (!slug) { gagal("Slug artikel tidak diberikan pada URL."); return true; }

    D.json("berita/index.json").then(function (idx) {
      var entri = (idx.item || []).filter(function (x) { return x.slug === slug; })[0];
      if (!entri) throw new Error("Artikel tidak ditemukan pada indeks berita.");
      if (entri.status === "draf") throw new Error("Artikel ini masih berupa draf dan belum diterbitkan.");

      var peta = {};
      (idx.kategori || []).forEach(function (k) { peta[k.id] = k; });
      var kat = peta[entri.kategori] || { nama: entri.kategori || "Umum", warna: "#0d3b8c" };

      return D.json("berita/" + entri.berkas).then(function (a) {
        document.title = a.judul + " — Berita FAST";
        var metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute("content", a.ringkasan || "");

        var jj = document.getElementById("jejakJudul");
        if (jj) jj.textContent = U.singkat(a.judul, 48);

        var tagar = (a.tagar || []).map(function (t) {
          return '<span class="tag tag-abu">#' + U.aman(t) + "</span>";
        }).join(" ");

        induk.innerHTML =
          '<div class="artikel-sampul"' + (a.gambar ? ' style="background:url(' + U.aman(a.gambar) + ') center/cover"' : "") + ">" +
            (a.gambar ? "" : "📰") + "</div>" +
          '<span class="tag" style="background:' + U.aman(kat.warna) + '1a;color:' + U.aman(kat.warna) + '">' + U.aman(kat.nama) + "</span>" +
          '<h1 class="artikel-judul">' + U.aman(a.judul) + "</h1>" +
          '<div class="artikel-meta">' +
            '<span class="penulis">✍️ ' + U.aman(a.penulis || "Humas FAST") + "</span>" +
            "<span>📅 " + U.tanggal(a.tanggal, "hari") + "</span>" +
            "<span>⏱️ " + Math.max(1, Math.round(MD.polos(a.isi).split(/\s+/).length / 200)) + " menit baca</span>" +
          "</div>" +
          '<div class="artikel-isi">' + MD.render(a.isi) + "</div>" +
          (tagar ? '<div class="fleks mt-3" style="gap:8px">' + tagar + "</div>" : "") +
          '<div class="berbagi">' +
            "<span>Bagikan:</span>" +
            '<a class="btn btn-garis btn-kecil" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(a.judul + " " + location.href) + '">💬 WhatsApp</a>' +
            '<a class="btn btn-garis btn-kecil" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(location.href) + '">📘 Facebook</a>' +
            '<button class="btn btn-garis btn-kecil" id="salinTautan" type="button">🔗 Salin Tautan</button>' +
          "</div>";

        var salin = document.getElementById("salinTautan");
        if (salin) salin.addEventListener("click", function () {
          navigator.clipboard.writeText(location.href).then(function () {
            U.toast("Tautan artikel disalin.", "sukses");
          }).catch(function () { U.toast("Tidak dapat menyalin tautan.", "galat"); });
        });

        /* Berita samping */
        var samping = document.getElementById("beritaSamping");
        if (samping) {
          var lain = (idx.item || []).filter(function (x) { return x.slug !== slug && x.status !== "draf"; }).slice(0, 5);
          samping.innerHTML = lain.map(function (b, i) {
            return '<a class="mini-berita" href="artikel.html?slug=' + encodeURIComponent(b.slug) + '">' +
              '<span class="mini-no">' + (i + 1) + "</span>" +
              "<span><strong>" + U.aman(b.judul) + "</strong>" +
              "<small>📅 " + U.tanggal(b.tanggal, "pendek") + "</small></span></a>";
          }).join("");
        }
      });
    }).catch(function (e) { gagal(e.message); });
    return true;

    function gagal(pesan) {
      induk.innerHTML =
        '<div class="kosong"><div class="kosong-ikon">📭</div><h3>Artikel tidak dapat ditampilkan</h3>' +
        "<p>" + U.aman(pesan) + "</p>" +
        '<a href="/berita/" class="btn btn-utama mt-2">Kembali ke daftar berita</a></div>';
    }
  }

  if (!modeArtikel()) modeDaftar();
})();
