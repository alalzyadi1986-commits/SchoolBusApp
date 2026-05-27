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

    const schoolUnsub = onValue(ref(db, `schools/${schoolId}`), (snap) => {
      const data = snap.val();
      if (data) {
        setDynamicSchoolName(data.name || '');
        setExpiryDate(data.endDate || '');
        setIsExpired(new Date(data.endDate) < new Date());
      }
    });

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
      const safeUsername = formData.username?.replace(/\./g, ',');
      if (!safeUsername || !formData.name) {
        Alert.alert('خطأ', 'يرجى تعبئة الحقول الأساسية (الاسم واسم المستخدم)');
        return;
      }
      try {
        if (editingId) {
          await update(ref(db, `${path}/${editingId}`), formData);
          setEditingId(null);
        } else {
          await set(ref(db, `${path}/${safeUsername}`), formData);
          
          const roleMap = {
            'drivers': 'driver',
            'staff': 'staff',
            'parents': 'parent',
            'students': 'student',
            'managers': 'manager'
          };
          const role = roleMap[activeTab] || activeTab;
          await set(ref(db, `userIndex/${safeUsername}`), { schoolId, role });
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
    ), [students, searchQuery, selectedClassFilter]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.title}>{dynamicSchoolName || 'لوحة الإدارة'}</Text>
          <Text style={styles.expiryText}>الاشتراك ينتهي في: {expiryDate.split('T')[0]}</Text>
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
          ].map(tab => (
            <TouchableOpacity 
              key={tab.id} 
              style={[styles.tab, activeTab === tab.id && styles.tabActive]} 
              onPress={() => { setActiveTab(tab.id); hideAllForms(); }}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="بحث بالاسم أو اسم المستخدم..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* المحتوى سيتم عرضه هنا بناءً على التاب المختار */}
      <View style={{ flex: 1, padding: 15 }}>
        <Text style={{ textAlign: 'center', color: '#64748B' }}>
          يتم حالياً عرض قسم: {activeTab}
        </Text>
        <TouchableOpacity 
          style={styles.addBtn} 
          onPress={() => {
            setFormData({});
            setEditingId(null);
            if (activeTab === 'drivers') setShowDriverForm(true);
            else if (activeTab === 'staff') setShowStaffForm(true);
            else if (activeTab === 'parents') setShowParentForm(true);
            else if (activeTab === 'students') setShowStudentForm(true);
            else if (activeTab === 'managers') setShowManagerForm(true);
          }}
        >
          <Text style={styles.addBtnText}>+ إضافة جديد</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  expiryText: { fontSize: 12, color: '#EF4444', marginTop: 4 },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold' },
  tabsWrapper: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabsContainer: { paddingHorizontal: 10, paddingVertical: 10 },
  tab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#F1F5F9' },
  tabActive: { backgroundColor: '#3B82F6' },
  tabText: { fontSize: 14, color: '#64748B', fontWeight: 'bold' },
  tabTextActive: { color: '#FFF' },
  searchWrapper: { padding: 15 },
  searchInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, textAlign: 'right' },
  addBtn: { backgroundColor: '#10B981', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  inputWrapper: { marginBottom: 15 },
  inputLabel: { fontSize: 14, color: '#475569', marginBottom: 5, textAlign: 'right' },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, textAlign: 'right' }
});
