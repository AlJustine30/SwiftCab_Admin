// Create Driver page bootstrap
document.addEventListener('DOMContentLoaded', function() {
  auth.onAuthStateChanged((user) => {
    const adminDashboard = document.getElementById('adminDashboard');
    const adminName = document.getElementById('adminName');
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    if (adminDashboard) adminDashboard.style.display = 'flex';
    if (adminName) adminName.textContent = user.email || 'Admin User';
    // drivers.js attaches the Create button listener automatically
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut().then(() => window.location.href = 'index.html'));
});

