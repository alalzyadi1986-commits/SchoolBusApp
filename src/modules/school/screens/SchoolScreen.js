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
  const [socialLinks, setSocialLinks] = useState({ facebook: '', instagram: '' });
  const [showSocialModal, setShowSocialModal] = useState(false);

  const [drivers, setDrivers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [reports, setReports] = useState([]);
  const [managers, setManagers] = useState([]);
  const [activeTrips, setActiveTrips] = useState([]);

  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [dynamicSchoolName, setDynamicSchoolName] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

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
        if (data.socialLinks) setSocialLinks(data.socialLinks);
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
      subscribeToSchoolData(schoolId, 'trips', (trips) => {
        const active = Object.values(trips || {}).filter(t => t.status === 'active');
        setActiveTrips(active);
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
      setShowBroadcastModal(false);
    } catch (e) { Alert.alert('خطأ', 'فشل الإرسال'); }
  };

  const handleSaveSocialLinks = async () => {
    try {
      await saveSchoolItem(schoolId, 'info', 'socialLinks', socialLinks);
      setShowSocialModal(false);
      Alert.alert('نجاح', 'تم حفظ روابط التواصل');
    } catch (e) { Alert.alert('خطأ', 'فشل الحفظ'); }
  };

  const handleLogout = async () => {
    Alert.alert("خروج", "هل تريد تسجيل الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "خروج", onPress: async () => { await clearUserSession(); navigation.replace('Login'); } }
    ]);
  };

  const handleExport = (format) => {
    const dataToExport = {
      drivers, staff, parents, students, emergencies, reports
    }[activeTab] || drivers;
    
    const typeLabel = {
      drivers: 'السائقين',
      staff: 'المرافقات',
      parents: 'أولياء الأمور',
      students: 'الطلاب',
      emergencies: 'الطوارئ',
      reports: 'التقارير'
    }[activeTab] || 'بيانات عامة';

    if (format === 'excel') {
      exportToExcel(dataToExport, typeLabel, dynamicSchoolName, user.name);
    } else {
      exportToPDF(dataToExport, typeLabel, dynamicSchoolName, user.name);
    }
    setShowExportModal(false);
  };

  const stats = useMemo(() => ({
    buses: drivers.length,
    students: students.length,
    staff: staff.length,
    parents: parents.length,
    emergencies: emergencies.filter(e => !e.resolved).length,
    activeTrips: activeTrips.length,
  }), [drivers, students, staff, parents, emergencies, activeTrips]);

  const filteredData = useMemo(() => {
    const list = { drivers, staff, parents, students, managers, reports, emergencies, trips: activeTrips }[activeTab] || [];
    return list.filter(item => (item.name || item.username || '').toLowerCase().includes(searchQuery.toLowerCase()));
  }, [activeTab, drivers, staff, parents, students, managers, reports, emergencies, activeTrips, searchQuery]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  const TABS = [
    { id: 'dashboard', label: 'الرئيسية', icon: 'view-dashboard' },
    { id: 'drivers', label: 'السائقين', icon: 'steering' },
    { id: 'students', label: 'الطلاب', icon: 'account-multiple' },
    { id: 'staff', label: 'المرافقات', icon: 'human-greeting' },
    { id: 'trips', label: 'الرحلات', icon: 'map-marker-radius' },
    { id: 'communication', label: 'التواصل', icon: 'message-text' },
    { id: 'emergencies', label: 'الطوارئ', icon: 'alert-circle' },
  ].filter(tab => tab.id === 'dashboard' || tab.id === 'communication' || tab.id === 'trips' || canViewTab(tab.id));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header - Right Aligned Logo and Name */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogout} style={styles.headerIcon}>
          <MaterialCommunityIcons name="logout" size={24} color="#EF4444" />
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.schoolNameText}>{dynamicSchoolName || 'مدرستي'}</Text>
            <Text style={styles.headerRoleText}>مدير المدرسة</Text>
          </View>
          {schoolLogo ? (
            <Image source={{ uri: schoolLogo }} style={styles.headerLogo} />
          ) : (
            <View style={styles.headerLogoPlaceholder}>
              <MaterialCommunityIcons name="school" size={24} color="#3B82F6" />
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'dashboard' ? (
          <View style={styles.dashboard}>
            {/* Compact Stats Grid */}
            <View style={styles.compactStatsGrid}>
              <View style={[styles.compactStatCard, { borderRightColor: '#3B82F6' }]}>
                <MaterialCommunityIcons name="bus" size={20} color="#3B82F6" />
                <Text style={styles.compactStatNum}>{stats.buses}</Text>
                <Text style={styles.compactStatLab}>حافلة</Text>
              </View>
              <View style={[styles.compactStatCard, { borderRightColor: '#10B981' }]}>
                <MaterialCommunityIcons name="account-group" size={20} color="#10B981" />
                <Text style={styles.compactStatNum}>{stats.students}</Text>
                <Text style={styles.compactStatLab}>طالب</Text>
              </View>
              <View style={[styles.compactStatCard, { borderRightColor: '#F59E0B' }]}>
                <MaterialCommunityIcons name="human-female" size={20} color="#F59E0B" />
                <Text style={styles.compactStatNum}>{stats.staff}</Text>
                <Text style={styles.compactStatLab}>مرافقة</Text>
              </View>
              <View style={[styles.compactStatCard, { borderRightColor: '#EF4444' }]}>
                <MaterialCommunityIcons name="alert-decagram" size={20} color="#EF4444" />
                <Text style={styles.compactStatNum}>{stats.emergencies}</Text>
                <Text style={styles.compactStatLab}>طوارئ</Text>
              </View>
              <View style={[styles.compactStatCard, { borderRightColor: '#8B5CF6' }]}>
                <MaterialCommunityIcons name="map-marker-radius" size={20} color="#8B5CF6" />
                <Text style={styles.compactStatNum}>{stats.activeTrips}</Text>
                <Text style={styles.compactStatLab}>نشط</Text>
              </View>
              <View style={[styles.compactStatCard, { borderRightColor: '#64748B' }]}>
                <MaterialCommunityIcons name="account-tie" size={20} color="#64748B" />
                <Text style={styles.compactStatNum}>{stats.parents}</Text>
                <Text style={styles.compactStatLab}>ولي أمر</Text>
              </View>
            </View>

            {/* Actions Row */}
            <View style={styles.quickActionsRow}>
              <TouchableOpacity style={styles.quickActionBtn} onPress={() => { setActiveTab('drivers'); setShowForm(true); }}>
                <MaterialCommunityIcons name="plus-box" size={24} color="#3B82F6" />
                <Text style={styles.quickActionText}>سائق</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickActionBtn} onPress={() => { setActiveTab('students'); setShowForm(true); }}>
                <MaterialCommunityIcons name="account-plus" size={24} color="#10B981" />
                <Text style={styles.quickActionText}>طالب</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowBroadcastModal(true)}>
                <MaterialCommunityIcons name="bullhorn" size={24} color="#F59E0B" />
                <Text style={styles.quickActionText}>إعلان</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowExportModal(true)}>
                <MaterialCommunityIcons name="download" size={24} color="#8B5CF6" />
                <Text style={styles.quickActionText}>تصدير</Text>
              </TouchableOpacity>
            </View>

            {/* Social & Subscription Row */}
            <View style={styles.infoRow}>
              <TouchableOpacity style={styles.infoBox} onPress={() => setShowSocialModal(true)}>
                <View style={styles.infoBoxHeader}>
                  <MaterialCommunityIcons name="share-variant" size={20} color="#8B5CF6" />
                  <Text style={styles.infoBoxTitle}>التواصل</Text>
                </View>
                <View style={styles.socialIconsSmall}>
                  <MaterialCommunityIcons name="facebook" size={18} color={socialLinks.facebook ? "#1877F2" : "#CBD5E1"} />
                  <MaterialCommunityIcons name="instagram" size={18} color={socialLinks.instagram ? "#E4405F" : "#CBD5E1"} />
                </View>
              </TouchableOpacity>

              <View style={[styles.infoBox, { borderRightColor: isExpired ? '#EF4444' : '#3B82F6' }]}>
                <View style={styles.infoBoxHeader}>
                  <MaterialCommunityIcons name="shield-check" size={20} color={isExpired ? '#EF4444' : '#3B82F6'} />
                  <Text style={styles.infoBoxTitle}>الاشتراك</Text>
                </View>
                <Text style={styles.infoBoxSub}>{new Date(expiryDate).toLocaleDateString('ar-EG')}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.listContainer}>
            <View style={styles.listHeader}>
              <TouchableOpacity style={styles.listAddBtn} onPress={() => { setFormData({}); setEditingId(null); setShowForm(true); }}>
                <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.listSearchContainer}>
                <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
                <TextInput
                  style={styles.listSearchInput}
                  placeholder="بحث..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

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
              ListEmptyComponent={<Text style={styles.emptyText}>لا توجد بيانات</Text>}
            />
          </View>
        )}
      </ScrollView>

      {/* Bottom Tabs */}
      <View style={styles.bottomTabs}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.id} style={styles.tabItem} onPress={() => setActiveTab(tab.id)}>
            <MaterialCommunityIcons name={tab.icon} size={22} color={activeTab === tab.id ? '#3B82F6' : '#94A3B8'} />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Modals */}
      <Modal visible={showForm} animationType="slide">
        <SafeAreaView style={styles.modalFull}>
          <View style={styles.modalHeaderFixed}>
            <TouchableOpacity onPress={() => setShowForm(false)}><MaterialCommunityIcons name="close" size={24} /></TouchableOpacity>
            <Text style={styles.modalTitleText}>{editingId ? 'تعديل' : 'إضافة'}</Text>
            <TouchableOpacity onPress={() => handleAction('save')}><Text style={styles.modalSaveText}>حفظ</Text></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalFormContent}>
            <View style={styles.formInputGroup}>
              <Text style={styles.formLabel}>الاسم الكامل</Text>
              <TextInput style={styles.formInput} value={formData.name} onChangeText={t => setFormData({...formData, name: t})} placeholder="أدخل الاسم..." />
            </View>
            <View style={styles.formInputGroup}>
              <Text style={styles.formLabel}>اسم المستخدم</Text>
              <TextInput style={styles.formInput} value={formData.username} onChangeText={t => setFormData({...formData, username: t})} editable={!editingId} placeholder="اسم الدخول..." />
            </View>
            {['drivers', 'staff', 'parents'].includes(activeTab) && (
              <View style={styles.formInputGroup}>
                <Text style={styles.formLabel}>رقم الجوال</Text>
                <TextInput style={styles.formInput} value={formData.phone} onChangeText={t => setFormData({...formData, phone: t})} keyboardType="phone-pad" placeholder="05xxxxxxxx" />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showExportModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>تصدير البيانات</Text>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => handleExport('excel')}>
              <MaterialCommunityIcons name="file-excel-box" size={24} color="#10B981" />
              <Text style={styles.sheetBtnText}>تصدير ملف Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => handleExport('pdf')}>
              <MaterialCommunityIcons name="file-pdf-box" size={24} color="#EF4444" />
              <Text style={styles.sheetBtnText}>تصدير ملف PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setShowExportModal(false)}>
              <Text style={styles.sheetCancelText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSocialModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.centerModal}>
            <Text style={styles.modalTitleText}>روابط التواصل</Text>
            <TextInput style={styles.formInput} placeholder="رابط Facebook" value={socialLinks.facebook} onChangeText={t => setSocialLinks({...socialLinks, facebook: t})} />
            <TextInput style={[styles.formInput, { marginTop: 12 }]} placeholder="رابط Instagram" value={socialLinks.instagram} onChangeText={t => setSocialLinks({...socialLinks, instagram: t})} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalActionBtn} onPress={() => setShowSocialModal(false)}><Text>إلغاء</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#3B82F6' }]} onPress={handleSaveSocialLinks}><Text style={{ color: '#FFF' }}>حفظ</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showBroadcastModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.centerModal}>
            <Text style={styles.modalTitleText}>إرسال إعلان</Text>
            <View style={styles.targetRow}>
              {['all', 'drivers', 'parents'].map(t => (
                <TouchableOpacity key={t} style={[styles.targetChip, broadcastTarget === t && styles.targetChipActive]} onPress={() => setBroadcastTarget(t)}>
                  <Text style={[styles.targetChipText, broadcastTarget === t && { color: '#FFF' }]}>{t === 'all' ? 'الكل' : t === 'drivers' ? 'سائقين' : 'أهالي'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.broadcastInput} multiline placeholder="نص الإعلان..." value={broadcastContent} onChangeText={setBroadcastContent} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalActionBtn} onPress={() => setShowBroadcastModal(false)}><Text>إلغاء</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#F59E0B' }]} onPress={handleSendBroadcast}><Text style={{ color: '#FFF' }}>إرسال</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header - Right Aligned
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTextContainer: { alignItems: 'flex-end' },
  schoolNameText: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  headerRoleText: { fontSize: 11, color: '#64748B' },
  headerLogo: { width: 44, height: 44, borderRadius: 22 },
  headerLogoPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DBEAFE' },
  headerIcon: { padding: 4 },

  content: { flex: 1 },
  dashboard: { padding: 12 },
  
  // Compact Stats
  compactStatsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  compactStatCard: { width: (width - 40) / 3, backgroundColor: '#FFF', padding: 10, borderRadius: 12, alignItems: 'center', borderRightWidth: 3, elevation: 2 },
  compactStatNum: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginVertical: 2 },
  compactStatLab: { fontSize: 10, color: '#64748B', fontWeight: '600' },

  // Quick Actions
  quickActionsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 16, gap: 8 },
  quickActionBtn: { flex: 1, backgroundColor: '#FFF', paddingVertical: 12, borderRadius: 12, alignItems: 'center', elevation: 2 },
  quickActionText: { fontSize: 11, fontWeight: '700', color: '#1E293B', marginTop: 4 },

  // Info Row
  infoRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 },
  infoBox: { flex: 1, backgroundColor: '#FFF', padding: 12, borderRadius: 12, elevation: 2, borderRightWidth: 3, borderRightColor: '#8B5CF6' },
  infoBoxHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoBoxTitle: { fontSize: 12, fontWeight: '700', color: '#1E293B' },
  socialIconsSmall: { flexDirection: 'row-reverse', gap: 8 },
  infoBoxSub: { fontSize: 11, color: '#64748B', textAlign: 'right' },

  // List View
  listContainer: { padding: 12 },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  listSearchContainer: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 10, elevation: 1 },
  listSearchInput: { flex: 1, paddingVertical: 8, textAlign: 'right', fontSize: 13 },
  listAddBtn: { backgroundColor: '#3B82F6', width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 40 },

  // Bottom Tabs
  bottomTabs: { flexDirection: 'row-reverse', backgroundColor: '#FFF', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  tabItem: { flex: 1, alignItems: 'center' },
  tabText: { fontSize: 9, color: '#94A3B8', marginTop: 2 },
  tabTextActive: { color: '#3B82F6', fontWeight: '700' },

  // Modals
  modalFull: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeaderFixed: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitleText: { fontSize: 16, fontWeight: '700' },
  modalSaveText: { color: '#3B82F6', fontWeight: '800' },
  modalFormContent: { padding: 16 },
  formInputGroup: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, textAlign: 'right' },
  formInput: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, textAlign: 'right', borderWidth: 1, borderColor: '#E2E8F0' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  centerModal: { width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 20 },
  modalActions: { flexDirection: 'row-reverse', gap: 10, marginTop: 20 },
  modalActionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#F1F5F9' },
  
  bottomSheet: { width: '100%', backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, position: 'absolute', bottom: 0 },
  sheetTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  sheetBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sheetBtnText: { fontSize: 14, fontWeight: '600' },
  sheetCancel: { marginTop: 10, paddingVertical: 14, alignItems: 'center' },
  sheetCancelText: { color: '#EF4444', fontWeight: '700' },

  targetRow: { flexDirection: 'row-reverse', gap: 8, marginVertical: 12 },
  targetChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, backgroundColor: '#F1F5F9' },
  targetChipActive: { backgroundColor: '#F59E0B' },
  targetChipText: { fontSize: 11, color: '#64748B' },
  broadcastInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, textAlign: 'right', height: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0' }
});
