import * as Location from 'expo-location';
import { updateBusLocation } from '../../../services/busService';

export const startLiveLocationTracking = async ({ schoolId, username, onLocationChange }) => {
  // Permissions should be requested once before starting the watch
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission not granted');
  }

  return await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 10000, // تحديث كل 10 ثوانٍ
      distanceInterval: 10, // أو كل 10 أمتار
    },
    (location) => {
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      const speed = Math.round(location.coords.speed * 3.6) || 0; // تحويل من م/ث إلى كم/س
      onLocationChange({ location: newLocation, speed });
      // تمرير latitude, longitude, speed كمعاملات منفصلة
      updateBusLocation(schoolId, username, newLocation.latitude, newLocation.longitude, speed);
    }
  );
};
