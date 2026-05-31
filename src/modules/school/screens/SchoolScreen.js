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
import { SafeAreaView } from 'react-native-safe-area-context';

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

  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [dynamicSchoolName, setDynamicSchoolName] = useState('');
  
  // ميزة عرض رسائل الإدارة
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [selectedMsgs, setSelectedMsgs] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // ميزة الإعلانات المدرسية
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState('all'); // 'all', 'parents', 'drivers'
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
        const sorted = msgs.sort((a, b) => b.id - a.id);
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
      // إظهار تنبيه فقط إذا كان المدير يملك الصلاحية
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
      // السائقين والمدراء متاحين فقط للمدير الرئيسي افتراضياً، إلا إذا تم تعديل ذلك لاحقاً
      if (tabId === 'drivers' || tabId === 'managers') return false; 
      
      // التحقق من الصلاحيات المخصصة للمدير الفرعي مع حماية من القيم غير المعرفة
      if (tabId === 'staff') return !!userPermissions?.manage_staff;
      if (tabId === 'parents' || tabId === 'students') return !!userPermissions?.manage_students;
      if (tabId === 'reports') return !!userPermissions?.view_reports;
      if (tabId === 'emergencies') return !!userPermissions?.handle_emergencies;
      
      // تبويب افتراضي قد يحتاجه المدير الفرعي إذا لم يكن هناك قيود
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

      // التحقق من صحة اسم المستخدم (دعم العربية والإنجليزية والأرقام مع منع الرموز التي تكسر المسارات)
      // نسمح بالأحرف العربية، الإنجليزية، الأرقام، والشرطة السفلية
      const usernameRegex = /^[\u0600-\u06FFa-zA-Z0-9_]+$/;
      if (!usernameRegex.test(formData.username)) {
        Alert.alert('خطأ', 'اسم المستخدم يجب أن يحتوي على أحرف (عربية/إنجليزية) وأرقام فقط بدون مسافات أو رموز');
        return;
      }

      // التحقق من رقم الجوال إذا كان موجوداً
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
        // إذا كان التبويب هو المدراء، نحفظ الصلاحيات أيضاً
        const dataToSave = { ...formData };
        if (activeTab === 'managers') {
          dataToSave.role = 'school_manager'; // دور المدير الفرعي
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

  const handleMarkAsRead = async (msgId) => {
    try {
      await saveSchoolItem(schoolId, 'messages', msgId, { read: true });
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
            // ملاحظة: الحذف يتم عن طريق تعيين قيمة null في Firebase لكل معرف
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

  const handleReplyToAdmin = async (msg) => {
    if (!replyText.trim()) return;
    try {
      const reply = {
        id: Date.now().toString(),
        content: replyText,
        timestamp: new Date().toISOString(),
        sender: user?.name || 'مدير المدرسة',
        type: 'reply_to_admin',
        originalMsgId: msg.id
      };
      await saveSchoolItem(schoolId, 'admin_replies', reply.id, reply);
      Alert.alert('تم', 'تم إرسال ردك للإدارة بنجاح');
      setReplyText('');
    } catch (e) { Alert.alert('خطأ', 'فشل إرسال الرد'); }
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

  const stats = useMemo(() => {
    return {
      buses: drivers.length,
      students: students.length,
      staff: staff.length,
      parents: parents.length,
      emergencies: emergencies.filter(e => !e.resolved).length,
      activeTrips: drivers.filter(d => d.isOnline).length
    };
  }, [drivers, students, staff, parents, emergencies]);

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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Text style={styles.logoutText}>خروج</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
            <Text style={styles.title}>{dynamicSchoolName || 'لوحة الإدارة'}</Text>
            {!isMainAdmin && <Text style={styles.subTitle}>مرحباً: {user.name}</Text>}
            <Text style={styles.expiryText}>الاشتراك ينتهي في: {expiryDate.split('T')[0]}</Text>
          </View>
          {schoolLogo ? (
            <Image source={{ uri: schoolLogo }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}><Text style={{ fontSize: 20 }}>🏫</Text></View>
          )}
        </View>
      </View>

      {/* لوحة الإحصائيات الذكية - تظهر للجميع ولكن ببيانات حسب الصلاحية */}
      <View style={{ marginTop: 10 }}>
        <Text style={[styles.inputLabel, { marginRight: 15, marginBottom: 5, fontSize: 16, color: '#1E293B' }]}>📊 الإحصائية العامة</Text>
        <View style={styles.statsContainer}>
          {(isMainAdmin || (isSubManager && userPermissions.view_buses)) && (
            <View style={[styles.statCard, { borderRightColor: '#3B82F6' }]}>
              <Text style={styles.statValue}>{stats.buses}</Text>
              <Text style={styles.statLabel}>باصات</Text>
            </View>
          )}
          {(isMainAdmin || userPermissions.manage_students) && (
            <View style={[styles.statCard, { borderRightColor: '#10B981' }]}>
              <Text style={styles.statValue}>{stats.students}</Text>
              <Text style={styles.statLabel}>طلاب</Text>
            </View>
          )}
          {(isMainAdmin || (isSubManager && userPermissions.view_active_trips)) && (
            <View style={[styles.statCard, { borderRightColor: '#F59E0B' }]}>
              <Text style={styles.statValue}>{stats.activeTrips}</Text>
              <Text style={styles.statLabel}>رحلات نشطة</Text>
            </View>
          )}
          {(isMainAdmin || userPermissions.handle_emergencies) && (
            <TouchableOpacity 
              style={[styles.statCard, { borderRightColor: '#EF4444', backgroundColor: stats.emergencies > 0 ? '#FEF2F2' : '#FFF' }]}
              onPress={() => setActiveTab('emergencies')}
            >
              <Text style={[styles.statValue, stats.emergencies > 0 && { color: '#EF4444' }]}>{stats.emergencies}</Text>
              <Text style={styles.statLabel}>طوارئ</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.quickActionsGrid}>
        {/* الصف الأول */}
        <View style={styles.actionRow}>
          {(isMainAdmin || (isSubManager && userPermissions.view_active_trips)) ? (
            <TouchableOpacity 
              style={[styles.gridButton, { backgroundColor: '#1E293B' }]} 
              onPress={() => navigation.navigate('ActiveTrips', { schoolId, schoolName: dynamicSchoolName })}
            >
              <Text style={styles.gridButtonText}>📡 مراقبة حية</Text>
            </TouchableOpacity>
          ) : <View style={styles.gridButtonPlaceholder} />}

          {(isMainAdmin || (isSubManager && userPermissions.send_broadcasts)) ? (
            <TouchableOpacity style={[styles.gridButton, { backgroundColor: '#10B981' }]} onPress={() => setShowBroadcastModal(true)}>
              <Text style={styles.gridButtonText}>إعلان عام 📢</Text>
            </TouchableOpacity>
          ) : <View style={styles.gridButtonPlaceholder} />}

          {isMainAdmin ? (
            <TouchableOpacity 
              style={[styles.gridButton, { backgroundColor: '#8B5CF6' }]} 
              onPress={() => {
                navigation.navigate('SetSchoolLocation', { 
                  schoolId, 
                  currentInfo: { location: currentLocation } 
                });
              }}
            >
              <Text style={styles.gridButtonText}>📍 موقع المدرسة</Text>
            </TouchableOpacity>
          ) : <View style={styles.gridButtonPlaceholder} />}

          {(isMainAdmin || (isSubManager && userPermissions.view_admin_messages)) ? (
            <TouchableOpacity 
              style={[styles.gridButton, { backgroundColor: '#3B82F6' }]} 
              onPress={() => setShowMsgModal(true)}
            >
              <Text style={styles.gridButtonText}>رسائل الإدارة ({adminMessages.filter(m => !m.read).length}) ✉️</Text>
              {adminMessages.some(m => !m.read) && <View style={styles.unreadBadge} />}
            </TouchableOpacity>
          ) : <View style={styles.gridButtonPlaceholder} />}
        </View>

        {/* الصف الثاني */}
        <View style={styles.actionRow}>
          {isMainAdmin ? (
            <TouchableOpacity 
              style={[styles.gridButton, { backgroundColor: '#4F46E5' }]} 
              onPress={() => setShowSocialModal(true)}
            >
              <Text style={styles.gridButtonText}>🔗 روابط التواصل</Text>
            </TouchableOpacity>
          ) : <View style={styles.gridButtonPlaceholder} />}
          
          <View style={styles.gridButtonPlaceholder} />
          <View style={styles.gridButtonPlaceholder} />
          <View style={styles.gridButtonPlaceholder} />
        </View>
      </View>

      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
          {[
            { id: 'drivers', label: 'السائقين' },
            { id: 'staff', label: 'المرافقات' },
            { id: 'parents', label: 'أولياء الأمور' },
            { id: 'students', label: 'الطلاب' },
            { id: 'managers', label: 'المدراء' },
            { id: 'reports', label: 'التقارير' },
            { id: 'emergencies', label: 'الطوارئ' },
          ].filter(tab => canViewTab(tab.id)).map(tab => (
            <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => { setActiveTab(tab.id); setShowForm(false); }}>
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchWrapper}>
        <TextInput style={styles.searchInput} placeholder="بحث بالاسم أو اسم المستخدم..." value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      {activeTab === 'reports' ? renderReports() : (
      <FlatList
        data={currentData}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <SchoolDataItem 
            item={item} 
            tab={activeTab} 
            permissions={isMainAdmin ? { edit_items: true, delete_items: true } : userPermissions}
            onEdit={(item) => {
              setFormData(item);
              setEditingId(item.id);
              setShowForm(true);
            }}
            onDelete={(item) => handleAction('delete', item)}
          />
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: '#64748B' }}>لا توجد بيانات</Text>}
      />
      )}

      {activeTab !== 'reports' && activeTab !== 'emergencies' && (
        <TouchableOpacity style={styles.addBtn} onPress={() => { setFormData({}); setEditingId(null); setShowForm(true); }}>
          <Text style={styles.addBtnText}>+ إضافة جديد</Text>
        </TouchableOpacity>
      )}

      {/* مودال الإعلانات المدرسية */}
      <Modal visible={showBroadcastModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إرسال إعلان للمدرسة 📢</Text>
            <View style={styles.targetContainer}>
              {[
                { id: 'all', label: 'الجميع' },
                { id: 'parents', label: 'الأهل' },
                { id: 'drivers', label: 'السائقين' }
              ].map(t => (
                <TouchableOpacity 
                  key={t.id} 
                  style={[styles.targetBtn, broadcastTarget === t.id && styles.targetBtnActive]}
                  onPress={() => setBroadcastTarget(t.id)}
                >
                  <Text style={[styles.targetText, broadcastTarget === t.id && styles.targetTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput 
              style={styles.msgInput} 
              placeholder="اكتب محتوى الإعلان هنا..." 
              multiline 
              value={broadcastContent} 
              onChangeText={setBroadcastContent} 
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.sendBtn]} onPress={handleSendBroadcast}>
                <Text style={styles.modalBtnText}>إرسال الإعلان</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.closeBtn]} onPress={() => setShowBroadcastModal(false)}>
                <Text style={styles.modalBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* مودال روابط التواصل الاجتماعي */}
      <Modal visible={showSocialModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>روابط التواصل الاجتماعي 🔗</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>رابط فيسبوك:</Text>
              <TextInput 
                style={styles.input} 
                placeholder="https://facebook.com/..." 
                value={socialLinks.facebook} 
                onChangeText={(val) => setSocialLinks({...socialLinks, facebook: val})}
              />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>رابط إنستجرام:</Text>
              <TextInput 
                style={styles.input} 
                placeholder="https://instagram.com/..." 
                value={socialLinks.instagram} 
                onChangeText={(val) => setSocialLinks({...socialLinks, instagram: val})}
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.sendBtn, { backgroundColor: '#10B981' }]} 
                onPress={async () => {
                  try {
                    // تصحيح: حفظ الروابط مباشرة في مسار محدد لمنع أخطاء المعرفات
                    await saveSchoolItem(schoolId, 'info', 'socialLinks', socialLinks);
                    Alert.alert('تم', 'تم حفظ الروابط بنجاح');
                    setShowSocialModal(false);
                  } catch (e) {
                    Alert.alert('خطأ', 'فشل حفظ الروابط');
                  }
                }}
              >
                <Text style={styles.modalBtnText}>حفظ الروابط</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.closeBtn, { marginTop: 0 }]} onPress={() => setShowSocialModal(false)}>
                <Text style={styles.modalBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* مودال عرض الرسائل الإدارية (تواصل الإدارة) */}
      <Modal visible={showMsgModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingHorizontal: 10 }]}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 10 }}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>تواصل الإدارة 📩</Text>
              <TouchableOpacity onPress={() => { setIsSelectionMode(!isSelectionMode); setSelectedMsgs([]); }}>
                <Text style={{ color: '#3B82F6', fontWeight: 'bold' }}>{isSelectionMode ? 'إلغاء' : 'تحديد'}</Text>
              </TouchableOpacity>
            </View>

            {isSelectionMode && selectedMsgs.length > 0 && (
              <TouchableOpacity 
                style={{ backgroundColor: '#EF4444', padding: 8, borderRadius: 10, marginBottom: 10, alignItems: 'center' }}
                onPress={handleDeleteSelected}
              >
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>حذف المختار ({selectedMsgs.length}) 🗑️</Text>
              </TouchableOpacity>
            )}

            <FlatList
              data={adminMessages}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <View style={[styles.msgItem, !item.read && { backgroundColor: '#F0F9FF', borderRightWidth: 4, borderRightColor: '#3B82F6' }]}>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                      {isSelectionMode && (
                        <TouchableOpacity 
                          style={[styles.checkbox, { marginLeft: 10, width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' }, selectedMsgs.includes(item.id) && { backgroundColor: '#3B82F6' }]}
                          onPress={() => toggleMsgSelection(item.id)}
                        >
                          {selectedMsgs.includes(item.id) && <Text style={{ color: '#FFF', fontSize: 12 }}>✓</Text>}
                        </TouchableOpacity>
                      )}
                      <Text style={{ fontWeight: 'bold', color: '#1E293B', fontSize: 15 }}>الإدارة العامة 🏛️</Text>
                    </View>
                    <Text style={styles.msgDate}>
                      {new Date(item.timestamp).toLocaleDateString('ar-EG')} - {new Date(item.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  
                  <TouchableOpacity 
                    onPress={() => !isSelectionMode && !item.read && handleMarkAsRead(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.msgText, { fontWeight: item.read ? 'normal' : 'bold', textAlign: 'right', color: '#334155', lineHeight: 20 }]}>
                      {item.content}
                    </Text>
                    {!item.read && <Text style={{ fontSize: 10, color: '#3B82F6', fontWeight: 'bold', textAlign: 'left', marginTop: 5 }}>• غير مقروءة</Text>}
                  </TouchableOpacity>
                  
                  {/* قسم الرد على الرسالة */}
                  {!isSelectionMode && (
                    <View style={{ marginTop: 15, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10 }}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                        <TextInput 
                          style={[styles.input, { flex: 1, height: 38, fontSize: 12, backgroundColor: '#F8FAFC', paddingHorizontal: 10, borderRadius: 8 }]} 
                          placeholder="اكتب ردك هنا..." 
                          onChangeText={setReplyText}
                        />
                        <TouchableOpacity 
                          style={{ backgroundColor: '#3B82F6', padding: 8, borderRadius: 8, marginRight: 8 }}
                          onPress={() => handleReplyToAdmin(item)}
                        >
                          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>رد</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
              style={{ maxHeight: 480 }}
              showsVerticalScrollIndicator={false}
            />
            <TouchableOpacity 
              style={[styles.closeBtn, { backgroundColor: '#64748B' }]} 
              onPress={() => { setShowMsgModal(false); setIsSelectionMode(false); setSelectedMsgs([]); }}
            >
              <Text style={styles.closeBtnText}>إغلاق</Text>
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

            {/* قسم الصلاحيات عند إضافة مدير فرعي */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  subTitle: { fontSize: 12, color: '#3B82F6', fontWeight: 'bold' },
  expiryText: { fontSize: 11, color: '#EF4444', marginTop: 2 },
  logo: { width: 50, height: 50, borderRadius: 25, resizeMode: 'contain', backgroundColor: '#F1F5F9' },
  logoPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold' },
  statsContainer: { flexDirection: 'row-reverse', padding: 15, justifyContent: 'space-between' },
  statCard: { flex: 1, backgroundColor: '#FFF', padding: 10, borderRadius: 12, marginHorizontal: 4, alignItems: 'center', elevation: 2, borderRightWidth: 4 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  statLabel: { fontSize: 10, color: '#64748B', marginTop: 2 },
  quickActionsGrid: { paddingHorizontal: 10, marginBottom: 15 },
  actionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 },
  gridButton: { width: '23%', height: 75, borderRadius: 10, padding: 5, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  gridButtonPlaceholder: { width: '23%', height: 75 },
  gridButtonText: { color: '#FFF', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  unreadBadge: { position: 'absolute', top: 10, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  tabsWrapper: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabsContainer: { paddingHorizontal: 10, paddingVertical: 10 },
  tab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#F1F5F9' },
  tabActive: { backgroundColor: '#3B82F6' },
  tabText: { fontSize: 14, color: '#64748B', fontWeight: 'bold' },
  tabTextActive: { color: '#FFF' },
  searchWrapper: { padding: 15 },
  searchInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, textAlign: 'right' },
  card: { backgroundColor: '#FFF', padding: 15, borderRadius: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 2 },
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
  msgItem: { marginBottom: 15, padding: 15, borderRadius: 15, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  msgDate: { fontSize: 10, color: '#94A3B8', textAlign: 'right' },
  msgText: { fontSize: 14, color: '#1E293B', textAlign: 'right', marginTop: 5 },
  inputWrapper: { marginBottom: 15 },
  inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 5, textAlign: 'right' },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, textAlign: 'right' },
  pickerItem: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginLeft: 8, marginBottom: 5 },
  pickerItemActive: { backgroundColor: '#3B82F6' },
  pickerText: { fontSize: 12, color: '#64748B' },
  pickerTextActive: { color: '#FFF', fontWeight: 'bold' },
  permsSection: { marginTop: 20, padding: 15, backgroundColor: '#F8FAFC', borderRadius: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
  permsTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B', marginBottom: 15, textAlign: 'right' },
  reportRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', width: '100%', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  reportLabel: { fontSize: 14, color: '#475569' },
  reportValue: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  permRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  permLabel: { fontSize: 14, color: '#475569' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  checkMark: { color: '#FFF', fontWeight: 'bold', fontSize: 14 }
});
