import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { db } from '../../../firebaseConfig';

/**
 * خدمة إدارة بيانات المدرسة (سائقين، طلاب، إلخ)
 */
export const subscribeToSchoolData = (schoolId, path, callback) => {
  const dataRef = ref(db, `schools/${schoolId}/${path}`);
  return onValue(dataRef, (snap) => {
    const data = snap.val();
    const list = data ? Object.keys(data)
      .filter(key => key !== '_init') // تجاهل ملف التهيئة لضمان دقة العد في الباقات
      .map(key => ({ id: key, ...data[key] })) : [];
    callback(list);
  });
};

export const subscribeToSchoolInfo = (schoolId, callback) => {
  const schoolRef = ref(db, `schools/${schoolId}`);
  return onValue(schoolRef, (snap) => {
    callback(snap.val());
  });
};

export const saveSchoolItem = async (schoolId, tab, editingId, formData) => {
  try {
    const path = `schools/${schoolId}/${tab}`;
    const safeUsername = formData.username?.trim().replace(/\./g, ',');
    
    if (editingId) {
      await update(ref(db, `${path}/${editingId}`), formData);
    } else {
    await set(ref(db, `${path}/${safeUsername}`), { ...formData, id: safeUsername });
    const roleMap = { 
      'drivers': 'driver', 
      'staff': 'staff', 
      'parents': 'parent', 
      'students': 'student', 
      'managers': 'subManager' // تحديد الدور كمدير فرعي
    };
    await set(ref(db, `userIndex/${safeUsername}`), { 
      schoolId, 
      role: roleMap[tab] || tab,
      originalRole: tab === 'managers' ? 'subManager' : null // تمييزه كمدير فرعي
    });

    // إضافة بيانات المستخدم في جدول users العام مع ربطه بالمدرسة لضمان الخصوصية
      await set(ref(db, `users/${safeUsername}`), {
        ...formData,
        schoolId,
        role: roleMap[tab] || tab,
        id: safeUsername
      });
    }
  } catch (error) {
    console.error("Save School Item Error:", error);
    throw error;
  }
};

export const deleteSchoolItem = async (schoolId, tab, itemId) => {
  // حذف من مسار المدرسة
  const path = `schools/${schoolId}/${tab}/${itemId}`;
  await remove(ref(db, path));

  // حذف من الفهارس العامة لضمان عدم بقاء بيانات معلقة
  const safeUsername = itemId; // itemId هو الـ username المعدل
  await remove(ref(db, `userIndex/${safeUsername}`));
  await remove(ref(db, `users/${safeUsername}`));
};
