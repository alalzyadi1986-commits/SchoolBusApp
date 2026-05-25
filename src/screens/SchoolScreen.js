import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { db } from '../firebaseConfig';
import { ref, set, push, onValue, remove, update } from 'firebase/database';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SchoolScreen({ route, navigation }) {
  const { schoolId, user } = route.params || {};
  const schoolName = user?.schoolName || '';
  const [activeTab, setActiveTab] = useState('drivers');
  const [loading, setLoading] = useState(true);
  const [expiryDate, setExpiryDate] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  const [drivers, setDrivers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [reports, setReports] = useState([]);
  const [managers, setManagers] = useState([]);

  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('الكل');
  const [selectedDriverReport, setSelectedDriverReport] = useState('الكل');
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [showParentForm, setShowParentForm] = useState(false);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showManagerForm, setShowManagerForm] = useState(false);
  const [dynamicSchoolName, setDynamicSchoolName] = useState('');

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      Alert.alert('خطأ', 'لم يتم العثور على معرف المدرسة. يرجى تسجيل الدخول مرة أخرى.');
      navigation.replace('Login');
      return;
    }

    // جلب بيانات المدرسة الأساسية فقط
    const schoolUnsub = onValue(ref(db, `schools/${schoolId}`), (snap) => {
      const data = snap.val();
      if (data) {
        setDynamicSchoolName(data.name || '');
        setExpiryDate(data.endDate || '');
        setIsExpired(new Date(data.endDate) < new Date());
      }
    });

    // جلب بيانات كل قسم من مدرسة هذا المستخدم فقط
    const fetchData = (path, setter) => {
      return onValue(ref(db, `schools/${schoolId}/${path}`), (snap) => {
        const data = snap.val();
        setter(data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : []);
      });
    };

    const unsubDrivers    = fetchData('drivers', setDrivers);
    const unsubStaff      = fetchData('staff', setStaff);
    const unsubParents    = fetchData('parents', setParents);
    const unsubStudents   = fetchData('students', setStudents);
    const unsubEmergencies = fetchData('emergencies', setEmergencies);
    const unsubReports    = fetchData('reports', setReports);
    const unsubManagers   = fetchData('managers', setManagers);

    setLoading(false);

    return () => {
      schoolUnsub();
      unsubDrivers();
      unsubStaff();
      unsubParents();
      unsubStudents();
      unsubEmergencies();
      unsubReports();
      unsubManagers();
    };
  }, [schoolId]);

  const handleAction = async (action, item = null) => {
    if (isExpired && action !== 'delete') {
      Alert.alert('تنبيه', 'يرجى تجديد الاشتراك للمتابعة');
      return;
    }

    const path = `schools/${schoolId}/${activeTab}`;

    if (action === 'delete' && item) {
      Alert.alert('حذف', 'هل أنت متأكد من عملية الحذف؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: () => remove(ref(db, `${path}/${item.id}`)) },
      ]);
    } else if (action === 'save') {
      if (!formData.username || !formData.name) {
        Alert.alert('خطأ', 'يرجى تعبئة الحقول الأساسية (الاسم واسم المستخدم)');
        return;
      }
      try {
        if (editingId) {
          await update(ref(db, `${path}/${editingId}`), formData);
          setEditingId(null);
        } else {
          await set(ref(db, `${path}/${formData.username}`), formData);

          // إضافة في userIndex لتسريع تسجيل الدخول
const role =
  activeTab === 'drivers'
    ? 'driver'
    : activeTab === 'staff'
    ? 'staff'
    : activeTab === 'parents'
    ? 'parent'
    : activeTab === 'students'
    ? 'student'
    : activeTab === 'managers'
    ? 'manager'
    : activeTab;

          await set(ref(db, `userIndex/${formData.username}`), { schoolId, role });
        }
        setFormData({});
        hideAllForms();
        Alert.alert('تم', 'تم حفظ البيانات بنجاح');
      } catch (error) {
        Alert.alert('خطأ', 'حدث خطأ أثناء الحفظ: ' + error.message);
      }
    }
  };

  const hideAllForms = () => {
    setShowDriverForm(false);
    setShowStaffForm(false);
    setShowParentForm(false);
    setShowStudentForm(false);
    setShowManagerForm(false);
  };

  const startEdit = (item) => {
    setFormData(item);
    setEditingId(item.id);
    hideAllForms();
    if (activeTab === 'drivers') setShowDriverForm(true);
    else if (activeTab === 'staff') setShowStaffForm(true);
    else if (activeTab === 'parents') setShowParentForm(true);
    else if (activeTab === 'students') setShowStudentForm(true);
    else if (activeTab === 'managers') setShowManagerForm(true);
  };

  const renderInput = (placeholder, field, isNumeric = false) => (
    <View style={styles.inputWrapper} key={field}>
      <Text style={styles.inputLabel}>{placeholder}:</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={formData[field] || ''}
        onChangeText={(txt) => setFormData({ ...formData, [field]: txt })}
        keyboardType={isNumeric ? 'numeric' : 'default'}
        editable={field === 'username' ? !editingId : true}
      />
    </View>
  );

  const renderPermission = (label, field) => (
    <TouchableOpacity
      style={styles.checkboxContainer}
      key={field}
      onPress={() => setFormData({
        ...formData,
        permissions: { ...formData.permissions, [field]: !formData.permissions?.[field] },
      })}
    >
      <View style={[styles.checkbox, formData.permissions?.[field] && styles.checkboxChecked]} />
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const filteredDrivers = useMemo(() =>
    drivers.filter(d => d.name?.includes(searchQuery) || d.username?.includes(searchQuery)),
    [drivers, searchQuery]);

  const filteredStaff = useMemo(() =>
    staff.filter(s => s.name?.includes(searchQuery) || s.username?.includes(searchQuery)),
    [staff, searchQuery]);

  const filteredParents = useMemo(() =>
    parents.filter(p => p.name?.includes(searchQuery) || p.username?.includes(searchQuery)),
    [parents, searchQuery]);

  const filteredStudents = useMemo(() =>
    students.filter(s =>
      (s.name?.includes(searchQuery) || s.username?.includes(searchQuery)) &&
      (selectedClassFilter === 'الكل' || s.class === selectedClassFilter)
    ),
    [students, searchQuery, selectedClassFilter]);

  const filteredManagers = useMemo(() =>
    managers.filter(m => m.name?.includes(searchQuery) || m.username?.includes(searchQuery)),
    [managers, searchQuery]);

  const filteredReports = useMemo(() =>
    reports.filter(r => selectedDriverReport === 'الكل' || r.driverUsername === selectedDriverReport),
    [reports, selectedDriverReport]);

  const renderForm = () => {
    switch (activeTab) {
      case 'drivers':
        return (
          <View style={styles.formContainer}>
            {renderInput('اسم السائق', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {renderInput('كلمة المرور', 'password')}
            {renderInput('رقم الهاتف', 'phone', true)}
            {renderInput('رقم الباص', 'busNumber')}
            {renderInput('الحد الأقصى للسرعة', 'maxSpeed', true)}
            {renderPermission('تتبع الموقع', 'canTrackLocation')}
            {renderPermission('إرسال تنبيهات', 'canSendAlerts')}
            <TouchableOpacity onPress={() => handleAction('save')} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>{editingId ? 'تحديث السائق' : 'حفظ السائق'}</Text>
            </TouchableOpacity>
          </View>
        );
      case 'staff':
        return (
          <View style={styles.formContainer}>
            {renderInput('اسم الموظف', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {renderInput('كلمة المرور', 'password')}
            {renderInput('رقم الهاتف', 'phone', true)}
            {renderPermission('إدارة الطلاب', 'canManageStudents')}
            {renderPermission('إدارة السائقين', 'canManageDrivers')}
            <TouchableOpacity onPress={() => handleAction('save')} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>{editingId ? 'تحديث الموظف' : 'حفظ الموظف'}</Text>
            </TouchableOpacity>
          </View>
        );
      case 'parents':
        return (
          <View style={styles.formContainer}>
            {renderInput('اسم ولي الأمر', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {renderInput('كلمة المرور', 'password')}
            {renderInput('رقم الهاتف', 'phone', true)}
            <TouchableOpacity onPress={() => handleAction('save')} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>{editingId ? 'تحديث ولي الأمر' : 'حفظ ولي الأمر'}</Text>
            </TouchableOpacity>
          </View>
        );
      case 'students':
        return (
          <View style={styles.formContainer}>
            {renderInput('اسم الطالب', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {renderInput('كلمة المرور', 'password')}
            {renderInput('الصف', 'class')}
            {renderInput('اسم ولي الأمر', 'parentName')}
            {renderInput('اسم مستخدم ولي الأمر', 'parentUsername')}
            {renderInput('اسم السائق', 'driverName')}
            {renderInput('اسم مستخدم السائق', 'driverUsername')}
            <TouchableOpacity onPress={() => handleAction('save')} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>{editingId ? 'تحديث الطالب' : 'حفظ الطالب'}</Text>
            </TouchableOpacity>
          </View>
        );
      case 'managers':
        return (
          <View style={styles.formContainer}>
            {renderInput('اسم المدير', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {renderInput('كلمة المرور', 'password')}
            {renderInput('رقم الهاتف', 'phone', true)}
            <TouchableOpacity onPress={() => handleAction('save')} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>{editingId ? 'تحديث المدير' : 'حفظ المدير'}</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name}</Text>
        {item.username && <Text style={styles.cardSub}>👤 {item.username}</Text>}
        {item.phone && <Text style={styles.cardSub}>📞 {item.phone}</Text>}
        {item.busNumber && <Text style={styles.cardSub}>🚌 رقم الباص: {item.busNumber}</Text>}
        {item.class && <Text style={styles.cardSub}>📚 الصف: {item.class}</Text>}
        {item.parentName && <Text style={styles.cardSub}>👨‍👦 ولي الأمر: {item.parentName}</Text>}
        {item.driverUsername && <Text style={styles.cardSub}>🚗 السائق: {item.driverUsername}</Text>}
        {item.timestamp && <Text style={styles.cardDate}>🕐 {new Date(item.timestamp).toLocaleString()}</Text>}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => startEdit(item)} style={styles.editBtn}>
          <Text style={styles.editBtnText}>تعديل</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleAction('delete', item)} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={{ marginTop: 10 }}>جاري تحميل البيانات...</Text>
      </View>
    );
  }

  const tabs = [
    { key: 'drivers', label: 'السائقون' },
    { key: 'staff', label: 'الموظفون' },
    { key: 'parents', label: 'أولياء الأمور' },
    { key: 'students', label: 'الطلاب' },
    { key: 'managers', label: 'المدراء' },
    { key: 'emergencies', label: 'الطوارئ' },
    { key: 'reports', label: 'التقارير' },
  ];

  const getListData = () => {
    switch (activeTab) {
      case 'drivers': return filteredDrivers;
      case 'staff': return filteredStaff;
      case 'parents': return filteredParents;
      case 'students': return filteredStudents;
      case 'managers': return filteredManagers;
      case 'emergencies': return emergencies;
      case 'reports': return filteredReports;
      default: return [];
    }
  };

  const showForm = showDriverForm || showStaffForm || showParentForm || showStudentForm || showManagerForm;
  const canAdd = !['emergencies', 'reports'].includes(activeTab);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{dynamicSchoolName || schoolName}</Text>
        <View style={styles.headerButtons}>
          {isExpired && <Text style={styles.expiryWarning}>⚠️ الاشتراك منتهي</Text>}
          <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}>
            <Text style={styles.logoutBtnText}>🚪 خروج</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollTabContainer}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, activeTab === tab.key && styles.activeTab]}
              onPress={() => { setActiveTab(tab.key); hideAllForms(); setFormData({}); setEditingId(null); }}
            >
              <Text style={[styles.tabButtonText, activeTab === tab.key && styles.activeTabButtonText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.container}>
        {canAdd && (
          <View style={styles.addSection}>
            <TouchableOpacity style={styles.addBtn} onPress={() => {
              setFormData({});
              setEditingId(null);
              hideAllForms();
              if (activeTab === 'drivers') setShowDriverForm(v => !v);
              else if (activeTab === 'staff') setShowStaffForm(v => !v);
              else if (activeTab === 'parents') setShowParentForm(v => !v);
              else if (activeTab === 'students') setShowStudentForm(v => !v);
              else if (activeTab === 'managers') setShowManagerForm(v => !v);
            }}>
              <Text style={styles.addBtnText}>
                + إضافة {
                  activeTab === 'drivers' ? 'سائق' :
                  activeTab === 'staff' ? 'موظف' :
                  activeTab === 'parents' ? 'ولي أمر' :
                  activeTab === 'students' ? 'طالب' : 'مدير'
                }
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {showForm && renderForm()}

        <View style={styles.filterSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 بحث بالاسم أو اسم المستخدم..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {activeTab === 'students' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              {['الكل', 'أول', 'ثاني', 'ثالث', 'رابع', 'خامس', 'سادس', 'سابع', 'ثامن', 'تاسع', 'عاشر', 'حادي عشر', 'ثاني عشر'].map(cls => (
                <TouchableOpacity
                  key={cls}
                  style={[styles.filterChip, selectedClassFilter === cls && styles.filterChipActive]}
                  onPress={() => setSelectedClassFilter(cls)}
                >
                  <Text style={[styles.filterChipText, selectedClassFilter === cls && styles.filterChipTextActive]}>{cls}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>
            {tabs.find(t => t.key === activeTab)?.label} ({getListData().length})
          </Text>
          <FlatList
            data={getListData()}
            keyExtractor={item => item.id || item.username}
            renderItem={renderItem}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.emptyListText}>لا توجد بيانات لعرضها.</Text>}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    elevation: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  expiryWarning: { color: '#EF4444', fontWeight: 'bold', fontSize: 12, marginRight: 8 },
  logoutBtn: { backgroundColor: '#FEE2E2', padding: 8, borderRadius: 8 },
  logoutBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 12 },
  tabContainer: { backgroundColor: '#FFF', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEE', elevation: 1 },
  scrollTabContainer: { flexDirection: 'row-reverse', paddingHorizontal: 10 },
  tabButton: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#E2E8F0', marginHorizontal: 4 },
  activeTab: { backgroundColor: '#007BFF' },
  tabButtonText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  activeTabButtonText: { color: '#FFF', fontWeight: 'bold' },
  addSection: { padding: 15, alignItems: 'flex-end' },
  addBtn: { backgroundColor: '#10B981', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, elevation: 2 },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  formContainer: { backgroundColor: '#FFF', margin: 15, padding: 15, borderRadius: 12, elevation: 3 },
  inputWrapper: { marginBottom: 10 },
  inputLabel: { fontSize: 13, color: '#475569', marginBottom: 4, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10, textAlign: 'right', fontSize: 15, backgroundColor: '#F8FAFC' },
  checkboxContainer: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#007BFF', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  checkboxChecked: { backgroundColor: '#007BFF' },
  checkboxLabel: { fontSize: 14, color: '#333' },
  saveBtn: { backgroundColor: '#007BFF', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10, elevation: 2 },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  filterSection: { paddingHorizontal: 15, marginBottom: 5, marginTop: 10 },
  searchInput: { backgroundColor: '#FFF', padding: 12, borderRadius: 10, textAlign: 'right', elevation: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 15, backgroundColor: '#FFF', marginLeft: 8, elevation: 1, borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#007BFF' },
  filterChipText: { fontSize: 12, color: '#64748B' },
  filterChipTextActive: { color: '#FFF', fontWeight: 'bold' },
  listContainer: { padding: 15 },
  listTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B', textAlign: 'right', marginBottom: 12, borderRightWidth: 4, borderRightColor: '#007BFF', paddingRight: 10 },
  card: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  cardInfo: { flex: 1, alignItems: 'flex-end' },
  cardName: { fontSize: 15, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
  cardSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  cardDate: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
  cardActions: { flexDirection: 'column', alignItems: 'center', marginLeft: 10 },
  editBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#DBEAFE', marginBottom: 6 },
  editBtnText: { color: '#3B82F6', fontWeight: 'bold', fontSize: 12 },
  deleteBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#FEE2E2' },
  deleteBtnText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  emptyListText: { textAlign: 'center', color: '#94A3B8', marginTop: 30, fontSize: 15 },
});
