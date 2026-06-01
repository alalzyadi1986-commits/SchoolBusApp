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
        if (data.location) {
          setCurrentLocation(data.location);
        }
        if (data.socialLinks) {
          setSocialLinks(data.socialLinks);
        }
        if (data.limits) {
          setSchoolLimits(data.limits);
        }
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
        Alert.alert('خطأ', 'اسم المستخدم يجب أن يحتوي على أحرف (عربية/إنجليزية) وأرقام فقط بدون مسافات أو رموز');
        return;
      }

      if (formData.phone && !/^\d+$/.test(formData.phone)) {
        Alert.alert('خطأ', 'رقم الجوال يجب أن يتكون من أرقام فقط');
        return;
      }

      if (!editingId) {
        if (activeTab === 'drivers' && drivers.length >= schoolLimits.maxBuses) {
          Alert.alert('تنبيه الباقة', `لقد وصلت للحد الأقصى المسموح به من الحافلات (${schoolLimits.maxBuses}). يرجى ترقية باقة اشتراكك.`);
          return;
        }
        if (activeTab === 'students' && students.length >= schoolLimits.maxStudents) {
          Alert.alert('تنبيه الباقة', `لقد وصلت للحد الأقصى المسموح به من الطلاب (${schoolLimits.maxStudents}). يرجى ترقية باقة اشتراكك.`);
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
      permissions: {
        ...currentPerms,
        [permId]: !currentPerms[permId]
      }
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
    } catch (e) { console.log('Error marking as read:', e); }
  };

  const toggleMsgSelection = (id) => {
    if (selectedMsgs.includes(id)) {
      setSelectedMsgs(selectedMsgs.filter(i => i !== id));
    } else {
      setSelectedMsgs([...selectedMsgs, id]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedMsgs.length === 0) return;
    Alert.alert('حذف الرسائل', `هل أنت متأكد من حذف ${selectedMsgs.length} رسالة؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { 
        text: 'حذف', 
        style: 'destructive',
        onPress: async () => {
          try {
            for (const id of selectedMsgs) {
              await saveSchoolItem(schoolId, 'messages', id, null);
            }
            setSelectedMsgs([]);
            setIsSelectionMode(false);
            Alert.alert('تم', 'تم حذف الرسائل المختارة بنجاح');
          } catch (e) {
            Alert.alert('خطأ', 'فشل حذف بعض الرسائل');
          }
        }
      }
    ]);
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
      console.error('Reply Error:', e);
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
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

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
    <ScrollView style={{ padding: 15, backgroundColor: '#F8FAFC' }}>
      <View style={styles.reportCard}>
        <Text style={styles.reportCardTitle}>📊 ملخص إحصائيات المدرسة</Text>
        <View style={styles.reportGrid}>
          <View style={styles.reportItem}>
            <Text style={styles.reportItemValue}>{stats.students}</Text>
            <Text style={styles.reportItemLabel}>الطلاب</Text>
          </View>
          <View style={styles.reportItem}>
            <Text style={styles.reportItemValue}>{stats.buses}</Text>
            <Text style={styles.reportItemLabel}>الحافلات</Text>
          </View>
          <View style={styles.reportItem}>
            <Text style={styles.reportItemValue}>{stats.staff}</Text>
            <Text style={styles.reportItemLabel}>المرافقات</Text>
          </View>
          <View style={styles.reportItem}>
            <Text style={styles.reportItemValue}>{stats.parents}</Text>
            <Text style={styles.reportItemLabel}>أولياء الأمور</Text>
          </View>
        </View>
      </View>

      <View style={styles.reportCard}>
        <Text style={styles.reportCardTitle}>🚍 الرحلات النشطة ({stats.activeTrips})</Text>
        {drivers.filter(d => d.isOnline).length > 0 ? (
          drivers.filter(d => d.isOnline).map(d => (
            <View key={d.id} style={styles.tripItem}>
              <TouchableOpacity 
                style={styles.trackBtn} 
                onPress={() => {
                  if (d.location) {
                    Alert.alert('موقع الحافلة', `خط العرض: ${d.location.latitude}\nخط الطول: ${d.location.longitude}`);
                  } else {
                    Alert.alert('تنبيه', 'الموقع غير متاح حالياً');
                  }
                }}
              >
                <Text style={styles.trackBtnText}>تتبع</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.tripName}>{d.name}</Text>
                <Text style={styles.tripPlate}>لوحة: {d.busPlate || '---'}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noDataText}>لا توجد رحلات جارية الآن</Text>
        )}
      </View>
      
      <View style={styles.reportCard}>
        <Text style={styles.reportCardTitle}>📅 حالة الاشتراك</Text>
        <Text style={styles.subscriptionDate}>تاريخ الانتهاء: {expiryDate.split('T')[0]}</Text>
        <Text style={[styles.subscriptionStatus, { color: isExpired ? '#EF4444' : '#10B981' }]}>
          الحالة: {isExpired ? 'منتهي (يرجى التجديد)' : 'نشط'}
        </Text>
      </View>

      <View style={[styles.reportCard, { marginBottom: 80 }]}>
        <Text style={styles.reportCardTitle}>📥 تصدير البيانات</Text>
        <View style={styles.exportButtonsRow}>
          <TouchableOpacity 
            style={[styles.exportButton, { backgroundColor: '#10B981' }]}
            onPress={() => exportToExcel(students, "جدول الطلاب", dynamicSchoolName, user?.displayName || user?.username || 'مدير المدرسة')}
          >
            <Text style={styles.exportButtonText}>الطلاب (Excel)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.exportButton, { backgroundColor: '#EF4444' }]}
            onPress={() => exportToPDF(students, "جدول الطلاب", dynamicSchoolName, user?.displayName || user?.username || 'مدير المدرسة')}
          >
            <Text style={styles.exportButtonText}>الطلاب (PDF)</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.exportButtonsRow}>
          <TouchableOpacity 
            style={[styles.exportButton, { backgroundColor: '#3B82F6' }]}
            onPress={() => exportToExcel(drivers, "جدول السائقين", dynamicSchoolName, user?.displayName || user?.username || 'مدير المدرسة')}
          >
            <Text style={styles.exportButtonText}>السائقين (Excel)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.exportButton, { backgroundColor: '#8B5CF6' }]}
            onPress={() => exportToPDF(drivers, "جدول السائقين", dynamicSchoolName, user?.displayName || user?.username || 'مدير المدرسة')}
          >
            <Text style={styles.exportButtonText}>السائقين (PDF)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderInput = (placeholder, field, isNumeric = false) => (
    <View style={styles.inputWrapper} key={field}>
      <Text style={styles.inputLabel}>{placeholder}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={formData[field] || ''}
        onChangeText={(txt) => setFormData({ ...formData, [field]: txt })}
        keyboardType={isNumeric ? 'numeric' : 'default'}
        editable={field === 'username' ? (activeTab === 'managers' ? true : !editingId) : true}
        placeholderTextColor="#CBD5E1"
      />
    </View>
  );

  const insets = useSafeAreaInsets();

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* شريط التنقل العلوي المحسن */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity style={styles.topBarIcon} onPress={() => setShowComplianceModal(true)}>
            <Text style={styles.topBarIconText}>⚠️</Text>
            {complianceAlerts.length > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.topBarIcon} onPress={() => setShowMsgModal(true)}>
            <Text style={styles.topBarIconText}>💬</Text>
            {adminMessages.filter(m => !m.read).length > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.topBarIcon} onPress={() => setShowProfileModal(true)}>
            <Text style={styles.topBarIconText}>⚙️</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.topBarRight}>
          <View style={styles.schoolInfo}>
            <Text style={styles.welcomeText}>مرحباً، {user?.name?.split(' ')[0] || 'أحمد'}</Text>
            <Text style={styles.schoolNameText}>{dynamicSchoolName || 'الدرة النموذجية'}</Text>
          </View>
          {schoolLogo ? (
            <Image source={{ uri: schoolLogo }} style={styles.schoolLogo} />
          ) : (
            <View style={styles.schoolLogoPlaceholder}>
              <Text style={{ fontSize: 20 }}>🏫</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.mainContent}>
        {/* قسم الإحصائيات */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>الإحصائيات الرئيسية</Text>
          <View style={styles.statsGrid}>
            {(isMainAdmin || (isSubManager && userPermissions?.view_buses)) && (
              <View style={[styles.statCard, { borderTopColor: '#3B82F6' }]}>
                <Text style={styles.statIcon}>🚌</Text>
                <Text style={styles.statValue}>{stats.buses}</Text>
                <Text style={styles.statLabel}>باصات</Text>
              </View>
            )}
            {(isMainAdmin || userPermissions?.manage_students) && (
              <View style={[styles.statCard, { borderTopColor: '#10B981' }]}>
                <Text style={styles.statIcon}>🎓</Text>
                <Text style={styles.statValue}>{stats.students}</Text>
                <Text style={styles.statLabel}>طلاب</Text>
              </View>
            )}
            {(isMainAdmin || (isSubManager && userPermissions?.view_active_trips)) && (
              <View style={[styles.statCard, { borderTopColor: '#F59E0B' }]}>
                <Text style={styles.statIcon}>📍</Text>
                <Text style={styles.statValue}>{stats.activeTrips}</Text>
                <Text style={styles.statLabel}>رحلات</Text>
              </View>
            )}
            {(isMainAdmin || userPermissions?.handle_emergencies) && (
              <TouchableOpacity 
                style={[styles.statCard, { borderTopColor: '#EF4444' }]}
                onPress={() => setActiveTab('emergencies')}
              >
                <Text style={styles.statIcon}>🚨</Text>
                <Text style={styles.statValue}>{stats.emergencies}</Text>
                <Text style={styles.statLabel}>طوارئ</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* قسم الإجراءات السريعة */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>الإجراءات السريعة</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={() => setShowMsgModal(true)}>
              <Text style={styles.actionIcon}>✉️</Text>
              <Text style={styles.actionLabel}>الرسائل</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => setShowBroadcastModal(true)}>
              <Text style={styles.actionIcon}>📢</Text>
              <Text style={styles.actionLabel}>إعلان عام</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => setShowExportModal(true)}>
              <Text style={styles.actionIcon}>📥</Text>
              <Text style={styles.actionLabel}>تصدير</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => setShowComplianceModal(true)}>
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionLabel}>الأوراق</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* قسم البحث والتبويبات */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <TextInput 
              style={styles.searchInput} 
              placeholder="ابحث هنا..." 
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#CBD5E1"
            />
            <Text style={styles.searchIcon}>🔍</Text>
          </View>
        </View>

        {/* التبويبات المحسنة */}
        <View style={styles.tabsSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
            {isMainAdmin && (
              <TouchableOpacity style={[styles.tab, activeTab === 'drivers' && styles.tabActive]} onPress={() => setActiveTab('drivers')}>
                <Text style={[styles.tabText, activeTab === 'drivers' && styles.tabTextActive]}>السائقين</Text>
              </TouchableOpacity>
            )}
            {(isMainAdmin || canViewTab('staff')) && (
              <TouchableOpacity style={[styles.tab, activeTab === 'staff' && styles.tabActive]} onPress={() => setActiveTab('staff')}>
                <Text style={[styles.tabText, activeTab === 'staff' && styles.tabTextActive]}>المرافقات</Text>
              </TouchableOpacity>
            )}
            {(isMainAdmin || canViewTab('parents')) && (
              <TouchableOpacity style={[styles.tab, activeTab === 'parents' && styles.tabActive]} onPress={() => setActiveTab('parents')}>
                <Text style={[styles.tabText, activeTab === 'parents' && styles.tabTextActive]}>أولياء الأمور</Text>
              </TouchableOpacity>
            )}
            {(isMainAdmin || canViewTab('students')) && (
              <TouchableOpacity style={[styles.tab, activeTab === 'students' && styles.tabActive]} onPress={() => setActiveTab('students')}>
                <Text style={[styles.tabText, activeTab === 'students' && styles.tabTextActive]}>الطلاب</Text>
              </TouchableOpacity>
            )}
            {(isMainAdmin || canViewTab('managers')) && (
              <TouchableOpacity style={[styles.tab, activeTab === 'managers' && styles.tabActive]} onPress={() => setActiveTab('managers')}>
                <Text style={[styles.tabText, activeTab === 'managers' && styles.tabTextActive]}>المدراء</Text>
              </TouchableOpacity>
            )}
            {(isMainAdmin || canViewTab('emergencies')) && (
              <TouchableOpacity style={[styles.tab, activeTab === 'emergencies' && styles.tabActive]} onPress={() => setActiveTab('emergencies')}>
                <Text style={[styles.tabText, activeTab === 'emergencies' && styles.tabTextActive]}>الطوارئ</Text>
              </TouchableOpacity>
            )}
            {(isMainAdmin || canViewTab('reports')) && (
              <TouchableOpacity style={[styles.tab, activeTab === 'reports' && styles.tabActive]} onPress={() => setActiveTab('reports')}>
                <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>التقارير</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* قسم عرض البيانات */}
        <View style={styles.dataSection}>
          {activeTab === 'reports' ? renderReports() : (
            <FlatList
              data={currentData}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.dataList}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <SchoolDataItem 
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
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>لا توجد بيانات لعرضها</Text>}
            />
          )}
        </View>
      </ScrollView>

      {/* زر الإضافة */}
      {(isMainAdmin || userPermissions?.edit_items) && activeTab !== 'reports' && (
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => { setFormData({}); setEditingId(null); setShowForm(true); }}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      )}

      {/* نماذج المودال - سيتم إضافتها هنا */}
      {/* ... (جميع النماذج من الملف الأصلي) */}

      {/* مودال الإعلان العام */}
      <Modal visible={showBroadcastModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📢 إرسال إعلان عام</Text>
            <View style={styles.targetContainer}>
              <TouchableOpacity 
                style={[styles.targetBtn, broadcastTarget === 'all' && styles.targetBtnActive]} 
                onPress={() => setBroadcastTarget('all')}
              >
                <Text style={[styles.targetText, broadcastTarget === 'all' && styles.targetTextActive]}>الكل</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.targetBtn, broadcastTarget === 'parents' && styles.targetBtnActive]} 
                onPress={() => setBroadcastTarget('parents')}
              >
                <Text style={[styles.targetText, broadcastTarget === 'parents' && styles.targetTextActive]}>أولياء الأمور</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.targetBtn, broadcastTarget === 'drivers' && styles.targetBtnActive]} 
                onPress={() => setBroadcastTarget('drivers')}
              >
                <Text style={[styles.targetText, broadcastTarget === 'drivers' && styles.targetTextActive]}>السائقين</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.msgInput}
              placeholder="اكتب محتوى الإعلان هنا..."
              value={broadcastContent}
              onChangeText={setBroadcastContent}
              multiline
              placeholderTextColor="#CBD5E1"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.sendBtn]} onPress={handleSendBroadcast}>
                <Text style={styles.modalBtnText}>إرسال الآن</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.closeBtn]} onPress={() => setShowBroadcastModal(false)}>
                <Text style={styles.modalBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* مودال الملف الشخصي */}
      <Modal visible={showProfileModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.profileHeader}>
              {schoolLogo ? (
                <Image source={{ uri: schoolLogo }} style={styles.profileLogo} />
              ) : (
                <View style={styles.profileLogoPlaceholder}><Text style={{ fontSize: 40 }}>🏫</Text></View>
              )}
              <Text style={styles.profileName}>{user?.name}</Text>
              <Text style={styles.profileSchool}>{dynamicSchoolName}</Text>
            </View>

            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>تاريخ انتهاء الاشتراك:</Text>
              <Text style={[styles.profileValue, { color: isExpired ? '#EF4444' : '#10B981' }]}>{expiryDate.split('T')[0]}</Text>
            </View>

            <TouchableOpacity style={styles.profileBtn} onPress={() => { setShowProfileModal(false); setShowSocialModal(true); }}>
              <Text style={styles.profileBtnText}>🔗 إعدادات التواصل الاجتماعي</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.profileBtn, { backgroundColor: '#FEE2E2' }]} onPress={handleLogout}>
              <Text style={[styles.profileBtnText, { color: '#EF4444' }]}>🚪 تسجيل الخروج</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowProfileModal(false)}>
              <Text style={styles.closeBtnText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال روابط التواصل الاجتماعي */}
      <Modal visible={showSocialModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>روابط التواصل الاجتماعي</Text>
            <View style={{ marginBottom: 15 }}>
              <Text style={styles.inputLabel}>رابط Facebook:</Text>
              <TextInput 
                style={styles.socialInput} 
                placeholder="https://facebook.com/..." 
                value={socialLinks.facebook}
                onChangeText={(t) => setSocialLinks({ ...socialLinks, facebook: t })}
                placeholderTextColor="#CBD5E1"
              />
            </View>
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.inputLabel}>رابط Instagram:</Text>
              <TextInput 
                style={styles.socialInput} 
                placeholder="https://instagram.com/..." 
                value={socialLinks.instagram}
                onChangeText={(t) => setSocialLinks({ ...socialLinks, instagram: t })}
                placeholderTextColor="#CBD5E1"
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.sendBtn]} onPress={() => handleAction('save_social')}>
                <Text style={styles.modalBtnText}>حفظ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.closeBtn]} onPress={() => setShowSocialModal(false)}>
                <Text style={styles.modalBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* مودال إدارة الأسطول والأوراق القانونية */}
      <Modal visible={showComplianceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '70%' }]}>
            <Text style={styles.modalTitle}>📑 إدارة الأسطول والأوراق القانونية</Text>
            <Text style={styles.complianceSubtitle}>تنبيهات تلقائية للأوراق التي تنتهي خلال 30 يوماً</Text>
            
            {complianceAlerts.length > 0 ? (
              <FlatList
                data={complianceAlerts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.complianceAlert, { backgroundColor: item.isExpired ? '#FEF2F2' : '#FFFBEB' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.complianceAlertTitle}>{item.label} - {item.driverName}</Text>
                      <Text style={[styles.complianceAlertStatus, { color: item.isExpired ? '#EF4444' : '#F59E0B' }]}>
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

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowComplianceModal(false)}>
              <Text style={styles.closeBtnText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال الرسائل */}
      <Modal visible={showMsgModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <Text style={styles.modalTitle}>📬 مركز التواصل</Text>
            
            <View style={styles.commTabs}>
              <TouchableOpacity 
                style={[styles.commTab, communicationTab === 'announcements' && styles.commTabActive]} 
                onPress={() => setCommunicationTab('announcements')}
              >
                <Text style={[styles.commTabText, communicationTab === 'announcements' && styles.commTabTextActive]}>إعلانات</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.commTab, communicationTab === 'messages' && styles.commTabActive]} 
                onPress={() => setCommunicationTab('messages')}
              >
                <Text style={[styles.commTabText, communicationTab === 'messages' && styles.commTabTextActive]}>رسائل</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.commTab, communicationTab === 'complaints' && styles.commTabActive]} 
                onPress={() => setCommunicationTab('complaints')}
              >
                <Text style={[styles.commTabText, communicationTab === 'complaints' && styles.commTabTextActive]}>شكاوى</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowMsgModal(false)}>
              <Text style={styles.closeBtnText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال الإضافة والتعديل */}
      <Modal visible={showForm} animationType="slide">
        <SafeAreaView style={styles.formContainer}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={styles.formCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>{editingId ? 'تعديل بيانات' : 'إضافة جديد'}</Text>
            <View style={{ width: 30 }} />
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false} style={styles.formContent}>
            {renderInput('الاسم الكامل', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {renderInput('كلمة السر', 'password')}
            
            {activeTab === 'drivers' && renderInput('رقم الجوال', 'phone', true)}
            {activeTab === 'drivers' && renderInput('رقم اللوحة', 'busPlate')}
            {activeTab === 'drivers' && (
              <View style={styles.complianceSection}>
                <Text style={styles.complianceSectionTitle}>📑 الأوراق الرسمية</Text>
                {renderInput('تاريخ انتهاء رخصة السائق', 'driverLicenseExpiry')}
                {renderInput('تاريخ انتهاء تأمين الحافلة', 'busInsuranceExpiry')}
                {renderInput('تاريخ انتهاء رخصة الحافلة', 'busLicenseExpiry')}
                {renderInput('موعد غيار الزيت القادم', 'oilChangeDate')}
              </View>
            )}
            {activeTab === 'students' && renderInput('الصف', 'class')}
            
            {activeTab === 'students' && (
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>اختيار ولي الأمر:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
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
                <Text style={styles.inputLabel}>اختيار السائق:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
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
                <Text style={styles.permsSectionTitle}>تحديد الصلاحيات للمدير الفرعي:</Text>
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

          <View style={styles.formFooter}>
            <TouchableOpacity style={[styles.formBtn, styles.formBtnCancel]} onPress={() => setShowForm(false)}>
              <Text style={styles.formBtnText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.formBtn, styles.formBtnSave]} onPress={() => handleAction('save')}>
              <Text style={styles.formBtnText}>حفظ</Text>
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
  
  // شريط التنقل العلوي
  topBar: { 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
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
  topBarLeft: { flexDirection: 'row', gap: 8 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topBarIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  topBarIconText: { fontSize: 18 },
  badge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  
  schoolInfo: { alignItems: 'flex-end' },
  welcomeText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  schoolNameText: { fontSize: 12, color: '#64748B', marginTop: 2 },
  schoolLogo: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#F1F5F9' },
  schoolLogoPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  
  // المحتوى الرئيسي
  mainContent: { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
  
  // قسم الإحصائيات
  statsSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 12, paddingHorizontal: 4 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  statCard: { 
    flex: 1, 
    backgroundColor: '#FFF', 
    borderRadius: 14, 
    padding: 12, 
    alignItems: 'center',
    borderTopWidth: 3,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  statIcon: { fontSize: 24, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 4, textAlign: 'center' },
  
  // قسم الإجراءات السريعة
  quickActionsSection: { marginBottom: 20 },
  quickActionsGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  actionCard: { 
    flex: 1, 
    backgroundColor: '#FFF', 
    borderRadius: 14, 
    padding: 12, 
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  actionIcon: { fontSize: 24, marginBottom: 6 },
  actionLabel: { fontSize: 11, color: '#1E293B', fontWeight: '600', textAlign: 'center' },
  
  // قسم البحث
  searchSection: { marginBottom: 16 },
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    borderRadius: 12, 
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 44
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B', textAlign: 'right' },
  searchIcon: { fontSize: 16, marginLeft: 8 },
  
  // التبويبات
  tabsSection: { marginBottom: 16 },
  tabsContainer: { gap: 8, paddingHorizontal: 4 },
  tab: { 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 10, 
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  tabActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  tabText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  tabTextActive: { color: '#FFF' },
  
  // قسم البيانات
  dataSection: { marginBottom: 20 },
  dataList: { paddingHorizontal: 4 },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 30, fontSize: 14 },
  
  // زر الإضافة
  addButton: { 
    position: 'absolute', 
    bottom: 30, 
    right: 20, 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: '#10B981', 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  addButtonText: { fontSize: 28, color: '#FFF', fontWeight: '300' },
  
  // التقارير
  reportCard: { 
    backgroundColor: '#FFF', 
    borderRadius: 14, 
    padding: 16, 
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  reportCardTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  reportGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  reportItem: { flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: '#F8FAFC', borderRadius: 10 },
  reportItemValue: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  reportItemLabel: { fontSize: 11, color: '#64748B', marginTop: 4 },
  tripItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  trackBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 10 },
  trackBtnText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  tripName: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  tripPlate: { fontSize: 11, color: '#64748B', marginTop: 2 },
  noDataText: { color: '#94A3B8', fontSize: 12, marginTop: 8 },
  subscriptionDate: { fontSize: 13, color: '#64748B', marginBottom: 6 },
  subscriptionStatus: { fontSize: 13, fontWeight: '600' },
  exportButtonsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  exportButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  exportButtonText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  
  // المودالز
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', textAlign: 'center', marginBottom: 16 },
  complianceSubtitle: { textAlign: 'center', color: '#64748B', marginBottom: 12, fontSize: 12 },
  complianceAlert: { padding: 12, borderRadius: 10, marginBottom: 8, borderRightWidth: 4, flexDirection: 'row', alignItems: 'center', gap: 10 },
  complianceAlertTitle: { fontWeight: '600', color: '#1E293B', fontSize: 13 },
  complianceAlertStatus: { fontSize: 11, marginTop: 2 },
  
  targetContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16, gap: 8 },
  targetBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  targetBtnActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  targetText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  targetTextActive: { color: '#FFF' },
  
  msgInput: { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, textAlign: 'right', height: 100, textAlignVertical: 'top', marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  modalBtns: { flexDirection: 'row', gap: 8 },
  modalBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  sendBtn: { backgroundColor: '#10B981' },
  closeBtn: { backgroundColor: '#94A3B8' },
  modalBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  closeBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  
  // الملف الشخصي
  profileHeader: { alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  profileLogo: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  profileLogoPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  profileName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  profileSchool: { fontSize: 12, color: '#64748B', marginTop: 4 },
  profileItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  profileLabel: { fontSize: 12, color: '#64748B' },
  profileValue: { fontSize: 13, fontWeight: '600', color: '#1E293B', marginTop: 4 },
  profileBtn: { backgroundColor: '#EFF6FF', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#DBEAFE' },
  profileBtnText: { color: '#3B82F6', fontWeight: '600', fontSize: 13 },
  
  socialInput: { backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, textAlign: 'left', borderWidth: 1, borderColor: '#E2E8F0', marginTop: 6 },
  
  // التواصل
  commTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  commTab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  commTabActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  commTabText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  commTabTextActive: { color: '#FFF' },
  
  // النموذج
  formContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  formCloseText: { fontSize: 24, color: '#64748B', fontWeight: '300' },
  formContent: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  formFooter: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  formBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  formBtnCancel: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  formBtnSave: { backgroundColor: '#3B82F6' },
  formBtnText: { fontWeight: '600', fontSize: 14, color: '#FFF' },
  
  inputWrapper: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#1E293B', marginBottom: 6 },
  input: { backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  
  complianceSection: { backgroundColor: '#F0F9FF', borderRadius: 12, padding: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
  complianceSectionTitle: { fontSize: 13, fontWeight: '700', color: '#3B82F6', marginBottom: 12 },
  
  pickerScroll: { flexDirection: 'row-reverse' },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F5F9', marginHorizontal: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  pickerItemActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  pickerText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  pickerTextActive: { color: '#FFF' },
  
  permsSection: { backgroundColor: '#F0F9FF', borderRadius: 12, padding: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
  permsSectionTitle: { fontSize: 13, fontWeight: '700', color: '#3B82F6', marginBottom: 12 },
  permRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#DBEAFE' },
  permLabel: { fontSize: 12, color: '#1E293B', fontWeight: '500' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  checkMark: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
});
