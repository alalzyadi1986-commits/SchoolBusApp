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
    let userPath;
    let actualRole = role; // الدور الفعلي للمستخدم

    if (role === 'school') {
      // التحقق مما إذا كان المستخدم مديراً فرعياً
      const managerSnap = await get(ref(db, `schools/${schoolId}/managers/${safeKey}`));
      if (managerSnap.exists()) {
        userPath = `schools/${schoolId}/managers/${safeKey}`;
        actualRole = 'subManager'; // تحديد الدور كمدير فرعي
      } else {
        // إذا لم يكن مديراً فرعياً، فهو المدير الرئيسي للمدرسة
        userPath = `users/${safeKey}`;
        actualRole = 'schoolAdmin'; // تحديد الدور كمدير مدرسة رئيسي
      }
    } else {
      // للمستخدمين الآخرين (سائق، ولي أمر، إلخ) باستخدام خريطة مسارات دقيقة
      const rolePaths = {
        driver: 'drivers',
        parent: 'parents',
        staff: 'staff',
        student: 'students'
      };
      const roleFolder = rolePaths[role] || `${role}s`;
      userPath = `schools/${schoolId}/${roleFolder}/${safeKey}`;
    }

    const userSnap = await get(ref(db, userPath));
    const userData = userSnap.val();

    if (userData && userData.password === password) {
      return { ...userData, schoolId, role: actualRole, username: safeKey };
    }

    return null;
  } catch (error) {
    console.error("Auth Service Error:", error);
    throw error;
  }
};
