// Global variables
let currentUser = null;
let drivers = [];

// Function to show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Function to show different sections
function showSection(sectionName) {
    // Map section names to their DOM IDs and titles
    const sectionMap = {
        dashboard: {
            section: 'dashboardSection',
            nav: 'dashboard',
            title: 'Admin Dashboard',
            callback: typeof loadDriverStats === 'function' ? loadDriverStats : null
        },
        createDriver: {
            section: 'createDriverSection',
            nav: 'createDriver',
            title: 'Create Driver Account',
            callback: null
        },
        manageDrivers: {
            section: 'manageDriversSection',
            nav: 'manageDrivers',
            title: 'Manage Drivers',
            callback: typeof loadDriversTable === 'function' ? loadDriversTable : null
        }
    };

    // Hide all sections
    Object.values(sectionMap).forEach(({ section }) => {
        const el = document.getElementById(section);
        if (el) el.style.display = 'none';
    });

    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    // Show the requested section and set active nav item
    const config = sectionMap[sectionName];
    if (config) {
        const sectionEl = document.getElementById(config.section);
        if (sectionEl) sectionEl.style.display = 'block';
        const navEl = document.querySelector(`.nav-item[data-section="${config.nav}"]`);
        if (navEl) navEl.classList.add('active');
        const titleEl = document.getElementById('sectionTitle');
        if (titleEl) titleEl.textContent = config.title;
        if (config.callback) config.callback();
    }
}

// Function to update dashboard statistics
function updateDashboardStats() {
    const totalDrivers = drivers.length;
    let activeDrivers = 0, pendingDrivers = 0;
    for (const driver of drivers) {
        const rs = driver.runtimeStatus;
        // Treat Online or Booked as "active" on duty
        if (rs === 'online' || rs === 'booked') activeDrivers++;
        else if (!rs && driver.status === 'active') activeDrivers++;
        if (driver.status === 'pending') pendingDrivers++;
    }
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setText('totalDrivers', totalDrivers);
    setText('activeDrivers', activeDrivers);
    setText('pendingDrivers', pendingDrivers);
    updateRecentActivities();
}

// Function to update recent activities
function updateRecentActivities() {
    const activitiesContainer = document.getElementById('recentActivities');
    if (!activitiesContainer) return;
    activitiesContainer.innerHTML = '';
    // Show only active drivers (online or booked)
    const recentDrivers = drivers.filter(d => (d.runtimeStatus === 'online' || d.runtimeStatus === 'booked')).slice(0, 5);
    const now = new Date();
    for (const driver of recentDrivers) {
        const row = document.createElement('tr');
        const rs = driver.runtimeStatus;
        let activity =
            rs === 'booked' ? 'On a ride' :
            rs === 'online' ? 'Online now' :
            driver.status === 'pending' ? 'New driver application' :
            'Offline';
        // Use createdAt if available, else fallback to now
        let time = now.toLocaleTimeString();
        if (driver.createdAt && driver.createdAt.toDate) {
            time = driver.createdAt.toDate().toLocaleTimeString();
        }
        const statusText = rs ? (rs === 'booked' ? 'Booked' : rs === 'online' ? 'Online' : 'Offline') : driver.status;
        const statusClass = rs ? (rs === 'booked' ? 'status-booked' : rs === 'online' ? 'status-active' : 'status-inactive') : `status-${driver.status}`;
        row.innerHTML = `
            <td>${driver.name}</td>
            <td>${activity}</td>
            <td>${time}</td>
            <td><span class="status ${statusClass}">${statusText}</span></td>
            <td>
                <button class="action-btn btn-view" data-driver-id="${driver.id}">View Location</button>
            </td>
        `;
        activitiesContainer.appendChild(row);
    }
    // Attach click handlers to View Location buttons
    activitiesContainer.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-driver-id');
            if (typeof focusDriverOnMap === 'function') {
                focusDriverOnMap(id);
            } else {
                showToast('Map not ready yet. Please try again.', 'error');
            }
        });
    });
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Navigation event delegation for better performance
    document.querySelector('.sidebar').addEventListener('click', function(e) {
        const navItem = e.target.closest('.nav-item');
        if (navItem && navItem.id !== 'logoutBtn' && navItem.hasAttribute('data-section')) {
            showSection(navItem.getAttribute('data-section'));
        }
    });
});
