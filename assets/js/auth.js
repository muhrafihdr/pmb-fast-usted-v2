/* =========================================================
   FAST USTEDI — SSO (Single Sign-On) Core  ·  auth.js
   ---------------------------------------------------------
   Menyediakan satu sesi login untuk SELURUH layanan FAST
   (portal, berita, pmb, academy, admin) karena semuanya
   berada pada origin yang sama (fastustedi.web.id).

   Penyedia identitas:
     1. GOOGLE  — Google Identity Services (JWT id_token, client-side)
     2. GITHUB  — OAuth App via Netlify Function (proxy rahasia)
     3. DEMO    — login lokal untuk pengembangan tanpa kredensial

   API publik (window.FAST.auth):
     masuk(provider)        -> buka alur login
     keluar()               -> hapus sesi
     sesi()                 -> objek sesi atau null
     pengguna()             -> alias sesi()
     punyaPeran(...peran)   -> boolean
     boleh(modul)           -> boolean
     jaga({peran,modul,alihkan,diam}) -> Promise<sesi|null>
     onChange(cb)           -> berlangganan perubahan status
     tokenGitHub()          -> access token GitHub (bila ada)
     siapkanTombol(el,opsi) -> render tombol Google resmi
   ========================================================= */
(function () {
  "use strict";

  var CFG = window.FAST_CONFIG;
  var S = CFG.sso;
  var SESI = null;
  var pendengar = [];
  var usersCache = null;

  /* ---------------------------------------------------------
     Utilitas penyimpanan
     --------------------------------------------------------- */
  function bacaSesi() {
    try {
      var raw = localStorage.getItem(S.storageKey);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.exp || Date.now() > s.exp) {
        localStorage.removeItem(S.storageKey);
        return null;
      }
      return s;
    } catch (e) {
      return null;
    }
  }

  function tulisSesi(s) {
    SESI = s;
    try {
      if (s) localStorage.setItem(S.storageKey, JSON.stringify(s));
      else localStorage.removeItem(S.storageKey);
    } catch (e) {
      /* localStorage bisa diblokir (mode privat) — sesi tetap hidup di memori. */
    }
    kabari();
  }

  function kabari() {
    pendengar.forEach(function (cb) {
      try { cb(SESI); } catch (e) { /* abaikan galat pendengar */ }
    });
    try {
      window.dispatchEvent(new CustomEvent("fast:sso", { detail: SESI }));
    } catch (e) { /* browser lama */ }
  }

  function jadikanSesi(inti, provider) {
    var exp = Date.now() + S.sessionMinutes * 60 * 1000;
    return {
      provider: provider || inti.provider || "demo",
      sub: inti.sub || "",
      email: (inti.email || "").toLowerCase(),
      nama: inti.nama || inti.name || "",
      gambar: inti.gambar || inti.picture || "",
      peran: inti.peran || [],
      token: inti.token || "",
      masukPada: Date.now(),
      exp: exp
    };
  }

  /* ---------------------------------------------------------
     Resolusi peran
     Data peran disimpan di GitHub: data/users.json
     Format:
       { "admin@ustedi.ac.id": ["admin","berita"],
         "dosen@ustedi.ac.id": ["berita"] }
     --------------------------------------------------------- */
  function muatPengguna() {
    if (usersCache) return Promise.resolve(usersCache);
    if (!window.FAST || !window.FAST.data) return Promise.resolve({});
    return window.FAST.data
      .json("users.json", { cache: true })
      .then(function (u) { usersCache = u || {}; return usersCache; })
      .catch(function () { usersCache = {}; return usersCache; });
  }

  function domainDiizinkan(email) {
    var d = String(email || "").split("@")[1] || "";
    if (!d) return false;
    return (S.allowedDomains || []).some(function (x) {
      return d.toLowerCase() === String(x).toLowerCase();
    });
  }

  function hitungPeran(email) {
    return muatPengguna().then(function (users) {
      var kunci = String(email || "").toLowerCase();
      var peran = users[kunci] || users[email] || null;
      if (peran) {
        return Array.isArray(peran) ? peran : [peran];
      }
      if (domainDiizinkan(email)) return [S.defaultRole || "viewer"];
      return [];
    });
  }

  /* ---------------------------------------------------------
     Google Identity Services
     --------------------------------------------------------- */
  var googleSiap = null;
  function muatSkripGoogle() {
    if (googleSiap) return googleSiap;
    googleSiap = new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        return resolve(window.google.accounts.id);
      }
      var sc = document.createElement("script");
      sc.src = "https://accounts.google.com/gsi/client";
      sc.async = true;
      sc.defer = true;
      sc.onload = function () {
        if (window.google && window.google.accounts && window.google.accounts.id) {
          resolve(window.google.accounts.id);
        } else reject(new Error("Google Identity gagal dimuat."));
      };
      sc.onerror = function () { reject(new Error("Tidak dapat memuat Google Identity.")); };
      document.head.appendChild(sc);
    });
    return googleSiap;
  }

  function bacaJwt(token) {
    var bagian = String(token).split(".");
    if (bagian.length < 2) return null;
    var b64 = bagian[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    try {
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch (e) {
      try { return JSON.parse(atob(b64)); } catch (e2) { return null; }
    }
  }

  function masukGoogle() {
    if (!S.googleClientId) {
      return Promise.reject(new Error("Google SSO belum dikonfigurasi (sso.googleClientId kosong)."));
    }
    return muatSkripGoogle().then(function (gid) {
      return new Promise(function (resolve, reject) {
        var waktu = false;
        gid.initialize({
          client_id: S.googleClientId,
          ux_mode: "popup",
          callback: function (res) {
            waktu = true;
            if (!res || !res.credential) return reject(new Error("Google tidak mengembalikan kredensial."));
            var p = bacaJwt(res.credential);
            if (!p || !p.email) return reject(new Error("Token Google tidak valid."));
            if (String(p.aud) !== String(S.googleClientId)) {
              return reject(new Error("Token Google bukan untuk aplikasi ini."));
            }
            hitungPeran(p.email).then(function (peran) {
              resolve(jadikanSesi({
                sub: p.sub, email: p.email, nama: p.name, gambar: p.picture, peran: peran
              }, "google"));
            });
          }
        });
        gid.prompt(function (n) {
          if (n && n.isNotDisplayed && n.isNotDisplayed() && n.isSkippedMoment && n.isSkippedMoment()) {
            /* Pengguna menutup One Tap; jangan tolak — tombol manual tetap tersedia. */
          }
        });
        /* Jaring aman bila popup gagal sepenuhnya. */
        setTimeout(function () {
          if (!waktu) {
            /* Diamkan; pengguna dapat menekan tombol Google yang dirender. */
          }
        }, 60000);
      });
    });
  }

  /* ---------------------------------------------------------
     GitHub OAuth (via proxy Netlify Function)
     --------------------------------------------------------- */
  function masukGitHub() {
    if (!S.githubClientId) {
      return Promise.reject(new Error("GitHub SSO belum dikonfigurasi (sso.githubClientId kosong)."));
    }
    return new Promise(function (resolve, reject) {
      var state = Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { sessionStorage.setItem("fast_oauth_state", state); } catch (e) {}
      var redirect = window.location.origin + "/auth/callback.html";
      var url = "https://github.com/login/oauth/authorize" +
        "?client_id=" + encodeURIComponent(S.githubClientId) +
        "&redirect_uri=" + encodeURIComponent(redirect) +
        "&scope=" + encodeURIComponent("read:user user:email public_repo") +
        "&state=" + encodeURIComponent(state);

      var lebar = 600, tinggi = 720;
      var kiri = window.screenX + (window.outerWidth - lebar) / 2;
      var atas = window.screenY + (window.outerHeight - tinggi) / 2;
      var pop = window.open(url, "fast_github_sso",
        "width=" + lebar + ",height=" + tinggi + ",left=" + kiri + ",top=" + atas);

      var selesai = false;
      function terima(ev) {
        if (!ev.data || ev.data.tipe !== "fast-oauth-github") return;
        selesai = true;
        window.removeEventListener("message", terima);
        try { clearInterval(poll); } catch (e) {}
        if (ev.data.kesalahan) return reject(new Error(ev.data.kesalahan));
        var d = ev.data.data || {};
        hitungPeran(d.email).then(function (peran) {
          resolve(jadikanSesi({
            sub: d.id, email: d.email, nama: d.name || d.login,
            gambar: d.avatar_url, peran: peran, token: d.access_token
          }, "github"));
        });
      }
      window.addEventListener("message", terima);

      var poll = setInterval(function () {
        if (pop && pop.closed && !selesai) {
          clearInterval(poll);
          window.removeEventListener("message", terima);
          reject(new Error("Login GitHub dibatalkan."));
        }
      }, 800);
    });
  }

  /* Dipanggil oleh /auth/callback.html di jendela popup. */
  function selesaikanGitHub(data) {
    if (!data || !data.email) return Promise.reject(new Error("Email GitHub tidak tersedia."));
    return hitungPeran(data.email).then(function (peran) {
      return jadikanSesi({
        sub: data.id, email: data.email, nama: data.name || data.login,
        gambar: data.avatar_url, peran: peran, token: data.access_token
      }, "github");
    });
  }

  /* ---------------------------------------------------------
     Mode demo
     --------------------------------------------------------- */
  function masukDemo(email, nama, peran) {
    if (!S.allowDemo) return Promise.reject(new Error("Mode demo dimatikan."));
    email = (email || "demo@ustedi.ac.id").toLowerCase();
    return hitungPeran(email).then(function (p) {
      var pakai = (peran && peran.length) ? peran : (p.length ? p : ["admin"]);
      return jadikanSesi({
        sub: "demo:" + email, email: email,
        nama: nama || email.split("@")[0], gambar: "", peran: pakai
      }, "demo");
    });
  }

  /* ---------------------------------------------------------
     API publik
     --------------------------------------------------------- */
  function simpan(s) { tulisSesi(s); return s; }

  function masuk(provider, opsi) {
    opsi = opsi || {};
    var alur;
    if (provider === "google") alur = masukGoogle();
    else if (provider === "github") alur = masukGitHub();
    else if (provider === "demo") alur = masukDemo(opsi.email, opsi.nama, opsi.peran);
    else return Promise.reject(new Error("Provider tidak dikenal: " + provider));
    return alur.then(simpan);
  }

  function keluar() {
    tulisSesi(null);
    if (S.googleClientId && window.google && window.google.accounts && window.google.accounts.id) {
      try { window.google.accounts.id.disableAutoSelect(); } catch (e) {}
    }
  }

  function sesi() { return SESI; }
  function punyaPeran() {
    if (!SESI || !SESI.peran) return false;
    var diminta = Array.prototype.slice.call(arguments).flat();
    if (!diminta.length) return true;
    return diminta.some(function (p) {
      if (SESI.peran.indexOf(p) >= 0) return true;
      var def = CFG.roles[p];
      return !!(def && SESI.peran.indexOf("admin") >= 0);
    });
  }

  function boleh(modul) {
    if (!SESI) return false;
    if (SESI.peran && SESI.peran.indexOf("admin") >= 0) return true;
    return (SESI.peran || []).some(function (p) {
      var def = CFG.roles[p];
      return def && def.boleh && def.boleh.indexOf(modul) >= 0;
    });
  }

  function onChange(cb) {
    pendengar.push(cb);
    cb(SESI);
    return function () {
      pendengar = pendengar.filter(function (x) { return x !== cb; });
    };
  }

  /* Gerbang halaman: pastikan pengguna sudah masuk (dan berperan,
     bila diminta). Bila belum, alihkan ke portal lalu kembali. */
  function jaga(opsi) {
    opsi = opsi || {};
    if (SESI && (!opsi.peran || punyaPeran(opsi.peran)) &&
        (!opsi.modul || boleh(opsi.modul))) {
      return Promise.resolve(SESI);
    }
    if (opsi.diam) return Promise.resolve(null);
    var target = window.location.pathname + window.location.search + window.location.hash;
    try { sessionStorage.setItem(S.redirectKey, target); } catch (e) {}
    var alamat = (window.FAST_BASE || "/") + "#masuk";
    window.location.replace(alamat);
    return Promise.resolve(null);
  }

  /* URL kembali setelah login berhasil. */
  function ambilTujuan() {
    var t = null;
    try {
      t = sessionStorage.getItem(S.redirectKey);
      sessionStorage.removeItem(S.redirectKey);
    } catch (e) {}
    return t || (window.FAST_BASE || "/");
  }

  /* Token GitHub untuk menulis konten ke repositori. */
  function tokenGitHub() { return SESI && SESI.token ? SESI.token : ""; }

  /* Render tombol resmi Google ke dalam elemen. */
  function siapkanTombol(el, opsi) {
    if (!el) return Promise.resolve(false);
    if (!S.googleClientId) { el.hidden = true; return Promise.resolve(false); }
    return muatSkripGoogle().then(function (gid) {
      gid.initialize({
        client_id: S.googleClientId,
        callback: function (res) {
          var p = bacaJwt(res.credential);
          if (!p || !p.email) return;
          hitungPeran(p.email).then(function (peran) {
            simpan(jadikanSesi({
              sub: p.sub, email: p.email, nama: p.name, gambar: p.picture, peran: peran
            }, "google"));
            if (opsi && opsi.onSuccess) opsi.onSuccess(SESI);
          });
        }
      });
      gid.renderButton(el, {
        theme: "outline", size: "large", width: (opsi && opsi.width) || 280,
        text: (opsi && opsi.text) || "signin_with", locale: "id", shape: "pill"
      });
      return true;
    }).catch(function () { el.hidden = true; return false; });
  }

  /* Muat sesi dari penyimpanan saat skrip dimuat. */
  SESI = bacaSesi();

  /* Sinkronkan antar-tab (satu login untuk semua tab/jendela). */
  window.addEventListener("storage", function (ev) {
    if (ev.key !== S.storageKey) return;
    SESI = bacaSesi();
    kabari();
  });

  /* Perbarui status bila sesi kedaluwarsa saat halaman terbuka. */
  setInterval(function () {
    if (SESI && Date.now() > SESI.exp) { keluar(); }
  }, 60000);

  window.FAST = window.FAST || {};
  window.FAST.auth = {
    masuk: masuk,
    keluar: keluar,
    sesi: sesi,
    pengguna: sesi,
    punyaPeran: punyaPeran,
    boleh: boleh,
    jaga: jaga,
    onChange: onChange,
    tokenGitHub: tokenGitHub,
    siapkanTombol: siapkanTombol,
    ambilTujuan: ambilTujuan,
    selesaikanGitHub: selesaikanGitHub,
    hitungPeran: hitungPeran,
    bacaJwt: bacaJwt,
    providerAktif: function () {
      return { google: !!S.googleClientId, github: !!S.githubClientId, demo: !!S.allowDemo };
    }
  };
})();
