// Function to load driver data from Firestore
function loadDriverData() {
    db.collection("drivers").get()
        .then((querySnapshot) => {
            drivers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateDashboardStats();
        })
        .catch((error) => {
            showToast("Error loading drivers: " + error.message, "error");
        });
}

// Function to load driver stats for monitoring
function loadDriverStats() {
    // In a real app, you would fetch this data from Firestore
    let onDutyDrivers = 0;
    for (const driver of drivers) {
        if (driver.status === 'active') onDutyDrivers++;
    }
    const completedRides = Math.floor(Math.random() * 100) + 50; // Mock data
    const activeRides = Math.floor(Math.random() * 20) + 5; // Mock data
    const reportedIssues = Math.floor(Math.random() * 10); // Mock data
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setText('onDutyDrivers', onDutyDrivers);
    setText('completedRides', completedRides);
    setText('activeRides', activeRides);
    setText('reportedIssues', reportedIssues);
}

// Initialize dashboard event listeners
document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('refreshStatsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadDriverStats);
    }
});