/* =========================================================
   Portal FAST USTEDI — logika halaman depan (portal.js)
   Membaca data/site.json, data/berita, data/academy.
   ========================================================= */
(function () {
  "use strict";

  var D = window.FAST.data;
  var U = window.FAST.ui;
  var CFG = window.FAST_CONFIG;
  var el = U.el;

  function kartuLayanan() {
    var host = document.getElementById("kartuLayanan");
    if (!host) return;
    host.innerHTML = "";
    CFG.layanan.forEach(function (l) {
      var k = el("a", { href: l.url, class: "kartu-layanan", style: "--warna:" + l.warna });
      k.innerHTML =
        '<div class="kl-ikon">' + l.ikon + "</div>" +
        "<h3>" + U.aman(l.nama) + "</h3>" +
        "<p>" + U.aman(l.tagline) + "</p>" +
        '<span class="kl-tautan">Buka ' + U.aman(l.nama) + " →</span>";
      host.appendChild(k);
    });
  }

  function pengumuman(site) {
    var arr = (site && site.pengumuman || []).filter(function (p) { return p.aktif !== false; });
    if (!arr.length) return;
    var p = arr[0];
    var bar = document.getElementById("pengumuman");
    var teks = document.getElementById("pengumumanTeks");
    var tautan = document.getElementById("pengumumanTautan");
    if (!bar || !teks) return;
    teks.textContent = p.teks;
    if (p.tautan) {
      tautan.href = p.tautan;
      tautan.textContent = p.label || "Selengkapnya";
    } else {
      tautan.hidden = true;
    }
    bar.hidden = false;
  }

  function statistik(site) {
    var host = document.getElementById("statistikGrid");
    if (!host || !site || !site.statistik) return;
    host.innerHTML = "";
    site.statistik.forEach(function (s) {
      var d = el("div", { class: "stat-kartu" });
      d.innerHTML =
        '<div class="stat-ikon">' + (s.ikon || "•") + "</div>" +
        '<div class="stat-nilai">' + U.aman(s.nilai) + "</div>" +
        '<div class="stat-label">' + U.aman(s.label) + "</div>";
      host.appendChild(d);
    });
  }

  function keunggulan(site) {
    var host = document.getElementById("keunggulanGrid");
    if (!host || !site || !site.keunggulan) return;
    host.innerHTML = "";
    site.keunggulan.forEach(function (k) {
      var d = el("div", { class: "kartu kartu-hover" });
      d.innerHTML =
        '<div class="kartu-ikon">' + (k.ikon || "✨") + "</div>" +
        "<h3>" + U.aman(k.judul) + "</h3>" +
        "<p>" + U.aman(k.teks) + "</p>";
      host.appendChild(d);
    });
  }

  function prodi(site) {
    var host = document.getElementById("prodiGrid");
    if (!host || !site || !site.programStudi) return;
    host.innerHTML = "";
    site.programStudi.forEach(function (p) {
      var d = el("div", { class: "kartu kartu-hover" });
      d.innerHTML =
        '<div class="kartu-ikon">' + (p.ikon || "🎓") + "</div>" +
        "<h3>" + U.aman(p.nama) + "</h3>" +
        "<p>" + U.aman(p.teks) + "</p>" +
        (p.instagram
          ? '<p style="margin-top:12px"><a href="' + U.aman(p.instagram) + '" target="_blank" rel="noopener" style="color:var(--utama);font-weight:600">Instagram prodi →</a></p>'
          : "");
      host.appendChild(d);
    });
  }

  function kontak() {
    var host = document.getElementById("kontakGrid");
    if (!host) return;
    var o = CFG.org;
    host.innerHTML =
      '<a class="kontak-kartu" href="https://wa.me/' + U.aman(o.whatsapp) + '" target="_blank" rel="noopener">' +
        '<div class="kontak-ikon">💬</div><h3>WhatsApp</h3><p>' + U.aman(o.teleponTampil) + "</p><small>Klik untuk chat</small></a>" +
      '<a class="kontak-kartu" href="mailto:' + U.aman(o.email) + '">' +
        '<div class="kontak-ikon">📧</div><h3>Email</h3><p>' + U.aman(o.email) + "</p><small>Klik untuk kirim email</small></a>" +
      '<div class="kontak-kartu">' +
        '<div class="kontak-ikon">📍</div><h3>Alamat Kampus</h3><p>' + U.aman(o.alamat) + "</p><small>Senin–Jumat, 08.00–16.00</small></div>";
  }

  function terapkanMeta(site) {
    if (!site || !site.meta) return;
    if (site.meta.title) document.title = site.meta.title;
    if (site.meta.description) {
      var m = document.querySelector('meta[name="description"]');
      if (m) m.setAttribute("content", site.meta.description);
    }
  }

  function hero(site) {
    var h = site && site.hero;
    if (!h) return;
    var label = document.getElementById("heroLabel");
    var judul = document.getElementById("heroJudul");
    var sub = document.getElementById("heroSub");
    var aksi = document.getElementById("heroAksi");
    var sso = document.getElementById("heroSso");

    if (label && h.label) label.textContent = h.label;
    if (judul && h.judul) {
      judul.innerHTML = U.aman(h.judul) + (h.sorot ? ' <span>' + U.aman(h.sorot) + "</span>" : "");
    }
    if (sub && h.sub) sub.textContent = h.sub;
    if (aksi && Array.isArray(h.cta) && h.cta.length) {
      aksi.innerHTML = "";
      h.cta.forEach(function (c) {
        var a = el("a", {
          href: c.href || "#",
          class: "btn " + (c.gaya || "btn-aksen") + " btn-besar"
        }, U.aman(c.label || "Selengkapnya"));
        aksi.appendChild(a);
      });
    }
    if (sso && h.ssoTeks) {
      sso.innerHTML = '🔐 <a href="#masuk">Masuk dengan SSO</a> ' + U.aman(h.ssoTeks);
    }
  }

  function blogTerbaru() {
    var host = document.getElementById("blogGrid");
    if (!host) return;
    return D.json("blog/index.json").then(function (idx) {
      var item = (idx && idx.item || []).filter(function (b) { return b.status !== "draf"; });
      item.sort(function (a, b) { return String(b.tanggal).localeCompare(String(a.tanggal)); });
      var tampil = item.slice(0, 3);
      if (!tampil.length) {
        host.innerHTML = '<div class="kosong"><div class="kosong-ikon">✍️</div><h3>Belum ada artikel</h3><p>Nantikan tulisan terbaru dari sivitas akademika FAST.</p></div>';
        return;
      }
      var peta = {};
      (idx.kategori || []).forEach(function (k) { peta[k.id] = k; });

      host.innerHTML = "";
      tampil.forEach(function (b) {
        var kat = peta[b.kategori] || { nama: b.kategori || "Umum", warna: "#0891b2" };
        var kartu = el("a", { href: "/blog/artikel.html?slug=" + encodeURIComponent(b.slug), class: "berita-kartu" });
        kartu.innerHTML =
          '<div class="berita-sampul"' + (b.gambar ? ' style="background:url(' + U.aman(b.gambar) + ') center/cover"' : "") + ">" +
            (b.gambar ? "" : "✍️") +
          "</div>" +
          '<div class="berita-isi">' +
            '<div class="berita-meta">' +
              '<span class="tag" style="background:' + U.aman(kat.warna) + '1a;color:' + U.aman(kat.warna) + '">' + U.aman(kat.nama) + "</span>" +
              "<span>📅 " + U.tanggal(b.tanggal, "pendek") + "</span>" +
            "</div>" +
            "<h3>" + U.aman(b.judul) + "</h3>" +
            '<p class="berita-ringkas">' + U.aman(b.ringkasan || "") + "</p>" +
            '<div class="berita-meta" style="margin-top:12px"><span>✍️ ' + U.aman(b.penulis || "Humas FAST") + "</span></div>" +
          "</div>";
        host.appendChild(kartu);
      });
    }).catch(function () {
      host.innerHTML = '<div class="kosong"><div class="kosong-ikon">⚠️</div><h3>Gagal memuat artikel</h3><p>Periksa koneksi atau berkas data.</p></div>';
    });
  }

  function beritaTerbaru() {
    var host = document.getElementById("beritaGrid");
    if (!host) return;
    return D.json("berita/index.json").then(function (idx) {
      var item = (idx && idx.item || []).filter(function (b) { return b.status !== "draf"; });
      item.sort(function (a, b) { return String(b.tanggal).localeCompare(String(a.tanggal)); });
      var unggulan = item.filter(function (x) { return x.unggulan; });
      var tampil = (unggulan.length ? unggulan : item).slice(0, 3);
      if (!tampil.length) {
        host.innerHTML = '<div class="kosong"><div class="kosong-ikon">📰</div><h3>Belum ada berita</h3><p>Nantikan kabar terbaru dari fakultas.</p></div>';
        return;
      }
      var petaKategori = {};
      (idx.kategori || []).forEach(function (k) { petaKategori[k.id] = k; });

      host.innerHTML = "";
      tampil.forEach(function (b) {
        var kat = petaKategori[b.kategori] || { nama: b.kategori || "Umum", warna: "#0d3b8c" };
        var kartu = el("a", { href: "/berita/artikel.html?slug=" + encodeURIComponent(b.slug), class: "berita-kartu" });
        kartu.innerHTML =
          '<div class="berita-sampul"' + (b.gambar ? ' style="background:url(' + U.aman(b.gambar) + ') center/cover"' : "") + ">" +
            (b.gambar ? "" : "📰") +
          "</div>" +
          '<div class="berita-isi">' +
            '<div class="berita-meta">' +
              '<span class="tag" style="background:' + U.aman(kat.warna) + '1a;color:' + U.aman(kat.warna) + '">' + U.aman(kat.nama) + "</span>" +
              "<span>📅 " + U.tanggal(b.tanggal, "pendek") + "</span>" +
            "</div>" +
            "<h3>" + U.aman(b.judul) + "</h3>" +
            '<p class="berita-ringkas">' + U.aman(b.ringkasan || "") + "</p>" +
          "</div>";
        host.appendChild(kartu);
      });
    }).catch(function () {
      host.innerHTML = '<div class="kosong"><div class="kosong-ikon">⚠️</div><h3>Gagal memuat berita</h3><p>Periksa koneksi atau berkas data.</p></div>';
    });
  }

  function kelasTerdekat() {
    var host = document.getElementById("kelasGrid");
    if (!host) return;
    return D.json("academy/index.json").then(function (idx) {
      var item = (idx && idx.item || []).filter(function (c) { return c.status !== "selesai"; });
      item.sort(function (a, b) { return String(a.mulai).localeCompare(String(b.mulai)); });
      var unggulan = item.filter(function (c) { return c.unggulan; });
      var tampil = (unggulan.length ? unggulan : item).slice(0, 3);
      if (!tampil.length) {
        host.innerHTML = '<div class="kosong"><div class="kosong-ikon">🧠</div><h3>Belum ada kelas</h3><p>Jadwal pelatihan akan segera diumumkan.</p></div>';
        return;
      }
      host.innerHTML = "";
      tampil.forEach(function (c) {
        host.appendChild(kartuKelas(c));
      });
    }).catch(function () {
      host.innerHTML = '<div class="kosong"><div class="kosong-ikon">⚠️</div><h3>Gagal memuat kelas</h3></div>';
    });
  }

  /* Kartu kelas dipakai portal & halaman academy. */
  function kartuKelas(c) {
    var penuh = c.status === "penuh" || (c.terdaftar >= c.kuota);
    var kartu = el("div", { class: "kelas-kartu" });
    kartu.innerHTML =
      '<div class="kelas-atas">' +
        '<span class="tag">' + U.aman(c.level || "Umum") + "</span>" +
        '<span class="tag ' + (penuh ? "tag-merah" : "tag-hijau") + '">' + (penuh ? "Kuota Penuh" : "Terbuka") + "</span>" +
      "</div>" +
      "<h3>" + U.aman(c.judul) + "</h3>" +
      '<p style="color:var(--teks-redup);font-size:.9rem">' + U.aman(c.ringkasan || "") + "</p>" +
      '<div class="kelas-rinci">' +
        "<span>🕒 " + U.aman(c.durasi || "-") + "</span>" +
        "<span>📍 " + U.aman(c.mode || "-") + "</span>" +
        "<span>📅 " + U.tanggal(c.mulai, "pendek") + "</span>" +
        "<span>👥 " + (c.kuota - (c.terdaftar || 0)) + " sisa kuota</span>" +
      "</div>" +
      '<div class="kelas-kaki">' +
        '<span class="kelas-biaya">' + U.aman(c.biayaTampil || "Gratis") + "</span>" +
        '<a class="btn btn-hijau btn-kecil" href="/academy/kelas.html?slug=' + encodeURIComponent(c.slug) + '">Detail Kelas</a>' +
      "</div>";
    return kartu;
  }

  /* ---- Jalankan ---- */
  kartuLayanan();
  kontak();
  beritaTerbaru();
  blogTerbaru();
  kelasTerdekat();

  D.json("site.json").then(function (site) {
    if (site && site.org) {
      Object.keys(site.org).forEach(function (k) {
        if (k === "instagram" && site.org.instagram && typeof site.org.instagram === "object") {
          CFG.org.instagram = Object.assign({}, CFG.org.instagram || {}, site.org.instagram);
        } else if (site.org[k] !== undefined && site.org[k] !== null) {
          CFG.org[k] = site.org[k];
        }
      });
      kontak();
    }
    terapkanMeta(site);
    hero(site);
    pengumuman(site);
    statistik(site);
    keunggulan(site);
    prodi(site);
  }).catch(function () { /* portal tetap tampil walau data situs gagal */ });

  window.FAST.portal = { kartuKelas: kartuKelas };
})();
