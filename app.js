const API_URL = 'https://script.google.com/macros/s/AKfycbxdbl-HUmPa6M1OD5lOm23aw-fGkk59-M1HHZL4QDRphy48Yjt_h2a8EY6vJ7qn10W43w/exec';

let rawData = { master: [], timeline: [], realisasi: [], pengajuan: [], dokumentasi: [] };
let charts = {};

document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initModals();
    fetchData();
});

// === UTILS ===
function parseCurrency(str) {
    if (!str) return 0;
    let clean = String(str).replace(/[^0-9.-]+/g, "");
    return parseFloat(clean) || 0;
}

function formatCurrency(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

function getStatusInfo(status, progress) {
    const s = String(status || '').toLowerCase();
    const p = parseFloat(progress) || 0;
    if (s.includes('hold')) return { class: 'red', badge: 'badge-red', text: status };
    if (s.includes('selesai') || p >= 100) return { class: 'green', badge: 'badge-green', text: status };
    if (s.includes('going') || s.includes('proses')) {
        if (p < 20) return { class: 'yellow', badge: 'badge-yellow', text: status };
        return { class: 'green', badge: 'badge-green', text: status };
    }
    return { class: 'gray', badge: 'badge-gray', text: status || 'Perencanaan' };
}

// === API FETCH ===
function fetchData() {
    fetch(API_URL)
        .then(res => res.json())
        .then(data => {
            rawData = data;
            document.getElementById('loading').style.display = 'none';
            renderSemua();
        })
        .catch(err => {
            console.error(err);
            document.getElementById('loading').innerText = 'Gagal memuat data dari Google Sheets.';
        });
}

function renderSemua() {
    renderRingkasan();
    renderOperasional('');
    renderFinansial();
    renderPengajuan();
    renderDokumen('');
    renderGaleri('Semua');

    // Event Listeners
    document.getElementById('searchPekerjaan').addEventListener('input', (e) => renderOperasional(e.target.value));
    document.getElementById('searchDokumen').addEventListener('input', (e) => renderDokumen(e.target.value));
    
    const galFilters = document.querySelectorAll('#gallery-filters .filter-btn');
    galFilters.forEach(btn => {
        btn.addEventListener('click', (e) => {
            galFilters.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderGaleri(e.target.getAttribute('data-filter'));
        });
    });
}

// === TAB: RINGKASAN ===
function renderRingkasan() {
    let tAnggaran = 0, tRealisasi = 0;
    let alerts = [];
    let statusCounts = {};

    rawData.master.forEach(item => {
        tAnggaran += parseCurrency(item.total_anggaran);
        tRealisasi += parseCurrency(item.realisasi_terkini);
        
        const statStr = item.status || 'Tidak Diketahui';
        statusCounts[statStr] = (statusCounts[statStr] || 0) + 1;

        const s = statStr.toLowerCase();
        const p = parseFloat(item.progress_percent) || 0;

        if (s.includes('hold')) {
            alerts.push(`<div class="alert-card alert-red"><h4 style="color:var(--status-red)">${item.nama_pekerjaan}</h4><div class="reason">Status On Hold</div></div>`);
        } else if (s.includes('going') && p < 20) {
            alerts.push(`<div class="alert-card alert-yellow"><h4 style="color:var(--status-yellow)">${item.nama_pekerjaan}</h4><div class="reason">Progress Lambat (${p}%)</div></div>`);
        }
        if (item.isu_utama && String(item.isu_utama).trim() !== '-' && String(item.isu_utama).trim() !== '') {
            alerts.push(`<div class="alert-card alert-yellow"><h4 style="color:var(--status-yellow)">${item.nama_pekerjaan}</h4><div class="reason">Isu Utama: ${item.isu_utama}</div></div>`);
        }
    });

    const sisa = tAnggaran - tRealisasi;
    const penyerapan = tAnggaran > 0 ? ((tRealisasi/tAnggaran)*100).toFixed(1) : 0;

    document.getElementById('kpi-ringkasan').innerHTML = `
        <div class="kpi-card"><h3>Total Anggaran</h3><p>${formatCurrency(tAnggaran)}</p></div>
        <div class="kpi-card"><h3>Total Realisasi</h3><p>${formatCurrency(tRealisasi)}</p></div>
        <div class="kpi-card"><h3>Sisa Anggaran</h3><p>${formatCurrency(sisa)}</p></div>
        <div class="kpi-card" style="border-left-color:var(--primary-gold);"><h3>Persentase Penyerapan</h3><p>${penyerapan}%</p></div>
    `;

    document.getElementById('alert-container').innerHTML = alerts.length ? alerts.join('') : '<p style="color:var(--status-green); font-weight:bold;">Tidak ada alert. Kondisi lapangan aman.</p>';

    renderChartJS('statusChart', 'doughnut', Object.keys(statusCounts), [{
        data: Object.values(statusCounts),
        backgroundColor: ['#e0f2fe', '#dcfce7', '#fee2e2', '#f1f5f9', '#fef3c7'],
        borderWidth: 1
    }]);
}

// === TAB: OPERASIONAL ===
function renderOperasional(searchTerm) {
    const term = searchTerm.toLowerCase();
    const filtered = rawData.master.filter(i => 
        String(i.nama_pekerjaan).toLowerCase().includes(term) || 
        String(i.vendor).toLowerCase().includes(term) ||
        String(i.id).toLowerCase().includes(term)
    );

    document.getElementById('pekerjaan-grid').innerHTML = filtered.map(item => {
        const p = parseFloat(item.progress_percent) || 0;
        const stat = getStatusInfo(item.status, p);
        let fillClass = 'progress-fill';
        if(stat.class === 'red') fillClass += ' fill-red';
        else if(stat.class === 'yellow') fillClass += ' fill-yellow';

        return `
            <div class="project-card border-${stat.class}">
                <div class="project-header">
                    <h3>${item.nama_pekerjaan || '-'}</h3>
                    <span class="badge ${stat.badge}">${stat.text}</span>
                </div>
                <div class="project-metrics">
                    <div class="metric-box"><p>ID Pekerjaan</p><strong>${item.id || '-'}</strong></div>
                    <div class="metric-box"><p>Target Selesai</p><strong>${item.target_selesai || '-'}</strong></div>
                    <div class="metric-box"><p>Vendor</p><strong>${item.vendor || '-'}</strong></div>
                    <div class="metric-box"><p>Jenis Pekerjaan</p><strong>${item.jenis_pekerjaan || '-'}</strong></div>
                </div>
                <div class="progress-container">
                    <div class="progress-header"><span>Progress</span><span>${p}%</span></div>
                    <div class="progress-bar"><div class="${fillClass}" style="width: ${p}%"></div></div>
                </div>
                <div class="project-actions">
                    <button class="btn-action" onclick="openDetail('${item.id}')">Detail Modal</button>
                    ${item.link_rab_detail ? `<a href="${item.link_rab_detail}" target="_blank" class="btn-action">Link RAB</a>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// === TAB: FINANSIAL ===
function renderFinansial() {
    let tAnggaran = 0, tRealisasi = 0;
    const labels = [], dataAnggaran = [], dataRealisasi = [];

    rawData.master.forEach(item => {
        const ang = parseCurrency(item.total_anggaran);
        const rel = parseCurrency(item.realisasi_terkini);
        tAnggaran += ang;
        tRealisasi += rel;

        if (ang > 0 || rel > 0) {
            labels.push(item.nama_pekerjaan.length > 20 ? item.nama_pekerjaan.substring(0,20)+'...' : item.nama_pekerjaan);
            dataAnggaran.push(ang);
            dataRealisasi.push(rel);
        }
    });

    document.getElementById('kpi-finansial').innerHTML = `
        <div class="kpi-card"><h3>Total Anggaran</h3><p>${formatCurrency(tAnggaran)}</p></div>
        <div class="kpi-card"><h3>Total Realisasi</h3><p>${formatCurrency(tRealisasi)}</p></div>
        <div class="kpi-card"><h3>Sisa Anggaran</h3><p>${formatCurrency(tAnggaran - tRealisasi)}</p></div>
    `;

    document.querySelector('#table-realisasi tbody').innerHTML = rawData.realisasi.map(item => `
        <tr>
            <td>${item.tanggal_realisasi || '-'}</td>
            <td><strong>${item.nama_pekerjaan || '-'}</strong></td>
            <td>${item.deskripsi_biaya || '-'}</td>
            <td><strong>${formatCurrency(parseCurrency(item.nominal_realisasi))}</strong></td>
            <td><span class="badge ${getStatusInfo(item.status_dana).badge}">${item.status_dana || '-'}</span></td>
        </tr>
    `).join('');

    renderChartJS('finansialChart', 'bar', labels, [
        { label: 'Anggaran', data: dataAnggaran, backgroundColor: '#222222' },
        { label: 'Realisasi', data: dataRealisasi, backgroundColor: '#D4AF37' }
    ]);
}

// === TAB: PENGAJUAN DANA ===
function renderPengajuan() {
    document.querySelector('#table-pengajuan tbody').innerHTML = rawData.pengajuan.map(item => `
        <tr>
            <td>${item.tanggal_pengajuan || '-'}</td>
            <td><strong>${item.nama_pekerjaan || '-'}</strong></td>
            <td>${formatCurrency(parseCurrency(item.nilai_pengajuan))}</td>
            <td><span class="badge ${getStatusInfo(item.status_pencairan).badge}">${item.status_pencairan || '-'}</span></td>
            <td>${item.link_doc_pengajuan ? `<a href="${item.link_doc_pengajuan}" target="_blank" style="color:var(--primary-gold); font-weight:bold;">Buka Link</a>` : '-'}</td>
        </tr>
    `).join('');
}

// === TAB: DOKUMEN ===
function renderDokumen(searchTerm) {
    const term = searchTerm.toLowerCase();
    const filtered = rawData.master.filter(i => String(i.nama_pekerjaan).toLowerCase().includes(term));

    document.getElementById('dokumen-grid').innerHTML = filtered.map(item => `
        <div class="doc-card">
            <h4>${item.nama_pekerjaan || '-'}</h4>
            <div class="doc-links">
                ${item.link_rab_detail ? `<a href="${item.link_rab_detail}" target="_blank" class="doc-link"><span>Link RAB Detail</span> <span>&nearr;</span></a>` : ''}
                ${item.link_dokumentasi ? `<a href="${item.link_dokumentasi}" target="_blank" class="doc-link"><span>Link Dokumentasi</span> <span>&nearr;</span></a>` : ''}
                ${item.link_bukti_transaksi ? `<a href="${item.link_bukti_transaksi}" target="_blank" class="doc-link"><span>Link Bukti Transaksi</span> <span>&nearr;</span></a>` : ''}
            </div>
        </div>
    `).join('');
}

// === TAB: GALERI DOKUMENTASI ===
function renderGaleri(filter) {
    const grid = document.getElementById('gallery-grid');
    let data = rawData.dokumentasi;
    if (filter !== 'Semua') {
        data = data.filter(i => String(i.kategori_foto).toLowerCase() === filter.toLowerCase());
    }
    
    grid.innerHTML = data.map(item => `
        <div class="gallery-card">
            <img src="${item.link_foto || ''}" class="gallery-img" alt="${item.kategori_foto}" onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'">
            <div class="gallery-info">
                <h4>${item.nama_pekerjaan || '-'}</h4>
                <p><strong>Kategori:</strong> ${item.kategori_foto || '-'}</p>
                <p><strong>Tanggal:</strong> ${item.tanggal_upload || '-'}</p>
                <p style="margin-top:8px;">${item.caption || '-'}</p>
            </div>
        </div>
    `).join('');
}

// === NAVIGATION & MODAL ===
function initNav() {
    const btns = document.querySelectorAll('.nav-btn');
    const tabs = document.querySelectorAll('.tab-content');
    btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            btns.forEach(b => b.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.getAttribute('data-target')).classList.add('active');
        });
    });
}

function initModals() {
    const modal = document.getElementById('detailModal');
    document.querySelector('.modal-close').onclick = () => modal.style.display = 'none';
    modal.onclick = (e) => { if(e.target === modal) modal.style.display = 'none'; };
}

window.openDetail = function(id) {
    const master = rawData.master.find(i => i.id === id);
    const timeline = rawData.timeline.find(i => i.id === id) || {};
    if (!master) return;

    document.getElementById('modalTitle').innerText = master.nama_pekerjaan;
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-detail-row"><strong>ID</strong><span>${master.id || '-'}</span></div>
        <div class="modal-detail-row"><strong>Program</strong><span>${master.program || '-'}</span></div>
        <div class="modal-detail-row"><strong>Status</strong><span>${master.status || '-'}</span></div>
        <div class="modal-detail-row"><strong>Progress</strong><span>${master.progress_percent || '0'}%</span></div>
        <div class="modal-detail-row"><strong>Vendor</strong><span>${master.vendor || '-'}</span></div>
        <div class="modal-detail-row"><strong>Target Selesai</strong><span>${master.target_selesai || '-'}</span></div>
        <div class="modal-detail-row"><strong>Isu Utama</strong><span style="color:var(--status-red);">${master.isu_utama || '-'}</span></div>
        
        <h4 style="margin-top:20px; border-bottom: 1px solid var(--border-color); padding-bottom:5px;">Timeline Info</h4>
        <div class="modal-detail-row"><strong>Start Date</strong><span>${timeline.start_date || '-'}</span></div>
        <div class="modal-detail-row"><strong>End Date</strong><span>${timeline.end_date || '-'}</span></div>
        <div class="modal-detail-row"><strong>Status Lapangan</strong><span>${timeline.status_lapangan || '-'}</span></div>
        <div class="modal-detail-row"><strong>Isu Kendala</strong><span>${timeline.isu_kendala || '-'}</span></div>
    `;
    document.getElementById('detailModal').style.display = 'flex';
}

function renderChartJS(canvasId, type, labels, datasets) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (charts[canvasId]) charts[canvasId].destroy();
    charts[canvasId] = new Chart(ctx, {
        type: type,
        data: { labels: labels, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: type === 'doughnut' ? 'right' : 'top' } } }
    });
}
