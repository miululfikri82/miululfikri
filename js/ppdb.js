/*=========================================
PPDB ONLINE - MI ULUL FIKRI
Menangani: tampilan Persyaratan & Rincian Biaya (dinamis),
rekap kuota, tabel saudara kandung, dan submit form
(termasuk upload bukti pembayaran) ke Google Apps Script.
=========================================*/

// GANTI dengan URL Web App Google Apps Script yang sama dengan di js/admin.js
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjedZtAtzXnoxqAQ7y4KY8gKa5BjH3cfPMa_otQajEE02gKADm0poUIvA3R1Wol86sXw/exec";

// GANTI dengan nomor WhatsApp admin PPDB (format: kode negara tanpa "+", contoh 62812xxxxxxx)
const ADMIN_WA_NUMBER = "6283138735745";

function formatRupiah(angka) {
    const n = Number(angka) || 0;
    return "Rp " + n.toLocaleString("id-ID");
}

// ---- Helper: kirim POST JSON ke Apps Script (menghindari CORS preflight) ----
function postAction(payload) {
    return fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
    }).then((res) => res.json());
}

/* ============ PENGATURAN PUBLIK: TAHUN AJARAN, STATUS BUKA/TUTUP, KUOTA ============ */
let pengaturanCache = null;

function muatPengaturanPublik() {
    return fetch(`${GOOGLE_SCRIPT_URL}?action=get_pengaturan`)
        .then((res) => res.json())
        .then((data) => {
            pengaturanCache = data;
            terapkanPengaturanPublik(data);
            return data;
        })
        .catch(() => { });
}

function terapkanPengaturanPublik(data) {
    if (!data) return;

    // Tahun ajaran: sinkron ke badge judul & input hidden di form
    const badge = document.getElementById("badgeTahunAjaran");
    if (badge) badge.textContent = `PPDB ${data.tahun_ajaran_aktif || ""}`;
    const inputTahun = document.querySelector('input[name="tahun_ajaran"]');
    if (inputTahun) inputTahun.value = data.tahun_ajaran_aktif || "";

    // Isi pilihan Gelombang sesuai pengaturan admin (hanya yang berstatus aktif)
    isiOpsiGelombang(data.gelombang_list || []);

    // Info kuota per kelas
    tampilkanKuotaKelas("Reguler", data.kelas.Reguler);
    tampilkanKuotaKelas("Intensif", data.kelas.Intensif);
    document.getElementById("infoKuotaWrapper").style.display = "flex";

    // Nonaktifkan opsi kelas yang kuotanya sudah penuh
    aturOpsiKelasPenuh("opsiKelasReguler", data.kelas.Reguler);
    aturOpsiKelasPenuh("opsiKelasIntensif", data.kelas.Intensif);

    // Status buka/tutup PPDB
    const formWrapper = document.getElementById("ppdbFormWrapper");
    const tutupNotice = document.getElementById("ppdbTutupNotice");
    if (data.status_ppdb !== "Buka") {
        if (formWrapper) formWrapper.style.display = "none";
        if (tutupNotice) tutupNotice.style.display = "flex";
    } else {
        if (formWrapper) formWrapper.style.display = "flex";
        if (tutupNotice) tutupNotice.style.display = "none";
    }
}

// Isi <select name="gelombang"> dari daftar gelombang yang diatur admin.
// Hanya gelombang berstatus aktif yang ditampilkan sebagai pilihan.
function isiOpsiGelombang(gelombangList) {
    const sel = document.getElementById("gelombangPilihan");
    if (!sel) return;
    const nilaiTerpilih = sel.value;
    const aktifSaja = gelombangList.filter((g) => g.aktif);
    sel.innerHTML = '<option value="" selected disabled>Pilih gelombang</option>' +
        aktifSaja
            .map((g) => `<option value="${g.nama}">${g.nama}${g.periode ? ` (${g.periode})` : ""}</option>`)
            .join("");
    if (aktifSaja.some((g) => g.nama === nilaiTerpilih)) sel.value = nilaiTerpilih;
}

function tampilkanKuotaKelas(nama, info) {
    if (!info) return;
    const progress = document.getElementById(`progress${nama}`);
    const teks = document.getElementById(`teksKuota${nama}`);
    if (!progress || !teks) return;

    const persen = info.kuota > 0 ? Math.min(100, Math.round((info.terisi / info.kuota) * 100)) : 0;
    progress.style.width = persen + "%";
    progress.className = "progress-bar " + (persen >= 100 ? "bg-danger" : persen >= 80 ? "bg-warning" : "bg-success");

    if (info.kuota > 0 && info.terisi >= info.kuota) {
        teks.innerHTML = `<span class="badge bg-danger">Kuota Penuh</span> (${info.terisi}/${info.kuota})`;
    } else {
        teks.textContent = `${info.terisi} / ${info.kuota} terisi`;
    }
}

function aturOpsiKelasPenuh(idOpsi, info) {
    const opsi = document.getElementById(idOpsi);
    if (!opsi || !info) return;
    const penuh = info.kuota > 0 && info.terisi >= info.kuota;
    opsi.disabled = penuh;
    if (penuh && !opsi.textContent.includes("(Kuota Penuh)")) {
        opsi.textContent += " - Kuota Penuh";
    }
}

/* ============ PERSYARATAN & RINCIAN BIAYA (PUBLIK) ============ */
let daftarBiayaCache = [];

function muatInfoPersyaratan() {
    const list = document.getElementById("persyaratanPublicList");
    if (!list) return;
    fetch(`${GOOGLE_SCRIPT_URL}?action=list_persyaratan`)
        .then((res) => res.json())
        .then((data) => {
            if (!data.length) {
                list.innerHTML = '<p class="text-muted mb-0">Belum ada data persyaratan.</p>';
                return;
            }
            list.innerHTML = data
                .map((d) => {
                    const items = (d.daftar_item || "").split("\n").filter(Boolean);
                    const itemsHtml = items.map((it) => `<li>${it}</li>`).join("");
                    return `
                    <div class="mb-3">
                        <span class="badge bg-success-subtle text-success mb-1">${d.jenis || "Persyaratan"}</span>
                        <h6 class="mb-1">${d.kategori}</h6>
                        <ul class="mb-0 ps-3">${itemsHtml}</ul>
                    </div>
                `;
                })
                .join("");
        })
        .catch(() => {
            list.innerHTML = '<p class="text-danger mb-0">Gagal memuat data persyaratan.</p>';
        });
}

function muatInfoBiaya() {
    const list = document.getElementById("biayaPublicList");
    fetch(`${GOOGLE_SCRIPT_URL}?action=list_biaya`)
        .then((res) => res.json())
        .then((data) => {
            daftarBiayaCache = data || [];
            if (list) {
                if (!data.length) {
                    list.innerHTML = '<p class="text-muted mb-0">Belum ada rincian biaya.</p>';
                } else {
                    list.innerHTML = data
                        .map((d) => {
                            let items = [];
                            try { items = JSON.parse(d.item_json || "[]"); } catch (e) { items = []; }
                            const itemsHtml = items
                                .map((it) => `<li class="d-flex justify-content-between"><span>${it.nama}</span><span>${formatRupiah(it.nominal)}</span></li>`)
                                .join("");
                            return `
                            <div class="mb-3">
                                <h6 class="mb-1">${d.kelas} - ${d.gelombang} ${d.periode ? `<small class="text-muted">(${d.periode})</small>` : ""}</h6>
                                <ul class="list-unstyled mb-1 ps-1">${itemsHtml}</ul>
                                <div class="fw-bold text-success">Total: ${formatRupiah(d.total)}</div>
                                ${d.biaya_bulanan ? `<div class="text-muted">${d.biaya_bulanan}</div>` : ""}
                            </div>
                        `;
                        })
                        .join("");
                }
            }
            tampilkanInfoBiayaTerpilih();
        })
        .catch(() => {
            if (list) list.innerHTML = '<p class="text-danger mb-0">Gagal memuat rincian biaya.</p>';
        });
}

// Cocokkan paket biaya dengan pilihan kelas & gelombang yang dipilih user di form,
// lalu tampilkan di #infoBiaya + perbarui hint minimal bayar (biaya formulir).
function tampilkanInfoBiayaTerpilih() {
    const kelasSel = document.getElementById("kelasPilihan");
    const gelombangSel = document.getElementById("gelombangPilihan");
    const infoBiaya = document.getElementById("infoBiaya");
    const hint = document.getElementById("buktiBayarHint");
    if (!kelasSel || !gelombangSel || !infoBiaya) return;

    const kelas = kelasSel.value;
    const gelombang = gelombangSel.value;

    if (!kelas || !gelombang) {
        infoBiaya.classList.add("d-none");
        return;
    }

    const cocok = daftarBiayaCache.find(
        (d) => d.kelas === kelas && (d.gelombang || "").trim() === gelombang
    );

    if (!cocok) {
        infoBiaya.classList.add("d-none");
        return;
    }

    const gelombangLabel = gelombangSel.options[gelombangSel.selectedIndex]?.text || gelombang;

    let items = [];
    try { items = JSON.parse(cocok.item_json || "[]"); } catch (e) { items = []; }
    const itemsHtml = items
        .map((it) => `<div class="d-flex justify-content-between"><span>${it.nama}</span><span>${formatRupiah(it.nominal)}</span></div>`)
        .join("");
    infoBiaya.innerHTML = `
        <div class="fw-bold mb-2"><i class="bi bi-info-circle-fill"></i> Rincian Biaya untuk ${kelas} - ${gelombangLabel}</div>
        ${itemsHtml}
        <hr class="my-2">
        <div class="d-flex justify-content-between fw-bold">
            <span>Total Biaya Masuk</span><span>${formatRupiah(cocok.total)}</span>
        </div>
        ${cocok.biaya_bulanan ? `<div class="mt-1">${cocok.biaya_bulanan}</div>` : ""}
    `;
    infoBiaya.classList.remove("d-none");

    // Cari item yang mengandung kata "formulir" untuk info minimal bayar
    if (hint) {
        const formulirItem = items.find((it) => /formulir/i.test(it.nama || ""));
        if (formulirItem) {
            hint.innerHTML = `Silakan transfer <strong>minimal ${formatRupiah(formulirItem.nominal)}</strong> (Biaya Formulir untuk ${kelas} - ${gelombangLabel}), lalu upload bukti transfer di sini (foto/scan, format JPG/PNG/PDF, maks. 5MB).`;
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {
    muatPengaturanPublik();
    muatInfoPersyaratan();
    muatInfoBiaya();

    const kelasSel = document.getElementById("kelasPilihan");
    const gelombangSel = document.getElementById("gelombangPilihan");
    if (kelasSel) kelasSel.addEventListener("change", tampilkanInfoBiayaTerpilih);
    if (gelombangSel) gelombangSel.addEventListener("change", tampilkanInfoBiayaTerpilih);

    // preview nama file bukti bayar yang dipilih
    const buktiInput = document.getElementById("buktiBayarInput");
    if (buktiInput) {
        buktiInput.addEventListener("change", function () {
            const preview = document.getElementById("buktiBayarPreview");
            if (!preview) return;
            if (this.files && this.files[0]) {
                const f = this.files[0];
                if (f.size > 5 * 1024 * 1024) {
                    preview.className = "small text-danger mt-2";
                    preview.textContent = "Ukuran file terlalu besar, maksimal 5MB.";
                    this.value = "";
                    return;
                }
                preview.className = "small text-success mt-2";
                preview.textContent = `File dipilih: ${f.name} (${(f.size / 1024).toFixed(0)} KB)`;
            } else {
                preview.textContent = "";
            }
        });
    }
});

/* ============ TABEL SAUDARA KANDUNG ============ */
function tambahBarisSaudara() {
    const tbody = document.querySelector("#saudaraTable tbody");
    if (!tbody) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td><input type="text" class="form-control form-control-sm saudara-nama"></td>
        <td>
            <select class="form-select form-select-sm saudara-jk">
                <option value="L">L</option>
                <option value="P">P</option>
            </select>
        </td>
        <td><input type="text" class="form-control form-control-sm saudara-pendidikan"></td>
        <td><input type="text" class="form-control form-control-sm saudara-sekolah"></td>
        <td class="text-center">
            <button type="button" class="btn btn-sm btn-outline-danger btn-hapus-saudara"><i class="bi bi-x"></i></button>
        </td>
    `;
    tr.querySelector(".btn-hapus-saudara").addEventListener("click", () => tr.remove());
    tbody.appendChild(tr);
}

function ambilDataSaudara() {
    const rows = document.querySelectorAll("#saudaraTable tbody tr");
    const data = [];
    rows.forEach((tr) => {
        const nama = tr.querySelector(".saudara-nama")?.value.trim();
        if (!nama) return;
        data.push({
            nama: nama,
            jk: tr.querySelector(".saudara-jk")?.value || "",
            pendidikan: tr.querySelector(".saudara-pendidikan")?.value || "",
            sekolah: tr.querySelector(".saudara-sekolah")?.value || "",
        });
    });
    return data;
}

/* ============ SUBMIT FORM PPDB ============ */

// Baca file sebagai base64 (tanpa prefix "data:...;base64,")
function bacaFileBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) { resolve(""); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const ppdbForm = document.getElementById("ppdbForm");
if (ppdbForm) {
    ppdbForm.addEventListener("submit", function (e) {
        e.preventDefault();

        const statusEl = document.getElementById("ppdbStatus");
        const submitBtn = document.getElementById("ppdbSubmitBtn");
        const buktiInput = document.getElementById("buktiBayarInput");

        if (pengaturanCache && pengaturanCache.status_ppdb !== "Buka") {
            statusEl.innerHTML = '<div class="alert alert-danger mb-0">Mohon maaf, pendaftaran PPDB sedang ditutup.</div>';
            return;
        }
        const kelasDipilih = document.getElementById("kelasPilihan")?.value;
        const infoKelasDipilih = pengaturanCache && pengaturanCache.kelas && pengaturanCache.kelas[kelasDipilih];
        if (infoKelasDipilih && infoKelasDipilih.kuota > 0 && infoKelasDipilih.terisi >= infoKelasDipilih.kuota) {
            statusEl.innerHTML = `<div class="alert alert-danger mb-0">Mohon maaf, kuota kelas ${kelasDipilih} sudah penuh. Silakan pilih kelas lain.</div>`;
            return;
        }

        if (!buktiInput || !buktiInput.files || !buktiInput.files[0]) {
            statusEl.innerHTML = '<div class="alert alert-danger mb-0">Mohon upload bukti pembayaran terlebih dahulu.</div>';
            buktiInput?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        // simpan data saudara kandung ke hidden input sebelum serialize
        const saudaraField = document.getElementById("saudaraKandungData");
        if (saudaraField) saudaraField.value = JSON.stringify(ambilDataSaudara());

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Mengirim...';
        statusEl.innerHTML = '<div class="alert alert-info mb-0">Mengirim data pendaftaran, mohon tunggu...</div>';

        const formData = new FormData(ppdbForm);
        const payload = {};
        formData.forEach((value, key) => { payload[key] = value; });

        const file = buktiInput.files[0];
        bacaFileBase64(file)
            .then((base64) => {
                payload.bukti_base64 = base64;
                payload.bukti_nama = file.name;
                payload.bukti_mime = file.type;
                return postAction(payload);
            })
            .then((res) => {
                if (res && res.result === "success") {
                    const namaAnak = payload.nama || "";
                    const pesan = encodeURIComponent(
                        `Assalamu'alaikum, saya baru saja mendaftarkan ananda ${namaAnak} untuk PPDB ${payload.tahun_ajaran || ""} kelas ${payload.kelas_pilihan || ""} (${payload.gelombang || ""}). Bersama ini saya sudah upload bukti pembayaran. Mohon konfirmasinya. Terima kasih.`
                    );
                    const waUrl = `https://wa.me/${ADMIN_WA_NUMBER}?text=${pesan}`;
                    statusEl.innerHTML = `<div class="alert alert-success mb-0"><i class="bi bi-check-circle-fill"></i> Pendaftaran berhasil dikirim! Mengarahkan ke WhatsApp admin... Jika tidak otomatis terbuka, <a href="${waUrl}" target="_blank" rel="noopener">klik di sini</a>.</div>`;
                    ppdbForm.reset();
                    document.getElementById("buktiBayarPreview").textContent = "";
                    document.getElementById("infoBiaya").classList.add("d-none");
                    // Redirect langsung (bukan window.open) supaya tidak diblokir popup blocker,
                    // karena window.open setelah proses async (fetch) sering dianggap bukan aksi
                    // klik langsung oleh browser.
                    window.location.href = waUrl;
                } else {
                    statusEl.innerHTML = `<div class="alert alert-danger mb-0">Gagal mengirim data: ${(res && res.message) || "Terjadi kesalahan, silakan coba lagi."}</div>`;
                }
            })
            .catch(() => {
                statusEl.innerHTML = '<div class="alert alert-danger mb-0">Gagal mengirim data. Periksa koneksi internet lalu coba lagi.</div>';
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-send-fill"></i> Daftar Sekarang';
            });
    });
}