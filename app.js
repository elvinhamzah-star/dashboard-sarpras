const API_URL = 'https://script.google.com/macros/s/AKfycbxdbl-HUmPa6M1OD5lOm23aw-fGkk59-M1HHZL4QDRphy48Yjt_h2a8EY6vJ7qn10W43w/exec';

let dashboardData = {
    master: [],
    timeline: [],
    realisasi: [],
    pengajuan: [],
    dokumentasi: []
};

let charts = {};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSearch();
    initGalleryFilters();
    initModalClose();
    fetchData();
});

function fetchData() {
    fetch(API_URL)
        .then(response => response.json())
        .then(data => {
            dashboardData = data;
            document.getElementById('loading').style.display = 'none';
            renderAllSections();
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            document.getElementById('loading').innerText = 'Gagal memuat data. Silakan periksa koneksi atau URL API.';
        });
}

function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabs = document.querySelectorAll('.tab-content');

    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            navBtns.forEach(b => b.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));

            const targetId = e.target.getAttribute('data-target');
            e.target.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

function formatCurrency(val) {
    if (!val) return 'Rp 0';
    let num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
    if (isNaN(num)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

function getStatusClass(status) {
    if (!status) return 'status-plan';
    const s = status.toLowerCase();
    if (s.includes('hold')) return 'status-on-hold';
    if (s.includes('going') || s.includes('proses')) return 'status-on-going';
    if (s.includes('selesai')) return 'status-selesai';
    return 'status-perencanaan';
}

function renderAllSections() {
    renderRingkasan();
    renderOperasional(dashboardData.master);
    renderFinansial();
    renderPengajuan();
    renderDokumen();
    renderGaleri('Semua');
}

// SECTION: RINGKASAN
function renderRingkasan() {
    let tAnggaran = 0;
    let tRealisasi = 0;
    let statusCounts = {};
    const alerts = [];

    dashboardData.master.forEach(item => {
        const ang = parseFloat(String(item.Total_Anggaran || 0).replace(/[^0-9.-]+/g, "")) || 0;
        const rel = parseFloat(String(item.Realisasi_Terkini || 0).replace(/[^0-9.-]+/g, "")) || 0;
        tAnggaran += ang;
        tRealisasi += rel;

        const stat = item.Status || 'Tidak Diketahui';
        statusCounts[stat] = (statusCounts[stat] || 0) + 1;

        // Alerts Logic
        const progress = parseFloat(item.Progress_Percent) || 0;
        const sLower = stat.toLowerCase();

        if (sLower.includes('hold')) {
            alerts.push({ type: 'danger', msg: `[${item.ID}] ${item.Nama_Pekerjaan} - Status On Hold.` });
        }
        if (sLower.includes('going') && progress < 20) {
            alerts.push({ type: 'warning', msg: `[${item.ID}] ${item.Nama_Pekerjaan} - Progress lambat (${progress}%).` });
        }
        if (item.Isu_Utama && String(item.Isu_Utama).trim() !== '-' && String(item.Isu_Utama).trim() !== '') {
            alerts.push({ type: 'warning', msg: `[${item.ID}] Isu: ${item.Isu_Utama}` });
        }
    });

    const sisa = tAnggaran - tRealisasi;
    const penyerapan = tAnggaran > 0 ? ((tRealisasi / tAnggaran) * 100).toFixed(1) : 0;

    document.getElementById('kpi-ringkasan').innerHTML = `
        <div class="card kpi-card"><h3>Total Anggaran</h3><p>${formatCurrency(tAnggaran)}</p></div>
        <div class="card kpi-card"><h3>Total Realisasi</h3><p>${formatCurrency(tRealisasi)}</p></div>
        <div class="card kpi-card"><h3>Sisa Anggaran</h3><p>${formatCurrency(sisa)}</p></div>
        <div class="card kpi-card"><h3>Persentase Penyerapan</h3><p>${penyerapan}%</p></div>
    `;

    const alertContainer = document.getElementById('alerts-container');
    if (alerts.length === 0) {
        alertContainer.innerHTML = '<div class="alert-item alert-warning" style="border-left-color: #15803d; background: #dcfce7; color: #15803d;">Tidak ada alert. Kondisi lapangan stabil.</div>';
    } else {
        alertContainer.innerHTML = alerts.map(a => `<div class="alert-item alert-${a.type}">${a.msg}</div>`).join('');
    }

    renderChart('statusChart', 'doughnut', Object.keys(statusCounts), [{
        data: Object.values(statusCounts),
        backgroundColor: ['#e0f2fe', '#dcfce7', '#fee2e2', '#f1f5f9', '#D4AF37'],
        borderWidth: 1
    }]);
}

// SECTION: OPERASIONAL
function renderOperasional(data) {
    const tbody = document.querySelector('#opsTable tbody');
    tbody.innerHTML = data.map(item => `
        <tr class="clickable-row" onclick="openModal('${item.ID}')">
            <td data-label="ID">${item.ID || '-'}</td>
            <td data-label="Program">${item.Program || '-'}</td>
            <td data-label="Nama Pekerjaan"><strong>${item.Nama_Pekerjaan || '-'}</strong></td>
            <td data-label="Jenis Pekerjaan">${item.Jenis_Pekerjaan || '-'}</td>
            <td data-label="Status"><span class="badge ${getStatusClass(item.Status)}">${item.Status || '-'}</span></td>
            <td data-label="Progress"><strong>${item.Progress_Percent || '0'}%</strong></td>
            <td data-label="Vendor">${item.Vendor || '-'}</td>
            <td data-label="Target Selesai">${item.Target_Selesai || '-'}</td>
        </tr>
    `).join('');
}

function initSearch() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = dashboardData.master.filter(item => 
            String(item.ID).toLowerCase().includes(term) ||
            String(item.Program).toLowerCase().includes(term) ||
            String(item.Nama_Pekerjaan).toLowerCase().includes(term) ||
            String(item.Vendor).toLowerCase().includes(term)
        );
        renderOperasional(filtered);
    });
}

function openModal(id) {
    const master = dashboardData.master.find(i => i.ID === id);
    const timeline = dashboardData.timeline.find(i => i.ID === id) || {};
    
    if(!master) return;

    document.getElementById('modalTitle').innerText = master.Nama_Pekerjaan;
    
    let linksHtml = '';
    if(master.Link_RAB_Detail) linksHtml += `<a href="${master.Link_RAB_Detail}" target="_blank" class="link-btn">RAB Detail</a><br><br>`;
    if(master.Link_Dokumentasi) linksHtml += `<a href="${master.Link_Dokumentasi}" target="_blank" class="link-btn">Dokumentasi</a><br><br>`;
    if(master.Link_Bukti_Transaksi) linksHtml += `<a href="${master.Link_Bukti_Transaksi}" target="_blank" class="link-btn">Bukti Transaksi</a>`;

    document.getElementById('modalContent').innerHTML = `
        <div class="modal-grid">
            <div><strong>ID:</strong> ${master.ID}</div>
            <div><strong>Program:</strong> ${master.Program}</div>
            <div><strong>Vendor:</strong> ${master.Vendor}</div>
            <div><strong>Target Selesai:</strong> ${master.Target_Selesai}</div>
            <div><strong>Status Master:</strong> <span class="badge ${getStatusClass(master.Status)}">${master.Status}</span></div>
            <div><strong>Progress Master:</strong> ${master.Progress_Percent}%</div>
        </div>
        
        <div class="modal-section">
            <h4>Timeline & Kondisi Lapangan</h4>
            <div class="modal-grid">
                <div><strong>Start Date:</strong> ${timeline.Start_Date || '-'}</div>
                <div><strong>End Date:</strong> ${timeline.End_Date || '-'}</div>
                <div><strong>Status Lapangan:</strong> ${timeline.Status_Lapangan || '-'}</div>
                <div><strong>Progress Timeline:</strong> ${timeline.Progress_Percent ? timeline.Progress_Percent + '%' : '-'}</div>
            </div>
            <p><strong>Isu Utama (Master):</strong> ${master.Isu_Utama || '-'}</p>
            <p><strong>Isu Kendala (Timeline):</strong> ${timeline.Isu_Kendala || '-'}</p>
        </div>

        <div class="modal-section">
            <h4>Tautan Dokumen Pendukung</h4>
            ${linksHtml || '<p class="muted">Tidak ada dokumen tertaut.</p>'}
        </div>
    `;

    document.getElementById('detailModal').style.display = 'flex';
}

function initModalClose() {
    const modal = document.getElementById('detailModal');
    document.querySelector('.modal-close').onclick = () => modal.style.display = 'none';
    modal.onclick = (e) => { if(e.target === modal) modal.style.display = 'none'; };
}

// SECTION: FINANSIAL
function renderFinansial() {
    let tAnggaran = 0, tRealisasi = 0;
    const labels = [], dataAnggaran = [], dataRealisasi = [];

    dashboardData.master.forEach(item => {
        const ang = parseFloat(String(item.Total_Anggaran || 0).replace(/[^0-9.-]+/g, "")) || 0;
        const rel = parseFloat(String(item.Realisasi_Terkini || 0).replace(/[^0-9.-]+/g, "")) || 0;
        tAnggaran += ang;
        tRealisasi += rel;

        if (ang > 0 || rel > 0) {
            labels.push(item.Nama_Pekerjaan.length > 25 ? item.Nama_Pekerjaan.substring(0,25)+'...' : item.Nama_Pekerjaan);
            dataAnggaran.push(ang);
            dataRealisasi.push(rel);
        }
    });

    document.getElementById('kpi-finansial').innerHTML = `
        <div class="card kpi-card"><h3>Total Anggaran</h3><p>${formatCurrency(tAnggaran)}</p></div>
        <div class="card kpi-card"><h3>Total Realisasi</h3><p>${formatCurrency(tRealisasi)}</p></div>
        <div class="card kpi-card"><h3>Sisa Anggaran</h3><p>${formatCurrency(tAnggaran - tRealisasi)}</p></div>
    `;

    document.querySelector('#finTable tbody').innerHTML = dashboardData.realisasi.map(item => `
        <tr>
            <td data-label="Tanggal Realisasi">${item.Tanggal_Realisasi || '-'}</td>
            <td data-label="Nama Pekerjaan"><strong>${item.Nama_Pekerjaan || '-'}</strong></td>
            <td data-label="Deskripsi Biaya">${item.Deskripsi_Biaya || '-'}</td>
            <td data-label="Nominal Realisasi"><strong>${formatCurrency(item.Nominal_Realisasi)}</strong></td>
            <td data-label="Status Dana"><span class="badge ${getStatusClass(item.Status_Dana)}">${item.Status_Dana || '-'}</span></td>
        </tr>
    `).join('');

    renderChart('finansialChart', 'bar', labels, [
        { label: 'Anggaran', data: dataAnggaran, backgroundColor: '#222222' },
        { label: 'Realisasi', data: dataRealisasi, backgroundColor: '#D4AF37' }
    ]);
}

// SECTION: PENGAJUAN DANA
function renderPengajuan() {
    document.querySelector('#pengajuanTable tbody').innerHTML = dashboardData.pengajuan.map(item => {
        const linkHtml = (item.Link_Doc_Pengajuan && item.Link_Doc_Pengajuan.startsWith('http')) 
            ? `<a href="${item.Link_Doc_Pengajuan}" target="_blank" class="link-btn">Buka</a>` 
            : '-';
        return `
        <tr>
            <td data-label="Tanggal Pengajuan">${item.Tanggal_Pengajuan || '-'}</td>
            <td data-label="Nama Pekerjaan"><strong>${item.Nama_Pekerjaan || '-'}</strong></td>
            <td data-label="Nilai Pengajuan">${formatCurrency(item.Nilai_Pengajuan)}</td>
            <td data-label="Status Pencairan"><span class="badge ${getStatusClass(item.Status_Pencairan)}">${item.Status_Pencairan || '-'}</span></td>
            <td data-label="Dokumen">${linkHtml}</td>
        </tr>
    `}).join('');
}

// SECTION: DOKUMEN
function renderDokumen() {
    document.querySelector('#dokumenTable tbody').innerHTML = dashboardData.master.map(item => {
        const rab = item.Link_RAB_Detail && item.Link_RAB_Detail.startsWith('http') ? `<a href="${item.Link_RAB_Detail}" target="_blank" class="link-btn">RAB</a>` : '-';
        const dok = item.Link_Dokumentasi && item.Link_Dokumentasi.startsWith('http') ? `<a href="${item.Link_Dokumentasi}" target="_blank" class="link-btn">Dokumentasi</a>` : '-';
        const bkt = item.Link_Bukti_Transaksi && item.Link_Bukti_Transaksi.startsWith('http') ? `<a href="${item.Link_Bukti_Transaksi}" target="_blank" class="link-btn">Bukti</a>` : '-';
        return `
        <tr>
            <td data-label="Nama Pekerjaan"><strong>${item.Nama_Pekerjaan || '-'}</strong></td>
            <td data-label="Link RAB Detail">${rab}</td>
            <td data-label="Link Dokumentasi">${dok}</td>
            <td data-label="Link Bukti Transaksi">${bkt}</td>
        </tr>
    `}).join('');
}

// SECTION: GALERI DOKUMENTASI
function initGalleryFilters() {
    const btns = document.querySelectorAll('.filter-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            btns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderGaleri(e.target.getAttribute('data-filter'));
        });
    });
}

function renderGaleri(filter) {
    const container = document.getElementById('galleryContainer');
    let data = dashboardData.dokumentasi;

    if (filter !== 'Semua') {
        data = data.filter(item => String(item.Kategori_Foto).toLowerCase() === filter.toLowerCase());
    }

    if (data.length === 0) {
        container.innerHTML = `<p class="muted">Tidak ada foto untuk kategori ${filter}.</p>`;
        return;
    }

    container.innerHTML = data.map(item => `
        <div class="gallery-card">
            <img src="${item.Link_Foto || 'https://via.placeholder.com/400x300?text=No+Image'}" alt="${item.Kategori_Foto}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300?text=Image+Not+Found'">
            <div class="gallery-info">
                <h4>${item.Nama_Pekerjaan || '-'}</h4>
                <p><strong>Kategori:</strong> ${item.Kategori_Foto || '-'}</p>
                <p>${item.Caption || '-'}</p>
                <div class="date">${item.Tanggal_Upload || '-'}</div>
            </div>
        </div>
    `).join('');
}

// UTILS: Chart JS
function renderChart(canvasId, type, labels, datasets) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
        type: type,
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: type === 'doughnut' ? 'right' : 'top' }
            }
        }
    });
}
