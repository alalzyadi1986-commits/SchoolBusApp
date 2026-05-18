import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Alert, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { db } from '../firebaseConfig';
import { ref, set, push, onValue, remove, update } from 'firebase/database';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SchoolScreen({ route, navigation }) {
  const { schoolId, user } = route.params || {};
  const schoolName = user?.schoolName || "";
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
  const [managers, setManagers] = useState([]);

  // حقول الإدخال (ثابتة في أعلى الصفحة)
  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('الكل');
  const [selectedDriverReport, setSelectedDriverReport] = useState('الكل');
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const speedOptions = [50, 60, 70, 80, 90, 100, 110, 120];

  const [dynamicSchoolName, setDynamicSchoolName] = useState("");

  useEffect(() => {
    if (!schoolId) return;

    onValue(ref(db, `schools/${schoolId}`), (snap) => {
      const data = snap.val();
      if (data) {
        setDynamicSchoolName(data.name || "");
        setExpiryDate(data.endDate || '');
        const exp = new Date(data.endDate);
        setIsExpired(exp < new Date());
      }
    });

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
    fetchData('managers', setManagers);
    setLoading(false);
  }, [schoolId]);

  const handleAction = async (action, item = null) => {
    if (isExpired && action !== 'delete' && action !== 'view') {
      Alert.alert('تنبيه', 'يرجى تجديد الاشتراك للمتابعة');
      return;
    }

    const path = `schools/${schoolId}/${activeTab}`;
    if (action === 'delete' && item) {
      Alert.alert('حذف', 'هل أنت متأكد من عملية الحذف؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: () => remove(ref(db, `${path}/${item.id}`)) }
      ]);
    } else if (action === 'save') {
      if (!formData.username || !formData.name) {
        Alert.alert('خطأ', 'يرجى تعبئة الحقول الأساسية (الاسم واسم المستخدم)');
        return;
      }
      const data = { ...formData };
      try {
        if (editingId) {
          await update(ref(db, `${path}/${editingId}`), data);
          setEditingId(null);
        } else {
          await set(ref(db, `${path}/${data.username}`), data);
        }
        setFormData({});
        Alert.alert('تم', 'تم حفظ البيانات بنجاح');
      } catch (error) {
        Alert.alert('خطأ', 'حدث خطأ أثناء الحفظ');
      }
    }
  };

  const startEdit = (item) => {
    setFormData(item);
    setEditingId(item.id);
    if (activeTab === 'drivers') setShowDriverForm(true);
  };

  const renderInput = (placeholder, field, isPassword = false, isNumeric = false) => (
    <View style={styles.inputWrapper}>
      <Text style={styles.inputLabel}>{placeholder}:</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={formData[field] || ''}
        onChangeText={(txt) => setFormData({ ...formData, [field]: txt })}
        secureTextEntry={isPassword}
        keyboardType={isNumeric ? 'numeric' : 'default'}
        editable={field === 'username' ? !editingId : true}
      />
    </View>
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
    return reports.filter(r => {
      const driverKey = r.driverId;
      return driverKey === selectedDriverReport;
    });
  }, [reports, selectedDriverReport]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      {/* رأس الصفحة */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}><Text style={styles.logoutText}>خروج</Text></TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.schoolName}>{dynamicSchoolName}</Text>
          <Text style={[styles.expiryText, { color: isExpired ? '#EF4444' : '#10B981' }]}>
            {isExpired ? 'الاشتراك منتهي ❌' : `مشترك لغاية: ${expiryDate ? new Date(expiryDate).toLocaleDateString('ar-EG') : ''} ✅`}
          </Text>
        </View>
      </View>

      {/* التبويبات - شبكة ثابتة */}
      <View style={styles.tabBar}>
        <View style={styles.tabGrid}>
          {[
            { id: 'drivers', label: 'السائقين' },
            { id: 'staff', label: 'المرافقين' },
            { id: 'parents', label: 'الأهل' },
            { id: 'students', label: 'الطلاب' },
            { id: 'reports', label: 'التقارير' },
            { id: 'emergencies', label: 'الطوارئ' },
            { id: 'managers', label: 'الإدارة' }
          ].map(tab => (
            <TouchableOpacity key={tab.id} style={[styles.tabGridItem, activeTab === tab.id && styles.activeTabGrid]} onPress={() => { setActiveTab(tab.id); setFormData({}); setEditingId(null); setShowDriverForm(false); }}>
              <Text style={[styles.tabGridText, activeTab === tab.id && styles.activeTabGridText]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content} scrollEventThrottle={16} removeClippedSubviews={true} maxToRenderPerBatch={10} updateCellsBatchingPeriod={50}>
        {/* زر إضافة سائق للسائقين فقط */}
        {activeTab === 'drivers' && !showDriverForm && (
          <View style={styles.addButtonContainer}>
            <TouchableOpacity style={styles.addDriverBtn} onPress={() => { setShowDriverForm(true); setFormData({}); setEditingId(null); }}>
              <Text style={styles.addDriverBtnText}>+ إضافة سائق جديد</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* نموذج السائقين */}
        {activeTab === 'drivers' && showDriverForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'تعديل بيانات السائق' : 'إضافة سائق جديد'}</Text>
            
            {renderInput('الاسم الكامل', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {renderInput('كلمة المرور', 'password', true)}
            {renderInput('رقم الهاتف', 'phone', false, true)}
            {renderInput('رقم الباص', 'bus_number')}
            
            {/* قائمة السرعة */}
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>السرعة القصوى المسموحة (كم/س):</Text>
              <TouchableOpacity style={styles.speedPickerBtn} onPress={() => setShowSpeedPicker(true)}>
                <Text style={styles.speedPickerText}>{formData.max_speed || 'اختر السرعة'}</Text>
                <Text style={styles.speedPickerArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Modal لاختيار السرعة */}
            {showSpeedPicker && (
              <View style={styles.speedPickerModal}>
                <Text style={styles.speedPickerTitle}>اختر السرعة القصوى:</Text>
                <ScrollView style={styles.speedPickerList}>
                  {speedOptions.map(speed => (
                    <TouchableOpacity 
                      key={speed} 
                      style={[styles.speedOption, formData.max_speed === speed && styles.speedOptionActive]}
                      onPress={() => { setFormData({ ...formData, max_speed: speed }); setShowSpeedPicker(false); }}
                    >
                      <Text style={[styles.speedOptionText, formData.max_speed === speed && styles.speedOptionTextActive]}>{speed} كم/س</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.speedPickerClose} onPress={() => setShowSpeedPicker(false)}>
                  <Text style={styles.speedPickerCloseText}>إغلاق</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.sectionLabel}>صلاحيات السائق:</Text>
            {renderPermission('بدء الرحلة وبث الموقع', 'canStartTrip')}
            {renderPermission('رؤية موقع الطلاب', 'canViewStudents')}

            <TouchableOpacity style={styles.saveBtn} onPress={() => handleAction('save')}>
              <Text style={styles.saveBtnText}>{editingId ? 'تحديث البيانات' : 'حفظ البيانات'}</Text>
            </TouchableOpacity>
            {editingId && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingId(null); setFormData({}); }}>
                <Text style={styles.cancelBtnText}>إلغاء التعديل</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowDriverForm(false); setFormData({}); setEditingId(null); }}>
              <Text style={styles.cancelBtnText}>إغلاق النموذج</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* نماذج باقي الأقسام */}
        {['staff', 'parents', 'students', 'managers'].includes(activeTab) && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'تعديل البيانات' : `إضافة ${activeTab === 'staff' ? 'مرافق جديد' : activeTab === 'parents' ? 'ولي أمر جديد' : activeTab === 'students' ? 'طالب جديد' : 'مدير جديد'}`}</Text>
            
            {renderInput('الاسم الكامل', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {renderInput('كلمة المرور', 'password', true)}
            {activeTab !== 'students' && renderInput('رقم الهاتف', 'phone', false, true)}
            
            {activeTab === 'staff' && (
              <>
                <Text style={styles.sectionLabel}>ربط المرافقة بالسائق:</Text>
                <ScrollView horizontal style={styles.chipScroll}>
                  {drivers.map(d => {
                    const driverKey = d.username || d.id;
                    return (
                      <TouchableOpacity 
                        key={d.id} 
                        style={[styles.miniChip, formData.driver_id === driverKey && styles.miniChipActive]}
                        onPress={() => setFormData({ ...formData, driver_id: driverKey === formData.driver_id ? null : driverKey })}
                      >
                        <Text style={[styles.miniChipText, formData.driver_id === driverKey && styles.miniChipTextActive]}>{d.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <Text style={styles.sectionLabel}>صلاحيات المرافقة:</Text>
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
                <ScrollView horizontal style={styles.chipScroll}>
                  {parents.map(p => (
                    <TouchableOpacity key={p.id} style={[styles.miniChip, formData.parent_username === p.username && styles.miniChipActive]} onPress={() => setFormData({ ...formData, parent_username: p.username === formData.parent_username ? null : p.username })}>
                      <Text style={[styles.miniChipText, formData.parent_username === p.username && styles.miniChipTextActive]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.sectionLabel}>ربط بالسائق والمرافقة:</Text>
                <ScrollView horizontal style={styles.chipScroll}>
                  {drivers.map(d => {
                    const driverKey = d.username || d.id;
                    return (
                      <TouchableOpacity key={d.id} style={[styles.miniChip, formData.driver_id === driverKey && styles.miniChipActive]} onPress={() => setFormData({ ...formData, driver_id: driverKey === formData.driver_id ? null : driverKey })}>
                        <Text style={[styles.miniChipText, formData.driver_id === driverKey && styles.miniChipTextActive]}>سائق: {d.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={() => handleAction('save')}>
              <Text style={styles.saveBtnText}>{editingId ? 'تحديث البيانات' : 'حفظ البيانات'}</Text>
            </TouchableOpacity>
            {editingId && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingId(null); setFormData({}); }}>
                <Text style={styles.cancelBtnText}>إلغاء التعديل والعودة للإضافة</Text>
              </TouchableOpacity>
            )}
        {/* نموذج الإدارة */}
        {activeTab === 'managers' && showManagerForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'تعديل بيانات المدير' : 'إضافة مدير جديد'}</Text>
            
            {renderInput('الاسم الكامل', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {renderInput('كلمة المرور', 'password', true)}
            {renderInput('رقم الهاتف', 'phone', false, true)}

            <TouchableOpacity style={styles.saveBtn} onPress={() => handleAction('save')}>
              <Text style={styles.saveBtnText}>{editingId ? 'تحديث البيانات' : 'حفظ البيانات'}</Text>
            </TouchableOpacity>
            {editingId && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingId(null); setFormData({}); }}>
                <Text style={styles.cancelBtnText}>إلغاء التعديل</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowManagerForm(false); setFormData({}); setEditingId(null); }}>
              <Text style={styles.cancelBtnText}>إغلاق النموذج</Text>
            </TouchableOpacity>
          </View>
        )}

                  </View>
        )}

        {/* قسم البحث والفلترة */}
        {activeTab === 'students' && (
          <View style={styles.filterSection}>
            <TextInput style={styles.searchInput} placeholder="🔍 بحث عن اسم الطالب..." value={searchQuery} onChangeText={setSearchQuery} />
            <Text style={styles.filterLabel}>تصفية حسب الصف والشعبة:</Text>
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
              {activeTab === 'drivers' ? `قائمة السائقين المضافين (${drivers.length})` :
               activeTab === 'staff' ? `قائمة المرافقين المضافين (${staff.length})` :
               activeTab === 'parents' ? `قائمة أولياء الأمور (${parents.length})` :
               activeTab === 'students' ? `قائمة الطلاب (${filteredStudents.length})` :
               activeTab === 'reports' ? 'سجل التقارير والنشاطات' :
               activeTab === 'managers' ? `قائمة المديرين (${managers.length})` : 'بلاغات الطوارئ النشطة'}
            </Text>
          </View>

          {activeTab === 'reports' && (
            <View style={styles.reportFilter}>
              <Text style={styles.filterLabel}>عرض تقارير سائق محدد:</Text>
              <ScrollView horizontal style={styles.chipScroll}>
                <TouchableOpacity style={[styles.miniChip, selectedDriverReport === 'الكل' && styles.miniChipActive]} onPress={() => setSelectedDriverReport('الكل')}>
                  <Text style={[styles.miniChipText, selectedDriverReport === 'الكل' && styles.miniChipTextActive]}>الكل</Text>
                </TouchableOpacity>
                {drivers.map(d => {
                  const driverKey = d.username || d.id;
                  return (
                    <TouchableOpacity 
                      key={d.id} 
                      style={[styles.miniChip, selectedDriverReport === driverKey && styles.miniChipActive]} 
                      onPress={() => setSelectedDriverReport(selectedDriverReport === driverKey ? 'الكل' : driverKey)}
                    >
                      <Text style={[styles.miniChipText, selectedDriverReport === driverKey && styles.miniChipTextActive]}>{d.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {(activeTab === 'reports' ? filteredReports : activeTab === 'students' ? filteredStudents : 
            activeTab === 'drivers' ? drivers : activeTab === 'staff' ? staff : 
            activeTab === 'parents' ? parents : activeTab === 'managers' ? managers : emergencies).map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardInfo}>
                {activeTab === 'drivers' ? (
                  <>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardSub}>رقم الباص: {item.bus_number} | السرعة القصوى: {item.max_speed || 80} كم/س</Text>
                  </>
                ) : activeTab === 'reports' ? (
                  <>
                    <Text style={[styles.cardName, {color: item.type === 'speed' ? '#EF4444' : '#3B82F6'}]}>
                      {item.type === 'speed' ? '⚠️ تنبيه سرعة' : '📝 تحضير طالب'}
                    </Text>
                    <Text style={styles.cardSub}>{item.message}</Text>
                    <Text style={styles.cardDate}>{new Date(item.timestamp).toLocaleString('ar-EG')}</Text>
                  </>
                ) : activeTab === 'emergencies' ? (
                  <>
                    <Text style={styles.emergencyTitle}>🆘 حالة طوارئ: {item.senderName}</Text>
                    <Text style={styles.cardSub}>{item.message}</Text>
                    <Text style={styles.cardDate}>{new Date(item.timestamp).toLocaleString('ar-EG')}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardSub}>
                      {activeTab === 'students' ? `الصف: ${item.class} - شعبة: ${item.section}` : `الهاتف: ${item.phone}`}
                    </Text>
                  </>
                )}
              </View>
              
              {['drivers', 'staff', 'parents', 'students', 'managers'].includes(activeTab) && (
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(item)}>
                    <Text style={styles.editBtnText}>تعديل</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleAction('delete', item)}>
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
  tabBar: { backgroundColor: '#FFF', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', paddingHorizontal: 10, justifyContent: 'space-around' },
  tabGridItem: { width: '23%', paddingVertical: 10, paddingHorizontal: 5, borderRadius: 10, marginVertical: 4, backgroundColor: '#F8FAFC', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  activeTabGrid: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  tabGridText: { color: '#64748B', fontWeight: 'bold', fontSize: 11, textAlign: 'center' },
  activeTabGridText: { color: '#FFF' },
  content: { flex: 1 },
  addButtonContainer: { padding: 15 },
  addDriverBtn: { backgroundColor: '#3B82F6', padding: 15, borderRadius: 10, alignItems: 'center' },
  addDriverBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  formCard: { backgroundColor: '#FFF', margin: 15, padding: 15, borderRadius: 15, elevation: 3 },
  formTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, textAlign: 'right', color: '#3B82F6' },
  inputWrapper: { marginBottom: 12 },
  inputLabel: { fontSize: 13, color: '#64748B', textAlign: 'right', marginBottom: 5, fontWeight: 'bold' },
  input: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, textAlign: 'right', borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B' },
  speedPickerBtn: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  speedPickerText: { color: '#1E293B', fontSize: 14, fontWeight: '500' },
  speedPickerArrow: { color: '#64748B', fontSize: 12 },
  speedPickerModal: { backgroundColor: '#FFF', borderRadius: 12, padding: 15, marginVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  speedPickerTitle: { fontSize: 14, fontWeight: 'bold', color: '#1E293B', marginBottom: 10, textAlign: 'center' },
  speedPickerList: { maxHeight: 200, marginBottom: 10 },
  speedOption: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, backgroundColor: '#F8FAFC', marginVertical: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  speedOptionActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  speedOptionText: { color: '#64748B', fontSize: 14, textAlign: 'center' },
  speedOptionTextActive: { color: '#FFF', fontWeight: 'bold' },
  speedPickerClose: { backgroundColor: '#EF4444', padding: 10, borderRadius: 8, alignItems: 'center' },
  speedPickerCloseText: { color: '#FFF', fontWeight: 'bold' },
  row: { flexDirection: 'row-reverse' },
  saveBtn: { backgroundColor: '#3B82F6', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 15 },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { padding: 10, alignItems: 'center', marginTop: 5 },
  cancelBtnText: { color: '#64748B', textDecorationLine: 'underline' },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginTop: 15, marginBottom: 10, textAlign: 'right' },
  checkboxContainer: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#3B82F6', marginLeft: 12 },
  checkboxChecked: { backgroundColor: '#3B82F6' },
  checkboxLabel: { fontSize: 14, color: '#1E293B' },
  chipScroll: { marginBottom: 10, flexDirection: 'row-reverse' },
  miniChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F1F5F9', marginLeft: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  miniChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  miniChipText: { fontSize: 12, color: '#64748B' },
  miniChipTextActive: { color: '#FFF', fontWeight: 'bold' },
  filterSection: { paddingHorizontal: 15, marginBottom: 10, marginTop: 5 },
  searchInput: { backgroundColor: '#FFF', padding: 12, borderRadius: 10, textAlign: 'right', elevation: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  filterLabel: { fontSize: 12, color: '#64748B', textAlign: 'right', marginTop: 10, marginBottom: 5 },
  classFilter: { marginTop: 5 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15, backgroundColor: '#FFF', marginLeft: 8, elevation: 1, borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#3B82F6' },
  filterChipText: { fontSize: 12, color: '#64748B' },
  filterChipTextActive: { color: '#FFF', fontWeight: 'bold' },
  listContainer: { padding: 15 },
  listHeader: { marginBottom: 15, borderRightWidth: 4, borderRightColor: '#3B82F6', paddingRight: 10 },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', textAlign: 'right' },
  card: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 12, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  cardInfo: { flex: 1, alignItems: 'flex-end' },
  cardName: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  cardSub: { fontSize: 12, color: '#64748B', marginTop: 4 },
  cardDate: { fontSize: 10, color: '#94A3B8', marginTop: 6 },
  emergencyTitle: { fontSize: 15, fontWeight: 'bold', color: '#EF4444' },
  cardActions: { flexDirection: 'row-reverse', alignItems: 'center' },
  editBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, backgroundColor: '#DBEAFE', marginLeft: 20 },
  editBtnText: { color: '#3B82F6', fontWeight: 'bold', fontSize: 13 },
  deleteBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, backgroundColor: '#FEE2E2' },
  deleteBtnText: { color: '#EF4444', fontWeight: 'bold', fontSize: 13 },
  reportFilter: { marginBottom: 15, padding: 12, backgroundColor: '#FFF', borderRadius: 12, elevation: 2 }
});
