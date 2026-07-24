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

// Simpan file bukti pembayaran (base64) ke Google Drive dan kembalikan URL-nya.
// Jika tidak ada file (base64 kosong), kembalikan string kosong.
function saveBuktiBayar(base64, filename, mime) {
  if (!base64) return "";
  try {
    var folderName = "Bukti Pembayaran PPDB";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    var bytes = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(bytes, mime || "application/octet-stream", filename || ("bukti_bayar_" + new Date().getTime()));
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    return "";
  }
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
  var action = data.action || "submit_ppdb";

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

  return jsonOutput({ result: "error", message: "Aksi tidak dikenali" });
}

function submitPpdb(p) {
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
  sh.appendRow([id, body.tanggal || new Date(), body.judul, body.isi, body.gambar_url || ""]);
  return jsonOutput({ result: "success", id: id });
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
