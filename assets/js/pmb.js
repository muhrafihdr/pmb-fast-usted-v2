/* =========================================================
   PMB FAST USTEDI — pmb.js
   ---------------------------------------------------------
   Menampilkan konten PMB dari data/pmb/config.json dan
   menangani formulir pendaftaran (Google Apps Script).
   Juga menangani halaman cek status pendaftaran.
   ========================================================= */
(function () {
  "use strict";

  var D = window.FAST.data;
  var U = window.FAST.ui;
  var CFG = window.FAST_CONFIG;
  var el = U.el;

  function info(label, nilai) {
    return '<div class="sorot-kartu"><strong>' + U.aman(label) + "</strong><span>" + U.aman(nilai) +
      "</span></div>";
  }

  function kartu(ikon, judul, teks) {
    return '<div class="kartu kartu-hover"><div class="kartu-ikon">' + (ikon || "✨") +
      "</div><h3>" + U.aman(judul) + "</h3><p>" + U.aman(teks) + "</p></div>";
  }

  function isiKontak(host) {
    if (!host) return;
    var o = CFG.org;
    host.innerHTML =
      '<a class="kontak-kartu" href="https://wa.me/' + U.aman(o.whatsapp) + '" target="_blank" rel="noopener">' +
        '<div class="kontak-ikon">💬</div><h3>WhatsApp</h3><p>' + U.aman(o.teleponTampil) + "</p><small>Klik untuk chat</small></a>" +
      '<a class="kontak-kartu" href="mailto:' + U.aman(o.email) + '">' +
        '<div class="kontak-ikon">📧</div><h3>Email</h3><p>' + U.aman(o.email) + "</p><small>Kirim email</small></a>" +
      '<div class="kontak-kartu">' +
        '<div class="kontak-ikon">📍</div><h3>Alamat Kampus</h3><p>' + U.aman(o.alamat) + "</p><small>" +
        U.aman(o.jamLayanan || "Senin–Jumat, 08.00–16.00") + "</small></div>";
  }

  /* =========================================================
     Halaman formulir PMB
     ========================================================= */
  function modeFormulir() {
    var form = document.getElementById("pmbForm");
    if (!form) return false;

    var cfgData = null;
    var siteData = null;

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      kirim();
    });

    Promise.all([
      D.json("pmb/config.json").catch(function () { return null; }),
      D.json("site.json").catch(function () { return null; })
    ]).then(function (hasil) {
      cfgData = hasil[0] || {};
      siteData = hasil[1] || {};
      gambar(cfgData, siteData);
      pasangForm(cfgData);
    });

    function gambar(cfg, site) {
      var tahun = cfg.tahunAkademik || "2026/2027";
      var t = document.getElementById("tahunAkademik");
      if (t) t.textContent = tahun;
      var b = document.getElementById("badgeTahunNilai");
      if (b) b.textContent = tahun;

      var sorot = document.getElementById("sorotJadwal");
      if (sorot) {
        sorot.innerHTML = (cfg.jadwal || []).map(function (j) {
          return info(j.label, j.nilai);
        }).join("");
      }

      var keunggulan = document.getElementById("keunggulanGrid");
      if (keunggulan) {
        keunggulan.innerHTML = (site.keunggulan || []).map(function (k) {
          return kartu(k.ikon, k.judul, k.teks);
        }).join("");
      }

      var prodi = document.getElementById("prodiGrid");
      if (prodi) {
        prodi.innerHTML = (cfg.programStudi || []).map(function (p) {
          return kartu(p.ikon, p.nama, "Jenjang " + (p.jenjang || "S1") + " · Fakultas Sains dan Teknologi");
        }).join("");
      }

      var jalur = document.getElementById("jalurGrid");
      if (jalur) {
        jalur.innerHTML = (cfg.jalur || []).map(function (j) {
          return kartu("🎯", j.nama, j.teks);
        }).join("");
      }

      var alur = document.getElementById("alurGrid");
      if (alur) {
        alur.innerHTML = (cfg.langkah || []).map(function (l, i) {
          return '<div class="alur-item"><div class="alur-no">' + U.aman(l.no || (i + 1)) + "</div>" +
            "<h3>" + U.aman(l.judul) + "</h3><p>" + U.aman(l.teks) + "</p></div>";
        }).join("");
      }

      var bcat = document.getElementById("biayaCatatan");
      if (bcat && cfg.biaya && cfg.biaya.catatan) bcat.textContent = cfg.biaya.catatan;
      var bgrid = document.getElementById("biayaGrid");
      if (bgrid && cfg.biaya && cfg.biaya.item) {
        bgrid.innerHTML = cfg.biaya.item.map(function (b) {
          return '<div class="kartu"><h3 style="font-size:.9rem;color:var(--teks-redup);text-transform:uppercase;letter-spacing:.05em">' +
            U.aman(b.label) + "</h3><p style=\"font-size:1.05rem;font-weight:700;color:var(--utama);margin-top:6px\">" +
            U.aman(b.nilai) + "</p></div>";
        }).join("");
      }

      var faq = document.getElementById("faqList");
      if (faq) {
        faq.innerHTML = (cfg.faq || []).map(function (f) {
          return '<details class="faq-item"><summary>' + U.aman(f.t) + "</summary><p>" + U.aman(f.j) + "</p></details>";
        }).join("");
      }

      if (site.org) {
        Object.keys(site.org).forEach(function (k) {
          if (k === "instagram" && site.org.instagram && typeof site.org.instagram === "object") {
            CFG.org.instagram = Object.assign({}, CFG.org.instagram || {}, site.org.instagram);
          } else if (site.org[k] !== undefined && site.org[k] !== null) {
            CFG.org[k] = site.org[k];
          }
        });
      }
      isiKontak(document.getElementById("kontakGrid"));
    }

    function pasangForm(cfg) {
      /* Isi pilihan jalur */
      var jalur = form.querySelector("#jalur") || document.querySelector("select#jalur");
      if (jalur) {
        jalur.innerHTML = '<option value="">— Pilih Jalur —</option>' +
          (cfg.jalur || []).map(function (j) {
            return '<option value="' + U.aman(j.nama) + '">' + U.aman(j.nama) + "</option>";
          }).join("");
      }

      /* Isi pilihan program studi */
      var kotak = document.getElementById("pilihanProdi");
      var hidden = document.getElementById("programStudi");
      if (kotak) {
        kotak.innerHTML = (cfg.programStudi || []).map(function (p, i) {
          return '<div class="prodi-opsi">' +
            '<input type="radio" name="pilihanProdi" id="prodi_' + i + '" value="' + U.aman(p.nama) + '" />' +
            '<label for="prodi_' + i + '"><span class="ikon">' + (p.ikon || "🎓") + "</span>" +
            "<strong>" + U.aman(p.nama) + "</strong><small>Jenjang " + U.aman(p.jenjang || "S1") + "</small></label></div>";
        }).join("");
        Array.prototype.forEach.call(kotak.querySelectorAll('input[type="radio"]'), function (r) {
          r.addEventListener("change", function () {
            if (hidden) hidden.value = r.value;
          });
        });
      }

      /* Tahun lulus */
      var tahun = document.getElementById("tahunLulus");
      if (tahun) {
        var kini = new Date().getFullYear();
        var opts = '<option value="">— Pilih Tahun —</option>';
        for (var y = kini + 1; y >= kini - 15; y--) {
          opts += '<option value="' + y + '">' + y + "</option>";
        }
        tahun.innerHTML = opts;
      }

      /* Tombol daftar lagi */
      var lagi = document.getElementById("btnDaftarLagi");
      if (lagi) {
        lagi.addEventListener("click", function () {
          form.reset();
          if (hidden) hidden.value = "";
          var sukses = document.getElementById("formSukses");
          if (sukses) sukses.hidden = true;
          form.hidden = false;
          bersihkanGalat();
          form.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }

    }

    function bersihkanGalat() {
      Array.prototype.forEach.call(form.querySelectorAll(".form-grup"), function (g) {
        g.classList.remove("salah");
        var e = g.querySelector(".galat");
        if (e) e.textContent = "";
      });
      var gs = document.getElementById("galatSetuju");
      if (gs) gs.textContent = "";
      var fg = document.getElementById("formGalat");
      if (fg) { fg.hidden = true; fg.textContent = ""; }
    }

    function salah(id, pesan) {
      var inp = document.getElementById(id);
      if (!inp) return;
      var grup = inp.closest(".form-grup");
      if (grup) {
        grup.classList.add("salah");
        var e = grup.querySelector(".galat");
        if (e) e.textContent = pesan;
      }
    }

    function nilai(id) {
      var e = document.getElementById(id);
      return e ? String(e.value || "").trim() : "";
    }

    function valid() {
      bersihkanGalat();
      var ok = true;

      if (!nilai("namaLengkap")) { salah("namaLengkap", "Nama lengkap wajib diisi."); ok = false; }
      var nik = nilai("nik");
      if (!/^\d{16}$/.test(nik)) { salah("nik", "NIK harus 16 digit angka."); ok = false; }
      if (!nilai("tempatLahir")) { salah("tempatLahir", "Tempat lahir wajib diisi."); ok = false; }
      if (!nilai("tanggalLahir")) { salah("tanggalLahir", "Tanggal lahir wajib diisi."); ok = false; }
      var jk = form.querySelector('input[name="jenisKelamin"]:checked');
      if (!jk) {
        var grupJk = form.querySelector('input[name="jenisKelamin"]');
        if (grupJk && grupJk.closest(".form-grup")) {
          grupJk.closest(".form-grup").classList.add("salah");
          var eJk = grupJk.closest(".form-grup").querySelector(".galat");
          if (eJk) eJk.textContent = "Pilih jenis kelamin.";
        }
        ok = false;
      }
      var email = nilai("email");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { salah("email", "Format email tidak valid."); ok = false; }
      var hp = nilai("noHp").replace(/[\s-]/g, "");
      if (!/^(0|62)\d{8,13}$/.test(hp)) { salah("noHp", "Nomor HP/WhatsApp tidak valid."); ok = false; }
      if (!nilai("asalSekolah")) { salah("asalSekolah", "Asal sekolah wajib diisi."); ok = false; }
      if (!nilai("jurusanSekolah")) { salah("jurusanSekolah", "Jurusan wajib diisi."); ok = false; }
      if (!nilai("tahunLulus")) { salah("tahunLulus", "Tahun lulus wajib dipilih."); ok = false; }
      if (!nilai("alamat")) { salah("alamat", "Alamat lengkap wajib diisi."); ok = false; }
      if (!nilai("provinsi")) { salah("provinsi", "Provinsi wajib diisi."); ok = false; }
      if (!nilai("kabupaten")) { salah("kabupaten", "Kota/kabupaten wajib diisi."); ok = false; }
      if (!nilai("kecamatan")) { salah("kecamatan", "Kecamatan wajib diisi."); ok = false; }
      if (!nilai("kelurahan")) { salah("kelurahan", "Kelurahan/desa wajib diisi."); ok = false; }
      if (!nilai("jalur")) { salah("jalur", "Jalur pendaftaran wajib dipilih."); ok = false; }
      if (!nilai("programStudi")) {
        var kotak = document.getElementById("pilihanProdi");
        var eProdi = kotak ? kotak.parentElement.querySelector(".galat") : null;
        if (eProdi) eProdi.textContent = "Pilih program studi.";
        ok = false;
      }
      var setuju = document.getElementById("setuju");
      if (!setuju || !setuju.checked) {
        var gs = document.getElementById("galatSetuju");
        if (gs) gs.textContent = "Centang pernyataan persetujuan sebelum mengirim.";
        ok = false;
      }
      return ok;
    }

    function kirim() {
      if (!valid()) {
        var fg = document.getElementById("formGalat");
        if (fg) { fg.hidden = false; fg.textContent = "Periksa kembali data yang ditandai merah."; }
        var pertama = form.querySelector(".form-grup.salah input, .form-grup.salah select, .form-grup.salah textarea");
        if (pertama) pertama.focus();
        return;
      }

      var url = CFG.gas && CFG.gas.webAppUrl;
      if (!url) {
        var fg = document.getElementById("formGalat");
        if (fg) { fg.hidden = false; fg.textContent = "Layanan pendaftaran belum dikonfigurasi. Hubungi panitia PMB."; }
        return;
      }

      var data = {
        namaLengkap: nilai("namaLengkap"),
        nik: nilai("nik"),
        tempatLahir: nilai("tempatLahir"),
        tanggalLahir: nilai("tanggalLahir"),
        jenisKelamin: (form.querySelector('input[name="jenisKelamin"]:checked') || {}).value || "",
        email: nilai("email"),
        noHp: nilai("noHp"),
        alamat: nilai("alamat"),
        provinsi: nilai("provinsi"),
        kabupaten: nilai("kabupaten"),
        kecamatan: nilai("kecamatan"),
        kelurahan: nilai("kelurahan"),
        kodePos: nilai("kodePos"),
        asalSekolah: nilai("asalSekolah"),
        jurusanSekolah: nilai("jurusanSekolah"),
        tahunLulus: nilai("tahunLulus"),
        jalur: nilai("jalur"),
        programStudi: nilai("programStudi")
      };

      var btn = document.getElementById("btnKirim");
      var teks = btn ? btn.querySelector(".teks-btn") : null;
      var spinner = document.getElementById("pemuatKirim");
      if (btn) btn.disabled = true;
      if (teks) teks.textContent = "Mengirim…";
      if (spinner) spinner.hidden = false;

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(data)
      }).then(function (r) {
        return r.text().then(function (t) {
          var hasil = null;
          try { hasil = JSON.parse(t); } catch (e) { /* bukan JSON */ }
          if (!r.ok) throw new Error("Server merespons HTTP " + r.status);
          if (hasil && hasil.status === "error") throw new Error(hasil.message || "Pendaftaran gagal.");
          return hasil;
        });
      }).then(function () {
        var sukses = document.getElementById("formSukses");
        var pesan = document.getElementById("pesanSukses");
        if (pesan) {
          pesan.textContent = "Terima kasih, " + data.namaLengkap +
            ". Data pendaftaranmu telah kami terima. Panitia PMB akan menghubungi kamu melalui email atau WhatsApp.";
        }
        if (sukses) sukses.hidden = false;
        form.hidden = true;
        U.toast("Pendaftaran berhasil dikirim.", "sukses", 5200);
        if (sukses) sukses.scrollIntoView({ behavior: "smooth", block: "center" });
      }).catch(function (e) {
        var fg = document.getElementById("formGalat");
        if (fg) {
          fg.hidden = false;
          fg.textContent = "Pendaftaran gagal dikirim: " + (e.message || "periksa koneksi") +
            ". Silakan coba lagi atau hubungi panitia PMB melalui WhatsApp.";
        }
        U.toast("Gagal mengirim pendaftaran.", "galat", 5200);
      }).then(function () {
        if (btn) btn.disabled = false;
        if (teks) teks.textContent = "Kirim Pendaftaran";
        if (spinner) spinner.hidden = true;
      });
    }

    return true;
  }

  /* =========================================================
     Halaman cek status
     ========================================================= */
  function modeStatus() {
    var form = document.getElementById("statusForm");
    if (!form) return false;

    var hasil = document.getElementById("statusHasil");
    var pesan = document.getElementById("statusPesan");

    function tampilPesan(teks, jenis) {
      if (!pesan) return;
      pesan.hidden = !teks;
      pesan.className = "peringatan peringatan-" + (jenis || "info");
      pesan.textContent = teks || "";
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var nik = (document.getElementById("statusNik") || {}).value || "";
      var email = (document.getElementById("statusEmail") || {}).value || "";
      nik = nik.trim();
      email = email.trim().toLowerCase();
      if (!nik || !email) { tampilPesan("Isi NIK dan email yang dipakai saat mendaftar.", "galat"); return; }

      var url = CFG.gas && CFG.gas.webAppUrl;
      if (!url) { tampilPesan("Layanan status belum dikonfigurasi.", "galat"); return; }

      if (hasil) hasil.innerHTML = '<div class="pemuat"><span class="pemuat-lingkar"></span><span>Mencari data…</span></div>';
      tampilPesan("");
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;

      fetch(url + "?action=getAll", { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (!res || !res.rows) throw new Error("Data pendaftar tidak dapat dibaca.");
          var ketemu = res.rows.filter(function (row) {
            var n = String(row["NIK"] || row["Nik"] || "").trim();
            var e = String(row["Email"] || row["email"] || "").trim().toLowerCase();
            return n === nik && e === email;
          });
          if (!ketemu.length) {
            if (hasil) hasil.innerHTML = "";
            tampilPesan("Data pendaftaran tidak ditemukan. Periksa kembali NIK dan email, atau hubungi panitia PMB.", "kuning");
            return;
          }
          var d = ketemu[ketemu.length - 1];
          var nama = d["Nama Lengkap"] || d["Nama"] || "-";
          var prodi = d["Program Studi"] || d["Prodi"] || "-";
          var jalur = d["Jalur Pendaftaran"] || d["Jalur"] || "-";
          var waktu = d["Timestamp"] || "-";
          if (hasil) {
            hasil.innerHTML =
              '<div class="kartu" style="max-width:680px;margin:0 auto">' +
                "<h3 style=\"margin-bottom:6px\">" + U.aman(nama) + "</h3>" +
                '<p style="color:var(--teks-redup);font-size:.88rem;margin-bottom:18px">Pendaftaran tercatat pada ' + U.aman(waktu) + "</p>" +
                '<div class="grid grid-2" style="gap:12px">' +
                  '<div class="sorot-kartu"><strong>Program Studi</strong><span>' + U.aman(prodi) + "</span></div>" +
                  '<div class="sorot-kartu"><strong>Jalur Pendaftaran</strong><span>' + U.aman(jalur) + "</span></div>" +
                "</div>" +
                '<div class="lini-masa">' +
                  '<div class="lini-item selesai"><div class="lini-titik">✓</div><div><strong>Pendaftaran diterima</strong><small>Data berhasil masuk ke sistem PMB.</small></div></div>' +
                  '<div class="lini-item aktif"><div class="lini-titik">2</div><div><strong>Verifikasi data</strong><small>Panitia memeriksa kelengkapan data (1–3 hari kerja).</small></div></div>' +
                  '<div class="lini-item"><div class="lini-titik">3</div><div><strong>Seleksi</strong><small>Ikuti proses seleksi sesuai jalur pendaftaran.</small></div></div>' +
                  '<div class="lini-item"><div class="lini-titik">4</div><div><strong>Daftar ulang</strong><small>Lakukan daftar ulang setelah dinyatakan lulus.</small></div></div>' +
                "</div>" +
                '<p style="font-size:.82rem;color:var(--teks-redup);margin-top:18px">Butuh bantuan? Hubungi panitia PMB melalui WhatsApp ' + U.aman(CFG.org.teleponTampil) + ".</p>" +
              "</div>";
          }
        })
        .catch(function (e) {
          if (hasil) hasil.innerHTML = "";
          tampilPesan("Gagal mengambil data status: " + (e.message || "periksa koneksi") + ". Coba lagi beberapa saat.", "galat");
        })
        .then(function () { if (btn) btn.disabled = false; });
    });

    return true;
  }

  if (!modeFormulir()) modeStatus();

  window.FAST.pmb = { versi: "20260217" };
})();
