import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  TextInput,
  Image,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

// استيراد الخدمات
import { clearUserSession } from '../../../services/sessionService';
import { 
  subscribeToStaffStudents, 
  updateStudentAttendance, 
  getParentPhone 
} from '../services/staffAttendanceService';
import { subscribeToSchoolInfo, subscribeToSchoolData } from '../../school/services/schoolDataService';
import { 
  addFoundItem, 
  uploadLostItemImage, 
  subscribeLostAndFoundItems, 
  resolveLostAndFoundItem 
} from '../../lostAndFound/services/lostAndFoundService';
import { LostAndFoundItemCard, AddFoundItemForm } from '../../lostAndFound/components/LostAndFoundComponents';

export default function StaffScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { schoolId, user } = route.params || {};
  
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' or 'lostAndFound'
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socialLinks, setSocialLinks] = useState(null);
  
  // ميزات المفقودات
  const [lostAndFoundItems, setLostAndFoundItems] = useState([]);
  const [showAddFoundModal, setShowAddFoundModal] = useState(false);
  const [foundItemData, setFoundItemData] = useState({ itemName: '', itemDescription: '', busId: user?.driverUsername || '' });
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const driverId = user?.driverUsername || user?.driver_id;
    
    // الاشتراك في بيانات الطلاب للتحضير
    const unsubscribeStudents = subscribeToStaffStudents(schoolId, driverId, (list) => {
      setStudents(list);
      setLoading(false);
    });

    // الاشتراك في معلومات المدرسة
    const unsubSchool = subscribeToSchoolInfo(schoolId, (data) => {
      if (data) setSocialLinks(data.socialLinks || null);
    });

    // الاشتراك في المفقودات والمعثورات
    const unsubscribeLostAndFound = subscribeLostAndFoundItems(schoolId, (items) => {
      // تصفية العناصر لتظهر للمرافقة ما يخص باصها أو بلاغات الأهل المفتوحة
      const filtered = items.filter(item => 
        item.busId === driverId || (item.type === 'lost' && item.status === 'active')
      ).sort((a, b) => new Date(b.foundAt || b.reportedAt) - new Date(a.foundAt || a.reportedAt));
      setLostAndFoundItems(filtered);
    });

    // الاشتراك في قائمة السائقين (لاختيار الباص عند إضافة معثور عليه)
    const unsubscribeDrivers = subscribeToSchoolData(schoolId, 'drivers', setDrivers);

    return () => {
      unsubscribeStudents();
      unsubSchool();
      unsubscribeLostAndFound();
      unsubscribeDrivers();
    };
  }, [schoolId, user]);

  const toggleStatus = async (student, currentStatus) => {
    if (user?.permissions?.markAttendance === false) {
      Alert.alert('صلاحية مرفوضة', 'ليس لديك صلاحية تسجيل الحضور');
      return;
    }
    try {
      await updateStudentAttendance(schoolId, student.id, currentStatus, user);
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء تحديث حالة الطالب');
    }
  };

  const callParent = (parentUsername) => {
    if (!parentUsername) {
      Alert.alert('خطأ', 'رقم ولي الأمر غير متوفر');
      return;
    }
    getParentPhone(schoolId, parentUsername, (phone) => {
      if (phone) {
        Linking.openURL(`tel:${phone}`);
      } else {
        Alert.alert('خطأ', 'رقم ولي الأمر غير متوفر');
      }
    });
  };

  const handleLogout = () => {
    Alert.alert("تسجيل الخروج", "هل أنت متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "خروج", style: "destructive", onPress: async () => {
        try {
          await clearUserSession();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        } catch (error) {
          Alert.alert('خطأ', 'فشل تسجيل الخروج');
        }
      }}
    ]);
  };

  // ميزات المفقودات والمعثورات
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
      setFoundItemData({ ...foundItemData, itemImageURL: result.assets[0].uri });
    }
  };

  const handleAddFoundItem = async () => {
    if (!foundItemData.itemName || !foundItemData.busId) {
      Alert.alert('تنبيه', 'يرجى كتابة اسم العنصر واختيار الباص');
      return;
    }

    setUploading(true);
    try {
      const itemData = {
        ...foundItemData,
        foundBy: user.username,
        foundByName: user.name,
      };

      const itemId = await addFoundItem(schoolId, itemData);

      if (selectedImage) {
        const imageURL = await uploadLostItemImage(schoolId, itemId, selectedImage);
        // تحديث العنصر برابط الصورة
        await addFoundItem(schoolId, { ...itemData, itemImageURL: imageURL }, itemId);
      }

      Alert.alert('تم بنجاح', 'تم إضافة العنصر المعثور عليه ونشر الإعلان للأهل');
      setShowAddFoundModal(false);
      setFoundItemData({ itemName: '', itemDescription: '', busId: user?.driverUsername || '' });
      setSelectedImage(null);
    } catch (error) {
      Alert.alert('خطأ', 'فشل إضافة العنصر');
    } finally {
      setUploading(false);
    }
  };

  const handleResolveItem = (item) => {
    Alert.alert(
      'تأكيد الحل',
      `هل تم تسليم "${item.itemName}" لولي الأمر؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { 
          text: 'نعم، تم التسليم', 
          onPress: async () => {
            try {
              await resolveLostAndFoundItem(schoolId, item.id, user.username);
              Alert.alert('تم', 'تم تحديث حالة العنصر بنجاح');
            } catch (e) {
              Alert.alert('خطأ', 'فشل تحديث الحالة');
            }
          }
        }
      ]
    );
  };

  const stats = useMemo(() => {
    return {
      present: students.filter(s => s.status === 'present').length,
      total: students.length,
      activeLostFound: lostAndFoundItems.filter(i => i.status === 'active').length
    };
  }, [students, lostAndFoundItems]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* الترويسة المحسنة */}
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
          <Text style={styles.title}>لوحة المرافقة 📝</Text>
          <Text style={styles.staffName}>{user?.name}</Text>
        </View>
      </View>

      {/* التبويبات */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'attendance' && styles.tabActive]} 
          onPress={() => setActiveTab('attendance')}
        >
          <Text style={[styles.tabText, activeTab === 'attendance' && styles.tabTextActive]}>الحضور والغياب</Text>
          {stats.total > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{stats.present}/{stats.total}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'lostAndFound' && styles.tabActive]} 
          onPress={() => setActiveTab('lostAndFound')}
        >
          <Text style={[styles.tabText, activeTab === 'lostAndFound' && styles.tabTextActive]}>المفقودات الذكية</Text>
          {stats.activeLostFound > 0 && <View style={[styles.tabBadge, { backgroundColor: '#EF4444' }]}><Text style={styles.tabBadgeText}>{stats.activeLostFound}</Text></View>}
        </TouchableOpacity>
      </View>

      {activeTab === 'attendance' ? (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 15 }}
          renderItem={({ item }) => (
            <View style={styles.studentCard}>
              <TouchableOpacity style={styles.callBtn} onPress={() => callParent(item.parentUsername || item.parent_username)}>
                <Text style={styles.callBtnText}>📞 اتصل</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statusToggle, { backgroundColor: item.status === 'present' ? '#10B981' : '#F1F5F9' }]}
                onPress={() => toggleStatus(item, item.status)}
              >
                <Text style={[styles.statusToggleText, { color: item.status === 'present' ? '#FFF' : '#64748B' }]}>
                  {item.status === 'present' ? 'تم الركوب ✓' : 'تحضير'}
                </Text>
              </TouchableOpacity>

              <View style={styles.studentInfo}>
                <Text style={styles.studentNameText}>{item.name}</Text>
                <Text style={styles.studentSub}>{item.class} - {item.section}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>لا يوجد طلاب للتحضير حالياً</Text>}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={lostAndFoundItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <LostAndFoundItemCard 
                item={item} 
                userRole="staff" 
                onResolve={() => handleResolveItem(item)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={{ fontSize: 50, marginBottom: 10 }}>🔍</Text>
                <Text style={styles.emptyText}>لا توجد مفقودات أو بلاغات حالياً</Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                  عند العثور على غرض في الباص، قم بإضافته هنا ليظهر للأهل فوراً
                </Text>
              </View>
            }
          />
          
          {/* زر إضافة معثور عليه */}
          <TouchableOpacity 
            style={styles.fab} 
            onPress={() => setShowAddFoundModal(true)}
          >
            <Text style={styles.fabIcon}>➕</Text>
            <Text style={styles.fabText}>إضافة معثور عليه</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* مودال إضافة معثور عليه */}
      <Modal visible={showAddFoundModal} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddFoundModal(false)}>
              <Text style={styles.closeModalText}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>إضافة غرض معثور عليه</Text>
            <View style={{ width: 40 }} />
          </View>
          
          <ScrollView>
            <AddFoundItemForm 
              formData={foundItemData}
              onFormChange={(field, value) => setFoundItemData({ ...foundItemData, [field]: value })}
              onImagePick={pickImage}
              onSubmit={handleAddFoundItem}
              loading={uploading}
              drivers={drivers}
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
  headerRight: { alignItems: 'flex-end' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  staffName: { fontSize: 14, color: '#64748B' },
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
  
  // بطاقة الطالب
  studentCard: { 
    backgroundColor: '#FFF', 
    padding: 12, 
    borderRadius: 12, 
    marginBottom: 10, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  studentInfo: { alignItems: 'flex-end', flex: 1, marginRight: 10 },
  studentNameText: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  studentSub: { fontSize: 11, color: '#64748B' },
  statusToggle: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, minWidth: 85, alignItems: 'center', marginRight: 10 },
  statusToggleText: { fontSize: 11, fontWeight: 'bold' },
  callBtn: { backgroundColor: '#3B82F6', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  callBtnText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  
  // المفقودات
  fab: { 
    position: 'absolute', 
    bottom: 20, 
    right: 20, 
    backgroundColor: '#10B981', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#10B981',
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
  
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', color: '#64748B', fontSize: 14, fontWeight: '600' }
});
