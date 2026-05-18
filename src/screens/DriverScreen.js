import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, set, onValue } from "firebase/database";
import { db } from '../firebaseConfig';

export default function DriverScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { schoolId, user } = route.params || {};

  const [currentLoc, setCurrentLoc] = useState({
    latitude: 31.9454,
    longitude: 35.9284
  });
  const [students, setStudents] = useState([]);

  useEffect(() => {
    if (!schoolId) return;

    // جلب طلاب المدرسة فقط باستخدام schoolId
    const studentsRef = ref(db, `schools/${schoolId}/students`);
    const unsubscribeStudents = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setStudents(list);
      } else { setStudents([]); }
    });

    // بث موقع السائق لمدرسته فقط
    let locationSubscription;
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
            updatedAt: new Date().toISOString(),
            driverName: user?.name || 'سائق'
          });
        }
      ).then(sub => locationSubscription = sub);
    });

    return () => {
      unsubscribeStudents();
      if (locationSubscription) locationSubscription.remove();
    };
  }, [schoolId, user]);

  const handleLogout = () => {
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>لوحة السائق 🚌</Text>
      <Text style={styles.driverName}>مرحباً: {user?.name || 'أيها السائق'}</Text>
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
          s.latitude && s.longitude ? (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.latitude, longitude: s.longitude }}
              title={s.name}
              pinColor="orange"
            />
          ) : null
        ))}
      </MapView>

      <TouchableOpacity style={styles.backBtn} onPress={handleLogout}>
        <Text style={styles.btnText}>إنهاء الرحلة وتسجيل الخروج 🔴</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, alignItems: 'center', backgroundColor: '#F5F7FB' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 5, color: '#1E293B' },
  driverName: { fontSize: 16, color: '#334155', marginBottom: 5 },
  subTitle: { fontSize: 13, color: '#10B981', marginBottom: 10, fontWeight: '600' },
  map: { width: Dimensions.get('window').width - 40, height: '65%', borderRadius: 20, overflow: 'hidden' },
  backBtn: { backgroundColor: '#EF4444', padding: 15, borderRadius: 12, width: '100%', alignItems: 'center', marginTop: 20, elevation: 2 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
