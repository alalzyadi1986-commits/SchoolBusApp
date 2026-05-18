import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, set, push, get, remove, onValue, update } from 'firebase/database';
import { db } from '../firebaseConfig';

export default function SchoolScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { schoolId } = route.params || {};

  const [activeTab, setActiveTab] = useState('drivers');
  const [loading, setLoading] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [schoolData, setSchoolData] = useState(null);

  const [driversList, setDriversList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [parentsList, setParentsList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);

  // حالات التعديل
  const [editingId, setEditingId] = useState(null);

  // حقول الإدخال للسائقين
  const [driverUser, setDriverUser] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPass, setDriverPass] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [busNumber, setBusNumber] = useState('');

  // حقول الإدخال للمرافقين
  const [staffUser, setStaffUser] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffPass, setStaffPass] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [selectedDriverForStaff, setSelectedDriverForStaff] = useState('');
  const [permissions, setPermissions] = useState({
    viewLocation: true,
    markAttendance: true,
    contactParents: false,
    editStudents: false
  });

  // حقول الإدخال للأهل
  const [parentUser, setParentUser] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [parentPass, setParentPass] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  // حقول الإدخال للطلاب
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [selectedParent, setSelectedParent] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');

  useEffect(() => {
    if (schoolId) {
      const schoolRef = ref(db, `schools/${schoolId}`);
      const unsubscribe = onValue(schoolRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setSchoolData(data);
          
          const today = new Date();
          const expiry = new Date(data.endDate);
          setIsReadOnly(expiry < today);

          if (data.drivers) setDriversList(Object.keys(data.drivers).map(key => ({ username: key, ...data.drivers[key] })));
          else setDriversList([]);

          if (data.staff) setStaffList(Object.keys(data.staff).map(key => ({ username: key, ...data.staff[key] })));
          else setStaffList([]);

          if (data.parents) setParentsList(Object.keys(data.parents).map(key => ({ username: key, ...data.parents[key] })));
          else setParentsList([]);

          if (data.students) setStudentsList(Object.keys(data.students).map(key => ({ id: key, ...data.students[key] })));
          else setStudentsList([]);
        }
      });
      return () => unsubscribe();
    }
  }, [schoolId]);

  const checkAccess = () => {
    if (isReadOnly) {
      Alert.alert('اشتراك منتهي', 'يرجى تجديد الاشتراك للمتابعة والقيام بالتعديلات.');
      return false;
    }
    return true;
  };

  const resetForms = () => {
    setEditingId(null);
    setDriverUser(''); setDriverName(''); setDriverPass(''); setDriverPhone(''); setBusNumber('');
    setStaffUser(''); setStaffName(''); setStaffPass(''); setStaffPhone(''); setSelectedDriverForStaff('');
    setParentUser(''); setFamilyName(''); setParentPass(''); setParentPhone('');
    setStudentName(''); setStudentClass(''); setSelectedParent(''); setSelectedDriver('');
    setPermissions({ viewLocation: true, markAttendance: true, contactParents: false, editStudents: false });
  };

  const handleSaveDriver = async () => {
    if (!checkAccess()) return;
    if (!driverUser || !driverName || !driverPass || !driverPhone || !busNumber) {
      Alert.alert('خطأ', 'الرجاء تعبئة جميع حقول السائق');
      return;
    }
    try {
      const data = { name: driverName, password: driverPass, phone: driverPhone, bus_number: busNumber, role: 'driver' };
      await set(ref(db, `schools/${schoolId}/drivers/${driverUser.trim()}`), data);
      Alert.alert('نجاح', editingId ? 'تم تحديث بيانات السائق' : 'تم إضافة السائق بنجاح');
      resetForms();
    } catch (error) { Alert.alert('خطأ', 'فشلت العملية'); }
  };

  const handleSaveStaff = async () => {
    if (!checkAccess()) return;
    if (!staffUser || !staffName || !staffPass || !staffPhone) {
      Alert.alert('خطأ', 'الرجاء تعبئة جميع حقول المرافقة');
      return;
    }
    try {
      const data = {
        name: staffName,
        password: staffPass,
        phone: staffPhone,
        driver_id: selectedDriverForStaff,
        permissions: permissions,
        role: 'staff'
      };
      await set(ref(db, `schools/${schoolId}/staff/${staffUser.trim()}`), data);
      Alert.alert('نجاح', editingId ? 'تم تحديث بيانات المرافقة' : 'تم إضافة المرافقة بنجاح');
      resetForms();
    } catch (error) { Alert.alert('خطأ', 'فشلت العملية'); }
  };

  const handleSaveParent = async () => {
    if (!checkAccess()) return;
    if (!parentUser || !familyName || !parentPass || !parentPhone) {
      Alert.alert('خطأ', 'الرجاء تعبئة جميع حقول الأهل');
      return;
    }
    try {
      const data = { family_name: familyName, password: parentPass, phone: parentPhone, role: 'parent' };
      await set(ref(db, `schools/${schoolId}/parents/${parentUser.trim()}`), data);
      Alert.alert('نجاح', editingId ? 'تم تحديث بيانات العائلة' : 'تم إنشاء حساب العائلة بنجاح');
      resetForms();
    } catch (error) { Alert.alert('خطأ', 'فشلت العملية'); }
  };

  const handleSaveStudent = async () => {
    if (!checkAccess()) return;
    if (!studentName || !studentClass || !selectedParent || !selectedDriver) {
      Alert.alert('خطأ', 'الرجاء تعبئة جميع حقول الطالب');
      return;
    }
    try {
      const data = { name: studentName, class: studentClass, parent_username: selectedParent, driver_id: selectedDriver };
      if (editingId) {
        await update(ref(db, `schools/${schoolId}/students/${editingId}`), data);
      } else {
        await push(ref(db, `schools/${schoolId}/students`), data);
      }
      Alert.alert('نجاح', 'تم حفظ بيانات الطالب');
      resetForms();
    } catch (error) { Alert.alert('خطأ', 'فشلت العملية'); }
  };

  const togglePermission = (key) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEdit = (item, type) => {
    if (!checkAccess()) return;
    setEditingId(item.username || item.id);
    if (type === 'driver') {
      setActiveTab('drivers');
      setDriverUser(item.username); setDriverName(item.name); setDriverPass(item.password); setDriverPhone(item.phone); setBusNumber(item.bus_number);
    } else if (type === 'staff') {
      setActiveTab('staff');
      setStaffUser(item.username); setStaffName(item.name); setStaffPass(item.password); setStaffPhone(item.phone);
      setSelectedDriverForStaff(item.driver_id || '');
      if (item.permissions) setPermissions(item.permissions);
    } else if (type === 'parent') {
      setActiveTab('parents');
      setParentUser(item.username); setFamilyName(item.family_name); setParentPass(item.password); setParentPhone(item.phone);
    } else if (type === 'student') {
      setActiveTab('students');
      setStudentName(item.name); setStudentClass(item.class); setSelectedParent(item.parent_username); setSelectedDriver(item.driver_id);
    }
  };

  const handleDelete = (path, type) => {
    if (!checkAccess()) return;
    Alert.alert('تأكيد الحذف', `هل أنت متأكد من حذف ${type}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
          await remove(ref(db, `schools/${schoolId}/${path}`));
          Alert.alert('نجاح', 'تم الحذف');
        }
      }
    ]);
  };

  const PermissionItem = ({ label, value, onToggle }) => (
    <TouchableOpacity style={styles.permissionRow} onPress={onToggle}>
      <View style={[styles.checkbox, value && styles.checkboxChecked]}>
        {value && <Text style={styles.checkboxTick}>✓</Text>}
      </View>
      <Text style={styles.permissionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.headerTitle}>لوحة تحكم المدرسة</Text>
          <Text style={[styles.subscriptionInfo, isReadOnly && { color: '#e74c3c' }]}>
            {isReadOnly ? 'الاشتراك منتهي ❌' : `مشترك لغاية: ${schoolData ? new Date(schoolData.endDate).toLocaleDateString('ar-EG') : ''} ✅`}
          </Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {['drivers', 'staff', 'parents', 'students'].map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tabItem, activeTab === tab && styles.activeTabItem]} onPress={() => { setActiveTab(tab); resetForms(); }}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'drivers' ? 'السائقين' : tab === 'staff' ? 'المرافقين' : tab === 'parents' ? 'الأهل' : 'الطلاب'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.contentScroll} keyboardShouldPersistTaps="handled">
        {activeTab === 'drivers' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{editingId ? 'تعديل سائق' : 'إضافة سائق جديد'}</Text>
            <TextInput style={[styles.input, editingId && styles.disabledInput]} placeholder="اسم المستخدم" value={driverUser} onChangeText={setDriverUser} editable={!editingId} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="اسم السائق" value={driverName} onChangeText={setDriverName} />
            <TextInput style={styles.input} placeholder="كلمة المرور" value={driverPass} onChangeText={setDriverPass} />
            <TextInput style={styles.input} placeholder="رقم الهاتف" value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="رقم الباص" value={busNumber} onChangeText={setBusNumber} />
            <TouchableOpacity style={[styles.addBtn, isReadOnly && styles.disabledBtn]} onPress={handleSaveDriver}>
              <Text style={styles.addBtnText}>{editingId ? 'تحديث' : 'حفظ'}</Text>
            </TouchableOpacity>
            {editingId && <TouchableOpacity style={styles.cancelBtn} onPress={resetForms}><Text style={styles.cancelBtnText}>إلغاء</Text></TouchableOpacity>}
            
            <Text style={styles.listTitle}>قائمة السائقين</Text>
            {driversList.map((item) => (
              <View key={item.username} style={styles.dataRow}>
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={() => handleEdit(item, 'driver')}><Text style={styles.editText}>تعديل</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(`drivers/${item.username}`, 'السائق')}><Text style={styles.deleteText}>حذف</Text></TouchableOpacity>
                </View>
                <View style={styles.rowInfo}><Text style={styles.rowName}>{item.name}</Text><Text style={styles.rowSub}>{item.bus_number}</Text></View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'staff' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{editingId ? 'تعديل مرافقة' : 'إضافة مرافقة جديدة'}</Text>
            <TextInput style={[styles.input, editingId && styles.disabledInput]} placeholder="اسم المستخدم" value={staffUser} onChangeText={setStaffUser} editable={!editingId} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="اسم المرافقة" value={staffName} onChangeText={setStaffName} />
            <TextInput style={styles.input} placeholder="كلمة المرور" value={staffPass} onChangeText={setStaffPass} />
            <TextInput style={styles.input} placeholder="رقم الهاتف" value={staffPhone} onChangeText={setStaffPhone} keyboardType="phone-pad" />
            
            <Text style={styles.subTitle}>ربط مع سائق:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelect}>
              {driversList.map(d => (
                <TouchableOpacity key={d.username} style={[styles.selectItem, selectedDriverForStaff === d.username && styles.selectedItem]} onPress={() => setSelectedDriverForStaff(d.username)}>
                  <Text style={[styles.selectText, selectedDriverForStaff === d.username && styles.selectedText]}>{d.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.subTitle}>الصلاحيات:</Text>
            <PermissionItem label="رؤية موقع الطلاب" value={permissions.viewLocation} onToggle={() => togglePermission('viewLocation')} />
            <PermissionItem label="تسجيل الحضور والغياب" value={permissions.markAttendance} onToggle={() => togglePermission('markAttendance')} />
            <PermissionItem label="التواصل مع الأهل" value={permissions.contactParents} onToggle={() => togglePermission('contactParents')} />
            <PermissionItem label="تعديل بيانات الطلاب" value={permissions.editStudents} onToggle={() => togglePermission('editStudents')} />

            <TouchableOpacity style={[styles.addBtn, isReadOnly && styles.disabledBtn]} onPress={handleSaveStaff}>
              <Text style={styles.addBtnText}>{editingId ? 'تحديث' : 'حفظ'}</Text>
            </TouchableOpacity>
            {editingId && <TouchableOpacity style={styles.cancelBtn} onPress={resetForms}><Text style={styles.cancelBtnText}>إلغاء</Text></TouchableOpacity>}

            <Text style={styles.listTitle}>قائمة المرافقين</Text>
            {staffList.map((item) => (
              <View key={item.username} style={styles.dataRow}>
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={() => handleEdit(item, 'staff')}><Text style={styles.editText}>تعديل</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(`staff/${item.username}`, 'المرافقة')}><Text style={styles.deleteText}>حذف</Text></TouchableOpacity>
                </View>
                <View style={styles.rowInfo}><Text style={styles.rowName}>{item.name}</Text><Text style={styles.rowSub}>مع السائق: {item.driver_id || 'غير مرتبط'}</Text></View>
              </View>
            ))}
          </View>
        )}

        {/* بقية التبويبات (الأهل والطلاب) تتبع نفس المنطق مع تفعيل أزرار التعديل */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  header: { padding: 15, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', textAlign: 'right' },
  subscriptionInfo: { fontSize: 11, color: '#27ae60', fontWeight: '600', textAlign: 'right' },
  logoutBtn: { padding: 8, backgroundColor: '#fdf2f2', borderRadius: 8 },
  logoutText: { color: '#e74c3c', fontWeight: 'bold' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  activeTabItem: { borderBottomWidth: 3, borderBottomColor: '#e67e22' },
  tabText: { color: '#7f8c8d', fontSize: 12 },
  activeTabText: { color: '#e67e22', fontWeight: 'bold' },
  contentScroll: { flex: 1, padding: 15 },
  sectionCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 20, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: '#2c3e50', textAlign: 'right' },
  input: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 10, textAlign: 'right', borderWidth: 1, borderColor: '#eee' },
  disabledInput: { backgroundColor: '#eee', color: '#7f8c8d' },
  subTitle: { fontSize: 14, fontWeight: 'bold', marginVertical: 10, textAlign: 'right', color: '#34495e' },
  horizontalSelect: { flexDirection: 'row-reverse', marginBottom: 15 },
  selectItem: { paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#f1f1f1', borderRadius: 20, marginLeft: 10 },
  selectedItem: { backgroundColor: '#e67e22' },
  selectText: { fontSize: 12, color: '#7f8c8d' },
  selectedText: { color: '#fff', fontWeight: 'bold' },
  permissionRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 },
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: '#e67e22', borderRadius: 4, marginLeft: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#e67e22' },
  checkboxTick: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  permissionLabel: { fontSize: 13, color: '#2c3e50' },
  addBtn: { backgroundColor: '#e67e22', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  disabledBtn: { backgroundColor: '#bdc3c7' },
  addBtnText: { color: '#fff', fontWeight: 'bold' },
  cancelBtn: { padding: 10, marginTop: 5, alignItems: 'center' },
  cancelBtnText: { color: '#7f8c8d', fontSize: 13 },
  listTitle: { fontSize: 14, fontWeight: 'bold', marginTop: 25, marginBottom: 15, textAlign: 'right', color: '#2c3e50' },
  dataRow: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f1f1', alignItems: 'center', justifyContent: 'space-between' },
  rowActions: { flexDirection: 'row' },
  editText: { color: '#3498db', fontWeight: 'bold', marginRight: 15, fontSize: 13 },
  deleteText: { color: '#e74c3c', fontWeight: 'bold', fontSize: 13 },
  rowInfo: { alignItems: 'flex-end' },
  rowName: { fontSize: 14, fontWeight: 'bold', color: '#2c3e50' },
  rowSub: { fontSize: 12, color: '#7f8c8d', marginTop: 2 }
});
