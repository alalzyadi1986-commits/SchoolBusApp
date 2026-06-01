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

// استيراد الخدمات والمسارات الجديدة
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
  
  // تحديد هل المستخدم هو المدير الرئيسي أم مدير فرعي
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
  const [communicationTab, setCommunicationTab] = useState('announcements'); // 'announcements', 'messages', 'complaints'
  
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [selectedMsgs, setSelectedMsgs] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // ميزة الإعلانات المدرسية
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState('all'); // 'all', 'parents', 'drivers'
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

    // تحديد التبويب الافتراضي بناءً على الصلاحيات للمدير الفرعي
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

  // مراقبة حالات الطوارئ الجديدة لإظهار تنبيه فوري
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
      // السائقين والمدراء متاحين فقط للمدير الرئيسي افتراضياً، إلا إذا تم تعديل ذلك لاحقاً
      if (tabId === 'drivers' || tabId === 'managers') return false; 
      
      // التحقق من الصلاحيات المخصصة للمدير الفرعي مع حماية من القيم غير المعرفة
	      if (tabId === 'staff') return !!userPermissions?.manage_staff;
	      if (tabId === 'parents' || tabId === 'students') return !!userPermissions?.manage_students;
	      if (tabId === 'reports') return !!userPermissions?.view_reports;
	      if (tabId === 'emergencies') return !!userPermissions?.handle_emergencies;
	      if (tabId === 'edit_items') return !!userPermissions?.edit_items;
	      if (tabId === 'delete_items') return !!userPermissions?.delete_items;
      
      // تبويب افتراضي قد يحتاجه المدير الفرعي إذا لم يكن هناك قيود
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
            // ملاحظة: الحذف يتم عن طريق تمرير null كـ formData لحذف العقدة
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
      <View style={[styles.card, { flexDirection: 'column', alignItems: 'flex-end' }]}>
        <Text style={[styles.cardTitle, { marginBottom: 15 }]}>📊 ملخص إحصائيات المدرسة</Text>
        <View style={styles.reportRow}><Text style={styles.reportValue}>{stats.students}</Text><Text style={styles.reportLabel}>إجمالي الطلاب:</Text></View>
        <View style={styles.reportRow}><Text style={styles.reportValue}>{stats.buses}</Text><Text style={styles.reportLabel}>إجمالي الحافلات:</Text></View>
        <View style={styles.reportRow}><Text style={styles.reportValue}>{stats.staff}</Text><Text style={styles.reportLabel}>إجمالي المرافقات:</Text></View>
        <View style={styles.reportRow}><Text style={styles.reportValue}>{stats.parents}</Text><Text style={styles.reportLabel}>إجمالي أولياء الأمور:</Text></View>
        <View style={styles.reportRow}><Text style={[styles.reportValue, { color: '#EF4444' }]}>{stats.emergencies}</Text><Text style={styles.reportLabel}>طوارئ لم تُحل:</Text></View>
      </View>

      <View style={[styles.card, { flexDirection: 'column', alignItems: 'flex-end', marginTop: 10 }]}>
        <Text style={[styles.cardTitle, { marginBottom: 10 }]}>🚍 الرحلات النشطة حالياً ({stats.activeTrips})</Text>
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
      
      <View style={[styles.card, { flexDirection: 'column', alignItems: 'flex-end', marginTop: 10 }]}>
        <Text style={styles.cardTitle}>📅 حالة الاشتراك</Text>
        <Text style={[styles.cardSub, { marginTop: 5 }]}>تاريخ الانتهاء: {expiryDate.split('T')[0]}</Text>
        <Text style={[styles.cardSub, { color: isExpired ? '#EF4444' : '#10B981', fontWeight: 'bold' }]}>
          الحالة: {isExpired ? 'منتهي (يرجى التجديد)' : 'نشط'}
        </Text>
      </View>

      <View style={[styles.card, { flexDirection: 'column', alignItems: 'flex-end', marginTop: 10, marginBottom: 50 }]}>
        <Text style={[styles.cardTitle, { marginBottom: 15 }]}>📥 تصدير البيانات</Text>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-around', width: '100%' }}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#10B981', width: '45%' }]}
            onPress={() => exportToExcel(students, "جدول الطلاب", dynamicSchoolName, user?.displayName || user?.username || 'مدير المدرسة')}
          >
            <Text style={styles.actionButtonText}>تصدير الطلاب (Excel)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#EF4444', width: '45%' }]}
            onPress={() => exportToPDF(students, "جدول الطلاب", dynamicSchoolName, user?.displayName || user?.username || 'مدير المدرسة')}
          >
            <Text style={styles.actionButtonText}>تصدير الطلاب (PDF)</Text>
          </TouchableOpacity>
        </View>
        
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-around', width: '100%', marginTop: 10 }}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#3B82F6', width: '45%' }]}
            onPress={() => exportToExcel(drivers, "جدول السائقين", dynamicSchoolName, user?.displayName || user?.username || 'مدير المدرسة')}
          >
            <Text style={styles.actionButtonText}>تصدير السائقين (Excel)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#8B5CF6', width: '45%' }]}
            onPress={() => exportToPDF(drivers, "جدول السائقين", dynamicSchoolName, user?.displayName || user?.username || 'مدير المدرسة')}
          >
            <Text style={styles.actionButtonText}>تصدير السائقين (PDF)</Text>
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

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.imgHeader}>
        <View style={styles.imgHeaderLeft}>
          <TouchableOpacity style={styles.imgIconBtn} onPress={() => setShowComplianceModal(true)}>
            <Text style={{ fontSize: 24 }}>⚠️</Text>
            {complianceAlerts.length > 0 && <View style={[styles.imgBadge, { backgroundColor: '#F59E0B' }]} />}
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

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>الإحصائاء العامة</Text>
        </View>

        <View style={styles.imgStatsRow}>
          {(isMainAdmin || (isSubManager && userPermissions?.view_buses)) && (
            <View style={[styles.imgStatCard, { borderRightColor: '#3B82F6' }]}>
              <Text style={{ fontSize: 28, marginBottom: 5 }}>🚌</Text>
              <Text style={styles.imgStatValue}>{stats.buses}</Text>
              <Text style={styles.imgStatLabel}>باصات</Text>
            </View>
          )}
          {(isMainAdmin || userPermissions?.manage_students) && (
            <View style={[styles.imgStatCard, { borderRightColor: '#10B981' }]}>
              <Text style={{ fontSize: 28, marginBottom: 5 }}>🎓</Text>
              <Text style={styles.imgStatValue}>{stats.students}</Text>
              <Text style={styles.imgStatLabel}>طلاب</Text>
            </View>
          )}
          {(isMainAdmin || (isSubManager && userPermissions?.view_active_trips)) && (
            <View style={[styles.imgStatCard, { borderRightColor: '#F59E0B' }]}>
              <Text style={{ fontSize: 28, marginBottom: 5 }}>📍</Text>
              <Text style={styles.imgStatValue}>{stats.activeTrips}</Text>
              <Text style={styles.imgStatLabel}>رحلات</Text>
            </View>
          )}
          {(isMainAdmin || userPermissions?.handle_emergencies) && (
            <TouchableOpacity 
              style={[styles.imgStatCard, { borderRightColor: '#EF4444' }]}
              onPress={() => setActiveTab('emergencies')}
            >
              <View style={styles.emergencyIcon}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>!</Text></View>
              <Text style={styles.imgStatValue}>{stats.emergencies}</Text>
              <Text style={styles.imgStatLabel}>طوارئ</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>الأختلال السريعة</Text>
        </View>

        {/* قسم الإجراءات السريعة */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>الإجراءات السريعة</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={() => setShowMsgModal(true)}>
              <Text style={styles.actionIcon}>✉️</Text>
              <Text style={styles.actionLabel}>الرسائل</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imgActionBox} onPress={() => setShowMsgModal(true)}>
              <Text style={{ fontSize: 26, marginBottom: 8 }}>✉️</Text>
              <Text style={styles.imgActionLabel}>رسائل الإدارة</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => setShowExportModal(true)}>
              <Text style={styles.actionIcon}>📥</Text>
              <Text style={styles.actionLabel}>تصدير</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imgActionBox} onPress={() => setShowMsgModal(true)}>
              <Text style={{ fontSize: 26, marginBottom: 8 }}>📷</Text>
              <Text style={styles.imgActionLabel}>رسائل الإدارة</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.imgActionRow}>
            <View style={{ width: '23.5%' }} />
            <View style={{ width: '23.5%' }} />
            <View style={{ width: '23.5%' }} />
            <TouchableOpacity style={[styles.imgActionBox, { width: '23.5%' }]} onPress={() => navigation.navigate('SetSchoolLocation', { schoolId })}>
              <Text style={{ fontSize: 26, marginBottom: 8 }}>🏫</Text>
              <Text style={styles.imgActionLabel}>موقع المدرسة والروابط</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.imgSearchWrapper}>
          <View style={styles.imgSearchContainer}>
            <Text style={{ fontSize: 18, color: '#94A3B8', marginLeft: 10 }}>🔍</Text>
            <TextInput 
              style={styles.imgSearchInput} 
              placeholder="بحث شامل (أولياء الأمور، السائقين، المرافقات)..." 
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#CBD5E1"
            />
            <Text style={styles.searchIcon}>🔍</Text>
          </View>
        </View>

        <View style={styles.imgAccountsSection}>
          <Text style={styles.imgAccountsTitle}>إدارة القوائم والحسابات</Text>
          <View style={styles.imgAccountsRow}>
            <TouchableOpacity 
              style={[styles.imgAccountCard, { borderColor: '#3B82F6' }, activeTab === 'parents' && styles.imgAccountCardActive]} 
              onPress={() => setActiveTab('parents')}
            >
              <Text style={{ fontSize: 40, marginBottom: 10 }}>👨‍👩‍👧‍👦</Text>
              <Text style={styles.imgAccountLabel}>أولياء الأمور</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.imgAccountCard, { borderColor: '#10B981' }, activeTab === 'drivers' && styles.imgAccountCardActive]} 
              onPress={() => setActiveTab('drivers')}
            >
              <Text style={{ fontSize: 40, marginBottom: 10 }}>🚐</Text>
              <Text style={styles.imgAccountLabel}>السائقين</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.imgAccountCard, { borderColor: '#F59E0B' }, activeTab === 'staff' && styles.imgAccountCardActive]} 
              onPress={() => setActiveTab('staff')}
            >
              <Text style={{ fontSize: 40, marginBottom: 10 }}>❤️</Text>
              <Text style={styles.imgAccountLabel}>المرافقات</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.imgExportBtn} onPress={() => setShowExportModal(true)}>
          <Text style={styles.imgExportBtnText}>Export Reports 📥</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.searchWrapper}>
        <TextInput 
          style={styles.searchInput} 
          placeholder="🔍 ابحث عن اسم، رقم باص، أو مستخدم..." 
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.tabsWrapper}>
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
              <Text style={[styles.tabText, activeTab === 'managers' && styles.tabTextActive]}>المدراء الفرعيين</Text>
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



      {activeTab === 'reports' ? renderReports() : (
      <FlatList
        data={currentData}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
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

	      {/* زر الإضافة المطور */}
	      {(isMainAdmin || userPermissions?.edit_items) && activeTab !== 'reports' && (
	        <TouchableOpacity 
	          style={[styles.addBtn, { backgroundColor: '#10B981', shadowColor: '#10B981' }]} 
	          onPress={() => { setFormData({}); setEditingId(null); setShowForm(true); }}
	        >
	          <Text style={styles.addBtnText}>➕ إضافة جديد</Text>
	        </TouchableOpacity>
	      )}

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

      {/* مودال تصدير التقارير الموحد */}
      <Modal visible={showExportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📥 تصدير التقارير</Text>
            <Text style={{ textAlign: 'center', color: '#64748B', marginBottom: 20 }}>اختر نوع التقرير والصيغة المطلوبة</Text>
            
            <View style={styles.exportSection}>
              <Text style={styles.exportLabel}>📊 تقارير الطلاب:</Text>
              <View style={styles.exportRow}>
                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#10B981' }]} onPress={() => exportToExcel(students, 'طلاب المدرسة')}>
                  <Text style={styles.exportBtnText}>Excel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#EF4444' }]} onPress={() => exportToPDF(students, 'طلاب المدرسة')}>
                  <Text style={styles.exportBtnText}>PDF</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.exportSection}>
              <Text style={styles.exportLabel}>🚐 تقارير السائقين:</Text>
              <View style={styles.exportRow}>
                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#10B981' }]} onPress={() => exportToExcel(drivers, 'سائقي المدرسة')}>
                  <Text style={styles.exportBtnText}>Excel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: '#EF4444' }]} onPress={() => exportToPDF(drivers, 'سائقي المدرسة')}>
                  <Text style={styles.exportBtnText}>PDF</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[styles.closeBtn, { marginTop: 20 }]} onPress={() => setShowExportModal(false)}>
              <Text style={styles.closeBtnText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال الملف الشخصي والإعدادات */}
      <Modal visible={showProfileModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.profileHeader}>
              {schoolLogo ? (
                <Image source={{ uri: schoolLogo }} style={styles.profileLogo} />
              ) : (
                <View style={styles.profileLogoPlaceholder}><Text style={{ fontSize: 40 }}>🏫</Text></View>
              )}
              <Text style={[styles.adminName, { marginTop: 10, fontSize: 20 }]}>{user?.name}</Text>
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
                style={[styles.searchInput, { textAlign: 'left' }]} 
                placeholder="https://facebook.com/..." 
                value={socialLinks.facebook}
                onChangeText={(t) => setSocialLinks({ ...socialLinks, facebook: t })}
                placeholderTextColor="#CBD5E1"
              />
            </View>
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.inputLabel}>رابط Instagram:</Text>
              <TextInput 
                style={[styles.searchInput, { textAlign: 'left' }]} 
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

      {/* مودال الأوراق القانونية للأسطول */}
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

      {/* مركز التواصل الموحد */}
      <Modal visible={showMsgModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%', paddingHorizontal: 0 }]}>
            <Text style={styles.modalTitle}>📬 مركز التواصل</Text>
            
            <View style={styles.commTabs}>
              <TouchableOpacity 
                style={[styles.commTab, communicationTab === 'announcements' && styles.commTabActive]} 
                onPress={() => setCommunicationTab('announcements')}
              >
                <Text style={[styles.commTabText, communicationTab === 'announcements' && styles.commTabTextActive]}>إعلان عام</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.commTab, communicationTab === 'messages' && styles.commTabActive]} 
                onPress={() => setCommunicationTab('messages')}
              >
                <Text style={[styles.commTabText, communicationTab === 'messages' && styles.commTabTextActive]}>رسائل الإدارة</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.commTab, communicationTab === 'complaints' && styles.commTabActive]} 
                onPress={() => setCommunicationTab('complaints')}
              >
                <Text style={[styles.commTabText, communicationTab === 'complaints' && styles.commTabTextActive]}>الشكاوى</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, padding: 15 }}>
              {communicationTab === 'announcements' && (
                <View>
                  <Text style={styles.inputLabel}>📢 إرسال إعلان للمدرسة</Text>
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
                  <TouchableOpacity style={[styles.modalBtn, styles.sendBtn, { marginTop: 15 }]} onPress={handleSendBroadcast}>
                    <Text style={styles.modalBtnText}>إرسال الإعلان الآن</Text>
                  </TouchableOpacity>
                </View>
              )}

              {communicationTab === 'messages' && (
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
                      {!item.replyContent && item.type === 'broadcast' && (
                        <TouchableOpacity style={styles.replyButton} onPress={() => setSelectedMessageForReply(item)}>
                          <Text style={styles.replyButtonText}>رد</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  )}
                />
              )}

              {communicationTab === 'complaints' && (
                <View style={styles.centered}><Text style={{ color: '#64748B' }}>لا توجد شكاوى حالياً</Text></View>
              )}
            </View>

            <TouchableOpacity style={[styles.closeBtn, { marginHorizontal: 20, marginBottom: 20 }]} onPress={() => setShowMsgModal(false)}>
              <Text style={styles.closeBtnText}>إغلاق المركز</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال الإضافة والتعديل المطور مع الصلاحيات */}
      <Modal visible={showForm} animationType="slide">
        <SafeAreaView style={{ flex: 1, padding: 20 }}>
          <Text style={[styles.title, { textAlign: 'center', marginBottom: 20 }]}>{editingId ? 'تعديل بيانات' : 'إضافة جديد'}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {renderInput('الاسم الكامل', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {renderInput('كلمة السر', 'password')}
            
	            {activeTab === 'drivers' && renderInput('رقم الجوال', 'phone', true)}
	            {activeTab === 'drivers' && renderInput('رقم اللوحة', 'busPlate')}
	            {activeTab === 'drivers' && (
	              <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, marginTop: 10 }}>
	                <Text style={[styles.inputLabel, { color: '#3B82F6' }]}>📑 الأوراق الرسمية (السائق والحافلة):</Text>
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row-reverse' }}>
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row-reverse' }}>
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
                <Text style={styles.permsTitle}>تحديد الصلاحيات للمدير الفرعي:</Text>
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
            <TouchableOpacity style={[styles.addBtn, { flex: 0.45, backgroundColor: '#64748B', position: 'relative', bottom: 0, left: 0, right: 0 }]} onPress={() => setShowForm(false)}>
              <Text style={styles.addBtnText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addBtn, { flex: 0.45, position: 'relative', bottom: 0, left: 0, right: 0 }]} onPress={() => handleAction('save')}>
              <Text style={styles.addBtnText}>حفظ</Text>
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
  imgHeader: { padding: 20, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  imgHeaderLeft: { flexDirection: 'row' },
  imgHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  imgIconBtn: { padding: 10, backgroundColor: '#F8FAFC', borderRadius: 15, marginLeft: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  imgBadge: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  imgWelcomeText: { fontSize: 16, color: '#1E293B', fontWeight: 'bold' },
  imgSchoolName: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  imgAvatar: { width: 55, height: 55, borderRadius: 27.5, borderWidth: 2, borderColor: '#F1F5F9' },
  sectionTitleRow: { paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', textAlign: 'right' },
  imgStatsRow: { flexDirection: 'row-reverse', paddingHorizontal: 15, justifyContent: 'space-between' },
  imgStatCard: { width: '23.5%', backgroundColor: '#FFF', padding: 15, borderRadius: 15, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, borderRightWidth: 4 },
  imgStatValue: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  imgStatLabel: { fontSize: 12, color: '#64748B', marginTop: 5, fontWeight: 'bold' },
  emergencyIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  imgActionsGrid: { paddingHorizontal: 15, marginTop: 10 },
  imgActionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12 },
  imgActionBox: { width: '23.5%', aspectRatio: 0.9, backgroundColor: '#FFF', borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, borderWidth: 1, borderColor: '#F1F5F9' },
  imgActionLabel: { fontSize: 9, fontWeight: 'bold', color: '#475569', textAlign: 'center', paddingHorizontal: 2 },
  imgSearchWrapper: { paddingHorizontal: 15, marginTop: 20 },
  imgSearchContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: '#E2E8F0', height: 55 },
  imgSearchInput: { flex: 1, textAlign: 'right', fontSize: 14, color: '#1E293B' },
  imgAccountsSection: { paddingHorizontal: 15, marginTop: 25 },
  imgAccountsTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', textAlign: 'right', marginBottom: 15 },
  imgAccountsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  imgAccountCard: { width: '31%', backgroundColor: '#FFF', padding: 20, borderRadius: 20, alignItems: 'center', borderWidth: 2, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  imgAccountCardActive: { backgroundColor: '#F8FAFC', scale: 1.05 },
  imgAccountLabel: { fontSize: 13, fontWeight: 'bold', color: '#1E293B' },
  imgExportBtn: { margin: 15, backgroundColor: '#F1F5F9', padding: 18, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  imgExportBtnText: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  cardSub: { fontSize: 13, color: '#64748B' },
  permsSummary: { fontSize: 11, color: '#3B82F6', marginTop: 2, fontWeight: 'bold' },
  cardActions: { flexDirection: 'row' },
  editBtn: { padding: 8, backgroundColor: '#EFF6FF', borderRadius: 8, marginRight: 8 },
  editBtnText: { color: '#3B82F6', fontSize: 12, fontWeight: 'bold' },
  deleteBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  deleteBtnText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
  addBtn: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: '#3B82F6', padding: 15, borderRadius: 15, alignItems: 'center', elevation: 5 },
  addBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  targetContainer: { flexDirection: 'row-reverse', justifyContent: 'space-around', marginBottom: 15 },
  targetBtn: { padding: 8, borderRadius: 10, backgroundColor: '#F1F5F9', flex: 1, marginHorizontal: 5, alignItems: 'center' },
  targetBtnActive: { backgroundColor: '#3B82F6' },
  targetText: { fontSize: 12, color: '#64748B' },
  targetTextActive: { color: '#FFF', fontWeight: 'bold' },
  msgInput: { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 15, textAlign: 'right', height: 100, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
  sendBtn: { backgroundColor: '#3B82F6' },
  closeBtn: { backgroundColor: '#94A3B8', marginTop: 15, padding: 12, borderRadius: 10, alignItems: 'center' },
  closeBtnText: { color: '#FFF', fontWeight: 'bold' },
  modalBtnText: { color: '#FFF', fontWeight: 'bold' },
  // أنماط جديدة لواجهة المحادثة
  chatBubble: { padding: 10, borderRadius: 10, marginBottom: 8, maxWidth: '80%' },
  chatBubbleAdmin: { backgroundColor: '#E2E8F0', alignSelf: 'flex-start', borderTopLeftRadius: 0 },
  chatBubbleSchool: { backgroundColor: '#DBEAFE', alignSelf: 'flex-end', borderTopRightRadius: 0 },
  chatBubbleUnread: { borderWidth: 2, borderColor: '#EF4444' },
  chatSender: { fontWeight: 'bold', fontSize: 12, marginBottom: 2, color: '#475569' },
  chatContent: { fontSize: 14, color: '#1E293B' },
  chatTimestamp: { fontSize: 10, color: '#64748B', marginTop: 5, textAlign: 'left' },
  chatUnreadTag: { fontSize: 10, color: '#EF4444', fontWeight: 'bold', textAlign: 'left', marginTop: 2 },
  chatReplyContainer: { marginTop: 10, paddingTop: 5, borderTopWidth: 1, borderTopColor: '#CBD5E1' },
  chatReplyLabel: { fontSize: 10, fontWeight: 'bold', color: '#3B82F6', marginBottom: 2 },
  chatReplyContent: { fontSize: 12, color: '#475569' },
  chatReplyTimestamp: { fontSize: 9, color: '#64748B', marginTop: 2, textAlign: 'left' },
  replyButton: { backgroundColor: '#3B82F6', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 5, marginTop: 5, alignSelf: 'flex-end' },
  replyButtonText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  replyInputContainer: { marginTop: 10, padding: 10, backgroundColor: '#F1F5F9', borderRadius: 10 },
  replyingToText: { fontSize: 12, color: '#64748B', marginBottom: 5, textAlign: 'right' },
  replyInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 8, fontSize: 12, textAlign: 'right', minHeight: 40 },
  replyActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 10 },
  replyBtn: { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
});
