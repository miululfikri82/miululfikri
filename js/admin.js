/*=========================================
ADMIN PANEL - MI ULUL FIKRI
=========================================*/

// GANTI URL & PASSWORD INI
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjedZtAtzXnoxqAQ7y4KY8gKa5BjH3cfPMa_otQajEE02gKADm0poUIvA3R1Wol86sXw/exec";
const ADMIN_PASSWORD = "admin1234";

function cekPassword() {
    const input = document.getElementById("adminPassword").value;
    if (input === ADMIN_PASSWORD) {
        document.getElementById("loginGate").style.display = "none";
        document.getElementById("adminContent").style.display = "block";
        sessionStorage.setItem("admin_ok", "1");
        muatPpdb();
        muatBerita();
        muatPengumuman();
        muatBiaya();
        muatPersyaratan();
    } else {
        document.getElementById("loginError").textContent = "Password salah.";
    }
}

// biar tidak perlu login ulang tiap reload dalam sesi yang sama
if (sessionStorage.getItem("admin_ok") === "1") {
    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById("loginGate").style.display = "none";
        document.getElementById("adminContent").style.display = "block";
        muatPpdb();
        muatBerita();
        muatPengumuman();
        muatBiaya();
        muatPersyaratan();
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
    fetch(`${GOOGLE_SCRIPT_URL}?action=list_ppdb`)
        .then((res) => res.json())
        .then((data) => {
            const tbody = document.getElementById("ppdbTableBody");
            if (!data.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada pendaftar.</td></tr>';
                return;
            }
            tbody.innerHTML = data
                .map((d) => `
                    <tr>
                        <td>${d.nama || "-"}</td>
                        <td>${d.kelas_pilihan || "-"} / ${d.gelombang || "-"}</td>
                        <td>${d.ayah_nama || d.ibu_nama || "-"}</td>
                        <td>${d.ibu_notelp || d.ayah_notelp || "-"}</td>
                        <td><span class="badge ${d.status === "Terverifikasi" ? "bg-success" : "bg-warning text-dark"}">${d.status || "-"}</span></td>
                        <td>
                            ${d.status !== "Terverifikasi"
                                ? `<button class="btn btn-sm btn-success" onclick="verifikasiPpdb('${d.id}')"><i class="bi bi-check-lg"></i> Verifikasi</button>`
                                : `<a class="btn btn-sm btn-outline-success" target="_blank" href="https://wa.me/${(d.ibu_notelp || d.ayah_notelp || "").replace(/^0/, "62")}?text=${encodeURIComponent("Assalamu'alaikum, pendaftaran ananda " + d.nama + " sudah diverifikasi. Terima kasih.")}"><i class="bi bi-whatsapp"></i> Chat WA</a>`
                            }
                        </td>
                    </tr>
                `)
                .join("");
        });
}

function verifikasiPpdb(id) {
    if (!confirm("Verifikasi pendaftar ini?")) return;
    postAction({ action: "verify_ppdb", id: id }).then(() => muatPpdb());
}

/* ============ BERITA ============ */
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
                        <div>
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

document.getElementById("formBerita")?.addEventListener("submit", function (e) {
    e.preventDefault();
    const data = new FormData(this);
    postAction({
        action: "add_berita",
        tanggal: data.get("tanggal"),
        judul: data.get("judul"),
        isi: data.get("isi"),
        gambar_url: data.get("gambar_url"),
    }).then(() => {
        this.reset();
        muatBerita();
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
