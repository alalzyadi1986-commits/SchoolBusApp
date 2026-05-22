<<<<<<< HEAD
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
=======
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, FlatList, Alert, ActivityIndicator, Linking } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, onValue, update, push, set } from "firebase/database";
import { db } from '../firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const LOCATION_TASK_NAME = 'background-location-task';

export default function DriverScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { schoolId, user } = route.params || {};

  const [currentLoc, setCurrentLoc] = useState(null);
  const [students, setStudents] = useState([]);
  const [isTripActive, setIsTripActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [speedAlertSent, setSpeedAlertSent] = useState(false);
  const [schoolLoc, setSchoolLoc] = useState(null);
  
  const stopTimers = useRef({}); // لتتبع وقت توقف الباص عند كل منزل

  useEffect(() => {
    if (!schoolId || !user?.username) return;

    // حفظ بيانات الجلسة لاستخدامها في مهمة الخلفية
    AsyncStorage.setItem('background_session', JSON.stringify({ schoolId, user }));

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
        await Location.requestBackgroundPermissionsAsync();
        let loc = await Location.getCurrentPositionAsync({});
        setCurrentLoc(loc.coords);
      }
      
      // التحقق إذا كانت المهمة تعمل بالفعل
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      setIsTripActive(hasStarted);
    })();

    // جلب موقع المدرسة للإنهاء التلقائي
    onValue(ref(db, `schools/${schoolId}`), (snap) => {
      const data = snap.val();
      if (data?.latitude && data?.longitude) {
        setSchoolLoc({ latitude: data.latitude, longitude: data.longitude });
      }
    });

    return () => { unsubscribeStudents(); };
  }, [schoolId, user]);

  const startTrip = async () => {
    if (user?.permissions && !user.permissions.canStartTrip) { Alert.alert('صلاحية مرفوضة', 'ليس لديك صلاحية بدء الرحلة'); return; }
    
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') { Alert.alert('خطأ', 'يجب السماح بالوصول للموقع'); return; }
    
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      Alert.alert('تنبيه', 'للتتبع في الخلفية، يرجى اختيار "السماح دائماً" في إعدادات الموقع');
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10, // زيادة المسافة لتقليل التحديثات غير الضرورية
      timeInterval: 10000, // تحديث كل 10 ثوانٍ بدلاً من 5 لتوفير التكلفة والبطارية
      foregroundService: {
        notificationTitle: "تطبيق الباص يعمل",
        notificationBody: "يتم تتبع موقع الباص حالياً لإبلاغ الأهالي",
        notificationColor: "#3B82F6"
      }
    });

    setIsTripActive(true);
    Alert.alert('تم البدء', 'بدأت الرحلة والتتبع يعمل الآن حتى لو أغلق التطبيق');
  };

  const stopTracking = async () => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
    
    if (schoolId && user?.username) { 
      // جلب الموقع الحالي عند الإغلاق اليدوي للتوثيق
      let closeLocation = "Unknown";
      let distToSchool = "N/A";
      try {
        const loc = await Location.getCurrentPositionAsync({});
        closeLocation = `${loc.coords.latitude},${loc.coords.longitude}`;
        if (schoolLoc) {
          const { calculateDistance } = require("../utils/geo");
          distToSchool = calculateDistance(loc.coords.latitude, loc.coords.longitude, schoolLoc.latitude, schoolLoc.longitude).toFixed(2);
        }
      } catch (e) {}

      await update(ref(db, `schools/${schoolId}/bus/${user.username}`), { 
        isActive: false, 
        updatedAt: new Date().toISOString(),
        terminationType: 'manual',
        terminationDistance: distToSchool,
        terminationCoords: closeLocation
      });

      // إضافة سجل للتقرير لكشف التلاعب
      if (distToSchool !== "N/A" && parseFloat(distToSchool) > 0.2) {
        const reportRef = push(ref(db, `schools/${schoolId}/reports`));
        await set(reportRef, {
          type: 'termination_alert',
          driverId: user.username,
          message: `تنبيه: السائق ${user.name} أنهى الرحلة يدوياً وهو على بعد ${distToSchool} كم من المدرسة.`,
          timestamp: new Date().toISOString()
        });
      }
    }
    setIsTripActive(false);
    setCurrentSpeed(0);
    Alert.alert('تم الإنهاء', 'تم إيقاف الرحلة وتتبع الموقع');
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

      <View style={styles.speedCard}>
        <View style={styles.speedInfo}>
          <Text style={styles.speedValue}>{currentSpeed}</Text>
          <Text style={styles.speedUnit}>كم/س</Text>
        </View>
        <View style={styles.speedLimit}>
          <Text style={styles.limitText}>السرعة المحددة: {user?.max_speed || 80}</Text>
          {currentSpeed > (user?.max_speed || 80) && <Text style={styles.speedWarning}>⚠️ تجاوز السرعة!</Text>}
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
        {students.map(s => s.latitude && <Marker key={s.id} coordinate={{ latitude: s.latitude, longitude: s.longitude }} title={s.name} pinColor={s.status === 'present' ? 'green' : 'orange'} />)}
      </MapView>

      <View style={styles.studentListContainer}>
        <Text style={styles.listTitle}>طلاب الرحلة ({students.length})</Text>
        <FlatList data={students} keyExtractor={item => item.id} renderItem={({ item }) => (
          <View style={styles.studentItem}>
            <TouchableOpacity style={styles.callBtn} onPress={() => callParent(item.parent_username)}><Text style={styles.callBtnText}>📞 اتصل</Text></TouchableOpacity>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{item.name}</Text>
              <Text style={[styles.studentSub, item.status === 'present' && {color: '#10B981', fontWeight: 'bold'}]}>
                {item.status === 'present' ? 'صعد الباص ✅' : `${item.class}-${item.section}`}
              </Text>
            </View>
          </View>
        )} />
      </View>
    </SafeAreaView>
  );
}

// تعريف مهمة الخلفية خارج المكون
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Background Task Error:", error);
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0];
    if (location) {
      try {
        const sessionStr = await AsyncStorage.getItem('background_session');
        if (sessionStr) {
          const { schoolId, user } = JSON.parse(sessionStr);
          const { latitude, longitude, speed } = location.coords;
          const speedKmH = Math.max(0, Math.round((speed || 0) * 3.6));

          // جلب آخر موقع مسجل لتجنب التحديث إذا لم يتحرك الباص فعلياً
          const lastLocStr = await AsyncStorage.getItem('last_known_location');
          let shouldUpdate = true;
          
          if (lastLocStr) {
            const lastLoc = JSON.parse(lastLocStr);
            const { calculateDistance } = require("../utils/geo");
            const distanceMoved = calculateDistance(latitude, longitude, lastLoc.latitude, lastLoc.longitude);
            
            // إذا تحرك الباص أقل من 10 أمتار وكان واقفاً، لا نحدث Firebase لتوفير العمليات
            if (distanceMoved < 0.01 && speedKmH < 2) {
              shouldUpdate = false;
            }
          }

          if (shouldUpdate) {
            const { ref, update, get } = require("firebase/database");
            const { db } = require("../firebaseConfig");

            await update(ref(db, `schools/${schoolId}/bus/${user.username}`), {
              latitude,
              longitude,
              speed: speedKmH,
              updatedAt: new Date().toISOString(),
              isActive: true
            });
            
            // التحقق من الوصول للمدرسة لإنهاء الرحلة تلقائياً
            const schoolSnap = await get(ref(db, `schools/${schoolId}`));
            const sData = schoolSnap.val();
            if (sData?.latitude && sData?.longitude) {
              const { calculateDistance } = require("../utils/geo");
              const distToSchool = calculateDistance(latitude, longitude, sData.latitude, sData.longitude);
              
              // إذا وصل الباص لمسافة أقل من 100 متر من المدرسة، يتم إنهاء الرحلة
              if (distToSchool < 0.1) {
                await update(ref(db, `schools/${schoolId}/bus/${user.username}`), {
                  isActive: false,
                  updatedAt: new Date().toISOString(),
                  terminationType: 'auto_arrival',
                  terminationDistance: distToSchool.toFixed(3)
                });
                
                // إرسال إشعار محلي للسائق
                const Notifications = require("expo-notifications");
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: "تم إنهاء الرحلة ✅",
                    body: "تم إيقاف التتبع تلقائياً لوصولك لمحيط المدرسة بسلام.",
                  },
                  trigger: null,
                });
              }
            }

            // حفظ الموقع الحالي كموقع أخير
            await AsyncStorage.setItem('last_known_location', JSON.stringify({ latitude, longitude }));
          }
        }
      } catch (err) {
        console.error("Error updating background location:", err);
      }
    }
  }
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  driverName: { fontSize: 13, color: '#64748B' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  speedCard: { margin: 15, padding: 15, backgroundColor: '#1E293B', borderRadius: 15, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  speedInfo: { alignItems: 'center' },
  speedValue: { fontSize: 32, fontWeight: 'bold', color: '#FFF' },
  speedUnit: { fontSize: 12, color: '#94A3B8' },
  speedLimit: { alignItems: 'flex-end' },
  limitText: { fontSize: 14, color: '#94A3B8' },
  speedWarning: { fontSize: 14, color: '#EF4444', fontWeight: 'bold', marginTop: 5 },
  actionRow: { flexDirection: 'row', paddingHorizontal: 15, marginTop: 10, alignItems: 'center' },
  emergencyBtn: { backgroundColor: '#EF4444', padding: 12, borderRadius: 12, marginRight: 10, elevation: 3 },
  emergencyBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  statusCard: { flex: 1, padding: 10, backgroundColor: '#FFF', borderRadius: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  statusIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { flex: 1, fontSize: 12, fontWeight: 'bold' },
  tripBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  tripBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
  map: { width: width, height: height * 0.25, marginTop: 10 },
  studentListContainer: { flex: 1, padding: 15 },
  listTitle: { fontSize: 15, fontWeight: 'bold', textAlign: 'right', marginBottom: 10 },
  studentItem: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 1 },
  studentInfo: { alignItems: 'flex-end' },
  studentName: { fontSize: 14, fontWeight: 'bold' },
  studentSub: { fontSize: 11, color: '#64748B' },
  callBtn: { backgroundColor: '#3B82F6', padding: 6, borderRadius: 6 },
  callBtnText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' }
});
>>>>>>> 26cefefa39de4b8031862128921805f50f269406
