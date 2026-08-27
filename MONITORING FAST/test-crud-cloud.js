/* Test CRUD cloud penuh: mock Apps Script (ping/getAll/getKegiatan + POST
   create/update/delete untuk Kegiatan & Pendaftar) — meniru Code.gs baru. */
const fs = require("fs");
const vm = require("vm");
const http = require("http");

const PMB_HEADERS = ["Timestamp","Nama Lengkap","NIK","Tempat Lahir","Tanggal Lahir","Jenis Kelamin","Email","No HP/WA","Alamat","Provinsi","Kota/Kabupaten","Kecamatan","Kelurahan/Desa","Kode Pos","Asal Sekolah","Jurusan","Tahun Lulus","Jalur Pendaftaran","Program Studi"];
const KEG_HEADERS = ["ID_Monitoring","Timestamp_Input","Bulan_Laporan","Tahun_Laporan","Periode","Program_Studi","Program","Kegiatan","Progres","Tindak_Lanjut","Target","Status_Target","Prioritas","Penanggung_Jawab","Hasil_Output","Catatan","Evaluasi_Feedback","Updated_At"];

const STORE = {
  pmb: [{ "Timestamp":"23/06/2026 21:00:42", "Nama Lengkap":"TEST TRIGGER HEADER", "Email":"asli@cek.com", "Program Studi":"S1 Informatika", "Jalur Pendaftaran":"Reguler" }],
  keg: [{ "ID_Monitoring":"FAST-20260723-002", "Timestamp_Input":"23/07/2026 10:00:00", "Bulan_Laporan":"Juli", "Tahun_Laporan":"2026", "Periode":"Bulanan", "Program_Studi":"Program Studi Digabung", "Program":"Sosialisasi PMB", "Kegiatan":"Sosialisasi dan Kerjasama Dengan SMA Negeri 16 Semarang", "Progres":"Selesai", "Tindak_Lanjut":"Follow up", "Target":"Kerjasama", "Status_Target":"Tercapai", "Prioritas":"Tinggi", "Penanggung_Jawab":"Admin FAST", "Hasil_Output":"", "Catatan":"", "Evaluasi_Feedback":"", "Updated_At":"" }],
};

// Mock server Apps Script (meniru Code.gs versi CRUD)
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "GET") {
    const a = url.searchParams.get("action");
    if (a === "ping") return res.end(JSON.stringify({ ok: true, pong: true }));
    if (a === "getKegiatan") return res.end(JSON.stringify({ ok: true, total: STORE.keg.length, headers: KEG_HEADERS, rows: STORE.keg }));
    if (a === "getAll") return res.end(JSON.stringify({ ok: true, total: STORE.pmb.length, headers: PMB_HEADERS, rows: STORE.pmb }));
    return res.end(JSON.stringify({ ok: false, error: "not found" }));
  }
  if (req.method === "POST") {
    let body = "";
    req.on("data", (c) => body += c);
    req.on("end", () => {
      const d = JSON.parse(body);
      if (d._tipe === "kegiatan") {
        if (d._aksi === "delete") {
          STORE.keg = STORE.keg.filter((r) => r.ID_Monitoring !== d._key);
          return res.end(JSON.stringify({ status: "success" }));
        }
        if (d._aksi === "update") {
          const idx = STORE.keg.findIndex((r) => r.ID_Monitoring === d._key);
          if (idx < 0) return res.end(JSON.stringify({ status: "error", message: "tidak ditemukan" }));
          STORE.keg[idx] = { ...STORE.keg[idx], Kegiatan: d.namaKegiatan, Progres: d.progres, Program: d.program, Bulan_Laporan: d.bulanLaporan, Tahun_Laporan: d.tahunLaporan, Penanggung_Jawab: d.pic, Prioritas: d.prioritas, Target: d.target, Status_Target: d.statusTarget, Tindak_Lanjut: d.tindakLanjut, Hasil_Output: d.hasilOutput, Catatan: d.catatan, Evaluasi_Feedback: d.evaluasiFeedback };
          return res.end(JSON.stringify({ status: "success" }));
        }
        STORE.keg.push({ ID_Monitoring: "FAST-TEST-001", Timestamp_Input: "2026-08-26T10:00:00.000Z", Bulan_Laporan: d.bulanLaporan || "", Tahun_Laporan: d.tahunLaporan || "", Periode: d.periode || "Bulanan", Program_Studi: d.programStudi || "Program Studi Digabung", Program: d.program || "", Kegiatan: d.namaKegiatan, Progres: d.progres, Tindak_Lanjut: d.tindakLanjut || "", Target: d.target || "", Status_Target: d.statusTarget || "", Prioritas: d.prioritas || "", Penanggung_Jawab: d.pic || "", Hasil_Output: d.hasilOutput || "", Catatan: d.catatan || "", Evaluasi_Feedback: d.evaluasiFeedback || "", Updated_At: "" });
        return res.end(JSON.stringify({ status: "success" }));
      }
      if (d._tipe === "pendaftar") {
        if (d._aksi === "delete") {
          STORE.pmb = STORE.pmb.filter((r) => String(r.Timestamp).trim() !== String(d._key).trim());
          return res.end(JSON.stringify({ status: "success" }));
        }
        if (d._aksi === "update") {
          const idx = STORE.pmb.findIndex((r) => String(r.Timestamp).trim() === String(d._key).trim());
          if (idx < 0) return res.end(JSON.stringify({ status: "error", message: "tidak ditemukan" }));
          const updated = {};
          PMB_HEADERS.forEach((h) => { updated[h] = (d[h] !== undefined && d[h] !== "") ? d[h] : STORE.pmb[idx][h]; });
          STORE.pmb[idx] = updated;
          return res.end(JSON.stringify({ status: "success" }));
        }
        const row = {};
        PMB_HEADERS.forEach((h) => { row[h] = d[h] !== undefined ? d[h] : ""; });
        STORE.pmb.push(row);
        return res.end(JSON.stringify({ status: "success" }));
      }
      res.end(JSON.stringify({ status: "error", message: "tipe tidak dikenal" }));
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
    window: { addEventListener(){}, MONITORING_CONFIG: { type:"apps-script", sheetId:"", gasUrl: "http://localhost:" + port + "/exec" },
              Chart: function(){ return { destroy(){} }; },
              URL:{ createObjectURL(){return "x";}, revokeObjectURL(){} } },
    console, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    alert(){}, confirm: () => true,
    Blob: function(){}, fetch: globalThis.fetch,
    Date, Math, JSON, Number, String, Object, Array, RegExp, isNaN, listeners, process,
    localStorage: { getItem:(k)=>store[k]||null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:(k)=>{delete store[k];} },
    Option: function(t,v){ return { text:t, value:v, selected:false }; },
    STORE, server,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("monitoring/script.js","utf8"), sandbox);

  vm.runInContext(`
(async () => {
  listeners["DOMContentLoaded"]();
  for (let i = 0; i < 40 && !backendPendReady; i++) await new Promise(r => setTimeout(r, 100));
  if (!backendPendReady) throw new Error("backendPendReady tidak aktif setelah probe");
  if (!backendKegReady) throw new Error("backendKegReady tidak aktif setelah probe");
  await loadData(true);
  await loadKegiatan(true);
  if (RAW.total !== 1) throw new Error("getAll mock gagal: " + RAW.total);
  if (KEG.list.length !== 1) throw new Error("getKegiatan mock gagal: " + KEG.list.length);
  if (KEG.mode !== "cloud") throw new Error("harus cloud mode");
  if (RAW.list.some(r => val(r,"nama") !== "TEST TRIGGER HEADER")) throw new Error("data PMB salah");

  // ===== PENDAFTAR: create via backend =====
  openPendModal("add", null);
  const f = (id, v) => { const el = document.getElementById(id); el.value = v; return el; };
  f("pend_nama", "Budi Cloud Test"); f("pend_gender", "Laki-laki"); f("pend_prodi", "S1 Informatika"); f("pend_jalur", "Reguler"); f("pend_email", "budi@cek.com");
  await submitPendForm({ preventDefault(){} });
  await loadData(true);
  if (STORE.pmb.length !== 2) throw new Error("pendaftar tidak ditulis ke backend: " + STORE.pmb.length);
  if (!RAW.list.some(r => val(r,"nama") === "Budi Cloud Test")) throw new Error("Budi Cloud Test tidak tampil");
  // tidak boleh ada duplikat di overlay
  const ovP = JSON.parse(localStorage.getItem("fast_pendaftar_overlay_v1") || "{}");
  if ((ovP.created || []).length) throw new Error("overlay created tidak boleh ada saat backend aktif");

  // ===== PENDAFTAR: update via backend =====
  const budi = RAW.list.find(r => val(r,"nama") === "Budi Cloud Test");
  editPendaftar(budi.__key);
  f("pend_email", "budi2@cek.com");
  await submitPendForm({ preventDefault(){} });
  await loadData(true);
  const budi2 = STORE.pmb.find(r => r["Nama Lengkap"] === "Budi Cloud Test");
  if (!budi2 || budi2.Email !== "budi2@cek.com") throw new Error("update pendaftar gagal di backend");

  // ===== PENDAFTAR: delete via backend =====
  const budi3 = RAW.list.find(r => val(r,"nama") === "Budi Cloud Test");
  await deletePendaftar(budi3.__key);
  await loadData(true);
  if (STORE.pmb.some(r => r["Nama Lengkap"] === "Budi Cloud Test")) throw new Error("delete pendaftar gagal di backend");

  // ===== KEGIATAN: create via backend =====
  f("kegNama","Workshop IoT Cloud"); f("kegTanggal","2026-08-26"); f("kegKategori","Pelatihan & Workshop");
  f("kegProgram","Pelatihan"); f("kegProgres","Selesai"); f("kegPic","Dr. Budi");
  f("kegTempat","Lab Komputer"); f("kegPeserta","30"); f("kegPrioritas","Tinggi");
  f("kegBulanLaporan","Agustus"); f("kegTahunLaporan","2026"); f("kegTarget","Publikasi");
  f("kegStatusTarget","Tercapai"); f("kegTindakLanjut","Follow up"); f("kegHasilOutput","https://x");
  f("kegDeskripsi","Workshop IoT"); f("kegEvaluasi","Bagus"); f("kegLink","https://x");
  await submitKegiatan({ preventDefault(){} });
  await loadKegiatan(true);
  if (STORE.keg.length !== 2) throw new Error("kegiatan tidak ditulis ke backend: " + STORE.keg.length);
  if (!KEG.list.some(r => kegVal(r,"nama") === "Workshop IoT Cloud")) throw new Error("kegiatan cloud tidak tampil");

  // ===== KEGIATAN: update via backend =====
  const kegRow = KEG.list.find(r => kegVal(r,"nama") === "Workshop IoT Cloud");
  editKegiatan(kegRow.__key);
  if (kegEditingKey !== kegRow.__key) throw new Error("edit mode tidak aktif");
  f("kegNama", "Workshop IoT Cloud — EDITED");
  await submitKegiatan({ preventDefault(){} });
  await loadKegiatan(true);
  if (!STORE.keg.some(r => r.Kegiatan === "Workshop IoT Cloud — EDITED")) throw new Error("update kegiatan gagal di backend");

  // ===== KEGIATAN: delete via backend =====
  const kegRow2 = KEG.list.find(r => kegVal(r,"nama") === "Workshop IoT Cloud — EDITED");
  await deleteKegiatan(kegRow2.__key);
  await loadKegiatan(true);
  if (STORE.keg.some(r => r.Kegiatan === "Workshop IoT Cloud — EDITED")) throw new Error("delete kegiatan gagal di backend");

  console.log("CRUD CLOUD TEST PASSED ✓ — pendaftar & kegiatan create/update/delete via backend");
  server.close();
})().catch(e => { console.error("CRUD CLOUD TEST FAIL:", e.message); server.close(); process.exit(1); });
`, sandbox);
});
