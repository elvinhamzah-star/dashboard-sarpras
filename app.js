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
        const ang = parseFloat(String(item.total_anggaran || 0).replace(/[^0-9.-]+/g, "")) || 0;
        const rel = parseFloat(String(item.realisasi_terkini || 0).replace(/[^0-9.-]+/g, "")) || 0;
        tAnggaran += ang;
        tRealisasi += rel;

        const stat = item.status || 'Tidak Diketahui';
        statusCounts[stat] = (statusCounts[stat] || 0) + 1;

        // Alerts Logic
        const progress = parseFloat(item.progress_percent) || 0;
        const sLower = stat.toLowerCase();

        if (sLower.includes('hold')) {
            alerts.push({ type: 'danger', msg: `[${item.id}] ${item.nama_pekerjaan} - Status On Hold.` });
        }
        if (sLower.includes('going') && progress < 20) {
            alerts.push({ type: 'warning', msg: `[${item.id}] ${item.nama_pekerjaan} - Progress lambat (${progress}%).` });
        }
        if (item.isu_utama && String(item.isu_utama).trim() !== '-' && String(item.isu_utama).trim() !== '') {
            alerts.push({ type: 'warning', msg: `[${item.id}] Isu: ${item.isu_utama}` });
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
        <tr class="clickable-row" onclick="openModal('${item.id}')">
            <td data-label="ID">${item.id || '-'}</td>
            <td data-label="Program">${item.program || '-'}</td>
            <td data-label="Nama Pekerjaan"><strong>${item.nama_pekerjaan || '-'}</strong></td>
            <td data-label="Jenis Pekerjaan">${item.jenis_pekerjaan || '-'}</td>
            <td data-label="Status"><span class="badge ${getStatusClass(item.status)}">${item.status || '-'}</span></td>
            <td data-label="Progress"><strong>${item.progress_percent || '0'}%</strong></td>
            <td data-label="Vendor">${item.vendor || '-'}</td>
            <td data-label="Target Selesai">${item.target_selesai || '-'}</td>
        </tr>
    `).join('');
}

function initSearch() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = dashboardData.master.filter(item => 
            String(item.id).toLowerCase().includes(term) ||
            String(item.program).toLowerCase().includes(term) ||
            String(item.nama_pekerjaan).toLowerCase().includes(term) ||
            String(item.vendor).toLowerCase().includes(term)
        );
        renderOperasional(filtered);
    });
}

function openModal(id) {
    const master = dashboardData.master.find(i => i.id === id);
    const timeline = dashboardData.timeline.find(i => i.id === id) || {};
    
    if(!master) return;

    document.getElementById('modalTitle').innerText = master.nama_pekerjaan;
    
    let linksHtml = '';
    if(master.link_rab_detail) linksHtml += `<a href="${master.link_rab_detail}" target="_blank" class="link-btn">RAB Detail</a><br><br>`;
    if(master.link_dokumentasi) linksHtml += `<a href="${master.link_dokumentasi}" target="_blank" class="link-btn">Dokumentasi</a><br><br>`;
    if(master.link_bukti_transaksi) linksHtml += `<a href="${master.link_bukti_transaksi}" target="_blank" class="link-btn">Bukti Transaksi</a>`;

    document.getElementById('modalContent').innerHTML = `
        <div class="modal-grid">
            <div><strong>ID:</strong> ${master.id}</div>
            <div><strong>Program:</strong> ${master.program}</div>
            <div><strong>Vendor:</strong> ${master.vendor}</div>
            <div><strong>Target Selesai:</strong> ${master.target_selesai}</div>
            <div><strong>Status Master:</strong> <span class="badge ${getStatusClass(master.status)}">${master.status}</span></div>
            <div><strong>Progress Master:</strong> ${master.progress_percent}%</div>
        </div>
        
        <div class="modal-section">
            <h4>Timeline & Kondisi Lapangan</h4>
            <div class="modal-grid">
                <div><strong>Start Date:</strong> ${timeline.start_date || '-'}</div>
                <div><strong>End Date:</strong> ${timeline.end_date || '-'}</div>
                <div><strong>Status Lapangan:</strong> ${timeline.status_lapangan || '-'}</div>
                <div><strong>Progress Timeline:</strong> ${timeline.progress_percent ? timeline.progress_percent + '%' : '-'}</div>
            </div>
            <p><strong>Isu Utama (Master):</strong> ${master.isu_utama || '-'}</p>
            <p><strong>Isu Kendala (Timeline):</strong> ${timeline.isu_kendala || '-'}</p>
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
        const ang = parseFloat(String(item.total_anggaran || 0).replace(/[^0-9.-]+/g, "")) || 0;
        const rel = parseFloat(String(item.realisasi_terkini || 0).replace(/[^0-9.-]+/g, "")) || 0;
        tAnggaran += ang;
        tRealisasi += rel;

        if (ang > 0 || rel > 0) {
            labels.push(item.nama_pekerjaan.length > 25 ? item.nama_pekerjaan.substring(0,25)+'...' : item.nama_pekerjaan);
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
            <td data-label="Tanggal Realisasi">${item.tanggal_realisasi || '-'}</td>
            <td data-label="Nama Pekerjaan"><strong>${item.nama_pekerjaan || '-'}</strong></td>
            <td data-label="Deskripsi Biaya">${item.deskripsi_biaya || '-'}</td>
            <td data-label="Nominal Realisasi"><strong>${formatCurrency(item.nominal_realisasi)}</strong></td>
            <td data-label="Status Dana"><span class="badge ${getStatusClass(item.status_dana)}">${item.status_dana || '-'}</span></td>
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
        const linkHtml = (item.link_doc_pengajuan && item.link_doc_pengajuan.startsWith('http')) 
            ? `<a href="${item.link_doc_pengajuan}" target="_blank" class="link-btn">Buka</a>` 
            : '-';
        return `
        <tr>
            <td data-label="Tanggal Pengajuan">${item.tanggal_pengajuan || '-'}</td>
            <td data-label="Nama Pekerjaan"><strong>${item.nama_pekerjaan || '-'}</strong></td>
            <td data-label="Nilai Pengajuan">${formatCurrency(item.nilai_pengajuan)}</td>
            <td data-label="Status Pencairan"><span class="badge ${getStatusClass(item.status_pencairan)}">${item.status_pencairan || '-'}</span></td>
            <td data-label="Dokumen">${linkHtml}</td>
        </tr>
    `}).join('');
}

// SECTION: DOKUMEN
function renderDokumen() {
    document.querySelector('#dokumenTable tbody').innerHTML = dashboardData.master.map(item => {
        const rab = item.link_rab_detail && item.link_rab_detail.startsWith('http') ? `<a href="${item.link_rab_detail}" target="_blank" class="link-btn">RAB</a>` : '-';
        const dok = item.link_dokumentasi && item.link_dokumentasi.startsWith('http') ? `<a href="${item.link_dokumentasi}" target="_blank" class="link-btn">Dokumentasi</a>` : '-';
        const bkt = item.link_bukti_transaksi && item.link_bukti_transaksi.startsWith('http') ? `<a href="${item.link_bukti_transaksi}" target="_blank" class="link-btn">Bukti</a>` : '-';
        return `
        <tr>
            <td data-label="Nama Pekerjaan"><strong>${item.nama_pekerjaan || '-'}</strong></td>
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
        data = data.filter(item => String(item.kategori_foto).toLowerCase() === filter.toLowerCase());
    }

    if (data.length === 0) {
        container.innerHTML = `<p class="muted">Tidak ada foto untuk kategori ${filter}.</p>`;
        return;
    }

    container.innerHTML = data.map(item => `
        <div class="gallery-card">
            <img src="${item.link_foto || 'https://via.placeholder.com/400x300?text=No+Image'}" alt="${item.kategori_foto}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300?text=Image+Not+Found'">
            <div class="gallery-info">
                <h4>${item.nama_pekerjaan || '-'}</h4>
                <p><strong>Kategori:</strong> ${item.kategori_foto || '-'}</p>
                <p>${item.caption || '-'}</p>
                <div class="date">${item.tanggal_upload || '-'}</div>
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
