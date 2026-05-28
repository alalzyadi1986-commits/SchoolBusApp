import React from 'react';

import {
  View,
  Image,
  StyleSheet,
} from 'react-native';

import MapView, {
  Marker,
} from 'react-native-maps';

export default function DriverMap({
  mapRef,
  currentLoc,
}) {

  return (

    <MapView
      ref={mapRef}
      style={styles.map}

      region={{
        latitude:
          currentLoc?.latitude ||
          31.9454,

        longitude:
          currentLoc?.longitude ||
          35.9284,

        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}

      showsUserLocation
      followsUserLocation
      showsMyLocationButton
    >

      {
        currentLoc && (

          <Marker
            coordinate={currentLoc}
            tracksViewChanges={false}
          >

            <View style={styles.busMarker}>

              <Image
                source={{
                  uri:
                    'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
                }}

                style={styles.busImage}
              />

            </View>

          </Marker>

        )
      }

    </MapView>

  );

}

const styles = StyleSheet.create({

  map: {
    height: 260,
    width: '100%',
  },

  busMarker: {
    backgroundColor: '#FFF',
    padding: 6,
    borderRadius: 50,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },

  busImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },

});