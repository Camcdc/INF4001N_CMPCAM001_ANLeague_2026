// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAIV8QLKuYpw3bHBWsw1rUpcy49_AXmU28",
  authDomain: "inf4001-cmpcam001.firebaseapp.com",
  projectId: "inf4001-cmpcam001",
  storageBucket: "inf4001-cmpcam001.firebasestorage.app",
  messagingSenderId: "453308029921",
  appId: "1:453308029921:web:be506cdb2d32c3755090a0",
  measurementId: "G-WMZKK85QKR",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
