import { ref, onValue, update, push, set } from "firebase/database";
import { db } from '../../../firebaseConfig';

/**
 * خدمة إدارة حضور الطلاب للمرافقة
 */
export const subscribeToStaffStudents = (schoolId, driverId, callback) => {
  const studentsRef = ref(db, `schools/${schoolId}/students`);
  return onValue(studentsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const list = Object.keys(data)
        .map(key => ({ id: key, ...data[key] }))
        .filter(student => {
          const studentDriverId = student.driverUsername || student.driver_id;
          return (!driverId || studentDriverId === driverId) && student.status !== 'absent_today';
        });
      callback(list);
    } else {
      callback([]);
    }
  });
};

export const updateStudentAttendance = async (schoolId, studentId, currentStatus, user) => {
  const newStatus = currentStatus === 'present' ? 'pending' : 'present';
  await update(ref(db, `schools/${schoolId}/students/${studentId}`), { status: newStatus });

  if (newStatus === 'present') {
    const reportRef = ref(db, `schools/${schoolId}/reports`);
    const newReport = push(reportRef);
    await set(newReport, {
      type: 'attendance',
      timestamp: new Date().toISOString(),
      message: `المرافقة ${user.name} قامت بتحضير الطالب في الباص.`,
      studentId: studentId,
      staffId: user.username
    });
  }
};

export const getParentPhone = (schoolId, parentUsername, callback) => {
  const parentRef = ref(db, `schools/${schoolId}/parents/${parentUsername}`);
  onValue(parentRef, (snap) => {
    const parentData = snap.val();
    callback(parentData?.phone);
  }, { onlyOnce: true });
};
