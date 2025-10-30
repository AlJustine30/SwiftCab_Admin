// Manage Drivers page bootstrap
document.addEventListener('DOMContentLoaded', function() {
  auth.onAuthStateChanged((user) => {
    const adminDashboard = document.getElementById('adminDashboard');
    const adminName = document.getElementById('adminName');
    if (!user) {
      // Disable Firestore network before redirect to avoid aborted Listen/XHR
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
    // Load drivers, compute statuses, and render table
    if (typeof loadDriverData === 'function') {
      loadDriverData();
    }
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut().then(() => window.location.href = 'index.html'));
});
