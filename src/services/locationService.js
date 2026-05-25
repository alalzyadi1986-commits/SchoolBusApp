import * as Location from 'expo-location';

export const requestLocationPermission = async () => {
  const { status } =
    await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    throw new Error('Permission denied');
  }

  return true;
};

export const getCurrentLocation = async () => {
  const location =
    await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

  return location.coords;
};