const API_URL = 'https://script.google.com/macros/s/AKfycbxdbl-HUmPa6M1OD5lOm23aw-fGkk59-M1HHZL4QDRphy48Yjt_h2a8EY6vJ7qn10W43w/exec';

fetch(API_URL)
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById('content');
        const master = data.master;
        
        let tAnggaran = 0, tRealisasi = 0;

        // Proses data untuk ringkasan
        master.forEach(item => {
            // Membersihkan format "Rp 1.000.000" menjadi angka 1000000
            let ang = parseFloat(String(item.total_anggaran || 0).replace(/[^0-9.-]+/g,""));
            let rel = parseFloat(String(item.realisasi_terkini || 0).replace(/[^0-9.-]+/g,""));
            tAnggaran += (isNaN(ang) ? 0 : ang);
            tRealisasi += (isNaN(rel) ? 0 : rel);
        });

        // Tampilkan Dashboard
        container.innerHTML = `
            <div class="summary-cards">
                <div class="card"><h3>Total Anggaran</h3><p>Rp ${tAnggaran.toLocaleString('id-ID')}</p></div>
                <div class="card"><h3>Total Realisasi</h3><p>Rp ${tRealisasi.toLocaleString('id-ID')}</p></div>
                <div class="card"><h3>Sisa</h3><p>Rp ${(tAnggaran - tRealisasi).toLocaleString('id-ID')}</p></div>
            </div>
            <h2>Data Program Maintenance</h2>
            <table>
                <thead>
                    <tr><th>Program</th><th>Nama Pekerjaan</th><th>Status</th><th>Anggaran</th><th>Realisasi</th></tr>
                </thead>
                <tbody>
                    ${master.map(item => `
                        <tr onclick="showDetail('${item.nama_pekerjaan}')" style="cursor:pointer;">
                            <td>${item.program || '-'}</td>
                            <td>${item.nama_pekerjaan || '-'}</td>
                            <td>${item.status || '-'}</td>
                            <td>${item.total_anggaran || 'Rp 0'}</td>
                            <td>${item.realisasi_terkini || 'Rp 0'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    });

function showDetail(nama) {
    alert("Detail untuk: " + nama); // Nanti ini bisa kita arahkan ke Modal
}
