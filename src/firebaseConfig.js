import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// ======================
// تحذير أمان مهم:
// ======================
// هذا الملف يحتوي على apiKey عام (عادي في Expo)
// لكن يجب حماية قاعدة البيانات من خلال Firebase Security Rules

const firebaseConfig = {
  apiKey: "AIzaSyDdhs4ACBNXnevRYULA5M8J9I73LFAqsik",
  authDomain: "schoolbustracker0.firebaseapp.com",
  databaseURL: "https://schoolbustracker0-default-rtdb.firebaseio.com",
  projectId: "schoolbustracker0",
  storageBucket: "schoolbustracker0.firebasestorage.app",
  messagingSenderId: "1074397478833",
  appId: "1:1074397478833:web:b267c23f1d56aa72b54790"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };

// ======================
// ملاحظات أمان (لك فقط):
// ======================
// 1. تم تحديث الإعدادات لتتوافق مع قاعدة البيانات الحقيقية
// 2. يجب إعداد Firebase Security Rules لاحقاً
// 3. لا تضع كلمات سر أو بيانات حساسة هنا
