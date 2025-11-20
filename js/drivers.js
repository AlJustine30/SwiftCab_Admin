// Function to create a new driver
function createDriver() {
    const name = document.getElementById('driverName').value;
    const email = document.getElementById('driverEmail').value;
    const password = document.getElementById('driverPassword') ? document.getElementById('driverPassword').value : '';
    const phone = document.getElementById('driverPhone').value;
    const license = document.getElementById('driverLicense').value;
    const address = document.getElementById('driverAddress').value;
    const vehicleMake = document.getElementById('vehicleMake').value;
    const vehicleModel = document.getElementById('vehicleModel').value;
    const vehicleYear = document.getElementById('vehicleYear').value;
    const vehicleColor = document.getElementById('vehicleColor').value;
    const licensePlate = document.getElementById('licensePlate').value;
    
    // Simple validation
    if (!name || !email || !phone) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    if (!password || password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    // Create driver object
    const driver = {
        role: 'Driver',
        name,
        email,
        phone,
        license,
        address,
        vehicle: {
            make: vehicleMake,
            model: vehicleModel,
            year: vehicleYear,
            color: vehicleColor,
            licensePlate
        },
        status: 'active',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const createBtn = document.getElementById('createDriverBtn');
    if (createBtn) createBtn.disabled = true;
    const fn = (typeof functions !== 'undefined' ? functions : firebase.app().functions('us-central1')).httpsCallable('createDriverAccount');
    fn({
        name,
        email,
        password,
        phone,
        license,
        address,
        vehicle: {
            make: vehicleMake,
            model: vehicleModel,
            year: vehicleYear,
            color: vehicleColor,
            licensePlate
        }
    })
    .then(() => {
        showToast('Driver created successfully!');
        // Clear form
        document.getElementById('driverName').value = '';
        document.getElementById('driverEmail').value = '';
        if (document.getElementById('driverPassword')) document.getElementById('driverPassword').value = '';
        document.getElementById('driverPhone').value = '';
        document.getElementById('driverLicense').value = '';
        document.getElementById('driverAddress').value = '';
        document.getElementById('vehicleMake').value = '';
        document.getElementById('vehicleModel').value = '';
        document.getElementById('vehicleYear').value = '';
        document.getElementById('vehicleColor').value = '';
        document.getElementById('licensePlate').value = '';
        // Refresh driver data
        if (typeof loadDriverData === 'function') loadDriverData();
        if (createBtn) createBtn.disabled = false;
    })
    .catch((error) => {
        const msg = (error && (error.message || error)) || 'Unknown error';
        // Fallback #1: use a secondary Firebase app to create the user without affecting current session
        let secondary;
        try {
            const cfg = firebase.app().options;
            secondary = firebase.apps.find(a => a.name === 'Secondary') || firebase.initializeApp(cfg, 'Secondary');
        } catch (_) {
            secondary = null;
        }
        const createWithSecondary = secondary
            ? secondary.auth().createUserWithEmailAndPassword(email, password)
            : Promise.reject(new Error('Secondary app init failed'));

        createWithSecondary
        .then((cred) => {
            const uid = cred && cred.user && cred.user.uid;
            if (!uid) throw new Error('Failed to get new user UID');
            return db.collection('drivers').doc(uid).set({ ...driver, uid })
              .then(() => ({ uid }));
        })
        .then(() => {
            showToast('Driver created successfully!');
            document.getElementById('driverName').value = '';
            document.getElementById('driverEmail').value = '';
            if (document.getElementById('driverPassword')) document.getElementById('driverPassword').value = '';
            document.getElementById('driverPhone').value = '';
            document.getElementById('driverLicense').value = '';
            document.getElementById('driverAddress').value = '';
            document.getElementById('vehicleMake').value = '';
            document.getElementById('vehicleModel').value = '';
            document.getElementById('vehicleYear').value = '';
            document.getElementById('vehicleColor').value = '';
            document.getElementById('licensePlate').value = '';
            if (typeof loadDriverData === 'function') loadDriverData();
            if (createBtn) createBtn.disabled = false;
        })
        .catch(() => {
            // Fallback #2: Identity Toolkit REST signUp
            const apiKey = (firebase.app().options && firebase.app().options.apiKey) || '';
            const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, returnSecureToken: true })
            })
            .then(res => res.json())
            .then(json => {
                const uid = json && json.localId;
                if (!uid) throw new Error(json?.error?.message || 'Sign up failed');
                return db.collection('drivers').doc(uid).set({ ...driver, uid })
                  .then(() => ({ uid }));
            })
            .then(() => {
                showToast('Driver created successfully!');
                document.getElementById('driverName').value = '';
                document.getElementById('driverEmail').value = '';
                if (document.getElementById('driverPassword')) document.getElementById('driverPassword').value = '';
                document.getElementById('driverPhone').value = '';
                document.getElementById('driverLicense').value = '';
                document.getElementById('driverAddress').value = '';
                document.getElementById('vehicleMake').value = '';
                document.getElementById('vehicleModel').value = '';
                document.getElementById('vehicleYear').value = '';
                document.getElementById('vehicleColor').value = '';
                document.getElementById('licensePlate').value = '';
                if (typeof loadDriverData === 'function') loadDriverData();
                if (createBtn) createBtn.disabled = false;
            })
            .catch((err) => {
                const m = (err && (err.message || err)) || msg;
                showToast('Error creating driver: ' + m, 'error');
                if (createBtn) createBtn.disabled = false;
            });
        })
        .finally(() => {
            try { if (secondary) secondary.delete(); } catch (_) {}
        });
    });
}

// Function to load drivers table
function loadDriversTable() {
    const driversList = document.getElementById('driversList');
    if (!driversList) return;
    driversList.innerHTML = drivers.map(driver => {
        const imgSrc = driver.profileImageUrl || 'img/driver-placeholder.svg';
        const rs = driver.runtimeStatus || '';
        const statusClass = rs
            ? (rs === 'booked' ? 'status-booked' : rs === 'online' ? 'status-active' : 'status-inactive')
            : `status-${driver.status}`;
        const statusText = rs
            ? (rs === 'booked' ? 'Booked' : rs === 'online' ? 'Online' : 'Offline')
            : driver.status;
        return `
            <tr data-id="${driver.id}">
                <td>
                    <div style="display: flex; align-items: center;">
                        <img src="${imgSrc}" alt="Driver" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 0.75rem;">
                        <div>
                            <div>${driver.name}</div>
                            <small>ID: ${driver.id.substring(0, 8)}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <div>${driver.email}</div>
                    <small>${driver.phone}</small>
                </td>
                <td>${driver.vehicle ? `${driver.vehicle.make} ${driver.vehicle.model} (${driver.vehicle.color})` : 'N/A'}</td>
                <td><span class="status ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="action-btn btn-view" data-action="view">View</button>
                    <button class="action-btn btn-edit" data-action="edit">Edit</button>
                    <button class="action-btn btn-delete" data-action="delete">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Function to search drivers
function searchDrivers() {
    const searchInput = document.getElementById('searchDriver');
    if (!searchInput) return;
    const searchTerm = searchInput.value.toLowerCase();
    if (!searchTerm) {
        loadDriversTable();
        return;
    }
    const filteredDrivers = drivers.filter(driver =>
        driver.name.toLowerCase().includes(searchTerm) ||
        driver.email.toLowerCase().includes(searchTerm) ||
        (driver.phone && driver.phone.includes(searchTerm))
    );
    const driversList = document.getElementById('driversList');
    if (!driversList) return;
    driversList.innerHTML = filteredDrivers.map(driver => {
        const imgSrc = driver.profileImageUrl || 'img/driver-placeholder.svg';
        const rs = driver.runtimeStatus || '';
        const statusClass = rs
            ? (rs === 'booked' ? 'status-booked' : rs === 'online' ? 'status-active' : 'status-inactive')
            : `status-${driver.status}`;
        const statusText = rs
            ? (rs === 'booked' ? 'Booked' : rs === 'online' ? 'Online' : 'Offline')
            : driver.status;
        return `
            <tr data-id="${driver.id}">
                <td>
                    <div style="display: flex; align-items: center;">
                        <img src="${imgSrc}" alt="Driver" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 0.75rem;">
                        <div>
                            <div>${driver.name}</div>
                            <small>ID: ${driver.id.substring(0, 8)}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <div>${driver.email}</div>
                    <small>${driver.phone}</small>
                </td>
                <td>${driver.vehicle ? `${driver.vehicle.make} ${driver.vehicle.model} (${driver.vehicle.color})` : 'N/A'}</td>
                <td><span class="status ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="action-btn btn-view" data-action="view">View</button>
                    <button class="action-btn btn-edit" data-action="edit">Edit</button>
                    <button class="action-btn btn-delete" data-action="delete">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Unified driver action handler (view, edit, delete)
function handleDriverAction(event) {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const tr = btn.closest('tr[data-id]');
    if (!tr) return;
    const driverId = tr.getAttribute('data-id');
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;
    const action = btn.getAttribute('data-action');
    if (action === 'view') {
        alert(`Driver Details:\nName: ${driver.name}\nEmail: ${driver.email}\nPhone: ${driver.phone}\nStatus: ${driver.runtimeStatus || driver.status}`);
    } else if (action === 'edit') {
        openEditDriverModal(driver);
    } else if (action === 'delete') {
        if (confirm('Are you sure you want to delete this driver?')) {
            db.collection("drivers").doc(driverId).delete()
                .then(() => {
                    showToast('Driver deleted successfully!');
                    loadDriverData();
                })
                .catch((error) => {
                    showToast('Error deleting driver: ' + error.message, 'error');
                });
        }
    }
}

// Initialize drivers event listeners
(function() {
    const attach = function() {
        const createBtn = document.getElementById('createDriverBtn');
        if (createBtn) createBtn.addEventListener('click', createDriver);
        const searchBtn = document.getElementById('searchDriverBtn');
        if (searchBtn) searchBtn.addEventListener('click', searchDrivers);
        const searchInput = document.getElementById('searchDriver');
        if (searchInput) {
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') searchDrivers();
            });
        }
        const driversList = document.getElementById('driversList');
        if (driversList) {
            driversList.addEventListener('click', handleDriverAction);
        }
        const cancelBtn = document.getElementById('cancelEditDriverBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', closeEditDriverModal);
        const saveBtn = document.getElementById('saveDriverBtn');
        if (saveBtn) saveBtn.addEventListener('click', saveDriverEdits);
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
})();

function openEditDriverModal(driver) {
    const modal = document.getElementById('editDriverModal');
    if (!modal) return;
    setInput('editDriverId', driver.id);
    setInput('editDriverName', driver.name || '');
    setInput('editDriverEmail', driver.email || '');
    setInput('editDriverPhone', driver.phone || '');
    setInput('editDriverLicense', driver.license || '');
    setInput('editDriverAddress', driver.address || '');
    const v = driver.vehicle || {};
    setInput('editVehicleMake', v.make || '');
    setInput('editVehicleModel', v.model || '');
    setInput('editVehicleYear', v.year || '');
    setInput('editVehicleColor', v.color || '');
    setInput('editLicensePlate', v.licensePlate || '');
    const statusSel = document.getElementById('editDriverStatus');
    if (statusSel) statusSel.value = driver.status || 'active';
    modal.style.display = 'flex';
}

function closeEditDriverModal() {
    const modal = document.getElementById('editDriverModal');
    if (modal) modal.style.display = 'none';
}

function setInput(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function getInput(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

function saveDriverEdits() {
    const id = getInput('editDriverId');
    const name = getInput('editDriverName').trim();
    const email = getInput('editDriverEmail').trim();
    const password = getInput('editDriverPassword').trim();
    const phone = getInput('editDriverPhone').trim();
    const license = getInput('editDriverLicense').trim();
    const address = getInput('editDriverAddress').trim();
    const vehicle = {
        make: getInput('editVehicleMake').trim(),
        model: getInput('editVehicleModel').trim(),
        year: getInput('editVehicleYear').trim(),
        color: getInput('editVehicleColor').trim(),
        licensePlate: getInput('editLicensePlate').trim()
    };
    const statusEl = document.getElementById('editDriverStatus');
    const status = statusEl ? statusEl.value : 'active';

    if (!id || !name || !email) {
        showToast('Name and email are required', 'error');
        return;
    }

    const payload = { driverId: id, name, email, password: password || undefined, phone, license, address, vehicle, status };
    const fn = (typeof functions !== 'undefined' ? functions : firebase.app().functions('us-central1')).httpsCallable('updateDriverAccount');
    fn(payload)
        .then(() => {
            showToast('Driver updated successfully!');
            closeEditDriverModal();
            loadDriverData();
        })
        .catch(err => {
            // Fallback: Firestore direct update
            const updateDoc = {
                name, email, phone, license, address, status, vehicle
            };
            db.collection('drivers').doc(id).set(updateDoc, { merge: true })
                .then(() => {
                    showToast('Driver updated (Firestore).');
                    closeEditDriverModal();
                    loadDriverData();
                })
                .catch(e => {
                    showToast('Update failed: ' + (e?.message || e), 'error');
                });
        });
}
