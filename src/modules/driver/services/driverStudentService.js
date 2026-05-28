import {
  ref,
  onValue,
} from 'firebase/database';

import { db } from '../../../firebaseConfig';

export const subscribeToDriverStudents = (
  schoolId,
  driverUsername,
  callback
) => {

  try {

    const studentsRef = ref(
      db,
      `schools/${schoolId}/students`
    );

    onValue(studentsRef, snapshot => {

      const data = snapshot.val();

      if (!data) {

        callback([]);

        return;

      }

      const studentsList =
        Object.keys(data)

          .map(key => ({
            id: key,
            ...data[key],
          }))

          .filter(
            student =>
              student.driverUsername ===
              driverUsername
          );

      callback(studentsList);

    });

  } catch (error) {

    console.log(
      'Driver students error:',
      error
    );

    callback([]);

  }

};