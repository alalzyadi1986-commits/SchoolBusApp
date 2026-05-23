import React, { useState, useEffect } from 'react';
<<<<<<< HEAD
=======
<<<<<<< HEAD
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
=======
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Alert, ActivityIndicator, Linking } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, onValue, update, push, set } from "firebase/database";
import { db } from '../firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function ParentScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { schoolId, user } = route.params || {};

  const [busLocation, setBusLocation] = useState(null);
<<<<<<< HEAD
  const [myLocation, setMyLocation] = useState(null);
=======
  const [animatedBusLocation, setAnimatedBusLocation] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const animationFrame = useRef(null);
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
  const [alertMinutes, setAlertMinutes] = useState(2);
  const [notified, setNotified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [staffInfo, setStaffInfo] = useState(null);
<<<<<<< HEAD
=======
  const [schoolLoc, setSchoolLoc] = useState(null);
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c

  useEffect(() => {
    if (!schoolId || !user?.username) return;

    // 1. الاشتراك في بيانات الطالب
    const unsubStudent = onValue(ref(db, `schools/${schoolId}/students`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const myStudentKey = Object.keys(data).find(key => data[key].parent_username === user.username);
        if (myStudentKey) setStudentInfo({ id: myStudentKey, ...data[myStudentKey] });
      }
      setLoading(false);
    });

<<<<<<< HEAD
=======
    // جلب موقع المدرسة لعرضه على الخريطة
    onValue(ref(db, `schools/${schoolId}`), (snap) => {
      const data = snap.val();
      if (data?.latitude && data?.longitude) {
        setSchoolLoc({ latitude: data.latitude, longitude: data.longitude });
      }
    });

>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
    // 2. طلب صلاحيات الموقع
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setMyLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();

    return () => unsubStudent();
  }, [schoolId, user?.username]);

  // 3. الاشتراك في بيانات السائق والمرافقة والBus (مستقل)
  useEffect(() => {
    if (!schoolId || !studentInfo?.driver_id) return;

    const unsubDriver = onValue(ref(db, `schools/${schoolId}/drivers/${studentInfo.driver_id}`), (snap) => setDriverInfo(snap.val()));
    
    const unsubStaff = onValue(ref(db, `schools/${schoolId}/staff`), (snap) => {
      const staffData = snap.val();
      if (staffData) setStaffInfo(Object.values(staffData).find(s => s.driver_id === studentInfo.driver_id));
    });

    const unsubBus = onValue(ref(db, `schools/${schoolId}/bus/${studentInfo.driver_id}`), (snap) => {
      const busData = snap.val();
      if (busData && busData.isActive) {
<<<<<<< HEAD
        setBusLocation({ latitude: busData.latitude, longitude: busData.longitude });
=======
        const newLoc = { latitude: busData.latitude, longitude: busData.longitude };
        
        // إذا كانت هذه أول مرة نستلم فيها الموقع، نضعه مباشرة
        if (!busLocation) {
          setBusLocation(newLoc);
          setAnimatedBusLocation(newLoc);
        } else {
          // بدء عملية التحريك السلس من الموقع القديم إلى الجديد
          animateBus(busLocation, newLoc);
          setBusLocation(newLoc);
        }

>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
        if (myLocation) {
          const dist = calculateDistance(busData.latitude, busData.longitude, myLocation.latitude, myLocation.longitude);
          if (dist < alertMinutes * 0.5 && !notified && studentInfo.status !== 'absent_today') {
            Alert.alert("🔔 تنبيه هام 🚌", `باص ${studentInfo.name} يقترب من موقعك! سيصل خلال ${alertMinutes} دقائق تقريباً.`);
            setNotified(true);
          }
        }
<<<<<<< HEAD
      } else { setBusLocation(null); }
=======
      } else { 
        setBusLocation(null); 
        setAnimatedBusLocation(null);
      }
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
    });

    return () => { unsubDriver(); unsubStaff(); unsubBus(); };
  }, [schoolId, studentInfo?.driver_id, myLocation, alertMinutes, notified]);

  const reportAbsence = () => {
    if (!studentInfo) return;
    const isAbsent = studentInfo.status === 'absent_today';
    Alert.alert(
      isAbsent ? 'إلغاء الغياب' : 'إبلاغ عن غياب',
      isAbsent ? 'هل تريد إلغاء بلاغ الغياب والعودة لجدول الرحلة؟' : 'هل تريد إبلاغ السائق بأن الطالب غائب اليوم ولن يصعد الباص؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تأكيد', onPress: async () => {
          const newStatus = isAbsent ? 'pending' : 'absent_today';
          await update(ref(db, `schools/${schoolId}/students/${studentInfo.id}`), {
            status: newStatus,
            lastUpdate: new Date().toISOString()
          });
          
          // إضافة سجل للتقرير
          const reportRef = ref(db, `schools/${schoolId}/reports`);
          const newReport = push(reportRef);
          await set(newReport, {
            type: 'absence',
            timestamp: new Date().toISOString(),
            message: `ولي الأمر (${user.username}) أبلغ عن ${newStatus === 'absent_today' ? 'غياب' : 'إلغاء غياب'} الطالب ${studentInfo.name}.`,
            studentId: studentInfo.id,
            parentUsername: user.username
          });

          Alert.alert('تم التحديث', isAbsent ? 'تم إلغاء بلاغ الغياب' : 'تم إبلاغ السائق والمرافقة بغياب الطالب');
        }}
      ]
    );
  };

  const makeCall = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
    else Alert.alert('خطأ', 'رقم الهاتف غير متوفر');
  };
<<<<<<< HEAD
=======
>>>>>>> 26cefefa39de4b8031862128921805f50f269406
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
<<<<<<< HEAD
=======
<<<<<<< HEAD
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
=======
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

<<<<<<< HEAD
=======
  // دالة لتحريك الباص بسلاسة خلال فترة التحديث (10 ثوانٍ)
  const animateBus = (start, end) => {
    let startTime = null;
    const duration = 10000; // يجب أن تتوافق مع timeInterval في تطبيق السائق

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      const currentLat = start.latitude + (end.latitude - start.latitude) * progress;
      const currentLon = start.longitude + (end.longitude - start.longitude) * progress;
      
      setAnimatedBusLocation({ latitude: currentLat, longitude: currentLon });

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(step);
      }
    };
    
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    animationFrame.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => { if (animationFrame.current) cancelAnimationFrame(animationFrame.current); };
  }, []);

>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}><Text style={styles.logoutText}>خروج</Text></TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.title}>تتبع الباص 🚌</Text>
          <Text style={styles.parentName}>عائلة {user?.family_name}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.studentHeader}>
          <TouchableOpacity 
            style={[styles.absenceBtn, studentInfo?.status === 'absent_today' && styles.absenceBtnActive]} 
            onPress={reportAbsence}
          >
            <Text style={[styles.absenceBtnText, studentInfo?.status === 'absent_today' && styles.absenceBtnTextActive]}>
              {studentInfo?.status === 'absent_today' ? 'إلغاء الغياب' : 'إبلاغ عن غياب'}
            </Text>
          </TouchableOpacity>
          <View style={{alignItems: 'flex-end'}}>
            <Text style={styles.studentName}>{studentInfo?.name || 'غير مسجل'}</Text>
            <Text style={styles.studentStatus}>
              الحالة: {studentInfo?.status === 'absent_today' ? 'غائب اليوم ⭕' : studentInfo?.status === 'present' ? 'داخل الباص ✅' : 'ينتظر الباص ⏳'}
            </Text>
          </View>
        </View>
        
        <View style={styles.contactRow}>
          {driverInfo && (
            <TouchableOpacity style={styles.contactBtn} onPress={() => makeCall(driverInfo.phone)}>
              <Text style={styles.contactBtnText}>📞 السائق: {driverInfo.name}</Text>
            </TouchableOpacity>
          )}
          {staffInfo && (
            <TouchableOpacity style={[styles.contactBtn, {backgroundColor: '#10B981'}]} onPress={() => makeCall(staffInfo.phone)}>
              <Text style={styles.contactBtnText}>📞 المرافقة: {staffInfo.name}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>وقت التنبيه المفضل:</Text>
        <View style={styles.optionsRow}>
          {[1, 2, 5, 10].map(m => (
            <TouchableOpacity key={m} style={[styles.optBtn, alertMinutes === m && styles.optBtnActive]} onPress={() => { setAlertMinutes(m); setNotified(false); }}>
              <Text style={[styles.optText, alertMinutes === m && styles.optTextActive]}>{m} د</Text>
<<<<<<< HEAD
=======
>>>>>>> 26cefefa39de4b8031862128921805f50f269406
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
            </TouchableOpacity>
          ))}
        </View>
      </View>

<<<<<<< HEAD
=======
<<<<<<< HEAD
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
=======
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
      <MapView
        style={styles.map}
        initialRegion={{ latitude: myLocation?.latitude || 31.9454, longitude: myLocation?.longitude || 35.9284, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        showsUserLocation={true}
      >
        {myLocation && <Marker coordinate={myLocation} title="منزلي" pinColor="green" />}
<<<<<<< HEAD
        {busLocation && <Marker coordinate={busLocation} title="الباص 🚌" pinColor="blue" />}
      </MapView>
    </SafeAreaView>
=======
        {schoolLoc && <Marker coordinate={schoolLoc} title="المدرسة 🏫" pinColor="red" />}
        {animatedBusLocation && <Marker coordinate={animatedBusLocation} title="الباص 🚌" pinColor="blue" />}
      </MapView>
    </SafeAreaView>
>>>>>>> 26cefefa39de4b8031862128921805f50f269406
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
=======
<<<<<<< HEAD
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
=======
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  parentName: { fontSize: 14, color: '#64748B' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  infoCard: { margin: 15, padding: 15, backgroundColor: '#FFF', borderRadius: 15, elevation: 2 },
  studentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  studentName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  studentStatus: { fontSize: 13, color: '#64748B', marginTop: 4 },
  absenceBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444' },
  absenceBtnActive: { backgroundColor: '#EF4444' },
  absenceBtnText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
  absenceBtnTextActive: { color: '#FFF' },
  contactRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  contactBtn: { backgroundColor: '#3B82F6', padding: 8, borderRadius: 8, flex: 0.48, alignItems: 'center' },
  contactBtnText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  settingsCard: { marginHorizontal: 15, marginBottom: 15, padding: 15, backgroundColor: '#FFF', borderRadius: 15, elevation: 2 },
  settingsTitle: { fontSize: 13, fontWeight: 'bold', color: '#1E293B', textAlign: 'right', marginBottom: 10 },
  optionsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  optBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10, backgroundColor: '#F1F5F9', minWidth: 60, alignItems: 'center' },
  optBtnActive: { backgroundColor: '#3B82F6' },
  optText: { fontSize: 12, color: '#64748B', fontWeight: 'bold' },
  optTextActive: { color: '#FFF' },
  map: { flex: 1 }
});
<<<<<<< HEAD
=======
>>>>>>> 26cefefa39de4b8031862128921805f50f269406
>>>>>>> e88856a2ede78e87d601600f19ba6c765b7d517c
