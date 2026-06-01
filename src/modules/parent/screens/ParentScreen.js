import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking,
  StatusBar,
  Image,
} from 'react-native';
import * as Location from 'expo-location';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, onValue } from 'firebase/database';
import { SafeAreaView } from 'react-native-safe-area-context';

// استيراد المكونات والخدمات (تحديث الروابط للهيكل الجديد)
import { db } from '../../../../firebaseConfig';
import { calculateDistance } from '../../../../utils/geo';
import { clearUserSession } from '../../../../services/sessionService';

// استيراد مكونات وخدمات وحدة ولي الأمر
import ParentMap from '../components/ParentMap';
import { subscribeToParentStudent } from '../services/parentStudentService';
import { subscribeToDriverInfo, subscribeToStaffInfo, subscribeToBusLocation } from '../services/parentBusService';
import { subscribeToSchoolInfo } from '../../school/services/schoolDataService';

const { width } = Dimensions.get('window');

export default function ParentScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { schoolId, user } = route.params || {};
  const [busLocation, setBusLocation] = useState(null);
  const [animatedBusLocation, setAnimatedBusLocation] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const animationFrame = useRef(null);
  const [alertMinutes, setAlertMinutes] = useState(2);
  const [notified, setNotified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [staffInfo, setStaffInfo] = useState(null);
  const [schoolLoc, setSchoolLoc] = useState(null);
  const [schoolName, setSchoolName] = useState('');
  const [schoolLogo, setSchoolLogo] = useState('');
  const [socialLinks, setSocialLinks] = useState(null);

  useEffect(() => {
    if (!schoolId || !user?.username) {
      setLoading(false);
      return;
    }

    const unsubStudent = subscribeToParentStudent(schoolId, user.username, setStudentInfo, () => setLoading(false));

    // جلب هوية المدرسة وموقعها
    const unsubSchool = subscribeToSchoolInfo(schoolId, (data) => {
      if (data) {
        setSchoolName(data.displayName || data.name || '');
        setSchoolLogo(data.logoUrl || '');
        setSocialLinks(data.socialLinks || null);
        if (data.latitude && data.longitude) {
          setSchoolLoc({
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude),
          });
        }
      }
    });

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setMyLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch (e) {
        console.log('Location permission error:', e);
      }
    })();

    return () => {
      unsubStudent();
      unsubSchool();
    };
  }, [schoolId, user?.username]);

  useEffect(() => {
    const driverId = studentInfo?.driverUsername || studentInfo?.driver_id;
    if (!schoolId || !driverId) return;

    const unsubDriver = subscribeToDriverInfo(schoolId, driverId, setDriverInfo);
    const unsubStaff = subscribeToStaffInfo(schoolId, driverId, setStaffInfo);
    const unsubBus = subscribeToBusLocation(schoolId, driverId, (newLoc) => {
      if (!newLoc) {
        setBusLocation(null);
        setAnimatedBusLocation(null);
        return;
      }

      if (!busLocation) {
        setBusLocation(newLoc);
        setAnimatedBusLocation(newLoc);
      } else {
        animateBus(animatedBusLocation || busLocation, newLoc);
        setBusLocation(newLoc);
      }

      if (myLocation) {
        const dist = calculateDistance(newLoc.latitude, newLoc.longitude, myLocation.latitude, myLocation.longitude);
        const alertThreshold = alertMinutes * 0.5;
        if (dist < alertThreshold && !notified && studentInfo?.status !== 'absent_today') {
          Alert.alert('🔔 تنبيه وصول الباص 🚌', `الباص على بعد حوالي ${dist.toFixed(1)} كم من موقعك وسيقوم بالوصول قريباً.`);
          setNotified(true);
        } else if (dist > alertThreshold + 0.5) {
          setNotified(false);
        }
      }
    });

    return () => {
      unsubDriver();
      unsubStaff();
      unsubBus();
    };
  }, [schoolId, studentInfo, myLocation, alertMinutes, notified]);

  const animateBus = (start, end) => {
    let startTime = null;
    const duration = 10000;
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

  const handleLogout = async () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', onPress: async () => {
        await clearUserSession();
        navigation.replace('Login');
      }},
    ]);
  };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Text style={styles.logoutText}>خروج</Text></TouchableOpacity>
          {socialLinks && (
            <View style={{ flexDirection: 'row', marginLeft: 10 }}>
              {socialLinks.facebook && (
                <TouchableOpacity onPress={() => Linking.openURL(socialLinks.facebook)} style={{ marginRight: 10 }}>
                  <Text style={{ fontSize: 20 }}>🔵</Text>
                </TouchableOpacity>
              )}
              {socialLinks.instagram && (
                <TouchableOpacity onPress={() => Linking.openURL(socialLinks.instagram)}>
                  <Text style={{ fontSize: 20 }}>📸</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{schoolName || 'تتبع الباص'}</Text>
            <Text style={styles.studentName}>{studentInfo?.name}</Text>
          </View>
          {schoolLogo ? (
            <Image source={{ uri: schoolLogo }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}><Text style={{ fontSize: 20 }}>🏠</Text></View>
          )}
        </View>
      </View>

      <ParentMap 
        busLocation={animatedBusLocation} 
        myLocation={myLocation} 
        schoolLoc={schoolLoc} 
      />

      <View style={styles.infoPanel}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>السائق</Text>
            <Text style={styles.infoValue}>{driverInfo?.name || 'غير متوفر'}</Text>
            {driverInfo?.phone && (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${driverInfo.phone}`)}>
                <Text style={styles.callText}>📞 اتصل</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>المرافقة</Text>
            <Text style={styles.infoValue}>{staffInfo?.name || 'غير متوفر'}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerInfo: { alignItems: 'flex-end', marginRight: 10 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  studentName: { fontSize: 13, color: '#64748B' },
  logo: { width: 45, height: 45, borderRadius: 22.5, resizeMode: 'contain', backgroundColor: '#F1F5F9' },
  logoPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  infoPanel: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 5 },
  infoRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  infoItem: { alignItems: 'center', flex: 1 },
  infoLabel: { fontSize: 12, color: '#64748B', marginBottom: 5 },
  infoValue: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  callText: { color: '#3B82F6', fontSize: 12, marginTop: 5, fontWeight: 'bold' }
});
