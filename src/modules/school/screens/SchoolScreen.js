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

export default function SchoolScreen({ route, navigation }) {
  const { schoolId, user } = route.params || {};
  
  // تحديد هل المستخدم هو المدير الرئيسي أم مدير فرعي
  const isMainAdmin = user?.role === 'schoolAdmin';
  const isSubManager = user?.role === 'subManager';
  const userPermissions = user?.permissions || {};

  const [activeTab, setActiveTab] = useState('drivers');
  const [loading, setLoading] = useState(true);
  const [expiryDate, setExpiryDate] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [schoolLimits, setSchoolLimits] = useState({ maxBuses: 3, maxStudents: 50 });
  const [schoolLogo, setSchoolLogo] = useState('');

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
    if (!schoolId) {
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

    setLoading(false);
    return () => {
      schoolUnsub();
      unsubs.forEach(u => u());
    };
  }, [schoolId]);

  // فحص الصلاحيات للتبويبات
  const canViewTab = (tabId) => {
    if (isMainAdmin) return true;
    if (isSubManager) {
      if (tabId === 'drivers' || tabId === 'managers') return false; // السائقين والمدراء للمدير الرئيسي فقط
    }
    if (tabId === 'staff') return userPermissions.manage_staff;
    if (tabId === 'parents' || tabId === 'students') return userPermissions.manage_students;
    if (tabId === 'reports') return userPermissions.view_reports;
    if (tabId === 'emergencies') return userPermissions.handle_emergencies;
    return false;
  };

  const handleAction = async (action, item = null) => {
    if (isExpired && action !== 'delete') {
      Alert.alert('تنبيه', 'يرجى تجديد الاشتراك للمتابعة');
      return;
    }

    if (action === 'delete' && item) {
      Alert.alert('حذف', 'هل أنت متأكد؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: async () => {
          try {
            await deleteSchoolItem(schoolId, activeTab, item.id);
          } catch (e) {
            Alert.alert('خطأ', 'فشل الحذف');
          }
        }},
      ]);
    } else if (action === 'save') {
      if (!formData.username || !formData.name) {
        Alert.alert('خطأ', 'يرجى تعبئة الحقول الأساسية (الاسم واسم المستخدم)');
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
      emergencies: emergencies.filter(e => !e.resolved).length,
      activeTrips: drivers.filter(d => d.isOnline).length
    };
  }, [drivers, students, emergencies]);

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

      <View style={styles.quickActions}>
        {(isMainAdmin || (isSubManager && userPermissions.send_broadcasts)) && (
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowBroadcastModal(true)}>
            <Text style={styles.actionButtonText}>إعلان عام 📢</Text>
          </TouchableOpacity>
        )}
        {(isMainAdmin || (isSubManager && userPermissions.view_admin_messages)) && adminMessages.length > 0 && (
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#3B82F6' }]} onPress={() => setShowMsgModal(true)}>
            <Text style={styles.actionButtonText}>رسائل الإدارة ({adminMessages.length}) ✉️</Text>
          </TouchableOpacity>
        )}
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

      <FlatList
        data={currentData}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={[styles.card, activeTab === 'emergencies' && !item.resolved && { borderColor: '#EF4444', borderWidth: 1 }]}>
            <View style={styles.cardActions}>
              {(isMainAdmin || (isSubManager && userPermissions.edit_items)) && (
              <TouchableOpacity style={styles.editBtn} onPress={() => { setFormData(item); setEditingId(item.id); setShowForm(true); }}>
                <Text style={styles.editBtnText}>تعديل</Text>
              </TouchableOpacity>
            )}
            {(isMainAdmin || (isSubManager && userPermissions.delete_items)) && (
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleAction('delete', item)}>
                <Text style={styles.deleteBtnText}>حذف</Text>
              </TouchableOpacity>
            )}
            </View>
            <View style={{ alignItems: 'flex-end', flex: 1 }}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSub}>{item.username || item.id}</Text>
              {activeTab === 'managers' && item.permissions && (
                <Text style={styles.permsSummary}>
                  الصلاحيات: {Object.keys(item.permissions).filter(k => item.permissions[k]).length}
                </Text>
              )}
              {activeTab === 'emergencies' && <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: 'bold' }}>⚠️ {item.type || 'حالة طوارئ'}</Text>}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: '#64748B' }}>لا توجد بيانات</Text>}
      />

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

      {/* مودال عرض الرسائل الإدارية */}
      <Modal visible={showMsgModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>الرسائل الإدارية 📩</Text>
            <FlatList
              data={adminMessages}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.msgItem}>
                  <Text style={styles.msgDate}>{new Date(item.timestamp).toLocaleDateString('ar-EG')}</Text>
                  <Text style={styles.msgText}>{item.content}</Text>
                </View>
              )}
              style={{ maxHeight: 400 }}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowMsgModal(false)}>
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
            {activeTab === 'students' && renderInput('اسم ولي الأمر', 'parentUsername')}
            {activeTab === 'students' && renderInput('اسم السائق', 'driverUsername')}

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
  quickActions: { flexDirection: 'row-reverse', paddingHorizontal: 15, marginBottom: 10 },
  actionButton: { backgroundColor: '#10B981', padding: 10, borderRadius: 10, marginLeft: 10, flex: 1, alignItems: 'center' },
  actionButtonText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
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
  msgItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  msgDate: { fontSize: 10, color: '#94A3B8', textAlign: 'right' },
  msgText: { fontSize: 14, color: '#1E293B', textAlign: 'right', marginTop: 5 },
  inputWrapper: { marginBottom: 15 },
  inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 5, textAlign: 'right' },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, textAlign: 'right' },
  permsSection: { marginTop: 20, padding: 15, backgroundColor: '#F8FAFC', borderRadius: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
  permsTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B', marginBottom: 15, textAlign: 'right' },
  permRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  permLabel: { fontSize: 14, color: '#475569' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  checkMark: { color: '#FFF', fontWeight: 'bold', fontSize: 14 }
});
