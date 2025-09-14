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
            callback: null
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
        },
        monitorDrivers: {
            section: 'monitorDriversSection',
            nav: 'monitorDrivers',
            title: 'Monitor Drivers',
            callback: typeof loadDriverStats === 'function' ? loadDriverStats : null
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
        if (driver.status === 'active') activeDrivers++;
        else if (driver.status === 'pending') pendingDrivers++;
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
    // Get recent drivers (last 5, most recent first)
    const recentDrivers = drivers.slice(0, 5);
    const now = new Date();
    for (const driver of recentDrivers) {
        const row = document.createElement('tr');
        let activity =
            driver.status === 'active' ? 'Started shift' :
            driver.status === 'pending' ? 'New driver application' :
            'Account created';
        // Use createdAt if available, else fallback to now
        let time = now.toLocaleTimeString();
        if (driver.createdAt && driver.createdAt.toDate) {
            time = driver.createdAt.toDate().toLocaleTimeString();
        }
        row.innerHTML = `
            <td>${driver.name}</td>
            <td>${activity}</td>
            <td>${time}</td>
            <td><span class="status status-${driver.status}">${driver.status}</span></td>
            <td>
                <button class="action-btn btn-view">View</button>
                <button class="action-btn btn-edit">Edit</button>
            </td>
        `;
        activitiesContainer.appendChild(row);
    }
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