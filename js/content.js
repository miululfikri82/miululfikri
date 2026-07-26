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

// Ubah link share Google Drive (format apa pun: /file/d/ID/view, ?id=ID, dst)
// jadi link gambar langsung yang bisa dipakai di <img src="...">.
// Kalau bukan link Drive, dikembalikan apa adanya (misal link gambar dari host lain).
function ubahLinkGambar(url) {
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

    return `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
}

function renderBeritaCard(d) {
    const gambarAsli = d.gambar_url && d.gambar_url.trim() ? d.gambar_url : "assets/img/gallery1.jpg";
    const gambar = ubahLinkGambar(gambarAsli);
    return `
        <div class="col-lg-4">
            <div class="card border-0 shadow h-100">
                <img src="${gambar}" class="card-img-top" style="height:220px;object-fit:cover;"
                    onerror="this.onerror=null;this.src='assets/img/gallery1.jpg';">
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

// Versi ringkas untuk section "Pengumuman" di beranda (gaya list-group, bukan card)
function renderPengumumanListItem(d) {
    return `
        <a href="pengumuman.html" class="list-group-item list-group-item-action">
            <i class="bi bi-calendar-event text-success me-2"></i>
            ${d.judul}
            <span class="float-end">${formatTanggal(d.tanggal)}</span>
        </a>
    `;
}

function muatPengumumanHome(containerId, jumlah) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (CONTENT_SCRIPT_URL.includes("PASTE_URL")) {
        container.innerHTML = '<div class="list-group-item text-muted">Belum terhubung ke Google Sheet.</div>';
        return;
    }

    fetch(`${CONTENT_SCRIPT_URL}?action=list_pengumuman`)
        .then((res) => res.json())
        .then((data) => {
            if (!data.length) {
                container.innerHTML = '<div class="list-group-item text-muted">Belum ada pengumuman.</div>';
                return;
            }
            const items = jumlah ? data.slice(0, jumlah) : data;
            container.innerHTML = items.map(renderPengumumanListItem).join("");
        })
        .catch(() => {
            container.innerHTML = '<div class="list-group-item text-danger">Gagal memuat pengumuman.</div>';
        });
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