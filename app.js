function renderExecutiveDashboard() {
    const container = document.getElementById('executive-summary');
    
    // 1. Filter Pekerjaan yang butuh perhatian (Isu/Delay)
    const urgentItems = dashboardData.master.filter(i => 
        i.isu_utama || i.status.toLowerCase().includes('hold')
    );

    // 2. Render Kartu Urgent
    container.innerHTML = `
        <div class="card status-red">
            <h3>Pekerjaan Butuh Perhatian (${urgentItems.length})</h3>
            ${urgentItems.map(i => `<p><strong>${i.nama_pekerjaan}</strong>: ${i.isu_utama || 'Status On Hold'}</p>`).join('')}
        </div>
        <div class="card">
            <h3>Ringkasan Operasional</h3>
            <div class="big-number">${dashboardData.master.length}</div>
            <p>Total Pekerjaan Aktif</p>
        </div>
    `;
}

// 3. Render Pekerjaan sebagai Kartu, bukan Tabel
function renderPekerjaanCards(data) {
    const grid = document.getElementById('grid-pekerjaan');
    grid.innerHTML = data.map(item => `
        <div class="card ${item.progress_percent < 20 ? 'status-yellow' : 'status-green'}">
            <h4>${item.nama_pekerjaan}</h4>
            <p>Vendor: ${item.vendor}</p>
            <div class="progress-bar"><div class="progress-fill" style="width: ${item.progress_percent}%"></div></div>
            <p>Progress: ${item.progress_percent}%</p>
            <div class="action-links">
                <a href="${item.link_rab_detail}" target="_blank">RAB</a> |
                <a href="${item.link_dokumentasi}" target="_blank">Dokumentasi</a>
            </div>
        </div>
    `).join('');
}
