import * as Location from 'expo-location';

export const startBackgroundTracking = async (
  taskName
) => {

  const { status } =
    await Location.requestBackgroundPermissionsAsync();

  if (status !== 'granted') {

    throw new Error(
      'يجب السماح بالموقع دائماً'
    );

  }

  await Location.startLocationUpdatesAsync(
    taskName,
    {
      accuracy:
        Location.Accuracy.BestForNavigation,

      timeInterval: 5000,

      distanceInterval: 5,

      foregroundService: {
        notificationTitle:
          'تتبع الباص نشط 🚌',

        notificationBody:
          'يتم مشاركة الموقع مع أولياء الأمور',

        notificationColor: '#3B82F6',
      },
    }
  );

};

export const stopBackgroundTracking = async (
  taskName
) => {

  await Location.stopLocationUpdatesAsync(
    taskName
  );

};