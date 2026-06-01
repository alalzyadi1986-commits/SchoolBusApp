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
import * as Linking from 'expo-linking'; // استخدام expo-linking بدلاً من react-native/Linking

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
  const [selectedMessageForReply, setSelectedMessageForReply] = useState(null);

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
        const sorted = msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // فرز الرسائل حسب التاريخ لإنشاء محادثة متسلسلة
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

  const handleReplyToAdmin = async () => {
    if (!replyText.trim() || !selectedMessageForReply) return;
    try {
      setLoading(true);
      const senderName = user?.name || user?.username || 'مدير المدرسة';
      
      const reply = {
        id: Date.now().toString(),
        content: replyText,
        timestamp: new Date().toISOString(),
        sender: senderName,
        schoolName: dynamicSchoolName,
        schoolId: schoolId,
        type: 'reply_to_admin',
        originalMsgId: selectedMessageForReply.id
      };

      // 1. الحفظ في صندوق بريد الإدارة العامة (للسوبر أدمن)
      await saveSchoolItem(schoolId, 'admin_replies', reply.id, reply);
      
      // 2. تحديث الرسالة الأصلية في مسار المدرسة لتشمل الرد
      const updatedMsg = {
        ...selectedMessageForReply,
        read: true,
        replyContent: replyText, // تغيير اسم الحقل لتجنب التعارض مع 'reply' في الـ FlatList
        replyTimestamp: reply.timestamp,
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
            style={[styles.actionButton, { backgroundColor: '#10B981', width: '45%' }]}}
            onPress={() => exportToExcel(students, "جدول الطلاب", dynamicSchoolName, user?.displayName || user?.username || 'مدير المدرسة')}
          >
            <Text style={styles.actionButtonText}>تصدير الطلاب (Excel)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#EF4444', width: '45%' }]}}
            onPress={() => exportToPDF(students, "جدول الطلاب", dynamicSchoolName, user?.displayName || user?.username || 'مدير المدرسة')}
          >
            <Text style={styles.actionButtonText}>تصدير الطلاب (PDF)</Text>
          </TouchableOpacity>
        </View>
        
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-around', width: '100%', marginTop: 10 }}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#3B82F6', width: '45%' }]}}
            onPress={() => exportToExcel(drivers, "جدول السائقين", dynamicSchoolName, user?.displayName || user?.username || 'مدير المدرسة')}
          >
            <Text style={styles.actionButtonText}>تصدير السائقين (Excel)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#8B5CF6', width: '45%' }]}}
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

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Text style={styles.logoutText}>خروج</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
            <Text style={styles.title}>{dynamicSchoolName || 'لوحة الإدارة'}</Text>
            {!isMainAdmin && <Text style={styles.subTitle}>مرحباً: {user.name}</Text>}
            <Text style={styles.expiryText}>الاشتراك ينتهي في: {expiryDate.split('T')[0]}</Text>
          {socialLinks.instagram && (
            <TouchableOpacity onPress={() => Linking.openURL(socialLinks.instagram)} style={{ marginTop: 5, flexDirection: 'row-reverse', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, marginRight: 5 }}>📸</Text>
              <Text style={{ color: '#E1306C', fontSize: 12, fontWeight: 'bold' }}>Instagram</Text>
            </TouchableOpacity>
          )}
          {socialLinks.facebook && (
            <TouchableOpacity onPress={() => Linking.openURL(socialLinks.facebook)} style={{ marginTop: 5, flexDirection: 'row-reverse', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, marginRight: 5 }}>📘</Text>
              <Text style={{ color: '#4267B2', fontSize: 12, fontWeight: 'bold' }}>Facebook</Text>
            </TouchableOpacity>
          )}
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
              style={[styles.statCard, { borderRightColor: '#EF4444', backgroundColor: stats.emergencies > 0 ? '#FEF2F2' : '#FFF' }]}}
              onPress={() => setActiveTab('emergencies')}
            >
              <Text style={[styles.statValue, stats.emergencies > 0 && { color: '#EF4444' }]}>{stats.emergencies}</Text>
              <Text style={styles.statLabel}>طوارئ</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.quickActionsGrid}>
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.actionBox} 
            onPress={() => (isMainAdmin || userPermissions.view_active_trips) ? navigation.navigate('ActiveTrips', { schoolId, schoolName: dynamicSchoolName }) : null}
          >
            <Text style={styles.actionEmoji}>📡</Text>
            <Text style={styles.actionLabel}>مراقبة حية</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionBox} 
            onPress={() => (isMainAdmin || userPermissions.send_broadcasts) ? setShowBroadcastModal(true) : null}
          >
            <Text style={styles.actionEmoji}>📢</Text>
            <Text style={styles.actionLabel}>إعلان عام</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionBox} 
            onPress={() => (isMainAdmin || userPermissions.manage_staff || userPermissions.manage_students) ? navigation.navigate('SetSchoolLocation', { schoolId, currentInfo: { location: currentLocation } }) : null}
          >
            <Text style={styles.actionEmoji}>📍</Text>
            <Text style={styles.actionLabel}>موقع المدرسة</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBox} onPress={() => setShowMsgModal(true)}>
            <Text style={styles.actionEmoji}>✉️</Text>
            <Text style={styles.actionLabel}>رسائل الإدارة</Text>
            {adminMessages.filter(m => !m.read).length > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{adminMessages.filter(m => !m.read).length}</Text></View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBox} onPress={() => (isMainAdmin || isSubManager) ? setShowSocialModal(true) : null}>
            <Text style={styles.actionEmoji}>🔗</Text>
            <Text style={styles.actionLabel}>روابط التواصل</Text>
          </TouchableOpacity>
          <View style={styles.emptyBox} />
          <View style={styles.emptyBox} />
          <View style={styles.emptyBox} />
        </View>
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

      <View style={styles.searchSection}>
        <TextInput style={styles.searchInput} placeholder="بحث..." value={searchQuery} onChangeText={setSearchQuery} />
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

      {/* زر الإضافة */}
      {(isMainAdmin || userPermissions.edit_items) && activeTab !== 'reports' && (
        <TouchableOpacity style={styles.addBtn} onPress={() => { setFormData({}); setEditingId(null); setShowForm(true); }}>
          <Text style={styles.addBtnText}>إضافة جديد</Text>
        </TouchableOpacity>
      )}

      {/* مودال روابط التواصل الاجتماعي */}
      <Modal visible={showSocialModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>روابط التواصل الاجتماعي</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>رابط فيسبوك:</Text>
              <TextInput
                style={styles.input}
                placeholder="أدخل رابط صفحة الفيسبوك"
                value={socialLinks.facebook}
                onChangeText={(text) => setSocialLinks({ ...socialLinks, facebook: text })}
              />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>رابط انستجرام:</Text>
              <TextInput
                style={styles.input}
                placeholder="أدخل رابط صفحة الانستجرام"
                value={socialLinks.instagram}
                onChangeText={(text) => setSocialLinks({ ...socialLinks, instagram: text })}
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
              keyExtractor={(item, index) => item.id?.toString() || index.toString()}
              renderItem={({ item }) => (
                <View style={[styles.chatBubble, item.type === 'broadcast' ? styles.chatBubbleAdmin : styles.chatBubbleSchool, !item.read && item.type === 'broadcast' && styles.chatBubbleUnread]}>
                  <Text style={styles.chatSender}>{item.sender}</Text>
                  <Text style={styles.chatContent}>{item.content}</Text>
                  <Text style={styles.chatTimestamp}>{new Date(item.timestamp).toLocaleString('ar-EG')}</Text>
                  {item.type === 'broadcast' && !item.read && <Text style={styles.chatUnreadTag}>غير مقروءة</Text>}

                  {item.replyContent && (
                    <View style={styles.chatReplyContainer}>
                      <Text style={styles.chatReplyLabel}>ردك:</Text>
                      <Text style={styles.chatReplyContent}>{item.replyContent}</Text>
                      <Text style={styles.chatReplyTimestamp}>{new Date(item.replyTimestamp).toLocaleString('ar-EG')}</Text>
                    </View>
                  )}

                  {!isSelectionMode && item.type === 'broadcast' && !item.replyContent && (
                    <TouchableOpacity 
                      style={styles.replyButton}
                      onPress={() => setSelectedMessageForReply(item)}
                    >
                      <Text style={styles.replyButtonText}>رد</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              style={{ maxHeight: 480 }}
              showsVerticalScrollIndicator={false}
            />

            {selectedMessageForReply && (
              <View style={styles.replyInputContainer}>
                <Text style={styles.replyingToText}>الرد على: {selectedMessageForReply.content.substring(0, 30)}...</Text>
                <TextInput 
                  style={styles.replyInput} 
                  placeholder="اكتب ردك هنا..." 
                  value={replyText}
                  onChangeText={setReplyText}
                  multiline
                />
                <View style={styles.replyActions}>
                  <TouchableOpacity 
                    style={[styles.replyBtn, { backgroundColor: '#3B82F6' }]}}
                    onPress={handleReplyToAdmin}
                  >
                    <Text style={styles.replyBtnText}>إرسال الرد</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.replyBtn, { backgroundColor: '#EF4444' }]}}
                    onPress={() => setSelectedMessageForReply(null)}
                  >
                    <Text style={styles.replyBtnText}>إلغاء</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.closeBtn, { backgroundColor: '#64748B' }]} 
              onPress={() => { setShowMsgModal(false); setIsSelectionMode(false); setSelectedMsgs([]); setSelectedMessageForReply(null); }}
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
    </View>
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
  quickActionsGrid: { paddingHorizontal: 15, marginTop: 10 },
  actionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 },
  actionBox: { width: '23.5%', aspectRatio: 1, backgroundColor: '#FFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, position: 'relative', borderWidth: 1, borderColor: '#F1F5F9' },
  emptyBox: { width: '23.5%', aspectRatio: 1 },
  actionEmoji: { fontSize: 22, marginBottom: 4 },
  actionLabel: { fontSize: 9, fontWeight: 'bold', color: '#475569', textAlign: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#FFF' },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
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
