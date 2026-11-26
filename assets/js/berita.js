/* =========================================================
   Berita FAST — logika daftar & detail artikel
   Mode realtime: data berita selalu diambil dari repositori
   GitHub dengan pemutus cache, lalu diperiksa berkala agar
   berita baru/terbarui langsung terlihat pengunjung.
   ========================================================= */
(function () {
  "use strict";

  var CFG = window.FAST_CONFIG || {};
  var D = window.FAST.data;
  var U = window.FAST.ui;
  var MD = window.FAST.md;
  var el = U.el;

  var PER_HALAMAN = 6;
  var SEBUTAN = "Berita";
  var REALTIME = !!(CFG.data && CFG.data.realtime);
  var LIVE_MS = Math.max(8000, (CFG.data && CFG.data.realtimeInterval) || 20000);

  /* =========================================================
     MODE DAFTAR (berita/index.html)
     ========================================================= */
  function modeDaftar() {
    var induk = document.getElementById("daftarBerita");
    if (!induk) return false;

    var state = {
      semua: [],
      kategori: "semua",
      cari: "",
      tampil: PER_HALAMAN,
      petaKategori: {},
      sisa: [],
      terpasang: 0,
      cap: ""
    };

    var kotakKategori = document.getElementById("filterKategori");
    var tombolLagi = document.getElementById("muatLagi");
    var bungkusLagi = document.getElementById("muatBungkus");
    var infoLagi = document.getElementById("muatInfo");
    var inputCari = document.getElementById("cari");
    var statusLive = document.getElementById("liveStatus");
    var teksLive = document.getElementById("liveText");
    var pilSudah = false;

    function tandaiLive() {
      if (!statusLive) return;
      if (!REALTIME) { statusLive.hidden = true; return; }
      statusLive.hidden = false;
      var d = new Date();
      var p = function (n) { return String(n).padStart(2, "0"); };
      if (teksLive) teksLive.textContent = "Realtime · " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    }

    function susunPil(kategori) {
      if (!kotakKategori || pilSudah) return;
      pilSudah = true;
      kotakKategori.innerHTML = "";
      var semua = el("button", { class: "aktif", type: "button" }, "Semua");
      semua.addEventListener("click", function () { pilihKategori("semua", semua); });
      kotakKategori.appendChild(semua);
      (kategori || []).forEach(function (k) {
        var b = el("button", { type: "button" }, k.nama);
        b.addEventListener("click", function () { pilihKategori(k.id, b); });
        kotakKategori.appendChild(b);
      });
    }

    function pilihKategori(id, tombol) {
      state.kategori = id;
      if (kotakKategori) {
        kotakKategori.querySelectorAll("button").forEach(function (b) { b.classList.remove("aktif"); });
        tombol.classList.add("aktif");
      }
      renderUlang(false);
    }

    function cocok(b) {
      if (b.status === "draf") return false;
      if (state.kategori !== "semua" && b.kategori !== state.kategori) return false;
      if (!state.cari) return true;
      var q = state.cari.toLowerCase();
      var teks = [b.judul, b.ringkasan, (b.tagar || []).join(" "), b.penulis].join(" ").toLowerCase();
      return teks.indexOf(q) >= 0;
    }

    function hasilSaring() {
      return state.semua.filter(cocok);
    }

    function renderUlang(jagaTampil) {
      if (!jagaTampil) state.tampil = PER_HALAMAN;
      var hasil = hasilSaring();

      if (!hasil.length) {
        induk.innerHTML = '<div class="kosong"><h3>Tidak ada berita ditemukan</h3><p>Coba ubah kata kunci atau pilih kategori lain.</p></div>';
        state.sisa = [];
        state.terpasang = 0;
        perbaruiTombol(0);
        return;
      }

      /* Artikel utama: pilih unggulan di antara berita terbaru,
         jika tidak ada gunakan berita paling baru. */
      var utama = hasil.slice(0, 3).filter(function (x) { return x.unggulan; })[0] || hasil[0];
      state.sisa = hasil.filter(function (x) { return x !== utama; });
      state.terpasang = 0;

      induk.innerHTML = "";
      induk.appendChild(kartuUtama(utama));
      tambahKartu(Math.max(0, state.tampil - 1));
      perbaruiTombol(hasil.length);
    }

    /* Tambah kartu berikutnya tanpa menggambar ulang seluruh daftar. */
    function tambahKartu(batas) {
      var target = Math.min(state.sisa.length, batas);
      while (state.terpasang < target) {
        var kartu = kartuKecil(state.sisa[state.terpasang]);
        kartu.classList.add("baru");
        induk.appendChild(kartu);
        state.terpasang++;
      }
    }

    function perbaruiTombol(total) {
      var terlihat = total ? Math.min(total, 1 + state.terpasang) : 0;
      var sisa = Math.max(0, total - terlihat);

      if (bungkusLagi) bungkusLagi.hidden = sisa <= 0;
      if (tombolLagi) {
        tombolLagi.hidden = sisa <= 0;
        tombolLagi.textContent = "Muat " + SEBUTAN + " Lainnya (" + sisa + ")";
      }
      if (infoLagi) {
        infoLagi.textContent = total
          ? "Menampilkan " + terlihat + " dari " + total + " " + SEBUTAN.toLowerCase() + "."
          : "";
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
          "" + "</div>" +
        '<div class="bu-isi">' +
          '<div class="fleks" style="gap:10px">' +
            '<span class="tag" style="background:' + U.aman(kat.warna) + '1a;color:' + U.aman(kat.warna) + '">' + U.aman(kat.nama) + "</span>" +
            '<span class="tag tag-abu">Utama</span>' +
          "</div>" +
          "<h2>" + U.aman(b.judul) + "</h2>" +
          '<p style="color:var(--teks-redup)">' + U.aman(b.ringkasan || "") + "</p>" +
          '<div class="berita-meta" style="margin-top:16px">' +
            "<span>" + U.aman(b.penulis || "Humas FAST") + "</span>" +
            "<span>" + U.tanggal(b.tanggal) + "</span>" +
          "</div>" +
        "</div>";
      return a;
    }

    function kartuKecil(b) {
      var kat = labelKategori(b);
      var a = el("a", { href: "artikel.html?slug=" + encodeURIComponent(b.slug), class: "berita-kartu" });
      a.innerHTML =
        '<div class="berita-sampul"' + (b.gambar ? ' style="background:url(' + U.aman(b.gambar) + ') center/cover"' : "") + ">" + "" + "</div>" +
        '<div class="berita-isi">' +
          '<div class="berita-meta">' +
            '<span class="tag" style="background:' + U.aman(kat.warna) + '1a;color:' + U.aman(kat.warna) + '">' + U.aman(kat.nama) + "</span>" +
            "<span>" + U.tanggal(b.tanggal, "pendek") + "</span>" +
          "</div>" +
          "<h3>" + U.aman(b.judul) + "</h3>" +
          '<p class="berita-ringkas">' + U.aman(b.ringkasan || "") + "</p>" +
          '<div class="berita-meta" style="margin-top:12px"><span>' + U.aman(b.penulis || "Humas FAST") + "</span></div>" +
        "</div>";
      return a;
    }

    /* Terapkan data indeks terbaru. */
    function terapkan(idx, pertama) {
      state.petaKategori = {};
      (idx.kategori || []).forEach(function (k) { state.petaKategori[k.id] = k; });

      var semuaBaru = (idx.item || []).filter(function (x) {
        return x.status !== "draf";
      }).slice().sort(function (a, b) {
        return String(b.tanggal).localeCompare(String(a.tanggal));
      });

      var cap = JSON.stringify({
        d: idx.diperbarui || "",
        i: semuaBaru.map(function (x) {
          return [x.slug, x.tanggal, x.status, x.judul, x.kategori, x.unggulan ? 1 : 0].join("|");
        })
      });

      if (!pertama && cap === state.cap) return;
      var jumlahLama = state.semua.length;
      state.semua = semuaBaru;
      state.cap = cap;
      susunPil(idx.kategori || []);
      renderUlang(!pertama);
      tandaiLive();

      if (!pertama) {
        if (semuaBaru.length > jumlahLama) U.toast("Berita baru telah terbit.", "sukses", 4200);
        else U.toast("Daftar berita diperbarui otomatis.", "info", 3600);
      }
    }

    function muat(pertama) {
      var opsi = REALTIME ? { segar: true } : {};
      return D.json("berita/index.json", opsi).then(function (idx) {
        terapkan(idx, pertama);
      }).catch(function () {
        if (pertama) {
          induk.innerHTML = '<div class="kosong"><h3>Gagal memuat berita</h3><p>Periksa koneksi atau berkas <code>data/berita/index.json</code>.</p></div>';
        }
      });
    }

    if (inputCari) {
      var jeda;
      inputCari.addEventListener("input", function () {
        clearTimeout(jeda);
        jeda = setTimeout(function () {
          state.cari = inputCari.value.trim();
          renderUlang(false);
        }, 220);
      });
    }

    if (tombolLagi) {
      tombolLagi.addEventListener("click", function () {
        var hasil = hasilSaring();
        state.tampil += PER_HALAMAN;
        tambahKartu(Math.max(0, state.tampil - 1));
        perbaruiTombol(hasil.length);
      });
    }

    muat(true);

    if (REALTIME) {
      var jam = setInterval(function () {
        if (!document.hidden) muat(false);
      }, LIVE_MS);
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) muat(false);
      });
      window.addEventListener("pagehide", function () { clearInterval(jam); });
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

    var capTerakhir = "";

    function ambilIndex() {
      return D.json("berita/index.json", REALTIME ? { segar: true } : {});
    }

    function muat(pertama) {
      return ambilIndex().then(function (idx) {
        var entri = (idx.item || []).filter(function (x) { return x.slug === slug; })[0];
        if (!entri) throw new Error("Artikel tidak ditemukan pada indeks berita.");
        if (entri.status === "draf") throw new Error("Artikel ini masih berupa draf dan belum diterbitkan.");

        var peta = {};
        (idx.kategori || []).forEach(function (k) { peta[k.id] = k; });
        var kat = peta[entri.kategori] || { nama: entri.kategori || "Umum", warna: "#0d3b8c" };

        return D.json("berita/" + entri.berkas, REALTIME ? { segar: true } : {}).then(function (a) {
          var cap = JSON.stringify(a);
          if (!pertama && cap === capTerakhir) return;
          capTerakhir = cap;
          gambar(a, kat, idx, !pertama);
        });
      }).catch(function (e) {
        if (pertama) gagal(e.message);
      });
    }

    function gambar(a, kat, idx, perbarui) {
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
          "" + "</div>" +
        '<span class="tag" style="background:' + U.aman(kat.warna) + '1a;color:' + U.aman(kat.warna) + '">' + U.aman(kat.nama) + "</span>" +
        '<h1 class="artikel-judul">' + U.aman(a.judul) + "</h1>" +
        '<div class="artikel-meta">' +
          '<span class="penulis">' + U.aman(a.penulis || "Humas FAST") + "</span>" +
          "<span>" + U.tanggal(a.tanggal, "hari") + "</span>" +
          "<span>" + Math.max(1, Math.round(MD.polos(a.isi).split(/\s+/).length / 200)) + " menit baca</span>" +
          (REALTIME ? '<span class="live-pil"><i></i>Realtime</span>' : "") +
        "</div>" +
        '<div class="artikel-isi">' + MD.render(a.isi) + "</div>" +
        (tagar ? '<div class="fleks mt-3" style="gap:8px">' + tagar + "</div>" : "") +
        '<div class="berbagi">' +
          "<span>Bagikan:</span>" +
          '<a class="btn btn-garis btn-kecil" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(a.judul + " " + location.href) + '">WhatsApp</a>' +
          '<a class="btn btn-garis btn-kecil" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(location.href) + '">Facebook</a>' +
          '<button class="btn btn-garis btn-kecil" id="salinTautan" type="button">Salin Tautan</button>' +
        "</div>";

      var salin = document.getElementById("salinTautan");
      if (salin) salin.addEventListener("click", function () {
        navigator.clipboard.writeText(location.href).then(function () {
          U.toast("Tautan artikel disalin.", "sukses");
        }).catch(function () { U.toast("Tidak dapat menyalin tautan.", "galat"); });
      });

      var samping = document.getElementById("beritaSamping");
      if (samping) {
        var lain = (idx.item || []).filter(function (x) { return x.slug !== slug && x.status !== "draf"; }).slice(0, 5);
        samping.innerHTML = lain.map(function (b, i) {
          return '<a class="mini-berita" href="artikel.html?slug=' + encodeURIComponent(b.slug) + '">' +
            '<span class="mini-no">' + (i + 1) + "</span>" +
            "<span><strong>" + U.aman(b.judul) + "</strong>" +
            "<small>" + U.tanggal(b.tanggal, "pendek") + "</small></span></a>";
        }).join("");
      }

      if (perbarui) U.toast("Artikel diperbarui otomatis.", "info", 3600);
    }

    muat(true);

    if (REALTIME) {
      var jam = setInterval(function () {
        if (!document.hidden) muat(false);
      }, LIVE_MS);
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) muat(false);
      });
      window.addEventListener("pagehide", function () { clearInterval(jam); });
    }
    return true;

    function gagal(pesan) {
      induk.innerHTML =
        '<div class="kosong"><h3>Artikel tidak dapat ditampilkan</h3>' +
        "<p>" + U.aman(pesan) + "</p>" +
        '<a href="/berita/" class="btn btn-utama mt-2">Kembali ke daftar berita</a></div>';
    }
  }

  if (!modeArtikel()) modeDaftar();
})();
