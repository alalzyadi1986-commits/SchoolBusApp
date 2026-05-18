import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, 
  Alert, ActivityIndicator, ScrollView, StatusBar, Modal, Dimensions, Linking
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
  const [emergencies, setEmergencies] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedReportDriver, setSelectedReportDriver] = useState('الكل');

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
  const [maxSpeed, setMaxSpeed] = useState('80');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [studentSection, setStudentSection] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [selectedDriverForStudent, setSelectedDriverForStudent] = useState('');
  const [selectedStaffForStudent, setSelectedStaffForStudent] = useState('');
  
  const [permissions, setPermissions] = useState({
    viewLocation: true, markAttendance: true, contactParents: false, 
    editStudents: false, addStudentsAndLocation: false, canStartTrip: true
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

          if (data.emergencies) {
            const list = Object.keys(data.emergencies)
              .map(key => ({ id: key, ...data.emergencies[key] }))
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setEmergencies(list);
          } else setEmergencies([]);

          if (data.reports) {
            const list = Object.keys(data.reports)
              .map(key => ({ id: key, ...data.reports[key] }))
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setReports(list);
          } else setReports([]);
        }
      });
      return () => unsubscribe();
    }
  }, [schoolId]);

  const checkAccess = () => {
    if (isReadOnly) { Alert.alert('اشتراك منتهي', 'يرجى تجديد الاشتراك للمتابعة.'); return false; }
    return true;
  };

  const resetForm = () => {
    setEditingId(null); setUsername(''); setPassword(''); setName(''); setPhone('');
    setBusNumber(''); setMaxSpeed('80'); setSelectedDriverId(''); setStudentClass(''); setStudentSection('');
    setSelectedParentId(''); setSelectedDriverForStudent(''); setSelectedStaffForStudent('');
    setPermissions({ viewLocation: true, markAttendance: true, contactParents: false, editStudents: false, addStudentsAndLocation: false, canStartTrip: true });
  };

  const openModal = (type, item = null) => {
    if (!checkAccess()) return;
    setModalType(type); resetForm();
    if (item) {
      setEditingId(item.username || item.id); setUsername(item.username || ''); setName(item.name || item.family_name || '');
      setPassword(item.password || ''); setPhone(item.phone || '');
      if (type === 'driver') { setBusNumber(item.bus_number || ''); setMaxSpeed(item.max_speed || '80'); if (item.permissions) setPermissions(item.permissions); }
      if (type === 'staff') { setSelectedDriverId(item.driver_id || ''); if (item.permissions) setPermissions(item.permissions); }
      if (type === 'student') { setStudentClass(item.class || ''); setStudentSection(item.section || ''); setSelectedParentId(item.parent_username || ''); setSelectedDriverForStudent(item.driver_id || ''); setSelectedStaffForStudent(item.staff_id || ''); }
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name || (modalType !== 'student' && (!username || !password))) { Alert.alert('خطأ', 'يرجى تعبئة الحقول الأساسية'); return; }
    try {
      setLoading(true);
      let data = { name, password, phone, role: modalType };
      if (editingId && modalType !== 'student' && editingId !== username) await remove(ref(db, `schools/${schoolId}/${modalType}s/${editingId}`));
      if (modalType === 'driver') { data.bus_number = busNumber; data.max_speed = maxSpeed; data.permissions = permissions; }
      if (modalType === 'staff') { data.driver_id = selectedDriverId; data.permissions = permissions; }
      if (modalType === 'parent') data.family_name = name;
      if (modalType === 'student') {
        const studentData = { name, class: studentClass, section: studentSection, parent_username: selectedParentId, driver_id: selectedDriverForStudent, staff_id: selectedStaffForStudent };
        if (editingId) await update(ref(db, `schools/${schoolId}/students/${editingId}`), studentData);
        else await push(ref(db, `schools/${schoolId}/students`), studentData);
      } else await set(ref(db, `schools/${schoolId}/${modalType}s/${username.trim()}`), data);
      Alert.alert('نجاح', 'تم حفظ البيانات بنجاح'); setShowModal(false);
    } catch (e) { Alert.alert('خطأ', 'فشلت العملية'); } finally { setLoading(false); }
  };

  const handleDelete = (path, type) => {
    if (!checkAccess()) return;
    Alert.alert('تأكيد الحذف', `هل أنت متأكد من حذف ${type}؟`, [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: async () => { await remove(ref(db, `schools/${schoolId}/${path}`)); } }]);
  };

  const resolveEmergency = async (id) => {
    await update(ref(db, `schools/${schoolId}/emergencies/${id}`), { status: 'resolved', resolvedAt: new Date().toISOString() });
  };

  const filteredStudents = useMemo(() => studentsList.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) && (selectedFilterClass === 'الكل' || `${s.class} - ${s.section}` === selectedFilterClass)), [studentsList, searchQuery, selectedFilterClass]);
  const groupedStudents = filteredStudents.reduce((acc, s) => { const k = `${s.class || 'بدون صف'} - ${s.section || 'بدون شعبة'}`; if (!acc[k]) acc[k] = []; acc[k].push(s); return acc; }, {});

  const filteredReports = useMemo(() => {
    return reports.filter(r => selectedReportDriver === 'الكل' || r.message.includes(selectedReportDriver));
  }, [reports, selectedReportDriver]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}><Text style={styles.logoutText}>خروج</Text></TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.headerTitle}>لوحة تحكم المدرسة</Text>
          <Text style={[styles.subscriptionInfo, isReadOnly && { color: '#e74c3c' }]}>
            {isReadOnly ? 'الاشتراك منتهي ❌' : `مشترك لغاية: ${schoolData ? new Date(schoolData.endDate).toLocaleDateString('ar-EG') : ''} ✅`}
          </Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {['drivers', 'staff', 'parents', 'students', 'emergencies', 'reports'].map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tabItem, activeTab === tab && styles.activeTabItem]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'drivers' ? 'سائقين' : tab === 'staff' ? 'مرافقين' : tab === 'parents' ? 'أهل' : tab === 'students' ? 'طلاب' : tab === 'emergencies' ? 'طوارئ' : 'تقارير'}
            </Text>
            {tab === 'emergencies' && emergencies.filter(e => e.status === 'active').length > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {activeTab === 'emergencies' ? (
          <FlatList
            data={emergencies}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={[styles.emergencyCard, item.status === 'active' && styles.emergencyCardActive]}>
                <View style={styles.emergencyHeader}>
                  <Text style={styles.emergencyTime}>{new Date(item.timestamp).toLocaleTimeString('ar-EG')}</Text>
                  <Text style={styles.emergencySender}>{item.senderName} ({item.role === 'driver' ? 'سائق' : 'مرافقة'})</Text>
                </View>
                <Text style={styles.emergencyMsg}>{item.message}</Text>
                <View style={styles.emergencyActions}>
                  {item.status === 'active' ? (
                    <TouchableOpacity style={styles.resolveBtn} onPress={() => resolveEmergency(item.id)}><Text style={styles.resolveBtnText}>تمت المعالجة</Text></TouchableOpacity>
                  ) : <Text style={styles.resolvedText}>تمت المعالجة في {new Date(item.resolvedAt).toLocaleTimeString('ar-EG')}</Text>}
                  <TouchableOpacity style={styles.mapBtn} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`)}><Text style={styles.mapBtnText}>📍 الموقع</Text></TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>لا توجد بلاغات طوارئ حالياً</Text>}
          />
        ) : activeTab === 'reports' ? (
          <>
            <View style={styles.reportFilterBar}>
              <Text style={styles.reportFilterLabel}>فلترة حسب السائق:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['الكل', ...driversList.map(d => d.name)].map(name => (
                  <TouchableOpacity 
                    key={name} 
                    style={[styles.reportFilterBtn, selectedReportDriver === name && styles.reportFilterBtnActive]}
                    onPress={() => setSelectedReportDriver(name)}
                  >
                    <Text style={[styles.reportFilterBtnText, selectedReportDriver === name && styles.reportFilterBtnTextActive]}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <FlatList
              data={filteredReports}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportDate}>{new Date(item.timestamp).toLocaleString('ar-EG')}</Text>
                    <Text style={styles.reportType}>
                      {item.type === 'attendance' ? 'سجل حضور' : item.type === 'absence' ? 'بلاغ غياب' : item.type === 'speed' ? 'تجاوز سرعة' : 'طوارئ'}
                    </Text>
                  </View>
                  <Text style={styles.reportContent}>{item.message}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>لا توجد تقارير حالياً</Text>}
            />
          </>
        ) : (
          <>
            {activeTab === 'drivers' && <View style={styles.listHeaderBar}><Text style={styles.listHeaderText}>قائمة أسماء السائقين ({driversList.length})</Text></View>}
            {activeTab === 'students' && (
              <View style={styles.searchFilterContainer}>
                <TextInput style={styles.searchInput} placeholder="ابحث عن اسم الطالب..." value={searchQuery} onChangeText={setSearchQuery} textAlign="right" />
                <TouchableOpacity style={styles.filterDropdown} onPress={() => setShowFilterDropdown(!showFilterDropdown)}><Text style={styles.filterText}>{selectedFilterClass} ▼</Text></TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.mainAddBtn} onPress={() => openModal(activeTab.slice(0, -1))}><Text style={styles.mainAddBtnText}>➕ إضافة {activeTab === 'drivers' ? 'سائق' : activeTab === 'staff' ? 'مرافق' : activeTab === 'parents' ? 'حساب عائلة' : 'طالب'}</Text></TouchableOpacity>
            <FlatList
              data={activeTab === 'drivers' ? driversList : activeTab === 'staff' ? staffList : activeTab === 'parents' ? parentsList : []}
              keyExtractor={item => item.username}
              renderItem={({ item }) => (
                <View style={styles.dataRow}>
                  <View style={styles.rowActions}>
                    <TouchableOpacity onPress={() => openModal(activeTab.slice(0, -1), item)}><Text style={styles.editText}>تعديل</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(`${activeTab}/${item.username}`, activeTab)}><Text style={styles.deleteText}>حذف</Text></TouchableOpacity>
                  </View>
                  <View style={styles.rowInfo}><Text style={styles.rowName}>{item.name || item.family_name}</Text><Text style={styles.rowSub}>{item.username} {item.bus_number ? `| باص: ${item.bus_number}` : ''} {item.max_speed ? `| السرعة: ${item.max_speed}` : ''}</Text></View>
                </View>
              )}
              ListHeaderComponent={activeTab === 'students' ? (
                <View>
                  {Object.keys(groupedStudents).map(group => (
                    <View key={group} style={styles.groupContainer}>
                      <Text style={styles.groupHeader}>{group}</Text>
                      {groupedStudents[group].map(student => (
                        <View key={student.id} style={styles.dataRow}>
                          <View style={styles.rowActions}><TouchableOpacity onPress={() => openModal('student', student)}><Text style={styles.editText}>تعديل</Text></TouchableOpacity><TouchableOpacity onPress={() => handleDelete(`students/${student.id}`, 'الطالب')}><Text style={styles.deleteText}>حذف</Text></TouchableOpacity></View>
                          <View style={styles.rowInfo}><Text style={styles.rowName}>{student.name}</Text><Text style={styles.rowSub}>ولي الأمر: {student.parent_username}</Text></View>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}
            />
          </>
        )}
      </View>

      <Modal visible={showModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'تعديل' : 'إضافة'} {modalType === 'driver' ? 'سائق' : modalType === 'staff' ? 'مرافق' : modalType === 'parent' ? 'حساب عائلة' : 'طالب'}</Text>
            <ScrollView style={{maxHeight: 400}}>
              <TextInput style={styles.modalInput} placeholder="الاسم الكامل" value={name} onChangeText={setName} />
              {modalType !== 'student' && (
                <>
                  <TextInput style={[styles.modalInput, editingId && {backgroundColor: '#f1f5f9'}]} placeholder="اسم المستخدم" value={username} onChangeText={setUsername} editable={!editingId} />
                  <TextInput style={styles.modalInput} placeholder="كلمة المرور" value={password} onChangeText={setPassword} />
                </>
              )}
              <TextInput style={styles.modalInput} placeholder="رقم الهاتف" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              
              {modalType === 'driver' && (
                <>
                  <TextInput style={styles.modalInput} placeholder="رقم الباص" value={busNumber} onChangeText={setBusNumber} />
                  <TextInput style={styles.modalInput} placeholder="السرعة القصوى (كم/س)" value={maxSpeed} onChangeText={setMaxSpeed} keyboardType="numeric" />
                </>
              )}

              {modalType === 'staff' && (
                <View style={styles.selectorContainer}>
                  <Text style={styles.selectorLabel}>ربط مع السائق:</Text>
                  <ScrollView horizontal>
                    {driversList.map(d => (
                      <TouchableOpacity key={d.username} style={[styles.selectorBtn, selectedDriverId === d.username && styles.selectorBtnActive]} onPress={() => setSelectedDriverId(d.username)}>
                        <Text style={[styles.selectorBtnText, selectedDriverId === d.username && styles.selectorBtnTextActive]}>{d.name}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={[styles.selectorBtn, !selectedDriverId && styles.selectorBtnActive]} onPress={() => setSelectedDriverId('')}><Text style={[styles.selectorBtnText, !selectedDriverId && styles.selectorBtnTextActive]}>بدون ربط</Text></TouchableOpacity>
                  </ScrollView>
                </View>
              )}

              {modalType === 'student' && (
                <>
                  <TextInput style={styles.modalInput} placeholder="الصف (مثلاً: الأول)" value={studentClass} onChangeText={setStudentClass} />
                  <TextInput style={styles.modalInput} placeholder="الشعبة (مثلاً: أ)" value={studentSection} onChangeText={setStudentSection} />
                  <Text style={styles.selectorLabel}>ربط مع ولي الأمر:</Text>
                  <ScrollView horizontal>
                    {parentsList.map(p => (
                      <TouchableOpacity key={p.username} style={[styles.selectorBtn, selectedParentId === p.username && styles.selectorBtnActive]} onPress={() => setSelectedParentId(p.username)}>
                        <Text style={[styles.selectorBtnText, selectedParentId === p.username && styles.selectorBtnTextActive]}>{p.family_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSave} disabled={loading}>{loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>حفظ</Text>}</TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setShowModal(false)}><Text style={styles.cancelBtnText}>إلغاء</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  subscriptionInfo: { fontSize: 12, color: '#10B981', marginTop: 4, fontWeight: 'bold' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  tabBar: { flexDirection: 'row-reverse', backgroundColor: '#FFF', paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabItem: { paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', flex: 1 },
  activeTabItem: { borderBottomWidth: 3, borderBottomColor: '#3B82F6' },
  tabText: { fontSize: 12, color: '#64748B', fontWeight: 'bold' },
  activeTabText: { color: '#3B82F6' },
  badge: { position: 'absolute', top: 10, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  content: { flex: 1, padding: 10 },
  listHeaderBar: { backgroundColor: '#E2E8F0', padding: 8, borderRadius: 8, marginBottom: 10 },
  listHeaderText: { textAlign: 'right', fontSize: 13, fontWeight: 'bold', color: '#475569' },
  searchFilterContainer: { flexDirection: 'row-reverse', marginBottom: 10, alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: '#FFF', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginLeft: 10 },
  filterDropdown: { backgroundColor: '#3B82F6', padding: 10, borderRadius: 10 },
  filterText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  mainAddBtn: { backgroundColor: '#3B82F6', padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 15 },
  mainAddBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  dataRow: { flexDirection: 'row-reverse', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 8, elevation: 1, justifyContent: 'space-between', alignItems: 'center' },
  rowInfo: { alignItems: 'flex-end', flex: 1 },
  rowName: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  rowSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  rowActions: { flexDirection: 'row' },
  editText: { color: '#3B82F6', fontWeight: 'bold', marginLeft: 15, fontSize: 13 },
  deleteText: { color: '#EF4444', fontWeight: 'bold', fontSize: 13 },
  groupContainer: { marginBottom: 15 },
  groupHeader: { textAlign: 'right', fontSize: 14, fontWeight: 'bold', color: '#3B82F6', marginBottom: 8, paddingRight: 5 },
  emergencyCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 15, marginBottom: 10, borderLeftWidth: 5, borderLeftColor: '#E2E8F0' },
  emergencyCardActive: { borderLeftColor: '#EF4444', backgroundColor: '#FFF5F5' },
  emergencyHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  emergencyTime: { fontSize: 11, color: '#64748B' },
  emergencySender: { fontSize: 13, fontWeight: 'bold', color: '#EF4444' },
  emergencyMsg: { fontSize: 14, color: '#1E293B', textAlign: 'right', marginBottom: 12 },
  emergencyActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  resolveBtn: { backgroundColor: '#10B981', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  resolveBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  mapBtn: { backgroundColor: '#3B82F6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  mapBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  resolvedText: { fontSize: 11, color: '#10B981', fontWeight: 'bold' },
  reportCard: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 8 },
  reportHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 8, paddingBottom: 5 },
  reportDate: { fontSize: 11, color: '#64748B' },
  reportType: { fontSize: 11, fontWeight: 'bold', color: '#3B82F6' },
  reportContent: { fontSize: 14, color: '#1E293B', textAlign: 'right' },
  reportFilterBar: { padding: 10, backgroundColor: '#F1F5F9', marginBottom: 10, borderRadius: 10 },
  reportFilterLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748B', marginBottom: 5, textAlign: 'right' },
  reportFilterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#FFF', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  reportFilterBtnActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  reportFilterBtnText: { fontSize: 12, color: '#64748B' },
  reportFilterBtnTextActive: { color: '#FFF', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: '#FFF', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', textAlign: 'center', marginBottom: 20 },
  modalInput: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12, textAlign: 'right' },
  selectorContainer: { marginBottom: 15 },
  selectorLabel: { fontSize: 13, fontWeight: 'bold', color: '#475569', textAlign: 'right', marginBottom: 8 },
  selectorBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F5F9', marginRight: 8 },
  selectorBtnActive: { backgroundColor: '#3B82F6' },
  selectorBtnText: { fontSize: 12, color: '#64748B' },
  selectorBtnTextActive: { color: '#FFF', fontWeight: 'bold' },
  modalActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 20 },
  modalBtn: { flex: 0.48, padding: 12, borderRadius: 10, alignItems: 'center' },
  saveBtn: { backgroundColor: '#3B82F6' },
  saveBtnText: { color: '#FFF', fontWeight: 'bold' },
  cancelBtn: { backgroundColor: '#F1F5F9' },
  cancelBtnText: { color: '#64748B', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#64748B', marginTop: 50 }
});
