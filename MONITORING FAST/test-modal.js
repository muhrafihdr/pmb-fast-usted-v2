/* Headless test: modal CRUD terbuka/tutup dengan benar (bug backdrop saat load) */
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
// Atribut hidden awal sesuai HTML (modal & banner edit tersembunyi saat load)
els["modalBackdrop"] = makeEl("modalBackdrop"); els["modalBackdrop"].hidden = true;
els["kegEditBanner"] = makeEl("kegEditBanner"); els["kegEditBanner"].hidden = true;
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
  for (let i = 0; i < 40 && RAW.total === 0; i++) {
    await new Promise(r => setTimeout(r, 100));
  }
  for (let i = 0; i < 40 && KEG.list.length === 0; i++) {
    await new Promise(r => setTimeout(r, 100));
  }

  // 1) Saat halaman dibuka, modal & banner HARUS tersembunyi
  if (!document.getElementById("modalBackdrop").hidden) throw new Error("BUG: modalBackdrop tampil saat halaman dibuka");
  if (!document.getElementById("kegEditBanner").hidden) throw new Error("BUG: kegEditBanner tampil saat halaman dibuka");
  console.log("OK: modal & banner tersembunyi saat halaman dibuka");

  // 2) Buka modal tambah pendaftar
  openPendModal("add", null);
  if (document.getElementById("modalBackdrop").hidden) throw new Error("modal tidak terbuka");
  if (!document.getElementById("pendFormFields").innerHTML.includes("pend_nama")) throw new Error("field tidak digenerate");
  if (!document.getElementById("pendFormFields").innerHTML.includes("pend_prodi")) throw new Error("dropdown prodi tidak ada");
  console.log("OK: modal terbuka, field lengkap");

  // 3) Tutup modal
  closePendModal();
  if (!document.getElementById("modalBackdrop").hidden) throw new Error("modal tidak tertutup");
  console.log("OK: modal tertutup");

  // 4) Edit kegiatan -> banner tampil, batal -> hilang
  const t = KEG.list.find((r) => kegVal(r, "id") === "FAST-20260723-002");
  if (!t) throw new Error("baris target tidak ditemukan");
  editKegiatan(t.__key);
  if (document.getElementById("kegEditBanner").hidden) throw new Error("banner edit tidak tampil");
  resetKegForm();
  if (!document.getElementById("kegEditBanner").hidden) throw new Error("banner edit tidak hilang setelah batal");
  console.log("OK: banner edit tampil & hilang sesuai");

  console.log("ALL MODAL TESTS PASSED ✓");
})();
`;

vm.runInContext(test, sandbox, { filename: "test-modal.js" }).catch((e) => {
  console.error("TEST FAIL:", e.message);
  process.exit(1);
});
