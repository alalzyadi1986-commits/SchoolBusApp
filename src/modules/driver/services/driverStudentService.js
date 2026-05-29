import { ref, onValue } from 'firebase/database';
import { db } from '../../../firebaseConfig';

export const subscribeToDriverStudents = (schoolId, driverUsername, callback) => {
  const studentsRef = ref(db, `schools/${schoolId}/students`);
  return onValue(studentsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const studentsList = Object.keys(data)
        .map(key => ({ id: key, ...data[key] }))
        .filter(student => student.driverUsername === driverUsername);
      callback(studentsList);
    } else {
      callback([]);
    }
  });
};
