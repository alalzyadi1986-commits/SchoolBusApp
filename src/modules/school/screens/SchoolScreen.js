import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  StatusBar,
  Modal,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

// استيراد الخدمات والمسارات
import { clearUserSession } from '../../../services/sessionService';
import {
  subscribeToSchoolData,
  subscribeToSchoolInfo,
  saveSchoolItem,
  deleteSchoolItem
} from '../services/schoolDataService';
import { SchoolDataItem } from '../components/SchoolComponents';
import { exportToExcel, exportToPDF } from '../services/exportService';

const { width } = Dimensions.get('window');

export default function SchoolScreen({ route, navigation }) {
  const { schoolId, user } = route.params || {};
  
  // تحديد دور المستخدم والصلاحيات
  const isMainAdmin = user?.role === 'schoolAdmin';
  const isSubManager = user?.role === 'subManager';
  const userPermissions = useMemo(() => user?.permissions || {}, [user]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [expiryDate, setExpiryDate] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [schoolLimits, setSchoolLimits] = useState({ maxBuses: 3, maxStudents: 50 });
  const [schoolLogo, setSchoolLogo] = useState('');
  const [dynamicSchoolName, setDynamicSchoolName] = useState('');

  const [drivers, setDrivers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [reports, setReports] = useState([]);
  const [managers, setManagers] = useState([]);
  const [adminMessages, setAdminMessages] = useState([]);

  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [communicationTab, setCommunicationTab] = useState('announcements');
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [broadcastContent, setBroadcastContent] = useState('');

  // تعريف الصلاحيات المتاحة
  const AVAILABLE_PERMISSIONS = [
    { id: 'manage_staff', label: 'إدارة الموظفين والمرافقات' },
    { id: 'manage_students', label: 'إدارة الطلاب وأولياء الأمور' },
    { id: 'send_broadcasts', label: 'إرسال رسائل جماعية' },
    { id: 'view_reports', label: 'مشاهدة التقارير' },
    { id: 'handle_emergencies', label: 'استقبال حالات الطوارئ' },
    { id: 'view_complaints', label: 'استقبال الشكاوي' },
    { id: 'view_buses', label: 'مشاهدة الباصات' },
    { id: 'view_active_trips', label: 'مشاهدة الرحلات النشطة' },
    { id: 'edit_items', label: 'تعديل العناصر' },
    { id: 'delete_items', label: 'حذف العناصر' }
  ];

  useEffect(() => {
    if (!schoolId || !user) {
      setLoading(false);
      navigation.replace('Login');
      return;
    }

    const schoolUnsub = subscribeToSchoolInfo(schoolId, (data) => {
      if (data) {
        setDynamicSchoolName(data.displayName || data.name || '');
        setExpiryDate(data.endDate || '');
        setIsExpired(new Date(data.endDate) < new Date());
        setSchoolLogo(data.logoUrl || '');
        if (data.limits) setSchoolLimits(data.limits);
      }
    });

    const unsubs = [
      subscribeToSchoolData(schoolId, 'drivers', setDrivers),
      subscribeToSchoolData(schoolId, 'staff', setStaff),
      subscribeToSchoolData(schoolId, 'parents', setParents),
      subscribeToSchoolData(schoolId, 'students', setStudents),
      subscribeToSchoolData(schoolId, 'emergencies', setEmergencies),
      subscribeToSchoolData(schoolId, 'reports', setReports),
      subscribeToSchoolData(schoolId, 'managers', setManagers),
      subscribeToSchoolData(schoolId, 'messages', (msgs) => {
        const sorted = msgs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setAdminMessages(sorted);
      })
    ];

    setLoading(false);
    return () => {
      schoolUnsub();
      unsubs.forEach(u => u());
    };
  }, [schoolId, user]);

  const canViewTab = (tabId) => {
    if (isMainAdmin) return true;
    if (isSubManager) {
      if (tabId === 'drivers' || tabId === 'managers') return false;
      if (tabId === 'staff') return !!userPermissions?.manage_staff;
      if (tabId === 'parents' || tabId === 'students') return !!userPermissions?.manage_students;
      if (tabId === 'reports') return !!userPermissions?.view_reports;
      if (tabId === 'emergencies') return !!userPermissions?.handle_emergencies;
      return false;
    }
    return false;
  };

  const handleAction = async (action, item = null) => {
    if (isExpired && action !== 'delete') {
      Alert.alert('تنبيه', 'يرجى تجديد الاشتراك للمتابعة');
      return;
    }

    if (action === 'delete' && item) {
      Alert.alert('حذف', 'هل أنت متأكد من حذف هذا العنصر؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: async () => {
          try {
            await deleteSchoolItem(schoolId, activeTab, item.id);
          } catch (e) { Alert.alert('خطأ', 'فشل الحذف'); }
        }},
      ]);
    } else if (action === 'save') {
      if (!formData.username || !formData.name) {
        Alert.alert('خطأ', 'يرجى تعبئة الحقول الأساسية');
        return;
      }
      try {
        await saveSchoolItem(schoolId, activeTab, editingId, formData);
        setShowForm(false);
        setFormData({});
        setEditingId(null);
        Alert.alert('تم', 'تم حفظ البيانات بنجاح');
      } catch (error) {
        Alert.alert('خطأ', 'حدث خطأ أثناء الحفظ');
      }
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastContent.trim()) return;
    try {
      const broadcastData = {
        id: Date.now(),
        sender: user.name || 'مدير المدرسة',
        content: broadcastContent,
        timestamp: new Date().toISOString(),
        type: 'school_broadcast',
        target: broadcastTarget
      };
      await saveSchoolItem(schoolId, 'school_announcements', null, broadcastData);
      Alert.alert('نجاح', 'تم إرسال الإعلان');
      setBroadcastContent('');
    } catch (e) { Alert.alert('خطأ', 'فشل الإرسال'); }
  };

  const handleLogout = async () => {
    Alert.alert("خروج", "هل تريد تسجيل الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "خروج", onPress: async () => { await clearUserSession(); navigation.replace('Login'); } }
    ]);
  };

  const stats = useMemo(() => ({
    buses: drivers.length,
    students: students.length,
    staff: staff.length,
    parents: parents.length,
    emergencies: emergencies.filter(e => !e.resolved).length,
    activeTrips: drivers.filter(d => d.isOnline).length,
  }), [drivers, students, staff, parents, emergencies]);

  const filteredData = useMemo(() => {
    const list = { drivers, staff, parents, students, managers, reports, emergencies }[activeTab] || [];
    return list.filter(item => (item.name || item.username || '').toLowerCase().includes(searchQuery.toLowerCase()));
  }, [activeTab, drivers, staff, parents, students, managers, reports, emergencies, searchQuery]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  const TABS = [
    { id: 'dashboard', label: 'الرئيسية', icon: 'view-dashboard' },
    { id: 'drivers', label: 'السائقين', icon: 'steering' },
    { id: 'students', label: 'الطلاب', icon: 'account-multiple' },
    { id: 'staff', label: 'المرافقات', icon: 'human-greeting' },
    { id: 'communication', label: 'التواصل', icon: 'message-text' },
    { id: 'emergencies', label: 'الطوارئ', icon: 'alert-circle' },
  ].filter(tab => tab.id === 'dashboard' || tab.id === 'communication' || canViewTab(tab.id));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer?.()}>
          <MaterialCommunityIcons name="menu" size={28} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{dynamicSchoolName}</Text>
          <Text style={styles.headerSubtitle}>مدير المدرسة</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={26} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
        {activeTab === 'dashboard' ? (
          <View style={styles.dashboard}>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
                <MaterialCommunityIcons name="bus" size={32} color="#3B82F6" />
                <Text style={styles.statNum}>{stats.buses}</Text>
                <Text style={styles.statLab}>حافلة</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
                <MaterialCommunityIcons name="account-group" size={32} color="#10B981" />
                <Text style={styles.statNum}>{stats.students}</Text>
                <Text style={styles.statLab}>طالب</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#FFF7ED' }]}>
                <MaterialCommunityIcons name="human-female" size={32} color="#F59E0B" />
                <Text style={styles.statNum}>{stats.staff}</Text>
                <Text style={styles.statLab}>مرافقة</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#FEF2F2' }]}>
                <MaterialCommunityIcons name="alert-decagram" size={32} color="#EF4444" />
                <Text style={styles.statNum}>{stats.emergencies}</Text>
                <Text style={styles.statLab}>طوارئ</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => { setActiveTab('drivers'); setShowForm(true); }}>
                <MaterialCommunityIcons name="plus-box" size={30} color="#3B82F6" />
                <Text style={styles.actionText}>سائق جديد</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => { setActiveTab('students'); setShowForm(true); }}>
                <MaterialCommunityIcons name="account-plus" size={30} color="#10B981" />
                <Text style={styles.actionText}>طالب جديد</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setActiveTab('communication')}>
                <MaterialCommunityIcons name="bullhorn" size={30} color="#F59E0B" />
                <Text style={styles.actionText}>إعلان عام</Text>
              </TouchableOpacity>
            </View>

            {/* Subscription Info */}
            <View style={styles.subCard}>
              <View style={styles.subHeader}>
                <MaterialCommunityIcons name="shield-check" size={24} color="#3B82F6" />
                <Text style={styles.subTitle}>حالة الاشتراك</Text>
              </View>
              <View style={styles.subInfo}>
                <Text style={styles.subText}>الباقة: {schoolLimits.maxBuses} حافلة</Text>
                <Text style={styles.subText}>تاريخ الانتهاء: {new Date(expiryDate).toLocaleDateString('ar-EG')}</Text>
              </View>
              {isExpired && <Text style={styles.expiredAlert}>⚠️ الاشتراك منتهي الصلاحية</Text>}
            </View>
          </View>
        ) : (
          <View style={styles.dataSection}>
            <View style={styles.searchBar}>
              <MaterialCommunityIcons name="magnify" size={24} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="بحث سريع..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity style={styles.addCircle} onPress={() => { setFormData({}); setEditingId(null); setShowForm(true); }}>
                <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {activeTab === 'communication' ? (
              <View style={styles.commSection}>
                <Text style={styles.sectionTitle}>إرسال إعلان جماعي</Text>
                <View style={styles.targetList}>
                  {['all', 'drivers', 'parents', 'staff'].map(t => (
                    <TouchableOpacity key={t} style={[styles.targetChip, broadcastTarget === t && styles.targetChipActive]} onPress={() => setBroadcastTarget(t)}>
                      <Text style={[styles.targetLabel, broadcastTarget === t && styles.targetLabelActive]}>
                        {t === 'all' ? 'الكل' : t === 'drivers' ? 'سائقين' : t === 'parents' ? 'أهالي' : 'مرافقات'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.bigInput}
                  placeholder="اكتب نص الإعلان هنا..."
                  multiline
                  value={broadcastContent}
                  onChangeText={setBroadcastContent}
                />
                <TouchableOpacity style={styles.sendFullBtn} onPress={handleSendBroadcast}>
                  <Text style={styles.sendFullText}>إرسال الإعلان الآن</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={filteredData}
                keyExtractor={(item) => item.id || item.username}
                renderItem={({ item }) => (
                  <SchoolDataItem
                    item={item}
                    onEdit={() => { setFormData(item); setEditingId(item.id); setShowForm(true); }}
                    onDelete={() => handleAction('delete', item)}
                  />
                )}
                scrollEnabled={false}
                ListEmptyComponent={<Text style={styles.empty}>لا توجد بيانات متاحة</Text>}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Tabs */}
      <View style={styles.bottomNav}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.id} style={styles.navItem} onPress={() => setActiveTab(tab.id)}>
            <MaterialCommunityIcons name={tab.icon} size={24} color={activeTab === tab.id ? '#3B82F6' : '#94A3B8'} />
            <Text style={[styles.navText, activeTab === tab.id && styles.navTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Modal Form */}
      <Modal visible={showForm} animationType="slide">
        <SafeAreaView style={styles.modalBody}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}><MaterialCommunityIcons name="close" size={28} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{editingId ? 'تعديل البيانات' : 'إضافة جديد'}</Text>
            <TouchableOpacity onPress={() => handleAction('save')}><Text style={styles.saveTxt}>حفظ</Text></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalForm}>
            <View style={styles.inputBox}>
              <Text style={styles.label}>الاسم الكامل</Text>
              <TextInput style={styles.input} value={formData.name} onChangeText={t => setFormData({...formData, name: t})} />
            </View>
            <View style={styles.inputBox}>
              <Text style={styles.label}>اسم المستخدم</Text>
              <TextInput style={styles.input} value={formData.username} onChangeText={t => setFormData({...formData, username: t})} editable={!editingId} />
            </View>
            {['drivers', 'staff', 'parents'].includes(activeTab) && (
              <View style={styles.inputBox}>
                <Text style={styles.label}>رقم الجوال</Text>
                <TextInput style={styles.input} value={formData.phone} onChangeText={t => setFormData({...formData, phone: t})} keyboardType="phone-pad" />
              </View>
            )}
            {activeTab === 'drivers' && (
              <View style={styles.inputBox}>
                <Text style={styles.label}>رقم الحافلة</Text>
                <TextInput style={styles.input} value={formData.busNumber} onChangeText={t => setFormData({...formData, busNumber: t})} />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitleContainer: { alignItems: 'flex-end' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  headerSubtitle: { fontSize: 12, color: '#64748B' },
  mainScroll: { flex: 1 },
  dashboard: { padding: 16 },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  statCard: { width: (width - 44) / 2, padding: 16, borderRadius: 16, alignItems: 'center', elevation: 2 },
  statNum: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginVertical: 4 },
  statLab: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 24, marginBottom: 12, textAlign: 'right' },
  actionsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  actionBtn: { flex: 1, backgroundColor: '#FFF', padding: 12, borderRadius: 12, alignItems: 'center', elevation: 2 },
  actionText: { fontSize: 11, fontWeight: '700', color: '#1E293B', marginTop: 6 },
  subCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginTop: 20, borderRightWidth: 5, borderRightColor: '#3B82F6', elevation: 2 },
  subHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
  subTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginRight: 8 },
  subInfo: { alignItems: 'flex-end' },
  subText: { fontSize: 13, color: '#475569', marginBottom: 4 },
  expiredAlert: { color: '#EF4444', fontWeight: '700', marginTop: 8, textAlign: 'right' },
  dataSection: { padding: 16 },
  searchBar: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, elevation: 2 },
  searchInput: { flex: 1, paddingVertical: 10, textAlign: 'right', fontSize: 14 },
  addCircle: { backgroundColor: '#3B82F6', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 40 },
  commSection: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, elevation: 2 },
  targetList: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  targetChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  targetChipActive: { backgroundColor: '#3B82F6' },
  targetLabel: { fontSize: 12, color: '#64748B' },
  targetLabelActive: { color: '#FFF', fontWeight: '700' },
  bigInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, textAlign: 'right', height: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0' },
  sendFullBtn: { backgroundColor: '#10B981', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  sendFullText: { color: '#FFF', fontWeight: '800' },
  bottomNav: { flexDirection: 'row-reverse', backgroundColor: '#FFF', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  navItem: { flex: 1, alignItems: 'center' },
  navText: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
  navTextActive: { color: '#3B82F6', fontWeight: '700' },
  modalBody: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  saveTxt: { color: '#3B82F6', fontWeight: '800', fontSize: 16 },
  modalForm: { padding: 16 },
  inputBox: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, textAlign: 'right' },
  input: { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, textAlign: 'right' }
});
