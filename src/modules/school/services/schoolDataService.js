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

export const updateSchoolLocation = async (schoolId, locationData) => {
  try {
    const schoolRef = ref(db, `schools/${schoolId}`);
    await update(schoolRef, {
      location: locationData,
      // توحيد: كتابة الإحداثيات في الجذر أيضاً لضمان توافق القراءة في شاشات ولي الأمر والخدمات الأخرى
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      locationUpdatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Update School Location Error:", error);
    throw error;
  }
};

export const saveSchoolItem = async (schoolId, tab, editingId, formData) => {
  try {
    // التعامل مع طلبات الحذف (عندما تكون formData فارغة)
    if (formData === null && editingId) {
      await remove(ref(db, `schools/${schoolId}/${tab}/${editingId}`));
      return;
    }

    // التعامل مع الحالات الخاصة (روابط التواصل أو معلومات المدرسة)
    if (tab === 'info' && editingId) {
      const dbRef = ref(db, `schools/${schoolId}/${editingId}`);
      // استخدام set بدلاً من update لضمان الكتابة الكاملة وتجنب مشاكل المفاتيح غير المعرفة في الروابط الاجتماعية
      await set(dbRef, formData);
      return;
    }

    // التعامل مع الرسائل والردود
    if (tab === 'admin_messages' || tab === 'admin_replies') {
      const path = tab === 'admin_messages' ? `schools/${schoolId}/admin_messages` : `admin_inbox/${schoolId}`;
      const dbRef = editingId ? ref(db, `${path}/${editingId}`) : push(ref(db, path));
      const finalData = editingId ? formData : { ...formData, id: dbRef.key };
      await set(dbRef, finalData);
      return;
    }

    const path = `schools/${schoolId}/${tab}`;
    
    if (editingId) {
      // تصحيح: استخدام update لضمان عدم حذف الحقول غير المرسلة
      await update(ref(db, `${path}/${editingId}`), formData);
    } else {
      const safeUsername = formData.username?.trim().replace(/\./g, ',');
      if (!safeUsername) throw new Error("Username is required");

      await set(ref(db, `${path}/${safeUsername}`), { ...formData, id: safeUsername });
      const roleMap = { 
        'drivers': 'driver', 
        'staff': 'staff', 
        'parents': 'parent', 
        'students': 'student', 
        'managers': 'subManager' 
      };
      
      await set(ref(db, `userIndex/${safeUsername}`), { 
        schoolId, 
        role: tab === 'managers' ? 'school' : (roleMap[tab] || tab),
        originalRole: tab === 'managers' ? 'subManager' : null
      });

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
