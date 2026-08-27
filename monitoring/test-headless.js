/* Headless end-to-end test: memuat script.js + menarik DATA ASLI dari spreadsheet live */
const fs = require("fs");
const vm = require("vm");

function makeEl(id) {
  return {
    id, hidden: false, value: "", dataset: {}, innerHTML: "", textContent: "",
    classList: { add(){}, remove(){}, toggle(){} }, style: {},
    addEventListener(){}, querySelector(){ return makeEl("child"); },
    querySelectorAll(){ return []; }, appendChild(){}, removeChild(){},
    closest(){ return null; }, getContext(){ return {}; }, focus(){}, scrollIntoView(){},
    reset(){},
  };
}
const els = {};
const listeners = {};
const store = {};
const localStorageStub = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const documentStub = {
  getElementById(id){ if(!els[id]) els[id]=makeEl(id); return els[id]; },
  querySelector(sel){ const id=String(sel).replace(/^#/,""); if(!els[id]) els[id]=makeEl(id); return els[id]; },
  querySelectorAll(){ return []; },
  createElement(){ return makeEl("dyn"); },
  addEventListener(ev, cb){ listeners[ev] = cb; },
  body: { appendChild(){}, removeChild(){} },
};

const sandbox = {
  document: documentStub,
  window: { addEventListener(){}, Chart: function(){ return { destroy(){} }; },
            URL: { createObjectURL(){ return "blob:x"; }, revokeObjectURL(){} } },
  console,
  setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, alert(){},
  confirm: () => true,
  Blob: function(){},
  // Pakai fetch asli Node → menarik data ASLI dari spreadsheet live
  fetch: globalThis.fetch,
  Date, Math, JSON, Number, String, Object, Array, RegExp, isNaN,
  listeners,
  process,
  localStorage: localStorageStub,
  localStorageStub,
  Option: function(text, value) { return { text, value, selected: false }; },
};

vm.createContext(sandbox);
try {
  vm.runInContext(fs.readFileSync("script.js", "utf8"), sandbox, { filename: "script.js" });
  console.log("Loaded OK");
} catch (e) {
  console.error("LOAD FAIL:", e.message);
  process.exit(1);
}

const test = `
(async () => {
  if (typeof listeners["DOMContentLoaded"] === "function") listeners["DOMContentLoaded"]();
  // Tunggu fetch jaringan asli selesai
  for (let i = 0; i < 40 && RAW.total === 0; i++) {
    await new Promise(r => setTimeout(r, 100));
  }

  console.log("RAW.total =", RAW.total, "| headers:", RAW.headers.length);

  if (RAW.total < 1) throw new Error("tidak ada data dari CSV live — cek endpoint");
  if (!RAW.headers.includes("Nama Lengkap")) throw new Error("header tidak sesuai");

  // Timestamp dd/MM/yyyy harus ter-parse
  const withTs = RAW.list.filter(r => r._ts);
  if (!withTs.length) throw new Error("tidak ada timestamp yang ter-parse");
  const sample = withTs[0];
  console.log("Contoh ts mentah:", RAW.list.find(r => r._ts).Timestamp, "→", sample._day);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(sample._day)) throw new Error("day format salah: " + sample._day);

  // KPI
  renderKpi();
  if (!$("#kpiGrid").innerHTML.includes("Total Pendaftar")) throw new Error("KPI grid missing");
  if (!$("#kpiGrid").innerHTML.includes(">" + RAW.total + "<")) throw new Error("KPI count salah");

  renderDashCharts();
  renderStatCharts();

  state.stat = { from: "", to: "", prodi: "", jalur: "" };
  if (statFiltered().length !== RAW.total) throw new Error("statFiltered salah");

  renderDataTable();
  renderColPicker();
  if (!$("#dataThead").innerHTML.includes("Nama Lengkap")) throw new Error("thead missing");

  // Sort
  state.data.sortKey = "nama"; state.data.sortDir = "asc"; renderDataTable();

  // Search
  state.data.search = "TEST"; state.data.page = 1; renderDataTable();
  const hits = $("dataTbody").innerHTML;
  if (!hits.includes("TEST TRIGGER HEADER") && !hits.includes("TEST VERIFIKASI")) {
    throw new Error("search 'TEST' tidak menemukan data");
  }
  state.data.search = "";

  // parseDate edge cases
  if (parseDate("garbage") !== null) throw new Error("parseDate harus tolak garbage");
  if (parseDate("") !== null) throw new Error("parseDate harus tolak kosong");
  const d = parseDate("21/08/2026 12:44:21");
  if (!d || d.getFullYear() !== 2026 || d.getMonth() !== 7 || d.getDate() !== 21) {
    throw new Error("parseDate dd/MM/yyyy gagal: " + d);
  }

  // parseCSV dengan tanda kutip & koma
  const csvSample = '"Nama","Alamat"\\n"Budi","Jl. A, No 1"\\n"Siti","Jl. ""B"" 2"';
  const parsed = parseCSV(csvSample);
  if (parsed.length !== 3) throw new Error("parseCSV baris salah: " + parsed.length);
  if (parsed[1][0] !== "Budi" || parsed[1][1] !== "Jl. A, No 1") throw new Error("parseCSV koma gagal");
  if (parsed[2][1] !== 'Jl. "B" 2') throw new Error("parseCSV quote escape gagal");

  // ===== MODUL KEGIATAN (baca spreadsheet kegiatan — data ASLI 35 kegiatan) =====
  await loadKegiatan(true);
  console.log("KEG.mode =", KEG.mode, "| total kegiatan:", KEG.list.length);
  if (KEG.mode !== "csv") throw new Error("harus mode csv (gasUrl kosong, baca CSV spreadsheet)");
  if (KEG.list.length < 30) throw new Error("arsip kegiatan kurang: " + KEG.list.length);

  // Verifikasi kolom & data (menggunakan alias mapping)
  if (!kegCol("id")) throw new Error("kolom ID tidak terpetakan");
  if (!kegCol("nama")) throw new Error("kolom Nama Kegiatan tidak terpetakan");
  if (!kegCol("progres")) throw new Error("kolom Progres tidak terpetakan");
  const kegSample = KEG.list.find((r) => kegVal(r, "id") === "FAST-20260623-001");
  if (!kegSample) throw new Error("FAST-20260623-001 tidak ditemukan");
  if (!kegVal(kegSample, "nama").includes("SMA Negeri 16")) throw new Error("nama kegiatan salah");
  if (kegVal(kegSample, "progres") !== "Selesai") throw new Error("progres salah");

  // KPI
  renderKegKpi();
  if (!$("#kegKpi").innerHTML.includes("Total Kegiatan")) throw new Error("kegKpi missing");
  if (!$("#kegKpi").innerHTML.includes(">" + KEG.list.length + "<")) throw new Error("kegKpi count salah");

  renderKegCharts();
  renderKegTable();
  if (!$("#kegTbody").innerHTML.includes("Sosialisasi")) throw new Error("kegTbody tidak menampilkan kegiatan");
  // Halaman 1 = bulan terbaru (sort desc). Kolom Bulan harus tampil jelas (contoh: Juli 2026)
  if (!$("#kegTbody").innerHTML.includes("Juli 2026")) throw new Error("kolom Bulan kosong — Juli 2026 tidak tampil");
  if (!$("#kegTbody").innerHTML.includes("FAST-20260723-002")) throw new Error("ID kegiatan halaman 1 tidak tampil");
  // FAST-20260623-001 (April 2026) harus ada di data penuh
  if (!kegFiltered().some((r) => kegVal(r, "id") === "FAST-20260623-001")) throw new Error("FAST-20260623-001 tidak ada di data");

  // Filter progres
  kegState.progres = "Selesai"; renderKegTable();
  const nSelesai = KEG.list.filter((r) => kegVal(r, "progres") === "Selesai").length;
  if (kegFiltered().length !== nSelesai) throw new Error("filter selesai gagal: " + kegFiltered().length + " vs " + nSelesai);
  if (nSelesai >= KEG.list.length) throw new Error("harus ada kegiatan bukan Selesai");
  if (!$("#kegTbody").innerHTML.includes("FAST-20260723-002")) throw new Error("filter selesai: ID Juli tidak tampil");
  kegState.progres = "";

  // Filter program
  kegState.program = "Sosialisasi PMB"; renderKegTable();
  if (kegFiltered().length < 1) throw new Error("filter program gagal");
  kegState.program = "";

  // Export
  if (kegFiltered().length !== KEG.list.length) throw new Error("kegFiltered salah");

  // Ringkasan kegiatan di halaman Dashboard
  renderDashKeg();
  if (!$("#dashKegKpi").innerHTML.includes("Total Kegiatan")) throw new Error("dashKegKpi missing");
  if (!$("#dashKegKpi").innerHTML.includes(">" + KEG.list.length + "<")) throw new Error("dashKegKpi count salah");
  if (!$("#dashKegTable tbody").innerHTML.includes("Sosialisasi")) throw new Error("dashKegTable tidak menampilkan kegiatan");

  // Simulasi submit (tanpa backend → tersimpan ke overlay.created)
  const f = (id, v) => { const el = document.getElementById(id); el.value = v; return el; };
  f("kegNama", "Seminar AI 2026");
  f("kegProgres", "Selesai");
  f("kegTanggal", "2026-08-25");
  f("kegProgram", "Penelitian");
  f("kegBulanLaporan", "Agustus");
  f("kegTahunLaporan", "2026");
  f("kegPic", "Dr. Andi");
  f("kegPrioritas", "Tinggi");
  f("kegTarget", "Publikasi jurnal");
  const evt = { preventDefault(){} };
  await submitKegiatan(evt);
  let ovKeg = JSON.parse(localStorageStub.getItem("fast_kegiatan_overlay_v1"));
  if (!ovKeg || !ovKeg.created || ovKeg.created.length !== 1) throw new Error("overlay kegiatan tidak tersimpan");
  if (kegVal(ovKeg.created[0], "nama") !== "Seminar AI 2026") throw new Error("nama kegiatan lokal salah");
  if (!KEG.list.some((r) => kegVal(r, "nama") === "Seminar AI 2026")) throw new Error("kegiatan baru tidak tampil di list");

  // ===== CRUD KEGIATAN =====
  // Edit baris dari spreadsheet (FAST-20260723-002)
  const target = KEG.list.find((r) => kegVal(r, "id") === "FAST-20260723-002");
  if (!target) throw new Error("baris FAST-20260723-002 tidak ditemukan untuk edit");
  const tkey = target.__key;
  editKegiatan(tkey);
  if (kegEditingKey !== tkey) throw new Error("mode edit tidak aktif");
  if (!document.getElementById("kegNama").value) throw new Error("form tidak terisi saat edit");
  f("kegNama", "Penerbitan Jurnal IKM DIMA — EDITED");
  f("kegProgres", "Selesai");
  await submitKegiatan(evt);
  ovKeg = JSON.parse(localStorageStub.getItem("fast_kegiatan_overlay_v1"));
  if (!ovKeg.edited || !ovKeg.edited[tkey]) throw new Error("overlay edited tidak tersimpan");
  if (kegEditingKey !== null) throw new Error("mode edit tidak direset setelah simpan");
  if (!KEG.list.find((r) => r.__key === tkey && kegVal(r, "nama").includes("EDITED"))) throw new Error("edit tidak tampil di list");

  // Hapus baris hasil buat lokal (Seminar AI 2026)
  const createdRow = KEG.list.find((r) => kegVal(r, "nama") === "Seminar AI 2026");
  if (!createdRow) throw new Error("baris baru tidak ditemukan untuk hapus");
  deleteKegiatan(createdRow.__key);
  await loadKegiatan(true);
  if (KEG.list.some((r) => kegVal(r, "nama") === "Seminar AI 2026")) throw new Error("hapus kegiatan gagal");

  // ===== CRUD PENDAFTAR =====
  // Tambah
  openPendModal("add", null);
  if (document.getElementById("pendFormFields").innerHTML.indexOf("pend_nama") < 0) throw new Error("field modal tidak digenerate");
  f("pend_nama", "Budi CRUD Test");
  f("pend_gender", "Laki-laki");
  f("pend_prodi", "S1 Informatika");
  f("pend_jalur", "Reguler");
  submitPendForm({ preventDefault(){} });
  await loadData(true);
  if (!RAW.list.some((r) => val(r, "nama") === "Budi CRUD Test")) throw new Error("tambah pendaftar gagal");
  const newTotal = RAW.total;
  if (newTotal !== RAW.rows.length + 1) throw new Error("RAW.total tidak bertambah: " + newTotal + " vs " + RAW.rows.length);

  // Edit pendaftar (baris dari spreadsheet: TEST TRIGGER HEADER)
  const pendRow = RAW.list.find((r) => val(r, "nama") === "TEST TRIGGER HEADER");
  if (!pendRow) throw new Error("baris TEST TRIGGER HEADER tidak ditemukan");
  const pkey = pendRow.__key;
  editPendaftar(pkey);
  f("pend_email", "edited@cek.com");
  submitPendForm({ preventDefault(){} });
  await loadData(true);
  const editedRow = RAW.list.find((r) => r.__key === pkey);
  if (!editedRow || val(editedRow, "email") !== "edited@cek.com") throw new Error("edit pendaftar gagal");

  // Hapus pendaftar yang baru dibuat
  const budi = RAW.list.find((r) => val(r, "nama") === "Budi CRUD Test");
  if (!budi) throw new Error("Budi CRUD Test tidak ditemukan");
  deletePendaftar(budi.__key);
  await loadData(true);
  if (RAW.list.some((r) => val(r, "nama") === "Budi CRUD Test")) throw new Error("hapus pendaftar gagal");

  console.log("CRUD OK — kegiatan: edit+hapus ✓, pendaftar: tambah+edit+hapus ✓");

  console.log("ALL TESTS PASSED ✓ — data live OK (" + RAW.total + " baris) + Kegiatan arsip OK (" + KEG.list.length + " kegiatan) + CRUD OK");

  console.log("ALL TESTS PASSED ✓ — data live OK (" + RAW.total + " baris) + Kegiatan OK");
})();
`;

vm.runInContext(test, sandbox, { filename: "test.js" }).catch((e) => {
  console.error("TEST FAIL:", e.message);
  process.exit(1);
});
