import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDdhs4ACBNXnevRYULA5M8J9I73LFAqsik",
  authDomain: "schoolbustracker0.firebaseapp.com",
  databaseURL: "https://schoolbustracker0-default-rtdb.firebaseio.com",
  projectId: "schoolbustracker0",
  storageBucket: "schoolbustracker0.firebasestorage.app",
  messagingSenderId: "1074397478833",
  appId: "1:1074397478833:web:b267c23f1d56aa72b54790"
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const storage = getStorage(app);
