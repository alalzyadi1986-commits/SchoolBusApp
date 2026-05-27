import { ref, get } from "firebase/database";
import { db } from "../firebaseConfig";

/**
 * تسجيل الدخول الذكي عبر البحث في userIndex
 * @param {string} username اسم المستخدم
 * @param {string} password كلمة المرور
 */
export const loginUser = async (username, password) => {
  try {
    const safeKey = username.trim().replace(/\./g, ',');
    
    // 1. التحقق من Super Admin أولاً
    const superAdminSnap = await get(ref(db, 'admin_settings/super_admin'));
    const superAdminData = superAdminSnap.val();
    
    if (username === 'superadmin' && password === superAdminData?.password) {
      return { username: 'superadmin', role: 'superadmin', name: 'المدير العام' };
    }

    // 2. البحث عن المستخدم في userIndex لمعرفة المدرسة والدور
    const indexSnap = await get(ref(db, `userIndex/${safeKey}`));
    const indexData = indexSnap.val();

    if (!indexData) {
      console.log("User not found in index");
      return null;
    }

    const { schoolId, role } = indexData;

    // 3. جلب بيانات المستخدم الكاملة من مسار المدرسة الصحيح
    // ملاحظة: قمت بتصحيح المسارات لضمان التوافق (مثلاً staff بدلاً من staffs)
    let userPath = `schools/${schoolId}/${role}s/${safeKey}`;
    
    if (role === 'school') userPath = `users/${safeKey}`;
    else if (role === 'staff') userPath = `schools/${schoolId}/staff/${safeKey}`;
    else if (role === 'driver') userPath = `schools/${schoolId}/drivers/${safeKey}`;
    else if (role === 'parent') userPath = `schools/${schoolId}/parents/${safeKey}`;
    else if (role === 'student') userPath = `schools/${schoolId}/students/${safeKey}`;
    else if (role === 'manager') userPath = `schools/${schoolId}/managers/${safeKey}`;

    const userSnap = await get(ref(db, userPath));
    const userData = userSnap.val();

    if (userData && userData.password === password) {
      return { ...userData, schoolId, role, username: safeKey };
    }

    return null;
  } catch (error) {
    console.error("Login service error:", error);
    throw error;
  }
};
