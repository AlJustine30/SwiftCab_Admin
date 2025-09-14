// Function to handle login
function login() {
    const emailEl = document.getElementById('email');
    const passwordEl = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const loginText = document.getElementById('loginText');
    const loginSpinner = document.getElementById('loginSpinner');
    const loginError = document.getElementById('loginError');
    if (!emailEl || !passwordEl || !loginBtn || !loginText || !loginSpinner || !loginError) return;
    const email = emailEl.value;
    const password = passwordEl.value;
    // Simple validation
    if (!email || !password) {
        loginError.textContent = 'Please enter both email and password';
        loginError.style.display = 'block';
        return;
    }
    // Show loading state
    loginBtn.disabled = true;
    loginText.textContent = 'Logging in...';
    loginSpinner.style.display = 'inline-block';
    loginError.style.display = 'none';
    // Set persistence to session so user is logged out when browser/tab is closed
    auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(() => {
            return auth.signInWithEmailAndPassword(email, password);
        })
        .then((userCredential) => {
            const user = userCredential.user;
            // Fetch user role from Firestore (users collection, doc id = uid)
            return db.collection('users').doc(user.uid).get()
                .then(doc => {
                    if (!doc.exists || doc.data().role !== 'Admin') {
                        // Not an admin, sign out and show error
                        auth.signOut();
                        loginError.textContent = 'Access denied: Only Admins can log in.';
                        loginError.style.display = 'block';
                        loginBtn.disabled = false;
                        loginText.textContent = 'Login to Dashboard';
                        loginSpinner.style.display = 'none';
                        throw new Error('Not an admin');
                    }
                    // Is admin
                    currentUser = user;
                    document.getElementById('loginScreen').style.display = 'none';
                    document.getElementById('adminDashboard').style.display = 'flex';
                    document.getElementById('adminName').textContent = currentUser.email;
                    loadDriverData();
                    loadDriverStats();
                });
        })
        .catch((error) => {
            if (error.message === 'Not an admin') return;
            loginError.textContent = error.message;
            loginError.style.display = 'block';
            loginBtn.disabled = false;
            loginText.textContent = 'Login to Dashboard';
            loginSpinner.style.display = 'none';
        });
}

// Function to handle logout
function logout() {
    auth.signOut().then(() => {
        const loginScreen = document.getElementById('loginScreen');
        const adminDashboard = document.getElementById('adminDashboard');
        const emailEl = document.getElementById('email');
        const passwordEl = document.getElementById('password');
        if (loginScreen) loginScreen.style.display = 'flex';
        if (adminDashboard) adminDashboard.style.display = 'none';
        if (emailEl) emailEl.value = '';
        if (passwordEl) passwordEl.value = '';
        showSection('dashboard');
        currentUser = null;
        drivers = [];
    });
}

// Check auth state on page load
auth.onAuthStateChanged((user) => {
    const loginScreen = document.getElementById('loginScreen');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminName = document.getElementById('adminName');
    if (user) {
        // Check role again on page reload or refresh
        db.collection('users').doc(user.uid).get().then(doc => {
            if (!doc.exists || doc.data().role !== 'Admin') {
                auth.signOut();
                if (loginScreen) loginScreen.style.display = 'flex';
                if (adminDashboard) adminDashboard.style.display = 'none';
                const loginError = document.getElementById('loginError');
                if (loginError) {
                    loginError.textContent = 'Access denied: Only Admins can log in.';
                    loginError.style.display = 'block';
                }
                return;
            }
            currentUser = user;
            if (loginScreen) loginScreen.style.display = 'none';
            if (adminDashboard) adminDashboard.style.display = 'flex';
            if (adminName) adminName.textContent = currentUser.email;
            loadDriverData();
            loadDriverStats();
        });
    } else {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (adminDashboard) adminDashboard.style.display = 'none';
    }
});

// Initialize auth event listeners
document.addEventListener('DOMContentLoaded', function() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const passwordEl = document.getElementById('password');
    // const registerBtn = document.getElementById('registerAdminBtn');
    if (loginBtn) loginBtn.addEventListener('click', login);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    // if (registerBtn) registerBtn.addEventListener('click', registerAdmin);
    if (passwordEl) {
        passwordEl.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') login();
        });
    }
});