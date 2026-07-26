/*=========================================
BACKEND WEBSITE MI ULUL FIKRI
Menangani: Pendaftaran PPDB, Berita, Pengumuman
Semua data disimpan di 3 sheet: "Pendaftaran", "Berita", "Pengumuman"
=========================================*/

var SS = SpreadsheetApp.getActiveSpreadsheet();

function sheet(name) {
  var s = SS.getSheetByName(name);
  if (!s) {
    s = SS.insertSheet(name);
  }
  return s;
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects(sh) {
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = values.slice(1);
  return rows
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    })
    .filter(function (obj) { return obj.id; }); // buang baris kosong
}

function findRowById(sh, id) {
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 1; // nomor baris (1-indexed)
  }
  return -1;
}

// Pastikan sheet punya semua kolom yang dibutuhkan. Kolom yang belum ada akan
// ditambahkan di ujung kanan tanpa merusak kolom & data yang sudah ada.
// Return array header terbaru (urutan sesuai kolom asli di sheet).
function ensureColumns(sh, headers) {
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    return headers.slice();
  }
  var currentHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var toAdd = headers.filter(function (h) { return currentHeaders.indexOf(h) === -1; });
  if (toAdd.length) {
    sh.getRange(1, currentHeaders.length + 1, 1, toAdd.length).setValues([toAdd]);
    currentHeaders = currentHeaders.concat(toAdd);
  }
  return currentHeaders;
}

// Simpan file (base64) ke folder tertentu di Google Drive dan kembalikan URL-nya.
// Dipakai untuk bukti pembayaran maupun gambar berita. Kalau tidak ada file
// (base64 kosong), kembalikan string kosong.
function simpanFileKeDrive(folderName, base64, filename, mime) {
  if (!base64) return "";
  try {
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    var bytes = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(bytes, mime || "application/octet-stream", filename || (folderName + "_" + new Date().getTime()));
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    return "";
  }
}

function saveBuktiBayar(base64, filename, mime) {
  return simpanFileKeDrive("Bukti Pembayaran PPDB", base64, filename, mime);
}

function simpanGambarBerita(base64, filename, mime) {
  return simpanFileKeDrive("Gambar Berita Website", base64, filename, mime);
}

/* ============ PENGATURAN PENDAFTARAN (key-value di sheet "Pengaturan") ============ */

var PENGATURAN_DEFAULT = {
  tahun_ajaran_aktif: "2026-2027",
  status_ppdb: "Buka",
  kuota_reguler: 30,
  kuota_intensif: 30,
  kuota_offline_reguler: 0,
  kuota_offline_intensif: 0,
  gelombang_list: JSON.stringify([
    { nama: "Gelombang I", periode: "Januari - Maret", aktif: true },
    { nama: "Gelombang II", periode: "April - Juni", aktif: true }
  ])
};

// Parse string JSON gelombang_list dari Pengaturan menjadi array object yang aman
// dipakai (kalau kosong/rusak, kembalikan array kosong bukan error).
function parseGelombangList(raw) {
  try {
    var list = JSON.parse(raw || "[]");
    if (!Array.isArray(list)) return [];
    return list.map(function (g) {
      return {
        nama: String(g.nama || "").trim(),
        periode: String(g.periode || "").trim(),
        aktif: g.aktif !== false
      };
    }).filter(function (g) { return g.nama; });
  } catch (err) {
    return [];
  }
}

function getPengaturan() {
  var sh = sheet("Pengaturan");
  if (sh.getLastRow() === 0) {
    sh.appendRow(["key", "value"]);
  }
  var values = sh.getDataRange().getValues();
  var hasil = {};
  for (var i = 1; i < values.length; i++) {
    if (values[i][0]) hasil[values[i][0]] = values[i][1];
  }
  // isi nilai default untuk key yang belum pernah diset
  Object.keys(PENGATURAN_DEFAULT).forEach(function (k) {
    if (!(k in hasil) || hasil[k] === "") hasil[k] = PENGATURAN_DEFAULT[k];
  });
  return hasil;
}

function setPengaturan(data) {
  var sh = sheet("Pengaturan");
  if (sh.getLastRow() === 0) {
    sh.appendRow(["key", "value"]);
  }
  var values = sh.getDataRange().getValues();
  var keys = Object.keys(PENGATURAN_DEFAULT);
  keys.forEach(function (key) {
    if (!(key in data)) return;
    var rowIndex = -1;
    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === key) { rowIndex = i + 1; break; }
    }
    if (rowIndex === -1) {
      sh.appendRow([key, data[key]]);
      values.push([key, data[key]]);
    } else {
      sh.getRange(rowIndex, 2).setValue(data[key]);
    }
  });
  return getPengaturan();
}

// Gabungkan pengaturan tersimpan + hitungan pendaftar online per kelas,
// dipakai baik oleh admin panel maupun halaman PPDB publik.
function getPengaturanLengkap() {
  var p = getPengaturan();
  var data = sheetToObjects(sheet("Pendaftaran"));
  var onlineReguler = data.filter(function (d) { return d.kelas_pilihan === "Reguler"; }).length;
  var onlineIntensif = data.filter(function (d) { return d.kelas_pilihan === "Intensif"; }).length;
  var offlineReguler = Number(p.kuota_offline_reguler) || 0;
  var offlineIntensif = Number(p.kuota_offline_intensif) || 0;

  return {
    tahun_ajaran_aktif: p.tahun_ajaran_aktif,
    status_ppdb: p.status_ppdb,
    gelombang_list: parseGelombangList(p.gelombang_list),
    kelas: {
      Reguler: {
        kuota: Number(p.kuota_reguler) || 0,
        online: onlineReguler,
        offline: offlineReguler,
        terisi: onlineReguler + offlineReguler
      },
      Intensif: {
        kuota: Number(p.kuota_intensif) || 0,
        online: onlineIntensif,
        offline: offlineIntensif,
        terisi: onlineIntensif + offlineIntensif
      }
    },
    // dipertahankan untuk kompatibilitas dengan tampilan lama
    kuota_offline_reguler: offlineReguler,
    kuota_offline_intensif: offlineIntensif,
    kuota_reguler: Number(p.kuota_reguler) || 0,
    kuota_intensif: Number(p.kuota_intensif) || 0
  };
}

/* ================= doGet: untuk membaca data (publik & admin) ================= */
function doGet(e) {
  var action = e.parameter.action || "";

  if (action === "list_berita") {
    return jsonOutput(sheetToObjects(sheet("Berita")).reverse());
  }
  if (action === "list_pengumuman") {
    return jsonOutput(sheetToObjects(sheet("Pengumuman")).reverse());
  }
  if (action === "list_ppdb") {
    return jsonOutput(sheetToObjects(sheet("Pendaftaran")).reverse());
  }
  if (action === "rekap_kuota") {
    var data = sheetToObjects(sheet("Pendaftaran"));
    var terverifikasi = data.filter(function (d) { return d.status === "Terverifikasi"; }).length;
    return jsonOutput({ total_pendaftar: data.length, terverifikasi: terverifikasi });
  }
  if (action === "list_biaya") {
    return jsonOutput(sheetToObjects(sheet("BiayaMasuk")).reverse());
  }
  if (action === "list_persyaratan") {
    return jsonOutput(sheetToObjects(sheet("Persyaratan")).reverse());
  }
  if (action === "download_ppdb_pdf") {
    return downloadPpdbPdf(e.parameter.id);
  }
  if (action === "get_pengaturan") {
    return jsonOutput(getPengaturanLengkap());
  }

  return ContentService.createTextOutput("Script aktif. Gunakan parameter ?action=").setMimeType(ContentService.MimeType.TEXT);
}

/* ================= doPost: untuk menulis/mengubah data ================= */
function doPost(e) {
  // Dua cara masuk: form submit klasik (e.parameter) ATAU fetch JSON (e.postData.contents)
  var p = e.parameter;
  var isJson = e.postData && e.postData.type === "text/plain";
  var body = {};
  if (isJson) {
    try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
  }
  // Kalau data dikirim sebagai JSON (fetch dari ppdb.js/admin.js), pakai body.
  // Kalau dikirim sebagai form submit klasik, pakai e.parameter.
  var data = (isJson && Object.keys(body).length) ? body : p;
  var action = data.action || "";

  if (!action) {
    return jsonOutput({ result: "error", message: "Aksi tidak ditemukan pada request" });
  }

  if (action === "submit_ppdb") {
    return submitPpdb(data);
  }
  if (action === "verify_ppdb") {
    return verifyPpdb(body.id);
  }
  if (action === "add_berita") {
    return addBerita(body);
  }
  if (action === "delete_berita") {
    return deleteRow("Berita", body.id);
  }
  if (action === "add_pengumuman") {
    return addPengumuman(body);
  }
  if (action === "delete_pengumuman") {
    return deleteRow("Pengumuman", body.id);
  }
  if (action === "add_biaya") {
    return addBiaya(body);
  }
  if (action === "update_biaya") {
    return updateBiaya(body);
  }
  if (action === "delete_biaya") {
    return deleteRow("BiayaMasuk", body.id);
  }
  if (action === "add_persyaratan") {
    return addPersyaratan(body);
  }
  if (action === "update_persyaratan") {
    return updatePersyaratan(body);
  }
  if (action === "delete_persyaratan") {
    return deleteRow("Persyaratan", body.id);
  }
  if (action === "update_pengaturan") {
    return jsonOutput({ result: "success", data: setPengaturan(body) });
  }

  return jsonOutput({ result: "error", message: "Aksi tidak dikenali" });
}

function submitPpdb(p) {
  // Validasi server-side: tolak kalau PPDB sedang ditutup atau kuota kelas
  // yang dipilih sudah penuh (supaya tidak bisa ditembus langsung lewat API).
  var pengaturan = getPengaturanLengkap();
  if (pengaturan.status_ppdb !== "Buka") {
    return jsonOutput({ result: "error", message: "Pendaftaran PPDB sedang ditutup." });
  }
  var infoKelas = pengaturan.kelas[p.kelas_pilihan];
  if (infoKelas && infoKelas.kuota > 0 && infoKelas.terisi >= infoKelas.kuota) {
    return jsonOutput({ result: "error", message: "Mohon maaf, kuota untuk kelas " + p.kelas_pilihan + " sudah penuh." });
  }
  var gelombangAktif = pengaturan.gelombang_list.filter(function (g) { return g.aktif; }).map(function (g) { return g.nama; });
  if (gelombangAktif.length && gelombangAktif.indexOf(p.gelombang) === -1) {
    return jsonOutput({ result: "error", message: "Gelombang pendaftaran yang dipilih tidak valid atau sudah tidak aktif." });
  }

  var sh = sheet("Pendaftaran");
  var headers = ["id", "timestamp", "tahun_ajaran", "kelas_pilihan", "gelombang", "nama", "panggilan", "jk",
    "tempat_lahir", "tanggal_lahir", "anak_ke", "saudara_kandung_jml", "saudara_tiri_jml", "tinggal_dengan",
    "alamat", "rt", "rw", "desa_kec", "ayah_nama", "ayah_ttl", "ayah_pendidikan", "ayah_pekerjaan",
    "ayah_penghasilan", "ayah_alamat", "ayah_notelp", "ibu_nama", "ibu_ttl", "ibu_pendidikan", "ibu_pekerjaan",
    "ibu_penghasilan", "ibu_alamat", "ibu_notelp", "wali_nama", "wali_ttl", "wali_pendidikan", "wali_pekerjaan",
    "wali_alamat", "wali_notelp", "saudara_kandung_data", "tinggal_bersama", "status_pernikahan",
    "darurat_nama", "darurat_hubungan", "darurat_alamat", "darurat_notelp", "status", "bukti_bayar_url"];

  // Tambahkan kolom yang belum ada (mis. bukti_bayar_url pada sheet lama) tanpa
  // mengubah urutan/data kolom yang sudah ada.
  var currentHeaders = ensureColumns(sh, headers);

  var id = Utilities.getUuid();
  var buktiUrl = saveBuktiBayar(p.bukti_base64, p.bukti_nama, p.bukti_mime);

  var rowData = {
    id: id, timestamp: new Date(), tahun_ajaran: p.tahun_ajaran, kelas_pilihan: p.kelas_pilihan,
    gelombang: p.gelombang, nama: p.nama, panggilan: p.panggilan, jk: p.jk,
    tempat_lahir: p.tempat_lahir, tanggal_lahir: p.tanggal_lahir, anak_ke: p.anak_ke,
    saudara_kandung_jml: p.saudara_kandung_jml, saudara_tiri_jml: p.saudara_tiri_jml,
    tinggal_dengan: p.tinggal_dengan, alamat: p.alamat, rt: p.rt, rw: p.rw, desa_kec: p.desa_kec,
    ayah_nama: p.ayah_nama, ayah_ttl: p.ayah_ttl, ayah_pendidikan: p.ayah_pendidikan,
    ayah_pekerjaan: p.ayah_pekerjaan, ayah_penghasilan: p.ayah_penghasilan, ayah_alamat: p.ayah_alamat,
    ayah_notelp: p.ayah_notelp, ibu_nama: p.ibu_nama, ibu_ttl: p.ibu_ttl, ibu_pendidikan: p.ibu_pendidikan,
    ibu_pekerjaan: p.ibu_pekerjaan, ibu_penghasilan: p.ibu_penghasilan, ibu_alamat: p.ibu_alamat,
    ibu_notelp: p.ibu_notelp, wali_nama: p.wali_nama, wali_ttl: p.wali_ttl, wali_pendidikan: p.wali_pendidikan,
    wali_pekerjaan: p.wali_pekerjaan, wali_alamat: p.wali_alamat, wali_notelp: p.wali_notelp,
    saudara_kandung_data: p.saudara_kandung_data, tinggal_bersama: p.tinggal_bersama,
    status_pernikahan: p.status_pernikahan, darurat_nama: p.darurat_nama, darurat_hubungan: p.darurat_hubungan,
    darurat_alamat: p.darurat_alamat, darurat_notelp: p.darurat_notelp,
    status: "Menunggu Verifikasi", bukti_bayar_url: buktiUrl
  };

  var row = currentHeaders.map(function (h) { return rowData.hasOwnProperty(h) ? rowData[h] : ""; });
  sh.appendRow(row);
  return jsonOutput({ result: "success", id: id, bukti_bayar_url: buktiUrl });
}

function verifyPpdb(id) {
  var sh = sheet("Pendaftaran");
  var row = findRowById(sh, id);
  if (row === -1) return jsonOutput({ result: "error", message: "Data tidak ditemukan" });
  var statusCol = sh.getDataRange().getValues()[0].indexOf("status") + 1;
  sh.getRange(row, statusCol).setValue("Terverifikasi");
  return jsonOutput({ result: "success" });
}

function addBerita(body) {
  var sh = sheet("Berita");
  if (sh.getLastRow() === 0) {
    sh.appendRow(["id", "tanggal", "judul", "isi", "gambar_url"]);
  }
  var id = Utilities.getUuid();
  var gambarUrl = body.gambar_url || "";
  if (body.gambar_base64) {
    var urlUpload = simpanGambarBerita(body.gambar_base64, body.gambar_nama, body.gambar_mime);
    if (urlUpload) gambarUrl = urlUpload;
  }
  sh.appendRow([id, body.tanggal || new Date(), body.judul, body.isi, gambarUrl]);
  return jsonOutput({ result: "success", id: id, gambar_url: gambarUrl });
}

function addPengumuman(body) {
  var sh = sheet("Pengumuman");
  if (sh.getLastRow() === 0) {
    sh.appendRow(["id", "tanggal", "judul", "isi"]);
  }
  var id = Utilities.getUuid();
  sh.appendRow([id, body.tanggal || new Date(), body.judul, body.isi]);
  return jsonOutput({ result: "success", id: id });
}

function deleteRow(sheetName, id) {
  var sh = sheet(sheetName);
  var row = findRowById(sh, id);
  if (row === -1) return jsonOutput({ result: "error", message: "Data tidak ditemukan" });
  sh.deleteRow(row);
  return jsonOutput({ result: "success" });
}

/* ============ RINCIAN BIAYA MASUK ============ */
function addBiaya(body) {
  var sh = sheet("BiayaMasuk");
  if (sh.getLastRow() === 0) {
    sh.appendRow(["id", "kelas", "gelombang", "periode", "item_json", "total", "biaya_bulanan"]);
  }
  var id = Utilities.getUuid();
  sh.appendRow([id, body.kelas, body.gelombang, body.periode || "", body.item_json || "[]", body.total || 0, body.biaya_bulanan || ""]);
  return jsonOutput({ result: "success", id: id });
}

function updateBiaya(body) {
  var sh = sheet("BiayaMasuk");
  var row = findRowById(sh, body.id);
  if (row === -1) return jsonOutput({ result: "error", message: "Data tidak ditemukan" });
  var headers = sh.getDataRange().getValues()[0];
  var values = [body.kelas, body.gelombang, body.periode || "", body.item_json || "[]", body.total || 0, body.biaya_bulanan || ""];
  var cols = ["kelas", "gelombang", "periode", "item_json", "total", "biaya_bulanan"];
  cols.forEach(function (col, i) {
    var colIndex = headers.indexOf(col) + 1;
    sh.getRange(row, colIndex).setValue(values[i]);
  });
  return jsonOutput({ result: "success" });
}

/* ============ PERSYARATAN PENDAFTARAN ============ */
function addPersyaratan(body) {
  var sh = sheet("Persyaratan");
  if (sh.getLastRow() === 0) {
    sh.appendRow(["id", "kategori", "jenis", "daftar_item"]);
  }
  var id = Utilities.getUuid();
  sh.appendRow([id, body.kategori, body.jenis || "Persyaratan", body.daftar_item || ""]);
  return jsonOutput({ result: "success", id: id });
}

function updatePersyaratan(body) {
  var sh = sheet("Persyaratan");
  var row = findRowById(sh, body.id);
  if (row === -1) return jsonOutput({ result: "error", message: "Data tidak ditemukan" });
  var headers = sh.getDataRange().getValues()[0];
  var values = [body.kategori, body.jenis || "Persyaratan", body.daftar_item || ""];
  var cols = ["kategori", "jenis", "daftar_item"];
  cols.forEach(function (col, i) {
    var colIndex = headers.indexOf(col) + 1;
    sh.getRange(row, colIndex).setValue(values[i]);
  });
  return jsonOutput({ result: "success" });
}

/* ============ UNDUH PDF FORMULIR PPDB + BUKTI PEMBAYARAN ============ */

function formatTanggalGs(val) {
  if (!val) return "-";
  if (Object.prototype.toString.call(val) === "[object Date]") {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "dd MMMM yyyy");
  }
  return String(val);
}

// Ambil file ID dari URL Google Drive, mis. https://drive.google.com/file/d/FILE_ID/view
function ekstrakDriveFileId(url) {
  var m = String(url || "").match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// Tambah judul bagian (mis. "A. Keterangan Umum") dengan gaya hijau & tebal.
// Semua atribut di-set eksplisit (termasuk yang di-nonaktifkan) supaya tidak
// "menempel" ke elemen berikutnya yang dibuat setelah ini.
function tambahJudulBagian(body, teks) {
  var p = body.appendParagraph(teks);
  p.setSpacingBefore(10).setSpacingAfter(4);
  p.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
  p.editAsText()
    .setBold(true)
    .setItalic(false)
    .setUnderline(false)
    .setFontSize(11)
    .setForegroundColor("#198754");
  return p;
}

// Tambah tabel 2 kolom (label | value) tanpa border tebal, rapi seperti formulir.
// Style value SELALU direset ke hitam/normal supaya tidak ikut warna/gaya judul.
function tambahTabelLabelValue(body, rows) {
  var table = body.appendTable();
  table.setBorderWidth(0.5);
  rows.forEach(function (r) {
    var tr = table.appendTableRow();
    var c1 = tr.appendTableCell(r[0]);
    c1.setWidth(150);
    c1.editAsText().setBold(true).setItalic(false).setFontSize(9).setForegroundColor("#000000");
    var c2 = tr.appendTableCell(String(r[1] === undefined || r[1] === null || r[1] === "" ? "-" : r[1]));
    c2.editAsText().setBold(false).setItalic(false).setFontSize(9).setForegroundColor("#000000");
  });
  return table;
}

function downloadPpdbPdf(id) {
  var sh = sheet("Pendaftaran");
  var semua = sheetToObjects(sh);
  var d = null;
  for (var i = 0; i < semua.length; i++) {
    if (String(semua[i].id) === String(id)) { d = semua[i]; break; }
  }
  if (!d) return jsonOutput({ result: "error", message: "Data pendaftar tidak ditemukan" });

  var doc = DocumentApp.create("Formulir PPDB - " + (d.nama || id));
  var body = doc.getBody();
  body.setMarginTop(24).setMarginBottom(24).setMarginLeft(36).setMarginRight(36);

  // ---- Kop Surat ----
  // Bikin paragraf kosong rata-tengah dulu, baru gambar disisipkan LANGSUNG ke
  // paragraf itu (paragraph.appendInlineImage). Ini lebih pasti daripada
  // body.appendImage() + reparenting, yang di beberapa kasus bisa gagal.
  try {
    var headerBlob = Utilities.newBlob(Utilities.base64Decode(LETTERHEAD_BASE64), "image/png", "kop.png");
    var kopPar = body.appendParagraph("");
    kopPar.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    var img = kopPar.appendInlineImage(headerBlob);
    var ratio = img.getHeight() / img.getWidth();
    img.setWidth(480);
    img.setHeight(Math.round(480 * ratio));
  } catch (err) {
    var fallbackPar = body.appendParagraph("YAYASAN ULUL FIKRI INDONESIA (YUFI) - MADRASAH IBTIDAIYAH ULUL FIKRI: " + err.message);
    fallbackPar.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    fallbackPar.editAsText().setBold(true).setItalic(false).setForegroundColor("#000000");
  }

  var garis = body.appendParagraph("");
  garis.appendHorizontalRule();

  // ---- Judul ----
  var judul = body.appendParagraph("FORMULIR PENDAFTARAN PESERTA DIDIK BARU (PPDB)");
  judul.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  judul.editAsText().setBold(true).setItalic(false).setFontSize(13).setForegroundColor("#000000");

  var sub = body.appendParagraph(
    "Tahun Ajaran " + (d.tahun_ajaran || "-") + "  |  Kelas: " + (d.kelas_pilihan || "-") + "  |  " + (d.gelombang || "-")
  );
  sub.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  sub.editAsText().setBold(false).setItalic(true).setFontSize(10).setForegroundColor("#000000");

  var spasiAwal = body.appendParagraph("");
  spasiAwal.editAsText().setItalic(false).setBold(false).setForegroundColor("#000000");

  // ---- A. Keterangan Umum ----
  tambahJudulBagian(body, "A. Keterangan Umum Siswa");
  tambahTabelLabelValue(body, [
    ["Nama Lengkap", d.nama],
    ["Nama Panggilan", d.panggilan],
    ["Jenis Kelamin", d.jk],
    ["Tempat, Tanggal Lahir", (d.tempat_lahir || "-") + ", " + formatTanggalGs(d.tanggal_lahir)],
    ["Anak Ke", d.anak_ke],
    ["Jml Saudara Kandung", d.saudara_kandung_jml],
    ["Jml Saudara Tiri", d.saudara_tiri_jml],
    ["Tinggal Dengan", d.tinggal_dengan],
    ["Alamat", d.alamat],
    ["RT / RW", (d.rt || "-") + " / " + (d.rw || "-")],
    ["Desa / Kecamatan", d.desa_kec],
  ]);

  // ---- B. Orang Tua ----
  tambahJudulBagian(body, "B. Keterangan Orang Tua - Ayah");
  tambahTabelLabelValue(body, [
    ["Nama Ayah", d.ayah_nama],
    ["Tempat/Tgl Lahir", d.ayah_ttl],
    ["Pendidikan", d.ayah_pendidikan],
    ["Pekerjaan", d.ayah_pekerjaan],
    ["Penghasilan/Bulan", d.ayah_penghasilan],
    ["Alamat", d.ayah_alamat],
    ["No. Telp/HP", d.ayah_notelp],
  ]);

  tambahJudulBagian(body, "Keterangan Orang Tua - Ibu");
  tambahTabelLabelValue(body, [
    ["Nama Ibu", d.ibu_nama],
    ["Tempat/Tgl Lahir", d.ibu_ttl],
    ["Pendidikan", d.ibu_pendidikan],
    ["Pekerjaan", d.ibu_pekerjaan],
    ["Penghasilan/Bulan", d.ibu_penghasilan],
    ["Alamat", d.ibu_alamat],
    ["No. Telp/HP", d.ibu_notelp],
  ]);

  // ---- C. Wali (kalau ada) ----
  if (d.wali_nama) {
    tambahJudulBagian(body, "C. Keterangan Wali");
    tambahTabelLabelValue(body, [
      ["Nama Wali", d.wali_nama],
      ["Tempat/Tgl Lahir", d.wali_ttl],
      ["Pendidikan", d.wali_pendidikan],
      ["Pekerjaan", d.wali_pekerjaan],
      ["Alamat", d.wali_alamat],
      ["No. Telp/HP", d.wali_notelp],
    ]);
  }

  // ---- D. Saudara Kandung ----
  tambahJudulBagian(body, "D. Saudara Kandung");
  var saudara = [];
  try { saudara = JSON.parse(d.saudara_kandung_data || "[]"); } catch (e) { saudara = []; }
  if (saudara.length) {
    var tbl = body.appendTable();
    tbl.setBorderWidth(0.5);
    var headRow = tbl.appendTableRow();
    ["Nama Lengkap", "L/P", "Pendidikan", "Sekolah"].forEach(function (h) {
      var c = headRow.appendTableCell(h);
      c.editAsText().setBold(true).setItalic(false).setFontSize(9).setForegroundColor("#000000");
    });
    saudara.forEach(function (s) {
      var row = tbl.appendTableRow();
      [s.nama, s.jk, s.pendidikan, s.sekolah].forEach(function (val) {
        row.appendTableCell(val || "-").editAsText().setBold(false).setItalic(false).setFontSize(9).setForegroundColor("#000000");
      });
    });
  } else {
    var tanpaSaudara = body.appendParagraph("Tidak ada data saudara kandung.");
    tanpaSaudara.editAsText().setBold(false).setItalic(true).setFontSize(9).setForegroundColor("#000000");
  }

  // ---- E. Situasi Keluarga ----
  tambahJudulBagian(body, "E. Situasi Keluarga");
  tambahTabelLabelValue(body, [
    ["Siswa Tinggal Bersama", d.tinggal_bersama],
    ["Status Pernikahan Orang Tua", d.status_pernikahan],
  ]);

  // ---- F. Kontak Darurat ----
  tambahJudulBagian(body, "F. Kontak Darurat");
  tambahTabelLabelValue(body, [
    ["Nama yang Dihubungi", d.darurat_nama],
    ["Hubungan dengan Murid", d.darurat_hubungan],
    ["Alamat", d.darurat_alamat],
    ["No. Telp/HP", d.darurat_notelp],
  ]);

  // ---- Status ----
  tambahJudulBagian(body, "Status Pendaftaran");
  tambahTabelLabelValue(body, [
    ["Status", d.status],
    ["Tanggal Daftar", formatTanggalGs(d.timestamp)],
  ]);

  // ---- Lampiran Bukti Pembayaran (halaman baru) ----
  body.appendPageBreak();
  tambahJudulBagian(body, "Lampiran: Bukti Pembayaran");

  if (d.bukti_bayar_url) {
    var fileId = ekstrakDriveFileId(d.bukti_bayar_url);
    var berhasilSisip = false;
    if (fileId) {
      try {
        var file = DriveApp.getFileById(fileId);
        var mime = file.getMimeType();
        if (mime.indexOf("image/") === 0) {
          var buktiPar = body.appendParagraph("");
          buktiPar.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
          var buktiImg = buktiPar.appendInlineImage(file.getBlob());
          var r2 = buktiImg.getHeight() / buktiImg.getWidth();
          var lebar = 350;
          buktiImg.setWidth(lebar);
          buktiImg.setHeight(Math.round(lebar * r2));
          berhasilSisip = true;
        }
      } catch (err) {
        berhasilSisip = false;
        var errMsg = err.message;
      }
    }
    if (!berhasilSisip) {
      var linkPar = body.appendParagraph("Bukti pembayaran (file bukan gambar / gagal dimuat" + (typeof errMsg !== "undefined" && errMsg ? (": " + errMsg) : "") + "). Lihat langsung di:");
      linkPar.editAsText().setBold(false).setItalic(false).setFontSize(9).setForegroundColor("#000000");
      var urlPar = body.appendParagraph(d.bukti_bayar_url);
      urlPar.editAsText().setLinkUrl(d.bukti_bayar_url).setBold(false).setItalic(false).setFontSize(9);
    }
  } else {
    var takAdaBukti = body.appendParagraph("Belum ada bukti pembayaran yang diupload.");
    takAdaBukti.editAsText().setBold(false).setItalic(true).setFontSize(9).setForegroundColor("#000000");
  }

  doc.saveAndClose();

  var pdfBlob = DriveApp.getFileById(doc.getId()).getAs("application/pdf");
  var base64Pdf = Utilities.base64Encode(pdfBlob.getBytes());

  // Bersihkan dokumen sementara dari Drive setelah PDF diambil
  try { DriveApp.getFileById(doc.getId()).setTrashed(true); } catch (err) { }

  var namaFile = "Formulir_PPDB_" + String(d.nama || "siswa").replace(/[^a-zA-Z0-9]+/g, "_") + ".pdf";
  return jsonOutput({ result: "success", filename: namaFile, pdf_base64: base64Pdf });
}