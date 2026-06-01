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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

// استيراد خدمات ومكونات المفقودات
import { 
  subscribeLostAndFoundItems, 
  deleteLostAndFoundItem, 
  resolveLostAndFoundItem 
} from '../../lostAndFound/services/lostAndFoundService';
import { LostAndFoundItemCard } from '../../lostAndFound/components/LostAndFoundComponents';

export default function SchoolScreen({ route, navigation }) {
  const { schoolId, user } = route.params || {};
  const insets = useSafeAreaInsets();
  
  // تحديد دور المستخدم والصلاحيات
  const isMainAdmin = user?.role === 'schoolAdmin';
  const isSubManager = user?.role === 'subManager';
  const userPermissions = useMemo(() => user?.permissions || {}, [user]);

  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [expiryDate, setExpiryDate] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [schoolLimits, setSchoolLimits] = useState({ maxBuses: 3, maxStudents: 50 });
  const [schoolLogo, setSchoolLogo] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [socialLinks, setSocialLinks] = useState({ facebook: '', instagram: '' });
  const [showSocialModal, setShowSocialModal] = useState(false);

  const [drivers, setDrivers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [reports, setReports] = useState([]);
  const [managers, setManagers] = useState([]);
  const [adminMessages, setAdminMessages] = useState([]);
  const [lostAndFoundItems, setLostAndFoundItems] = useState([]);

  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [dynamicSchoolName, setDynamicSchoolName] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [communicationTab, setCommunicationTab] = useState('announcements');
  
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [selectedMsgs, setSelectedMsgs] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [broadcastContent, setBroadcastContent] = useState('');

  // تعريف الصلاحيات المتاحة
  const AVAILABLE_PERMISSIONS = [
    { id: 'manage_staff', label: 'إدارة الموظفين والمرافقات' },
    { id: 'manage_students', label: 'إدارة الطلاب وأولياء الأمور' },
    { id: 'manage_lost_found', label: 'إدارة المفقودات والمعثورات' },
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
        if (data.location) setCurrentLocation(data.location);
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
      subscribeToSchoolData(schoolId, 'messages', (msgs) => {
        const sorted = msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setAdminMessages(sorted);
      }),
      subscribeLostAndFoundItems(schoolId, (items) => {
        setLostAndFoundItems(items.sort((a, b) => new Date(b.foundAt || b.reportedAt) - new Date(a.foundAt || a.reportedAt)));
      })
    ];

    // تحديد التبويب الافتراضي
    if (isSubManager) {
      const availableTabs = [
        { id: 'staff', perm: 'manage_staff' },
        { id: 'students', perm: 'manage_students' },
        { id: 'lostAndFound', perm: 'manage_lost_found' },
        { id: 'reports', perm: 'view_reports' },
        { id: 'emergencies', perm: 'handle_emergencies' }
      ];
      const firstTab = availableTabs.find(t => userPermissions[t.perm])?.id || 'students';
      setActiveTab(firstTab);
    } else {
      setActiveTab('drivers');
    }

    setLoading(false);
    return () => {
      schoolUnsub();
      unsubs.forEach(u => u());
    };
  }, [schoolId, isSubManager, userPermissions]);

  // مراقبة حالات الطوارئ الجديدة
  useEffect(() => {
    const activeEmergencies = emergencies.filter(e => !e.resolved);
    if (activeEmergencies.length > 0) {
      const latest = activeEmergencies[activeEmergencies.length - 1];
      if (isMainAdmin || userPermissions.handle_emergencies) {
        Alert.alert(
          '⚠️ حالة طوارئ نشطة',
          `تنبيه من: ${latest.driverName || 'سائق'}\nالنوع: ${latest.type}\nيرجى مراجعة تبويب الطوارئ فوراً.`,
          [{ text: 'مشاهدة الآن', onPress: () => setActiveTab('emergencies') }, { text: 'حسناً' }]
        );
      }
    }
  }, [emergencies.length]);

  const canViewTab = (tabId) => {
    if (isMainAdmin) return true;
    if (isSubManager) {
      if (tabId === 'drivers' || tabId === 'managers') return false;
      if (tabId === 'staff') return !!userPermissions?.manage_staff;
      if (tabId === 'parents' || tabId === 'students') return !!userPermissions?.manage_students;
      if (tabId === 'reports') return !!userPermissions?.view_reports;
      if (tabId === 'emergencies') return !!userPermissions?.handle_emergencies;
      if (tabId === 'lostAndFound') return !!userPermissions?.manage_lost_found;
      return false;
    }
    return false;
  };

  const handleAction = async (action, item = null) => {
    if (isExpired && action !== 'delete' && action !== 'save_social') {
      Alert.alert('تنبيه', 'يرجى تجديد الاشتراك للمتابعة');
      return;
    }

    if (action === 'save_social') {
      try {
        setLoading(true);
        await saveSchoolItem(schoolId, 'info', 'socialLinks', socialLinks);
        setShowSocialModal(false);
        Alert.alert('نجاح', 'تم حفظ روابط التواصل بنجاح');
      } catch (e) { Alert.alert('خطأ', 'فشل حفظ الروابط'); }
      finally { setLoading(false); }
      return;
    }

    if (action === 'delete' && item) {
      Alert.alert('حذف', 'هل أنت متأكد؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: async () => {
          try { await deleteSchoolItem(schoolId, activeTab, item.id); }
          catch (e) { Alert.alert('خطأ', 'فشل الحذف'); }
        }}
      ]);
    } else if (action === 'save') {
      if (!formData.username || !formData.name) {
        Alert.alert('خطأ', 'يرجى تعبئة الحقول الأساسية');
        return;
      }
      try {
        await saveSchoolItem(schoolId, activeTab, editingId, formData);
        setFormData({}); setEditingId(null); setShowForm(false);
        Alert.alert('تم', 'تم الحفظ بنجاح');
      } catch (e) { Alert.alert('خطأ', 'فشل الحفظ'); }
    }
  };

  const handleResolveLostItem = (item) => {
    Alert.alert('تأكيد الحل', `هل تم حل موضوع "${item.itemName}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'نعم، تم الحل', onPress: async () => {
        try { await resolveLostAndFoundItem(schoolId, item.id, user.username); }
        catch (e) { Alert.alert('خطأ', 'فشل التحديث'); }
      }}
    ]);
  };

  const handleDeleteLostItem = (item) => {
    Alert.alert('حذف', 'هل أنت متأكد من حذف هذا العنصر؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { await deleteLostAndFoundItem(schoolId, item.id); }
        catch (e) { Alert.alert('خطأ', 'فشل الحذف'); }
      }}
    ]);
  };

  const handleSendBroadcast = async () => {
    if (!broadcastContent.trim()) return;
    try {
      setLoading(true);
      const data = { id: Date.now(), sender: user.name, content: broadcastContent, timestamp: new Date().toISOString(), target: broadcastTarget };
      await saveSchoolItem(schoolId, 'school_announcements', null, data);
      setShowBroadcastModal(false); setBroadcastContent('');
      Alert.alert('نجاح', 'تم إرسال الإعلان');
    } catch (e) { Alert.alert('خطأ', 'فشل الإرسال'); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    Alert.alert("خروج", "هل تريد الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "خروج", onPress: async () => { await clearUserSession(); navigation.replace('Login'); } }
    ]);
  };

  const currentData = useMemo(() => {
    const map = { drivers, staff, parents, students, managers, reports, emergencies, lostAndFound: lostAndFoundItems };
    const list = map[activeTab] || [];
    return list.filter(item => 
      (item.name || item.itemName)?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeTab, drivers, staff, parents, students, managers, reports, emergencies, lostAndFoundItems, searchQuery]);

  const stats = useMemo(() => ({
    buses: drivers.length, students: students.length, staff: staff.length,
    emergencies: emergencies.filter(e => !e.resolved).length,
    activeTrips: drivers.filter(d => d.isOnline).length,
    lostItems: lostAndFoundItems.filter(i => i.status === 'active').length
  }), [drivers, students, staff, emergencies, lostAndFoundItems]);

  const renderReports = () => (
    <ScrollView style={{ padding: 15 }}>
      <View style={styles.reportCard}>
        <Text style={styles.reportCardTitle}>📊 إحصائيات المدرسة</Text>
        <View style={styles.reportGrid}>
          <View style={styles.reportItem}><Text style={styles.reportItemValue}>{stats.students}</Text><Text style={styles.reportItemLabel}>طلاب</Text></View>
          <View style={styles.reportItem}><Text style={styles.reportItemValue}>{stats.buses}</Text><Text style={styles.reportItemLabel}>باصات</Text></View>
          <View style={styles.reportItem}><Text style={[styles.reportItemValue, { color: '#EF4444' }]}>{stats.emergencies}</Text><Text style={styles.reportItemLabel}>طوارئ</Text></View>
        </View>
      </View>
      <View style={[styles.reportCard, { marginTop: 12 }]}>
        <Text style={styles.reportCardTitle}>🚍 الرحلات النشطة ({stats.activeTrips})</Text>
        {drivers.filter(d => d.isOnline).map(d => (
          <View key={d.id} style={styles.tripItem}>
            <Text style={styles.tripName}>{d.name}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity style={styles.topBarIcon} onPress={() => setShowMsgModal(true)}><Text style={styles.topBarIconText}>💬</Text></TouchableOpacity>
          <TouchableOpacity style={styles.topBarIcon} onPress={() => setShowProfileModal(true)}><Text style={styles.topBarIconText}>⚙️</Text></TouchableOpacity>
        </View>
        <View style={styles.topBarRight}>
          <View style={styles.schoolInfo}>
            <Text style={styles.welcomeText}>مرحباً، {user?.name?.split(' ')[0]}</Text>
            <Text style={styles.schoolNameText}>{dynamicSchoolName}</Text>
          </View>
          {schoolLogo ? <Image source={{ uri: schoolLogo }} style={styles.schoolLogo} /> : <View style={styles.schoolLogoPlaceholder}><Text>🏫</Text></View>}
        </View>
      </View>

      <ScrollView style={styles.mainContent}>
        <View style={styles.statsSection}>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { borderTopColor: '#3B82F6' }]}><Text style={styles.statIcon}>🚌</Text><Text style={styles.statValue}>{stats.buses}</Text><Text style={styles.statLabel}>باصات</Text></View>
            <View style={[styles.statCard, { borderTopColor: '#10B981' }]}><Text style={styles.statIcon}>🎓</Text><Text style={styles.statValue}>{stats.students}</Text><Text style={styles.statLabel}>طلاب</Text></View>
            <TouchableOpacity style={[styles.statCard, { borderTopColor: '#EF4444' }]} onPress={() => setActiveTab('emergencies')}><Text style={styles.statIcon}>🚨</Text><Text style={styles.statValue}>{stats.emergencies}</Text><Text style={styles.statLabel}>طوارئ</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.quickActionsSection}>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={() => setActiveTab('lostAndFound')}><Text style={styles.actionIcon}>🎒</Text><Text style={styles.actionLabel}>المفقودات</Text></TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => setShowBroadcastModal(true)}><Text style={styles.actionIcon}>📢</Text><Text style={styles.actionLabel}>إعلان</Text></TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => setShowExportModal(true)}><Text style={styles.actionIcon}>📥</Text><Text style={styles.actionLabel}>تصدير</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <TextInput style={styles.searchInput} placeholder="بحث..." value={searchQuery} onChangeText={setSearchQuery} />
            <Text>🔍</Text>
          </View>
        </View>

        <View style={styles.tabsSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
            {['drivers', 'lostAndFound', 'staff', 'parents', 'students', 'reports'].filter(canViewTab).map(tab => (
              <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab === 'lostAndFound' ? 'المفقودات' : tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.dataSection}>
          {activeTab === 'reports' ? renderReports() : (
            <FlatList
              data={currentData}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                activeTab === 'lostAndFound' ? (
                  <LostAndFoundItemCard item={item} userRole="admin" onResolve={() => handleResolveLostItem(item)} onDelete={() => handleDeleteLostItem(item)} />
                ) : (
                  <SchoolDataItem item={item} activeTab={activeTab} onEdit={() => { setFormData(item); setEditingId(item.id); setShowForm(true); }} onDelete={() => handleAction('delete', item)} isMainAdmin={isMainAdmin} userPermissions={userPermissions} />
                )
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>لا توجد بيانات</Text>}
            />
          )}
        </View>
      </ScrollView>

      {isMainAdmin && activeTab !== 'reports' && activeTab !== 'lostAndFound' && (
        <TouchableOpacity style={styles.addButton} onPress={() => { setFormData({}); setEditingId(null); setShowForm(true); }}><Text style={styles.addButtonText}>+</Text></TouchableOpacity>
      )}

      {/* Modal implementations for showForm, showBroadcastModal, etc. */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  topBarLeft: { flexDirection: 'row', gap: 8 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topBarIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  topBarIconText: { fontSize: 18 },
  schoolInfo: { alignItems: 'flex-end' },
  welcomeText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  schoolNameText: { fontSize: 12, color: '#64748B', marginTop: 2 },
  schoolLogo: { width: 45, height: 45, borderRadius: 22.5 },
  schoolLogoPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  mainContent: { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
  statsSection: { marginBottom: 20 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  statCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 12, alignItems: 'center', borderTopWidth: 3, elevation: 1 },
  statIcon: { fontSize: 24, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 4 },
  quickActionsSection: { marginBottom: 20 },
  quickActionsGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  actionCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 12, alignItems: 'center', elevation: 1 },
  actionIcon: { fontSize: 24, marginBottom: 6 },
  actionLabel: { fontSize: 11, color: '#1E293B', fontWeight: '600' },
  searchSection: { marginBottom: 16 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E2E8F0', height: 44 },
  searchInput: { flex: 1, fontSize: 14, textAlign: 'right' },
  tabsSection: { marginBottom: 16 },
  tabsContainer: { gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9' },
  tabActive: { backgroundColor: '#3B82F6' },
  tabText: { fontSize: 12, color: '#64748B' },
  tabTextActive: { color: '#FFF' },
  dataSection: { marginBottom: 20 },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 30 },
  addButton: { position: 'absolute', bottom: 30, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  addButtonText: { fontSize: 28, color: '#FFF' },
  reportCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, elevation: 1 },
  reportCardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  reportGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  reportItem: { alignItems: 'center' },
  reportItemValue: { fontSize: 18, fontWeight: '700' },
  reportItemLabel: { fontSize: 11, color: '#64748B' },
  tripItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tripName: { fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  targetContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  targetBtn: { padding: 8, borderRadius: 8, backgroundColor: '#F1F5F9' },
  targetBtnActive: { backgroundColor: '#3B82F6' },
  targetText: { fontSize: 12 },
  targetTextActive: { color: '#FFF' },
  msgInput: { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, height: 100, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  sendBtn: { backgroundColor: '#10B981' },
  closeBtn: { backgroundColor: '#94A3B8' },
  modalBtnText: { color: '#FFF' },
});
