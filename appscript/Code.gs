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
  var action = body.action || p.action || "submit_ppdb";

  if (action === "submit_ppdb") {
    return submitPpdb(p);
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
  if (sh.getLastRow() === 0) {
    sh.appendRow(["id", "timestamp", "tahun_ajaran", "kelas_pilihan", "gelombang", "nama", "panggilan", "jk",
      "tempat_lahir", "tanggal_lahir", "anak_ke", "saudara_kandung_jml", "saudara_tiri_jml", "tinggal_dengan",
      "alamat", "rt", "rw", "desa_kec", "ayah_nama", "ayah_ttl", "ayah_pendidikan", "ayah_pekerjaan",
      "ayah_penghasilan", "ayah_alamat", "ayah_notelp", "ibu_nama", "ibu_ttl", "ibu_pendidikan", "ibu_pekerjaan",
      "ibu_penghasilan", "ibu_alamat", "ibu_notelp", "wali_nama", "wali_ttl", "wali_pendidikan", "wali_pekerjaan",
      "wali_alamat", "wali_notelp", "saudara_kandung_data", "tinggal_bersama", "status_pernikahan",
      "darurat_nama", "darurat_hubungan", "darurat_alamat", "darurat_notelp", "status"]);
  }
  var id = Utilities.getUuid();
  sh.appendRow([
    id, new Date(), p.tahun_ajaran, p.kelas_pilihan, p.gelombang, p.nama, p.panggilan, p.jk,
    p.tempat_lahir, p.tanggal_lahir, p.anak_ke, p.saudara_kandung_jml, p.saudara_tiri_jml, p.tinggal_dengan,
    p.alamat, p.rt, p.rw, p.desa_kec, p.ayah_nama, p.ayah_ttl, p.ayah_pendidikan, p.ayah_pekerjaan,
    p.ayah_penghasilan, p.ayah_alamat, p.ayah_notelp, p.ibu_nama, p.ibu_ttl, p.ibu_pendidikan, p.ibu_pekerjaan,
    p.ibu_penghasilan, p.ibu_alamat, p.ibu_notelp, p.wali_nama, p.wali_ttl, p.wali_pendidikan, p.wali_pekerjaan,
    p.wali_alamat, p.wali_notelp, p.saudara_kandung_data, p.tinggal_bersama, p.status_pernikahan,
    p.darurat_nama, p.darurat_hubungan, p.darurat_alamat, p.darurat_notelp, "Menunggu Verifikasi"
  ]);
  return jsonOutput({ result: "success", id: id });
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
