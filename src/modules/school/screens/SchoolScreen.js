import React, { useState, useEffect, useMemo } from 'react';
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
  const [socialLinks, setSocialLinks] = useState({ facebook: '', instagram: '' });

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
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [broadcastContent, setBroadcastContent] = useState('');

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
      Alert.alert('تنبيه', 'يرجى تجديد الاشتراك');
      return;
    }

    if (action === 'delete' && item) {
      Alert.alert('حذف', 'هل أنت متأكد؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: async () => {
          try {
            await deleteSchoolItem(schoolId, activeTab, item.id);
          } catch (e) { Alert.alert('خطأ', 'فشل الحذف'); }
        }},
      ]);
    } else if (action === 'save') {
      if (!formData.username || !formData.name) {
        Alert.alert('خطأ', 'يرجى تعبئة الحقول المطلوبة');
        return;
      }
      try {
        await saveSchoolItem(schoolId, activeTab, editingId, formData);
        setShowForm(false);
        setFormData({});
        setEditingId(null);
      } catch (error) {
        Alert.alert('خطأ', 'حدث خطأ');
      }
    }
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
    }[activeTab] || 'بيانات';

    if (format === 'excel') {
      exportToExcel(dataToExport, typeLabel, dynamicSchoolName, user.name);
    } else {
      exportToPDF(dataToExport, typeLabel, dynamicSchoolName, user.name);
    }
    setShowExportModal(false);
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
      Alert.alert('نجاح', 'تم حفظ الروابط');
    } catch (e) { Alert.alert('خطأ', 'فشل الحفظ'); }
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={22} color="#EF4444" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.schoolName}>{dynamicSchoolName || 'مدرستي'}</Text>
          <Text style={styles.schoolRole}>لوحة التحكم</Text>
        </View>

        {schoolLogo ? (
          <Image source={{ uri: schoolLogo }} style={styles.schoolLogo} />
        ) : (
          <View style={styles.schoolLogoBg}>
            <MaterialCommunityIcons name="school" size={20} color="#3B82F6" />
          </View>
        )}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'dashboard' ? (
          <View style={styles.dashboardContent}>
            {/* Stats Section */}
            <View style={styles.statsSection}>
              <Text style={styles.sectionTitle}>الإحصائيات</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.buses}</Text>
                  <Text style={styles.statLabel}>حافلة</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.students}</Text>
                  <Text style={styles.statLabel}>طالب</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.staff}</Text>
                  <Text style={styles.statLabel}>مرافقة</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.activeTrips}</Text>
                  <Text style={styles.statLabel}>رحلة نشطة</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.emergencies}</Text>
                  <Text style={styles.statLabel}>طوارئ</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.parents}</Text>
                  <Text style={styles.statLabel}>ولي أمر</Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsSection}>
              <Text style={styles.sectionTitle}>الإجراءات</Text>
              <TouchableOpacity style={styles.actionItem} onPress={() => { setActiveTab('drivers'); setShowForm(true); }}>
                <MaterialCommunityIcons name="plus-circle" size={24} color="#3B82F6" />
                <Text style={styles.actionText}>إضافة سائق</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem} onPress={() => { setActiveTab('students'); setShowForm(true); }}>
                <MaterialCommunityIcons name="plus-circle" size={24} color="#10B981" />
                <Text style={styles.actionText}>إضافة طالب</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem} onPress={() => setShowBroadcastModal(true)}>
                <MaterialCommunityIcons name="bullhorn" size={24} color="#F59E0B" />
                <Text style={styles.actionText}>إرسال إعلان</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionItem} onPress={() => setShowExportModal(true)}>
                <MaterialCommunityIcons name="download-box" size={24} color="#8B5CF6" />
                <Text style={styles.actionText}>تصدير البيانات</Text>
              </TouchableOpacity>
            </View>

            {/* Info Cards */}
            <View style={styles.infoSection}>
              <TouchableOpacity style={styles.infoCard} onPress={() => setShowSocialModal(true)}>
                <View style={styles.infoCardHeader}>
                  <MaterialCommunityIcons name="share-variant" size={20} color="#8B5CF6" />
                  <Text style={styles.infoCardTitle}>التواصل الاجتماعي</Text>
                </View>
                <View style={styles.socialIcons}>
                  <MaterialCommunityIcons name="facebook" size={16} color={socialLinks.facebook ? "#1877F2" : "#CBD5E1"} />
                  <MaterialCommunityIcons name="instagram" size={16} color={socialLinks.instagram ? "#E4405F" : "#CBD5E1"} />
                </View>
              </TouchableOpacity>

              <View style={styles.infoCard}>
                <View style={styles.infoCardHeader}>
                  <MaterialCommunityIcons name="calendar-check" size={20} color={isExpired ? '#EF4444' : '#3B82F6'} />
                  <Text style={styles.infoCardTitle}>الاشتراك</Text>
                </View>
                <Text style={[styles.infoCardValue, isExpired && { color: '#EF4444' }]}>
                  {new Date(expiryDate).toLocaleDateString('ar-EG')}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.listContent}>
            <View style={styles.listTopBar}>
              <TouchableOpacity style={styles.addBtn} onPress={() => { setFormData({}); setEditingId(null); setShowForm(true); }}>
                <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.searchBox}>
                <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
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
              ListEmptyComponent={<Text style={styles.emptyMessage}>لا توجد بيانات</Text>}
            />
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.id} style={styles.navTab} onPress={() => setActiveTab(tab.id)}>
            <MaterialCommunityIcons name={tab.icon} size={20} color={activeTab === tab.id ? '#3B82F6' : '#CBD5E1'} />
            <Text style={[styles.navLabel, activeTab === tab.id && styles.navLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Form Modal */}
      <Modal visible={showForm} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingId ? 'تعديل' : 'إضافة'}</Text>
            <TouchableOpacity onPress={() => handleAction('save')}>
              <Text style={styles.modalSave}>حفظ</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>الاسم الكامل</Text>
              <TextInput style={styles.formField} value={formData.name} onChangeText={t => setFormData({...formData, name: t})} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>اسم المستخدم</Text>
              <TextInput style={styles.formField} value={formData.username} onChangeText={t => setFormData({...formData, username: t})} editable={!editingId} />
            </View>
            {['drivers', 'staff', 'parents'].includes(activeTab) && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>رقم الجوال</Text>
                <TextInput style={styles.formField} value={formData.phone} onChangeText={t => setFormData({...formData, phone: t})} keyboardType="phone-pad" />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Export Modal */}
      <Modal visible={showExportModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>تصدير البيانات</Text>
            <TouchableOpacity style={styles.sheetOption} onPress={() => handleExport('excel')}>
              <MaterialCommunityIcons name="file-excel-box" size={24} color="#10B981" />
              <Text style={styles.sheetOptionText}>Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetOption} onPress={() => handleExport('pdf')}>
              <MaterialCommunityIcons name="file-pdf-box" size={24} color="#EF4444" />
              <Text style={styles.sheetOptionText}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetClose} onPress={() => setShowExportModal(false)}>
              <Text style={styles.sheetCloseText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Social Links Modal */}
      <Modal visible={showSocialModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.centerSheet}>
            <Text style={styles.sheetTitle}>روابط التواصل</Text>
            <TextInput style={styles.formField} placeholder="Facebook" value={socialLinks.facebook} onChangeText={t => setSocialLinks({...socialLinks, facebook: t})} />
            <TextInput style={[styles.formField, { marginTop: 12 }]} placeholder="Instagram" value={socialLinks.instagram} onChangeText={t => setSocialLinks({...socialLinks, instagram: t})} />
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetActionBtn} onPress={() => setShowSocialModal(false)}>
                <Text>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetActionBtn, { backgroundColor: '#3B82F6' }]} onPress={handleSaveSocialLinks}>
                <Text style={{ color: '#FFF' }}>حفظ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Broadcast Modal */}
      <Modal visible={showBroadcastModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.centerSheet}>
            <Text style={styles.sheetTitle}>إرسال إعلان</Text>
            <View style={styles.targetButtons}>
              {['all', 'drivers', 'parents'].map(t => (
                <TouchableOpacity key={t} style={[styles.targetBtn, broadcastTarget === t && styles.targetBtnActive]} onPress={() => setBroadcastTarget(t)}>
                  <Text style={[styles.targetBtnText, broadcastTarget === t && { color: '#FFF' }]}>
                    {t === 'all' ? 'الكل' : t === 'drivers' ? 'سائقين' : 'أهالي'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[styles.formField, { height: 100, textAlignVertical: 'top' }]} multiline placeholder="النص..." value={broadcastContent} onChangeText={setBroadcastContent} />
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetActionBtn} onPress={() => setShowBroadcastModal(false)}>
                <Text>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetActionBtn, { backgroundColor: '#F59E0B' }]} onPress={handleSendBroadcast}>
                <Text style={{ color: '#FFF' }}>إرسال</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerContent: { flex: 1, alignItems: 'flex-end', marginHorizontal: 12 },
  schoolName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  schoolRole: { fontSize: 12, color: '#64748B', marginTop: 2 },
  schoolLogo: { width: 40, height: 40, borderRadius: 20 },
  schoolLogoBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },

  scrollView: { flex: 1 },

  // Dashboard
  dashboardContent: { padding: 16 },
  statsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 12, textAlign: 'right' },
  statsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  statItem: { flex: 1, backgroundColor: '#FFFFFF', paddingVertical: 16, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#3B82F6', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },

  actionsSection: { marginBottom: 24 },
  actionItem: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  actionText: { fontSize: 13, fontWeight: '600', color: '#1E293B', marginRight: 12 },

  infoSection: { gap: 12 },
  infoCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  infoCardHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8 },
  infoCardTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B', marginRight: 8 },
  socialIcons: { flexDirection: 'row-reverse', gap: 12 },
  infoCardValue: { fontSize: 12, color: '#64748B', textAlign: 'right' },

  // List
  listContent: { padding: 16 },
  listTopBar: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 16 },
  searchBox: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, paddingVertical: 10, textAlign: 'right', fontSize: 13 },
  addBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  emptyMessage: { textAlign: 'center', color: '#94A3B8', marginTop: 40 },

  // Bottom Nav
  bottomNav: { flexDirection: 'row-reverse', backgroundColor: '#FFFFFF', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  navTab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  navLabel: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
  navLabelActive: { color: '#3B82F6', fontWeight: '700' },

  // Modals
  modal: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  modalSave: { color: '#3B82F6', fontWeight: '700', fontSize: 14 },
  modalBody: { padding: 16 },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8, textAlign: 'right' },
  formField: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0', textAlign: 'right', fontSize: 13 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingVertical: 20 },
  centerSheet: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginHorizontal: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 16, textAlign: 'center' },
  sheetOption: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  sheetOptionText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  sheetClose: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  sheetCloseText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
  sheetActions: { flexDirection: 'row-reverse', gap: 10, marginTop: 16 },
  sheetActionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#F1F5F9' },

  targetButtons: { flexDirection: 'row-reverse', gap: 8, marginBottom: 16 },
  targetBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center' },
  targetBtnActive: { backgroundColor: '#F59E0B' },
  targetBtnText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
});
