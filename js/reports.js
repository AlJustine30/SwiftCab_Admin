// Reports page bootstrap and logic
let reportsData = [];

function countReportsToday() {
  const countEl = document.getElementById('reportsTodayCount');
  if (!countEl) return;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const startTs = firebase.firestore.Timestamp.fromDate(start);
  const endTs = firebase.firestore.Timestamp.fromDate(end);
  db.collection('reports')
    .where('timestamp', '>=', startMs)
    .where('timestamp', '<=', endMs)
    .get()
    .then(qs => { countEl.textContent = qs.size || 0; })
    .catch(() => {
      // Fallback: handle Firestore Timestamp type
      db.collection('reports')
        .where('timestamp', '>=', startTs)
        .where('timestamp', '<=', endTs)
        .get()
        .then(qs2 => { countEl.textContent = qs2.size || 0; })
        .catch(() => { countEl.textContent = 0; });
    });
}

function loadReports() {
  const tbody = document.getElementById('reportsList');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8">Loading reports...</td></tr>';

  db.collection('reports')
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get()
    .then(async (qs) => {
      reportsData = qs.docs.map(d => ({ id: d.id, ...d.data() }));
      // Resolve names for driver and reporter
      const uniqueDriverIds = Array.from(new Set(reportsData.map(r => r.driverId).filter(Boolean)));
      const uniqueReporterIds = Array.from(new Set(reportsData.map(r => r.reporterId).filter(Boolean)));

      const driverNameMap = {};
      const reporterNameMap = {};
      await Promise.all([
        Promise.all(uniqueDriverIds.map(id => db.collection('drivers').doc(id).get().then(doc => { driverNameMap[id] = doc.exists ? (doc.get('name') || id) : id; }).catch(() => { driverNameMap[id] = id; }))),
        Promise.all(uniqueReporterIds.map(id => db.collection('users').doc(id).get().then(doc => { reporterNameMap[id] = doc.exists ? (doc.get('displayName') || doc.get('name') || id) : id; }).catch(() => { reporterNameMap[id] = id; })))
      ]);

      renderReportsTable(tbody, reportsData, driverNameMap, reporterNameMap);
      attachReportActions();
      countReportsToday();
    })
    .catch(err => {
      showToast('Failed to load reports: ' + err.message, 'error');
      tbody.innerHTML = '<tr><td colspan="8">Failed to load reports.</td></tr>';
    });
}

function formatTime(ts) {
  try {
    if (ts && ts.toDate) return ts.toDate().toLocaleString();
    if (typeof ts === 'number') return new Date(ts).toLocaleString();
  } catch (_) {}
  return '—';
}

function renderReportsTable(tbody, reports, driverNameMap, reporterNameMap) {
  const rows = reports.map(r => {
    const timeStr = formatTime(r.timestamp);
    const category = r.category || '—';
    const message = (r.message || '').toString();
    const msgShort = message.length > 64 ? message.slice(0, 64) + '…' : message || '—';
    const driverName = r.driverId ? (driverNameMap[r.driverId] || r.driverId) : '—';
    const reporterName = r.reporterId ? (reporterNameMap[r.reporterId] || r.reporterId) : '—';
    const bookingId = r.bookingId || '—';
    const status = (r.status || 'open').toLowerCase();
    const statusClass = status === 'resolved' ? 'status-active' : 'status-warning';
    const statusLabel = status === 'resolved' ? 'Resolved' : 'Open';
    return `
      <tr data-report-id="${r.id}">
        <td>${timeStr}</td>
        <td>${category}</td>
        <td title="${message.replace(/"/g, '&quot;')}">${msgShort}</td>
        <td>${driverName}</td>
        <td>${reporterName}</td>
        <td>${bookingId}</td>
        <td><span class="status ${statusClass}">${statusLabel}</span></td>
        <td>
          <button class="action-btn btn-view" data-report-id="${r.id}">View</button>
          ${status === 'resolved' ? '' : `<button class="action-btn btn-resolve" data-report-id="${r.id}">Resolve</button>`}
        </td>
      </tr>
    `;
  }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="8">No reports found.</td></tr>';
}

function attachReportActions() {
  const tbody = document.getElementById('reportsList');
  if (!tbody) return;
  tbody.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-report-id');
      const report = reportsData.find(r => r.id === id);
      if (!report) return;
      const timeStr = formatTime(report.timestamp);
      alert(`Category: ${report.category || '—'}\nTime: ${timeStr}\nDriver: ${report.driverId || '—'}\nReporter: ${report.reporterId || '—'}\nBooking: ${report.bookingId || '—'}\n\nMessage:\n${report.message || '—'}`);
    });
  });
  tbody.querySelectorAll('.btn-resolve').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-report-id');
      if (!id || !currentUser) return;
      const ref = db.collection('reports').doc(id);
      ref.set({ status: 'resolved', resolvedAt: firebase.firestore.FieldValue.serverTimestamp(), resolvedBy: currentUser.uid }, { merge: true })
        .then(() => {
          showToast('Report marked as resolved');
          loadReports();
        })
        .catch(err => showToast('Failed to resolve: ' + err.message, 'error'));
    });
  });
}

function applyFilter(type) {
  const tbody = document.getElementById('reportsList');
  if (!tbody) return;
  let filtered = reportsData;
  if (type === 'open') filtered = reportsData.filter(r => (r.status || 'open').toLowerCase() !== 'resolved');
  if (type === 'resolved') filtered = reportsData.filter(r => (r.status || 'open').toLowerCase() === 'resolved');
  // Render without refetching names; keep last known values by computing quick maps
  const driverIds = Array.from(new Set(filtered.map(r => r.driverId).filter(Boolean)));
  const reporterIds = Array.from(new Set(filtered.map(r => r.reporterId).filter(Boolean)));
  const driverMap = Object.fromEntries(driverIds.map(id => [id, id]));
  const reporterMap = Object.fromEntries(reporterIds.map(id => [id, id]));
  renderReportsTable(tbody, filtered, driverMap, reporterMap);
  attachReportActions();
}

document.addEventListener('DOMContentLoaded', function() {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      try {
        db.terminate().catch(() => {}).finally(() => {
          window.location.replace('index.html');
        });
      } catch (_) {
        window.location.replace('index.html');
      }
      return;
    }
    currentUser = user;
    const adminDashboard = document.getElementById('adminDashboard');
    const adminName = document.getElementById('adminName');
    if (adminDashboard) adminDashboard.style.display = 'flex';
    if (adminName) adminName.textContent = user.email || 'Admin User';
    loadReports();
  });

  const refreshBtn = document.getElementById('refreshReportsBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadReports);
  const filterAllBtn = document.getElementById('filterAllBtn');
  if (filterAllBtn) filterAllBtn.addEventListener('click', () => applyFilter('all'));
  const filterOpenBtn = document.getElementById('filterOpenBtn');
  if (filterOpenBtn) filterOpenBtn.addEventListener('click', () => applyFilter('open'));
  const filterResolvedBtn = document.getElementById('filterResolvedBtn');
  if (filterResolvedBtn) filterResolvedBtn.addEventListener('click', () => applyFilter('resolved'));

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut().then(() => window.location.href = 'index.html'));
});


