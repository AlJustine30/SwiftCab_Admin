// Function to load driver data from Firestore
function loadDriverData() {
    db.collection("drivers").get()
        .then((querySnapshot) => {
            drivers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), runtimeStatus: 'offline' }));
            // Compute runtime status from RTDB and Firestore rides, then render
            return Promise.all([
                computeRealtimeOnlineStatuses(),
                computeBookedStatuses(),
                loadDriverProfileImages()
            ]).then(() => {
                updateDashboardStats();
                // Re-render main drivers table to reflect runtime status
                if (typeof loadDriversTable === 'function') {
                    loadDriversTable();
                }
                loadDriverEarningsToday();
                // Initialize Leaflet map and start refresh after core data loads
                initDriverMapIfNeeded();
                refreshDriverMap();
                startDriverMapAutoRefresh();
            });
        })
        .catch((error) => {
            showToast("Error loading drivers: " + error.message, "error");
        });
}

// Pull online status from RTDB: drivers/{driverId}/isOnline === true
function computeRealtimeOnlineStatuses() {
    return rtdb.ref('drivers').once('value').then(snapshot => {
        const onlineMap = snapshot.val() || {};
        const isOnline = (entry) => {
            if (!entry) return false;
            // Support both boolean and string variants
            const val = entry.isOnline;
            return val === true || String(val).toLowerCase() === 'true';
        };
        drivers.forEach(d => {
            const entry = onlineMap[d.id];
            if (isOnline(entry)) {
                d.runtimeStatus = 'online';
            } else {
                d.runtimeStatus = 'offline';
            }
            // Capture last known location if available
            const lat = entry && (typeof entry?.location?.latitude === 'number' ? entry.location.latitude : entry?.latitude);
            const lng = entry && (typeof entry?.location?.longitude === 'number' ? entry.location.longitude : entry?.longitude);
            if (typeof lat === 'number' && typeof lng === 'number') {
                d.location = { latitude: lat, longitude: lng };
            }
        });
    }).catch(err => {
        // If RTDB fails, keep existing runtimeStatus (defaults to offline)
        showToast('Realtime status load failed: ' + err.message, 'error');
    });
}

// Determine booked status via backend callable (no RTDB client reads)
function computeBookedStatuses() {
    const fn = (typeof functions !== 'undefined' ? functions : firebase.app().functions('us-central1')).httpsCallable('getBookedDrivers');
    return fn().then(res => {
        const ids = (res?.data?.driverIds || []).map(String);
        const set = new Set(ids);
        drivers.forEach(d => {
            if (set.has(String(d.id))) {
                d.runtimeStatus = 'booked';
            }
        });
    }).catch(err => {
        showToast('Booked status load failed: ' + (err?.message || err), 'error');
    });
}

// Load driver profile images from Firestore users/{driverId}.profileImageUrl
function loadDriverProfileImages() {
    const loads = drivers.map(d =>
        db.collection('users').doc(d.id).get()
            .then(doc => {
                const url = doc.exists ? (doc.get('profileImageUrl') || null) : null;
                if (url) d.profileImageUrl = url;
            })
            .catch(() => {
                // Ignore failures; leave without image and use fallback
            })
    );
    return Promise.all(loads);
}

// Function to load driver stats for monitoring
function loadDriverStats() {
    // Compute on-duty drivers from runtime status
    let onDutyDrivers = 0;
    for (const driver of drivers) {
        const rs = driver.runtimeStatus;
        if (rs === 'online' || rs === 'booked') onDutyDrivers++;
        else if (!rs && driver.status === 'active') onDutyDrivers++;
    }

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setText('onDutyDrivers', onDutyDrivers);

    // Define day boundaries for today (Firestore Timestamp)
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    // bookinghistory.timestamp is stored as a numeric epoch (ms)
    const startMs = start.getTime();
    const endMs = end.getTime();
    const startTs = firebase.firestore.Timestamp.fromDate(start);
    const endTs = firebase.firestore.Timestamp.fromDate(end);

    // Completed rides today from Firestore bookinghistory within today's range
    const bookingsPromise = db.collection('bookinghistory')
        .where('timestamp', '>=', startMs)
        .where('timestamp', '<=', endMs)
        .get()
        .then(qs => {
            let completedToday = 0;
            qs.forEach(doc => {
                const st = (doc.get('status') || '').toUpperCase();
                if (st === 'COMPLETED') completedToday++;
            });
            setText('completedRides', completedToday);
        })
        .catch(err => {
            showToast('Failed to load booking history: ' + err.message, 'error');
            setText('completedRides', 0);
        });

    // Removed: Pending Requests and Active Rides cards and their RTDB queries

    // Read explicit reports from Firestore for today
    const ratingsPromise = db.collection('reports')
        .where('timestamp', '>=', startMs)
        .where('timestamp', '<=', endMs)
        .get()
        .then(querySnapshot => {
            // Count number of reports created today
            setText('issueReports', querySnapshot.size || 0);
        })
        .catch(err => {
            // If reports query fails, default to 0
            setText('issueReports', 0);
        });

    return Promise.all([bookingsPromise, ratingsPromise]);
}

// List online drivers (status === 'active') in table
function loadOnlineDrivers() {
    const tableBody = document.getElementById('onlineDriversList');
    if (!tableBody) return;
    const online = drivers.filter(d => d.runtimeStatus === 'online');
    tableBody.innerHTML = online.map(driver => {
        const email = driver.email || '';
        const phone = driver.phone || '';
        return `
            <tr>
                <td>${driver.name || 'Unknown'}</td>
                <td>${email}<br><small>${phone}</small></td>
                <td><span class="status status-active">Online</span></td>
            </tr>
        `;
    }).join('');
}

// List offline drivers (status === 'inactive') in table
function loadOfflineDrivers() {
    const tableBody = document.getElementById('offlineDriversList');
    if (!tableBody) return;
    const offline = drivers.filter(d => d.runtimeStatus === 'offline');
    tableBody.innerHTML = offline.map(driver => {
        const email = driver.email || '';
        const phone = driver.phone || '';
        return `
            <tr>
                <td>${driver.name || 'Unknown'}</td>
                <td>${email}<br><small>${phone}</small></td>
                <td><span class="status status-inactive">Offline</span></td>
            </tr>
        `;
    }).join('');
}

// List booked drivers in table
function loadBookedDrivers() {
    const tableBody = document.getElementById('bookedDriversList');
    if (!tableBody) return; // section may be absent
    const booked = drivers.filter(d => d.runtimeStatus === 'booked');
    tableBody.innerHTML = booked.map(driver => {
        const email = driver.email || '';
        const phone = driver.phone || '';
        return `
            <tr>
                <td>${driver.name || 'Unknown'}</td>
                <td>${email}<br><small>${phone}</small></td>
                <td><span class="status status-booked">Booked</span></td>
            </tr>
        `;
    }).join('');
}

// Unified Drivers section removed; use Manage Drivers page.

// Compute earnings for today per driver from Firestore bookinghistory
function loadDriverEarningsToday() {
    const tbody = document.getElementById('driverEarningsList');
    if (!tbody) return;
    if (!drivers || drivers.length === 0) { tbody.innerHTML = ''; return; }

    // Date range for today
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startMs = start.getTime();
    const endMs = end.getTime();

    // Render placeholder while loading
    tbody.innerHTML = '<tr><td colspan="3">Loading earnings...</td></tr>';

    const results = [];
    const promises = drivers.map(driver =>
        db.collection('bookinghistory')
            .where('driverId', '==', driver.id)
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
                // Show a toast but continue
                showToast(`Earnings fetch failed for ${driver.name || driver.id}: ${err.message}`, 'error');
                results.push({ driver, total: 0, count: 0 });
            })
    );

    Promise.all(promises).then(() => {
        // Sort by highest earnings today
        results.sort((a, b) => b.total - a.total);
        tbody.innerHTML = results.map(r => `
            <tr>
                <td>${r.driver.name || 'Unknown'}</td>
                <td>${r.count}</td>
                <td>₱${r.total.toFixed(2)}</td>
            </tr>
        `).join('');
    });
}

// Earnings History moved to earnings.html

// Initialize dashboard event listeners
document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('refreshStatsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => { loadDriverStats(); });
    }
    // Drivers section refresh removed; use Manage Drivers page.
    const refreshEarningsBtn = document.getElementById('refreshEarningsBtn');
    if (refreshEarningsBtn) refreshEarningsBtn.addEventListener('click', loadDriverEarningsToday);

    const refreshActiveBtn = document.getElementById('refreshActiveDriversBtn');
    if (refreshActiveBtn) refreshActiveBtn.addEventListener('click', () => { if (typeof loadDriverData === 'function') loadDriverData(); });

    // Earnings History controls removed from dashboard
});

// ---- Live Driver Map (Leaflet) ----
var driverMap = driverMap || null;
var driverMarkers = driverMarkers || new Map(); // driverId -> L.Marker
var driverMapTimer = driverMapTimer || null;
var driverMapFocusUntil = driverMapFocusUntil || 0; // ms timestamp to temporarily prevent auto-fit
var driverMapAutoCenter = driverMapAutoCenter || false; // do not auto-center on each refresh
// Dagupan City, Pangasinan, Philippines
var DAGUPAN_CENTER = typeof DAGUPAN_CENTER !== 'undefined' ? DAGUPAN_CENTER : [16.043, 120.333];
var DAGUPAN_ZOOM = typeof DAGUPAN_ZOOM !== 'undefined' ? DAGUPAN_ZOOM : 13;

function ensureLeafletLoaded() {
    return new Promise((resolve, reject) => {
        if (window.L) { resolve(); return; }
        const start = Date.now();
        const interval = setInterval(() => {
            if (window.L) { clearInterval(interval); resolve(); }
            else if (Date.now() - start > 5000) { clearInterval(interval); reject(new Error('Leaflet failed to load')); }
        }, 100);
    });
}

function initDriverMapIfNeeded() {
    const mapEl = document.getElementById('driverMap');
    if (!mapEl || driverMap) return;
    ensureLeafletLoaded().then(() => {
        // Center to Dagupan City by default
        driverMap = L.map(mapEl).setView(DAGUPAN_CENTER, DAGUPAN_ZOOM);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(driverMap);
    }).catch(() => {
        const status = document.getElementById('mapStatus');
        if (status) status.textContent = 'Leaflet failed to load.';
    });
}

function refreshDriverMap() {
    const statusEl = document.getElementById('mapStatus');
    if (!driverMap) return; // not initialized yet
    rtdb.ref('drivers').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        const idsWithPositions = new Set();
        const bounds = L.latLngBounds([]);

        Object.keys(data).forEach(driverId => {
            const entry = data[driverId] || {};
            const onlineVal = entry.isOnline;
            const isOnline = onlineVal === true || String(onlineVal).toLowerCase() === 'true';
            if (!isOnline) return; // Only plot active drivers
            const lat = (typeof entry?.location?.latitude === 'number') ? entry.location.latitude : (typeof entry.latitude === 'number' ? entry.latitude : null);
            const lng = (typeof entry?.location?.longitude === 'number') ? entry.location.longitude : (typeof entry.longitude === 'number' ? entry.longitude : null);
            if (typeof lat !== 'number' || typeof lng !== 'number') return;
            idsWithPositions.add(driverId);
            const pos = [lat, lng];
            const existing = driverMarkers.get(driverId);
            const d = drivers.find(x => x.id === driverId);
            const title = d ? (d.name || d.id) : driverId;
            if (existing) {
                existing.setLatLng(pos);
            } else {
                const marker = L.marker(pos, { title });
                marker.addTo(driverMap);
                driverMarkers.set(driverId, marker);
            }
            bounds.extend(pos);
        });

        // Remove markers that no longer have positions
        for (const [id, marker] of driverMarkers.entries()) {
            if (!idsWithPositions.has(id)) {
                marker.remove();
                driverMarkers.delete(id);
            }
        }

        // Do not auto-center on refresh unless explicitly enabled
        if (driverMapAutoCenter && bounds.isValid() && Date.now() >= driverMapFocusUntil) {
            driverMap.fitBounds(bounds, { padding: [24, 24] });
        }
        if (statusEl) {
            const ts = new Date().toLocaleTimeString();
            statusEl.textContent = `Last update: ${ts} · Auto-refresh every 10s`;
        }
    }).catch(err => {
        if (statusEl) statusEl.textContent = 'Failed to fetch driver locations: ' + err.message;
    });
}

function startDriverMapAutoRefresh() {
    if (driverMapTimer) return; // already started
    driverMapTimer = setInterval(() => {
        if (driverMap) refreshDriverMap();
    }, 10000);
}

// Focus the map on a specific driver and show/update a marker
function focusDriverOnMap(driverId) {
    initDriverMapIfNeeded();
    const statusEl = document.getElementById('mapStatus');
    const d = drivers.find(x => x.id === driverId);
    const title = d ? (d.name || d.id) : driverId;
    const usePos = (lat, lng) => {
        if (typeof lat !== 'number' || typeof lng !== 'number' || !driverMap) {
            showToast('Location not available for this driver.', 'error');
            return;
        }
        let marker = driverMarkers.get(driverId);
        const pos = [lat, lng];
        if (marker) {
            marker.setLatLng(pos);
        } else {
            marker = L.marker(pos, { title });
            marker.addTo(driverMap);
            driverMarkers.set(driverId, marker);
        }
        marker.bindPopup(`<b>${title}</b>`).openPopup();
        driverMap.setView(pos, 17);
        driverMapFocusUntil = Date.now() + 8000; // prevent auto-fit briefly
        if (statusEl) statusEl.textContent = `Focused on ${title}`;
    };
    // Prefer cached location; fallback to RTDB fetch
    if (d && d.location && typeof d.location.latitude === 'number' && typeof d.location.longitude === 'number') {
        usePos(d.location.latitude, d.location.longitude);
    } else {
        rtdb.ref('drivers/' + driverId).once('value').then(snap => {
            const entry = snap.val() || {};
            const lat = (typeof entry?.location?.latitude === 'number') ? entry.location.latitude : (typeof entry.latitude === 'number' ? entry.latitude : null);
            const lng = (typeof entry?.location?.longitude === 'number') ? entry.location.longitude : (typeof entry.longitude === 'number' ? entry.longitude : null);
            usePos(lat, lng);
        }).catch(() => {
            showToast('Failed to fetch driver location.', 'error');
        });
    }
}

// Expose for other modules (e.g., utils.js)
window.focusDriverOnMap = focusDriverOnMap;
