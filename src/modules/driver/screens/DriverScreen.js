import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Linking,
  StatusBar,
  Image,
} from 'react-native';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// استيراد المكونات من مساراتها الجديدة داخل الوحدة
import DriverMap from '../components/DriverMap';
import StudentItem from '../components/StudentItem';

// استيراد الخدمات (تحديث الروابط لتناسب الهيكل الجديد)
import { requestLocationPermission, getCurrentLocation } from '../../../services/locationService';
import { clearUserSession } from '../../../services/sessionService';
import { updateBusLocation } from '../../../services/busService';

// استيراد خدمات وحدة السائق
import { subscribeToDriverStudents } from '../services/driverStudentService';
import { startLiveLocationTracking } from '../services/driverLocationService';
import { startBackgroundTracking, stopBackgroundTracking } from '../services/driverBackgroundService';
import { subscribeToSchoolInfo } from '../../school/services/schoolDataService';

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
  const [schoolLogo, setSchoolLogo] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [socialLinks, setSocialLinks] = useState(null);
  
  const mapRef = useRef(null);
  const watchSubscription = useRef(null);

  useEffect(() => {
    if (!schoolId || !user?.username) {
      setLoading(false);
      return;
    }
    initializeScreen();
    
    // جلب هوية المدرسة
    const unsubSchool = subscribeToSchoolInfo(schoolId, (data) => {
      if (data) {
        setSchoolName(data.displayName || data.name || '');
        setSchoolLogo(data.logoUrl || '');
        setSocialLinks(data.socialLinks || null);
      }
    });

    return () => {
      if (watchSubscription.current) {
        watchSubscription.current.remove();
      }
      unsubSchool();
    };
  }, []);

  const initializeScreen = async () => {
    try {
      await AsyncStorage.setItem('background_session', JSON.stringify({ schoolId, user }));
      const active = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      setIsTripActive(active);
      subscribeToStudents();
      await setupLocation();
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToStudents = () => {
    subscribeToDriverStudents(schoolId, user.username, setStudents);
  };

  const setupLocation = async () => {
    try {
      await requestLocationPermission();
      const initialLocation = await getCurrentLocation();
      if (!initialLocation) return;

      const locationObject = {
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
      };
      setCurrentLoc(locationObject);
      mapRef.current?.animateToRegion({ ...locationObject, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);

      watchSubscription.current = await startLiveLocationTracking({
        schoolId,
        username: user.username,
        onLocationChange: ({ location, speed }) => {
          setCurrentLoc(location);
          setCurrentSpeed(speed);
          mapRef.current?.animateCamera({ center: location, zoom: 17 });
        },
      });
    } catch (error) {
      console.log(error);
      Alert.alert('خطأ', 'تعذر تحديد موقعك');
    }
  };

  const startTrip = async () => {
    try {
      await startBackgroundTracking(LOCATION_TASK_NAME);
      setIsTripActive(true);
      Alert.alert('تم بدء الرحلة', 'يتم الآن تتبع الباص مباشرة');
    } catch (error) {
      Alert.alert('خطأ', error.message);
    }
  };

  const stopTrip = async () => {
    try {
      await stopBackgroundTracking(LOCATION_TASK_NAME);
      setIsTripActive(false);
      Alert.alert('تم إنهاء الرحلة', 'تم إيقاف التتبع');
    } catch (error) {
      Alert.alert('خطأ', 'فشل إيقاف الرحلة');
    }
  };

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', onPress: async () => {
        try {
          await clearUserSession();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        } catch (error) {
          Alert.alert('خطأ', 'فشل تسجيل الخروج');
        }
      }},
    ]);
  };

  const callParent = (phone) => {
    if (!phone) {
      Alert.alert('خطأ', 'رقم الهاتف غير متوفر');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={styles.loadingText}>جاري تحميل البيانات...</Text>
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
            <Text style={styles.title}>{schoolName || 'لوحة السائق'}</Text>
            <Text style={styles.driverName}>{user?.name}</Text>
          </View>
          {schoolLogo ? (
            <Image source={{ uri: schoolLogo }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}><Text style={{ fontSize: 20 }}>🚌</Text></View>
          )}
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.speedCircle}>
          <Text style={styles.speedValue}>{currentSpeed}</Text>
          <Text style={styles.speedUnit}>كم/س</Text>
        </View>
        <TouchableOpacity style={[styles.tripBtn, isTripActive ? styles.stopBtn : styles.startBtn]} onPress={isTripActive ? stopTrip : startTrip}>
          <Text style={styles.tripBtnText}>{isTripActive ? 'إنهاء الرحلة 🏁' : 'بدء الرحلة 🚀'}</Text>
        </TouchableOpacity>
      </View>

      <DriverMap mapRef={mapRef} currentLoc={currentLoc} />

      <View style={styles.studentListContainer}>
        <Text style={styles.listTitle}>قائمة الطلاب ({students.length})</Text>
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <StudentItem student={item} onCallParent={callParent} />
          )}
        />
      </View>
    </SafeAreaView>
  );
}

// ملاحظة: تم نقل تعريف المهمة LOCATION_TASK_NAME إلى driverBackgroundService.js لتوحيد منطق التتبع ومنع التكرار.

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#64748B' },
  header: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerInfo: { alignItems: 'flex-end', marginRight: 10 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  driverName: { fontSize: 13, color: '#64748B' },
  logo: { width: 45, height: 45, borderRadius: 22.5, resizeMode: 'contain', backgroundColor: '#F1F5F9' },
  logoPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  statusCard: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  speedCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#3B82F6' },
  speedValue: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  speedUnit: { fontSize: 10, color: '#64748B' },
  tripBtn: { flex: 1, marginLeft: 15, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  startBtn: { backgroundColor: '#10B981' },
  stopBtn: { backgroundColor: '#EF4444' },
  tripBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  studentListContainer: { flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, elevation: 10 },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 15, textAlign: 'right' }
});
