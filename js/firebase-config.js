// Firebase configuration - Replace with your actual config
const firebaseConfig = {
    apiKey: "AIzaSyA0bStOPbb1Y2zVtKQwGv-cOpavtKAwE5g",
    authDomain: "swiftcab-de564.firebaseapp.com",
    projectId: "swiftcab-de564",
    storageBucket: "swiftcab-de564.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:323933258887:android:5b1d43382d1e483661a422"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.firestore();
const rtdb = firebase.database();
// Use explicit region for Callable Functions
const functions = firebase.app().functions('us-central1');

// Gracefully close Firestore connections when the page is being unloaded
// to avoid aborted long‑poll/XHR warnings in the console.
let __networkDisabled = false;
window.addEventListener('pagehide', () => {
  try {
    if (!__networkDisabled) {
      __networkDisabled = true;
      db.disableNetwork().catch(() => {});
    }
  } catch (e) {}
});
window.addEventListener('unload', () => {
  try {
    if (!__networkDisabled) {
      __networkDisabled = true;
      db.disableNetwork().catch(() => {});
    }
  } catch (e) {}
});
