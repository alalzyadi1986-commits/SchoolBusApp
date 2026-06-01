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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const [selectedMessageForReply, setSelectedMessageForReply] = useState(null);
  const [activeTrips, setActiveTrips] = useState([]);

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
        const sorted = msgs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setAdminMessages(sorted);
      }),
      subscribeToSchoolData(schoolId, 'trips', (trips) => {
        const active = Object.values(trips || {}).filter(t => t.status === 'active');
        setActiveTrips(active);
      })
    ];

    // تحديد التبويب الافتراضي
    if (isSubManager) {
      const availableTabs = [
        { id: 'staff', perm: 'manage_staff' },
        { id: 'students', perm: 'manage_students' },
        { id: 'reports', perm: 'view_reports' },
        { id: 'emergencies', perm: 'handle_emergencies' }
      ];
      const firstTab = availableTabs.find(t => userPermissions[t.perm])?.id || 'students';
      setActiveTab(firstTab);
    } else {
      setActiveTab('dashboard');
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

  // فحص الصلاحيات للتبويبات
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
            Alert.alert('تم', 'تم حذف العنصر بنجاح');
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
      setShowBroadcastModal(false);
    } catch (e) { Alert.alert('خطأ', 'فشل الإرسال'); }
  };

  const handleSaveSocialLinks = async () => {
    try {
      setLoading(true);
      await saveSchoolItem(schoolId, 'info', 'socialLinks', socialLinks);
      setShowSocialModal(false);
      Alert.alert('نجاح', 'تم حفظ روابط التواصل');
    } catch (e) { Alert.alert('خطأ', 'فشل الحفظ'); }
    finally { setLoading(false); }
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
      <StatusBar barStyle="dark-content" />
      
      {/* ==================== الرأس (Header) مع الشعار واسم المدرسة ==================== */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer?.()}>
          <MaterialCommunityIcons name="menu" size={28} color="#1E293B" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          {schoolLogo ? (
            <Image source={{ uri: schoolLogo }} style={styles.schoolLogo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <MaterialCommunityIcons name="school" size={32} color="#3B82F6" />
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.schoolName}>{dynamicSchoolName}</Text>
            <Text style={styles.headerSubtitle}>لوحة تحكم المدرسة</Text>
          </View>
        </View>
        
        <TouchableOpacity onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={26} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* ==================== المحتوى الرئيسي ==================== */}
      <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
        {activeTab === 'dashboard' ? (
          <View style={styles.dashboard}>
            {/* الإحصائيات */}
            <Text style={styles.sectionTitle}>📊 الإحصائيات العامة</Text>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: '#EFF6FF', borderLeftColor: '#3B82F6' }]}>
                <MaterialCommunityIcons name="bus" size={32} color="#3B82F6" />
                <Text style={styles.statNum}>{stats.buses}</Text>
                <Text style={styles.statLab}>حافلة</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#F0FDF4', borderLeftColor: '#10B981' }]}>
                <MaterialCommunityIcons name="account-group" size={32} color="#10B981" />
                <Text style={styles.statNum}>{stats.students}</Text>
                <Text style={styles.statLab}>طالب</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#FFF7ED', borderLeftColor: '#F59E0B' }]}>
                <MaterialCommunityIcons name="human-female" size={32} color="#F59E0B" />
                <Text style={styles.statNum}>{stats.staff}</Text>
                <Text style={styles.statLab}>مرافقة</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#FEF2F2', borderLeftColor: '#EF4444' }]}>
                <MaterialCommunityIcons name="alert-decagram" size={32} color="#EF4444" />
                <Text style={styles.statNum}>{stats.emergencies}</Text>
                <Text style={styles.statLab}>طوارئ</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#F3E8FF', borderLeftColor: '#8B5CF6' }]}>
                <MaterialCommunityIcons name="map-marker-radius" size={32} color="#8B5CF6" />
                <Text style={styles.statNum}>{stats.activeTrips}</Text>
                <Text style={styles.statLab}>رحلة نشطة</Text>
              </View>
            </View>

            {/* الإجراءات السريعة */}
            <Text style={styles.sectionTitle}>⚡ إجراءات سريعة</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => { setActiveTab('drivers'); setShowForm(true); }}>
                <MaterialCommunityIcons name="plus-box" size={32} color="#3B82F6" />
                <Text style={styles.actionText}>سائق جديد</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => { setActiveTab('students'); setShowForm(true); }}>
                <MaterialCommunityIcons name="account-plus" size={32} color="#10B981" />
                <Text style={styles.actionText}>طالب جديد</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowBroadcastModal(true)}>
                <MaterialCommunityIcons name="bullhorn" size={32} color="#F59E0B" />
                <Text style={styles.actionText}>إعلان عام</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowExportModal(true)}>
                <MaterialCommunityIcons name="download" size={32} color="#8B5CF6" />
                <Text style={styles.actionText}>تصدير البيانات</Text>
              </TouchableOpacity>
            </View>

            {/* معلومات الاشتراك */}
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

            {/* روابط التواصل الاجتماعي */}
            <TouchableOpacity style={styles.socialCard} onPress={() => setShowSocialModal(true)}>
              <View style={styles.socialHeader}>
                <MaterialCommunityIcons name="share-social" size={24} color="#3B82F6" />
                <Text style={styles.socialTitle}>روابط التواصل الاجتماعي</Text>
              </View>
              <View style={styles.socialLinks}>
                {socialLinks.facebook && (
                  <TouchableOpacity onPress={() => Linking.openURL(socialLinks.facebook)}>
                    <MaterialCommunityIcons name="facebook" size={24} color="#1877F2" />
                  </TouchableOpacity>
                )}
                {socialLinks.instagram && (
                  <TouchableOpacity onPress={() => Linking.openURL(socialLinks.instagram)}>
                    <MaterialCommunityIcons name="instagram" size={24} color="#E4405F" />
                  </TouchableOpacity>
                )}
                <MaterialCommunityIcons name="pencil" size={20} color="#64748B" />
              </View>
            </TouchableOpacity>
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
              {activeTab !== 'emergencies' && activeTab !== 'trips' && (
                <TouchableOpacity style={styles.addCircle} onPress={() => { setFormData({}); setEditingId(null); setShowForm(true); }}>
                  <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>

            {activeTab === 'communication' ? (
              <View style={styles.commSection}>
                <Text style={styles.sectionTitle}>📢 إرسال إعلان جماعي</Text>
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

      {/* ==================== التبويبات السفلية ==================== */}
      <View style={styles.bottomNav}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.id} style={styles.navItem} onPress={() => setActiveTab(tab.id)}>
            <MaterialCommunityIcons name={tab.icon} size={24} color={activeTab === tab.id ? '#3B82F6' : '#94A3B8'} />
            <Text style={[styles.navText, activeTab === tab.id && styles.navTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ==================== نموذج الإضافة/التعديل ==================== */}
      <Modal visible={showForm} animationType="slide">
        <SafeAreaView style={styles.modalBody}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}><MaterialCommunityIcons name="close" size={28} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{editingId ? 'تعديل البيانات' : 'إضافة جديد'}</Text>
            <TouchableOpacity onPress={() => handleAction('save')}><Text style={styles.saveTxt}>حفظ</Text></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalForm}>
            <View style={styles.inputBox}>
              <Text style={styles.label}>الاسم الكامل *</Text>
              <TextInput style={styles.input} value={formData.name} onChangeText={t => setFormData({...formData, name: t})} />
            </View>
            <View style={styles.inputBox}>
              <Text style={styles.label}>اسم المستخدم *</Text>
              <TextInput style={styles.input} value={formData.username} onChangeText={t => setFormData({...formData, username: t})} editable={!editingId} />
            </View>
            {['drivers', 'staff', 'parents'].includes(activeTab) && (
              <View style={styles.inputBox}>
                <Text style={styles.label}>رقم الجوال</Text>
                <TextInput style={styles.input} value={formData.phone} onChangeText={t => setFormData({...formData, phone: t})} keyboardType="phone-pad" />
              </View>
            )}
            {activeTab === 'drivers' && (
              <>
                <View style={styles.inputBox}>
                  <Text style={styles.label}>رقم الحافلة</Text>
                  <TextInput style={styles.input} value={formData.busNumber} onChangeText={t => setFormData({...formData, busNumber: t})} />
                </View>
                <View style={styles.inputBox}>
                  <Text style={styles.label}>رقم الرخصة</Text>
                  <TextInput style={styles.input} value={formData.licenseNumber} onChangeText={t => setFormData({...formData, licenseNumber: t})} />
                </View>
              </>
            )}
            {activeTab === 'students' && (
              <>
                <View style={styles.inputBox}>
                  <Text style={styles.label}>الصف</Text>
                  <TextInput style={styles.input} value={formData.class} onChangeText={t => setFormData({...formData, class: t})} />
                </View>
                <View style={styles.inputBox}>
                  <Text style={styles.label}>ولي الأمر</Text>
                  <TextInput style={styles.input} value={formData.parentName} onChangeText={t => setFormData({...formData, parentName: t})} />
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ==================== نموذج التصدير ==================== */}
      <Modal visible={showExportModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.exportModal}>
            <Text style={styles.exportTitle}>تصدير البيانات</Text>
            <TouchableOpacity style={styles.exportBtn} onPress={() => { exportToExcel(schoolId); setShowExportModal(false); }}>
              <MaterialCommunityIcons name="file-excel" size={24} color="#10B981" />
              <Text style={styles.exportBtnText}>تصدير Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={() => { exportToPDF(schoolId); setShowExportModal(false); }}>
              <MaterialCommunityIcons name="file-pdf" size={24} color="#EF4444" />
              <Text style={styles.exportBtnText}>تصدير PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#F1F5F9' }]} onPress={() => setShowExportModal(false)}>
              <Text style={[styles.exportBtnText, { color: '#64748B' }]}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================== نموذج روابط التواصل الاجتماعي ==================== */}
      <Modal visible={showSocialModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.socialModal}>
            <View style={styles.socialModalHeader}>
              <TouchableOpacity onPress={() => setShowSocialModal(false)}>
                <MaterialCommunityIcons name="close" size={28} color="#64748B" />
              </TouchableOpacity>
              <Text style={styles.socialModalTitle}>روابط التواصل الاجتماعي</Text>
              <View style={{ width: 28 }} />
            </View>
            <ScrollView style={styles.socialModalContent}>
              <View style={styles.inputBox}>
                <Text style={styles.label}>رابط Facebook</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://facebook.com/..."
                  value={socialLinks.facebook}
                  onChangeText={t => setSocialLinks({...socialLinks, facebook: t})}
                />
              </View>
              <View style={styles.inputBox}>
                <Text style={styles.label}>رابط Instagram</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://instagram.com/..."
                  value={socialLinks.instagram}
                  onChangeText={t => setSocialLinks({...socialLinks, instagram: t})}
                />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowSocialModal(false)}>
                <Text style={styles.modalBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSaveSocialLinks}>
                <Text style={styles.modalBtnText}>حفظ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================== نموذج الإعلان الجماعي ==================== */}
      <Modal visible={showBroadcastModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.broadcastModal}>
            <View style={styles.broadcastHeader}>
              <TouchableOpacity onPress={() => setShowBroadcastModal(false)}>
                <MaterialCommunityIcons name="close" size={28} />
              </TouchableOpacity>
              <Text style={styles.broadcastTitle}>إرسال إعلان جماعي</Text>
              <View style={{ width: 28 }} />
            </View>
            <ScrollView style={styles.broadcastContent}>
              <Text style={styles.label}>اختر المستقبلين</Text>
              <View style={styles.targetList}>
                {['all', 'drivers', 'parents', 'staff'].map(t => (
                  <TouchableOpacity key={t} style={[styles.targetChip, broadcastTarget === t && styles.targetChipActive]} onPress={() => setBroadcastTarget(t)}>
                    <Text style={[styles.targetLabel, broadcastTarget === t && styles.targetLabelActive]}>
                      {t === 'all' ? 'الكل' : t === 'drivers' ? 'سائقين' : t === 'parents' ? 'أهالي' : 'مرافقات'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.label, { marginTop: 16 }]}>نص الإعلان</Text>
              <TextInput
                style={styles.bigInput}
                placeholder="اكتب نص الإعلان هنا..."
                multiline
                value={broadcastContent}
                onChangeText={setBroadcastContent}
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowBroadcastModal(false)}>
                <Text style={styles.modalBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSendBroadcast}>
                <Text style={styles.modalBtnText}>إرسال</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==================== الأنماط (Styles) ====================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // الرأس
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', elevation: 3 },
  headerCenter: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  schoolLogo: { width: 50, height: 50, borderRadius: 25 },
  logoPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  headerText: { flex: 1 },
  schoolName: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  headerSubtitle: { fontSize: 11, color: '#64748B', marginTop: 2 },
  
  // المحتوى
  mainScroll: { flex: 1 },
  dashboard: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 12, marginTop: 16 },
  
  // الإحصائيات
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 20 },
  statCard: { width: (width - 44) / 2, padding: 14, borderRadius: 14, alignItems: 'center', elevation: 2, borderLeftWidth: 4, backgroundColor: '#FFF' },
  statNum: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginVertical: 4 },
  statLab: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  
  // الإجراءات السريعة
  actionsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 20 },
  actionBtn: { width: (width - 44) / 2, backgroundColor: '#FFF', padding: 14, borderRadius: 14, alignItems: 'center', elevation: 2 },
  actionText: { fontSize: 12, fontWeight: '700', color: '#1E293B', marginTop: 8 },
  
  // الاشتراك
  subCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#3B82F6', elevation: 2 },
  subHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
  subTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginRight: 8 },
  subInfo: { alignItems: 'flex-end' },
  subText: { fontSize: 12, color: '#475569', marginBottom: 4 },
  expiredAlert: { color: '#EF4444', fontWeight: '700', marginTop: 8, textAlign: 'right' },
  
  // التواصل الاجتماعي
  socialCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 14, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#8B5CF6', elevation: 2 },
  socialHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
  socialTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginRight: 8 },
  socialLinks: { flexDirection: 'row-reverse', gap: 12, alignItems: 'center' },
  
  // البيانات
  dataSection: { padding: 16 },
  searchBar: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, elevation: 2 },
  searchInput: { flex: 1, paddingVertical: 10, textAlign: 'right', fontSize: 14 },
  addCircle: { backgroundColor: '#3B82F6', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 40 },
  
  // التواصل
  commSection: { backgroundColor: '#FFF', padding: 16, borderRadius: 14, elevation: 2 },
  targetList: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  targetChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  targetChipActive: { backgroundColor: '#3B82F6' },
  targetLabel: { fontSize: 12, color: '#64748B' },
  targetLabelActive: { color: '#FFF', fontWeight: '700' },
  bigInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, textAlign: 'right', height: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0' },
  sendFullBtn: { backgroundColor: '#10B981', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  sendFullText: { color: '#FFF', fontWeight: '800' },
  
  // التبويبات السفلية
  bottomNav: { flexDirection: 'row-reverse', backgroundColor: '#FFF', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  navText: { fontSize: 9, color: '#94A3B8', marginTop: 2 },
  navTextActive: { color: '#3B82F6', fontWeight: '700' },
  
  // النموذج
  modalBody: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  saveTxt: { color: '#3B82F6', fontWeight: '800', fontSize: 14 },
  modalForm: { padding: 16 },
  inputBox: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8, textAlign: 'right' },
  input: { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, textAlign: 'right', borderWidth: 1, borderColor: '#E2E8F0' },
  
  // التصدير
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  exportModal: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingVertical: 20 },
  exportTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 16, textAlign: 'center' },
  exportBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 8, gap: 12 },
  exportBtnText: { fontSize: 13, fontWeight: '600', color: '#1E293B', flex: 1 },
  
  // روابط التواصل
  socialModal: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  socialModalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  socialModalTitle: { fontSize: 16, fontWeight: '700' },
  socialModalContent: { padding: 16 },
  
  // الإعلان الجماعي
  broadcastModal: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  broadcastHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  broadcastTitle: { fontSize: 16, fontWeight: '700' },
  broadcastContent: { padding: 16 },
  
  // الأزرار
  modalFooter: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  modalBtnSave: { backgroundColor: '#3B82F6' },
  modalBtnText: { fontWeight: '600', fontSize: 13, color: '#FFF' },
});
