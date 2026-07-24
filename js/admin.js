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
    });
}

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
