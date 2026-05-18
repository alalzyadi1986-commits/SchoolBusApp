import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { db } from '../firebaseConfig';
import { ref, set, push, onValue, remove, update } from 'firebase/database';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SchoolScreen({ route, navigation }) {
  const { schoolId, schoolName } = route.params || {};
  const [activeTab, setActiveTab] = useState('drivers');
  const [loading, setLoading] = useState(true);
  const [expiryDate, setExpiryDate] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  // البيانات
  const [drivers, setDrivers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [reports, setReports] = useState([]);

  // حقول الإدخال (ثابتة)
  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('الكل');
  const [selectedDriverReport, setSelectedDriverReport] = useState('الكل');

  useEffect(() => {
    if (!schoolId) return;

    // جلب بيانات المدرسة والاشتراك
    onValue(ref(db, `schools/${schoolId}`), (snap) => {
      const data = snap.val();
      if (data) {
        setExpiryDate(data.expiryDate || '');
        const exp = new Date(data.expiryDate);
        setIsExpired(exp < new Date());
      }
    });

    // جلب القوائم
    const fetchData = (path, setter) => {
      onValue(ref(db, `schools/${schoolId}/${path}`), (snap) => {
        const data = snap.val();
        setter(data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : []);
      });
    };

    fetchData('drivers', setDrivers);
    fetchData('staff', setStaff);
    fetchData('parents', setParents);
    fetchData('students', setStudents);
    fetchData('emergencies', setEmergencies);
    fetchData('reports', setReports);
    setLoading(false);
  }, [schoolId]);

  const handleAction = async (type, action) => {
    if (isExpired && action !== 'view') {
      Alert.alert('تنبيه', 'يرجى تجديد الاشتراك للمتابعة');
      return;
    }

    const path = `schools/${schoolId}/${activeTab}`;
    if (action === 'delete') {
      Alert.alert('حذف', 'هل أنت متأكد؟', [
        { text: 'إلغاء' },
        { text: 'حذف', onPress: () => remove(ref(db, `${path}/${type.id}`)) }
      ]);
    } else if (action === 'save') {
      if (!formData.username || !formData.name) {
        Alert.alert('خطأ', 'يرجى تعبئة الحقول الأساسية');
        return;
      }
      const data = { ...formData };
      if (editingId) {
        await update(ref(db, `${path}/${editingId}`), data);
        setEditingId(null);
      } else {
        await set(ref(db, `${path}/${data.username}`), data);
      }
      setFormData({});
    }
  };

  const startEdit = (item) => {
    setFormData(item);
    setEditingId(item.id);
  };

  const renderInput = (placeholder, field, isPassword = false, isNumeric = false) => (
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      value={formData[field] || ''}
      onChangeText={(txt) => setFormData({ ...formData, [field]: txt })}
      secureTextEntry={isPassword}
      keyboardType={isNumeric ? 'numeric' : 'default'}
      editable={field === 'username' ? !editingId : true}
    />
  );

  const renderPermission = (label, field) => (
    <TouchableOpacity 
      style={styles.checkboxContainer} 
      onPress={() => setFormData({ ...formData, permissions: { ...formData.permissions, [field]: !formData.permissions?.[field] } })}
    >
      <View style={[styles.checkbox, formData.permissions?.[field] && styles.checkboxChecked]} />
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchSearch = s.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchClass = selectedClassFilter === 'الكل' || `${s.class}-${s.section}` === selectedClassFilter;
      return matchSearch && matchClass;
    });
  }, [students, searchQuery, selectedClassFilter]);

  const classOptions = useMemo(() => {
    const options = new Set(students.map(s => `${s.class}-${s.section}`));
    return ['الكل', ...Array.from(options)];
  }, [students]);

  const filteredReports = useMemo(() => {
    if (selectedDriverReport === 'الكل') return reports;
    return reports.filter(r => r.driverId === selectedDriverReport);
  }, [reports, selectedDriverReport]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      {/* رأس الصفحة */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}><Text style={styles.logoutText}>خروج</Text></TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={[styles.expiryText, { color: isExpired ? '#EF4444' : '#10B981' }]}>
            {isExpired ? 'الاشتراك منتهي ❌' : `مشترك لغاية: ${expiryDate} ✅`}
          </Text>
        </View>
      </View>

      {/* التبويبات */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse' }}>
          {[
            { id: 'drivers', label: 'السائقين' },
            { id: 'staff', label: 'المرافقين' },
            { id: 'parents', label: 'الأهل' },
            { id: 'students', label: 'الطلاب' },
            { id: 'reports', label: 'التقارير' },
            { id: 'emergencies', label: 'الطوارئ' }
          ].map(tab => (
            <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && styles.activeTab]} onPress={() => { setActiveTab(tab.id); setFormData({}); setEditingId(null); }}>
              <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content}>
        {/* قسم الإضافة (ثابت) */}
        {['drivers', 'staff', 'parents', 'students'].includes(activeTab) && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'تعديل البيانات' : `إضافة ${activeTab === 'drivers' ? 'سائق' : activeTab === 'staff' ? 'مرافق' : activeTab === 'parents' ? 'ولي أمر' : 'طالب'}`}</Text>
            
            {renderInput('الاسم الكامل', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {renderInput('كلمة المرور', 'password', true)}
            {activeTab !== 'students' && renderInput('رقم الهاتف', 'phone', false, true)}
            
            {activeTab === 'drivers' && (
              <>
                {renderInput('رقم الباص', 'bus_number')}
                {renderInput('السرعة القصوى (كم/س)', 'max_speed', false, true)}
                <Text style={styles.sectionLabel}>الصلاحيات:</Text>
                {renderPermission('بدء الرحلة وبث الموقع', 'canStartTrip')}
                {renderPermission('رؤية موقع الطلاب', 'canViewStudents')}
              </>
            )}

            {activeTab === 'staff' && (
              <>
                <Text style={styles.sectionLabel}>ربط بالسائق:</Text>
                <ScrollView horizontal style={{ marginBottom: 10 }}>
                  {drivers.map(d => (
                    <TouchableOpacity 
                      key={d.id} 
                      style={[styles.miniChip, formData.driver_id === d.username && styles.miniChipActive]}
                      onPress={() => setFormData({ ...formData, driver_id: d.username === formData.driver_id ? null : d.username })}
                    >
                      <Text style={[styles.miniChipText, formData.driver_id === d.username && styles.miniChipTextActive]}>{d.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.sectionLabel}>الصلاحيات:</Text>
                {renderPermission('تسجيل الحضور والغياب', 'canMarkAttendance')}
                {renderPermission('إضافة طلاب ومواقع', 'canAddStudents')}
                {renderPermission('رؤية موقع الباص', 'canViewBus')}
              </>
            )}

            {activeTab === 'students' && (
              <>
                <View style={styles.row}>
                  <View style={{ flex: 1, marginLeft: 5 }}>{renderInput('الصف', 'class')}</View>
                  <View style={{ flex: 1 }}>{renderInput('الشعبة', 'section')}</View>
                </View>
                <Text style={styles.sectionLabel}>ربط بولي الأمر:</Text>
                <ScrollView horizontal style={{ marginBottom: 10 }}>
                  {parents.map(p => (
                    <TouchableOpacity 
                      key={p.id} 
                      style={[styles.miniChip, formData.parent_username === p.username && styles.miniChipActive]}
                      onPress={() => setFormData({ ...formData, parent_username: p.username === formData.parent_username ? null : p.username })}
                    >
                      <Text style={[styles.miniChipText, formData.parent_username === p.username && styles.miniChipTextActive]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={() => handleAction(null, 'save')}>
              <Text style={styles.saveBtnText}>{editingId ? 'تحديث البيانات' : 'حفظ'}</Text>
            </TouchableOpacity>
            {editingId && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingId(null); setFormData({}); }}>
                <Text style={styles.cancelBtnText}>إلغاء التعديل</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* قسم البحث والفلترة للطلاب */}
        {activeTab === 'students' && (
          <View style={styles.filterSection}>
            <TextInput 
              style={styles.searchInput} 
              placeholder="بحث عن اسم طالب..." 
              value={searchQuery} 
              onChangeText={setSearchQuery} 
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classFilter}>
              {classOptions.map(opt => (
                <TouchableOpacity key={opt} style={[styles.filterChip, selectedClassFilter === opt && styles.filterChipActive]} onPress={() => setSelectedClassFilter(opt)}>
                  <Text style={[styles.filterChipText, selectedClassFilter === opt && styles.filterChipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* القوائم */}
        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              {activeTab === 'drivers' ? `قائمة السائقين (${drivers.length})` :
               activeTab === 'staff' ? `قائمة المرافقين (${staff.length})` :
               activeTab === 'parents' ? `قائمة الأهل (${parents.length})` :
               activeTab === 'students' ? `قائمة الطلاب (${filteredStudents.length})` :
               activeTab === 'reports' ? 'سجل التقارير' : 'بلاغات الطوارئ'}
            </Text>
          </View>

          {activeTab === 'reports' && (
            <View style={styles.reportFilter}>
              <Text style={styles.filterLabel}>عرض تقارير السائق:</Text>
              <ScrollView horizontal>
                <TouchableOpacity style={[styles.miniChip, selectedDriverReport === 'الكل' && styles.miniChipActive]} onPress={() => setSelectedDriverReport('الكل')}>
                  <Text style={selectedDriverReport === 'الكل' && {color: '#FFF'}}>الكل</Text>
                </TouchableOpacity>
                {drivers.map(d => (
                  <TouchableOpacity key={d.id} style={[styles.miniChip, selectedDriverReport === d.username && styles.miniChipActive]} onPress={() => setSelectedDriverReport(d.username)}>
                    <Text style={selectedDriverReport === d.username && {color: '#FFF'}}>{d.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {(activeTab === 'reports' ? filteredReports : activeTab === 'students' ? filteredStudents : 
            activeTab === 'drivers' ? drivers : activeTab === 'staff' ? staff : 
            activeTab === 'parents' ? parents : emergencies).map((item, index) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardInfo}>
                {activeTab === 'drivers' ? (
                  <>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardSub}>باص رقم: {item.bus_number} | السرعة: {item.max_speed || 80} كم/س</Text>
                  </>
                ) : activeTab === 'reports' ? (
                  <>
                    <Text style={[styles.cardName, {color: item.type === 'speed' ? '#EF4444' : '#1E293B'}]}>{item.type === 'speed' ? '⚠️ تجاوز سرعة' : '📝 تحضير'}</Text>
                    <Text style={styles.cardSub}>{item.message}</Text>
                    <Text style={styles.cardDate}>{new Date(item.timestamp).toLocaleString('ar-EG')}</Text>
                  </>
                ) : activeTab === 'emergencies' ? (
                  <>
                    <Text style={styles.emergencyTitle}>🆘 بلاغ من: {item.senderName}</Text>
                    <Text style={styles.cardSub}>{item.message}</Text>
                    <Text style={styles.cardDate}>{new Date(item.timestamp).toLocaleString('ar-EG')}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.cardName}>{item.name || item.senderName}</Text>
                    <Text style={styles.cardSub}>{item.phone || `${item.class}-${item.section}` || item.username}</Text>
                  </>
                )}
              </View>
              
              {['drivers', 'staff', 'parents', 'students'].includes(activeTab) && (
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(item)}>
                    <Text style={styles.editBtnText}>تعديل</Text>
                  </TouchableOpacity>
                  <View style={{ width: 15 }} /> 
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleAction(item, 'delete')}>
                    <Text style={styles.deleteBtnText}>حذف</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  schoolName: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  expiryText: { fontSize: 12, marginTop: 2 },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold' },
  tabBar: { backgroundColor: '#FFF', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginHorizontal: 5, backgroundColor: '#F8FAFC' },
  activeTab: { backgroundColor: '#3B82F6' },
  tabText: { color: '#64748B', fontWeight: 'bold' },
  activeTabText: { color: '#FFF' },
  content: { flex: 1 },
  formCard: { backgroundColor: '#FFF', margin: 15, padding: 15, borderRadius: 15, elevation: 3 },
  formTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, textAlign: 'right', color: '#3B82F6' },
  input: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, marginBottom: 10, textAlign: 'right', borderWidth: 1, borderColor: '#E2E8F0' },
  row: { flexDirection: 'row-reverse' },
  saveBtn: { backgroundColor: '#3B82F6', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { padding: 10, alignItems: 'center', marginTop: 5 },
  cancelBtnText: { color: '#64748B' },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginTop: 10, marginBottom: 8, textAlign: 'right' },
  checkboxContainer: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#3B82F6', marginLeft: 10 },
  checkboxChecked: { backgroundColor: '#3B82F6' },
  checkboxLabel: { fontSize: 14, color: '#1E293B' },
  miniChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, backgroundColor: '#F1F5F9', marginLeft: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  miniChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  miniChipText: { fontSize: 12, color: '#64748B' },
  miniChipTextActive: { color: '#FFF' },
  filterSection: { paddingHorizontal: 15, marginBottom: 10 },
  searchInput: { backgroundColor: '#FFF', padding: 12, borderRadius: 10, textAlign: 'right', elevation: 2 },
  classFilter: { marginTop: 10 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 15, backgroundColor: '#FFF', marginLeft: 8, elevation: 1 },
  filterChipActive: { backgroundColor: '#3B82F6' },
  filterChipText: { fontSize: 12, color: '#64748B' },
  filterChipTextActive: { color: '#FFF' },
  listContainer: { padding: 15 },
  listHeader: { marginBottom: 15, borderRightWidth: 4, borderRightColor: '#3B82F6', paddingRight: 10 },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', textAlign: 'right' },
  card: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  cardInfo: { flex: 1, alignItems: 'flex-end' },
  cardName: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  cardSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  cardDate: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
  emergencyTitle: { fontSize: 15, fontWeight: 'bold', color: '#EF4444' },
  cardActions: { flexDirection: 'row-reverse', alignItems: 'center' },
  editBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#DBEAFE' },
  editBtnText: { color: '#3B82F6', fontWeight: 'bold', fontSize: 12 },
  deleteBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#FEE2E2' },
  deleteBtnText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  reportFilter: { marginBottom: 15, padding: 10, backgroundColor: '#FFF', borderRadius: 10 },
  filterLabel: { fontSize: 12, color: '#64748B', marginBottom: 5, textAlign: 'right' }
});
