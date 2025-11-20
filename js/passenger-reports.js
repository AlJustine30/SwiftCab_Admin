document.addEventListener('DOMContentLoaded', function() {
  auth.onAuthStateChanged((user) => {
    const adminDashboard = document.getElementById('adminDashboard');
    const adminName = document.getElementById('adminName');
    if (!user) {
      try { db.terminate().catch(() => {}).finally(() => { window.location.replace('index.html'); }); } catch (_) { window.location.replace('index.html'); }
      return;
    }
    if (adminDashboard) adminDashboard.style.display = 'flex';
    if (adminName) adminName.textContent = user.email || 'Admin User';

    const dateInput = document.getElementById('usageDate');
    if (dateInput) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      dateInput.value = `${y}-${m}-${d}`;
    }
    loadPassengerUsage();
  });

  const loadUsageBtn = document.getElementById('loadUsageBtn');
  if (loadUsageBtn) loadUsageBtn.addEventListener('click', loadPassengerUsage);
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut().then(() => window.location.href = 'index.html'));
});

function loadPassengerUsage() {
  const dateInput = document.getElementById('usageDate');
  const chartCanvas = document.getElementById('usageChart');
  const timesTbody = document.getElementById('usageTimesList');
  if (!dateInput || !chartCanvas || !timesTbody) return;
  const val = dateInput.value;
  if (!val) return;
  const [year, month, day] = val.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  const startMs = start.getTime();
  const endMs = end.getTime();

  db.collection('bookinghistory')
    .where('timestamp', '>=', startMs)
    .where('timestamp', '<=', endMs)
    .get()
    .then(qs => {
      const hourCounts = new Array(24).fill(0);
      const rows = [];
      qs.forEach(doc => {
        const ts = doc.get('timestamp');
        const riderId = doc.get('riderId');
        const riderName = doc.get('riderName');
        const status = (doc.get('status') || '').toString();
        const finalFare = doc.get('finalFare');
        const estimatedFare = doc.get('estimatedFare');
        const fare = typeof finalFare === 'number' ? finalFare : (typeof estimatedFare === 'number' ? estimatedFare : null);
        let t = null;
        if (typeof ts === 'number') t = new Date(ts);
        else if (ts && ts.toDate) t = ts.toDate();
        if (!t) return;
        hourCounts[t.getHours()]++;
        rows.push({ time: t, riderName: (riderName || riderId || '—'), fare, status: status || '—' });
      });
      drawBarChart(chartCanvas, hourCounts);
      renderUsageHourlyList(document.getElementById('usageHourlyList'), hourCounts);
      renderUsageTimesList(timesTbody, rows);
    })
    .catch(() => {
      db.collection('bookinghistory')
        .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(start))
        .where('timestamp', '<=', firebase.firestore.Timestamp.fromDate(end))
        .get()
        .then(qs2 => {
          const hourCounts = new Array(24).fill(0);
          const rows = [];
          qs2.forEach(doc => {
            const ts = doc.get('timestamp');
            const riderId = doc.get('riderId');
            const riderName = doc.get('riderName');
            const status = (doc.get('status') || '').toString();
            const finalFare = doc.get('finalFare');
            const estimatedFare = doc.get('estimatedFare');
            const fare = typeof finalFare === 'number' ? finalFare : (typeof estimatedFare === 'number' ? estimatedFare : null);
            let t = null;
            if (ts && ts.toDate) t = ts.toDate();
            if (!t) return;
            hourCounts[t.getHours()]++;
            rows.push({ time: t, riderName: (riderName || riderId || '—'), fare, status: status || '—' });
          });
          drawBarChart(chartCanvas, hourCounts);
          renderUsageHourlyList(document.getElementById('usageHourlyList'), hourCounts);
          renderUsageTimesList(timesTbody, rows);
        })
        .catch(err => { showToast('Failed to load usage report: ' + (err?.message || err), 'error'); });
    });
}

function drawBarChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  const padding = 32;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const maxVal = Math.max(1, ...data);
  const barWidth = chartWidth / data.length;

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, padding + chartHeight);
  ctx.lineTo(padding + chartWidth, padding + chartHeight);
  ctx.stroke();

  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    const barHeight = Math.round((val / maxVal) * (chartHeight - 20));
    const x = padding + i * barWidth + 2;
    const y = padding + chartHeight - barHeight;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(x, y, barWidth - 4, barHeight);

    if (val > 0) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '11px Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(String(val), x + (barWidth - 4) / 2, y - 4);
      ctx.textAlign = 'start';
    }
    ctx.fillStyle = '#475569';
    ctx.font = '10px Roboto, Arial';
    const h = i % 12 === 0 ? 12 : (i % 12);
    const ap = i < 12 ? 'AM' : 'PM';
    const label = `${h} ${ap}`;
    ctx.fillText(label, x + 2, padding + chartHeight + 12);
  }

  ctx.fillStyle = '#0f172a';
  ctx.font = '12px Roboto, Arial';
  ctx.fillText('Bookings per hour (12-hour)', padding, padding - 8);
}

function renderUsageTimesList(tbody, rows) {
  rows.sort((a, b) => a.time.getTime() - b.time.getTime());
  const html = rows.map((r, idx) => {
    const timeStr = r.time.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    const fareStr = (typeof r.fare === 'number') ? `₱${r.fare.toFixed(2)}` : '—';
    return `<tr><td>${idx + 1}</td><td>${timeStr}</td><td>${r.riderName}</td><td>${fareStr}</td><td>${r.status}</td></tr>`;
  }).join('');
  tbody.innerHTML = html || '<tr><td colspan="5">No bookings found for selected day.</td></tr>';
}

function renderUsageHourlyList(tbody, counts) {
  if (!tbody || !counts || !counts.length) return;
  const rows = counts.map((c, i) => ({ c, i })).filter(x => x.c > 0).map(x => {
    const h = x.i % 12 === 0 ? 12 : (x.i % 12);
    const ap = x.i < 12 ? 'AM' : 'PM';
    const label = `${h} ${ap}`;
    return `<tr><td>${label}</td><td>${x.c}</td></tr>`;
  }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="2">No bookings found for selected day.</td></tr>';
}
