/*=========================================
KONTEN DINAMIS (Berita & Pengumuman)
Dipakai di: berita.html, pengumuman.html, index.html
=========================================*/

// GANTI dengan URL Web App Apps Script yang sama seperti di js/ppdb.js dan js/admin.js
const CONTENT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6A_JrDbsjofxgEB6TQUfV0L5FPcpmV9YYs0JCzgRlkaYaeFXGFna40VSHIxuwdLp13g/exec";

function formatTanggal(str) {
    if (!str) return "";
    try {
        const d = new Date(str);
        return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    } catch (e) {
        return str;
    }
}

function renderBeritaCard(d) {
    const gambar = d.gambar_url && d.gambar_url.trim() ? d.gambar_url : "assets/img/gallery1.jpg";
    return `
        <div class="col-lg-4">
            <div class="card border-0 shadow h-100">
                <img src="${gambar}" class="card-img-top" style="height:220px;object-fit:cover;">
                <div class="card-body">
                    <small class="text-success">${formatTanggal(d.tanggal)}</small>
                    <h5 class="mt-2">${d.judul}</h5>
                    <p>${d.isi}</p>
                </div>
            </div>
        </div>
    `;
}

function renderPengumumanCard(d) {
    return `
        <div class="col-lg-6">
            <div class="card border-0 shadow h-100">
                <div class="card-body">
                    <small class="text-success">${formatTanggal(d.tanggal)}</small>
                    <h5 class="mt-2">${d.judul}</h5>
                    <p>${d.isi}</p>
                </div>
            </div>
        </div>
    `;
}

function muatBeritaPublik(containerId, jumlah) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (CONTENT_SCRIPT_URL.includes("PASTE_URL")) {
        container.innerHTML = '<div class="col-12 text-center text-muted">Belum terhubung ke Google Sheet. Lengkapi URL di js/content.js.</div>';
        return;
    }

    fetch(`${CONTENT_SCRIPT_URL}?action=list_berita`)
        .then((res) => res.json())
        .then((data) => {
            if (!data.length) {
                container.innerHTML = '<div class="col-12 text-center text-muted">Belum ada berita.</div>';
                return;
            }
            const items = jumlah ? data.slice(0, jumlah) : data;
            container.innerHTML = items.map(renderBeritaCard).join("");
        })
        .catch(() => {
            container.innerHTML = '<div class="col-12 text-center text-danger">Gagal memuat berita.</div>';
        });
}

function muatPengumumanPublik(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (CONTENT_SCRIPT_URL.includes("PASTE_URL")) {
        container.innerHTML = '<div class="col-12 text-center text-muted">Belum terhubung ke Google Sheet. Lengkapi URL di js/content.js.</div>';
        return;
    }

    fetch(`${CONTENT_SCRIPT_URL}?action=list_pengumuman`)
        .then((res) => res.json())
        .then((data) => {
            if (!data.length) {
                container.innerHTML = '<div class="col-12 text-center text-muted">Belum ada pengumuman.</div>';
                return;
            }
            container.innerHTML = data.map(renderPengumumanCard).join("");
        })
        .catch(() => {
            container.innerHTML = '<div class="col-12 text-center text-danger">Gagal memuat pengumuman.</div>';
        });
}
