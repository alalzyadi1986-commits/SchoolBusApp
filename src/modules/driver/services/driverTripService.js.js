import { ref, update } from 'firebase/database';
import { db } from '../../../firebaseConfig';

export const startDriverTrip = async (
  schoolId,
  driverUsername
) => {

  try {

    await update(
      ref(
        db,
        `schools/${schoolId}/bus/${driverUsername}`
      ),
      {
        isActive: true,
        startedAt: new Date().toISOString(),
      }
    );

  } catch (error) {

    console.log(
      'Start trip error:',
      error
    );

  }

};

export const stopDriverTrip = async (
  schoolId,
  driverUsername
) => {

  try {

    await update(
      ref(
        db,
        `schools/${schoolId}/bus/${driverUsername}`
      ),
      {
        isActive: false,
        endedAt: new Date().toISOString(),
      }
    );

  } catch (error) {

    console.log(
      'Stop trip error:',
      error
    );

  }

};