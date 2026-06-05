// Konfigurasi State Aplikasi & Data Global
const CONFIG = {
    apiUrl: 'https://script.google.com/macros/s/AKfycbxdbl-HUmPa6M1OD5lOm23aw-fGkk59-M1HHZL4QDRphy48Yjt_h2a8EY6vJ7qn10W43w/exec'
};

let appData = {
    generatedAt: '',
    master: [],
    timeline: [],
    realisasi: [],
    pengajuan: [],
    dokumentasi: []
};

let statusChartInstance = null;
let finansialChartInstance = null;
let activeGalleryFilter = 'Semua';

// Peta Warna Berdasarkan Status Dokumen Kerja
const STATUS_MAP = {
    'On Hold': { bg: '#fee2e2', text: '#b91c1c', cls: 'badge-onhold' },
    'On Going': { bg: '#e0f2fe', text: '#0369a1', cls: 'badge-ongoing' },
    'Selesai': { bg: '#dcfce7', text: '#15803d', cls: 'badge-selesai' },
    'Perencanaan': { bg: '#f1f5f9', text: '#475569', cls: 'badge-perencanaan' }
};

// Inisialisasi Utama saat DOM Selesai Dimuat
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSearch();
    initGalleryFilters();
    initModalClose();
    fetchDashboardData();
});

// Sistem Navigasi Tab Konten
function initTabs() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// Penanganan Penutupan Modal Jendela Detail
function initModalClose() {
    const modal = document.getElementById('detail-modal');
    const closeBtn = document.getElementById('close-modal');
    
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
}

// Fungsi Mengambil Data Lapangan via API JSON
function fetchDashboardData() {
    const loadingEl = document.getElementById('loading-state');
    loadingEl.style.display = 'flex';

    fetch(CONFIG.apiUrl)
        .then(response => {
            if (!response.ok) throw new Error('Network response status error');
            return response.json();
        })
        .then(json => {
            // Mapping struktur data respons API ke state aplikasi lokal
            appData.generatedAt = json.generated_at || '';
            appData.master = json.master || [];
            appData.timeline = json.timeline || [];
            appData.realisasi = json.realisasi || [];
            appData.pengajuan = json.pengajuan || [];
            appData.dokumentasi = json.dokumentasi || [];

            // Memperbarui Timestamp Sistem Pembuatan Data
            document.getElementById('generated-time').innerText = `Data Lapangan Terkini: ${appData.generatedAt}`;

            // Eksekusi Render Seluruh Tampilan Komponen Dashboard
            renderRingkasan();
            renderOperasional(appData.master);
            renderFinansial();
            renderPengajuan();
            renderDokumen();
            renderGaleri();
        })
        .catch(err => {
            console.error('Gagal memuat data operasional:', err);
            document.getElementById('generated-time').innerText = 'Gagal sinkronisasi data lapangan.';
        })
        .finally(() => {
            loadingEl.style.display = 'none';
        });
}

// Fungsi Formatting Format Nilai Mata Uang Rupiah
function formatRupiah(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return 'Rp 0';
    return 'Rp ' + num.toLocaleString('id-ID');
}

// Rendering TAB 1: Komponen Ringkasan, KPI, Chart, & Alur Alert
function renderRingkasan() {
    let totalAnggaran = 0;
    let totalRealisasi = 0;
    let statusCounts = { 'On Hold': 0, 'On Going': 0, 'Selesai': 0, 'Perencanaan': 0 };
    let alertsHtml = '';

    appData.master.forEach(item => {
        const agrn = parseFloat(item.Total_Anggaran) || 0;
        const rls = parseFloat(item.Realisasi_Terkini) || 0;
        totalAnggaran += agrn;
        totalRealisasi += rls;

        // Penghitungan sebaran distribusi status
        if (statusCounts[item.Status] !== undefined) {
            statusCounts[item.Status]++;
        }

        // Evaluasi Aturan Bisnis Pembuatan Notifikasi Krisis / Alert Lapangan
        const progressNum = parseFloat(item.Progress_Percent) || 0;
        let isAlert = false;
        let alertType = 'warning';
        let alertReason = [];

        if (item.Status === 'On Hold') {
            isAlert = true;
            alertType = 'danger';
            alertReason.push('Status Berhenti (On Hold)');
        }
        if (progressNum < 20 && item.Status === 'On Going') {
            isAlert = true;
            alertReason.push(`Progress lambat (< 20%): Baru mencapai ${progressNum}%`);
        }
        if (item.Isu_Utama && item.Isu_Utama.trim() !== '-' && item.Isu_Utama.trim() !== '') {
            isAlert = true;
            alertReason.push(`Isu Utama Terdeteksi: "${item.Isu_Utama}"`);
        }

        if (isAlert) {
            alertsHtml += `
                <div class="alert-item ${alertType}">
                    <span class="alert-title">[${item.ID}] ${item.Nama_Pekerjaan}</span>
                    <span class="alert-desc">${alertReason.join(' | ')}</span>
                    <span class="alert-desc"><strong>Vendor:</strong> ${item.Vendor} | <strong>Target:</strong> ${item.Target_Selesai}</span>
                </div>
            `;
        }
    });

    const sisaAnggaran = totalAnggaran - totalRealisasi;
    const persentasePenyerapan = totalAnggaran > 0 ? ((totalRealisasi / totalAnggaran) * 100).toFixed(1) : 0;

    // Suntik Nilai ke DOM Elemen KPI Ringkasan & Finansial
    document.getElementById('kpi-total-anggaran').innerText = formatRupiah(totalAnggaran);
    document.getElementById('kpi-total-realisasi').innerText = formatRupiah(totalRealisasi);
    document.getElementById('kpi-sisa-anggaran').innerText = formatRupiah(sisaAnggaran);
    document.getElementById('kpi-penyerapan').innerText = `${persentasePenyerapan}%`;

    // Suntik Konten Alert Lapangan
    const alertContainer = document.getElementById('alert-container');
    alertContainer.innerHTML = alertsHtml || '<div class="alert-item" style="background:#dcfce7; color:#15803d; border-left:4px solid #15803d">Kondisi lapangan aman. Tidak ada alert krisis terdeteksi.</div>';

    // Render Grafik Donut Sebaran Status Distribusi Pekerjaan (Chart.js)
    if (statusChartInstance) statusChartInstance.destroy();
    const ctxStatus = document.getElementById('chart-status').getContext('2d');
    statusChartInstance = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['#fee2e2', '#e0f2fe', '#dcfce7', '#f1f5f9'],
                borderColor: ['#b91c1c', '#0369a1', '#15803d', '#475569'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// Rendering TAB 2: Pengelolaan Operasional Lapangan & Filter Realtime Search
function renderOperasional(dataList) {
    const tbody = document.querySelector('#table-operasional tbody');
    const mobileContainer = document.getElementById('cards-operasional');
    
    tbody.innerHTML = '';
    mobileContainer.innerHTML = '';

    dataList.forEach(item => {
        const stDef = STATUS_MAP[item.Status] || { bg: '#f1f5f9', text: '#475569', cls: 'badge-perencanaan' };
        
        // Pembuatan Baris Tabel Desktop
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.ID}</strong></td>
            <td>${item.Program}</td>
            <td><strong>${item.Nama_Pekerjaan}</strong></td>
            <td>${item.Jenis_Pekerjaan}</td>
            <td><span class="badge ${stDef.cls}">${item.Status}</span></td>
            <td><strong>${item.Progress_Percent}%</strong></td>
            <td>${item.Vendor}</td>
            <td>${item.Target_Selesai}</td>
        `;
        // Handler Klik untuk memicu Modal Detail Informasi Pekerjaan
        tr.addEventListener('click', () => openDetailModal(item.ID));
        tbody.appendChild(tr);

        // Pembuatan Tampilan Card Layout Khusus Mobile Devices
        const mCard = document.createElement('div');
        mCard.className = 'mobile-card';
        mCard.innerHTML = `
            <div class="mobile-card-row" style="border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem; margin-bottom:0.5rem;">
                <span class="mobile-card-label" style="color:#222; font-size:0.95rem;"><strong>[${item.ID}] ${item.Nama_Pekerjaan}</strong></span>
                <span class="badge ${stDef.cls}">${item.Status}</span>
            </div>
            <div class="mobile-card-row"><span class="mobile-card-label">Program</span><span class="mobile-card-value">${item.Program}</span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Jenis Kerja</span><span class="mobile-card-value">${item.Jenis_Pekerjaan}</span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Progress</span><span class="mobile-card-value"><strong>${item.Progress_Percent}%</strong></span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Vendor</span><span class="mobile-card-value">${item.Vendor}</span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Target Selesai</span><span class="mobile-card-value">${item.Target_Selesai}</span></div>
        `;
        mCard.addEventListener('click', () => openDetailModal(item.ID));
        mobileContainer.appendChild(mCard);
    });
}

// Logika Filter Realtime Search di Menu Operasional
function initSearch() {
    const searchInput = document.getElementById('search-operasional');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = appData.master.filter(item => {
            return item.ID.toLowerCase().includes(query) ||
                   item.Program.toLowerCase().includes(query) ||
                   item.Nama_Pekerjaan.toLowerCase().includes(query) ||
                   item.Vendor.toLowerCase().includes(query);
        });
        renderOperasional(filtered);
    });
}

// Fungsi Membuka Modal Detail Gabungan Data Master & Timeline Isu
function openDetailModal(id) {
    const masterItem = appData.master.find(m => m.ID === id);
    if (!masterItem) return;

    // Temukan relasi data sekunder di sheet timeline log
    const timelineItem = appData.timeline.find(t => t.ID === id) || { Status_Lapangan: '-', Isu_Kendala: '-' };

    document.getElementById('modal-title').innerText = masterItem.Nama_Pekerjaan;
    document.getElementById('m-id').innerText = masterItem.ID;
    document.getElementById('m-program').innerText = masterItem.Program;
    document.getElementById('m-vendor').innerText = masterItem.Vendor;
    document.getElementById('m-target').innerText = masterItem.Target_Selesai;
    document.getElementById('m-status').innerText = masterItem.Status;
    
    // Progres Pengisian Slider Bar
    const progressNum = parseFloat(masterItem.Progress_Percent) || 0;
    document.getElementById('m-progress-bar').style.width = `${progressNum}%`;
    document.getElementById('m-progress-text').innerText = `${progressNum}% Selesai`;

    // Data Kondisi Isu Konstruksi Lapangan
    document.getElementById('m-status-lapangan').innerText = timelineItem.Status_Lapangan || '-';
    document.getElementById('m-isu-utama').innerText = masterItem.Isu_Utama && masterItem.Isu_Utama !== '-' ? masterItem.Isu_Utama : 'Tidak ada isu utama di master data.';
    document.getElementById('m-isu-kendala').innerText = timelineItem.Isu_Kendala && timelineItem.Isu_Kendala !== '-' ? timelineItem.Isu_Kendala : 'Tidak ada catatan kendala lapangan terkini.';

    // Penanganan Validasi Pemetaan Link Eksternal Berkas Pendukung
    setupModalLink('m-link-rab', masterItem.Link_RAB_Detail);
    setupModalLink('m-link-dok', masterItem.Link_Documentation || masterItem.Link_Dokumentasi); 
    setupModalLink('m-link-bukti', masterItem.Link_Bukti_Transaksi);

    document.getElementById('detail-modal').classList.add('active');
}

function setupModalLink(elementId, url) {
    const el = document.getElementById(elementId);
    if (url && url.startsWith('http')) {
        el.href = url;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// Rendering TAB 3: Komponen Finansial, Log Realisasi, & Grafik Bar Anggaran
function renderFinansial() {
    let totalAnggaran = 0;
    let totalRealisasi = 0;

    let labels = [];
    let anggaranDataset = [];
    let realisasiDataset = [];

    appData.master.forEach(item => {
        const agrn = parseFloat(item.Total_Anggaran) || 0;
        const rls = parseFloat(item.Realisasi_Terkini) || 0;
        totalAnggaran += agrn;
        totalRealisasi += rls;

        // Ambil sampel data untuk grafik perbandingan komparatif objek kerja
        labels.push(item.Nama_Pekerjaan.length > 20 ? item.ID : item.Nama_Pekerjaan);
        anggaranDataset.push(agrn);
        realisasiDataset.push(rls);
    });

    document.getElementById('fin-total-anggaran').innerText = formatRupiah(totalAnggaran);
    document.getElementById('fin-total-realisasi').innerText = formatRupiah(totalRealisasi);
    document.getElementById('fin-sisa-anggaran').innerText = formatRupiah(totalAnggaran - totalRealisasi);

    // Render Tabel Log Riwayat Aliran Realisasi Dana Lapangan
    const tbody = document.querySelector('#table-realisasi tbody');
    const mobileContainer = document.getElementById('cards-realisasi');
    tbody.innerHTML = '';
    mobileContainer.innerHTML = '';

    appData.realisasi.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.Tanggal_Realisasi}</td>
            <td><strong>${item.Nama_Pekerjaan}</strong></td>
            <td>${item.Deskripsi_Biaya}</td>
            <td><strong>${formatRupiah(item.Nominal_Realisasi)}</strong></td>
            <td><span class="badge badge-selesai">${item.Status_Dana || 'Selesai'}</span></td>
        `;
        tbody.appendChild(tr);

        const mCard = document.createElement('div');
        mCard.className = 'mobile-card';
        mCard.innerHTML = `
            <div class="mobile-card-row" style="border-bottom:1px solid #e2e8f0; padding-bottom:0.4rem; margin-bottom:0.4rem;">
                <span class="mobile-card-label" style="color:#222;"><strong>${item.Nama_Pekerjaan}</strong></span>
                <span class="badge badge-selesai">${item.Status_Dana || 'Selesai'}</span>
            </div>
            <div class="mobile-card-row"><span class="mobile-card-label">Tanggal</span><span class="mobile-card-value">${item.Tanggal_Realisasi}</span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Deskripsi</span><span class="mobile-card-value">${item.Deskripsi_Biaya}</span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Nominal</span><span class="mobile-card-value"><strong>${formatRupiah(item.Nominal_Realisasi)}</strong></span></div>
        `;
        mobileContainer.appendChild(mCard);
    });

    // Render Grafik Komparasi Batang Anggaran vs Realisasi Terkini (Chart.js)
    if (finansialChartInstance) finansialChartInstance.destroy();
    const ctxFin = document.getElementById('chart-finansial-bar').getContext('2d');
    finansialChartInstance = new Chart(ctxFin, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Anggaran',
                    data: anggaranDataset,
                    backgroundColor: '#222222',
                    borderColor: '#222222',
                    borderWidth: 1
                },
                {
                    label: 'Realisasi Lapangan',
                    data: realisasiDataset,
                    backgroundColor: '#D4AF37',
                    borderColor: '#D4AF37',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

// Rendering TAB 4: Daftar Pengajuan Alokasi Dana Baru Lapangan
function renderPengajuan() {
    const tbody = document.querySelector('#table-pengajuan tbody');
    const mobileContainer = document.getElementById('cards-pengajuan');
    tbody.innerHTML = '';
    mobileContainer.innerHTML = '';

    appData.pengajuan.forEach(item => {
        let stClass = 'badge-perencanaan';
        if (item.Status_Pencairan === 'Cair' || item.Status_Pencairan === 'Disetujui') stClass = 'badge-selesai';
        if (item.Status_Pencairan === 'Pending' || item.Status_Pencairan === 'Proses') stClass = 'badge-ongoing';
        if (item.Status_Pencairan === 'Ditolak') stClass = 'badge-onhold';

        const linkHtml = item.Link_Doc_Pengajuan && item.Link_Doc_Pengajuan.startsWith('http') 
            ? `<a href="${item.Link_Doc_Pengajuan}" target="_blank" class="table-action-link">Buka Berkas ↗</a>` 
            : `<span style="color:#64748b; font-style:italic;">Tidak ada file</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.Tanggal_Pengajuan}</td>
            <td><strong>${item.Nama_Pekerjaan}</strong></td>
            <td><strong>${formatRupiah(item.Nilai_Pengajuan)}</strong></td>
            <td><span class="badge ${stClass}">${item.Status_Pencairan}</span></td>
            <td>${linkHtml}</td>
        `;
        tbody.appendChild(tr);

        const mCard = document.createElement('div');
        mCard.className = 'mobile-card';
        mCard.innerHTML = `
            <div class="mobile-card-row" style="border-bottom:1px solid #e2e8f0; padding-bottom:0.4rem; margin-bottom:0.4rem;">
                <span class="mobile-card-label" style="color:#222;"><strong>${item.Nama_Pekerjaan}</strong></span>
                <span class="badge ${stClass}">${item.Status_Pencairan}</span>
            </div>
            <div class="mobile-card-row"><span class="mobile-card-label">Tanggal</span><span class="mobile-card-value">${item.Tanggal_Pengajuan}</span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Nilai Pengajuan</span><span class="mobile-card-value"><strong>${formatRupiah(item.Nilai_Pengajuan)}</strong></span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Aksi</span><span class="mobile-card-value">${linkHtml}</span></div>
        `;
        mobileContainer.appendChild(mCard);
    });
}

// Rendering TAB 5: Pusat Link Akses Cepat Dokumen Kontrak & Bukti
function renderDokumen() {
    const tbody = document.querySelector('#table-dokumen tbody');
    const mobileContainer = document.getElementById('cards-dokumen');
    tbody.innerHTML = '';
    mobileContainer.innerHTML = '';

    appData.master.forEach(item => {
        const rabHtml = item.Link_RAB_Detail && item.Link_RAB_Detail.startsWith('http') ? `<a href="${item.Link_RAB_Detail}" target="_blank" class="table-action-link">Detail RAB ↗</a>` : '-';
        const dokHtml = (item.Link_Documentation || item.Link_Dokumentasi) && (item.Link_Documentation || item.Link_Dokumentasi).startsWith('http') ? `<a href="${item.Link_Documentation || item.Link_Dokumentasi}" target="_blank" class="table-action-link">Dokumentasi ↗</a>` : '-';
        const buktiHtml = item.Link_Bukti_Transaksi && item.Link_Bukti_Transaksi.startsWith('http') ? `<a href="${item.Link_Bukti_Transaksi}" target="_blank" class="table-action-link">Bukti Transaksi ↗</a>` : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.Nama_Pekerjaan}</strong></td>
            <td>${rabHtml}</td>
            <td>${dokHtml}</td>
            <td>${buktiHtml}</td>
        `;
        tbody.appendChild(tr);

        const mCard = document.createElement('div');
        mCard.className = 'mobile-card';
        mCard.innerHTML = `
            <div class="mobile-card-row" style="font-weight:bold; color:#222;"><span>${item.Nama_Pekerjaan}</span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">RAB Detail</span><span class="mobile-card-value">${rabHtml}</span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Dokumentasi</span><span class="mobile-card-value">${dokHtml}</span></div>
            <div class="mobile-card-row"><span class="mobile-card-label">Bukti Transaksi</span><span class="mobile-card-value">${buktiHtml}</span></div>
        `;
        mobileContainer.appendChild(mCard);
    });
}

// Filter Kontrol Penanganan Galeri Foto
function initGalleryFilters() {
    const filters = document.querySelectorAll('.filter-btn');
    filters.forEach(btn => {
        btn.addEventListener('click', () => {
            filters.forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            activeGalleryFilter = btn.getAttribute('data-filter');
            renderGaleri();
        });
    });
}

// Rendering TAB 6: Galeri Visual Dokumentasi Lapangan Komprehensif
function renderGaleri() {
    const container = document.getElementById('gallery-container');
    container.innerHTML = '';

    const filteredData = appData.dokumentasi.filter(img => {
        if (activeGalleryFilter === 'Semua') return true;
        return img.Kategori_Foto && img.Kategori_Foto.toLowerCase() === activeGalleryFilter.toLowerCase();
    });

    if (filteredData.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 2rem;">Tidak ada arsip dokumentasi visual pada kategori "${activeGalleryFilter}".</p>`;
        return;
    }

    filteredData.forEach(img => {
        const card = document.createElement('div');
        card.className = 'gallery-card';
        
        // Aturan Fallback Image jika tautan bermasalah atau kosong
        const imgSrc = img.Link_Foto && img.Link_Foto.startsWith('http') ? img.Link_Foto : 'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=500&q=80';

        card.innerHTML = `
            <div class="gallery-img-wrapper">
                <img src="${imgSrc}" alt="${img.Kategori_Foto}" loading="lazy">
                <span class="gallery-badge">${img.Kategori_Foto}</span>
            </div>
            <div class="gallery-info">
                <h4>${img.Nama_Pekerjaan}</h4>
                <p class="gallery-caption">${img.Caption || '-'}</p>
                <div class="gallery-date">${img.Tanggal_Upload || ''}</div>
            </div>
        `;
        container.appendChild(card);
    });
}
