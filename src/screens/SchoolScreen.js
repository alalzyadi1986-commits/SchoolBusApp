import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, 
  Alert, ActivityIndicator, ScrollView, StatusBar, Modal, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, set, push, get, remove, onValue, update } from 'firebase/database';
import { db } from '../firebaseConfig';

const { width } = Dimensions.get('window');

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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterClass, setSelectedFilterClass] = useState('الكل');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingId, setEditingId] = useState(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busNumber, setBusNumber] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [studentSection, setStudentSection] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [selectedDriverForStudent, setSelectedDriverForStudent] = useState('');
  const [selectedStaffForStudent, setSelectedStaffForStudent] = useState('');
  
  const [permissions, setPermissions] = useState({
    viewLocation: true,
    markAttendance: true,
    contactParents: false,
    editStudents: false,
    addStudentsAndLocation: false,
    canStartTrip: true
  });

  useEffect(() => {
    if (schoolId) {
      const schoolRef = ref(db, `schools/${schoolId}`);
      const unsubscribe = onValue(schoolRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setSchoolData(data);
          const expiry = new Date(data.endDate);
          setIsReadOnly(expiry < new Date());

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
      Alert.alert('اشتراك منتهي', 'يرجى تجديد الاشتراك للمتابعة.');
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setEditingId(null);
    setUsername(''); setPassword(''); setName(''); setPhone('');
    setBusNumber(''); setSelectedDriverId(''); setStudentClass(''); setStudentSection('');
    setSelectedParentId(''); setSelectedDriverForStudent(''); setSelectedStaffForStudent('');
    setPermissions({
      viewLocation: true, markAttendance: true, contactParents: false, 
      editStudents: false, addStudentsAndLocation: false, canStartTrip: true
    });
  };

  const openModal = (type, item = null) => {
    if (!checkAccess()) return;
    setModalType(type);
    resetForm();
    if (item) {
      setEditingId(item.username || item.id);
      setUsername(item.username || '');
      setName(item.name || item.family_name || '');
      setPassword(item.password || '');
      setPhone(item.phone || '');
      if (type === 'driver') {
        setBusNumber(item.bus_number || '');
        if (item.permissions) setPermissions(item.permissions);
      }
      if (type === 'staff') {
        setSelectedDriverId(item.driver_id || '');
        if (item.permissions) setPermissions(item.permissions);
      }
      if (type === 'student') {
        setStudentClass(item.class || '');
        setStudentSection(item.section || '');
        setSelectedParentId(item.parent_username || '');
        setSelectedDriverForStudent(item.driver_id || '');
        setSelectedStaffForStudent(item.staff_id || '');
      }
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name || (modalType !== 'student' && (!username || !password))) {
      Alert.alert('خطأ', 'يرجى تعبئة الحقول الأساسية');
      return;
    }

    try {
      setLoading(true);
      let data = { name, password, phone, role: modalType };
      
      if (editingId && modalType !== 'student' && editingId !== username) {
        await remove(ref(db, `schools/${schoolId}/${modalType}s/${editingId}`));
      }

      if (modalType === 'driver') {
        data.bus_number = busNumber;
        data.permissions = permissions;
      }
      if (modalType === 'staff') {
        data.driver_id = selectedDriverId;
        data.permissions = permissions;
      }
      if (modalType === 'parent') data.family_name = name;
      
      if (modalType === 'student') {
        const studentData = { 
          name, class: studentClass, section: studentSection, 
          parent_username: selectedParentId, driver_id: selectedDriverForStudent,
          staff_id: selectedStaffForStudent
        };
        if (editingId) await update(ref(db, `schools/${schoolId}/students/${editingId}`), studentData);
        else await push(ref(db, `schools/${schoolId}/students`), studentData);
      } else {
        await set(ref(db, `schools/${schoolId}/${modalType}s/${username.trim()}`), data);
      }

      Alert.alert('نجاح', 'تم حفظ البيانات بنجاح');
      setShowModal(false);
    } catch (e) { Alert.alert('خطأ', 'فشلت العملية'); } 
    finally { setLoading(false); }
  };

  const handleDelete = (path, type) => {
    if (!checkAccess()) return;
    Alert.alert('تأكيد الحذف', `هل أنت متأكد من حذف ${type}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => { await remove(ref(db, `schools/${schoolId}/${path}`)); } }
    ]);
  };

  const uniqueClasses = useMemo(() => {
    const classes = studentsList.map(s => `${s.class} - ${s.section}`);
    return ['الكل', ...new Set(classes)];
  }, [studentsList]);

  const filteredStudents = useMemo(() => {
    return studentsList.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
      const classKey = `${student.class} - ${student.section}`;
      return matchesSearch && (selectedFilterClass === 'الكل' || classKey === selectedFilterClass);
    });
  }, [studentsList, searchQuery, selectedFilterClass]);

  const groupedStudents = filteredStudents.reduce((acc, student) => {
    const key = `${student.class || 'بدون صف'} - ${student.section || 'بدون شعبة'}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(student);
    return acc;
  }, {});

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
          <TouchableOpacity key={tab} style={[styles.tabItem, activeTab === tab && styles.activeTabItem]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'drivers' ? 'السائقين' : tab === 'staff' ? 'المرافقين' : tab === 'parents' ? 'الأهل' : 'الطلاب'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {activeTab === 'drivers' && (
          <View style={styles.listHeaderBar}>
            <Text style={styles.listHeaderText}>قائمة أسماء السائقين ({driversList.length})</Text>
          </View>
        )}
        
        {activeTab === 'students' && (
          <View style={styles.searchFilterContainer}>
            <TextInput style={styles.searchInput} placeholder="ابحث عن اسم الطالب..." value={searchQuery} onChangeText={setSearchQuery} textAlign="right" />
            <TouchableOpacity style={styles.filterDropdown} onPress={() => setShowFilterDropdown(!showFilterDropdown)}>
              <Text style={styles.filterText}>{selectedFilterClass} ▼</Text>
            </TouchableOpacity>
          </View>
        )}

        {showFilterDropdown && activeTab === 'students' && (
          <View style={styles.dropdownMenu}>
            <ScrollView style={{maxHeight: 200}}>
              {uniqueClasses.map(cls => (
                <TouchableOpacity key={cls} style={styles.dropdownItem} onPress={() => { setSelectedFilterClass(cls); setShowFilterDropdown(false); }}>
                  <Text style={styles.dropdownItemText}>{cls}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity style={styles.mainAddBtn} onPress={() => openModal(activeTab.slice(0, -1))}>
          <Text style={styles.mainAddBtnText}>➕ إضافة {activeTab === 'drivers' ? 'سائق' : activeTab === 'staff' ? 'مرافق' : activeTab === 'parents' ? 'حساب عائلة' : 'طالب'}</Text>
        </TouchableOpacity>

        <FlatList
          data={activeTab === 'drivers' ? driversList : activeTab === 'staff' ? staffList : activeTab === 'parents' ? parentsList : []}
          keyExtractor={item => item.username}
          renderItem={({ item }) => (
            <View style={styles.dataRow}>
              <View style={styles.rowActions}>
                <TouchableOpacity onPress={() => openModal(activeTab.slice(0, -1), item)}><Text style={styles.editText}>تعديل</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(`${activeTab}/${item.username}`, activeTab)}><Text style={styles.deleteText}>حذف</Text></TouchableOpacity>
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{item.name || item.family_name}</Text>
                <Text style={styles.rowSub}>{item.username} {item.bus_number ? `| باص: ${item.bus_number}` : ''}</Text>
              </View>
            </View>
          )}
          ListHeaderComponent={activeTab === 'students' ? (
            <View>
              {Object.keys(groupedStudents).map(group => (
                <View key={group} style={styles.groupContainer}>
                  <Text style={styles.groupHeader}>{group}</Text>
                  {groupedStudents[group].map(student => (
                    <View key={student.id} style={styles.dataRow}>
                      <View style={styles.rowActions}>
                        <TouchableOpacity onPress={() => openModal('student', student)}><Text style={styles.editText}>تعديل</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(`students/${student.id}`, 'الطالب')}><Text style={styles.deleteText}>حذف</Text></TouchableOpacity>
                      </View>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>{student.name}</Text>
                        <Text style={styles.rowSub}>ولي الأمر: {student.parent_username}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        />
      </View>

      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'تعديل البيانات' : 'إضافة جديد'}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>الاسم الكامل</Text>
                <TextInput style={styles.input} placeholder="أدخل الاسم هنا..." value={name} onChangeText={setName} />
              </View>

              {modalType !== 'student' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>اسم المستخدم</Text>
                  <TextInput style={styles.input} placeholder="أدخل اسم المستخدم..." value={username} onChangeText={setUsername} autoCapitalize="none" />
                </View>
              )}
              
              {modalType !== 'student' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>كلمة المرور</Text>
                  <TextInput style={styles.input} placeholder="أدخل كلمة المرور..." value={password} onChangeText={setPassword} />
                </View>
              )}
              
              {modalType !== 'student' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>رقم الهاتف</Text>
                  <TextInput style={styles.input} placeholder="أدخل رقم الهاتف..." value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                </View>
              )}

              {modalType === 'driver' && (
                <View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>رقم الباص</Text>
                    <TextInput style={styles.input} placeholder="أدخل رقم الباص..." value={busNumber} onChangeText={setBusNumber} />
                  </View>
                  <Text style={styles.subTitle}>صلاحيات السائق:</Text>
                  <PermissionToggle label="بدء الرحلة وبث الموقع" value={permissions.canStartTrip} onToggle={() => setPermissions({...permissions, canStartTrip: !permissions.canStartTrip})} />
                  <PermissionToggle label="رؤية موقع الطلاب" value={permissions.viewLocation} onToggle={() => setPermissions({...permissions, viewLocation: !permissions.viewLocation})} />
                </View>
              )}

              {modalType === 'staff' && (
                <View>
                  <Text style={styles.subTitle}>ربط مع سائق:</Text>
                  <ScrollView horizontal style={styles.horizontalSelect}>
                    <TouchableOpacity style={[styles.selectItem, selectedDriverId === '' && styles.selectedItem]} onPress={() => setSelectedDriverId('')}>
                      <Text style={[styles.selectText, selectedDriverId === '' && styles.selectedText]}>بدون ربط</Text>
                    </TouchableOpacity>
                    {driversList.map(d => (
                      <TouchableOpacity key={d.username} style={[styles.selectItem, selectedDriverId === d.username && styles.selectedItem]} onPress={() => setSelectedDriverId(d.username)}>
                        <Text style={[styles.selectText, selectedDriverId === d.username && styles.selectedText]}>{d.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <Text style={styles.subTitle}>صلاحيات المرافقة:</Text>
                  <PermissionToggle label="رؤية الموقع" value={permissions.viewLocation} onToggle={() => setPermissions({...permissions, viewLocation: !permissions.viewLocation})} />
                  <PermissionToggle label="تسجيل الحضور" value={permissions.markAttendance} onToggle={() => setPermissions({...permissions, markAttendance: !permissions.markAttendance})} />
                  <PermissionToggle label="إضافة طلاب ومواقع" value={permissions.addStudentsAndLocation} onToggle={() => setPermissions({...permissions, addStudentsAndLocation: !permissions.addStudentsAndLocation})} />
                </View>
              )}

              {modalType === 'student' && (
                <View>
                  <View style={styles.inputGroup}><Text style={styles.inputLabel}>الصف</Text><TextInput style={styles.input} placeholder="مثلاً: الأول" value={studentClass} onChangeText={setStudentClass} /></View>
                  <View style={styles.inputGroup}><Text style={styles.inputLabel}>الشعبة</Text><TextInput style={styles.input} placeholder="مثلاً: أ" value={studentSection} onChangeText={setStudentSection} /></View>
                  <Text style={styles.subTitle}>الارتباطات:</Text>
                  <SelectionList label="ولي الأمر" data={parentsList} selected={selectedParentId} onSelect={setSelectedParentId} displayKey="family_name" emptyLabel="فك الارتباط" />
                  <SelectionList label="السائق" data={driversList} selected={selectedDriverForStudent} onSelect={setSelectedDriverForStudent} displayKey="name" emptyLabel="بدون سائق" />
                  <SelectionList label="المرافقة" data={staffList} selected={selectedStaffForStudent} onSelect={setSelectedStaffForStudent} displayKey="name" emptyLabel="بدون مرافقة" />
                </View>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>حفظ البيانات</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowModal(false)}><Text style={styles.closeBtnText}>إلغاء</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const PermissionToggle = ({ label, value, onToggle }) => (
  <TouchableOpacity style={styles.permissionRow} onPress={onToggle}>
    <View style={[styles.checkbox, value && styles.checkboxChecked]}>{value && <Text style={styles.checkboxTick}>✓</Text>}</View>
    <Text style={styles.permissionLabel}>{label}</Text>
  </TouchableOpacity>
);

const SelectionList = ({ label, data, selected, onSelect, displayKey, emptyLabel }) => (
  <View>
    <Text style={styles.subTitle}>{label}:</Text>
    <ScrollView horizontal style={styles.horizontalSelect}>
      <TouchableOpacity style={[styles.selectItem, selected === '' && styles.selectedItem]} onPress={() => onSelect('')}>
        <Text style={[styles.selectText, selected === '' && styles.selectedText]}>{emptyLabel}</Text>
      </TouchableOpacity>
      {data.map(item => (
        <TouchableOpacity key={item.username} style={[styles.selectItem, selected === item.username && styles.selectedItem]} onPress={() => onSelect(item.username)}>
          <Text style={[styles.selectText, selected === item.username && styles.selectedText]}>{item[displayKey]}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  subscriptionInfo: { fontSize: 11, color: '#10B981', fontWeight: '600' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFF', paddingVertical: 5 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  activeTabItem: { borderBottomWidth: 3, borderBottomColor: '#3B82F6' },
  tabText: { color: '#64748B', fontSize: 12 },
  activeTabText: { color: '#3B82F6', fontWeight: 'bold' },
  content: { flex: 1, padding: 15 },
  listHeaderBar: { backgroundColor: '#E2E8F0', padding: 12, borderRadius: 10, marginBottom: 15 },
  listHeaderText: { textAlign: 'right', fontWeight: 'bold', color: '#1E293B', fontSize: 14 },
  searchFilterContainer: { flexDirection: 'row-reverse', marginBottom: 15, alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: '#FFF', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginLeft: 10 },
  filterDropdown: { backgroundColor: '#3B82F6', padding: 10, borderRadius: 10, minWidth: 100, alignItems: 'center' },
  filterText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  dropdownMenu: { backgroundColor: '#FFF', borderRadius: 10, elevation: 5, position: 'absolute', top: 55, right: 15, zIndex: 1000, width: 150, borderWidth: 1, borderColor: '#E2E8F0' },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownItemText: { textAlign: 'right', fontSize: 13, color: '#1E293B' },
  mainAddBtn: { backgroundColor: '#3B82F6', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 15 },
  mainAddBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  dataRow: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  rowActions: { flexDirection: 'row' },
  editText: { color: '#3B82F6', fontWeight: 'bold', marginRight: 15 },
  deleteText: { color: '#EF4444', fontWeight: 'bold' },
  rowInfo: { alignItems: 'flex-end' },
  rowName: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  rowSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  groupContainer: { marginBottom: 20 },
  groupHeader: { fontSize: 14, fontWeight: 'bold', color: '#3B82F6', marginBottom: 10, textAlign: 'right', backgroundColor: '#E2E8F0', padding: 8, borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  inputGroup: { marginBottom: 15 },
  inputLabel: { fontSize: 13, color: '#64748B', textAlign: 'right', marginBottom: 5, fontWeight: '600' },
  input: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10, textAlign: 'right', borderWidth: 1, borderColor: '#E2E8F0' },
  subTitle: { fontSize: 14, fontWeight: 'bold', marginVertical: 10, textAlign: 'right' },
  horizontalSelect: { flexDirection: 'row-reverse', marginBottom: 15 },
  selectItem: { paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#F1F5F9', borderRadius: 20, marginLeft: 10 },
  selectedItem: { backgroundColor: '#3B82F6' },
  selectText: { fontSize: 12, color: '#64748B' },
  selectedText: { color: '#FFF', fontWeight: 'bold' },
  permissionRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 15 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: '#3B82F6', borderRadius: 6, marginLeft: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#3B82F6' },
  checkboxTick: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  permissionLabel: { fontSize: 14, color: '#1E293B' },
  saveBtn: { backgroundColor: '#10B981', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#FFF', fontWeight: 'bold' },
  closeBtn: { padding: 15, alignItems: 'center' },
  closeBtnText: { color: '#64748B', fontWeight: 'bold' }
});
