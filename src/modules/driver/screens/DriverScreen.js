import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ScrollView,
  Modal,
} from 'react-native';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// استيراد المكونات والخدمات
import DriverMap from '../components/DriverMap';
import StudentItem from '../components/StudentItem';
import { requestLocationPermission, getCurrentLocation } from '../../../services/locationService';
import { clearUserSession } from '../../../services/sessionService';
import { subscribeToDriverStudents } from '../services/driverStudentService';
import { startLiveLocationTracking } from '../services/driverLocationService';
import { startBackgroundTracking, stopBackgroundTracking } from '../services/driverBackgroundService';
import { subscribeToSchoolInfo } from '../../school/services/schoolDataService';
import { subscribeLostAndFoundItems } from '../../lostAndFound/services/lostAndFoundService';
import { LostAndFoundItemCard } from '../../lostAndFound/components/LostAndFoundComponents';

const LOCATION_TASK_NAME = 'background-location-task';

export default function DriverScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { schoolId, user } = route.params || {};
  
  const [activeTab, setActiveTab] = useState('tracking'); // 'tracking' or 'lostAndFound'
  const [currentLoc, setCurrentLoc] = useState(null);
  const [students, setStudents] = useState([]);
  const [isTripActive, setIsTripActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [schoolLogo, setSchoolLogo] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [socialLinks, setSocialLinks] = useState(null);
  const [lostAndFoundItems, setLostAndFoundItems] = useState([]);
  
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

    // الاشتراك في المفقودات الخاصة بباص السائق
    const unsubLostFound = subscribeLostAndFoundItems(schoolId, (items) => {
      const filtered = items.filter(item => item.busId === user.username);
      setLostAndFoundItems(filtered);
    });

    return () => {
      if (watchSubscription.current) watchSubscription.current.remove();
      unsubSchool();
      unsubLostFound();
    };
  }, []);

  const initializeScreen = async () => {
    try {
      await AsyncStorage.setItem('background_session', JSON.stringify({ schoolId, user }));
      const active = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      setIsTripActive(active);
      subscribeToDriverStudents(schoolId, user.username, setStudents);
      await setupLocation();
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const setupLocation = async () => {
    try {
      await requestLocationPermission();
      const initialLocation = await getCurrentLocation();
      if (!initialLocation) return;

      const locationObject = { latitude: initialLocation.latitude, longitude: initialLocation.longitude };
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
        await clearUserSession();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
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

  const stats = useMemo(() => {
    return {
      activeLostFound: lostAndFoundItems.filter(i => i.status === 'active').length
    };
  }, [lostAndFoundItems]);

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={styles.loadingText}>جاري تحميل البيانات...</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* الترويسة */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>خروج</Text>
          </TouchableOpacity>
          {socialLinks && (
            <View style={styles.socialContainer}>
              {socialLinks.facebook && (
                <TouchableOpacity onPress={() => Linking.openURL(socialLinks.facebook)} style={styles.socialIcon}>
                  <Text style={{ fontSize: 18 }}>🔵</Text>
                </TouchableOpacity>
              )}
              {socialLinks.instagram && (
                <TouchableOpacity onPress={() => Linking.openURL(socialLinks.instagram)} style={styles.socialIcon}>
                  <Text style={{ fontSize: 18 }}>📸</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerInfo}>
            <Text style={styles.schoolNameText}>{schoolName || 'لوحة السائق'}</Text>
            <Text style={styles.driverNameText}>{user?.name}</Text>
          </View>
          {schoolLogo ? (
            <Image source={{ uri: schoolLogo }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}><Text style={{ fontSize: 20 }}>🚌</Text></View>
          )}
        </View>
      </View>

      {/* التبويبات */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'tracking' && styles.tabActive]} 
          onPress={() => setActiveTab('tracking')}
        >
          <Text style={[styles.tabText, activeTab === 'tracking' && styles.tabTextActive]}>تتبع الرحلة</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'lostAndFound' && styles.tabActive]} 
          onPress={() => setActiveTab('lostAndFound')}
        >
          <Text style={[styles.tabText, activeTab === 'lostAndFound' && styles.tabTextActive]}>مفقودات الباص</Text>
          {stats.activeLostFound > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{stats.activeLostFound}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'tracking' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.statusCard}>
            <View style={styles.speedCircle}>
              <Text style={styles.speedValue}>{currentSpeed}</Text>
              <Text style={styles.speedUnit}>كم/س</Text>
            </View>
            <TouchableOpacity 
              style={[styles.tripBtn, isTripActive ? styles.stopBtn : styles.startBtn]} 
              onPress={isTripActive ? stopTrip : startTrip}
            >
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
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 15 }}>
          <Text style={styles.sectionTitle}>📦 مفقودات ومعثورات باصك</Text>
          {lostAndFoundItems.length > 0 ? (
            lostAndFoundItems.map(item => (
              <LostAndFoundItemCard 
                key={item.id}
                item={item}
                userRole="driver"
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 50, marginBottom: 10 }}>✨</Text>
              <Text style={styles.emptyText}>لا توجد مفقودات حالياً في باصك.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#64748B' },
  
  // الترويسة
  header: { 
    padding: 15, 
    backgroundColor: '#FFF', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerInfo: { alignItems: 'flex-end', marginRight: 10 },
  schoolNameText: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  driverNameText: { fontSize: 13, color: '#64748B' },
  logo: { width: 45, height: 45, borderRadius: 22.5, resizeMode: 'contain', backgroundColor: '#F1F5F9' },
  logoPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  logoutBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  socialContainer: { flexDirection: 'row', marginLeft: 12, gap: 8 },
  socialIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

  // التبويبات
  tabsContainer: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 8, gap: 10 },
  tab: { 
    flex: 1, 
    paddingVertical: 10, 
    borderRadius: 12, 
    backgroundColor: '#F1F5F9', 
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  tabActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  tabText: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },
  tabTextActive: { color: '#FFF' },
  tabBadge: { marginLeft: 6, backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  tabBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  statusCard: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  speedCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#3B82F6' },
  speedValue: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  speedUnit: { fontSize: 10, color: '#64748B' },
  tripBtn: { flex: 1, marginLeft: 15, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  startBtn: { backgroundColor: '#10B981' },
  stopBtn: { backgroundColor: '#EF4444' },
  tripBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  
  studentListContainer: { flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, elevation: 10 },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 15, textAlign: 'right' },
  
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B', marginBottom: 12, textAlign: 'right' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { textAlign: 'center', color: '#64748B', fontSize: 14, fontWeight: '600' }
});
