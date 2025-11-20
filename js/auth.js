let __adminClaimRequested = false;
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
            // Ensure a user profile exists with Admin role; provision if missing
            const userRef = db.collection('users').doc(user.uid);
            return userRef.get()
                .then(doc => {
                    if (!doc.exists || doc.data().role !== 'Admin') {
                        // Provision Admin role for this signed-in account
                        return userRef.set({
                            role: 'Admin',
                            email: user.email || '',
                            displayName: user.displayName || '',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true }).then(() => ({ becameAdmin: true }));
                    }
                    return { becameAdmin: false };
                })
                .then(async () => {
                    // Proceed to dashboard as Admin
                    currentUser = user;
                    document.getElementById('loginScreen').style.display = 'none';
                    document.getElementById('adminDashboard').style.display = 'flex';
                    document.getElementById('adminName').textContent = currentUser.email;
                    loadDriverData();
                    loadDriverStats();
                    try {
                        const k = 'AIzaSyDrtJTXyKqejETyvnnrP0tYWBbWxO3ZOAY';
                        localStorage.setItem('GMAPS_API_KEY', k);
                        window.GMAPS_API_KEY = k;
                        driverMap = null;
                        initDriverMapIfNeeded();
                        refreshDriverMap();
                        startDriverMapAutoRefresh();
                    } catch (_) {}
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
        // Ensure Admin role exists; provision if missing
        const userRef = db.collection('users').doc(user.uid);
        userRef.get().then(doc => {
            if (!doc.exists || doc.data().role !== 'Admin') {
                return userRef.set({
                    role: 'Admin',
                    email: user.email || '',
                    displayName: user.displayName || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        }).then(async () => {
            if (!__adminClaimRequested) {
                __adminClaimRequested = true;
                try {
                    const promote = (typeof functions !== 'undefined' ? functions : firebase.app().functions('us-central1')).httpsCallable('promoteSelfToAdmin');
                    await promote();
                    await auth.currentUser.getIdToken(true);
                } catch (e) {
                    console.warn('promoteSelfToAdmin failed:', e?.message || e);
                }
            }
            currentUser = user;
            if (loginScreen) loginScreen.style.display = 'none';
            if (adminDashboard) adminDashboard.style.display = 'flex';
            if (adminName) adminName.textContent = currentUser.email;
            loadDriverData();
            loadDriverStats();
            try {
                const k = 'AIzaSyDrtJTXyKqejETyvnnrP0tYWBbWxO3ZOAY';
                localStorage.setItem('GMAPS_API_KEY', k);
                window.GMAPS_API_KEY = k;
                driverMap = null;
                initDriverMapIfNeeded();
                refreshDriverMap();
                startDriverMapAutoRefresh();
            } catch (_) {}
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
