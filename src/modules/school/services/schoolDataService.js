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
  const path = `schools/${schoolId}/${tab}`;
  const safeUsername = formData.username?.replace(/\./g, ',');
  
  if (editingId) {
    await update(ref(db, `${path}/${editingId}`), formData);
  } else {
    await set(ref(db, `${path}/${safeUsername}`), { ...formData, id: safeUsername });
    const roleMap = { 
      'drivers': 'driver', 
      'staff': 'staff', 
      'parents': 'parent', 
      'students': 'student', 
      'managers': 'manager' 
    };
    await set(ref(db, `userIndex/${safeUsername}`), { 
      schoolId, 
      role: roleMap[tab] || tab 
    });
  }
};

export const deleteSchoolItem = async (schoolId, tab, itemId) => {
  const path = `schools/${schoolId}/${tab}/${itemId}`;
  await remove(ref(db, path));
};
