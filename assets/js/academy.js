/* =========================================================
   Faster Academy — daftar & detail kelas (academy.js)
   ========================================================= */
(function () {
  "use strict";

  var D = window.FAST.data;
  var U = window.FAST.ui;
  var CFG = window.FAST_CONFIG;
  var el = U.el;

  function kartuKelas(c, peta) {
    var penuh = c.status === "penuh" || (c.terdaftar >= c.kuota);
    var selesai = c.status === "selesai";
    var kat = peta[c.kategori] || { nama: c.kategori || "Umum" };
    var kartu = el("div", { class: "kelas-kartu" });
    kartu.innerHTML =
      '<div class="kelas-atas">' +
        '<span class="tag">' + U.aman(kat.nama) + "</span>" +
        '<span class="tag ' + (selesai ? "tag-abu" : penuh ? "tag-merah" : "tag-hijau") + '">' +
          (selesai ? "Selesai" : penuh ? "Kuota Penuh" : "Terbuka") + "</span>" +
      "</div>" +
      "<h3>" + U.aman(c.judul) + "</h3>" +
      '<p style="color:var(--teks-redup);font-size:.9rem">' + U.aman(c.ringkasan || "") + "</p>" +
      '<div class="kelas-rinci">' +
        "<span>" + U.aman(c.durasi || "-") + "</span>" +
        "<span>" + U.aman(c.mode || "-") + "</span>" +
        "<span>" + U.tanggal(c.mulai, "pendek") + "</span>" +
        "<span>" + Math.max(0, (c.kuota || 0) - (c.terdaftar || 0)) + " sisa kuota</span>" +
      "</div>" +
      '<div class="kelas-kaki">' +
        '<span class="kelas-biaya">' + U.aman(c.biayaTampil || "Gratis") + "</span>" +
        '<a class="btn btn-hijau btn-kecil" href="/academy/kelas.html?slug=' + encodeURIComponent(c.slug) + '">Detail Kelas</a>' +
      "</div>";
    return kartu;
  }

  /* =========================================================
     Mode daftar
     ========================================================= */
  function modeDaftar() {
    var host = document.getElementById("daftarKelas");
    if (!host) return false;

    var state = { semua: [], kategori: "semua", cari: "" };
    var kotakKategori = document.getElementById("filterKategori");
    var inputCari = document.getElementById("cari");

    D.json("academy/index.json").then(function (idx) {
      var peta = {};
      (idx.kategori || []).forEach(function (k) { peta[k.id] = k; });
      state.semua = (idx.item || []).slice();
      state.semua.sort(function (a, b) {
        var sa = a.status === "selesai" ? 1 : 0;
        var sb = b.status === "selesai" ? 1 : 0;
        if (sa !== sb) return sa - sb;
        return String(a.mulai).localeCompare(String(b.mulai));
      });

      if (kotakKategori) {
        kotakKategori.innerHTML = "";
        var semua = el("button", { class: "aktif", type: "button" }, "Semua");
        semua.addEventListener("click", function () { pilih("semua", semua); });
        kotakKategori.appendChild(semua);
        (idx.kategori || []).forEach(function (k) {
          var b = el("button", { type: "button" }, k.nama);
          b.addEventListener("click", function () { pilih(k.id, b); });
          kotakKategori.appendChild(b);
        });
      }

      gambar(peta);

      function pilih(id, tombol) {
        state.kategori = id;
        if (kotakKategori) {
          Array.prototype.forEach.call(kotakKategori.querySelectorAll("button"), function (b) {
            b.classList.remove("aktif");
          });
          tombol.classList.add("aktif");
        }
        gambar(peta);
      }

      function cocok(c) {
        if (state.kategori !== "semua" && c.kategori !== state.kategori) return false;
        if (!state.cari) return true;
        var q = state.cari.toLowerCase();
        return [c.judul, c.ringkasan, c.pengajar, (c.manfaat || []).join(" "), (c.silabus || []).join(" ")]
          .join(" ").toLowerCase().indexOf(q) >= 0;
      }

      function gambar(peta) {
        var hasil = state.semua.filter(cocok);
        if (!hasil.length) {
          host.innerHTML = '<div class="kosong" style="grid-column:1/-1"><h3>Tidak ada kelas ditemukan</h3><p>Coba kata kunci atau kategori lain.</p></div>';
          return;
        }
        host.innerHTML = "";
        hasil.forEach(function (c) { host.appendChild(kartuKelas(c, peta)); });
      }

      if (inputCari) {
        var jeda;
        inputCari.addEventListener("input", function () {
          clearTimeout(jeda);
          jeda = setTimeout(function () {
            state.cari = inputCari.value.trim();
            gambar(peta);
          }, 200);
        });
      }
    }).catch(function () {
      host.innerHTML = '<div class="kosong" style="grid-column:1/-1"><h3>Gagal memuat kelas</h3><p>Periksa koneksi atau berkas data academy.</p></div>';
    });

    return true;
  }

  /* =========================================================
     Mode detail
     ========================================================= */
  function modeDetail() {
    var host = document.getElementById("kelasDetail");
    if (!host) return false;

    var slug = new URLSearchParams(location.search).get("slug");
    if (!slug) { gagal("Slug kelas tidak diberikan pada URL."); return true; }

    D.json("academy/index.json").then(function (idx) {
      var c = (idx.item || []).filter(function (x) { return x.slug === slug; })[0];
      if (!c) throw new Error("Kelas tidak ditemukan pada katalog.");

      var peta = {};
      (idx.kategori || []).forEach(function (k) { peta[k.id] = k; });
      var kat = peta[c.kategori] || { nama: c.kategori || "Umum" };
      var penuh = c.status === "penuh" || (c.terdaftar >= c.kuota);
      var selesai = c.status === "selesai";

      document.title = c.judul + " — Faster Academy";
      var jj = document.getElementById("jejakKelas");
      if (jj) jj.textContent = U.singkat(c.judul, 48);
      var desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", c.ringkasan || "");

      var wa = document.getElementById("waKelas");
      if (wa) {
        wa.href = "https://wa.me/" + CFG.org.whatsapp + "?text=" +
          encodeURIComponent("Halo Faster Academy, saya ingin bertanya tentang kelas " + c.judul + ".");
      }

      var manfaat = (c.manfaat || []).map(function (m) { return "<li>" + U.aman(m) + "</li>"; }).join("");
      var silabus = (c.silabus || []).map(function (s) { return "<li>" + U.aman(s) + "</li>"; }).join("");

      host.innerHTML =
        '<span class="tag">' + U.aman(kat.nama) + "</span> " +
        '<span class="tag ' + (selesai ? "tag-abu" : penuh ? "tag-merah" : "tag-hijau") + '">' +
          (selesai ? "Selesai" : penuh ? "Kuota Penuh" : "Terbuka") + "</span>" +
        '<h1 class="kelas-detail-judul">' + U.aman(c.judul) + "</h1>" +
        '<p class="kelas-detail-ringkas">' + U.aman(c.ringkasan || "") + "</p>" +

        '<div class="kelas-info-grid">' +
          info("Level", c.level || "Umum") +
          info("Durasi", c.durasi || "-") +
          info("Mode", c.mode || "-") +
          info("Pengajar", c.pengajar || "-") +
          info("Mulai", U.tanggal(c.mulai) || "-") +
          info("Selesai", U.tanggal(c.selesai) || "-") +
          info("Biaya", c.biayaTampil || "Gratis") +
          info("Kuota", (c.terdaftar || 0) + " / " + (c.kuota || 0) + " peserta") +
        "</div>" +

        '<div class="kelas-detail-isi">' +
          (manfaat ? "<h2>Manfaat yang Didapat</h2><ul>" + manfaat + "</ul>" : "") +
          (silabus ? "<h2>Silabus</h2><ol>" + silabus + "</ol>" : "") +
          (c.sertifikat ? '<p>Peserta yang menyelesaikan kelas akan memperoleh sertifikat.</p>' : "") +
        "</div>" +

        '<div class="kelas-detail-aksi">' +
          (selesai
            ? '<span class="btn btn-garis" aria-disabled="true">Kelas telah selesai</span>'
            : penuh
              ? '<a class="btn btn-garis" href="/academy/">Lihat Kelas Lain</a>'
              : '<a class="btn btn-hijau" href="/academy/">Lihat Kelas Lain</a>') +
          '<a class="btn btn-utama" href="/pmb/">Daftar Kuliah di FAST</a>' +
        "</div>";
    }).catch(function (e) { gagal(e.message); });

    return true;

    function info(label, nilai) {
      return '<div class="kelas-info"><small>' + U.aman(label) + "</small><strong>" + U.aman(nilai) + "</strong></div>";
    }

    function gagal(pesan) {
      host.innerHTML =
        '<div class="kosong"><h3>Kelas tidak dapat ditampilkan</h3>' +
        "<p>" + U.aman(pesan) + "</p>" +
        '<a href="/academy/" class="btn btn-utama mt-2">Kembali ke daftar kelas</a></div>';
    }
  }

  if (!modeDetail()) modeDaftar();

  window.FAST.academy = { kartuKelas: kartuKelas };
})();
