/* Headless test: Export PDF Kegiatan (jsPDF distub + fallback cetak) */
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

/* ---- Stub jsPDF + autoTable ---- */
const pdfLog = { saved: null, autoTable: null, rects: 0, texts: [] };
function JsPDFStub(opts) {
  this.opts = opts;
  this.internal = {
    pageSize: { getWidth: () => 297, getHeight: () => 210 },
    getNumberOfPages: () => 1,
  };
}
JsPDFStub.prototype.rect = function () { pdfLog.rects++; };
JsPDFStub.prototype.setFillColor = function () {};
JsPDFStub.prototype.setTextColor = function () {};
JsPDFStub.prototype.setFont = function () {};
JsPDFStub.prototype.setFontSize = function () {};
JsPDFStub.prototype.setDrawColor = function () {};
JsPDFStub.prototype.text = function (t) { pdfLog.texts.push(String(t)); };
JsPDFStub.prototype.autoTable = function (cfg) { pdfLog.autoTable = cfg; };
JsPDFStub.prototype.save = function (name) { pdfLog.saved = name; };

const sandbox = {
  document: documentStub,
  window: {
    addEventListener(){}, Chart: function(){ return { destroy(){} }; },
    URL: { createObjectURL(){ return "blob:x"; }, revokeObjectURL(){} },
    jspdf: { jsPDF: JsPDFStub },
  },
  console,
  setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
  alert(msg){ pdfLog.alerted = msg; },
  Blob: function(){},
  fetch: globalThis.fetch,
  Date, Math, JSON, Number, String, Object, Array, RegExp, isNaN,
  listeners,
  process,
  localStorage: localStorageStub,
  localStorageStub,
  Option: function(text, value) { return { text, value, selected: false }; },
  pdfLog,
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
  for (let i = 0; i < 40 && KEG.list.length === 0; i++) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (KEG.list.length < 1) throw new Error("tidak ada data kegiatan");

  // 1) Export PDF normal (jsPDF terpasang)
  exportKegPdf();
  if (!pdfLog.saved) throw new Error("doc.save tidak dipanggil");
  if (!/^monitoring-fast-kegiatan-\\d{8}-\\d{4}\\.pdf$/.test(pdfLog.saved)) throw new Error("nama file salah: " + pdfLog.saved);
  if (!pdfLog.autoTable) throw new Error("autoTable tidak dipanggil");
  if (!pdfLog.autoTable.head || !pdfLog.autoTable.head[0].includes("Nama Kegiatan")) throw new Error("header tabel PDF salah");
  if (pdfLog.autoTable.body.length !== KEG.list.length) throw new Error("baris PDF tidak lengkap: " + pdfLog.autoTable.body.length + " vs " + KEG.list.length);
  if (pdfLog.rects < 1) throw new Error("header biru tidak digambar");
  console.log("PDF OK:", pdfLog.saved, "| baris:", pdfLog.autoTable.body.length, "| kolom:", pdfLog.autoTable.head[0].length);

  // 2) PDF ikut filter aktif
  kegState.progres = "Selesai"; kegState.search = "SMA";
  exportKegPdf();
  const filtered = kegFiltered();
  if (pdfLog.autoTable.body.length !== filtered.length) throw new Error("PDF tidak mengikuti filter");
  if (!pdfLog.texts.some(t => String(t).includes("Filter:"))) throw new Error("info filter tidak tercantum");
  console.log("PDF + filter OK:", pdfLog.autoTable.body.length, "baris (filter Selesai + 'SMA')");
  kegState.progres = ""; kegState.search = "";

  // 3) Fallback cetak (jsPDF tidak tersedia)
  const realJspdf = window.jspdf;
  window.jspdf = undefined;
  let popupOpened = false;
  window.open = function () { popupOpened = true; return { document: { write(){}, close(){} }, focus(){} }; };
  exportKegPdf();
  window.jspdf = realJspdf;
  window.open = undefined;
  if (!popupOpened) throw new Error("fallback cetak tidak membuka popup");

  // 4) Data kosong → alert
  const origFiltered = kegFiltered;
  kegFiltered = () => [];
  pdfLog.alerted = null;
  exportKegPdf();
  if (!pdfLog.alerted) throw new Error("data kosong harus alert");
  kegFiltered = origFiltered;

  console.log("ALL PDF TESTS PASSED ✓");
})();
`;

vm.runInContext(test, sandbox, { filename: "test-pdf.js" }).catch((e) => {
  console.error("TEST FAIL:", e.message);
  process.exit(1);
});
