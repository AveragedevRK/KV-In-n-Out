import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDR4ThzxNiJSyB9M08UkWk2FjVQQz6rRxc",
  authDomain: "in-n-out-22a6f.firebaseapp.com",
  projectId: "in-n-out-22a6f",
  storageBucket: "in-n-out-22a6f.firebasestorage.app",
  messagingSenderId: "1074809174528",
  appId: "1:1074809174528:web:dd831fe3b0b6c4e27036e5",
  measurementId: "G-K73ZDKPV8B"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);