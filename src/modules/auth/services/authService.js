import { ref, get } from "firebase/database";
import { db } from "../../../firebaseConfig";

/**
 * خدمة المصادقة المركزية
 */
export const loginUser = async (username, password) => {
  try {
    const safeKey = username.trim().replace(/\./g, ',');
    
    // 1. التحقق من Super Admin
    const superAdminSnap = await get(ref(db, 'admin_settings/super_admin'));
    const superAdminData = superAdminSnap.val();
    
    if (username === 'superadmin' && password === superAdminData?.password) {
      return { username: 'superadmin', role: 'superadmin', name: 'المدير العام' };
    }

    // 2. البحث في فهرس المستخدمين
    const indexSnap = await get(ref(db, `userIndex/${safeKey}`));
    const indexData = indexSnap.val();

    if (!indexData) return null;

    const { schoolId, role } = indexData;

    // 3. جلب البيانات من المسار المناسب
    let userPath = `schools/${schoolId}/${role}s/${safeKey}`;
    
    if (role === 'school') {
      // إذا كان مديراً فرعياً، نبحث عنه في مجلد المدارس أولاً
      const managerSnap = await get(ref(db, `schools/${schoolId}/managers/${safeKey}`));
      if (managerSnap.exists()) {
        userPath = `schools/${schoolId}/managers/${safeKey}`;
      } else {
        userPath = `users/${safeKey}`;
      }
    }
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
    console.error("Auth Service Error:", error);
    throw error;
  }
};
