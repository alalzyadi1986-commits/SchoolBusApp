import React, { useState, useEffect } from 'react';
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
  const [myLocation, setMyLocation] = useState(null);
  const [alertMinutes, setAlertMinutes] = useState(2);
  const [notified, setNotified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [staffInfo, setStaffInfo] = useState(null);

  useEffect(() => {
    if (!schoolId || !user?.username) return;

    const studentsRef = ref(db, `schools/${schoolId}/students`);
    onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const myStudentKey = Object.keys(data).find(key => data[key].parent_username === user.username);
        if (myStudentKey) {
          const myStudent = { id: myStudentKey, ...data[myStudentKey] };
          setStudentInfo(myStudent);
          
          if (myStudent.driver_id) {
            // جلب بيانات السائق
            onValue(ref(db, `schools/${schoolId}/drivers/${myStudent.driver_id}`), (dSnap) => {
              setDriverInfo(dSnap.val());
            });
            
            // جلب بيانات المرافقة المرتبطة بالسائق
            onValue(ref(db, `schools/${schoolId}/staff`), (sSnap) => {
              const staffData = sSnap.val();
              if (staffData) {
                const myStaff = Object.values(staffData).find(s => s.driver_id === myStudent.driver_id);
                setStaffInfo(myStaff);
              }
            });

            const busRef = ref(db, `schools/${schoolId}/bus/${myStudent.driver_id}`);
            onValue(busRef, (busSnap) => {
              const busData = busSnap.val();
              if (busData && busData.isActive) {
                setBusLocation({ latitude: busData.latitude, longitude: busData.longitude });
                if (myLocation) {
                  const dist = calculateDistance(busData.latitude, busData.longitude, myLocation.latitude, myLocation.longitude);
                  if (dist < alertMinutes * 0.5 && !notified && myStudent.status !== 'absent_today') {
                    Alert.alert("تنبيه 🚌", `باص ${myStudent.name} يقترب! سيصل خلال ${alertMinutes} دقائق تقريباً`);
                    setNotified(true);
                  }
                }
              } else { setBusLocation(null); }
            });
          }
        }
      }
      setLoading(false);
    });

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        setMyLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
  }, [schoolId, user, myLocation, alertMinutes, notified]);

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

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

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
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <MapView
        style={styles.map}
        initialRegion={{ latitude: myLocation?.latitude || 31.9454, longitude: myLocation?.longitude || 35.9284, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        showsUserLocation={true}
      >
        {myLocation && <Marker coordinate={myLocation} title="منزلي" pinColor="green" />}
        {busLocation && <Marker coordinate={busLocation} title="الباص 🚌" pinColor="blue" />}
      </MapView>
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
