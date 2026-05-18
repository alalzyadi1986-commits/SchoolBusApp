import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, set, push, get, remove, onValue } from 'firebase/database';
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

  // حقول الإدخال
  const [driverUser, setDriverUser] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPass, setDriverPass] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [busNumber, setBusNumber] = useState('');

  const [staffUser, setStaffUser] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffPass, setStaffPass] = useState('');
  const [staffPhone, setStaffPhone] = useState('');

  const [parentUser, setParentUser] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [parentPass, setParentPass] = useState('');
  const [parentPhone, setParentPhone] = useState('');

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
          
          // التحقق من حالة الاشتراك
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

  const handleAddDriver = async () => {
    if (!checkAccess()) return;
    if (!driverUser || !driverName || !driverPass || !driverPhone || !busNumber) {
      Alert.alert('خطأ', 'الرجاء تعبئة جميع حقول السائق');
      return;
    }
    try {
      await set(ref(db, `schools/${schoolId}/drivers/${driverUser.trim()}`), {
        name: driverName,
        password: driverPass,
        phone: driverPhone,
        bus_number: busNumber,
        role: 'driver'
      });
      Alert.alert('نجاح', 'تم إضافة السائق بنجاح');
      setDriverUser(''); setDriverName(''); setDriverPass(''); setDriverPhone(''); setBusNumber('');
    } catch (error) {
      Alert.alert('خطأ', 'فشلت عملية الحفظ');
    }
  };

  const handleAddStaff = async () => {
    if (!checkAccess()) return;
    if (!staffUser || !staffName || !staffPass || !staffPhone) {
      Alert.alert('خطأ', 'الرجاء تعبئة جميع حقول المرافقة');
      return;
    }
    try {
      await set(ref(db, `schools/${schoolId}/staff/${staffUser.trim()}`), {
        name: staffName,
        password: staffPass,
        phone: staffPhone,
        role: 'staff'
      });
      Alert.alert('نجاح', 'تم إضافة المرافقة بنجاح');
      setStaffUser(''); setStaffName(''); setStaffPass(''); setStaffPhone('');
    } catch (error) {
      Alert.alert('خطأ', 'فشلت عملية الحفظ');
    }
  };

  const handleAddParent = async () => {
    if (!checkAccess()) return;
    if (!parentUser || !familyName || !parentPass || !parentPhone) {
      Alert.alert('خطأ', 'الرجاء تعبئة جميع حقول الأهل');
      return;
    }
    try {
      await set(ref(db, `schools/${schoolId}/parents/${parentUser.trim()}`), {
        family_name: familyName,
        password: parentPass,
        phone: parentPhone,
        role: 'parent'
      });
      Alert.alert('نجاح', 'تم توليد حساب العائلة بنجاح');
      setParentUser(''); setFamilyName(''); setParentPass(''); setParentPhone('');
    } catch (error) {
      Alert.alert('خطأ', 'فشلت عملية الحفظ');
    }
  };

  const handleAddStudent = async () => {
    if (!checkAccess()) return;
    if (!studentName || !studentClass || !selectedParent || !selectedDriver) {
      Alert.alert('خطأ', 'الرجاء تحديد اسم الطالب، الصف، حساب الأهل، وتعيين السائق');
      return;
    }
    try {
      const studentsRef = ref(db, `schools/${schoolId}/students`);
      await set(push(studentsRef), {
        name: studentName,
        class: studentClass,
        parent_username: selectedParent,
        driver_id: selectedDriver
      });
      Alert.alert('نجاح', 'تم تسجيل الطالب وربطه بالنظام');
      setStudentName(''); setStudentClass(''); setSelectedParent(''); setSelectedDriver('');
    } catch (error) {
      Alert.alert('خطأ', 'فشلت عملية الحفظ');
    }
  };

  const handleDeleteItem = (path, itemType) => {
    if (!checkAccess()) return;
    Alert.alert('تأكيد الحذف', `هل أنت متأكد من حذف هذا ${itemType} نهائياً؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'نعم، احذف', style: 'destructive', onPress: async () => {
          try {
            await remove(ref(db, `schools/${schoolId}/${path}`));
            Alert.alert('نجاح', 'تم الحذف بنجاح');
          } catch (e) { Alert.alert('خطأ', 'لم يتم الحذف'); }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>لوحة تحكم المدرسة</Text>
          {isReadOnly && <Text style={styles.readOnlyText}>وضع المشاهدة فقط (الاشتراك منتهي)</Text>}
        </View>
      </View>

      <View style={styles.tabBar}>
        {['drivers', 'staff', 'parents', 'students'].map((tab) => (
          <TouchableOpacity 
            key={tab}
            style={[styles.tabItem, activeTab === tab && styles.activeTabItem]} 
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'drivers' ? 'السائقين' : tab === 'staff' ? 'المرافقين' : tab === 'parents' ? 'الأهل' : 'الطلاب'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.contentScroll} keyboardShouldPersistTaps="handled">
        {activeTab === 'drivers' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>إضافة سائق جديد وحافلة</Text>
            <TextInput style={styles.input} placeholder="اسم مستخدم فريد" value={driverUser} onChangeText={setDriverUser} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="اسم السائق" value={driverName} onChangeText={setDriverName} />
            <TextInput style={styles.input} placeholder="كلمة المرور" value={driverPass} onChangeText={setDriverPass} secureTextEntry />
            <TextInput style={styles.input} placeholder="رقم الهاتف" value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="رقم الباص" value={busNumber} onChangeText={setBusNumber} />
            <TouchableOpacity style={[styles.addBtn, isReadOnly && styles.disabledBtn]} onPress={handleAddDriver}>
              <Text style={styles.addBtnText}>➕ حفظ السائق</Text>
            </TouchableOpacity>
            <Text style={styles.listTitle}>قائمة السائقين</Text>
            {driversList.map((item) => (
              <View key={item.username} style={styles.dataRow}>
                <TouchableOpacity style={styles.deleteRowBtn} onPress={() => handleDeleteItem(`drivers/${item.username}`, 'السائق')}>
                  <Text style={styles.deleteRowText}>حذف</Text>
                </TouchableOpacity>
                <View style={styles.rowInfo}><Text style={styles.rowName}>{item.name}</Text><Text style={styles.rowSub}>{item.username}</Text></View>
              </View>
            ))}
          </View>
        )}
        {/* سيتم تطبيق نفس النمط لبقية التبويبات في الكود الفعلي */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  header: { padding: 15, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', textAlign: 'right' },
  readOnlyText: { fontSize: 10, color: '#e74c3c', textAlign: 'right' },
  logoutBtn: { padding: 8, backgroundColor: '#fdf2f2', borderRadius: 8 },
  logoutText: { color: '#e74c3c', fontWeight: 'bold' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  activeTabItem: { borderBottomWidth: 3, borderBottomColor: '#e67e22' },
  tabText: { color: '#7f8c8d', fontSize: 13 },
  activeTabText: { color: '#e67e22', fontWeight: 'bold' },
  contentScroll: { flex: 1, padding: 15 },
  sectionCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: '#2c3e50', textAlign: 'right' },
  input: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 10, textAlign: 'right', borderWidth: 1, borderColor: '#eee' },
  addBtn: { backgroundColor: '#e67e22', padding: 15, borderRadius: 8, alignItems: 'center' },
  disabledBtn: { backgroundColor: '#bdc3c7' },
  addBtnText: { color: '#fff', fontWeight: 'bold' },
  listTitle: { fontSize: 14, fontWeight: 'bold', marginTop: 20, marginBottom: 10, textAlign: 'right' },
  dataRow: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f1f1', alignItems: 'center' },
  deleteRowBtn: { padding: 6, backgroundColor: '#fdf2f2', borderRadius: 6 },
  deleteRowText: { color: '#e74c3c', fontSize: 12 },
  rowInfo: { flex: 1, alignItems: 'flex-end', paddingRight: 10 },
  rowName: { fontSize: 14, fontWeight: 'bold' },
  rowSub: { fontSize: 12, color: '#7f8c8d' }
});
