import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA9tStfl2Pbznw8dRIo3Tibn3MEBSDD7c4",
  authDomain: "orm-calificador.firebaseapp.com",
  projectId: "orm-calificador",
  storageBucket: "orm-calificador.firebasestorage.app",
  messagingSenderId: "812663410200",
  appId: "1:812663410200:web:ae0c3c9240a0ff7f54fd6d",
  measurementId: "G-D44NWVHQ59"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
