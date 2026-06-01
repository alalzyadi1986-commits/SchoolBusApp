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

import { clearUserSession } from '../../../services/sessionService';
import {
  subscribeToSchoolData,
  subscribeToSchoolInfo,
  saveSchoolItem,
  deleteSchoolItem
} from '../services/schoolDataService';
import { SchoolDataItem } from '../components/SchoolComponents';
import { exportToExcel, exportToPDF } from '../services/exportService';

export default function SchoolScreen({ route, navigation }) {
  const { schoolId, user } = route.params || {};
  const insets = useSafeAreaInsets();
  
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
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState('all'); 
  const [broadcastContent, setBroadcastContent] = useState('');

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
        const sorted = msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setAdminMessages(sorted);
      })
    ];

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
      setActiveTab('drivers');
    }

    setLoading(false);
    return () => {
      schoolUnsub();
      unsubs.forEach(u => u());
    };
  }, [schoolId, isSubManager, userPermissions]);

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
      } catch (e) {
        Alert.alert('خطأ', 'فشل حفظ الروابط');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (action === 'delete' && item) {
      Alert.alert('إدارة العنصر', 'اختر الإجراء المطلوب:', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'أرشفة (تعطيل)', onPress: async () => {
          try {
            await saveSchoolItem(schoolId, activeTab, item.id, { ...item, status: 'archived' });
            Alert.alert('تم', 'تم نقل العنصر للأرشيف');
          } catch (e) { Alert.alert('خطأ', 'فشلت الأرشفة'); }
        }},
        { text: 'حذف نهائي', style: 'destructive', onPress: async () => {
          try {
            await deleteSchoolItem(schoolId, activeTab, item.id);
          } catch (e) { Alert.alert('خطأ', 'فشل الحذف'); }
        }},
      ]);
    } else if (action === 'save') {
      if (!formData.username || !formData.name) {
        Alert.alert('خطأ', 'يرجى تعبئة الحقول الأساسية (الاسم واسم المستخدم)');
        return;
      }

      const usernameRegex = /^[\u0600-\u06FFa-zA-Z0-9_]+$/;
      if (!usernameRegex.test(formData.username)) {
        Alert.alert('خطأ', 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام فقط بدون مسافات أو رموز');
        return;
      }

      if (formData.phone && !/^\d+$/.test(formData.phone)) {
        Alert.alert('خطأ', 'رقم الجوال يجب أن يتكون من أرقام فقط');
        return;
      }

      if (!editingId) {
        if (activeTab === 'drivers' && drivers.length >= schoolLimits.maxBuses) {
          Alert.alert('تنبيه الباقة', `لقد وصلت للحد الأقصى من الحافلات (${schoolLimits.maxBuses}).`);
          return;
        }
        if (activeTab === 'students' && students.length >= schoolLimits.maxStudents) {
          Alert.alert('تنبيه الباقة', `لقد وصلت للحد الأقصى من الطلاب (${schoolLimits.maxStudents}).`);
          return;
        }
      }

      try {
        const dataToSave = { ...formData };
        if (activeTab === 'managers') {
          dataToSave.role = 'school_manager';
        }
        await saveSchoolItem(schoolId, activeTab, editingId, dataToSave);
        setFormData({});
        setEditingId(null);
        setShowForm(false);
        Alert.alert('تم', 'تم حفظ البيانات بنجاح');
      } catch (error) {
        Alert.alert('خطأ', 'حدث خطأ أثناء الحفظ');
      }
    }
  };

  const togglePermission = (permId) => {
    const currentPerms = formData.permissions || {};
    setFormData({
      ...formData,
      permissions: { ...currentPerms, [permId]: !currentPerms[permId] }
    });
  };

  const handleSendBroadcast = async () => {
    if (!broadcastContent.trim()) return;
    setLoading(true);
    try {
      const broadcastData = {
        id: Date.now(),
        sender: isMainAdmin ? 'مدير المدرسة الرئيسي' : `المدير: ${user.name}`,
        content: broadcastContent,
        timestamp: new Date().toISOString(),
        type: 'school_broadcast',
        target: broadcastTarget
      };
      await saveSchoolItem(schoolId, 'school_announcements', null, broadcastData);
      Alert.alert('نجاح', 'تم إرسال الإعلان لجميع المعنيين');
      setShowBroadcastModal(false);
      setBroadcastContent('');
    } catch (e) {
      Alert.alert('خطأ', 'فشل إرسال الإعلان');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (msg) => {
    if (msg.read) return;
    try {
      await saveSchoolItem(schoolId, 'messages', msg.id, { ...msg, read: true });
    } catch (e) { console.log(e); }
  };

  const handleReplyToAdmin = async () => {
    if (!replyText.trim() || !selectedMessageForReply) return;
    try {
      setLoading(true);
      const senderName = user?.name || user?.username || 'مدير المدرسة';
      const timestamp = new Date().toISOString();
      
      const reply = {
        content: replyText,
        timestamp: timestamp,
        sender: senderName,
        schoolName: dynamicSchoolName,
        schoolId: schoolId,
        type: 'reply_to_admin',
        originalMsgId: selectedMessageForReply.id
      };

      await saveSchoolItem(schoolId, 'admin_replies', null, reply);
      
      const updatedMsg = {
        ...selectedMessageForReply,
        read: true,
        replyContent: replyText,
        replyTimestamp: timestamp,
        repliedBy: senderName
      };
      await saveSchoolItem(schoolId, 'messages', selectedMessageForReply.id, updatedMsg);

      Alert.alert('تم', 'تم إرسال ردك بنجاح');
      setReplyText('');
      setSelectedMessageForReply(null);
    } catch (e) { 
      Alert.alert('خطأ', 'فشل إرسال الرد'); 
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("تسجيل الخروج", "هل تريد الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "خروج", onPress: async () => { await clearUserSession(); navigation.replace('Login'); } }
    ]);
  };

  const currentData = useMemo(() => {
    const map = { drivers, staff, parents, students, managers, reports, emergencies };
    const list = map[activeTab] || [];
    return list.filter(item => 
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeTab, drivers, staff, parents, students, managers, reports, emergencies, searchQuery]);

  const complianceAlerts = useMemo(() => {
    const alerts = [];
    const today = new Date();

    drivers.forEach(d => {
      const checkExpiry = (dateStr, label) => {
        if (!dateStr) return;
        const expiryDate = new Date(dateStr);
        if (isNaN(expiryDate.getTime())) return;
        
        const diffTime = expiryDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 30) {
          alerts.push({
            id: `${d.id}-${label}`,
            driverName: d.name,
            label: label,
            daysLeft: diffDays,
            isExpired: diffDays <= 0
          });
        }
      };

      checkExpiry(d.driverLicenseExpiry, 'رخصة القيادة');
      checkExpiry(d.busInsuranceExpiry, 'تأمين الحافلة');
      checkExpiry(d.busLicenseExpiry, 'رخصة الحافلة');
      checkExpiry(d.oilChangeDate, 'غيار الزيت');
    });

    return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [drivers]);

  const stats = useMemo(() => {
    return {
      buses: drivers.length,
      students: students.length,
      staff: staff.length,
      parents: parents.length,
      emergencies: emergencies.filter(e => !e.resolved).length,
      activeTrips: drivers.filter(d => d.isOnline).length,
      complianceAlerts: complianceAlerts.length
    };
  }, [drivers, students, staff, parents, emergencies, complianceAlerts]);

  const renderReports = () => (
    <ScrollView style={{ padding: 15 }}>
      <View style={[styles.card, { padding: 15, backgroundColor: '#FFF', borderRadius: 15, alignItems: 'flex-end' }]}>
        <Text style={[styles.cardTitle, { marginBottom: 15 }]}>📊 ملخص إحصائيات المدرسة</Text>
        <View style={styles.reportRow}><Text style={styles.reportValue}>{stats.students}</Text><Text style={styles.reportLabel}>إجمالي الطلاب:</Text></View>
        <View style={styles.reportRow}><Text style={styles.reportValue}>{stats.buses}</Text><Text style={styles.reportLabel}>إجمالي الحافلات:</Text></View>
        <View style={styles.reportRow}><Text style={styles.reportValue}>{stats.staff}</Text><Text style={styles.reportLabel}>إجمالي المرافقات:</Text></View>
        <View style={styles.reportRow}><Text style={styles.reportValue}>{stats.parents}</Text><Text style={styles.reportLabel}>إجمالي أولياء الأمور:</Text></View>
        <View style={styles.reportRow}><Text style={[styles.reportValue, { color: '#EF4444' }]}>{stats.emergencies}</Text><Text style={styles.reportLabel}>طوارئ لم تُحل:</Text></View>
      </View>

      <View style={[styles.card, { padding: 15, backgroundColor: '#FFF', borderRadius: 15, alignItems: 'flex-end', marginTop: 10 }]}>
        <Text style={[styles.cardTitle, { marginBottom: 10 }]}>🚍 الرحلات النشطة حالياً ({stats.activeTrips})</Text>
        {drivers.filter(d => d.isOnline).length > 0 ? (
          drivers.filter(d => d.isOnline).map(d => (
            <View key={d.id} style={styles.reportRow}>
              <TouchableOpacity 
                style={styles.editBtn} 
                onPress={() => {
                  if (d.location) {
                    Alert.alert('موقع الحافلة', `خط العرض: ${d.location.latitude}\nخط الطول: ${d.location.longitude}`);
                  } else {
                    Alert.alert('تنبيه', 'الموقع غير متاح حالياً');
                  }
                }}
              >
                <Text style={styles.editBtnText}>تتبع</Text>
              </TouchableOpacity>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{d.name}</Text>
                <Text style={{ fontSize: 11, color: '#64748B' }}>لوحة: {d.busPlate || '---'}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 5 }}>لا توجد رحلات جارية الآن</Text>
        )}
      </View>
      
      <View style={[styles.card, { padding: 15, backgroundColor: '#FFF', borderRadius: 15, alignItems: 'flex-end', marginTop: 10 }]}>
        <Text style={styles.cardTitle}>📅 حالة الاشتراك</Text>
        <Text style={[styles.cardSub, { marginTop: 5 }]}>تاريخ الانتهاء: {expiryDate.split('T')[0]}</Text>
        <Text style={[styles.cardSub, { color: isExpired ? '#EF4444' : '#10B981', fontWeight: 'bold' }]}>
          الحالة: {isExpired ? 'منتهي (يرجى التجديد)' : 'نشط'}
        </Text>
      </View>
    </ScrollView>
  );

  const renderInput = (placeholder, field, isNumeric = false) => (
    <View style={styles.inputWrapper} key={field}>
      <Text style={styles.inputLabel}>{placeholder}:</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={formData[field] || ''}
        onChangeText={(txt) => setFormData({ ...formData, [field]: txt })}
        keyboardType={isNumeric ? 'numeric' : 'default'}
        editable={field === 'username' ? (activeTab === 'managers' ? true : !editingId) : true}
      />
    </View>
  );

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />
      
      {/* الهيدر الرئيسي */}
      <View style={styles.imgHeader}>
        <View style={styles.imgHeaderLeft}>
          <TouchableOpacity style={styles.imgIconBtn} onPress={() => setShowComplianceModal(true)}>
            <Text style={{ fontSize: 24 }}>⚠️</Text>
            {complianceAlerts.length > 0 && <View style={[styles.imgBadge, { backgroundColor: '#F59E0B' }]} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.imgIconBtn} onPress={() => setShowMsgModal(true)}>
            <Text style={{ fontSize: 24 }}>🔔</Text>
            {adminMessages.filter(m => !m.read).length > 0 && <View style={styles.imgBadge} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.imgIconBtn} onPress={() => setShowProfileModal(true)}>
            <Text style={{ fontSize: 24 }}>⚙️</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.imgHeaderRight}>
          <View style={{ alignItems: 'flex-end', marginRight: 15 }}>
            <Text style={styles.imgWelcomeText}>مرحباً، الأستاذ {user?.name?.split(' ')[0] || 'أحمد'}</Text>
            <Text style={styles.imgSchoolName}>{dynamicSchoolName || 'الدرة النموذجية'}</Text>
          </View>
          {schoolLogo ? (
            <Image source={{ uri: schoolLogo }} style={styles.imgAvatar} />
          ) : (
            <View style={[styles.imgAvatar, { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontSize: 24 }}>👨‍🏫</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        
        {/* قسم الإحصائيات */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>الإحصائيات العامة</Text>
        </View>

        <View style={styles.imgStatsRow}>
          {(isMainAdmin || (isSubManager && userPermissions?.view_buses)) && (
            <TouchableOpacity style={[styles.imgStatCard, { borderRightColor: '#3B82F6' }, activeTab === 'drivers' && styles.imgAccountCardActive]} onPress={() => setActiveTab('drivers')}>
              <Text style={{ fontSize: 28, marginBottom: 5 }}>🚌</Text>
              <Text style={styles.imgStatValue}>{stats.buses}</Text>
              <Text style={styles.imgStatLabel}>باصات</Text>
            </TouchableOpacity>
          )}
          {(isMainAdmin || userPermissions?.manage_students) && (
            <TouchableOpacity style={[styles.imgStatCard, { borderRightColor: '#10B981' }, activeTab === 'students' && styles.imgAccountCardActive]} onPress={() => setActiveTab('students')}>
              <Text style={{ fontSize: 28, marginBottom: 5 }}>🎓</Text>
              <Text style={styles.imgStatValue}>{stats.students}</Text>
              <Text style={styles.imgStatLabel}>طلاب</Text>
            </TouchableOpacity>
          )}
          {(isMainAdmin || (isSubManager && userPermissions?.view_active_trips)) && (
            <TouchableOpacity style={[styles.imgStatCard, { borderRightColor: '#F59E0B' }, activeTab === 'reports' && styles.imgAccountCardActive]} onPress={() => setActiveTab('reports')}>
              <Text style={{ fontSize: 28, marginBottom: 5 }}>📍</Text>
              <Text style={styles.imgStatValue}>{stats.activeTrips}</Text>
              <Text style={styles.imgStatLabel}>رحلات</Text>
            </TouchableOpacity>
          )}
          {(isMainAdmin || userPermissions?.handle_emergencies) && (
            <TouchableOpacity style={[styles.imgStatCard, { borderRightColor: '#EF4444' }, activeTab === 'emergencies' && styles.imgAccountCardActive]} onPress={() => setActiveTab('emergencies')}>
              <View style={styles.emergencyIcon}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>!</Text></View>
              <Text style={styles.imgStatValue}>{stats.emergencies}</Text>
              <Text style={styles.imgStatLabel}>طوارئ</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* الاختصارات السريعة */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>الاختصارات السريعة</Text>
        </View>

        <View style={styles.imgActionsGrid}>
          <View style={styles.imgActionRow}>
            <TouchableOpacity style={styles.imgActionBox} onPress={() => navigation.navigate('ActiveTrips', { schoolId })}>
              <Text style={{ fontSize: 26, marginBottom: 8 }}>🏠</Text>
              <Text style={styles.imgActionLabel}>مراقبة حية</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imgActionBox} onPress={() => { setCommunicationTab('messages'); setShowMsgModal(true); }}>
              <Text style={{ fontSize: 26, marginBottom: 8 }}>✉️</Text>
              <Text style={styles.imgActionLabel}>رسائل الإدارة</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imgActionBox} onPress={() => setShowBroadcastModal(true)}>
              <Text style={{ fontSize: 26, marginBottom: 8 }}>📢</Text>
              <Text style={styles.imgActionLabel}>إعلان عام</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imgActionBox} onPress={() => navigation.navigate('SetSchoolLocation', { schoolId })}>
              <Text style={{ fontSize: 26, marginBottom: 8 }}>🏫</Text>
              <Text style={styles.imgActionLabel}>موقع المدرسة</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* شريط البحث الموحد */}
        <View style={styles.imgSearchWrapper}>
          <View style={styles.imgSearchContainer}>
            <Text style={{ fontSize: 18, color: '#94A3B8', marginLeft: 10 }}>🔍</Text>
            <TextInput 
              style={styles.imgSearchInput} 
              placeholder="بحث في القائمة الحالية المفتوحة بالأسفل..." 
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* إدارة الحسابات والتبويبات السفلية التفاعلية */}
        <View style={styles.imgAccountsSection}>
          <Text style={styles.imgAccountsTitle}>إدارة القوائم والحسابات</Text>
          <View style={styles.imgAccountsRow}>
            <TouchableOpacity 
              style={[styles.imgAccountCard, { borderColor: '#3B82F6' }, activeTab === 'parents' && styles.imgAccountCardActive]} 
              onPress={() => setActiveTab('parents')}
            >
              <Text style={{ fontSize: 32, marginBottom: 5 }}>👨‍👩‍👧‍👦</Text>
              <Text style={styles.imgAccountLabel}>أولياء الأمور</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.imgAccountCard, { borderColor: '#10B981' }, activeTab === 'staff' && styles.imgAccountCardActive]} 
              onPress={() => setActiveTab('staff')}
            >
              <Text style={{ fontSize: 32, marginBottom: 5 }}>❤️</Text>
              <Text style={styles.imgAccountLabel}>المرافقات</Text>
            </TouchableOpacity>
            {isMainAdmin && (
              <TouchableOpacity 
                style={[styles.imgAccountCard, { borderColor: '#F59E0B' }, activeTab === 'managers' && styles.imgAccountCardActive]} 
                onPress={() => setActiveTab('managers')}
              >
                <Text style={{ fontSize: 32, marginBottom: 5 }}>⚙️</Text>
                <Text style={styles.imgAccountLabel}>المدراء الفروع</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.imgExportBtn} onPress={() => setShowExportModal(true)}>
          <Text style={styles.imgExportBtnText}>تصدير التقارير الرسمية 📥</Text>
        </TouchableOpacity>

        {/* عرض محتوى القائمة المفتوحة */}
        <View style={{ marginTop: 10 }}>
          <Text style={[styles.imgAccountsTitle, { paddingHorizontal: 15 }]}>
            عرض تفاصيل: {activeTab === 'drivers' ? 'السائقين' : activeTab === 'students' ? 'الطلاب' : activeTab === 'parents' ? 'أولياء الأمور' : activeTab === 'staff' ? 'المرافقات' : activeTab === 'emergencies' ? 'الطوارئ' : activeTab === 'managers' ? 'المدراء الفرعيين' : 'التقرير'}
          </Text>
          
          {activeTab === 'reports' ? renderReports() : (
            <View style={{ minHeight: 200 }}>
              {currentData.length > 0 ? (
                currentData.map(item => (
                  <SchoolDataItem 
                    key={item.id}
                    item={item} 
                    activeTab={activeTab} 
                    onEdit={() => {
                      setFormData(item);
                      setEditingId(item.id);
                      setShowForm(true);
                    }}
                    onDelete={() => handleAction('delete', item)}
                    isMainAdmin={isMainAdmin}
                    userPermissions={userPermissions}
                  />
                ))
              ) : (
                <Text style={styles.emptyText}>لا توجد بيانات متطابقة لعرضها</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* زر الإضافة العائم المطور */}
      {(isMainAdmin || userPermissions?.edit_items) && activeTab !== 'reports' && (
        <TouchableOpacity 
          style={[styles.addBtn, { backgroundColor: '#10B981', shadowColor: '#10B981' }]} 
          onPress={() => { setFormData({}); setEditingId(null); setShowForm(true); }}
        >
          <Text style={styles.addBtnText}>➕ إضافة عنصر جديد هنا</Text>
        </TouchableOpacity>
      )}

      {/* مودال الإعلان العام */}
      <Modal visible={showBroadcastModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📢 إرسال إعلان عام للمدرسة</Text>
            <View style={styles.targetContainer}>
              <TouchableOpacity style={[styles.targetBtn, broadcastTarget === 'all' && styles.targetBtnActive]} onPress={() => setBroadcastTarget('all')}>
                <Text style={[styles.targetText, broadcastTarget === 'all' && styles.targetTextActive]}>الكل</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.targetBtn, broadcastTarget === 'parents' && styles.targetBtnActive]} onPress={() => setBroadcastTarget('parents')}>
                <Text style={[styles.targetText, broadcastTarget === 'parents' && styles.targetTextActive]}>أولياء الأمور</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.targetBtn, broadcastTarget === 'drivers' && styles.targetBtnActive]} onPress={() => setBroadcastTarget('drivers')}>
                <Text style={[styles.targetText, broadcastTarget === 'drivers' && styles.targetTextActive]}>السائقين</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.msgInput}
              placeholder="اكتب محتوى الإعلان هنا..."
              value={broadcastContent}
              onChangeText={setBroadcastContent}
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.sendBtn]} onPress={handleSendBroadcast}>
                <Text style={styles.modalBtnText}>إرسال الآن</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.closeBtn, { marginTop: 0 }]} onPress={() => setShowBroadcastModal(false)}>
                <Text style={styles.modalBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* مودال تصدير التقارير الموحد والمصلح العقد */}
      <Modal visible={showExportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📥 مركز تصدير التقارير</Text>
            <Text style={{ textAlign: 'center', color: '#64748B', marginBottom: 20 }}>اختر البيانات والصيغة للتحميل</Text>
            
            <View style={styles.exportSection}>
              <Text style={styles.exportLabel}>📊 جدول الطلاب المباشر:</Text>
              <View style={styles.exportRow}>
                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#10B981' }]} onPress={() => exportToExcel(students, "جدول الطلاب", dynamicSchoolName, user?.name || 'مدير المدرسة')}>
                  <Text style={styles.exportBtnText}>Excel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#EF4444' }]} onPress={() => exportToPDF(students, "جدول الطلاب", dynamicSchoolName, user?.name || 'مدير المدرسة')}>
                  <Text style={styles.exportBtnText}>PDF</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.exportSection}>
              <Text style={styles.exportLabel}>🚐 جدول السائقين والأسطول:</Text>
              <View style={styles.exportRow}>
                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#10B981' }]} onPress={() => exportToExcel(drivers, "جدول السائقين", dynamicSchoolName, user?.name || 'مدير المدرسة')}>
                  <Text style={styles.exportBtnText}>Excel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#EF4444' }]} onPress={() => exportToPDF(drivers, "جدول السائقين", dynamicSchoolName, user?.name || 'مدير المدرسة')}>
                  <Text style={styles.exportBtnText}>PDF</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[styles.closeBtn, { marginTop: 20 }]} onPress={() => setShowExportModal(false)}>
              <Text style={styles.closeBtnText}>إغلاق النافذة</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال الملف الشخصي */}
      <Modal visible={showProfileModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              {schoolLogo ? (
                <Image source={{ uri: schoolLogo }} style={{ width: 80, height: 80, borderRadius: 40 }} />
              ) : (
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 40 }}>🏫</Text></View>
              )}
              <Text style={[styles.adminName, { marginTop: 10, fontSize: 20, fontWeight: 'bold' }]}>{user?.name}</Text>
              <Text style={{ color: '#64748B' }}>{dynamicSchoolName}</Text>
            </View>

            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>تاريخ انتهاء الاشتراك:</Text>
              <Text style={[styles.profileValue, { color: isExpired ? '#EF4444' : '#10B981', fontWeight: 'bold' }]}>{expiryDate.split('T')[0]}</Text>
            </View>

            <TouchableOpacity style={styles.profileBtn} onPress={() => { setShowProfileModal(false); setShowSocialModal(true); }}>
              <Text style={styles.profileBtnText}>🔗 إعدادات التواصل الاجتماعي</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.profileBtn, { backgroundColor: '#FEE2E2', marginTop: 10 }]} onPress={handleLogout}>
              <Text style={[styles.profileBtnText, { color: '#EF4444' }]}>🚪 تسجيل الخروج</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowProfileModal(false)}>
              <Text style={styles.closeBtnText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال روابط التواصل */}
      <Modal visible={showSocialModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>روابط التواصل الاجتماعي</Text>
            <View style={{ marginBottom: 15 }}>
              <Text style={styles.inputLabel}>رابط Facebook:</Text>
              <TextInput 
                style={[styles.input, { textAlign: 'left' }]} 
                placeholder="https://facebook.com/..." 
                value={socialLinks.facebook}
                onChangeText={(t) => setSocialLinks({ ...socialLinks, facebook: t })}
              />
            </View>
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.inputLabel}>رابط Instagram:</Text>
              <TextInput 
                style={[styles.input, { textAlign: 'left' }]} 
                placeholder="https://instagram.com/..." 
                value={socialLinks.instagram}
                onChangeText={(t) => setSocialLinks({ ...socialLinks, instagram: t })}
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.sendBtn]} onPress={() => handleAction('save_social')}>
                <Text style={styles.modalBtnText}>حفظ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.closeBtn, { marginTop: 0 }]} onPress={() => setShowSocialModal(false)}>
                <Text style={styles.modalBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* مودال الأوراق القانونية للأسطول */}
      <Modal visible={showComplianceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '70%', padding: 20 }]}>
            <Text style={[styles.modalTitle, { color: '#1E293B' }]}>📑 إدارة الأسطول والأوراق القانونية</Text>
            <Text style={{ textAlign: 'center', color: '#64748B', marginBottom: 15 }}>تنبيهات تلقائية للأوراق التي تنتهي خلال 30 يوماً</Text>
            
            {complianceAlerts.length > 0 ? (
              <FlatList
                data={complianceAlerts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={{ 
                    backgroundColor: item.isExpired ? '#FEF2F2' : '#FFFBEB', 
                    padding: 15, 
                    borderRadius: 12, 
                    marginBottom: 10,
                    borderRightWidth: 4,
                    borderRightColor: item.isExpired ? '#EF4444' : '#F59E0B',
                    flexDirection: 'row-reverse',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ fontWeight: 'bold', color: '#1E293B' }}>{item.label} - {item.driverName}</Text>
                      <Text style={{ color: item.isExpired ? '#EF4444' : '#F59E0B', fontSize: 12, marginTop: 2 }}>
                        {item.isExpired ? '⚠️ منتهية الصلاحية!' : `تنتهي خلال ${item.daysLeft} يوماً`}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 20 }}>{item.isExpired ? '🚫' : '⏳'}</Text>
                  </View>
                )}
              />
            ) : (
              <View style={styles.centered}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>✅</Text>
                <Text style={{ color: '#64748B', textAlign: 'center' }}>جميع الأوراق الرسمية محدثة وسليمة حالياً</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.closeBtn, { marginTop: 15 }]} onPress={() => setShowComplianceModal(false)}>
              <Text style={styles.closeBtnText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مركز التواصل الموحد وإصلاح محرك الرد على الرسائل */}
      <Modal visible={showMsgModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%', paddingHorizontal: 0 }]}>
            <Text style={styles.modalTitle}>📬 مركز التواصل الشامل</Text>
            
            <View style={styles.commTabs}>
              <TouchableOpacity style={[styles.commTab, communicationTab === 'messages' && styles.commTabActive]} onPress={() => setCommunicationTab('messages')}>
                <Text style={[styles.commTabText, communicationTab === 'messages' && styles.commTabTextActive]}>رسائل الإدارة العامة</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.commTab, communicationTab === 'complaints' && styles.commTabActive]} onPress={() => setCommunicationTab('complaints')}>
                <Text style={[styles.commTabText, communicationTab === 'complaints' && styles.commTabTextActive]}>الشكاوى</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, padding: 15 }}>
              {communicationTab === 'messages' && (
                <View style={{ flex: 1 }}>
                  <FlatList
                    data={adminMessages}
                    keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        activeOpacity={0.8}
                        onPress={() => item.type === 'broadcast' && !item.read && handleMarkAsRead(item)}
                        style={[styles.chatBubble, item.type === 'broadcast' ? styles.chatBubbleAdmin : styles.chatBubbleSchool, !item.read && item.type === 'broadcast' && styles.chatBubbleUnread]}
                      >
                        <Text style={styles.chatSender}>{item.sender}</Text>
                        <Text style={styles.chatContent}>{item.content}</Text>
                        <Text style={styles.chatTimestamp}>{new Date(item.timestamp).toLocaleString('ar-EG')}</Text>
                        
                        {item.replyContent && (
                          <View style={styles.chatReplyContainer}>
                            <Text style={styles.chatReplyLabel}>رد المدرسة بقلم ({item.repliedBy}):</Text>
                            <Text style={styles.chatReplyContent}>{item.replyContent}</Text>
                          </View>
                        )}

                        {!item.replyContent && (
                          <TouchableOpacity style={styles.replyButton} onPress={() => setSelectedMessageForReply(item)}>
                            <Text style={styles.replyButtonText}>إدراج رد</Text>
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    )}
                  />

                  {/* صندوق الرد السريع المفعل الذي تم تصليحه عتادياً */}
                  {selectedMessageForReply && (
                    <View style={styles.replyInputContainer}>
                      <Text style={styles.replyingToText}>الرد على: {selectedMessageForReply.content.substring(0, 25)}...</Text>
                      <TextInput 
                        style={styles.replyInput}
                        placeholder="اكتب ردك هنا ثم اضغط إرسال..."
                        value={replyText}
                        onChangeText={setReplyText}
                      />
                      <View style={styles.replyActions}>
                        <TouchableOpacity style={[styles.replyBtn, { backgroundColor: '#10B981' }]} onPress={handleReplyToAdmin}>
                          <Text style={{ color: '#FFF', fontWeight: 'bold' }}>إرسال الرد</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.replyBtn, { backgroundColor: '#EF4444' }]} onPress={() => setSelectedMessageForReply(null)}>
                          <Text style={{ color: '#FFF' }}>إلغاء</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {communicationTab === 'complaints' && (
                <View style={styles.centered}><Text style={{ color: '#64748B' }}>لا توجد شكاوى مستلمة حالياً</Text></View>
              )}
            </View>

            <TouchableOpacity style={[styles.closeBtn, { marginHorizontal: 20, marginBottom: 20 }]} onPress={() => setShowMsgModal(false)}>
              <Text style={styles.closeBtnText}>إغلاق المركز</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال الاستمارات المطور */}
      <Modal visible={showForm} animationType="slide">
        <SafeAreaView style={{ flex: 1, padding: 20 }}>
          <Text style={{ textAlign: 'center', marginBottom: 20, fontSize: 20, fontWeight: 'bold', color: '#1E293B' }}>{editingId ? 'تعديل بيانات الحساب' : 'إضافة حساب جديد'}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {renderInput('الاسم الكامل للمستخدم', 'name')}
            {renderInput('اسم المستخدم للولوج (Username)', 'username')}
            {renderInput('كلمة السر (Password)', 'password')}
            
            {activeTab === 'drivers' && renderInput('رقم الجوال الشخصي', 'phone', true)}
            {activeTab === 'drivers' && renderInput('رقم لوحة الحافلة المخصصة', 'busPlate')}
            {activeTab === 'drivers' && (
              <View style={{ backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={[styles.inputLabel, { color: '#3B82F6', fontWeight: 'bold', marginBottom: 5 }]}>📑 تواريخ الصلاحية القانونية (صيغة YYYY-MM-DD):</Text>
                {renderInput('تاريخ انتهاء رخصة السائق', 'driverLicenseExpiry')}
                {renderInput('تاريخ انتهاء تأمين الحافلة', 'busInsuranceExpiry')}
                {renderInput('تاريخ انتهاء رخصة الحافلة', 'busLicenseExpiry')}
                {renderInput('موعد غيار الزيت القادم', 'oilChangeDate')}
              </View>
            )}
            {activeTab === 'students' && renderInput('الصف الدراسي / الشعبة', 'class')}
            
            {activeTab === 'students' && (
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>تعيين ولي الأمر المسؤول:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row-reverse', marginTop: 5 }}>
                  {parents.map(p => (
                    <TouchableOpacity 
                      key={p.id} 
                      style={[styles.pickerItem, formData.parentUsername === p.username && styles.pickerItemActive]}
                      onPress={() => setFormData({ ...formData, parentUsername: p.username })}
                    >
                      <Text style={[styles.pickerText, formData.parentUsername === p.username && styles.pickerTextActive]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {activeTab === 'students' && (
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>تعيين سائق الحافلة المخصص:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row-reverse', marginTop: 5 }}>
                  {drivers.map(d => (
                    <TouchableOpacity 
                      key={d.id} 
                      style={[styles.pickerItem, formData.driverUsername === d.username && styles.pickerItemActive]}
                      onPress={() => setFormData({ ...formData, driverUsername: d.username })}
                    >
                      <Text style={[styles.pickerText, formData.driverUsername === d.username && styles.pickerTextActive]}>{d.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {activeTab === 'managers' && (
              <View style={styles.permsSection}>
                <Text style={styles.permsTitle}>تحديد صلاحيات المدير الفرعي الممنوحة:</Text>
                {AVAILABLE_PERMISSIONS.map(perm => (
                  <TouchableOpacity 
                    key={perm.id} 
                    style={styles.permRow}
                    onPress={() => togglePermission(perm.id)}
                  >
                    <Text style={styles.permLabel}>{perm.label}</Text>
                    <View style={[styles.checkbox, formData.permissions?.[perm.id] && styles.checkboxChecked]}>
                      {formData.permissions?.[perm.id] && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
            <TouchableOpacity style={[styles.addBtn, { flex: 0.45, backgroundColor: '#64748B', position: 'relative', bottom: 0 }]} onPress={() => setShowForm(false)}>
              <Text style={styles.addBtnText}>إلغاء التعديل</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addBtn, { flex: 0.45, position: 'relative', bottom: 0 }]} onPress={() => handleAction('save')}>
              <Text style={styles.addBtnText}>حفظ الآن</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imgHeader: { padding: 20, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  imgHeaderLeft: { flexDirection: 'row' },
  imgHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  imgIconBtn: { padding: 10, backgroundColor: '#F8FAFC', borderRadius: 15, marginLeft: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  imgBadge: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  imgWelcomeText: { fontSize: 16, color: '#1E293B', fontWeight: 'bold' },
  imgSchoolName: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  imgAvatar: { width: 55, height: 55, borderRadius: 27.5, borderWidth: 2, borderColor: '#F1F5F9' },
  sectionTitleRow: { paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', textAlign: 'right' },
  imgStatsRow: { flexDirection: 'row-reverse', paddingHorizontal: 15, justifyContent: 'space-between' },
  imgStatCard: { width: '23.5%', backgroundColor: '#FFF', padding: 15, borderRadius: 15, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, borderRightWidth: 4 },
  imgStatValue: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  imgStatLabel: { fontSize: 11, color: '#64748B', marginTop: 5, fontWeight: 'bold' },
  emergencyIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  imgActionsGrid: { paddingHorizontal: 15, marginTop: 10 },
  imgActionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12 },
  imgActionBox: { width: '23.5%', aspectRatio: 1, backgroundColor: '#FFF', borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, borderWidth: 1, borderColor: '#F1F5F9' },
  imgActionLabel: { fontSize: 11, fontWeight: 'bold', color: '#475569', textAlign: 'center', paddingHorizontal: 2 },
  imgSearchWrapper: { paddingHorizontal: 15, marginTop: 15 },
  imgSearchContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: '#E2E8F0', height: 50 },
  imgSearchInput: { flex: 1, textAlign: 'right', fontSize: 13, color: '#1E293B' },
  imgAccountsSection: { paddingHorizontal: 15, marginTop: 20 },
  imgAccountsTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', textAlign: 'right', marginBottom: 12 },
  imgAccountsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  imgAccountCard: { width: '31%', backgroundColor: '#FFF', padding: 15, borderRadius: 15, alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0', elevation: 2 },
  imgAccountCardActive: { backgroundColor: '#E0F2FE', borderColor: '#3B82F6' },
  imgAccountLabel: { fontSize: 12, fontWeight: 'bold', color: '#1E293B', marginTop: 5 },
  imgExportBtn: { margin: 15, backgroundColor: '#FFF', padding: 15, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#3B82F6', borderStyle: 'dashed' },
  imgExportBtnText: { fontSize: 14, fontWeight: 'bold', color: '#3B82F6' },
  reportRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', width: '100%', marginVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 6 },
  reportLabel: { fontSize: 13, color: '#475569' },
  reportValue: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  inputWrapper: { marginBottom: 12, alignItems: 'flex-end' },
  inputLabel: { fontSize: 13, color: '#475569', marginBottom: 5, fontWeight: 'bold' },
  input: { width: '100%', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, textAlign: 'right', color: '#1E293B' },
  addBtn: { position: 'absolute', bottom: 15, left: 15, right: 15, backgroundColor: '#10B981', padding: 14, borderRadius: 12, alignItems: 'center', elevation: 4 },
  addBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'center', color: '#1E293B' },
  targetContainer: { flexDirection: 'row-reverse', justifyContent: 'space-around', marginBottom: 15 },
  targetBtn: { padding: 8, borderRadius: 10, backgroundColor: '#F1F5F9', flex: 1, marginHorizontal: 4, alignItems: 'center' },
  targetBtnActive: { backgroundColor: '#3B82F6' },
  targetText: { fontSize: 11, color: '#64748B' },
  targetTextActive: { color: '#FFF', fontWeight: 'bold' },
  msgInput: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, textAlign: 'right', height: 90, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0' },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', marginHorizontal: 4 },
  sendBtn: { backgroundColor: '#3B82F6' },
  closeBtn: { backgroundColor: '#64748B', marginTop: 12, padding: 12, borderRadius: 10, alignItems: 'center' },
  closeBtnText: { color: '#FFF', fontWeight: 'bold' },
  modalBtnText: { color: '#FFF', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 30, fontSize: 13 },
  exportSection: { marginVertical: 10, alignItems: 'flex-end' },
  exportLabel: { fontSize: 13, fontWeight: 'bold', color: '#374151', marginBottom: 5 },
  exportRow: { flexDirection: 'row-reverse', width: '100%', justifyContent: 'space-between' },
  exportBtn: { width: '48%', padding: 10, borderRadius: 8, alignItems: 'center' },
  exportBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  profileItem: { flexDirection: 'row-reverse', justifyContent: 'space-between', width: '100%', marginVertical: 8, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10 },
  profileLabel: { fontSize: 13, color: '#475569' },
  profileValue: { fontSize: 13 },
  profileBtn: { width: '100%', padding: 12, backgroundColor: '#F1F5F9', borderRadius: 10, alignItems: 'center', marginTop: 10 },
  profileBtnText: { fontWeight: 'bold', color: '#1E293B', fontSize: 13 },
  commTabs: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  commTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  commTabActive: { borderBottomWidth: 3, borderBottomColor: '#3B82F6' },
  commTabText: { fontSize: 13, color: '#64748B' },
  commTabTextActive: { color: '#3B82F6', fontWeight: 'bold' },
  chatBubble: { padding: 12, borderRadius: 12, marginBottom: 10, maxWidth: '85%' },
  chatBubbleAdmin: { backgroundColor: '#F1F5F9', alignSelf: 'flex-start', borderTopLeftRadius: 0 },
  chatBubbleSchool: { backgroundColor: '#EFF6FF', alignSelf: 'flex-end', borderTopRightRadius: 0 },
  chatBubbleUnread: { borderWidth: 1.5, borderColor: '#EF4444' },
  chatSender: { fontWeight: 'bold', fontSize: 12, marginBottom: 3, color: '#475569', textAlign: 'right' },
  chatContent: { fontSize: 13, color: '#1E293B', textAlign: 'right' },
  chatTimestamp: { fontSize: 10, color: '#94A3B8', marginTop: 5, textAlign: 'left' },
  chatReplyContainer: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E2E8F0', alignItems: 'flex-end' },
  chatReplyLabel: { fontSize: 11, fontWeight: 'bold', color: '#3B82F6', marginBottom: 2 },
  chatReplyContent: { fontSize: 12, color: '#475569', textAlign: 'right' },
  replyButton: { backgroundColor: '#3B82F6', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6, marginTop: 5, alignSelf: 'flex-end' },
  replyButtonText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  replyInputContainer: { marginTop: 15, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  replyingToText: { fontSize: 12, color: '#64748B', marginBottom: 5, textAlign: 'right' },
  replyInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10, fontSize: 13, textAlign: 'right' },
  replyActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 10 },
  replyBtn: { flex: 0.48, padding: 8, borderRadius: 8, alignItems: 'center' },
  pickerItem: { padding: 8, paddingHorizontal: 14, backgroundColor: '#F1F5F9', borderRadius: 10, marginLeft: 8 },
  pickerItemActive: { backgroundColor: '#3B82F6' },
  pickerText: { fontSize: 12, color: '#475569' },
  pickerTextActive: { color: '#FFF', fontWeight: 'bold' },
  permsSection: { marginTop: 15, alignItems: 'flex-end' },
  permsTitle: { fontSize: 14, fontWeight: 'bold', color: '#1E293B', marginBottom: 10 },
  permRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', width: '100%', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
  permLabel: { fontSize: 13, color: '#334155' },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: '#CBD5E1', borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  checkMark: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  editBtn: { padding: 6, paddingHorizontal: 12, backgroundColor: '#EFF6FF', borderRadius: 6 },
  editBtnText: { color: '#3B82F6', fontSize: 12, fontWeight: 'bold' }
});