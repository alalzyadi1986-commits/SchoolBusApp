<<<<<<< HEAD
=======
<<<<<<< HEAD
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
=======
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// ======================
// تحذير أمان مهم:
// ======================
// هذا الملف يحتوي على apiKey عام (عادي في Expo)
// لكن يجب حماية قاعدة البيانات من خلال Firebase Security Rules
<<<<<<< HEAD
=======
>>>>>>> 26cefefa39de4b8031862128921805f50f269406
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c

const firebaseConfig = {
  apiKey: "AIzaSyDdhs4ACBNXnevRYULA5M8J9I73LFAqsik",
  authDomain: "schoolbustracker0.firebaseapp.com",
<<<<<<< HEAD
  databaseURL: "https://schoolbustracker0-default-rtdb.firebaseio.com",
=======
<<<<<<< HEAD
=======
  databaseURL: "https://schoolbustracker0-default-rtdb.firebaseio.com",
>>>>>>> 26cefefa39de4b8031862128921805f50f269406
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
  projectId: "schoolbustracker0",
  storageBucket: "schoolbustracker0.firebasestorage.app",
  messagingSenderId: "1074397478833",
  appId: "1:1074397478833:web:b267c23f1d56aa72b54790"
};

<<<<<<< HEAD
=======
<<<<<<< HEAD
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// إعداد المصادقة مع خاصية حفظ الجلسة في ذاكرة الهاتف
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
=======
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
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
<<<<<<< HEAD
=======
>>>>>>> 26cefefa39de4b8031862128921805f50f269406
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
