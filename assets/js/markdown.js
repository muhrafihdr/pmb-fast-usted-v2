/* =========================================================
   FAST USTEDI — Perender Markdown Ringan (markdown.js)
   ---------------------------------------------------------
   Mendukung: judul (#..####), tebal, miring, tautan, kode
   inline, blok kutipan (>), daftar berbutir & bernomor,
   pemisah (---), gambar (![alt](src)), dan paragraf.
   Cukup untuk konten berita & halaman statis.
   ========================================================= */
(function () {
  "use strict";

  function aman(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Pemformatan sebaris. */
  function sebaris(teks) {
    var t = aman(teks);
    /* kode inline */
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    /* gambar */
    t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');
    /* tautan */
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, url) {
      var luar = /^https?:/i.test(url);
      return '<a href="' + url + '"' + (luar ? ' target="_blank" rel="noopener"' : "") + ">" + label + "</a>";
    });
    /* tebal & miring */
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    return t;
  }

  function render(md) {
    if (!md) return "";
    var baris = String(md).replace(/\r\n/g, "\n").split("\n");
    var out = [];
    var mode = null; /* "ul" | "ol" | "quote" */

    function tutup() {
      if (mode === "ul") out.push("</ul>");
      else if (mode === "ol") out.push("</ol>");
      else if (mode === "quote") out.push("</blockquote>");
      mode = null;
    }

    for (var i = 0; i < baris.length; i++) {
      var b = baris[i];
      var rapih = b.trim();

      if (!rapih) { tutup(); continue; }

      /* Pemisah */
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(rapih)) { tutup(); out.push("<hr />"); continue; }

      /* Judul */
      var h = rapih.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        tutup();
        var n = h[1].length;
        out.push("<h" + n + ">" + sebaris(h[2]) + "</h" + n + ">");
        continue;
      }

      /* Kutipan */
      if (/^>\s?/.test(rapih)) {
        if (mode !== "quote") { tutup(); out.push("<blockquote>"); mode = "quote"; }
        out.push("<p>" + sebaris(rapih.replace(/^>\s?/, "")) + "</p>");
        continue;
      }

      /* Daftar berbutir */
      if (/^[-*+]\s+/.test(rapih)) {
        if (mode !== "ul") { tutup(); out.push("<ul>"); mode = "ul"; }
        out.push("<li>" + sebaris(rapih.replace(/^[-*+]\s+/, "")) + "</li>");
        continue;
      }

      /* Daftar bernomor */
      if (/^\d+[.)]\s+/.test(rapih)) {
        if (mode !== "ol") { tutup(); out.push("<ol>"); mode = "ol"; }
        out.push("<li>" + sebaris(rapih.replace(/^\d+[.)]\s+/, "")) + "</li>");
        continue;
      }

      tutup();
      out.push("<p>" + sebaris(rapih) + "</p>");
    }
    tutup();
    return out.join("\n");
  }

  /* Buang penanda markdown untuk ringkasan/teks polos. */
  function polos(md, maks) {
    var t = String(md || "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[#>*_`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (maks && t.length > maks) t = t.slice(0, maks - 1).trim() + "…";
    return t;
  }

  window.FAST = window.FAST || {};
  window.FAST.md = { render: render, polos: polos };
})();
