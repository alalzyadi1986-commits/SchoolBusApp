import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Modal,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

// استيراد المكونات والخدمات
import { calculateDistance } from '../../../utils/geo';
import { clearUserSession } from '../../../services/sessionService';
import ParentMap from '../components/ParentMap';
import { subscribeToParentStudent } from '../services/parentStudentService';
import { subscribeToDriverInfo, subscribeToStaffInfo, subscribeToBusLocation } from '../services/parentBusService';
import { subscribeToSchoolInfo } from '../../school/services/schoolDataService';
import { 
  reportLostItem, 
  uploadLostItemImage, 
  subscribeFoundItemsForParent, 
  subscribeLostItemsByParent,
  claimFoundItem,
  confirmParentReceipt
} from '../../lostAndFound/services/lostAndFoundService';
import { LostAndFoundItemCard, ReportLostItemForm } from '../../lostAndFound/components/LostAndFoundComponents';

const { width } = Dimensions.get('window');

export default function ParentScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { schoolId, user } = route.params || {};
  
  const [activeTab, setActiveTab] = useState('map'); // 'map' or 'lostAndFound'
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

  // ميزات المفقودات
  const [foundItems, setFoundItems] = useState([]);
  const [myLostReports, setMyLostReports] = useState([]);
  const [showReportLostModal, setShowReportLostModal] = useState(false);
  const [lostItemData, setLostItemData] = useState({ itemName: '', itemDescription: '' });
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);

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

    // الاشتراك في المفقودات والمعثورات
    const unsubFound = subscribeFoundItemsForParent(schoolId, studentInfo?.driverUsername || studentInfo?.driver_id, setFoundItems);
    const unsubMyLost = subscribeLostItemsByParent(schoolId, user.username, setMyLostReports);

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
      if (unsubFound) unsubFound();
      if (unsubMyLost) unsubMyLost();
    };
  }, [schoolId, user?.username, studentInfo?.driverUsername]);

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

  // ميزات المفقودات
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
      setLostItemData({ ...lostItemData, itemImageURL: result.assets[0].uri });
    }
  };

  const handleReportLostItem = async () => {
    if (!lostItemData.itemName || !lostItemData.studentId) {
      Alert.alert('تنبيه', 'يرجى كتابة اسم الغرض واختيار الطالب');
      return;
    }

    setUploading(true);
    try {
      const itemData = {
        ...lostItemData,
        reportedByParentUsername: user.username,
        reportedByParentName: user.name,
      };

      const itemId = await reportLostItem(schoolId, itemData);

      if (selectedImage) {
        const imageURL = await uploadLostItemImage(schoolId, itemId, selectedImage);
        await reportLostItem(schoolId, { ...itemData, itemImageURL: imageURL }, itemId);
      }

      Alert.alert('تم التبليغ', 'تم إرسال بلاغك للمرافقة والسائق، سيتم إشعارك فور العثور عليه.');
      setShowReportLostModal(false);
      setLostItemData({ itemName: '', itemDescription: '' });
      setSelectedImage(null);
    } catch (error) {
      Alert.alert('خطأ', 'فشل إرسال البلاغ');
    } finally {
      setUploading(false);
    }
  };

  const handleClaimItem = (item) => {
    Alert.alert(
      'تأكيد المطالبة',
      `هل أنت متأكد أن "${item.itemName}" يخص ابنك؟ سيصل إشعار للمرافقة لتسليمه لك.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { 
          text: 'نعم، هذا لولدي', 
          onPress: async () => {
            try {
              await claimFoundItem(schoolId, item.id, user.username, user.name);
              Alert.alert('تم الإرسال', 'تم إبلاغ المرافقة، يرجى التنسيق معها لاستلام الغرض.');
            } catch (e) {
              Alert.alert('خطأ', 'فشل إرسال المطالبة');
            }
          }
        }
      ]
    );
  };

  const handleConfirmReceipt = async (item) => {
    try {
      await confirmParentReceipt(schoolId, item.id);
      Alert.alert('تم', 'شكراً لتأكيد الاستلام!');
    } catch (e) {
      Alert.alert('خطأ', 'فشل التأكيد');
    }
  };

  const stats = useMemo(() => {
    return {
      foundCount: foundItems.length,
      myLostCount: myLostReports.filter(i => i.status === 'active').length
    };
  }, [foundItems, myLostReports]);

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#3B82F6" />
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
            <Text style={styles.schoolNameText}>{schoolName || 'تتبع الباص'}</Text>
            <Text style={styles.studentNameText}>{studentInfo?.name}</Text>
          </View>
          {schoolLogo ? (
            <Image source={{ uri: schoolLogo }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}><Text style={{ fontSize: 20 }}>🏠</Text></View>
          )}
        </View>
      </View>

      {/* التبويبات */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'map' && styles.tabActive]} 
          onPress={() => setActiveTab('map')}
        >
          <Text style={[styles.tabText, activeTab === 'map' && styles.tabTextActive]}>تتبع الباص</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'lostAndFound' && styles.tabActive]} 
          onPress={() => setActiveTab('lostAndFound')}
        >
          <Text style={[styles.tabText, activeTab === 'lostAndFound' && styles.tabTextActive]}>المفقودات الذكية</Text>
          {(stats.foundCount > 0 || stats.myLostCount > 0) && (
            <View style={[styles.tabBadge, { backgroundColor: stats.foundCount > 0 ? '#10B981' : '#EF4444' }]}>
              <Text style={styles.tabBadgeText}>{stats.foundCount || stats.myLostCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'map' ? (
        <View style={{ flex: 1 }}>
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
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 100 }}>
            {/* قسم المعثورات في باص ابني */}
            <Text style={styles.sectionTitle}>✨ أغراض معثور عليها في باص ابنك</Text>
            {foundItems.length > 0 ? (
              foundItems.map(item => (
                <LostAndFoundItemCard 
                  key={item.id}
                  item={item}
                  userRole="parent"
                  isClaimable={true}
                  onClaim={() => handleClaimItem(item)}
                  onConfirmReceipt={() => handleConfirmReceipt(item)}
                />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>لا توجد معثورات حالياً في باص ابنك.</Text>
              </View>
            )}

            {/* قسم بلاغاتي عن مفقودات */}
            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>🚨 بلاغاتك عن مفقودات</Text>
              {myLostReports.length > 0 ? (
                myLostReports.map(item => (
                  <LostAndFoundItemCard 
                    key={item.id}
                    item={item}
                    userRole="parent"
                    onConfirmReceipt={() => handleConfirmReceipt(item)}
                  />
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>لم تقم بالتبليغ عن أي مفقودات حالياً.</Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* زر التبليغ عن مفقود */}
          <TouchableOpacity 
            style={styles.fab} 
            onPress={() => setShowReportLostModal(true)}
          >
            <Text style={styles.fabIcon}>🚨</Text>
            <Text style={styles.fabText}>تبليغ عن مفقود</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* مودال التبليغ عن مفقود */}
      <Modal visible={showReportLostModal} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReportLostModal(false)}>
              <Text style={styles.closeModalText}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>التبليغ عن غرض مفقود</Text>
            <View style={{ width: 40 }} />
          </View>
          
          <ScrollView>
            <ReportLostItemForm 
              formData={lostItemData}
              onFormChange={(field, value) => {
                if (field === 'student') {
                  setLostItemData({ ...lostItemData, studentId: value.id, studentName: value.name, busId: value.busId });
                } else {
                  setLostItemData({ ...lostItemData, [field]: value });
                }
              }}
              onImagePick={pickImage}
              onSubmit={handleReportLostItem}
              loading={uploading}
              students={studentInfo ? [studentInfo] : []} // في حال كان لولي الأمر أكثر من طالب يمكن تعديل هذا
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
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
  studentNameText: { fontSize: 13, color: '#64748B' },
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
  tabBadge: { marginLeft: 6, backgroundColor: '#10B981', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  tabBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  infoPanel: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 5 },
  infoRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  infoItem: { alignItems: 'center', flex: 1 },
  infoLabel: { fontSize: 12, color: '#64748B', marginBottom: 5 },
  infoValue: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  callText: { color: '#3B82F6', fontSize: 12, marginTop: 5, fontWeight: 'bold' },

  // المفقودات
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B', marginBottom: 12, textAlign: 'right' },
  emptyCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1' },
  emptyCardText: { color: '#94A3B8', fontSize: 13 },
  fab: { 
    position: 'absolute', 
    bottom: 20, 
    right: 20, 
    backgroundColor: '#EF4444', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  fabIcon: { fontSize: 18, marginRight: 8 },
  fabText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  // المودال
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0' 
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  closeModalText: { color: '#64748B', fontSize: 14 },
});
