import { ref, get } from 'firebase/database';
import { db } from '../firebaseConfig';

/**
 * تسجيل الدخول باستخدام اسم المستخدم وكلمة المرور فقط
 * يقوم بالبحث في userIndex لمعرفة المدرسة والدور، ثم يتحقق من البيانات
 */
export const loginUser = async (username, password) => {
  try {
    // 1. البحث في الفهرس العام للمستخدمين لمعرفة المدرسة والدور
    const safeKey = username.replace(/\./g, ',');
    const indexRef = ref(db, `userIndex/${safeKey}`);
    const indexSnap = await get(indexRef);

    if (!indexSnap.exists()) {
      // تحقق مما إذا كان المستخدم هو Super Admin
      const superAdminRef = ref(db, 'admin_settings/super_admin');
      const superSnap = await get(superAdminRef);
      const superData = superSnap.val();

      if (username === 'admin' && password === superData?.password) {
        return {
          username: 'admin',
          name: 'مدير النظام',
          role: 'superadmin'
        };
      }
      throw new Error('User not found');
    }

    const { schoolId, role } = indexSnap.val();

    // 2. جلب بيانات المستخدم من فرع المدرسة الصحيح
    let userPath = `schools/${schoolId}/${role}s/${safeKey}`;
    
    // تصحيح المسارات لبعض الأدوار
    if (role === 'school') {
      userPath = `users/${safeKey}`;
    }

    const userRef = ref(db, userPath);
    const userSnap = await get(userRef);

    if (!userSnap.exists()) {
      throw new Error('User data not found');
    }

    const userData = userSnap.val();

    // 3. التحقق من كلمة المرور
    if (userData.password !== password) {
      throw new Error('Invalid credentials');
    }

    // إرجاع البيانات مع الـ schoolId لضمان وصوله للشاشات التالية
    return {
      ...userData,
      schoolId,
      role,
      username // التأكد من وجود اسم المستخدم
    };

  } catch (error) {
    console.error('Auth Service Error:', error);
    throw error;
  }
};
