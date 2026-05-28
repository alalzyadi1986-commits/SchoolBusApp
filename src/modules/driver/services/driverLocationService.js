import * as Location from 'expo-location';

import {
  updateBusLocation,
} from '../../../services/busService';

export const startLiveLocationTracking = async ({
  schoolId,
  username,
  onLocationChange,
}) => {

  return await Location.watchPositionAsync(

    {
      accuracy:
        Location.Accuracy.BestForNavigation,

      timeInterval: 5000,

      distanceInterval: 5,
    },

    async (location) => {

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      const speed =
        Math.round(
          (location.coords.speed || 0) * 3.6
        );

      await updateBusLocation(
        schoolId,
        username,
        newLocation.latitude,
        newLocation.longitude,
        location.coords.speed || 0
      );

      onLocationChange({
        location: newLocation,
        speed,
      });

    }

  );

};