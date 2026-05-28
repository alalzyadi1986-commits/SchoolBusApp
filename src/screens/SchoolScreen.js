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
  Modal,
} from 'react-native';
import { db } from '../firebaseConfig';
import { ref, set, push, onValue, remove, update } from 'firebase/database';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clearUserSession } from '../services/sessionService';

export default function SchoolScreen({ route, navigation }) {
  const { schoolId, user } = route.params || {};
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
  const [showForm, setShowForm] = useState(false);
  const [dynamicSchoolName, setDynamicSchoolName] = useState('');

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
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

    const unsubs = [
      fetchData('drivers', setDrivers),
      fetchData('staff', setStaff),
      fetchData('parents', setParents),
      fetchData('students', setStudents),
      fetchData('emergencies', setEmergencies),
      fetchData('reports', setReports),
      fetchData('managers', setManagers)
    ];

    setLoading(false);
    return () => {
      schoolUnsub();
      unsubs.forEach(u => u());
    };
  }, [schoolId]);

  const handleAction = async (action, item = null) => {
    if (isExpired && action !== 'delete') {
      Alert.alert('تنبيه', 'يرجى تجديد الاشتراك للمتابعة');
      return;
    }

    const path = `schools/${schoolId}/${activeTab}`;

    if (action === 'delete' && item) {
      Alert.alert('حذف', 'هل أنت متأكد؟', [
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
        } else {
          await set(ref(db, `${path}/${safeUsername}`), { ...formData, id: safeUsername });
          const roleMap = { 'drivers': 'driver', 'staff': 'staff', 'parents': 'parent', 'students': 'student', 'managers': 'manager' };
          await set(ref(db, `userIndex/${safeUsername}`), { schoolId, role: roleMap[activeTab] || activeTab });
        }
        setFormData({});
        setEditingId(null);
        setShowForm(false);
        Alert.alert('تم', 'تم حفظ البيانات بنجاح');
      } catch (error) {
        Alert.alert('خطأ', 'حدث خطأ أثناء الحفظ');
      }
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
    return list.filter(item => item.name?.includes(searchQuery) || item.username?.includes(searchQuery));
  }, [activeTab, drivers, staff, parents, students, managers, reports, emergencies, searchQuery]);

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

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Text style={styles.logoutText}>خروج</Text></TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.title}>{dynamicSchoolName || 'لوحة الإدارة'}</Text>
          <Text style={styles.expiryText}>الاشتراك ينتهي في: {expiryDate.split('T')[0]}</Text>
        </View>
      </View>

      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
          {[
            { id: 'drivers', label: 'السائقين' }, { id: 'staff', label: 'المرافقات' }, { id: 'parents', label: 'أولياء الأمور' },
            { id: 'students', label: 'الطلاب' }, { id: 'managers', label: 'المدراء' }, { id: 'reports', label: 'التقارير' }, { id: 'emergencies', label: 'الطوارئ' },
          ].map(tab => (
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
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => { setFormData(item); setEditingId(item.id); setShowForm(true); }}>
                <Text style={styles.editBtnText}>تعديل</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleAction('delete', item)}>
                <Text style={styles.deleteBtnText}>حذف</Text>
              </TouchableOpacity>
            </View>
            <View style={{ alignItems: 'flex-end', flex: 1 }}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSub}>{item.username || item.id}</Text>
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

      <Modal visible={showForm} animationType="slide">
        <SafeAreaView style={{ flex: 1, padding: 20 }}>
          <Text style={[styles.title, { textAlign: 'center', marginBottom: 20 }]}>{editingId ? 'تعديل بيانات' : 'إضافة جديد'}</Text>
          <ScrollView>
            {renderInput('الاسم الكامل', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {activeTab === 'drivers' && renderInput('رقم الجوال', 'phone', true)}
            {activeTab === 'drivers' && renderInput('رقم اللوحة', 'busPlate')}
            {activeTab === 'students' && renderInput('الصف', 'class')}
            {activeTab === 'students' && renderInput('اسم ولي الأمر', 'parentUsername')}
            {activeTab === 'students' && renderInput('اسم السائق', 'driverUsername')}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
            <TouchableOpacity style={[styles.addBtn, { flex: 0.45, backgroundColor: '#64748B' }]} onPress={() => setShowForm(false)}>
              <Text style={styles.addBtnText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addBtn, { flex: 0.45 }]} onPress={() => handleAction('save')}>
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
  card: { backgroundColor: '#FFF', padding: 15, borderRadius: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  cardSub: { fontSize: 13, color: '#64748B' },
  cardActions: { flexDirection: 'row' },
  editBtn: { padding: 8, backgroundColor: '#EFF6FF', borderRadius: 8, marginRight: 8 },
  editBtnText: { color: '#3B82F6', fontSize: 12, fontWeight: 'bold' },
  deleteBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8, marginRight: 15 },
  deleteBtnText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#10B981', padding: 15, borderRadius: 12, alignItems: 'center', margin: 15 },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  inputWrapper: { marginBottom: 15 },
  inputLabel: { fontSize: 14, color: '#475569', marginBottom: 5, textAlign: 'right' },
  input: { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, textAlign: 'right' }
});
