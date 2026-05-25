import { ref, update } from 'firebase/database';
import { db } from '../firebaseConfig';

export const updateBusLocation = async (
  schoolId,
  username,
  latitude,
  longitude,
  speed = 0
) => {

  await update(
    ref(
      db,
      `schools/${schoolId}/bus/${username}`
    ),
    {
      latitude,
      longitude,
      speed,
      updatedAt: new Date().toISOString(),
      isActive: true,
    }
  );
};