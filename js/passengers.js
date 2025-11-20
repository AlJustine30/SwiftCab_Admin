// Manage Passengers page bootstrap and logic
let passengers = [];

function loadPassengers() {
  const tbody = document.getElementById('passengersList');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4">Loading passengers...</td></tr>';

  // Prefer explicit role filter; fallback to all users if unsupported
  const col = db.collection('users');
  const query = col.where('role', 'in', ['Rider', 'Passenger']);
  query.get()
    .then(async (qs) => {
      passengers = qs.docs.map(d => ({ id: d.id, ...d.data() }));
      // Attach profile image from users.profileImageUrl
      passengers.forEach(p => {
        if (!p.profileImageUrl && p.profileImageUrl !== null) {
          p.profileImageUrl = null;
        }
      });

      // Fetch last booking per passenger (best-effort)
      const lastBookingsMap = {};
      await Promise.all(passengers.map(p => {
        const pid = p.id;
        return db.collection('bookinghistory')
          .where('riderId', '==', pid)
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get()
          .then(s => {
            const doc = s.docs[0];
            const ts = doc ? (doc.get('timestamp')) : null;
            lastBookingsMap[pid] = ts || null;
          })
          .catch(() => {
            // Fallback: pull all for rider and compute max timestamp client-side
            return db.collection('bookinghistory')
              .where('riderId', '==', pid)
              .get()
              .then(s2 => {
                let maxTs = null;
                s2.forEach(d => {
                  const t = d.get('timestamp');
                  if (typeof t === 'number') {
                    if (maxTs === null || t > maxTs) maxTs = t;
                  } else if (t && t.toDate) {
                    const n = t.toDate().getTime();
                    if (maxTs === null || n > maxTs) maxTs = n;
                  }
                });
                lastBookingsMap[pid] = maxTs;
              })
              .catch(() => { lastBookingsMap[pid] = null; });
          });
      }));

      renderPassengersTable(passengers, lastBookingsMap);
    })
    .catch(err => {
      // Fallback: load all users and filter client-side
      col.get().then(qs2 => {
        passengers = qs2.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(p => {
            const role = (p.role || '').toString();
            const r = role.toLowerCase();
            return r === 'rider' || r === 'passenger';
          });
        renderPassengersTable(passengers, {});
      }).catch(e => {
        showToast('Failed to load passengers: ' + (err?.message || e?.message || 'Unknown error'), 'error');
        tbody.innerHTML = '<tr><td colspan="4">Failed to load passengers.</td></tr>';
      });
    });
}

function renderPassengersTable(list, lastMap) {
  const tbody = document.getElementById('passengersList');
  if (!tbody) return;
  const rows = list.map(p => {
    const imgSrc = p.profileImageUrl || 'img/driver-placeholder.svg';
    const loyalty = typeof p.loyaltyPoints === 'number' ? p.loyaltyPoints : 0;
    const lastTs = lastMap[p.id];
    let lastStr = '—';
    try {
      if (typeof lastTs === 'number') lastStr = new Date(lastTs).toLocaleString();
      else if (lastTs && lastTs.toDate) lastStr = lastTs.toDate().toLocaleString();
    } catch (_) {}
    const email = p.email || '';
    const phone = p.phone || '';
    const name = p.displayName || p.name || 'Unknown';
    return `
      <tr data-id="${p.id}" data-name="${name}">
        <td>
          <div style="display:flex; align-items:center;">
            <img src="${imgSrc}" alt="Passenger" style="width:40px; height:40px; border-radius:50%; margin-right:0.75rem;">
            <div>
              <div>${name}</div>
              <small>ID: ${p.id.substring(0,8)}</small>
            </div>
          </div>
        </td>
        <td>
          <div>${email}</div>
          <small>${phone}</small>
        </td>
        <td>${loyalty}</td>
        <td>
          <div class="last-booking-cell">
            <span class="last-booking-date">${lastStr}</span>
            <button class="action-btn btn-view last-booking-view" data-action="view-last-booking">View</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="4">No passengers found.</td></tr>';
}

function searchPassengers() {
  const input = document.getElementById('searchPassenger');
  if (!input) return;
  const term = (input.value || '').toLowerCase();
  if (!term) { renderPassengersTable(passengers, {}); return; }
  const filtered = passengers.filter(p =>
    (p.displayName || p.name || '').toLowerCase().includes(term) ||
    (p.email || '').toLowerCase().includes(term) ||
    (p.phone || '').toLowerCase().includes(term)
  );
  renderPassengersTable(filtered, {});
}

document.addEventListener('DOMContentLoaded', function() {
  auth.onAuthStateChanged((user) => {
    const adminDashboard = document.getElementById('adminDashboard');
    const adminName = document.getElementById('adminName');
    if (!user) {
      try {
        db.disableNetwork().catch(() => {}).finally(() => { window.location.replace('index.html'); });
      } catch (_) { window.location.replace('index.html'); }
      return;
    }
    if (adminDashboard) adminDashboard.style.display = 'flex';
    if (adminName) adminName.textContent = user.email || 'Admin User';
    loadPassengers();
  });

  const searchBtn = document.getElementById('searchPassengerBtn');
  if (searchBtn) searchBtn.addEventListener('click', searchPassengers);
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut().then(() => window.location.href = 'index.html'));

  const tbody = document.getElementById('passengersList');
  if (tbody) {
    tbody.addEventListener('click', function(e) {
      const btn = e.target.closest('button[data-action="view-last-booking"]');
      if (!btn) return;
      const row = btn.closest('tr');
      const id = row ? row.getAttribute('data-id') : null;
      const name = row ? row.getAttribute('data-name') : '';
      if (!id) return;
      openPassengerLastBookingModal(id, name);
    });
  }

  const closeBtn = document.getElementById('closePassengerBookingModalBtn');
  const overlay = document.getElementById('passengerBookingModalOverlay');
  if (closeBtn) closeBtn.addEventListener('click', () => { if (overlay) overlay.style.display = 'none'; });
  if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });
});

function openPassengerLastBookingModal(passengerId, passengerName) {
  const overlay = document.getElementById('passengerBookingModalOverlay');
  const title = document.getElementById('passengerBookingModalTitle');
  const meta = document.getElementById('passengerBookingModalMeta');
  const list = document.getElementById('passengerLastBookingDetails');
  if (!overlay || !title || !meta || !list) return;
  overlay.style.display = 'flex';
  title.textContent = `Last Booking — ${passengerName}`;
  meta.textContent = '';
  list.innerHTML = '<tr><td colspan="7">Loading last booking...</td></tr>';

  db.collection('bookinghistory')
    .where('riderId', '==', passengerId)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get()
    .then(qs => {
      if (qs.empty) {
        list.innerHTML = '<tr><td colspan="7" style="padding:12px;">No bookings found.</td></tr>';
        return;
      }
      const doc = qs.docs[0];
      const b = doc.data();
      const time = (typeof b.timestamp === 'number') ? new Date(b.timestamp) : (b.timestamp && b.timestamp.toDate ? b.timestamp.toDate() : null);
      const timeStr = time ? time.toLocaleString() : '—';
      const pickup = b.pickupAddress || '—';
      const dest = b.destinationAddress || '—';
      const driver = b.driverName || '—';
      const status = b.status || '—';
      const fareNum = (b.finalFare ?? b.estimatedFare);
      const fareStr = typeof fareNum === 'number' ? `₱${fareNum.toFixed(2)}` : '—';
      const idStr = doc.id;
      list.innerHTML = `
        <tr>
          <td style="padding:12px; white-space:nowrap;">${timeStr}</td>
          <td style="padding:12px; word-break:break-word;">${pickup}</td>
          <td style="padding:12px; word-break:break-word;">${dest}</td>
          <td style="padding:12px;">${driver}</td>
          <td style="padding:12px;">${status}</td>
          <td style="padding:12px;">${fareStr}</td>
          <td style="padding:12px; font-family:monospace;">${idStr}</td>
        </tr>
      `;
      const dPhone = b.driverPhone || '';
      const dVeh = b.driverVehicleDetails || '';
      const extra = [];
      if (dPhone) extra.push(`Driver Phone: ${dPhone}`);
      if (dVeh) extra.push(`Vehicle: ${dVeh}`);
      if (extra.length) meta.textContent = extra.join(' • ');
    })
    .catch(err => {
      list.innerHTML = `<tr><td colspan="7">Failed to load: ${err?.message || err}</td></tr>`;
    });
}
