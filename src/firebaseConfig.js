import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// ======================
// تحذير أمان مهم:
// ======================
// هذا الملف يحتوي على apiKey عام (عادي في Expo)
// لكن يجب حماية قاعدة البيانات من خلال Firebase Security Rules

const firebaseConfig = {
  apiKey: "AIzaSyD9oN6vQ0Z8fKz9vL5mX7pR2tY8uV3wX9z", // يمكن أن يكون عام
  authDomain: "schoolbusapp-XXXX.firebaseapp.com",
  databaseURL: "https://schoolbusapp-XXXX-default-rtdb.firebaseio.com",
  projectId: "schoolbusapp-XXXX",
  storageBucket: "schoolbusapp-XXXX.appspot.com",
  messagingSenderId: "XXXXXXXXXXXX",
  appId: "1:XXXXXXXXXXXX:web:XXXXXXXXXXXXXXXX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };

// ======================
// ملاحظات أمان (لك فقط):
// ======================
// 1. غير databaseURL إلى مشروعك الحقيقي
// 2. يجب إعداد Firebase Security Rules لاحقاً
// 3. لا تضع كلمات سر أو بيانات حساسة هنا