console.log("Dashboard Siap");
// Nanti kode pengambil data Google Sheets akan berjalan di sini
fetch('https://script.google.com/macros/s/AKfycbxdbl-HUmPa6M1OD5lOm23aw-fGkk59-M1HHZL4QDRphy48Yjt_h2a8EY6vJ7qn10W43w/exec')
    .then(res => res.json())
    .then(data => console.log("Data berhasil diambil:", data))
    .catch(err => console.error("Gagal:", err));