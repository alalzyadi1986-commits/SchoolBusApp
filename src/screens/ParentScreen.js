import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Alert } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { ref, onValue } from "firebase/database";
import { db } from '../firebaseConfig';

export default function ParentScreen({ onBack, user, schoolId }) {
  const [busLocation, setBusLocation] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [alertMinutes, setAlertMinutes] = useState(2);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    // جلب موقع الأهل
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.getCurrentPositionAsync({}).then(loc => {
        setMyLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        });
      });
    });

    // جلب موقع باص المدرسة فقط باستخدام schoolId
    const busRef = ref(db, `schools/${schoolId}/bus`);
    return onValue(busRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBusLocation({
          latitude: data.latitude,
          longitude: data.longitude
        });

        if (myLocation) {
          const dist = calculateDistance(
            data.latitude, data.longitude,
            myLocation.latitude, myLocation.longitude
          );
          if (dist < alertMinutes * 0.5 && !notified) {
            Alert.alert("تنبيه 🚌", `الباص يقترب! سيصل خلال ${alertMinutes} دقائق تقريباً`);
            setNotified(true);
          }
        }
      }
    });
  }, [schoolId, myLocation, alertMinutes, notified]);

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  const region = myLocation ? {
    ...myLocation,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05
  } : {
    latitude: 31.9454,
    longitude: 35.9284,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>تتبع الباص 🚌</Text>

      <View style={styles.settings}>
        <Text style={styles.settingsLabel}>نبهني قبل وصول الباص بـ:</Text>
        <View style={{ flexDirection: 'row' }}>
          {[1, 2, 5].map(m => (
            <TouchableOpacity
              key={m}
              onPress={() => { setAlertMinutes(m); setNotified(false); }}
              style={[styles.minBtn, alertMinutes === m && styles.minBtnOn]}
            >
              <Text style={[styles.minText, alertMinutes === m && styles.minTextOn]}>
                {m} د
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <MapView style={styles.map} region={region}>
        {myLocation && (
          <Marker coordinate={myLocation} title="منزلي" pinColor="green" />
        )}
        {busLocation && (
          <Marker coordinate={busLocation} title="الباص 🚌" pinColor="blue" />
        )}
        {myLocation && (
          <Circle
            center={myLocation}
            radius={alertMinutes * 500}
            fillColor="rgba(230, 126, 34, 0.2)"
            strokeColor="#e67e22"
          />
        )}
      </MapView>

      {!busLocation && (
        <Text style={styles.nobus}>⏳ في انتظار بث السائق للموقع...</Text>
      )}

      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.btnText}>خروج 🚪</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#2c3e50' },
  settings: { width: '100%', padding: 12, backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, elevation: 2 },
  settingsLabel: { fontSize: 14, color: '#7f8c8d', textAlign: 'right', marginBottom: 8 },
  minBtn: { padding: 8, borderWidth: 1, borderColor: '#e67e22', borderRadius: 5, marginLeft: 8 },
  minBtnOn: { backgroundColor: '#e67e22' },
  minText: { color: '#e67e22', fontWeight: 'bold' },
  minTextOn: { color: '#fff' },
  map: { width: Dimensions.get('window').width - 40, height: '55%', borderRadius: 20 },
  nobus: { fontSize: 13, color: '#e74c3c', marginTop: 8 },
  backBtn: { backgroundColor: '#95a5a6', padding: 15, borderRadius: 10, width: '100%', alignItems: 'center', marginTop: 15 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});