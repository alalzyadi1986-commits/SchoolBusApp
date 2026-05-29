import React from 'react';

import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

import MapView, {
  Marker,
} from 'react-native-maps';

export default function ParentMap({

  myLocation,

  schoolLoc,

  animatedBusLocation,

}) {

  return (

    <View style={styles.container}>

      <MapView
        style={styles.map}

        initialRegion={{
          latitude:
            myLocation?.latitude ||
            31.9454,

          longitude:
            myLocation?.longitude ||
            35.9284,

          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >

        {
          myLocation && (

            <Marker
              coordinate={myLocation}
              title="منزلي"
              pinColor="green"
            />

          )
        }

        {
          schoolLoc && (

            <Marker
              coordinate={schoolLoc}
              title="المدرسة"
              pinColor="red"
            />

          )
        }

        {
          animatedBusLocation && (

            <Marker
              coordinate={animatedBusLocation}
              title="الباص"
            >

              <View style={styles.busMarker}>

                <Text style={styles.busEmoji}>
                  🚌
                </Text>

              </View>

            </Marker>

          )
        }

      </MapView>

    </View>

  );

}

const styles = StyleSheet.create({

  container: {
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
  },

  map: {
    height: 350,
    width: '100%',
  },

  busMarker: {
    backgroundColor: '#FFF',
    padding: 5,
    borderRadius: 20,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },

  busEmoji: {
    fontSize: 24,
  },

});