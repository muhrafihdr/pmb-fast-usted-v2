/* =========================================================
   Monitoring FAST USTEDI — Dashboard Script
   ---------------------------------------------------------
   ⚙️ SUMBER DATA (pilih salah satu):

   CARA A (DEFAULT — paling mudah, TANPA Apps Script):
   Spreadsheet di-share "Anyone with the link can view",
   lalu dashboard membaca CSV publik secara langsung.
   Cukup isi SHEET_ID di bawah.

   CARA B (opsional — jika spreadsheet PRIVAT):
   Deploy Code.gs sebagai Web App (lihat README.md),
   lalu isi gasUrl dengan URL deployment-nya.
   ========================================================= */

const DATA_SOURCE = {
  // --- CARA A: CSV publik dari Google Spreadsheet ---
  type: "csv", // "csv" (default) atau "apps-script"
  sheetId: "1ddnHgb67DdQmOfs4FTQQIGm1U8Qwah55gH-V1rVOks0",

  // --- CARA B: URL Web App Apps Script (kosongkan jika pakai CSV) ---
  gasUrl: "",

  // Alternatif: tempel konfigurasi di window.MONITORING_CONFIG
  // (mis. di <script> terpisah) untuk menimpa nilai di atas:
  //   window.MONITORING_CONFIG = { sheetId: "...", gasUrl: "..." };
};

(function resolveConfig() {
  if (typeof window !== "undefined" && window.MONITORING_CONFIG) {
    const c = window.MONITORING_CONFIG;
    if (c.sheetId) DATA_SOURCE.sheetId = c.sheetId;
    if (c.gasUrl) DATA_SOURCE.gasUrl = c.gasUrl;
    if (c.type) DATA_SOURCE.type = c.type;
  }
})();

function csvUrl() {
  return "https://docs.google.com/spreadsheets/d/" +
    DATA_SOURCE.sheetId + "/export?format=csv";
}

/* =========================================================
   STATE GLOBAL
   ========================================================= */
let RAW = {
  headers: [],
  rows: [],        // [{header: value, ...}] — nilai mentah
  list: [],        // [{...nilai, _ts: Date|null, _day: 'YYYY-MM-DD'|null, _date: Date|null}]
  total: 0,
};

const state = {
  data: {
    search: "",
    prodi: "",
    jalur: "",
    from: "",
    to: "",
    perPage: 25,
    page: 1,
    sortKey: "",
    sortDir: "asc",
    visibleCols: [],
  },
  stat: {
    from: "",
    to: "",
    prodi: "",
    jalur: "",
  },
};

let charts = {};        // instance chart per canvas
let autoTimer = null;
let lastLoadedAt = null;

/* Alias kolom — dipetakan berdasarkan nama header spreadsheet.
   Tambahkan alias bila nama kolom di sheet berbeda. */
const COL_ALIAS = {
  timestamp: ["timestamp", "waktu", "tgl daftar", "tanggal daftar"],
  nama: ["nama lengkap", "nama", "nama pendaftar", "nama mahasiswa"],
  nik: ["nik", "no nik"],
  tempatLahir: ["tempat lahir", "ttl"],
  tanggalLahir: ["tanggal lahir", "tgl lahir"],
  gender: ["jenis kelamin", "jk", "gender"],
  email: ["email", "email aktif", "alamat email"],
  hp: ["no hp/wa", "no hp", "no wa", "whatsapp", "telepon", "hp"],
  alamat: ["alamat", "alamat lengkap"],
  provinsi: ["provinsi"],
  kabupaten: ["kota/kabupaten", "kabupaten", "kota"],
  kecamatan: ["kecamatan"],
  kelurahan: ["kelurahan/desa", "kelurahan", "desa"],
  kodePos: ["kode pos", "kodepos"],
  sekolah: ["asal sekolah", "sekolah"],
  jurusanSekolah: ["jurusan", "jurusan sekolah"],
  tahunLulus: ["tahun lulus", "tahun"],
  jalur: ["jalur pendaftaran", "jalur", "jalur daftar"],
  prodi: ["program studi", "prodi", "pilihan program studi"],
};

/* =========================================================
   UTILITAS
   ========================================================= */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const PALETTE = [
  "#0d3b8c", "#f5b301", "#0e7490", "#ea580c", "#7c3aed",
  "#db2777", "#16a34a", "#2563eb", "#dc2626", "#0891b2",
  "#ca8a04", "#65a30d", "#9333ea", "#f43f5e", "#0f766e",
];

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function pad2(n) { return String(n).padStart(2, "0"); }

function toDayStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function fmtDate(d) {
  if (!d) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(d) {
  if (!d) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) +
         " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function fmtTime(d) {
  if (!d) return "—";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fullNumber(v) {
  if (typeof v === "number" && Number.isInteger(v) && Math.abs(v) >= 1e14) {
    return v.toLocaleString("en-US", { useGrouping: false });
  }
  return String(v == null ? "" : v);
}

function colIndex(name) {
  const aliases = COL_ALIAS[name] || [];
  return RAW.headers.findIndex((h) => aliases.includes(String(h).toLowerCase()));
}

function col(name) {
  const i = colIndex(name);
  return i >= 0 ? RAW.headers[i] : null;
}

function val(row, name) {
  const c = col(name);
  return c ? (row[c] == null ? "" : row[c]) : "";
}

function parseDate(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return new Date(v);
  if (typeof v === "number") {
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }
  const s = String(v).trim();
  if (!s) return null;

  // ISO 8601 (mis. 2026-08-21T10:00:00Z)
  let d = new Date(s);
  if (!isNaN(d) && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) return d;

  // Format Indonesia dd/MM/yyyy [HH:mm:ss] (format default Google Sheets id-ID)
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const day = +m[1], mon = +m[2] - 1, yr = +m[3];
    d = new Date(yr, mon, day, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    if (!isNaN(d) && d.getDate() === day && d.getMonth() === mon) return d;
  }

  // Format "d MMM yyyy" (mis. 21 Agu 2026)
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const months = { jan:0, feb:1, mar:2, apr:3, mei:4, jun:5, jul:6, agu:7, sep:8, okt:9, nov:10, des:11 };
    const mon = months[String(m[2]).toLowerCase().slice(0, 3)];
    if (mon !== undefined) {
      d = new Date(+m[3], mon, +m[1]);
      if (!isNaN(d)) return d;
    }
  }
  return null;
}

function normalizeRows(rows) {
  const tsCol = colIndex("timestamp");
  return rows.map((r) => {
    const tsRaw = tsCol >= 0 ? r[RAW.headers[tsCol]] : "";
    const ts = parseDate(tsRaw);
    return {
      ...r,
      _ts: ts,
      _day: ts ? toDayStr(ts) : null,
    };
  });
}

/* =========================================================
   AMBIL DATA — CSV publik (Google Spreadsheet) atau Apps Script
   ========================================================= */

/* Parser CSV sederhana — mendukung kolom ber-quote, koma, dan baris baru */
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === '\r') { /* abaikan */ }
      else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

/* Mengambil data mentah dari sumber yang dikonfigurasi */
async function fetchData() {
  // --- CARA A: CSV publik ---
  if (DATA_SOURCE.type === "csv" && DATA_SOURCE.sheetId) {
    const url = csvUrl() + "&_=" + Date.now();
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error("Gagal membaca spreadsheet (HTTP " + res.status + ").");
    const text = await res.text();
    const parsed = parseCSV(text);
    if (!parsed.length) return { ok: true, total: 0, headers: [], rows: [] };
    const headers = parsed[0].map((h) => String(h).trim());
    const rows = parsed.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = r[i] == null ? "" : String(r[i]).trim();
      });
      return obj;
    });
    return { ok: true, total: rows.length, headers, rows };
  }

  // --- CARA B: Web App Apps Script ---
  if (DATA_SOURCE.gasUrl) {
    const sep = DATA_SOURCE.gasUrl.includes("?") ? "&" : "?";
    const res = await fetch(DATA_SOURCE.gasUrl + sep + "action=getAll&_=" + Date.now(), {
      method: "GET",
      redirect: "follow",
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) { /* bukan JSON */ }
    if (!json || json.ok !== true) {
      throw new Error((json && json.error) || "Respons server tidak valid. Periksa deployment Apps Script.");
    }
    return json;
  }

  throw new Error("Sumber data belum dikonfigurasi. Isi DATA_SOURCE.sheetId (Cara A) atau DATA_SOURCE.gasUrl (Cara B) di script.js.");
}

async function loadData(silent) {
  if (!silent) {
    $("#content").hidden = true;
    $("#errorState").hidden = true;
    $("#emptyState").hidden = true;
    $("#loading").hidden = false;
  }

  const btn = $("#btnRefresh");
  const ico = btn.querySelector(".refresh-ico");
  btn.disabled = true;
  ico.classList.add("spin");

  try {
    const json = await fetchData();

    RAW.headers = json.headers || [];
    RAW.rows = json.rows || [];
    RAW.total = RAW.rows.length;
    RAW.list = normalizeRows(RAW.rows);

    // Inisialisasi kolom yang tampil (default) agar toggle checkbox konsisten
    if (!state.data.visibleCols.length) {
      state.data.visibleCols = DEFAULT_COLS.filter((k) => colIndex(k) >= 0);
    }

    if (RAW.total === 0) {
      $("#content").hidden = true;
      $("#loading").hidden = true;
      $("#errorState").hidden = true;
      $("#emptyState").hidden = false;
      $("#lastUpdated").textContent = "⏱️ " + fmtTime(new Date());
      scheduleAutoRefresh();
      return;
    }

    // Muat ulang pilihan dropdown (prodi/jalur) tanpa kehilangan pilihan user
    refreshSelectOptions();

    renderAll();

    $("#loading").hidden = true;
    $("#emptyState").hidden = true;
    $("#errorState").hidden = true;
    $("#content").hidden = false;

    lastLoadedAt = new Date();
    $("#lastUpdated").textContent = "⏱️ " + fmtTime(lastLoadedAt);

    scheduleAutoRefresh();
  } catch (err) {
    console.error(err);
    showError(err.message || "Terjadi kesalahan saat mengambil data.");
  } finally {
    btn.disabled = false;
    ico.classList.remove("spin");
  }
}

function showError(msg) {
  $("#content").hidden = true;
  $("#loading").hidden = true;
  $("#emptyState").hidden = true;
  $("#errorState").hidden = false;
  $("#errorMessage").textContent = msg;
}

/* =========================================================
   RENDER SEMUA
   ========================================================= */
function renderAll() {
  renderInsight();
  renderKpi();
  renderDashCharts();
  renderRecent();
  renderStatKpi();
  renderStatCharts();
  renderColPicker();
  renderDataTable();
}

/* ---------- Insight strip ---------- */
function renderInsight() {
  const today = new Date();
  const todayCount = RAW.list.filter((r) => r._ts && isSameDay(r._ts, today)).length;
  const monthCount = RAW.list.filter((r) => {
    return r._ts && r._ts.getFullYear() === today.getFullYear() && r._ts.getMonth() === today.getMonth();
  }).length;

  const strip = $("#insightStrip");
  strip.hidden = false;
  strip.innerHTML = `
    <span class="insight-pill">🟢 <strong>${RAW.total}</strong> total pendaftar</span>
    <span class="insight-pill">📅 Hari ini: <strong>${todayCount}</strong> pendaftar</span>
    <span class="insight-pill">🗓️ Bulan ${today.toLocaleDateString("id-ID", { month: "long" })}: <strong>${monthCount}</strong> pendaftar</span>
  `;
}

/* ---------- KPI Dashboard ---------- */
function renderKpi() {
  const list = RAW.list;
  const today = new Date();
  const todayStart = startOfDay(today);

  const countToday = list.filter((r) => r._ts && isSameDay(r._ts, today)).length;
  const countYesterday = list.filter((r) => {
    return r._ts && isSameDay(r._ts, addDays(today, -1));
  }).length;

  const weekStart = addDays(todayStart, -6);
  const prevWeekStart = addDays(todayStart, -13);
  const countWeek = list.filter((r) => r._ts && r._ts >= weekStart && r._ts <= today).length;
  const countPrevWeek = list.filter((r) => r._ts && r._ts >= prevWeekStart && r._ts < weekStart).length;

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const countMonth = list.filter((r) => r._ts && r._ts >= monthStart).length;
  const countPrevMonth = list.filter((r) => {
    return r._ts && r._ts >= prevMonthStart && r._ts < monthStart;
  }).length;

  // Prodi & jalur terpopuler
  const top = (field) => {
    const counts = {};
    list.forEach((r) => {
      const v = String(val(r, field) || "Tidak diketahui").trim();
      counts[v] = (counts[v] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries.length ? entries[0] : ["—", 0];
  };
  const [topProdi, topProdiN] = top("prodi");
  const [topJalur, topJalurN] = top("jalur");

  const deltaBadge = (cur, prev) => {
    const diff = cur - prev;
    if (diff > 0) return `<span class="delta up">▲ +${diff}</span>`;
    if (diff < 0) return `<span class="delta down">▼ ${diff}</span>`;
    return `<span class="delta flat">● 0</span>`;
  };

  const kpis = [
    {
      cls: "", label: "👥 Total Pendaftar", value: RAW.total.toLocaleString("id-ID"),
      sub: "Seluruh periode",
    },
    {
      cls: "kpi-accent", label: "📅 Hari Ini", value: countToday.toLocaleString("id-ID"),
      sub: deltaBadge(countToday, countYesterday) + " vs kemarin",
    },
    {
      cls: "kpi-teal", label: "🗓️ 7 Hari Terakhir", value: countWeek.toLocaleString("id-ID"),
      sub: deltaBadge(countWeek, countPrevWeek) + " vs 7 hari sblmnya",
    },
    {
      cls: "kpi-green", label: "🌙 Bulan Ini", value: countMonth.toLocaleString("id-ID"),
      sub: deltaBadge(countMonth, countPrevMonth) + " vs bulan lalu",
    },
    {
      cls: "kpi-orange", label: "🎓 Prodi Terpopuler", value: esc(topProdi),
      sub: topProdiN + " pendaftar", small: true,
    },
    {
      cls: "kpi-accent", label: "🚀 Jalur Terpopuler", value: esc(topJalur),
      sub: topJalurN + " pendaftar", small: true,
    },
  ];

  $("#kpiGrid").innerHTML = kpis.map((k) => `
    <div class="kpi-card ${k.cls}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value ${k.small ? "small" : ""}" title="${esc(k.sub)}">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>
  `).join("");
}

/* ---------- Chart helper ---------- */
function makeChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  if (typeof Chart === "undefined") {
    const box = canvas.closest(".chart-box");
    if (box) {
      box.innerHTML = `<div class="chart-fallback">Grafik tidak dapat dimuat — periksa koneksi internet (Chart.js dari CDN).</div>`;
    }
    return;
  }
  charts[id] = new Chart(canvas.getContext("2d"), config);
}

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      labels: { boxWidth: 12, boxHeight: 12, padding: 14, font: { family: "Poppins", size: 11 } },
    },
    tooltip: {
      font: { family: "Poppins", size: 12 },
      callbacks: {
        label: (ctx) => " " + ctx.parsed.y + " pendaftar",
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { family: "Poppins", size: 11 }, color: "#64748b" },
    },
    y: {
      beginAtZero: true,
      ticks: { precision: 0, font: { family: "Poppins", size: 11 }, color: "#64748b" },
      grid: { color: "#eef2f7" },
    },
  },
};

/* ---------- Charts Dashboard ---------- */
function renderDashCharts() {
  const list = RAW.list;

  // Prodi (bar)
  const prodiCounts = countBy(list, "prodi");
  makeChart("chartProdi", {
    type: "bar",
    data: {
      labels: prodiCounts.map((p) => p.label),
      datasets: [{
        label: "Pendaftar",
        data: prodiCounts.map((p) => p.count),
        backgroundColor: prodiCounts.map((_, i) => PALETTE[i % PALETTE.length]),
        borderRadius: 8,
        maxBarThickness: 46,
      }],
    },
    options: { ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { display: false } } },
  });

  // Jalur (doughnut)
  const jalurCounts = countBy(list, "jalur");
  makeChart("chartJalur", {
    type: "doughnut",
    data: {
      labels: jalurCounts.map((p) => p.label),
      datasets: [{
        data: jalurCounts.map((p) => p.count),
        backgroundColor: jalurCounts.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 2,
        borderColor: "#fff",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 12, font: { family: "Poppins", size: 11 } } },
        tooltip: {
          font: { family: "Poppins", size: 12 },
          callbacks: {
            label: (ctx) => ` ${ctx.parsed} pendaftar (${pct(ctx.parsed, jalurCounts)})`,
          },
        },
      },
    },
  });

  // Tren 14 hari
  const { labels: trenLabels, data: trenData } = dailySeries(list, 14);
  makeChart("chartTren", {
    type: "line",
    data: {
      labels: trenLabels,
      datasets: [{
        label: "Pendaftar",
        data: trenData,
        borderColor: "#0d3b8c",
        backgroundColor: "rgba(13,59,140,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: "#f5b301",
        pointBorderColor: "#fff",
        pointBorderWidth: 1.5,
        borderWidth: 2.5,
      }],
    },
    options: { ...CHART_OPTS },
  });

  // Gender (doughnut)
  const genderCounts = countBy(list, "gender");
  makeChart("chartGender", {
    type: "doughnut",
    data: {
      labels: genderCounts.map((p) => p.label),
      datasets: [{
        data: genderCounts.map((p) => p.count),
        backgroundColor: genderCounts.map((p) =>
          /laki/i.test(p.label) ? "#0d3b8c" : /perempuan/i.test(p.label) ? "#db2777" : "#94a3b8"
        ),
        borderWidth: 2,
        borderColor: "#fff",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 12, font: { family: "Poppins", size: 11 } } },
        tooltip: {
          font: { family: "Poppins", size: 12 },
          callbacks: {
            label: (ctx) => ` ${ctx.parsed} pendaftar (${pct(ctx.parsed, genderCounts)})`,
          },
        },
      },
    },
  });
}

function pct(n, arr) {
  const total = arr.reduce((s, a) => s + a.count, 0);
  if (!total) return "0%";
  return Math.round((n / total) * 100) + "%";
}

function countBy(list, field) {
  const counts = {};
  list.forEach((r) => {
    let v = String(val(r, field) || "Tidak diketahui").trim();
    if (!v) v = "Tidak diketahui";
    counts[v] = (counts[v] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || String(a.label).localeCompare(b.label));
}

/* Deret harian: labels = hari (dari paling lama ke terbaru), data = jumlah */
function dailySeries(list, days, endDate = new Date()) {
  const end = startOfDay(endDate);
  const labels = [];
  const data = [];
  const map = {};
  list.forEach((r) => {
    if (r._day) map[r._day] = (map[r._day] || 0) + 1;
  });
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(end, -i);
    const key = toDayStr(d);
    labels.push(d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }));
    data.push(map[key] || 0);
  }
  return { labels, data };
}

/* ---------- Tabel pendaftar terbaru ---------- */
function renderRecent() {
  const sorted = RAW.list
    .filter((r) => r._ts)
    .sort((a, b) => b._ts - a._ts)
    .slice(0, 8);

  const tbody = $("#recentTable tbody");
  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b;padding:24px">Belum ada data pendaftar.</td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map((r) => `
    <tr>
      <td style="white-space:nowrap">${esc(fmtDateTime(r._ts))}</td>
      <td><strong>${esc(val(r, "nama"))}</strong></td>
      <td><span class="badge badge-prodi">${esc(val(r, "prodi"))}</span></td>
      <td><span class="badge badge-jalur">${esc(val(r, "jalur"))}</span></td>
      <td><span class="badge badge-gender">${esc(val(r, "gender"))}</span></td>
      <td>${esc(val(r, "sekolah"))}</td>
      <td>${esc(val(r, "provinsi"))}</td>
    </tr>
  `).join("");
}

/* =========================================================
   SEKSI STATISTIK (dengan filter rentang)
   ========================================================= */
function statFiltered() {
  const { from, to, prodi, jalur } = state.stat;
  return RAW.list.filter((r) => {
    if (from && r._day && r._day < from) return false;
    if (to && r._day && r._day > to) return false;
    if (prodi && val(r, "prodi") !== prodi) return false;
    if (jalur && val(r, "jalur") !== jalur) return false;
    return true;
  });
}

function renderStatKpi() {
  const rows = statFiltered();
  const from = state.stat.from || (RAW.list.length ? RAW.list[0]._day : "");
  const to = state.stat.to || toDayStr(new Date());

  // hari-hari unik
  const days = {};
  rows.forEach((r) => { if (r._day) days[r._day] = (days[r._day] || 0) + 1; });
  const dayEntries = Object.entries(days).sort((a, b) => b[1] - a[1]);

  const totalDays = (() => {
    if (!from || !to) return 1;
    const a = new Date(from), b = new Date(to);
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  })();
  const avg = rows.length / totalDays;

  const top = (field) => {
    const c = countBy(rows, field);
    return c.length ? c[0] : { label: "—", count: 0 };
  };
  const topProdi = top("prodi");
  const topJalur = top("jalur");

  const g = countBy(rows, "gender");
  const gL = g.find((x) => /laki/i.test(x.label));
  const gP = g.find((x) => /perempuan/i.test(x.label));
  const ratio = gL && gP
    ? `${gL.count} : ${gP.count} (L:P)`
    : gL ? `Laki-laki ${gL.count}` : gP ? `Perempuan ${gP.count}` : "—";

  const kpis = [
    { label: "📊 Pendaftar (rentang)", value: rows.length.toLocaleString("id-ID"), sub: `${from || "—"} s.d. ${to}` },
    { label: "📈 Rata-rata / hari", value: avg.toFixed(1), sub: `dalam ${totalDays} hari` },
    { label: "🔥 Hari tersibuk", value: dayEntries.length ? fmtDate(new Date(dayEntries[0][0])) : "—", sub: dayEntries.length ? `${dayEntries[0][1]} pendaftar` : "", small: true },
    { label: "🎓 Prodi terpopuler", value: esc(topProdi.label), sub: `${topProdi.count} pendaftar`, small: true },
    { label: "🚀 Jalur terpopuler", value: esc(topJalur.label), sub: `${topJalur.count} pendaftar`, small: true },
    { label: "⚖️ Rasio gender", value: esc(ratio), sub: `${rows.length} pendaftar`, small: true },
  ];

  $("#statKpi").innerHTML = kpis.map((k, i) => `
    <div class="kpi-card ${["", "kpi-accent", "kpi-orange", "kpi-teal", "kpi-green", "kpi-accent"][i]}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value ${k.small ? "small" : ""}" title="${esc(k.sub)}">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>
  `).join("");
}

function renderStatCharts() {
  const rows = statFiltered();

  // Tren harian (otomatis: per hari ≤ 90 hari, selain itu per bulan)
  const from = state.stat.from || "";
  const to = state.stat.to || "";
  let spanDays = 30;
  if (from && to) spanDays = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  const perMonth = spanDays > 90;

  let labels = [], data = [];
  if (perMonth) {
    // agregasi per bulan
    const months = {};
    rows.forEach((r) => {
      if (r._ts) {
        const key = `${r._ts.getFullYear()}-${pad2(r._ts.getMonth() + 1)}`;
        months[key] = (months[key] || 0) + 1;
      }
    });
    labels = Object.keys(months).sort();
    data = labels.map((k) => months[k]);
    labels = labels.map((k) => {
      const [y, m] = k.split("-");
      const d = new Date(y, Number(m) - 1, 1);
      return d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    });
  } else {
    const end = to ? new Date(to) : new Date();
    const series = dailySeries(rows, spanDays < 7 ? 7 : spanDays, end);
    labels = series.labels;
    data = series.data;
  }

  makeChart("chartTrendRange", {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Pendaftar",
        data,
        borderColor: "#0e7490",
        backgroundColor: "rgba(14,116,144,0.14)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: "#f5b301",
        pointBorderColor: "#fff",
        borderWidth: 2.5,
      }],
    },
    options: { ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { display: false } } },
  });

  // Distribusi jalur
  const jalur = countBy(rows, "jalur");
  makeChart("chartJalurRange", {
    type: "doughnut",
    data: {
      labels: jalur.map((p) => p.label),
      datasets: [{
        data: jalur.map((p) => p.count),
        backgroundColor: jalur.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 2,
        borderColor: "#fff",
      }],
    },
    options: doughnutOpts(jalur),
  });

  // Distribusi prodi
  const prodi = countBy(rows, "prodi");
  makeChart("chartProdiRange", {
    type: "bar",
    data: {
      labels: prodi.map((p) => p.label),
      datasets: [{
        label: "Pendaftar",
        data: prodi.map((p) => p.count),
        backgroundColor: prodi.map((_, i) => PALETTE[i % PALETTE.length]),
        borderRadius: 8,
        maxBarThickness: 46,
      }],
    },
    options: { ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { display: false } } },
  });

  // Top 10 provinsi
  const prov = countBy(rows, "provinsi").slice(0, 10).reverse();
  makeChart("chartProvinsi", {
    type: "bar",
    data: {
      labels: prov.map((p) => p.label),
      datasets: [{
        label: "Pendaftar",
        data: prov.map((p) => p.count),
        backgroundColor: "rgba(245,179,1,0.85)",
        borderRadius: 6,
        maxBarThickness: 24,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { font: { family: "Poppins", size: 12 } },
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0, font: { family: "Poppins", size: 11 }, color: "#64748b" }, grid: { color: "#eef2f7" } },
        y: { ticks: { font: { family: "Poppins", size: 11 }, color: "#334155" }, grid: { display: false } },
      },
    },
  });
}

function doughnutOpts(arr) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 12, padding: 12, font: { family: "Poppins", size: 11 } } },
      tooltip: {
        font: { family: "Poppins", size: 12 },
        callbacks: { label: (ctx) => ` ${ctx.parsed} pendaftar (${pct(ctx.parsed, arr)})` },
      },
    },
  };
}

/* =========================================================
   SEKSI DATA — tabel, filter, sort, pagination, export
   ========================================================= */
const DEFAULT_COLS = [
  "timestamp", "nama", "gender", "prodi", "jalur",
  "sekolah", "provinsi", "hp", "email",
];

function visibleColKeys() {
  if (state.data.visibleCols.length) return state.data.visibleCols;
  return DEFAULT_COLS.filter((k) => colIndex(k) >= 0);
}

function dataFiltered() {
  const { search, prodi, jalur, from, to } = state.data;
  const q = search.toLowerCase().trim();
  const keys = Object.keys(COL_ALIAS);

  return RAW.list.filter((r) => {
    if (prodi && val(r, "prodi") !== prodi) return false;
    if (jalur && val(r, "jalur") !== jalur) return false;
    if (from && r._day && r._day < from) return false;
    if (to && r._day && r._day > to) return false;
    if (q) {
      const hay = keys.map((k) => String(val(r, k)).toLowerCase()).join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderDataTable() {
  const rows = dataFiltered();
  const totalPages = Math.max(1, Math.ceil(rows.length / state.data.perPage));
  if (state.data.page > totalPages) state.data.page = totalPages;

  // Sort
  const { sortKey, sortDir } = state.data;
  if (sortKey) {
    rows.sort((a, b) => {
      const va = val(a, sortKey);
      const vb = val(b, sortKey);
      let cmp = 0;
      if (sortKey === "timestamp") {
        const ta = a._ts ? a._ts.getTime() : -Infinity;
        const tb = b._ts ? b._ts.getTime() : -Infinity;
        cmp = ta - tb;
      } else {
        cmp = String(va).localeCompare(String(vb), "id", { numeric: true });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  } else {
    rows.sort((a, b) => (b._ts ? b._ts.getTime() : 0) - (a._ts ? a._ts.getTime() : 0));
  }

  // Header kolom
  const keys = visibleColKeys();
  const thead = $("#dataThead");
  thead.innerHTML = `<tr>
    ${keys.map((k) => {
      const label = col(k) || k;
      const active = state.data.sortKey === k;
      const arrow = active ? (state.data.sortDir === "asc" ? " ▲" : " ▼") : "";
      return `<th class="sortable" data-sort="${k}" title="Urutkan: ${esc(label)}">${esc(label)}${arrow}</th>`;
    }).join("")}
  </tr>`;

  // Badan tabel
  const start = (state.data.page - 1) * state.data.perPage;
  const pageRows = rows.slice(start, start + state.data.perPage);
  const tbody = $("#dataTbody");

  if (!pageRows.length) {
    tbody.innerHTML = `<tr><td colspan="${keys.length}" style="text-align:center;color:#64748b;padding:30px">Tidak ada data yang cocok dengan filter.</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map((r) => `
      <tr>
        ${keys.map((k) => {
          if (k === "timestamp") return `<td style="white-space:nowrap">${esc(fmtDateTime(r._ts))}</td>`;
          if (k === "prodi") return `<td><span class="badge badge-prodi">${esc(val(r, k))}</span></td>`;
          if (k === "jalur") return `<td><span class="badge badge-jalur">${esc(val(r, k))}</span></td>`;
          if (k === "gender") return `<td><span class="badge badge-gender">${esc(val(r, k))}</span></td>`;
          if (k === "email") return `<td><a href="mailto:${esc(val(r, k))}" style="color:#0d3b8c">${esc(val(r, k))}</a></td>`;
          return `<td>${esc(fullNumber(val(r, k)))}</td>`;
        }).join("")}
      </tr>
    `).join("");
  }

  // Info + pagination
  const shown = rows.length ? `${start + 1}–${start + pageRows.length}` : "0";
  $("#tableCount").textContent = `${shown} dari ${rows.length.toLocaleString("id-ID")} data`;
  renderPagination(rows.length, totalPages);
}

function renderPagination(totalRows, totalPages) {
  const wrap = $("#pagination");
  const page = state.data.page;
  let html = `<button class="page-btn" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>‹</button>`;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) pages.push(i);
  }
  let prev = 0;
  pages.forEach((p) => {
    if (p - prev > 1) html += `<span class="page-btn" style="border:none;background:none;color:#94a3b8">…</span>`;
    html += `<button class="page-btn ${p === page ? "current" : ""}" data-page="${p}">${p}</button>`;
    prev = p;
  });

  html += `<button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>›</button>`;
  wrap.innerHTML = html;

  wrap.querySelectorAll(".page-btn[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const p = Number(btn.dataset.page);
      if (p >= 1 && p <= totalPages) { state.data.page = p; renderDataTable(); }
    });
  });
}

function renderColPicker() {
  const wrap = $("#colList");
  wrap.innerHTML = RAW.headers.map((h) => {
    const key = Object.keys(COL_ALIAS).find((k) => COL_ALIAS[k].includes(h.toLowerCase())) || h;
    const checked = visibleColKeys().includes(key) ? "checked" : "";
    return `<label><input type="checkbox" value="${esc(h)}" data-key="${esc(key)}" ${checked}> ${esc(h)}</label>`;
  }).join("");

  wrap.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const key = cb.dataset.key;
      state.data.visibleCols = state.data.visibleCols.filter((k) => k !== key);
      if (cb.checked) state.data.visibleCols.push(key);
      if (!state.data.visibleCols.length) {
        // minimal 1 kolom tetap tampil
        state.data.visibleCols.push(key);
        renderColPicker();
      }
      state.data.page = 1;
      renderDataTable();
    });
  });
}

/* =========================================================
   DROPDOWN PRODI / JALUR
   ========================================================= */
function refreshSelectOptions() {
  fillSelect("#statProdi", "prodi", state.stat.prodi);
  fillSelect("#statJalur", "jalur", state.stat.jalur);
  fillSelect("#dataProdi", "prodi", state.data.prodi);
  fillSelect("#dataJalur", "jalur", state.data.jalur);
}

function fillSelect(sel, field, current) {
  const el = $(sel);
  if (!el) return;
  const values = countBy(RAW.list, field).map((x) => x.label);
  const optAll = el.querySelector('option[value=""]');
  el.innerHTML = "";
  el.appendChild(optAll || new Option("Semua", ""));
  values.forEach((v) => {
    el.appendChild(new Option(v, v));
  });
  el.value = values.includes(current) ? current : "";
}

/* =========================================================
   EXPORT CSV
   ========================================================= */
function exportCsv() {
  const rows = dataFiltered();
  if (!rows.length) {
    alert("Tidak ada data untuk diexport dengan filter saat ini.");
    return;
  }
  const headers = RAW.headers;
  const lines = [];
  lines.push(headers.map((h) => csvCell(h)).join(";"));
  rows.forEach((r) => {
    lines.push(headers.map((h) => {
      let v = r[h] == null ? "" : String(r[h]);
      if (h.toLowerCase().includes("timestamp")) {
        v = r._ts ? fmtDateTime(r._ts) : v;
      }
      return csvCell(v);
    }).join(";"));
  });

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  a.href = url;
  a.download = `monitoring-fast-pendaftar-${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvCell(v) {
  const s = String(v == null ? "" : v).replace(/"/g, '""');
  return /[";\n\r]/.test(s) ? `"${s}"` : s;
}

/* =========================================================
   NAVIGASI + SIDEBAR MOBILE
   ========================================================= */
function activateSection(id) {
  const sections = ["dashboard", "statistik", "data", "bantuan"];
  sections.forEach((s) => {
    $("#" + s).hidden = s !== id;
  });

  const titles = {
    dashboard: ["Dashboard", "Ringkasan pendaftar mahasiswa baru FAST USTEDI"],
    statistik: ["Statistik", "Analisis mendalam dengan filter rentang waktu"],
    data: ["Data Pendaftar", "Rekap lengkap pendaftar — cari, filter, sortir, dan export"],
    bantuan: ["Bantuan & Setup", "Panduan menghubungkan dashboard ke Google Spreadsheet"],
  };
  $("#pageTitle").textContent = titles[id][0];
  $("#pageSubtitle").textContent = titles[id][1];

  $$(".nav-link").forEach((a) => a.classList.toggle("active", a.dataset.nav === titles[id][0]));

  if (id === "statistik") {
    renderStatKpi();
    renderStatCharts();
  }
  if (id === "data") renderDataTable();
}

function openSidebar(open) {
  $("#sidebar").classList.toggle("open", open);
  $("#sidebarBackdrop").hidden = !open;
}

/* =========================================================
   AUTO REFRESH
   ========================================================= */
function scheduleAutoRefresh() {
  if (autoTimer) clearTimeout(autoTimer);
  const sec = Number($("#autoRefresh").value || 0);
  if (sec <= 0) return;
  autoTimer = setTimeout(() => {
    loadData(true);
  }, sec * 1000);
}

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  $("#year").textContent = new Date().getFullYear();

  // Sidebar
  $("#menuBtn").addEventListener("click", () => openSidebar(true));
  $("#sidebarClose").addEventListener("click", () => openSidebar(false));
  $("#sidebarBackdrop").addEventListener("click", () => openSidebar(false));
  $$(".nav-link").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      activateSection(a.getAttribute("href").slice(1));
      openSidebar(false);
    });
  });

  // Refresh
  $("#btnRefresh").addEventListener("click", () => { state.data.page = 1; loadData(false); });
  $("#btnRetry").addEventListener("click", () => loadData(false));
  $("#btnEmptyRetry").addEventListener("click", () => loadData(false));
  $("#autoRefresh").addEventListener("change", scheduleAutoRefresh);

  // Filter statistik
  $("#btnApplyStat").addEventListener("click", () => {
    state.stat = {
      from: $("#statFrom").value,
      to: $("#statTo").value,
      prodi: $("#statProdi").value,
      jalur: $("#statJalur").value,
    };
    renderStatKpi();
    renderStatCharts();
  });
  $("#btnResetStat").addEventListener("click", () => {
    state.stat = { from: "", to: "", prodi: "", jalur: "" };
    $("#statFrom").value = ""; $("#statTo").value = "";
    $("#statProdi").value = ""; $("#statJalur").value = "";
    refreshSelectOptions();
    renderStatKpi();
    renderStatCharts();
  });

  // Filter data
  const bindDataFilter = (key, el) => {
    el.addEventListener("input", () => {
      state.data[key] = el.value;
      state.data.page = 1;
      renderDataTable();
    });
    el.addEventListener("change", () => {
      state.data[key] = el.value;
      state.data.page = 1;
      renderDataTable();
    });
  };
  bindDataFilter("search", $("#dataSearch"));
  bindDataFilter("prodi", $("#dataProdi"));
  bindDataFilter("jalur", $("#dataJalur"));
  bindDataFilter("from", $("#dataFrom"));
  bindDataFilter("to", $("#dataTo"));
  $("#dataPerPage").addEventListener("change", (e) => {
    state.data.perPage = Number(e.target.value);
    state.data.page = 1;
    renderDataTable();
  });
  $("#btnResetData").addEventListener("click", () => {
    state.data.search = ""; state.data.prodi = ""; state.data.jalur = "";
    state.data.from = ""; state.data.to = ""; state.data.page = 1;
    $("#dataSearch").value = ""; $("#dataProdi").value = "";
    $("#dataJalur").value = ""; $("#dataFrom").value = ""; $("#dataTo").value = "";
    refreshSelectOptions();
    renderDataTable();
  });

  // Sort header
  $("#dataThead").addEventListener("click", (e) => {
    const th = e.target.closest("th.sortable");
    if (!th) return;
    const key = th.dataset.sort;
    if (state.data.sortKey === key) {
      state.data.sortDir = state.data.sortDir === "asc" ? "desc" : "asc";
    } else {
      state.data.sortKey = key;
      state.data.sortDir = "asc";
    }
    state.data.page = 1;
    renderDataTable();
  });

  // Export
  $("#btnExport").addEventListener("click", exportCsv);

  // Muat data awal
  loadData(false);
});
