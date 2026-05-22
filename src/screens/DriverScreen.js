import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { ref, set, onValue } from "firebase/database";
import { db } from '../firebaseConfig';

export default function DriverScreen({ onBack, user, schoolId }) {
  const [currentLoc, setCurrentLoc] = useState({
    latitude: 31.9454,
    longitude: 35.9284
  });
  const [students, setStudents] = useState([]);

  useEffect(() => {
    // جلب طلاب المدرسة فقط باستخدام schoolId
    const studentsRef = ref(db, `schools/${schoolId}/students`);
    onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setStudents(list);
      } else { setStudents([]); }
    });

    // بث موقع السائق لمدرسته فقط
    let sub;
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => {
          setCurrentLoc(loc.coords);
          // حفظ موقع الباص تحت مدرسته فقط
          set(ref(db, `schools/${schoolId}/bus`), {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            updatedAt: new Date().toISOString()
          });
        }
      ).then(s => sub = s);
    });

    return () => sub && sub.remove();
  }, [schoolId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>لوحة السائق 🚌</Text>
      <Text style={styles.subTitle}>جاري بث موقعك لأهل الطلاب...</Text>

      <MapView
        style={styles.map}
        initialRegion={{
          ...currentLoc,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05
        }}
        showsUserLocation={true}
      >
        {students.map(s => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.latitude, longitude: s.longitude }}
            title={s.name}
            pinColor="orange"
          />
        ))}
      </MapView>

      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.btnText}>إنهاء الرحلة 🔴</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 5, color: '#2c3e50' },
  subTitle: { fontSize: 13, color: '#27ae60', marginBottom: 10 },
  map: { width: Dimensions.get('window').width - 40, height: '70%', borderRadius: 20 },
  backBtn: { backgroundColor: '#e74c3c', padding: 15, borderRadius: 10, width: '100%', alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});