import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, FlatList, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, onValue, update } from "firebase/database";
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
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(s => s.driver_id === user.username);
        setStudents(list);
      } else {
        setStudents([]);
      }
      setLoading(false);
    });

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('خطأ', 'يجب السماح بالوصول للموقع لبث التتبع');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setCurrentLoc(loc.coords);
    })();

    return () => {
      unsubscribeStudents();
      stopTracking();
    };
  }, [schoolId, user]);

  const startTrip = async () => {
    if (user?.permissions && !user.permissions.canStartTrip) {
      Alert.alert('صلاحية مرفوضة', 'ليس لديك صلاحية بدء الرحلة. يرجى مراجعة إدارة المدرسة.');
      return;
    }

    setIsTripActive(true);
    locationSubscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10 },
      (loc) => {
        setCurrentLoc(loc.coords);
        update(ref(db, `schools/${schoolId}/bus/${user.username}`), {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          updatedAt: new Date().toISOString(),
          driverName: user.name,
          busNumber: user.bus_number,
          isActive: true
        });
      }
    );
  };

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (schoolId && user?.username) {
      update(ref(db, `schools/${schoolId}/bus/${user.username}`), {
        isActive: false,
        updatedAt: new Date().toISOString()
      });
    }
    setIsTripActive(false);
  };

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل تريد إنهاء الرحلة وتسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: () => {
          stopTracking();
          navigation.replace('Login');
        }
      }
    ]);
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
          <Text style={styles.title}>لوحة السائق 🚌</Text>
          <Text style={styles.driverName}>السائق: {user?.name} | باص رقم: {user?.bus_number}</Text>
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={[styles.statusIndicator, { backgroundColor: isTripActive ? '#10B981' : '#EF4444' }]} />
        <Text style={styles.statusText}>{isTripActive ? 'الرحلة جارية - يتم بث موقعك الآن' : 'الرحلة متوقفة'}</Text>
        <TouchableOpacity 
          style={[styles.tripBtn, { backgroundColor: isTripActive ? '#EF4444' : '#10B981' }]} 
          onPress={isTripActive ? stopTracking : startTrip}
        >
          <Text style={styles.tripBtnText}>{isTripActive ? 'إنهاء الرحلة' : 'بدء الرحلة'}</Text>
        </TouchableOpacity>
      </View>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: currentLoc?.latitude || 31.9454,
          longitude: currentLoc?.longitude || 35.9284,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02
        }}
        region={currentLoc ? {
          latitude: currentLoc.latitude,
          longitude: currentLoc.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02
        } : undefined}
        showsUserLocation={true}
      >
        {students.map(s => (
          s.latitude && s.longitude ? (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.latitude, longitude: s.longitude }}
              title={s.name}
              description={`الصف: ${s.class} | ولي الأمر: ${s.parent_username}`}
              pinColor="orange"
            />
          ) : null
        ))}
      </MapView>

      <View style={styles.studentListContainer}>
        <Text style={styles.listTitle}>قائمة طلاب الرحلة ({students.length})</Text>
        <FlatList
          data={students}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.studentItem}>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{item.name}</Text>
                <Text style={styles.studentSub}>{item.class} - {item.section}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: item.status === 'present' ? '#DCFCE7' : '#F1F5F9' }]}>
                <Text style={[styles.statusBadgeText, { color: item.status === 'present' ? '#166534' : '#64748B' }]}>
                  {item.status === 'present' ? 'صعد' : 'لم يصعد'}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>لا يوجد طلاب مرتبطين بك حالياً</Text>}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  driverName: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  statusCard: { margin: 15, padding: 15, backgroundColor: '#FFF', borderRadius: 15, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  statusIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  statusText: { flex: 1, fontSize: 13, color: '#1E293B', fontWeight: '600' },
  tripBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10 },
  tripBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  map: { width: width, height: height * 0.35 },
  studentListContainer: { flex: 1, padding: 15 },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 10, textAlign: 'right' },
  studentItem: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 1 },
  studentInfo: { alignItems: 'flex-end' },
  studentName: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  studentSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 11, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#64748B', marginTop: 20 }
});
