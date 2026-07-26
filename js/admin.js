/*=========================================
ADMIN PANEL - MI ULUL FIKRI
=========================================*/

// GANTI URL & PASSWORD INI
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjedZtAtzXnoxqAQ7y4KY8gKa5BjH3cfPMa_otQajEE02gKADm0poUIvA3R1Wol86sXw/exec";
const ADMIN_PASSWORD = "web-miyufi_82";

function cekPassword() {
    const input = document.getElementById("adminPassword").value;
    if (input === ADMIN_PASSWORD) {
        // pakai setProperty(...,"important") karena loginGate punya class
        // Bootstrap "d-flex" yang menerapkan display:flex !important, sehingga
        // style.display biasa tidak cukup kuat untuk menyembunyikannya.
        document.getElementById("loginGate").style.setProperty("display", "none", "important");
        document.getElementById("adminContent").style.display = "block";
        sessionStorage.setItem("admin_ok", "1");
        muatPpdb();
        muatBerita();
        muatPengumuman();
        muatBiaya();
        muatPersyaratan();
        muatPengaturanUmum();
    } else {
        document.getElementById("loginError").textContent = "Password salah.";
    }
}

// biar tidak perlu login ulang tiap reload dalam sesi yang sama
if (sessionStorage.getItem("admin_ok") === "1") {
    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("loginGate").style.setProperty("display", "none", "important");
        document.getElementById("adminContent").style.display = "block";
        muatPpdb();
        muatBerita();
        muatPengumuman();
        muatBiaya();
        muatPersyaratan();
        muatPengaturanUmum();
    });
}

// biar bisa login dengan menekan Enter, tidak harus klik tombol "Masuk"
document.addEventListener("DOMContentLoaded", () => {
    const passInput = document.getElementById("adminPassword");
    if (passInput) {
        passInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                cekPassword();
            }
        });
    }
});

// ---- Tab switching ----
document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("#adminTabs .nav-link").forEach((btn) => {
        btn.addEventListener("click", function () {
            document.querySelectorAll("#adminTabs .nav-link").forEach((b) => b.classList.remove("active"));
            document.querySelectorAll(".admin-tab").forEach((t) => (t.style.display = "none"));
            this.classList.add("active");
            document.getElementById(this.dataset.tab).style.display = "block";
        });
    });
});

// ---- Helper: kirim POST JSON ke Apps Script (menghindari CORS preflight) ----
function postAction(payload) {
    return fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
    }).then((res) => res.json());
}

/* ============ PPDB ============ */
function muatPpdb() {
    const tbody = document.getElementById("ppdbTableBody");
    fetch(`${GOOGLE_SCRIPT_URL}?action=list_ppdb`)
        .then((res) => {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then((data) => {
            if (!data.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Belum ada pendaftar.</td></tr>';
                return;
            }
            tbody.innerHTML = data
                .map((d) => `
                    <tr>
                        <td>${d.nama || "-"}</td>
                        <td>${d.kelas_pilihan || "-"} / ${d.gelombang || "-"}</td>
                        <td>${d.ayah_nama || d.ibu_nama || "-"}</td>
                        <td>${d.ibu_notelp || d.ayah_notelp || "-"}</td>
                        <td>${d.bukti_bayar_url
                        ? `<a class="btn btn-sm btn-outline-success" target="_blank" href="${d.bukti_bayar_url}"><i class="bi bi-receipt"></i> Lihat</a>`
                        : '<span class="text-muted small">Belum ada</span>'
                    }</td>
                        <td><span class="badge ${d.status === "Terverifikasi" ? "bg-success" : "bg-warning text-dark"}">${d.status || "-"}</span></td>
                        <td>${d.status !== "Terverifikasi"
                        ? `<button class="btn btn-sm btn-success" onclick="verifikasiPpdb('${d.id}')"><i class="bi bi-check-lg"></i> Verifikasi</button>`
                        : `<div class="d-flex flex-column gap-1">
                                        <a class="btn btn-sm btn-outline-success" target="_blank" href="https://wa.me/${String(d.ibu_notelp || d.ayah_notelp || "").replace(/^0/, "62")}?text=${encodeURIComponent("Assalamu'alaikum, pendaftaran ananda " + d.nama + " sudah diverifikasi. Terima kasih.")}"><i class="bi bi-whatsapp"></i> Chat WA</a>
                                        <button class="btn btn-sm btn-outline-primary" onclick="unduhPdfPpdb('${d.id}', this)"><i class="bi bi-file-earmark-pdf"></i> Unduh PDF</button>
                                   </div>`
                    }
                        </td>
                    </tr>
                `)
                .join("");
        })
        .catch((err) => {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Gagal memuat data: ${err.message}. Buka console (F12) untuk detail, atau pastikan URL Web App masih benar & sudah di-deploy ulang.</td></tr>`;
        });
}

function verifikasiPpdb(id) {
    if (!confirm("Verifikasi pendaftar ini?")) return;
    postAction({ action: "verify_ppdb", id: id }).then(() => muatPpdb());
}

function unduhPdfPpdb(id, btn) {
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Membuat PDF...';

    fetch(`${GOOGLE_SCRIPT_URL}?action=download_ppdb_pdf&id=${encodeURIComponent(id)}`)
        .then((res) => {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.text();
        })
        .then((text) => {
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error("Respons server bukan JSON (kemungkinan izin DocumentApp/Drive belum di-otorisasi, atau ada error di skrip). Detail: " + text.slice(0, 200));
            }
            if (!data || data.result !== "success") {
                alert("Gagal membuat PDF: " + ((data && data.message) || "Terjadi kesalahan, coba lagi."));
                return;
            }
            const byteChars = atob(data.pdf_base64);
            const byteNumbers = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = data.filename || "formulir_ppdb.pdf";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        })
        .catch((err) => {
            alert("Gagal mengunduh PDF.\n\n" + err.message);
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        });
}

/* ============ BERITA ============ */
// Ubah link share Google Drive jadi link gambar langsung (sama seperti di js/content.js)
function ubahLinkGambarAdmin(url) {
    if (!url) return url;
    url = url.trim();
    if (!url.includes("drive.google.com")) return url;
    let fileId = null;
    let m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) fileId = m[1];
    if (!fileId) {
        m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (m) fileId = m[1];
    }
    if (!fileId) return url;
    return `https://lh3.googleusercontent.com/d/${fileId}=w200`;
}

function muatBerita() {
    fetch(`${GOOGLE_SCRIPT_URL}?action=list_berita`)
        .then((res) => res.json())
        .then((data) => {
            const list = document.getElementById("beritaList");
            if (!data.length) {
                list.innerHTML = '<p class="text-muted mb-0">Belum ada berita.</p>';
                return;
            }
            list.innerHTML = data
                .map((d) => `
                    <div class="d-flex justify-content-between align-items-start border-bottom py-2">
                        ${d.gambar_url
                        ? `<img src="${ubahLinkGambarAdmin(d.gambar_url)}" style="width:70px;height:50px;object-fit:cover;border-radius:6px;" class="me-3" onerror="this.style.display='none';">`
                        : ""
                    }
                        <div class="flex-grow-1">
                            <small class="text-success">${d.tanggal || ""}</small>
                            <h6 class="mb-1">${d.judul}</h6>
                            <p class="small mb-0">${d.isi}</p>
                        </div>
                        <button class="btn btn-sm btn-outline-danger" onclick="hapusBerita('${d.id}')"><i class="bi bi-trash"></i></button>
                    </div>
                `)
                .join("");
        });
}

// Baca file gambar sebagai base64 (tanpa prefix "data:...;base64,")
function bacaFileBase64Admin(file) {
    return new Promise((resolve, reject) => {
        if (!file) { resolve(""); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

document.getElementById("beritaGambarFile")?.addEventListener("change", function () {
    const preview = document.getElementById("beritaGambarPreview");
    if (!preview) return;
    if (this.files && this.files[0]) {
        const f = this.files[0];
        if (f.size > 5 * 1024 * 1024) {
            preview.className = "small text-danger mt-1";
            preview.textContent = "Ukuran gambar terlalu besar, maksimal 5MB.";
            this.value = "";
            return;
        }
        preview.className = "small text-success mt-1";
        preview.textContent = `Gambar dipilih: ${f.name} (${(f.size / 1024).toFixed(0)} KB)`;
    } else {
        preview.textContent = "";
    }
});

document.getElementById("formBerita")?.addEventListener("submit", function (e) {
    e.preventDefault();
    const form = this;
    const data = new FormData(form);
    const fileInput = document.getElementById("beritaGambarFile");
    const file = fileInput && fileInput.files && fileInput.files[0];
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';

    bacaFileBase64Admin(file)
        .then((base64) => {
            return postAction({
                action: "add_berita",
                tanggal: data.get("tanggal"),
                judul: data.get("judul"),
                isi: data.get("isi"),
                gambar_base64: base64,
                gambar_nama: file ? file.name : "",
                gambar_mime: file ? file.type : "",
            });
        })
        .then(() => {
            form.reset();
            document.getElementById("beritaGambarPreview").textContent = "";
            muatBerita();
        })
        .catch(() => {
            alert("Gagal menyimpan berita. Coba lagi.");
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        });
});

function hapusBerita(id) {
    if (!confirm("Hapus berita ini?")) return;
    postAction({ action: "delete_berita", id: id }).then(() => muatBerita());
}

/* ============ PENGUMUMAN ============ */
function muatPengumuman() {
    fetch(`${GOOGLE_SCRIPT_URL}?action=list_pengumuman`)
        .then((res) => res.json())
        .then((data) => {
            const list = document.getElementById("pengumumanList");
            if (!data.length) {
                list.innerHTML = '<p class="text-muted mb-0">Belum ada pengumuman.</p>';
                return;
            }
            list.innerHTML = data
                .map((d) => `
                    <div class="d-flex justify-content-between align-items-start border-bottom py-2">
                        <div>
                            <small class="text-success">${d.tanggal || ""}</small>
                            <h6 class="mb-1">${d.judul}</h6>
                            <p class="small mb-0">${d.isi}</p>
                        </div>
                        <button class="btn btn-sm btn-outline-danger" onclick="hapusPengumuman('${d.id}')"><i class="bi bi-trash"></i></button>
                    </div>
                `)
                .join("");
        });
}

document.getElementById("formPengumuman")?.addEventListener("submit", function (e) {
    e.preventDefault();
    const data = new FormData(this);
    postAction({
        action: "add_pengumuman",
        tanggal: data.get("tanggal"),
        judul: data.get("judul"),
        isi: data.get("isi"),
    }).then(() => {
        this.reset();
        muatPengumuman();
    });
});

function hapusPengumuman(id) {
    if (!confirm("Hapus pengumuman ini?")) return;
    postAction({ action: "delete_pengumuman", id: id }).then(() => muatPengumuman());
}

/* ============ RINCIAN BIAYA MASUK ============ */

function formatRupiah(angka) {
    const n = Number(angka) || 0;
    return "Rp " + n.toLocaleString("id-ID");
}

function baris_ItemBiaya(nama = "", nominal = "") {
    const div = document.createElement("div");
    div.className = "row g-2 mb-2 item-biaya-row";
    div.innerHTML = `
        <div class="col-7">
            <input type="text" class="form-control form-control-sm item-nama" placeholder="Nama item, contoh: Biaya Formulir" value="${nama}">
        </div>
        <div class="col-4">
            <input type="number" class="form-control form-control-sm item-nominal" placeholder="Nominal (Rp)" value="${nominal}">
        </div>
        <div class="col-1 d-grid">
            <button type="button" class="btn btn-sm btn-outline-danger btn-hapus-item"><i class="bi bi-x"></i></button>
        </div>
    `;
    div.querySelector(".btn-hapus-item").addEventListener("click", () => {
        div.remove();
        hitungTotalBiaya();
    });
    div.querySelectorAll(".item-nominal").forEach((el) => el.addEventListener("input", hitungTotalBiaya));
    return div;
}

function hitungTotalBiaya() {
    let total = 0;
    document.querySelectorAll("#biayaItemRows .item-nominal").forEach((el) => {
        total += Number(el.value) || 0;
    });
    document.getElementById("totalBiayaPreview").textContent = formatRupiah(total);
    return total;
}

document.getElementById("btnTambahItemBiaya")?.addEventListener("click", () => {
    document.getElementById("biayaItemRows").appendChild(baris_ItemBiaya());
});

// mulai dengan 1 baris kosong biar tidak bingung
document.addEventListener("DOMContentLoaded", () => {
    const rows = document.getElementById("biayaItemRows");
    if (rows && rows.children.length === 0) {
        rows.appendChild(baris_ItemBiaya());
    }
});

function resetFormBiaya() {
    document.getElementById("formBiaya").reset();
    document.getElementById("biayaEditId").value = "";
    document.getElementById("biayaItemRows").innerHTML = "";
    document.getElementById("biayaItemRows").appendChild(baris_ItemBiaya());
    hitungTotalBiaya();
    document.getElementById("formBiayaTitle").textContent = "Tambah Rincian Biaya Masuk";
    document.getElementById("btnBiayaLabel").textContent = "Simpan Paket Biaya";
    document.getElementById("btnBatalEditBiaya").style.display = "none";
}

document.getElementById("btnBatalEditBiaya")?.addEventListener("click", resetFormBiaya);

function muatBiaya() {
    fetch(`${GOOGLE_SCRIPT_URL}?action=list_biaya`)
        .then((res) => res.json())
        .then((data) => {
            const list = document.getElementById("biayaList");
            if (!data.length) {
                list.innerHTML = '<p class="text-muted mb-0">Belum ada paket biaya.</p>';
                return;
            }
            list.innerHTML = data
                .map((d) => {
                    let items = [];
                    try { items = JSON.parse(d.item_json || "[]"); } catch (e) { items = []; }
                    const itemsHtml = items
                        .map((it) => `<li class="d-flex justify-content-between"><span>${it.nama}</span><span>${formatRupiah(it.nominal)}</span></li>`)
                        .join("");
                    return `
                    <div class="border-bottom py-3">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="mb-1">${d.kelas} - ${d.gelombang} ${d.periode ? `<small class="text-muted">(${d.periode})</small>` : ""}</h6>
                                <ul class="list-unstyled small mb-2">${itemsHtml}</ul>
                                <div class="fw-bold text-success">Total: ${formatRupiah(d.total)}</div>
                                ${d.biaya_bulanan ? `<div class="small text-muted">${d.biaya_bulanan}</div>` : ""}
                            </div>
                            <div class="d-flex flex-column gap-1 ms-2">
                                <button class="btn btn-sm btn-outline-success" onclick='editBiaya(${JSON.stringify(d)})'><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-outline-danger" onclick="hapusBiaya('${d.id}')"><i class="bi bi-trash"></i></button>
                            </div>
                        </div>
                    </div>
                `;
                })
                .join("");
        });
}

function editBiaya(d) {
    resetFormBiaya();
    document.getElementById("biayaEditId").value = d.id;
    const form = document.getElementById("formBiaya");
    form.kelas.value = d.kelas;
    form.gelombang.value = d.gelombang;
    form.periode.value = d.periode || "";
    form.biaya_bulanan.value = d.biaya_bulanan || "";
    let items = [];
    try { items = JSON.parse(d.item_json || "[]"); } catch (e) { items = []; }
    const rows = document.getElementById("biayaItemRows");
    rows.innerHTML = "";
    items.forEach((it) => rows.appendChild(baris_ItemBiaya(it.nama, it.nominal)));
    if (items.length === 0) rows.appendChild(baris_ItemBiaya());
    hitungTotalBiaya();
    document.getElementById("formBiayaTitle").textContent = "Edit Paket Biaya";
    document.getElementById("btnBiayaLabel").textContent = "Update Paket Biaya";
    document.getElementById("btnBatalEditBiaya").style.display = "inline-block";
    document.getElementById("formBiaya").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("formBiaya")?.addEventListener("submit", function (e) {
    e.preventDefault();
    const data = new FormData(this);
    const items = [];
    document.querySelectorAll("#biayaItemRows .item-biaya-row").forEach((row) => {
        const nama = row.querySelector(".item-nama").value.trim();
        const nominal = Number(row.querySelector(".item-nominal").value) || 0;
        if (nama) items.push({ nama, nominal });
    });
    const total = hitungTotalBiaya();
    const editId = document.getElementById("biayaEditId").value;
    const payload = {
        action: editId ? "update_biaya" : "add_biaya",
        id: editId || undefined,
        kelas: data.get("kelas"),
        gelombang: data.get("gelombang"),
        periode: data.get("periode"),
        biaya_bulanan: data.get("biaya_bulanan"),
        item_json: JSON.stringify(items),
        total: total,
    };
    postAction(payload).then(() => {
        resetFormBiaya();
        muatBiaya();
    });
});

function hapusBiaya(id) {
    if (!confirm("Hapus paket biaya ini?")) return;
    postAction({ action: "delete_biaya", id: id }).then(() => muatBiaya());
}

/* ============ PERSYARATAN PENDAFTARAN ============ */

function resetFormPersyaratan() {
    document.getElementById("formPersyaratan").reset();
    document.getElementById("persyaratanEditId").value = "";
    document.getElementById("btnPersyaratanLabel").textContent = "Simpan";
    document.getElementById("btnBatalEditPersyaratan").style.display = "none";
}

document.getElementById("btnBatalEditPersyaratan")?.addEventListener("click", resetFormPersyaratan);

function muatPersyaratan() {
    fetch(`${GOOGLE_SCRIPT_URL}?action=list_persyaratan`)
        .then((res) => res.json())
        .then((data) => {
            const list = document.getElementById("persyaratanList");
            if (!data.length) {
                list.innerHTML = '<p class="text-muted mb-0">Belum ada data persyaratan.</p>';
                return;
            }
            list.innerHTML = data
                .map((d) => {
                    const items = (d.daftar_item || "").split("\n").filter(Boolean);
                    const itemsHtml = items.map((it) => `<li>${it}</li>`).join("");
                    return `
                    <div class="border-bottom py-3">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <span class="badge bg-success-subtle text-success mb-1">${d.jenis || "Persyaratan"}</span>
                                <h6 class="mb-1">${d.kategori}</h6>
                                <ul class="small mb-0">${itemsHtml}</ul>
                            </div>
                            <div class="d-flex flex-column gap-1 ms-2">
                                <button class="btn btn-sm btn-outline-success" onclick='editPersyaratan(${JSON.stringify(d)})'><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-outline-danger" onclick="hapusPersyaratan('${d.id}')"><i class="bi bi-trash"></i></button>
                            </div>
                        </div>
                    </div>
                `;
                })
                .join("");
        });
}

function editPersyaratan(d) {
    document.getElementById("persyaratanEditId").value = d.id;
    const form = document.getElementById("formPersyaratan");
    form.kategori.value = d.kategori;
    form.jenis.value = d.jenis || "Persyaratan";
    form.daftar_item.value = d.daftar_item;
    document.getElementById("btnPersyaratanLabel").textContent = "Update";
    document.getElementById("btnBatalEditPersyaratan").style.display = "inline-block";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("formPersyaratan")?.addEventListener("submit", function (e) {
    e.preventDefault();
    const data = new FormData(this);
    const editId = document.getElementById("persyaratanEditId").value;
    postAction({
        action: editId ? "update_persyaratan" : "add_persyaratan",
        id: editId || undefined,
        kategori: data.get("kategori"),
        jenis: data.get("jenis"),
        daftar_item: data.get("daftar_item"),
    }).then(() => {
        resetFormPersyaratan();
        muatPersyaratan();
    });
});

function hapusPersyaratan(id) {
    if (!confirm("Hapus data persyaratan ini?")) return;
    postAction({ action: "delete_persyaratan", id: id }).then(() => muatPersyaratan());
}

/* ============ PENGATURAN UMUM PPDB (tahun ajaran, status, kuota, gelombang) ============ */

// Cache gelombang aktif terakhir (dipakai untuk mengisi select "Gelombang" di form Biaya)
let gelombangListCache = [];

function baris_Gelombang(nama = "", periode = "", aktif = true) {
    const div = document.createElement("div");
    div.className = "row g-2 mb-2 align-items-center gelombang-row";
    div.innerHTML = `
        <div class="col-md-4">
            <input type="text" class="form-control form-control-sm gel-nama" placeholder="Nama, contoh: Gelombang I" value="${nama}">
        </div>
        <div class="col-md-5">
            <input type="text" class="form-control form-control-sm gel-periode" placeholder="Periode (opsional), contoh: Januari - Maret" value="${periode}">
        </div>
        <div class="col-md-2 form-check ms-1">
            <input type="checkbox" class="form-check-input gel-aktif" ${aktif ? "checked" : ""}>
            <label class="form-check-label small">Aktif</label>
        </div>
        <div class="col-md-1 d-grid">
            <button type="button" class="btn btn-sm btn-outline-danger btn-hapus-gelombang"><i class="bi bi-x"></i></button>
        </div>
    `;
    div.querySelector(".btn-hapus-gelombang").addEventListener("click", () => div.remove());
    return div;
}

document.getElementById("btnTambahGelombang")?.addEventListener("click", () => {
    document.getElementById("gelombangRows").appendChild(baris_Gelombang());
});

function renderGelombangRows(list) {
    const rows = document.getElementById("gelombangRows");
    if (!rows) return;
    rows.innerHTML = "";
    (list && list.length ? list : [{ nama: "", periode: "", aktif: true }]).forEach((g) => {
        rows.appendChild(baris_Gelombang(g.nama, g.periode, g.aktif));
    });
}

function ambilGelombangDariForm() {
    const list = [];
    document.querySelectorAll("#gelombangRows .gelombang-row").forEach((row) => {
        const nama = row.querySelector(".gel-nama").value.trim();
        const periode = row.querySelector(".gel-periode").value.trim();
        const aktif = row.querySelector(".gel-aktif").checked;
        if (nama) list.push({ nama, periode, aktif });
    });
    return list;
}

// Isi ulang select "Gelombang" di form Rincian Biaya Masuk dari daftar gelombang
// yang tersimpan di Pengaturan (semua gelombang ditampilkan, aktif maupun tidak,
// supaya paket biaya lama untuk gelombang nonaktif tetap bisa diedit).
function renderBiayaGelombangSelect(list) {
    const select = document.getElementById("biayaGelombangSelect");
    if (!select) return;
    const nilaiTerpilih = select.value;
    select.innerHTML = '<option value="">-- Pilih Gelombang --</option>' +
        (list || []).map((g) => `<option value="${g.nama}">${g.nama}${g.aktif ? "" : " (nonaktif)"}</option>`).join("");
    if (nilaiTerpilih) select.value = nilaiTerpilih;
}

function muatPengaturanUmum() {
    fetch(`${GOOGLE_SCRIPT_URL}?action=get_pengaturan`)
        .then((res) => {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then((data) => {
            document.getElementById("pengaturanTahunAjaran").value = data.tahun_ajaran_aktif || "";
            document.getElementById("pengaturanStatusPpdb").value = data.status_ppdb || "Buka";

            document.getElementById("kuotaReguler").value = data.kelas.Reguler.kuota;
            document.getElementById("kuotaOfflineReguler").value = data.kelas.Reguler.offline;
            document.getElementById("infoOnlineReguler").textContent = data.kelas.Reguler.online;

            document.getElementById("kuotaIntensif").value = data.kelas.Intensif.kuota;
            document.getElementById("kuotaOfflineIntensif").value = data.kelas.Intensif.offline;
            document.getElementById("infoOnlineIntensif").textContent = data.kelas.Intensif.online;

            gelombangListCache = data.gelombang_list || [];
            renderGelombangRows(gelombangListCache);
            renderBiayaGelombangSelect(gelombangListCache);
        })
        .catch((err) => {
            const statusEl = document.getElementById("pengaturanUmumStatus");
            if (statusEl) statusEl.innerHTML = `<span class="text-danger">Gagal memuat pengaturan: ${err.message}</span>`;
        });
}

function simpanPengaturanUmum(btn) {
    const statusEl = document.getElementById("pengaturanUmumStatus");
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
    statusEl.innerHTML = "";

    postAction({
        action: "update_pengaturan",
        tahun_ajaran_aktif: document.getElementById("pengaturanTahunAjaran").value,
        status_ppdb: document.getElementById("pengaturanStatusPpdb").value,
        kuota_reguler: Number(document.getElementById("kuotaReguler").value) || 0,
        kuota_offline_reguler: Number(document.getElementById("kuotaOfflineReguler").value) || 0,
        kuota_intensif: Number(document.getElementById("kuotaIntensif").value) || 0,
        kuota_offline_intensif: Number(document.getElementById("kuotaOfflineIntensif").value) || 0,
        gelombang_list: JSON.stringify(ambilGelombangDariForm()),
    })
        .then((res) => {
            if (res && res.result === "success") {
                statusEl.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill"></i> Tersimpan.</span>';
                muatPengaturanUmum();
            } else {
                statusEl.innerHTML = `<span class="text-danger">Gagal: ${(res && res.message) || "Terjadi kesalahan."}</span>`;
            }
        })
        .catch((err) => {
            statusEl.innerHTML = `<span class="text-danger">Gagal menyimpan: ${err.message}</span>`;
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        });
}