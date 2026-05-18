import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, FlatList, Alert, ActivityIndicator, Linking } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, onValue, update, push } from "firebase/database";
import { db } from '../firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function DriverScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { schoolId, user } = route.params || {};

  const [currentLoc, setCurrentLoc] = useState(null);
  const [students, setStudents] = useState([]);
  const [isTripActive, setIsTripActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const locationSubscription = useRef(null);

  useEffect(() => {
    if (!schoolId || !user?.username) return;
    const studentsRef = ref(db, `schools/${schoolId}/students`);
    const unsubscribeStudents = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
          .filter(s => s.driver_id === user.username && s.status !== 'absent_today');
        setStudents(list);
      } else { setStudents([]); }
      setLoading(false);
    });
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        setCurrentLoc(loc.coords);
      }
    })();
    return () => { unsubscribeStudents(); stopTracking(); };
  }, [schoolId, user]);

  const startTrip = async () => {
    if (user?.permissions && !user.permissions.canStartTrip) { Alert.alert('صلاحية مرفوضة', 'ليس لديك صلاحية بدء الرحلة'); return; }
    setIsTripActive(true);
    locationSubscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10 },
      (loc) => {
        setCurrentLoc(loc.coords);
        update(ref(db, `schools/${schoolId}/bus/${user.username}`), {
          latitude: loc.coords.latitude, longitude: loc.coords.longitude,
          updatedAt: new Date().toISOString(), driverName: user.name,
          busNumber: user.bus_number, isActive: true
        });
      }
    );
  };

  const stopTracking = () => {
    if (locationSubscription.current) { locationSubscription.current.remove(); locationSubscription.current = null; }
    if (schoolId && user?.username) { update(ref(db, `schools/${schoolId}/bus/${user.username}`), { isActive: false, updatedAt: new Date().toISOString() }); }
    setIsTripActive(false);
  };

  const sendEmergency = () => {
    Alert.alert('⚠️ تأكيد الطوارئ', 'هل تريد إرسال بلاغ طوارئ فوري لإدارة المدرسة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إرسال', style: 'destructive', onPress: async () => {
        const emergencyRef = ref(db, `schools/${schoolId}/emergencies`);
        await push(emergencyRef, {
          senderName: user.name, senderId: user.username, role: 'driver',
          message: 'حالة طوارئ: السائق يطلب المساعدة الفورية!',
          latitude: currentLoc?.latitude || 0, longitude: currentLoc?.longitude || 0,
          timestamp: new Date().toISOString(), status: 'active'
        });
        Alert.alert('تم الإرسال', 'تم إبلاغ الإدارة بموقعك الحالي.');
      }}
    ]);
  };

  const callParent = async (parentUsername) => {
    const parentRef = ref(db, `schools/${schoolId}/parents/${parentUsername}`);
    onValue(parentRef, (snap) => {
      const p = snap.val();
      if (p?.phone) Linking.openURL(`tel:${p.phone}`);
      else Alert.alert('خطأ', 'رقم ولي الأمر غير متوفر');
    }, { onlyOnce: true });
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => { stopTracking(); navigation.replace('Login'); }}><Text style={styles.logoutText}>خروج</Text></TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.title}>لوحة السائق 🚌</Text>
          <Text style={styles.driverName}>{user?.name} | باص {user?.bus_number}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.emergencyBtn} onPress={sendEmergency}>
          <Text style={styles.emergencyBtnText}>⚠️ طوارئ</Text>
        </TouchableOpacity>
        <View style={styles.statusCard}>
          <View style={[styles.statusIndicator, { backgroundColor: isTripActive ? '#10B981' : '#EF4444' }]} />
          <Text style={styles.statusText}>{isTripActive ? 'الرحلة جارية' : 'متوقفة'}</Text>
          <TouchableOpacity style={[styles.tripBtn, { backgroundColor: isTripActive ? '#EF4444' : '#10B981' }]} onPress={isTripActive ? stopTracking : startTrip}>
            <Text style={styles.tripBtnText}>{isTripActive ? 'إنهاء' : 'بدء'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MapView style={styles.map} showsUserLocation={true} initialRegion={{ latitude: currentLoc?.latitude || 31.9454, longitude: currentLoc?.longitude || 35.9284, latitudeDelta: 0.02, longitudeDelta: 0.02 }}>
        {students.map(s => s.latitude && <Marker key={s.id} coordinate={{ latitude: s.latitude, longitude: s.longitude }} title={s.name} pinColor="orange" />)}
      </MapView>

      <View style={styles.studentListContainer}>
        <Text style={styles.listTitle}>طلاب الرحلة ({students.length})</Text>
        <FlatList data={students} keyExtractor={item => item.id} renderItem={({ item }) => (
          <View style={styles.studentItem}>
            <TouchableOpacity style={styles.callBtn} onPress={() => callParent(item.parent_username)}><Text style={styles.callBtnText}>📞 اتصل</Text></TouchableOpacity>
            <View style={styles.studentInfo}><Text style={styles.studentName}>{item.name}</Text><Text style={styles.studentSub}>{item.class}-{item.section}</Text></View>
          </View>
        )} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  driverName: { fontSize: 13, color: '#64748B' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  actionRow: { flexDirection: 'row', paddingHorizontal: 15, marginTop: 10, alignItems: 'center' },
  emergencyBtn: { backgroundColor: '#EF4444', padding: 12, borderRadius: 12, marginRight: 10, elevation: 3 },
  emergencyBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  statusCard: { flex: 1, padding: 10, backgroundColor: '#FFF', borderRadius: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  statusIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { flex: 1, fontSize: 12, fontWeight: 'bold' },
  tripBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  tripBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
  map: { width: width, height: height * 0.3, marginTop: 10 },
  studentListContainer: { flex: 1, padding: 15 },
  listTitle: { fontSize: 15, fontWeight: 'bold', textAlign: 'right', marginBottom: 10 },
  studentItem: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 1 },
  studentInfo: { alignItems: 'flex-end' },
  studentName: { fontSize: 14, fontWeight: 'bold' },
  studentSub: { fontSize: 11, color: '#64748B' },
  callBtn: { backgroundColor: '#3B82F6', padding: 6, borderRadius: 6 },
  callBtnText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' }
});
