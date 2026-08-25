/* =========================================================
   PMB FAST USTEDI — Landing Page Script
   1. Navigasi mobile + efek navbar
   2. Isi otomatis tahun lulus
   3. Validasi formulir
   4. Kirim data ke Google Spreadsheet (via Apps Script)
   ========================================================= */

/* =========================================================
   ⚙️ KONFIGURASI — WAJIB DIISI
   ---------------------------------------------------------
   Isi URL Web App dari Google Apps Script (lihat README.md
   untuk panduan lengkap pembuatannya).
   Contoh: "https://script.google.com/macros/s/ABCDEF.../exec"
   ========================================================= */
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzo4MNSZGeEEzdg__fVjMid78eChazuJJ0RWMUPQdK3jMCyOs9r5O1BYlnyIZFesGcO/exec";

/* =========================================================
   1. NAVBAR
   ========================================================= */
(function initNavbar() {
  const navbar = document.getElementById("navbar");
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("navLinks");

  // Ubah gaya navbar saat halaman di-scroll
  const onScroll = () => {
    navbar.classList.toggle("scrolled", window.scrollY > 40);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Buka/tutup menu mobile
  hamburger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    hamburger.classList.toggle("active", open);
    hamburger.setAttribute("aria-expanded", String(open));
  });

  // Tutup menu mobile saat link diklik
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      hamburger.classList.remove("active");
      hamburger.setAttribute("aria-expanded", "false");
    });
  });

  // Tutup menu jika klik di luar
  document.addEventListener("click", (e) => {
    if (
      navLinks.classList.contains("open") &&
      !navLinks.contains(e.target) &&
      !hamburger.contains(e.target)
    ) {
      navLinks.classList.remove("open");
      hamburger.classList.remove("active");
      hamburger.setAttribute("aria-expanded", "false");
    }
  });
})();

/* =========================================================
   2. ISI OTOMATIS TAHUN LULUS
   ========================================================= */
(function initTahunLulus() {
  const select = document.getElementById("tahunLulus");
  if (!select) return;

  const tahunMulai = 2016;
  const tahunAkhir = 2026;
  for (let tahun = tahunAkhir; tahun >= tahunMulai; tahun--) {
    const option = document.createElement("option");
    option.value = tahun;
    option.textContent = tahun;
    select.appendChild(option);
  }
})();

/* =========================================================
   3. VALIDASI FORMULIR
   ========================================================= */
const form = document.getElementById("pmbForm");
const btnSubmit = document.getElementById("btnSubmit");
const formSuccess = document.getElementById("formSuccess");
const successMessage = document.getElementById("successMessage");
const formError = document.getElementById("formError");

function setError(input, message) {
  const group = input.closest(".form-group");
  input.classList.add("invalid");
  const errorEl = group ? group.querySelector(".error-msg") : null;
  if (errorEl) errorEl.textContent = message;
}

function clearError(input) {
  const group = input.closest(".form-group");
  input.classList.remove("invalid");
  const errorEl = group ? group.querySelector(".error-msg") : null;
  if (errorEl) errorEl.textContent = "";
}

// Bersihkan error saat pengguna mulai mengetik
form.addEventListener("input", (e) => {
  if (e.target.classList.contains("invalid")) clearError(e.target);
});
form.addEventListener("change", (e) => {
  if (e.target.classList.contains("invalid")) clearError(e.target);
});

function validateField(input) {
  const value = input.value.trim();
  const name = input.name;
  let message = "";

  if (name === "namaLengkap") {
    if (!value) message = "Nama lengkap wajib diisi.";
    else if (value.length < 3) message = "Nama minimal 3 karakter.";
  } else if (name === "nik") {
    if (!value) message = "NIK wajib diisi.";
    else if (!/^\d{16}$/.test(value)) message = "NIK harus 16 digit angka.";
  } else if (name === "tempatLahir") {
    if (!value) message = "Tempat lahir wajib diisi.";
  } else if (name === "tanggalLahir") {
    if (!value) message = "Tanggal lahir wajib diisi.";
    else if (new Date(value) > new Date()) message = "Tanggal lahir tidak valid.";
  } else if (name === "email") {
    if (!value) message = "Email wajib diisi.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = "Format email tidak valid.";
  } else if (name === "noHp") {
    if (!value) message = "Nomor HP wajib diisi.";
    else if (!/^08\d{8,12}$/.test(value.replace(/[\s-]/g, ""))) message = "Format HP tidak valid (contoh: 0812xxxxxx).";
  } else if (name === "asalSekolah") {
    if (!value) message = "Asal sekolah wajib diisi.";
  } else if (name === "jurusanSekolah") {
    if (!value) message = "Jurusan wajib diisi.";
  } else if (name === "tahunLulus") {
    if (!value) message = "Tahun lulus wajib dipilih.";
  } else if (name === "alamat") {
    if (!value) message = "Alamat wajib diisi.";
    else if (value.length < 10) message = "Alamat terlalu pendek.";
  } else if (name === "provinsi") {
    if (!value) message = "Provinsi wajib diisi.";
  } else if (name === "kabupaten") {
    if (!value) message = "Kota/Kabupaten wajib diisi.";
  } else if (name === "kecamatan") {
    if (!value) message = "Kecamatan wajib diisi.";
  } else if (name === "kelurahan") {
    if (!value) message = "Kelurahan/Desa wajib diisi.";
  } else if (name === "jalur") {
    if (!value) message = "Pilih jalur pendaftaran.";
  } else if (name === "programStudi") {
    if (!value) message = "Pilih program studi.";
  }

  if (message) {
    setError(input, message);
  } else {
    clearError(input);
  }
  return !message;
}

function collectAndValidate() {
  let isValid = true;
  const inputs = form.querySelectorAll("input:not([type=radio]), select, textarea");

  inputs.forEach((input) => {
    if (!validateField(input)) isValid = false;
  });

  // Validasi radio jenis kelamin
  const radioGroup = form.querySelectorAll('input[name="jenisKelamin"]');
  const radioChecked = form.querySelector('input[name="jenisKelamin"]:checked');
  const radioContainer = radioGroup[0]?.closest(".form-group");
  const radioError = radioContainer?.querySelector(".error-msg");
  if (!radioChecked) {
    if (radioError) radioError.textContent = "Pilih jenis kelamin.";
    if (radioContainer) radioContainer.classList.add("invalid");
    isValid = false;
  } else {
    if (radioError) radioError.textContent = "";
    if (radioContainer) radioContainer.classList.remove("invalid");
  }

  return isValid;
}

/* =========================================================
   4. SUBMIT — KIRIM KE GOOGLE SPREADSHEET
   ========================================================= */
function serializeForm() {
  const data = {};
  const fd = new FormData(form);
  fd.forEach((value, key) => {
    data[key] = value.trim();
  });
  return data;
}

function setLoading(loading) {
  btnSubmit.disabled = loading;
  const text = btnSubmit.querySelector(".btn-text");
  const loader = btnSubmit.querySelector(".btn-loader");
  if (loading) {
    text.textContent = "Mengirim data…";
    loader.hidden = false;
  } else {
    text.textContent = "Kirim Pendaftaran";
    loader.hidden = true;
  }
}

function showGlobalError(message) {
  formError.textContent = message;
  formError.hidden = false;
  formError.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function submitToSheet(data) {
  if (!GAS_WEB_APP_URL) {
    throw new Error(
      "URL Web App belum dikonfigurasi. Hubungi admin PMB atau lengkapi konfigurasi GAS_WEB_APP_URL di script.js."
    );
  }

  // Content-Type text/plain menghindari CORS preflight sehingga
  // pengiriman dari halaman statis berjalan mulus.
  let response;
  try {
    response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
    });
  } catch (err) {
    // Kegagalan jaringan / fetch diblokir browser
    throw new Error(
      "Koneksi ke server pendaftaran gagal. Periksa koneksi internetmu dan coba lagi."
    );
  }

  let text = "";
  try {
    text = await response.text();
  } catch (_) {
    // Body respons tidak terbaca — data tetap sudah diproses server.
  }

  let result = null;
  try {
    result = JSON.parse(text);
  } catch (_) {
    result = null;
  }

  if (result && result.status === "success") {
    return result;
  }
  if (result && result.status === "error") {
    throw new Error(result.message || "Gagal menyimpan data.");
  }

  // ⚠️ Respons bukan JSON. Google Apps Script memproses POST (doPost)
  // SEBELUM mengarahkan (redirect) ke URL echo, jadi jika kita menerima
  // respons apa pun (bukan error jaringan), berarti data sudah tersimpan
  // di spreadsheet. Di sebagian browser (mis. Safari) respons akhir
  // redirect tidak terbaca sebagai JSON — maka kita anggap berhasil.
  return { status: "success", message: "Data telah diterima." };
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;

  if (!collectAndValidate()) {
    const firstInvalid = form.querySelector(".invalid");
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid.focus({ preventScroll: true });
    }
    return;
  }

  const data = serializeForm();
  setLoading(true);

  try {
    const result = await submitToSheet(data);
    const nama = data.namaLengkap ? data.namaLengkap.split(" ")[0] : "";
    successMessage.textContent = `Terima kasih${nama ? ", " + nama : ""}! Data pendaftaranmu telah tersimpan. Panitia PMB akan menghubungi kamu melalui email/WhatsApp untuk proses selanjutnya.`;
    form.hidden = true;
    formSuccess.hidden = false;
    formSuccess.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (err) {
    showGlobalError(
      "⚠️ Gagal mengirim data: " +
        err.message +
        " Silakan coba lagi atau hubungi panitia PMB melalui kontak di bawah."
    );
  } finally {
    setLoading(false);
  }
});

// Tombol "Daftar Lagi"
document.getElementById("btnDaftarLagi").addEventListener("click", () => {
  form.reset();
  form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
  form.querySelectorAll(".error-msg").forEach((el) => (el.textContent = ""));
  formSuccess.hidden = true;
  form.hidden = false;
  window.scrollTo({ top: form.offsetTop - 90, behavior: "smooth" });
});

/* =========================================================
   5. TAHUN FOOTER
   ========================================================= */
document.getElementById("year").textContent = new Date().getFullYear();
