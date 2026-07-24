/*=========================================
PPDB FORM -> GOOGLE SHEET -> WHATSAPP
=========================================*/

// GANTI URL INI dengan URL Web App dari Apps Script kamu
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx6A_JrDbsjofxgEB6TQUfV0L5FPcpmV9YYs0JCzgRlkaYaeFXGFna40VSHIxuwdLp13g/exec";

// Nomor WhatsApp admin/sekolah (format: kode negara tanpa + atau 0 di depan)
const WA_NUMBER = "62895375689961";

// Info biaya (dari brosur). Lengkapi/ubah di sini kalau ada perubahan biaya.
const INFO_BIAYA = {
    "Reguler|Gelombang I (Januari-Maret)":
        "Total Biaya Masuk: Rp850.000 (Formulir Rp50.000 + Seragam Rp400.000 + Infak Bangunan/Kursi Rp400.000). Tambahan: Ekskul & Tahfidz Rp25.000/bulan.",
    "Intensif|Gelombang II (April-Juni)":
        "Total Biaya Masuk: Rp2.200.000 (Formulir Rp50.000 + Seragam Rp400.000 + Bangunan/Kursi/AC Rp1.750.000). SPP: Rp130.000/bulan.",
};

document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("ppdbForm");
    const submitBtn = document.getElementById("ppdbSubmitBtn");
    const statusBox = document.getElementById("ppdbStatus");
    const iframe = document.querySelector('iframe[name="hidden_iframe"]');
    const kelasSelect = document.getElementById("kelasPilihan");
    const gelombangSelect = document.getElementById("gelombangPilihan");
    const infoBiaya = document.getElementById("infoBiaya");

    if (!form) return;

    form.setAttribute("action", GOOGLE_SCRIPT_URL);
    form.setAttribute("method", "POST");

    // ---- Rekapitulasi kuota pendaftar (publik) ----
    const KUOTA_MAKS = 200; // ganti sesuai kuota sekolah tahun ini
    const rekapKuota = document.getElementById("rekapKuota");
    const rekapText = document.getElementById("rekapText");
    if (rekapKuota && !GOOGLE_SCRIPT_URL.includes("PASTE_URL")) {
        fetch(`${GOOGLE_SCRIPT_URL}?action=rekap_kuota`)
            .then((res) => res.json())
            .then((data) => {
                rekapText.textContent = `${data.terverifikasi} / ${KUOTA_MAKS} kuota terisi (terverifikasi)`;
                rekapKuota.style.display = "block";
            })
            .catch(() => {});
    }

    // ---- Info biaya otomatis ----
    function updateInfoBiaya() {
        const key = `${kelasSelect.value}|${gelombangSelect.value}`;
        if (INFO_BIAYA[key]) {
            infoBiaya.textContent = INFO_BIAYA[key];
            infoBiaya.classList.remove("d-none");
        } else if (kelasSelect.value && gelombangSelect.value) {
            infoBiaya.textContent = "Info biaya untuk kombinasi ini belum tersedia di sistem — silakan tanya admin via WhatsApp untuk rincian biaya pastinya.";
            infoBiaya.classList.remove("d-none");
        } else {
            infoBiaya.classList.add("d-none");
        }
    }
    if (kelasSelect && gelombangSelect) {
        kelasSelect.addEventListener("change", updateInfoBiaya);
        gelombangSelect.addEventListener("change", updateInfoBiaya);
    }

    // ---- Tabel Saudara Kandung dinamis ----
    window.tambahBarisSaudara = function () {
        const tbody = document.querySelector("#saudaraTable tbody");
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><input type="text" class="form-control form-control-sm sdr-nama"></td>
            <td>
                <select class="form-select form-select-sm sdr-jk">
                    <option value="L">L</option>
                    <option value="P">P</option>
                </select>
            </td>
            <td><input type="text" class="form-control form-control-sm sdr-pendidikan"></td>
            <td><input type="text" class="form-control form-control-sm sdr-sekolah"></td>
            <td><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('tr').remove()"><i class="bi bi-trash"></i></button></td>
        `;
        tbody.appendChild(row);
    };
    // baris pertama otomatis saat halaman dibuka
    tambahBarisSaudara();

    function serializeSaudara() {
        const rows = document.querySelectorAll("#saudaraTable tbody tr");
        const data = [];
        rows.forEach((row) => {
            const nama = row.querySelector(".sdr-nama").value.trim();
            if (!nama) return;
            data.push({
                nama: nama,
                lp: row.querySelector(".sdr-jk").value,
                pendidikan: row.querySelector(".sdr-pendidikan").value.trim(),
                sekolah: row.querySelector(".sdr-sekolah").value.trim(),
            });
        });
        return JSON.stringify(data);
    }

    let isSubmitting = false;

    form.addEventListener("submit", function (event) {

        if (GOOGLE_SCRIPT_URL.includes("PASTE_URL")) {
            statusBox.innerHTML = '<span class="text-danger">URL Google Script belum diisi. Cek file js/ppdb.js.</span>';
            event.preventDefault();
            return;
        }

        document.getElementById("saudaraKandungData").value = serializeSaudara();

        isSubmitting = true;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Mengirim data...';
        statusBox.innerHTML = "";
    });

    iframe.addEventListener("load", function () {

        if (!isSubmitting) return;

        const data = new FormData(form);
        const nama = data.get("nama") || "";
        const kelas = data.get("kelas_pilihan") || "";
        const gelombang = data.get("gelombang") || "";
        const ayahNama = data.get("ayah_nama") || "";
        const ibuNama = data.get("ibu_nama") || "";
        const ibuNoTelp = data.get("ibu_notelp") || "";
        const alamat = data.get("alamat") || "";

        const pesan =
            `Assalamu'alaikum, saya ingin mendaftarkan PPDB dengan data berikut:%0A` +
            `Nama Siswa: ${nama}%0A` +
            `Kelas: ${kelas} - ${gelombang}%0A` +
            `Nama Ayah: ${ayahNama}%0A` +
            `Nama Ibu: ${ibuNama}%0A` +
            `No. WA Ibu/Ortu: ${ibuNoTelp}%0A` +
            `Alamat: ${alamat}%0A%0A` +
            `Mohon informasi langkah selanjutnya. Terima kasih.`;

        statusBox.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill"></i> Data berhasil dikirim! Mengarahkan ke WhatsApp...</span>';

        setTimeout(function () {
            window.location.href = `https://wa.me/${WA_NUMBER}?text=${pesan}`;
        }, 1200);
    });

});
