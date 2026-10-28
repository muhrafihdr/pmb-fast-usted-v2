/* =========================================================
   FAST USTEDI — Lapisan Data (data.js)
   ---------------------------------------------------------
   Membaca SELURUH konten publik dari repositori GitHub
   (https://github.com/muhrafihdr/pmb-fast-usted-v2) pada
   folder `data/`. Semua data berbentuk JSON.

   Strategi pengambilan (fallback berlapis):
     1. Salinan lokal same-origin  → /data/...   (cepat, bebas CORS)
     2. raw.githubusercontent.com  → selalu segar dari GitHub
     3. Cache memori + sessionStorage → hemat permintaan

   API publik (window.FAST.data):
     json(path, opsi)      -> Promise<objek>
     daftar(folder)        -> Promise<array>  (pakai index.json)
     simpan(path,objek,opsi)-> Promise        (butuh SSO GitHub)
     tulisFile(path,teks)  -> Promise
     hapus(path,opsi)      -> Promise
     segarkan(path)        -> buang cache
   ========================================================= */
(function () {
  "use strict";

  var CFG = window.FAST_CONFIG;
  var cache = {};
  var memori = {};

  function kunci(path) {
    return (CFG.data.dataDir || "data") + "/" + String(path).replace(/^\/+/, "");
  }

  function ambilTeks(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " — " + url);
      return r.text();
    });
  }

  /* Urutan URL yang dicoba untuk sebuah berkas data. */
  function urls(path, opsi) {
    opsi = opsi || {};
    var daftar = [];
    var rel = String(path).replace(/^\/+/, "");
    if (CFG.data.preferLocal !== false && !opsi.paksaJauh) {
      daftar.push(CFG.localDataUrl(rel));
    }
    daftar.push(CFG.dataUrl(rel));
    if (CFG.data.preferLocal === false && !opsi.paksaJauh) {
      daftar.push(CFG.localDataUrl(rel));
    }
    return daftar;
  }

  /* Coba berurutan; sukses pertama dipakai. */
  function cobaBerurutan(daftar) {
    var i = 0;
    function lanjut(err) {
      if (i >= daftar.length) throw err || new Error("Semua sumber data gagal.");
      var u = daftar[i++];
      return ambilTeks(u).catch(lanjut);
    }
    return Promise.resolve().then(lanjut);
  }

  function json(path, opsi) {
    opsi = opsi || {};
    var k = kunci(path);

    /* Utamakan versi yang disimpan melalui Panel Admin. */
    if (window.FAST && window.FAST.cms) {
      var simpanan = window.FAST.cms.ambil(path);
      if (simpanan) return Promise.resolve(simpanan);
    }

    if (opsi.cache !== false && memori[k]) return Promise.resolve(memori[k]);

    return cobaBerurutan(urls(path, opsi))
      .then(function (teks) {
        var obj;
        try { obj = JSON.parse(teks); }
        catch (e) { throw new Error("JSON tidak valid pada " + path); }
        memori[k] = obj;
        return obj;
      })
      .catch(function (err) {
        if (opsi.opsional) return opsi.bawaan !== undefined ? opsi.bawaan : null;
        throw err;
      });
  }

  /* Membaca daftar item dari <folder>/index.json.
     Bila index.json tidak ada, coba daftar berkas via GitHub API
     (berguna untuk repositori publik tanpa index). */
  function daftar(folder) {
    var f = String(folder).replace(/^\/+|\/+$/g, "");
    return json(f + "/index.json", { opsional: true, bawaan: null }).then(function (idx) {
      if (idx) return Array.isArray(idx) ? idx : (idx.item || []);
      return daftarViaApi(f).then(function (nama) {
        return Promise.all(nama.map(function (n) {
          return json(f + "/" + n, { opsional: true });
        })).then(function (isi) {
          return isi.filter(Boolean);
        });
      });
    });
  }

  /* Daftar berkas pada folder data memakai GitHub Contents API
     (hanya untuk repositori publik). */
  function daftarViaApi(folder) {
    var d = CFG.data;
    var url = "https://api.github.com/repos/" + d.owner + "/" + d.repo +
      "/contents/" + (d.dataDir ? d.dataDir + "/" : "") + folder +
      "?ref=" + encodeURIComponent(d.branch);
    return fetch(url, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (arr) {
        if (!Array.isArray(arr)) return [];
        return arr
          .filter(function (x) { return x.type === "file" && /\.json$/i.test(x.name); })
          .map(function (x) { return x.name; })
          .filter(function (n) { return n.toLowerCase() !== "index.json"; });
      })
      .catch(function () { return []; });
  }

  /* ---------------- Penulisan (butuh SSO GitHub) ---------------- */
  var API = "https://api.github.com";

  function tajuk() {
    var t = window.FAST.auth && window.FAST.auth.tokenGitHub();
    if (!t) {
      throw new Error("Menulis ke GitHub memerlukan login dengan akun GitHub berperan admin.");
    }
    return {
      Authorization: "Bearer " + t,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  function jalurApi(rel) {
    var d = CFG.data;
    return API + "/repos/" + d.owner + "/" + d.repo + "/contents/" +
      encodeURIComponent((d.dataDir ? d.dataDir + "/" : "") + String(rel).replace(/^\/+/, "")).replace(/%2F/g, "/");
  }

  /* Ambil metadata berkas (sha diperlukan untuk memperbarui). */
  function meta(rel, opsi) {
    opsi = opsi || {};
    var ref = opsi.branch || CFG.data.branch;
    return fetch(jalurApi(rel) + "?ref=" + encodeURIComponent(ref), { headers: tajuk() })
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("Gagal membaca metadata: HTTP " + r.status);
        return r.json();
      });
  }

  /* Tulis (buat/perbarui) berkas teks. */
  function tulisFile(rel, teks, opsi) {
    opsi = opsi || {};
    var headers = tajuk();
    var cabang = opsi.branch || CFG.data.branch;
    return meta(rel, opsi).then(function (m) {
      var body = {
        message: opsi.pesan || ("perbarui " + rel + " via panel FAST"),
        content: utf8Base64(teks),
        branch: cabang
      };
      if (m && m.sha) body.sha = m.sha;
      return fetch(jalurApi(rel), {
        method: "PUT",
        headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify(body)
      });
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error("Gagal menyimpan ke GitHub (" + r.status + "): " + t.slice(0, 200));
        });
      }
      return r.json();
    }).then(function (res) {
      segarkan(rel);
      return res;
    });
  }

  function simpan(rel, objek, opsi) {
    return tulisFile(rel, JSON.stringify(objek, null, 2) + "\n", opsi).then(function (res) {
      memori[kunci(rel)] = objek;
      return objek;
    });
  }

  function hapus(rel, opsi) {
    opsi = opsi || {};
    var headers = tajuk();
    return meta(rel, opsi).then(function (m) {
      if (!m || !m.sha) throw new Error("Berkas " + rel + " tidak ditemukan.");
      return fetch(jalurApi(rel), {
        method: "DELETE",
        headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify({
          message: opsi.pesan || ("hapus " + rel + " via panel FAST"),
          sha: m.sha,
          branch: opsi.branch || CFG.data.branch
        })
      });
    }).then(function (r) {
      if (!r.ok) throw new Error("Gagal menghapus (" + r.status + ")");
      segarkan(rel);
      return true;
    });
  }

  function segarkan(rel) {
    if (rel) { delete memori[kunci(rel)]; return; }
    memori = {};
  }

  /* Base64 yang aman untuk UTF-8. */
  function utf8Base64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  /* Slug ramah URL dari judul. */
  function slug(teks) {
    return String(teks || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "tanpa-judul";
  }

  window.FAST = window.FAST || {};
  window.FAST.data = {
    json: json,
    daftar: daftar,
    simpan: simpan,
    tulisFile: tulisFile,
    hapus: hapus,
    meta: meta,
    segarkan: segarkan,
    slug: slug,
    _cache: memori
  };
})();
