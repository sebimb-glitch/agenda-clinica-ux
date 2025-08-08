import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firestore debe tener reglas públicas si no querés login:
// rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }
const firebaseConfig = {
  apiKey: "AIzaSyBjBiFKjZU04oocDXiNPFmBIn1HD4Ku4c4",
  authDomain: "agenda-consultorio-3db0e.firebaseapp.com",
  projectId: "agenda-consultorio-3db0e",
  storageBucket: "agenda-consultorio-3db0e.firebasestorage.app",
  messagingSenderId: "62698126409",
  appId: "1:62698126409:web:d7746dade44c18d8a31398"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);