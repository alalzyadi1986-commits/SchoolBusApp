import * as Location from 'expo-location';

export const requestParentLocation =
  async () => {

    try {

      const { status } =
        await Location
          .requestForegroundPermissionsAsync();

      if (status !== 'granted') {

        return null;

      }

      const location =
        await Location
          .getCurrentPositionAsync({});

      return {

        latitude:
          location.coords.latitude,

        longitude:
          location.coords.longitude,

      };

    } catch (error) {

      console.log(
        'Location service error:',
        error
      );

      return null;

    }

  };