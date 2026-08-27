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
      headers: ["ID_Monitoring","Timestamp_Input","Bulan_Laporan","Tahun_Laporan","Periode","Program_Studi","Program","Kegiatan","Progres","Tindak_Lanjut","Target","Status_Target","Prioritas","Penanggung_Jawab","Hasil_Output","Catatan","Evaluasi_Feedback","Updated_At"],
      rows: STORE.kegiatan }));
    return;
  }
  if (req.method === "POST") {
    let body = "";
    req.on("data", (c) => body += c);
    req.on("end", () => {
      const data = JSON.parse(body);
      STORE.kegiatan.push({
        ID_Monitoring: data.idMonitoring || "FAST-TEST-001",
        Timestamp_Input: "2026-08-26T10:00:00.000Z",
        Bulan_Laporan: data.bulanLaporan || "Agustus",
        Tahun_Laporan: data.tahunLaporan || "2026",
        Periode: data.periode || "Bulanan",
        Program_Studi: data.programStudi || "Program Studi Digabung",
        Program: data.program || "",
        Kegiatan: data.namaKegiatan,
        Progres: data.progres,
        Tindak_Lanjut: data.tindakLanjut || "",
        Target: data.target || "",
        Status_Target: data.statusTarget || "",
        Prioritas: data.prioritas || "",
        Penanggung_Jawab: data.pic || "",
        Hasil_Output: data.hasilOutput || "",
        Catatan: data.catatan || "",
        Evaluasi_Feedback: data.evaluasiFeedback || "",
        Updated_At: "2026-08-26T10:00:00.000Z",
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
  f("kegProgram","Pelatihan"); f("kegProgres","Selesai");
  f("kegPic","Dr. Budi"); f("kegTempat","Lab Komputer"); f("kegPeserta","30");
  f("kegPrioritas","Tinggi"); f("kegBulanLaporan","Agustus"); f("kegTahunLaporan","2026");
  f("kegTarget","Publikasi"); f("kegStatusTarget","Tercapai");
  f("kegTindakLanjut","Follow up"); f("kegHasilOutput","https://x");
  f("kegDeskripsi","Workshop Internet of Things"); f("kegEvaluasi","Bagus"); f("kegLink","https://x");
  await submitKegiatan({ preventDefault(){} });

  if (KEG.local) throw new Error("setelah submit harus tetap cloud");
  if (KEG.list.length !== 1) throw new Error("data cloud tidak muncul: " + KEG.list.length);
  if (kegVal(KEG.list[0], "nama") !== "Workshop IoT") throw new Error("nama salah");
  if (kegVal(KEG.list[0], "progres") !== "Selesai") throw new Error("progres salah");
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
