import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBv8kZmn_8AYKcHWA9Yi5bjZwsgPABjqCQ",
  authDomain: "my-link-place.firebaseapp.com",
  projectId: "my-link-place",
  storageBucket: "my-link-place.firebasestorage.app",
  messagingSenderId: "198110768967",
  appId: "1:198110768967:web:e26f7c592da91f5d706662"
};

// Initialize Firebase (Singleton pattern to prevent re-initialization in Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Optional: Force account selection every time (good for testing)
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export { app, auth, googleProvider };
