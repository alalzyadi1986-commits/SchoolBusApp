import {
  ref,
  onValue,
} from 'firebase/database';

import { db } from '../../../firebaseConfig';

export const subscribeToSchoolLocation = (
  schoolId,
  onLocationFound
) => {

  const schoolRef = ref(
    db,
    `schools/${schoolId}`
  );

  return onValue(

    schoolRef,

    (snapshot) => {

      const data = snapshot.val();

      if (

        data?.latitude &&
        data?.longitude

      ) {

        onLocationFound({

          latitude: parseFloat(
            data.latitude
          ),

          longitude: parseFloat(
            data.longitude
          ),

        });

      }

    },

    (error) => {

      console.log(
        'School service error:',
        error
      );

    }

  );

};