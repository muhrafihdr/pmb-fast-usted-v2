/* Test jalur cloud: server lokal meniru Apps Script (getKegiatan + doPost) */
const fs = require("fs");
const vm = require("vm");
const http = require("http");

const STORE = { kegiatan: [] };

// Server tiruan Apps Script
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "GET" && url.searchParams.get("action") === "getKegiatan") {
    res.end(JSON.stringify({ ok: true, total: STORE.kegiatan.length,
      headers: ["Timestamp","Nama Kegiatan","Tanggal Kegiatan","Kategori","Penanggung Jawab","Tempat","Jumlah Peserta","Deskripsi","Status","Link Dokumentasi"],
      rows: STORE.kegiatan }));
    return;
  }
  if (req.method === "POST") {
    let body = "";
    req.on("data", (c) => body += c);
    req.on("end", () => {
      const data = JSON.parse(body);
      STORE.kegiatan.push({
        Timestamp: "2026-08-26T10:00:00.000Z",
        "Nama Kegiatan": data.namaKegiatan,
        "Tanggal Kegiatan": data.tanggalKegiatan,
        Kategori: data.kategori,
        "Penanggung Jawab": data.pic,
        Tempat: data.tempat,
        "Jumlah Peserta": data.jumlahPeserta,
        Deskripsi: data.deskripsi,
        Status: data.status,
        "Link Dokumentasi": data.linkDokumentasi,
      });
      res.end(JSON.stringify({ status: "success", message: "Kegiatan berhasil dicatat." }));
    });
    return;
  }
  res.end(JSON.stringify({ ok: false, error: "not found" }));
});

function makeEl(id) {
  return {
    id, hidden:false, value:"", dataset:{}, innerHTML:"", textContent:"",
    classList:{ add(){},remove(){},toggle(){} }, style:{}, addEventListener(){},
    querySelector(){ return makeEl("child"); }, querySelectorAll(){ return []; },
    appendChild(){}, removeChild(){}, closest(){ return null; }, getContext(){ return {}; },
    focus(){}, scrollIntoView(){}, reset(){},
  };
}

server.listen(0, async () => {
  const port = server.address().port;
  const els = {}; const listeners = {}; const store = {};
  const documentStub = {
    getElementById(id){ if(!els[id]) els[id]=makeEl(id); return els[id]; },
    querySelector(sel){ const id=String(sel).replace(/^#/,""); if(!els[id]) els[id]=makeEl(id); return els[id]; },
    querySelectorAll(){ return []; }, createElement(){ return makeEl("dyn"); },
    addEventListener(ev,cb){ listeners[ev]=cb; }, body:{ appendChild(){}, removeChild(){} },
  };
  const sandbox = {
    document: documentStub,
    window: { addEventListener(){}, MONITORING_CONFIG: { gasUrl: "http://localhost:" + port + "/exec" },
              Chart: function(){ return { destroy(){} }; },
              URL:{ createObjectURL(){return "x";}, revokeObjectURL(){} } },
    console, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, alert(){},
    Blob: function(){}, fetch: globalThis.fetch,
    Date, Math, JSON, Number, String, Object, Array, RegExp, isNaN, listeners, process,
    localStorage: { getItem:(k)=>store[k]||null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:(k)=>{delete store[k];} },
    Option: function(t,v){ return { text:t, value:v, selected:false }; },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("monitoring/script.js","utf8"), sandbox);
  vm.runInContext(`
(async () => {
  listeners["DOMContentLoaded"]();
  for (let i = 0; i < 40 && RAW.total === 0; i++) await new Promise(r => setTimeout(r, 100));
  await loadKegiatan(true);
  if (KEG.local) throw new Error("harus mode cloud dengan gasUrl");

  // Submit via cloud
  const f = (id, v) => { document.getElementById(id).value = v; };
  f("kegNama","Workshop IoT"); f("kegTanggal","2026-08-26"); f("kegKategori","Pelatihan & Workshop");
  f("kegPic","Dr. Budi"); f("kegTempat","Lab Komputer"); f("kegPeserta","30");
  f("kegStatus","Selesai"); f("kegDeskripsi","Workshop Internet of Things"); f("kegLink","https://x");
  await submitKegiatan({ preventDefault(){} });

  if (KEG.local) throw new Error("setelah submit harus tetap cloud");
  if (KEG.list.length !== 1) throw new Error("data cloud tidak muncul: " + KEG.list.length);
  if (KEG.list[0]["Nama Kegiatan"] !== "Workshop IoT") throw new Error("nama salah");
  if (!document.getElementById("kegMode").textContent.includes("spreadsheet")) throw new Error("badge cloud salah");

  renderKegKpi(); renderKegCharts(); renderKegTable();
  if (!$("#kegTbody").innerHTML.includes("Workshop IoT")) throw new Error("tabel cloud kosong");

  console.log("CLOUD TEST PASSED ✓ — mode cloud + POST + GET berfungsi");
})();
`, sandbox).catch(e => {
  console.error("CLOUD TEST FAIL:", e.message);
  server.close(); process.exit(1);
}).finally(() => { setTimeout(() => { server.close(); }, 200); });
});
