import { ref, onValue, update } from 'firebase/database';
import { db } from '../../../firebaseConfig';

export const subscribeToParentStudent = (schoolId, parentUsername, setStudentInfo, setLoading) => {
  const studentsRef = ref(db, `schools/${schoolId}/students`);
  return onValue(studentsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const student = Object.values(data).find(s => s.parentUsername === parentUsername);
      setStudentInfo(student);
    } else {
      setStudentInfo(null);
    }
    setLoading(false);
  });
};

export const updateStudentStatus = async (schoolId, studentId, newStatus) => {
  await update(ref(db, `schools/${schoolId}/students/${studentId}`), { status: newStatus });
};
