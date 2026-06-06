const API_URL = 'https://script.google.com/macros/s/AKfycbxdbl-HUmPa6M1OD5lOm23aw-fGkk59-M1HHZL4QDRphy48Yjt_h2a8EY6vJ7qn10W43w/exec';

let rawData = {
    master: [],
    timeline: [],
    realisasi: [],
    pengajuan: [],
    dokumentasi: []
};

let charts = {};
let currentFilters = {
    searchTerm: '',
    statusFilter: ''
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    fetchData();
});

// ===== UTILITIES =====
function parseCurrency(str) {
    if (!str) return 0;
    let clean = String(str).replace(/[^0-9.-]+/g, "");
    return parseFloat(clean) || 0;
}

function formatCurrency(num) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(num);
}

function getStatusInfo(status, progress) {
    const s = String(status || '').toLowerCase();
    const p = parseFloat(progress) || 0;

    if (s.includes('hold')) return { class: 'on-hold', badge: 'on-hold', text: status, color: '#ef4444' };
    if (s.includes('selesai') || p >= 100) return { class: 'selesai', badge: 'selesai', text: status, color: '#22c55e' };
    if (s.includes('going') || s.includes('proses')) {
        return { class: 'on-going', badge: 'on-going', text: status, color: '#22c55e' };
    }
    return { class: 'perencanaan', badge: 'perencanaan', text: status || 'Perencanaan', color: '#64748b' };
}

function getAttentionProjects() {
    const attention = [];

    rawData.master.forEach(item => {
        const s = String(item.status || '').toLowerCase();
        const p = parseFloat(item.progress_percent) || 0;

        if (s.includes('hold')) {
            attention.push({
                ...item,
                reason: 'On Hold',
                type: 'on-hold',
                priority: 1
            });
        }

        if (s.includes('going') && p < 20) {
            attention.push({
                ...item,
                reason: `Slow Progress (${p}%)`,
                type: 'slow-progress',
                priority: 2
            });
        }
    });

    return attention.sort((a, b) => a.priority - b.priority).slice(0, 6);
}

// ===== API FETCH =====
function fetchData() {
    fetch(API_URL)
        .then(res => res.json())
        .then(data => {
            rawData = data;
            document.getElementById('loading-state').style.display = 'none';
            document.getElementById('home-content').style.display = 'block';
            renderAllViews();
        })
        .catch(err => {
            console.error(err);
            document.getElementById('loading-state').innerText = 'Gagal memuat data dari Google Sheets.';
        });
}

// ===== RENDERING =====
function renderAllViews() {
    renderHome();
    renderProjects();
    renderFinancial();
    setupEventListeners();
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const viewName = e.currentTarget.getAttribute('data-view');
            switchView(viewName);
        });
    });

    // Search and Filter
    document.getElementById('search-projects').addEventListener('input', (e) => {
        currentFilters.searchTerm = e.target.value;
        renderProjects();
    });

    document.getElementById('filter-status').addEventListener('change', (e) => {
        currentFilters.statusFilter = e.target.value;
        renderProjects();
    });
}

function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // Show selected view
    document.getElementById(`view-${viewName}`).classList.add('active');
    event.currentTarget?.classList.add('active');
}

// ===== HOME VIEW =====
function renderHome() {
    const kpiData = calculateKPI();

    // KPI Cards
    document.getElementById('kpi-total-budget').innerText = formatCurrency(kpiData.totalBudget);
    document.getElementById('kpi-total-realisasi').innerText = formatCurrency(kpiData.totalRealisasi);
    document.getElementById('kpi-remaining').innerText = formatCurrency(kpiData.remaining);
    document.getElementById('kpi-absorption').innerText = kpiData.absorption.toFixed(1) + '%';

    // Attention Section
    renderAttentionGrid();

    // Status Overview
    renderStatusOverview();
}

function calculateKPI() {
    let totalBudget = 0, totalRealisasi = 0;

    rawData.master.forEach(item => {
        totalBudget += parseCurrency(item.total_anggaran);
        totalRealisasi += parseCurrency(item.realisasi_terkini);
    });

    const remaining = totalBudget - totalRealisasi;
    const absorption = totalBudget > 0 ? (totalRealisasi / totalBudget) * 100 : 0;

    return { totalBudget, totalRealisasi, remaining, absorption };
}

function renderAttentionGrid() {
    const attentionProjects = getAttentionProjects();
    const grid = document.getElementById('attention-grid');

    if (attentionProjects.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: #22c55e; font-weight: 600;">✓ Semua proyek dalam kondisi baik</div>';
        return;
    }

    grid.innerHTML = attentionProjects.map(item => {
        const progress = parseFloat(item.progress_percent) || 0;
        const budget = parseCurrency(item.total_anggaran);
        const realisasi = parseCurrency(item.realisasi_terkini);

        return `
            <div class="attention-card ${item.type}" onclick="openProjectDetail('${item.id}')">
                <div class="attention-card-header">
                    <div class="attention-card-title">${item.nama_pekerjaan}</div>
                    <span class="attention-badge ${item.type === 'on-hold' ? 'red' : 'yellow'}">
                        ${item.reason}
                    </span>
                </div>
                <div class="attention-card-info">
                    <div class="attention-card-info-row">
                        <span class="attention-card-label">Progress</span>
                        <span class="attention-card-value">${progress}%</span>
                    </div>
                    <div class="attention-card-info-row">
                        <span class="attention-card-label">Anggaran</span>
                        <span class="attention-card-value">${formatCurrency(budget)}</span>
                    </div>
                    <div class="attention-card-info-row">
                        <span class="attention-card-label">Realisasi</span>
                        <span class="attention-card-value">${formatCurrency(realisasi)}</span>
                    </div>
                </div>
                <div class="attention-card-action">Lihat detail →</div>
            </div>
        `;
    }).join('');
}

function renderStatusOverview() {
    const statusCounts = {};
    rawData.master.forEach(item => {
        const status = item.status || 'Tidak Diketahui';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Render counts
    const countsHtml = Object.entries(statusCounts).map(([status, count]) => `
        <div class="status-count-item">
            <div class="status-count-label">${status}</div>
            <div class="status-count-value">${count}</div>
        </div>
    `).join('');
    document.getElementById('status-counts').innerHTML = countsHtml;

    // Render chart
    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);
    renderChartJS('statusChart', 'doughnut', labels, [{
        data: data,
        backgroundColor: ['#dcfce7', '#fee2e2', '#fef3c7', '#f1f5f9', '#dbeafe'],
        borderWidth: 2,
        borderColor: 'white'
    }]);
}

// ===== PROJECTS VIEW =====
function renderProjects() {
    const filtered = rawData.master.filter(item => {
        const matchSearch = !currentFilters.searchTerm || 
            String(item.nama_pekerjaan).toLowerCase().includes(currentFilters.searchTerm.toLowerCase()) ||
            String(item.vendor).toLowerCase().includes(currentFilters.searchTerm.toLowerCase()) ||
            String(item.id).toLowerCase().includes(currentFilters.searchTerm.toLowerCase());

        const matchStatus = !currentFilters.statusFilter || 
            String(item.status).toLowerCase() === currentFilters.statusFilter.toLowerCase();

        return matchSearch && matchStatus;
    });

    const grid = document.getElementById('projects-grid');
    grid.innerHTML = filtered.map(item => renderProjectCard(item)).join('');
}

function renderProjectCard(item) {
    const progress = parseFloat(item.progress_percent) || 0;
    const status = getStatusInfo(item.status, progress);
    const budget = parseCurrency(item.total_anggaran);
    const realisasi = parseCurrency(item.realisasi_terkini);
    const remaining = budget - realisasi;

    // Build doc links
    let docLinks = '';
    if (item.link_rab_detail) {
        docLinks += `<a href="${item.link_rab_detail}" target="_blank" class="doc-link"><span>RAB Detail</span><span class="doc-link-icon">↗</span></a>`;
    }
    if (item.link_dokumentasi) {
        docLinks += `<a href="${item.link_dokumentasi}" target="_blank" class="doc-link"><span>Dokumentasi</span><span class="doc-link-icon">↗</span></a>`;
    }
    if (item.link_bukti_transaksi) {
        docLinks += `<a href="${item.link_bukti_transaksi}" target="_blank" class="doc-link"><span>Bukti Transaksi</span><span class="doc-link-icon">↗</span></a>`;
    }

    return `
        <div class="project-card ${status.class}" onclick="openProjectDetail('${item.id}')">
            <div class="project-card-header">
                <div>
                    <div class="project-card-title">${item.nama_pekerjaan}</div>
                    <div class="project-card-id">${item.id}</div>
                </div>
                <span class="badge ${status.badge}">${status.text}</span>
            </div>

            <div class="project-card-meta">
                <div class="meta-item">
                    <span class="meta-label">Vendor</span>
                    <span class="meta-value">${item.vendor || '-'}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Target Selesai</span>
                    <span class="meta-value">${item.target_selesai || '-'}</span>
                </div>
            </div>

            <div class="project-card-progress">
                <div class="progress-label">
                    <span>Progress</span>
                    <span>${progress}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%; background-color: ${status.color};"></div>
                </div>
            </div>

            <div class="project-card-budget">
                <div class="budget-item">
                    <span class="budget-label">Anggaran</span>
                    <span class="budget-value">${formatCurrency(budget)}</span>
                </div>
                <div class="budget-item">
                    <span class="budget-label">Realisasi</span>
                    <span class="budget-value">${formatCurrency(realisasi)}</span>
                </div>
                <div class="budget-item">
                    <span class="budget-label">Sisa</span>
                    <span class="budget-value">${formatCurrency(remaining)}</span>
                </div>
                <div class="budget-item">
                    <span class="budget-label">% Serap</span>
                    <span class="budget-value">${budget > 0 ? ((realisasi / budget) * 100).toFixed(1) : 0}%</span>
                </div>
            </div>

            ${docLinks ? `<div class="project-card-docs">${docLinks}</div>` : ''}
        </div>
    `;
}

// ===== FINANCIAL VIEW =====
function renderFinancial() {
    const kpiData = calculateKPI();

    document.getElementById('fin-total-budget').innerText = formatCurrency(kpiData.totalBudget);
    document.getElementById('fin-total-realisasi').innerText = formatCurrency(kpiData.totalRealisasi);
    document.getElementById('fin-remaining').innerText = formatCurrency(kpiData.remaining);

    renderFinancialChart();
    renderRealisasiTable();
    renderPengajuanTable();
}

function renderFinancialChart() {
    const labels = [];
    const dataAnggaran = [];
    const dataRealisasi = [];

    rawData.master.forEach(item => {
        const ang = parseCurrency(item.total_anggaran);
        const rel = parseCurrency(item.realisasi_terkini);

        if (ang > 0 || rel > 0) {
            const name = item.nama_pekerjaan.length > 25 ? item.nama_pekerjaan.substring(0, 25) + '...' : item.nama_pekerjaan;
            labels.push(name);
            dataAnggaran.push(ang);
            dataRealisasi.push(rel);
        }
    });

    renderChartJS('financialChart', 'bar', labels, [
        { label: 'Anggaran', data: dataAnggaran, backgroundColor: '#0f172a' },
        { label: 'Realisasi', data: dataRealisasi, backgroundColor: '#d4af37' }
    ]);
}

function renderRealisasiTable() {
    const tbody = document.querySelector('#table-realisasi tbody');
    tbody.innerHTML = rawData.realisasi.map(item => `
        <tr>
            <td>${item.tanggal_realisasi || '-'}</td>
            <td><strong>${item.nama_pekerjaan || '-'}</strong></td>
            <td>${item.deskripsi_biaya || '-'}</td>
            <td><strong>${formatCurrency(parseCurrency(item.nominal_realisasi))}</strong></td>
            <td><span class="badge ${getStatusInfo(item.status_dana).badge}">${item.status_dana || '-'}</span></td>
        </tr>
    `).join('');
}

function renderPengajuanTable() {
    const tbody = document.querySelector('#table-pengajuan tbody');
    tbody.innerHTML = rawData.pengajuan.map(item => `
        <tr>
            <td>${item.tanggal_pengajuan || '-'}</td>
            <td><strong>${item.nama_pekerjaan || '-'}</strong></td>
            <td>${formatCurrency(parseCurrency(item.nilai_pengajuan))}</td>
            <td><span class="badge ${getStatusInfo(item.status_pencairan).badge}">${item.status_pencairan || '-'}</span></td>
            <td>${item.link_doc_pengajuan ? `<a href="${item.link_doc_pengajuan}" target="_blank">Buka Link</a>` : '-'}</td>
        </tr>
    `).join('');
}

// ===== PROJECT DETAIL =====
function openProjectDetail(id) {
    const master = rawData.master.find(i => i.id === id);
    const timeline = rawData.timeline.find(i => i.id === id) || {};

    if (!master) return;

    const status = getStatusInfo(master.status, master.progress_percent);
    const progress = parseFloat(master.progress_percent) || 0;
    const budget = parseCurrency(master.total_anggaran);
    const realisasi = parseCurrency(master.realisasi_terkini);
    const remaining = budget - realisasi;
    const absorption = budget > 0 ? (realisasi / budget) * 100 : 0;

    // Populate header
    document.getElementById('detail-title').innerText = master.nama_pekerjaan;
    document.getElementById('detail-subtitle').innerText = `${master.id} • ${master.program}`;

    // Status & Progress
    document.getElementById('detail-status').className = `badge ${status.badge}`;
    document.getElementById('detail-status').innerText = status.text;
    document.getElementById('detail-target-date').innerText = master.target_selesai || '-';
    document.getElementById('detail-progress-fill').style.width = progress + '%';
    document.getElementById('detail-progress-fill').style.backgroundColor = status.color;
    document.getElementById('detail-progress-text').innerText = progress + '%';
    document.getElementById('detail-updated-date').innerText = '-'; // TODO: add update tracking

    // Basic Info
    document.getElementById('detail-id').innerText = master.id;
    document.getElementById('detail-program').innerText = master.program || '-';
    document.getElementById('detail-jenis').innerText = master.jenis_pekerjaan || '-';
    document.getElementById('detail-vendor').innerText = master.vendor || '-';

    // Issues
    const issuesSection = document.getElementById('issues-section');
    const issuesBox = document.getElementById('detail-issues');
    if (master.isu_utama && String(master.isu_utama).trim() !== '-') {
        issuesSection.style.display = 'block';
        issuesBox.innerHTML = `<strong>Isu Utama:</strong> ${master.isu_utama}`;
    } else {
        issuesSection.style.display = 'none';
    }

    // Financial
    document.getElementById('detail-budget').innerText = formatCurrency(budget);
    document.getElementById('detail-realisasi').innerText = formatCurrency(realisasi);
    document.getElementById('detail-remaining').innerText = formatCurrency(remaining);
    document.getElementById('detail-absorption').innerText = absorption.toFixed(1) + '%';

    // Timeline
    const timelineSection = document.getElementById('timeline-section');
    if (timeline.start_date || timeline.end_date || timeline.status_lapangan) {
        timelineSection.style.display = 'block';
        document.getElementById('detail-start-date').innerText = timeline.start_date || '-';
        document.getElementById('detail-end-date').innerText = timeline.end_date || '-';
        document.getElementById('detail-status-lapangan').innerText = timeline.status_lapangan || '-';
        document.getElementById('detail-isu-kendala').innerText = timeline.isu_kendala || '-';
    } else {
        timelineSection.style.display = 'none';
    }

    // Documentation
    const docsSection = document.getElementById('docs-section');
    const docsList = document.getElementById('detail-docs');
    let docCount = 0;

    let docsHtml = '';
    if (master.link_rab_detail) {
        docsHtml += `<a href="${master.link_rab_detail}" target="_blank">📊 RAB Detail <span>↗</span></a>`;
        docCount++;
    }
    if (master.link_dokumentasi) {
        docsHtml += `<a href="${master.link_dokumentasi}" target="_blank">📁 Dokumentasi <span>↗</span></a>`;
        docCount++;
    }
    if (master.link_bukti_transaksi) {
        docsHtml += `<a href="${master.link_bukti_transaksi}" target="_blank">💰 Bukti Transaksi <span>↗</span></a>`;
        docCount++;
    }

    if (docCount > 0) {
        docsSection.style.display = 'block';
        docsList.innerHTML = docsHtml;
    } else {
        docsSection.style.display = 'none';
    }

    // Show overlay
    document.getElementById('detail-overlay').classList.add('active');
}

window.closeProjectDetail = function() {
    document.getElementById('detail-overlay').classList.remove('active');
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeProjectDetail();
    }
});

// ===== CHART RENDERING =====
function renderChartJS(canvasId, type, labels, datasets) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (charts[canvasId]) charts[canvasId].destroy();

    charts[canvasId] = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: type === 'doughnut' ? 'right' : 'top',
                    labels: {
                        font: { size: 13, weight: 500 },
                        color: '#64748b',
                        padding: 15
                    }
                }
            },
            scales: type !== 'doughnut' ? {
                x: { grid: { display: false } },
                y: { 
                    beginAtZero: true,
                    ticks: { callback: (value) => formatCurrency(value) }
                }
            } : {}
        }
    });
}

// ===== INITIALIZATION =====
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const viewName = e.currentTarget.getAttribute('data-view');
            document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(`view-${viewName}`).classList.add('active');
            e.currentTarget.classList.add('active');
        });
    });

    // Set home as active by default
    document.querySelector('[data-view="home"]').classList.add('active');
}
