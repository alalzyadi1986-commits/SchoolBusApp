import { ref, get } from 'firebase/database';
import { db } from '../firebaseConfig';

export const loginUser = async (
  schoolId,
  username,
  password
) => {

  const usersRef = ref(
    db,
    `schools/${schoolId}/users`
  );

  const snapshot = await get(usersRef);

  if (!snapshot.exists()) {
    throw new Error('School not found');
  }

  const users = snapshot.val();

  const user = Object.values(users).find(
    (u) =>
      u.username === username &&
      u.password === password
  );

  if (!user) {
    throw new Error('Invalid credentials');
  }

  return user;
};