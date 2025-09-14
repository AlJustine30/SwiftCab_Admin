// Function to create a new driver
function createDriver() {
    const name = document.getElementById('driverName').value;
    const email = document.getElementById('driverEmail').value;
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
    
    // Create driver object
    const driver = {
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
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Add driver to Firestore
    db.collection("drivers").add(driver)
        .then((docRef) => {
            showToast('Driver created successfully!');
            
            // Clear form
            document.getElementById('driverName').value = '';
            document.getElementById('driverEmail').value = '';
            document.getElementById('driverPhone').value = '';
            document.getElementById('driverLicense').value = '';
            document.getElementById('driverAddress').value = '';
            document.getElementById('vehicleMake').value = '';
            document.getElementById('vehicleModel').value = '';
            document.getElementById('vehicleYear').value = '';
            document.getElementById('vehicleColor').value = '';
            document.getElementById('licensePlate').value = '';
            
            // Refresh driver data
            loadDriverData();
        })
        .catch((error) => {
            showToast('Error creating driver: ' + error.message, 'error');
        });
}

// Function to load drivers table
function loadDriversTable() {
    const driversList = document.getElementById('driversList');
    if (!driversList) return;
    driversList.innerHTML = drivers.map(driver => {
        const imgNum = Math.floor(Math.random() * 50) + 1;
        return `
            <tr data-id="${driver.id}">
                <td>
                    <div style="display: flex; align-items: center;">
                        <img src="https://randomuser.me/api/portraits/men/${imgNum}.jpg" alt="Driver" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 0.75rem;">
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
                <td><span class="status status-${driver.status}">${driver.status}</span></td>
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
        const imgNum = Math.floor(Math.random() * 50) + 1;
        return `
            <tr data-id="${driver.id}">
                <td>
                    <div style="display: flex; align-items: center;">
                        <img src="https://randomuser.me/api/portraits/men/${imgNum}.jpg" alt="Driver" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 0.75rem;">
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
                <td><span class="status status-${driver.status}">${driver.status}</span></td>
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
        alert(`Driver Details:\nName: ${driver.name}\nEmail: ${driver.email}\nPhone: ${driver.phone}\nStatus: ${driver.status}`);
    } else if (action === 'edit') {
        const newStatus = prompt('Enter new status (active, inactive, pending):', driver.status);
        if (newStatus && ['active', 'inactive', 'pending'].includes(newStatus)) {
            db.collection("drivers").doc(driverId).update({
                status: newStatus
            })
            .then(() => {
                showToast('Driver updated successfully!');
                loadDriverData();
            })
            .catch((error) => {
                showToast('Error updating driver: ' + error.message, 'error');
            });
        }
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
document.addEventListener('DOMContentLoaded', function() {
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
    // Event delegation for driver actions
    const driversList = document.getElementById('driversList');
    if (driversList) {
        driversList.addEventListener('click', handleDriverAction);
    }
});