import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, set, push, get, remove } from 'firebase/database';
import { db } from '../firebaseConfig';

export default function SchoolScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { schoolId } = route.params || {};

  // التبويب الحالي (drivers, staff, parents, students)
  const [activeTab, setActiveTab] = useState('drivers');
  const [loading, setLoading] = useState(false);

  // قوائم البيانات المعروضة
  const [driversList, setDriversList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [parentsList, setParentsList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);

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
      fetchData();
    }
  }, [schoolId]);

  // جلب كافة البيانات من Firebase
  const fetchData = async () => {
    setLoading(true);
    try {
      const schoolRef = ref(db, `schools/${schoolId}`);
      const snapshot = await get(schoolRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // تحويل الكائنات إلى مصفوفات للعرض في القوائم
        if (data.drivers) {
          setDriversList(Object.keys(data.drivers).map(key => ({ username: key, ...data.drivers[key] })));
        } else { setDriversList([]); }

        if (data.staff) {
          setStaffList(Object.keys(data.staff).map(key => ({ username: key, ...data.staff[key] })));
        } else { setStaffList([]); }

        if (data.parents) {
          setParentsList(Object.keys(data.parents).map(key => ({ username: key, ...data.parents[key] })));
        } else { setParentsList([]); }

        if (data.students) {
          setStudentsList(Object.keys(data.students).map(key => ({ id: key, ...data.students[key] })));
        } else { setStudentsList([]); }
      }
    } catch (error) {
      console.error("خطأ في جلب البيانات:", error);
    } finally {
      setLoading(false);
    }
  };

  // 1. إضافة سائق
  const handleAddDriver = async () => {
    if (!driverUser || !driverName || !driverPass || !driverPhone || !busNumber) {
      Alert.alert('خطأ', 'الرجاء تعبئة جميع حقول السائق');
      return;
    }
    const cleanUser = driverUser.trim();
    try {
      await set(ref(db, `schools/${schoolId}/drivers/${cleanUser}`), {
        name: driverName,
        password: driverPass,
        phone: driverPhone,
        bus_number: busNumber,
        role: 'driver'
      });
      Alert.alert('نجاح', 'تم إضافة السائق بنجاح');
      setDriverUser(''); setDriverName(''); setDriverPass(''); setDriverPhone(''); setBusNumber('');
      fetchData();
    } catch (error) {
      Alert.alert('خطأ', 'فشلت عملية الحفظ');
    }
  };

  // 2. إضافة مرافق/مرافقة
  const handleAddStaff = async () => {
    if (!staffUser || !staffName || !staffPass || !staffPhone) {
      Alert.alert('خطأ', 'الرجاء تعبئة جميع حقول المرافقة');
      return;
    }
    const cleanUser = staffUser.trim();
    try {
      await set(ref(db, `schools/${schoolId}/staff/${cleanUser}`), {
        name: staffName,
        password: staffPass,
        phone: staffPhone,
        role: 'staff'
      });
      Alert.alert('نجاح', 'تم إضافة المرافقة بنجاح');
      setStaffUser(''); setStaffName(''); setStaffPass(''); setStaffPhone('');
      fetchData();
    } catch (error) {
      Alert.alert('خطأ', 'فشلت عملية الحفظ');
    }
  };

  // 3. إضافة عائلة (الأهل)
  const handleAddParent = async () => {
    if (!parentUser || !familyName || !parentPass || !parentPhone) {
      Alert.alert('خطأ', 'الرجاء تعبئة جميع حقول الأهل');
      return;
    }
    const cleanUser = parentUser.trim();
    try {
      await set(ref(db, `schools/${schoolId}/parents/${cleanUser}`), {
        family_name: familyName,
        password: parentPass,
        phone: parentPhone,
        role: 'parent'
      });
      Alert.alert('نجاح', 'تم توليد حساب العائلة بنجاح');
      setParentUser(''); setFamilyName(''); setParentPass(''); setParentPhone('');
      fetchData();
    } catch (error) {
      Alert.alert('خطأ', 'فشلت عملية الحفظ');
    }
  };

  // 4. إضافة طالب وربطه بولي أمره وباصه
  const handleAddStudent = async () => {
    if (!studentName || !studentClass || !selectedParent || !selectedDriver) {
      Alert.alert('خطأ', 'الرجاء تحديد اسم الطالب، الصف، حساب الأهل، وتعيين السائق');
      return;
    }
    try {
      const studentsRef = ref(db, `schools/${schoolId}/students`);
      const newStudentRef = push(studentsRef);
      await set(newStudentRef, {
        name: studentName,
        class: studentClass,
        parent_username: selectedParent,
        driver_id: selectedDriver
      });
      Alert.alert('نجاح', 'تم تسجيل الطالب وربطه بالنظام');
      setStudentName(''); setStudentClass(''); setSelectedParent(''); setSelectedDriver('');
      fetchData();
    } catch (error) {
      Alert.alert('خطأ', 'فشلت عملية الحفظ');
    }
  };

  // دالة الحذف الآمنة بعد التأكيد
  const handleDeleteItem = (path, itemType) => {
    Alert.alert(
      'تأكيد الحذف',
      `هل أنت متأكد من حذف هذا ${itemType} نهائياً؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { 
          text: 'نعم، احذف', 
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(ref(db, `schools/${schoolId}/${path}`));
              Alert.alert('نجاح', 'تم الحذف بنجاح');
              fetchData();
            } catch (e) {
              Alert.alert('خطأ', 'لم يتم الحذف');
            }
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      {/* الهيدر العلوي */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة تحكم المدرسة</Text>
      </View>

      {/* أزرار التبويبات الأربعة لعزل المهام تماماً */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'students' && styles.activeTabItem]} onPress={() => setActiveTab('students')}>
          <Text style={[styles.tabText, activeTab === 'students' && styles.activeTabText]}>الطلاب</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'parents' && styles.activeTabItem]} onPress={() => setActiveTab('parents')}>
          <Text style={[styles.tabText, activeTab === 'parents' && styles.activeTabText]}>الأهل</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'staff' && styles.activeTabItem]} onPress={() => setActiveTab('staff')}>
          <Text style={[styles.tabText, activeTab === 'staff' && styles.activeTabText]}>المرافقين</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'drivers' && styles.activeTabItem]} onPress={() => setActiveTab('drivers')}>
          <Text style={[styles.tabText, activeTab === 'drivers' && styles.activeTabText]}>السائقين</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#e67e22" style={{ flex: 1 }} />
      ) : (
        <ScrollView style={styles.contentScroll} keyboardShouldPersistTaps="handled">
          
          {/* 1. واجهة قسم السائقين */}
          {activeTab === 'drivers' && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>إضافة سائق جديد وحافلة</Text>
              <TextInput style={styles.input} placeholder="اسم مستخدم فريد (بالإنجليزي)" value={driverUser} onChangeText={setDriverUser} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="اسم السائق الثلاثي" value={driverName} onChangeText={setDriverName} />
              <TextInput style={styles.input} placeholder="كلمة المرور للسائق" value={driverPass} onChangeText={setDriverPass} secureTextEntry />
              <TextInput style={styles.input} placeholder="رقم الهاتف" value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" />
              <TextInput style={styles.input} placeholder="رقم أو لوحة الباص" value={busNumber} onChangeText={setBusNumber} />
              
              <TouchableOpacity style={styles.addBtn} onPress={handleAddDriver}>
                <Text style={styles.addBtnText}>➕ حفظ السائق والباص</Text>
              </TouchableOpacity>

              <Text style={styles.listTitle}>🚚 قائمة السائقين الحاليين</Text>
              {driversList.map((item) => (
                <View key={item.username} style={styles.dataRow}>
                  <TouchableOpacity style={styles.deleteRowBtn} onPress={() => handleDeleteItem(`drivers/${item.username}`, 'السائق')}>
                    <Text style={styles.deleteRowText}>حذف</Text>
                  </TouchableOpacity>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{item.name} ({item.bus_number})</Text>
                    <Text style={styles.rowSub}>المستخدم: {item.username} | هاتف: {item.phone}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 2. واجهة قسم المرافقين */}
          {activeTab === 'staff' && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>إضافة مرافقة جديدة</Text>
              <TextInput style={styles.input} placeholder="اسم مستخدم فريد (بالإنجليزي)" value={staffUser} onChangeText={setStaffUser} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="اسم المرافقة الكامل" value={staffName} onChangeText={setStaffName} />
              <TextInput style={styles.input} placeholder="كلمة المرور للمرافقة" value={staffPass} onChangeText={setStaffPass} secureTextEntry />
              <TextInput style={styles.input} placeholder="رقم الهاتف" value={staffPhone} onChangeText={setStaffPhone} keyboardType="phone-pad" />
              
              <TouchableOpacity style={styles.addBtn} onPress={handleAddStaff}>
                <Text style={styles.addBtnText}>➕ حفظ بيانات المرافقة</Text>
              </TouchableOpacity>

              <Text style={styles.listTitle}>👩‍🏫 قائمة المرافقين الحاليين</Text>
              {staffList.map((item) => (
                <View key={item.username} style={styles.dataRow}>
                  <TouchableOpacity style={styles.deleteRowBtn} onPress={() => handleDeleteItem(`staff/${item.username}`, 'المرافق')}>
                    <Text style={styles.deleteRowText}>حذف</Text>
                  </TouchableOpacity>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowSub}>المستخدم: {item.username} | هاتف: {item.phone}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 3. واجهة قسم الأهل */}
          {activeTab === 'parents' && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>توليد حساب العائلة (الأهل)</Text>
              <TextInput style={styles.input} placeholder="اسم مستخدم العائلة الموحد (مثال: parent_khaled)" value={parentUser} onChangeText={setParentUser} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="اسم العائلة / ولي الأمر" value={familyName} onChangeText={setFamilyName} />
              <TextInput style={styles.input} placeholder="كلمة السر المشتركة (للأب والأم)" value={parentPass} onChangeText={setParentPass} secureTextEntry />
              <TextInput style={styles.input} placeholder="رقم هاتف للتواصل" value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" />
              
              <TouchableOpacity style={styles.addBtn} onPress={handleAddParent}>
                <Text style={styles.addBtnText}>➕ إنشاء حساب العائلة</Text>
              </TouchableOpacity>

              <Text style={styles.listTitle}>👪 حسابات الأهل المسجلة</Text>
              {parentsList.map((item) => (
                <View key={item.username} style={styles.dataRow}>
                  <TouchableOpacity style={styles.deleteRowBtn} onPress={() => handleDeleteItem(`parents/${item.username}`, 'الحساب')}>
                    <Text style={styles.deleteRowText}>حذف</Text>
                  </TouchableOpacity>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{item.family_name}</Text>
                    <Text style={styles.rowSub}>حساب الدخول: {item.username} | كلمة السر: {item.password}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 4. واجهة قسم الطلاب والربط الذكي */}
          {activeTab === 'students' && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>تسجيل طالب جديد وربطه بالنظام</Text>
              <TextInput style={styles.input} placeholder="اسم الطالب الكامل" value={studentName} onChangeText={setStudentName} />
              <TextInput style={styles.input} placeholder="الصف / المرحلة الدراسية" value={studentClass} onChangeText={setStudentClass} />
              
              <Text style={styles.dropdownLabel}>اختر حساب الأهل المرتبط بالطالب:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
                {parentsList.map(p => (
                  <TouchableOpacity key={p.username} style={[styles.selectorChip, selectedParent === p.username && styles.selectorChipActive]} onPress={() => setSelectedParent(p.username)}>
                    <Text style={[styles.chipText, selectedParent === p.username && styles.chipTextActive]}>{p.family_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.dropdownLabel}>تعيين حافلة الطالب (السائق والمسار):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
                {driversList.map(d => (
                  <TouchableOpacity key={d.username} style={[styles.selectorChip, selectedDriver === d.username && styles.selectorChipActive]} onPress={() => setSelectedDriver(d.username)}>
                    <Text style={[styles.chipText, selectedDriver === d.username && styles.chipTextActive]}>{d.name} ({d.bus_number})</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.addBtn} onPress={handleAddStudent}>
                <Text style={styles.addBtnText}>➕ تسجيل وتسكين الطالب</Text>
              </TouchableOpacity>

              <Text style={styles.listTitle}>🎒 قائمة الطلاب المسجلين بالمدرسة</Text>
              {studentsList.map((item) => (
                <View key={item.id} style={styles.dataRow}>
                  <TouchableOpacity style={styles.deleteRowBtn} onPress={() => handleDeleteItem(`students/${item.id}`, 'الطالب')}>
                    <Text style={styles.deleteRowText}>حذف</Text>
                  </TouchableOpacity>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{item.name} - {item.class}</Text>
                    <Text style={styles.rowSub}>العائلة: {item.parent_username} | حافلة: {item.driver_id}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  header: { backgroundColor: '#2c3e50', paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  logoutBtn: { backgroundColor: '#e74c3c', paddingVertical: 6, paddingHorizontal: 15, borderRadius: 6 },
  logoutText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eceff1' },
  tabItem: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTabItem: { borderBottomColor: '#e67e22' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#7f8c8d' },
  activeTabText: { color: '#e67e22', fontWeight: 'bold' },
  contentScroll: { flex: 1, padding: 15 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 25, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#2c3e50', marginBottom: 15, textAlign: 'right' },
  input: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', textAlign: 'right', fontSize: 14 },
  addBtn: { backgroundColor: '#e67e22', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#34495e', marginTop: 25, marginBottom: 12, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 },
  dataRow: { flexDirection: 'row', backgroundColor: '#fdfefe', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#f1f2f6', alignItems: 'center', justifyContent: 'space-between' },
  deleteRowBtn: { backgroundColor: '#fff5f5', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#fab1a0' },
  deleteRowText: { color: '#d63031', fontSize: 13, fontWeight: '600' },
  rowInfo: { alignItems: 'flex-end', flex: 1, paddingRight: 10 },
  rowName: { fontSize: 15, fontWeight: 'bold', color: '#2c3e50' },
  rowSub: { fontSize: 12, color: '#7f8c8d', marginTop: 3 },
  dropdownLabel: { fontSize: 14, fontWeight: '600', color: '#57606f', marginTop: 10, marginBottom: 8, textAlign: 'right' },
  selectorScroll: { flexDirection: 'row', marginBottom: 15 },
  selectorChip: { backgroundColor: '#f1f2f6', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#e4e7eb' },
  selectorChipActive: { backgroundColor: '#ffe0cc', borderColor: '#e67e22' },
  chipText: { fontSize: 13, color: '#57606f' },
  chipTextActive: { color: '#e67e22', fontWeight: 'bold' }
});