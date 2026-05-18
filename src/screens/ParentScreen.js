import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, onValue } from "firebase/database";
import { db } from '../firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function ParentScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { schoolId, user } = route.params || {};

  const [busLocation, setBusLocation] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [alertMinutes, setAlertMinutes] = useState(2);
  const [notified, setNotified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState(null);

  useEffect(() => {
    if (!schoolId || !user?.username) return;

    // جلب بيانات الطالب المرتبط بولي الأمر هذا
    const studentsRef = ref(db, `schools/${schoolId}/students`);
    onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const myStudent = Object.values(data).find(s => s.parent_username === user.username);
        if (myStudent) {
          setStudentInfo(myStudent);
          
          // تتبع باص الطالب المحدد فقط
          if (myStudent.driver_id) {
            const busRef = ref(db, `schools/${schoolId}/bus/${myStudent.driver_id}`);
            onValue(busRef, (busSnap) => {
              const busData = busSnap.val();
              if (busData && busData.isActive) {
                setBusLocation({
                  latitude: busData.latitude,
                  longitude: busData.longitude
                });
                
                // حساب المسافة والتنبيه
                if (myLocation) {
                  const dist = calculateDistance(
                    busData.latitude, busData.longitude,
                    myLocation.latitude, myLocation.longitude
                  );
                  // افتراض سرعة الباص 30 كم/س (0.5 كم/دقيقة)
                  if (dist < alertMinutes * 0.5 && !notified) {
                    Alert.alert("تنبيه 🚌", `باص ${myStudent.name} يقترب! سيصل خلال ${alertMinutes} دقائق تقريباً`);
                    setNotified(true);
                  }
                }
              } else {
                setBusLocation(null);
              }
            });
          }
        }
      }
      setLoading(false);
    });

    // جلب موقع ولي الأمر (المنزل)
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        setMyLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        });
      }
    })();
  }, [schoolId, user, myLocation, alertMinutes, notified]);

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

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.title}>تتبع الباص 🚌</Text>
          <Text style={styles.parentName}>عائلة {user?.family_name}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.studentLabel}>الطالب: <Text style={styles.studentValue}>{studentInfo?.name || 'غير مسجل'}</Text></Text>
        <Text style={styles.studentLabel}>الحالة: 
          <Text style={[styles.studentValue, { color: studentInfo?.status === 'present' ? '#10B981' : '#64748B' }]}>
            {studentInfo?.status === 'present' ? ' داخل الباص ✓' : ' لم يصعد بعد'}
          </Text>
        </Text>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>وقت التنبيه المفضل:</Text>
        <View style={styles.optionsRow}>
          {[1, 2, 5, 10].map(m => (
            <TouchableOpacity 
              key={m} 
              style={[styles.optBtn, alertMinutes === m && styles.optBtnActive]}
              onPress={() => { setAlertMinutes(m); setNotified(false); }}
            >
              <Text style={[styles.optText, alertMinutes === m && styles.optTextActive]}>{m} د</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: myLocation?.latitude || 31.9454,
          longitude: myLocation?.longitude || 35.9284,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05
        }}
        showsUserLocation={true}
      >
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
            fillColor="rgba(59, 130, 246, 0.1)"
            strokeColor="#3B82F6"
          />
        )}
      </MapView>

      {!busLocation && (
        <View style={styles.statusOverlay}>
          <Text style={styles.statusText}>⏳ الباص غير متاح حالياً أو الرحلة لم تبدأ</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  parentName: { fontSize: 14, color: '#64748B' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  infoCard: { margin: 15, padding: 15, backgroundColor: '#FFF', borderRadius: 15, elevation: 2 },
  studentLabel: { fontSize: 14, color: '#64748B', textAlign: 'right', marginBottom: 5 },
  studentValue: { fontWeight: 'bold', color: '#1E293B' },
  settingsCard: { marginHorizontal: 15, marginBottom: 15, padding: 15, backgroundColor: '#FFF', borderRadius: 15, elevation: 2 },
  settingsTitle: { fontSize: 13, fontWeight: 'bold', color: '#1E293B', textAlign: 'right', marginBottom: 10 },
  optionsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  optBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10, backgroundColor: '#F1F5F9', minWidth: 60, alignItems: 'center' },
  optBtnActive: { backgroundColor: '#3B82F6' },
  optText: { fontSize: 12, color: '#64748B', fontWeight: 'bold' },
  optTextActive: { color: '#FFF' },
  map: { flex: 1 },
  statusOverlay: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'rgba(255,255,255,0.9)', padding: 15, borderRadius: 12, alignItems: 'center', elevation: 5 },
  statusText: { color: '#EF4444', fontWeight: 'bold', fontSize: 13 }
});
