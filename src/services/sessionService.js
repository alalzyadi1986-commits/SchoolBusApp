import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveUserSession = async (
  sessionData
) => {

  await AsyncStorage.setItem(
    'user_session',
    JSON.stringify(sessionData)
  );
};

export const getUserSession = async () => {

  const session =
    await AsyncStorage.getItem(
      'user_session'
    );

  return session
    ? JSON.parse(session)
    : null;
};

export const clearUserSession = async () => {

  await AsyncStorage.removeItem(
    'user_session'
  );
};