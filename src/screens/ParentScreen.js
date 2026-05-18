import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Alert } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, onValue } from "firebase/database";
import { db } from '../firebaseConfig';

export default function ParentScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { schoolId, user } = route.params || {};

  const [busLocation, setBusLocation] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [alertMinutes, setAlertMinutes] = useState(2);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    if (!schoolId) return;

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
    const unsubscribeBus = onValue(busRef, (snapshot) => {
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
          // 0.5 كم لكل دقيقة تقريباً
          if (dist < alertMinutes * 0.5 && !notified) {
            Alert.alert("تنبيه 🚌", `الباص يقترب! سيصل خلال ${alertMinutes} دقائق تقريباً`);
            setNotified(true);
          }
        }
      }
    });

    return () => unsubscribeBus();
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

  const handleLogout = () => {
    navigation.replace('Login');
  };

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
      <Text style={styles.parentName}>ولي الأمر: {user?.family_name || user?.username}</Text>

      <View style={styles.settings}>
        <Text style={styles.settingsLabel}>نبهني قبل وصول الباص بـ:</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
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
            fillColor="rgba(59, 130, 246, 0.2)"
            strokeColor="#3B82F6"
          />
        )}
      </MapView>

      {!busLocation && (
        <Text style={styles.nobus}>⏳ في انتظار بث السائق للموقع...</Text>
      )}

      <TouchableOpacity style={styles.backBtn} onPress={handleLogout}>
        <Text style={styles.btnText}>تسجيل الخروج 🚪</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, alignItems: 'center', backgroundColor: '#F5F7FB' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 5, color: '#1E293B' },
  parentName: { fontSize: 16, color: '#334155', marginBottom: 15 },
  settings: { width: '100%', padding: 15, backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, elevation: 2 },
  settingsLabel: { fontSize: 14, color: '#64748B', textAlign: 'right', marginBottom: 10, fontWeight: '600' },
  minBtn: { padding: 10, borderWidth: 1.5, borderColor: '#3B82F6', borderRadius: 8, marginLeft: 10, minWidth: 50, alignItems: 'center' },
  minBtnOn: { backgroundColor: '#3B82F6' },
  minText: { color: '#3B82F6', fontWeight: 'bold' },
  minTextOn: { color: '#fff' },
  map: { width: Dimensions.get('window').width - 40, height: '50%', borderRadius: 20, overflow: 'hidden' },
  nobus: { fontSize: 14, color: '#EF4444', marginTop: 10, fontWeight: '600' },
  backBtn: { backgroundColor: '#64748B', padding: 15, borderRadius: 12, width: '100%', alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
