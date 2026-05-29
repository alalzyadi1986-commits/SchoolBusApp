import {
  ref,
  onValue,
} from 'firebase/database';

import { db } from '../../firebaseConfig';

export const subscribeToParentStudent = (

  schoolId,

  parentUsername,

  onStudentFound,

  onFinish,

) => {

  const studentsRef = ref(
    db,
    `schools/${schoolId}/students`
  );

  return onValue(

    studentsRef,

    (snapshot) => {

      const data = snapshot.val();

      if (!data) {

        onStudentFound(null);

        onFinish?.();

        return;

      }

      const studentKey =
        Object.keys(data).find(

          (key) =>

            data[key]
              .parentUsername ===
              parentUsername ||

            data[key]
              .parent_username ===
              parentUsername
        );

      if (studentKey) {

        onStudentFound({
          id: studentKey,
          ...data[studentKey],
        });

      } else {

        onStudentFound(null);

      }

      onFinish?.();

    },

    (error) => {

      console.log(
        'Student service error:',
        error
      );

      onFinish?.();

    }
  );

};