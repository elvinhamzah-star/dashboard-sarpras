const API_URL = 'https://script.google.com/macros/s/AKfycbxdbl-HUmPa6M1OD5lOm23aw-fGkk59-M1HHZL4QDRphy48Yjt_h2a8EY6vJ7qn10W43w/exec';

fetch(API_URL)
    .then(res => res.json())
    .then(data => {
        const content = document.getElementById('content');
        // Contoh menampilkan data master
        let html = '<h2>Data Master Program</h2><table><tr><th>ID</th><th>Program</th></tr>';
        data.master.forEach(item => {
            html += `<tr><td>${item.id}</td><td>${item.nama_program}</td></tr>`;
        });
        html += '</table>';
        content.innerHTML = html;
    })
    .catch(err => console.error("Error:", err));
