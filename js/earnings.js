// Earnings History page logic

function loadDriversForEarnings() {
    return db.collection('drivers').get()
        .then(qs => {
            drivers = qs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        })
        .catch(err => {
            showToast('Failed to load drivers: ' + err.message, 'error');
            drivers = [];
        });
}

function loadDriverEarningsHistory() {
    const tbody = document.getElementById('driverEarningsHistoryList');
    const startInput = document.getElementById('earningsStartDate');
    const endInput = document.getElementById('earningsEndDate');
    if (!tbody || !startInput || !endInput) return;

    if (!drivers || drivers.length === 0) { tbody.innerHTML = ''; return; }

    const startDateStr = startInput.value;
    const endDateStr = endInput.value;
    if (!startDateStr || !endDateStr) {
        showToast('Please select both start and end dates.', 'error');
        return;
    }
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T23:59:59');
    // bookinghistory.timestamp is stored as numeric epoch (ms)
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    tbody.innerHTML = '<tr><td colspan="4">Loading history...</td></tr>';

    const results = [];
    const promises = drivers.map(driver =>
        db.collection('bookinghistory')
            .where('driverId', '==', driver.id)
            .where('status', '==', 'COMPLETED')
            .where('timestamp', '>=', startMs)
            .where('timestamp', '<=', endMs)
            .get()
            .then(qs => {
                let total = 0;
                let count = 0;
                qs.forEach(doc => {
                    const b = doc.data();
                    const fare = (b.finalFare ?? b.estimatedFare ?? 0);
                    total += Number(fare) || 0;
                    count += 1;
                });
                results.push({ driver, total, count });
            })
            .catch(err => {
                showToast(`Earnings history failed for ${driver.name || driver.id}: ${err.message}`, 'error');
                results.push({ driver, total: 0, count: 0 });
            })
    );

    Promise.all(promises).then(() => {
        // Sort by highest earnings in range
        results.sort((a, b) => b.total - a.total);
        tbody.innerHTML = results.map(r => {
            const name = r.driver.name || 'Unknown';
            return `
            <tr>
                <td>${name}</td>
                <td>${r.count}</td>
                <td>₱${r.total.toFixed(2)}</td>
                <td>
                    <button class="btn btn-primary view-history-btn" 
                        data-driver-id="${r.driver.id}" 
                        data-driver-name="${name}">
                        View booking history
                    </button>
                </td>
            </tr>`;
        }).join('');
        attachViewHistoryHandlers();
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Auth gate: require logged-in Admin
    auth.onAuthStateChanged((user) => {
        const adminDashboard = document.getElementById('adminDashboard');
        const adminName = document.getElementById('adminName');
        if (!user) {
            // Redirect to main dashboard login
            try {
                db.terminate().catch(() => {}).finally(() => {
                    window.location.replace('index.html');
                });
            } catch (_) {
                window.location.replace('index.html');
            }
            return;
        }
        if (adminDashboard) adminDashboard.style.display = 'flex';
        if (adminName) adminName.textContent = user.email || 'Admin User';
        // Prepare defaults and load data
        const startInput = document.getElementById('earningsStartDate');
        const endInput = document.getElementById('earningsEndDate');
        if (startInput && endInput) {
            const today = new Date();
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 7);
            const toISODate = (d) => d.toISOString().slice(0,10);
            startInput.value = toISODate(sevenDaysAgo);
            endInput.value = toISODate(today);
        }
        loadDriversForEarnings().then(loadDriverEarningsHistory);
    });

    const applyBtn = document.getElementById('applyEarningsHistoryBtn');
    if (applyBtn) applyBtn.addEventListener('click', loadDriverEarningsHistory);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut().then(() => window.location.href = 'index.html'));
    setupHistoryModalControls();
});

function attachViewHistoryHandlers() {
    const buttons = document.querySelectorAll('.view-history-btn');
    if (!buttons || buttons.length === 0) return;
    const startInput = document.getElementById('earningsStartDate');
    const endInput = document.getElementById('earningsEndDate');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const driverId = btn.getAttribute('data-driver-id');
            const driverName = btn.getAttribute('data-driver-name') || 'Driver';
            if (!startInput || !endInput || !driverId) return;
            const startMs = new Date(startInput.value + 'T00:00:00').getTime();
            const endMs = new Date(endInput.value + 'T23:59:59').getTime();
            openDriverHistoryModal(driverId, driverName, startMs, endMs);
        });
    });
}

function setupHistoryModalControls() {
    const overlay = document.getElementById('historyModalOverlay');
    const closeBtn = document.getElementById('closeHistoryModalBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => { if (overlay) overlay.style.display = 'none'; });
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'historyModalOverlay') overlay.style.display = 'none';
    });
}

function openDriverHistoryModal(driverId, driverName, startMs, endMs) {
    const overlay = document.getElementById('historyModalOverlay');
    const title = document.getElementById('historyModalTitle');
    const meta = document.getElementById('historyModalMeta');
    const list = document.getElementById('driverHistoryModalList');
    if (!overlay || !title || !meta || !list) return;
    // Show modal
    overlay.style.display = 'flex';
    title.textContent = `Booking History — ${driverName}`;
    const startInput = document.getElementById('earningsStartDate');
    const endInput = document.getElementById('earningsEndDate');
    const startStr = startInput ? startInput.value : '';
    const endStr = endInput ? endInput.value : '';
    meta.textContent = `Range: ${startStr} to ${endStr}`;
    list.innerHTML = '<tr><td colspan="6">Loading booking history...</td></tr>';

    db.collection('bookinghistory')
        .where('driverId', '==', driverId)
        .where('status', '==', 'COMPLETED')
        .where('timestamp', '>=', startMs)
        .where('timestamp', '<=', endMs)
        .get()
        .then(qs => {
            const bookings = [];
            qs.forEach(doc => {
                const b = doc.data();
                bookings.push({ id: doc.id, ...b });
            });
            bookings.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            if (bookings.length === 0) {
                list.innerHTML = '<tr><td colspan="6">No bookings found in this range.</td></tr>';
                return;
            }
            list.innerHTML = bookings.map(b => {
                const timeStr = b.timestamp ? new Date(b.timestamp).toLocaleString() : '-';
                const fareNum = Number(b.finalFare ?? b.estimatedFare ?? 0);
                const fareStr = `₱${fareNum.toFixed(2)}`;
                return `
                <tr>
                    <td>${timeStr}</td>
                    <td>${b.pickupAddress || '-'}</td>
                    <td>${b.destinationAddress || '-'}</td>
                    <td>${b.status || '-'}</td>
                    <td>${fareStr}</td>
                    <td>${b.bookingId || b.id}</td>
                </tr>`;
            }).join('');
        })
        .catch(err => {
            showToast('Failed to load booking history: ' + err.message, 'error');
            list.innerHTML = '<tr><td colspan="6">Error loading booking history.</td></tr>';
        });
}
