<<<<<<< HEAD
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
=======
import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, Alert, ScrollView, ActivityIndicator } from 'react-native';
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
  const [schoolLocation, setSchoolLocation] = useState(null);

  // حقول الإدخال (ثابتة في أعلى الصفحة)
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
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [enableSpeedAlert, setEnableSpeedAlert] = useState(false);
  const speedOptions = ['بدون تحديد', 50, 60, 70, 80, 90, 100, 110, 120];

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
        if (data.latitude && data.longitude) {
          setSchoolLocation({ latitude: data.latitude, longitude: data.longitude });
        }
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

  // دالة تشفير كلمة المرور بسيطة وآمنة
  const hashPassword = (password) => {
    let hash = 0;
    if (password.length === 0) return hash.toString();
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

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
      // حفظ كلمة المرور كما هي (نص عادي) بناءً على طلب المستخدم
      // لا يتم التشفير هنا لتبقى ظاهرة في لوحة التحكم

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
    // فتح النموذج المناسب حسب القسم الحالي
    if (activeTab === 'drivers') setShowDriverForm(true);
    else if (activeTab === 'staff') setShowStaffForm(true);
    else if (activeTab === 'parents') setShowParentForm(true);
    else if (activeTab === 'students') setShowStudentForm(true);
    else if (activeTab === 'managers') setShowManagerForm(true);
  };

  const renderInput = (placeholder, field, isPassword = false, isNumeric = false) => (
    <View style={styles.inputWrapper}>
      <Text style={styles.inputLabel}>{placeholder}:</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={formData[field] || ''}
        onChangeText={(txt) => setFormData({ ...formData, [field]: txt })}
        secureTextEntry={false} // تم الإلغاء بناءً على طلبك لرؤية كلمة السر بوضوح
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

  const setLocationToCurrent = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('خطأ', 'يرجى السماح بالوصول للموقع');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const newLoc = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      await update(ref(db, `schools/${schoolId}`), newLoc);
      setSchoolLocation(newLoc);
      Alert.alert('تم', 'تم تحديد موقع المدرسة الحالي بنجاح');
    } catch (error) {
      Alert.alert('خطأ', 'فشل في جلب الموقع الحالي');
    }
  };

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
            { id: 'managers', label: 'الإدارة' },
            { id: 'settings', label: 'الإعدادات' }
          ].map(tab => (
            <TouchableOpacity key={tab.id} style={[styles.tabGridItem, activeTab === tab.id && styles.activeTabGrid]} onPress={() => { setActiveTab(tab.id); setFormData({}); setEditingId(null); }}>
              <Text style={[styles.tabGridText, activeTab === tab.id && styles.activeTabGridText]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* أزرار الإضافة السريعة */}
      {activeTab === 'drivers' && !showDriverForm && (
        <View style={styles.addButtonContainer}>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setShowDriverForm(true); setFormData({}); setEditingId(null); }}>
            <Text style={styles.addBtnIcon}>👨‍🚗</Text>
            <Text style={styles.addBtnText}>إضافة سائق</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'staff' && !showStaffForm && (
        <View style={styles.addButtonContainer}>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setShowStaffForm(true); setFormData({}); setEditingId(null); }}>
            <Text style={styles.addBtnIcon}>👥</Text>
            <Text style={styles.addBtnText}>إضافة مرافق</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'parents' && !showParentForm && (
        <View style={styles.addButtonContainer}>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setShowParentForm(true); setFormData({}); setEditingId(null); }}>
            <Text style={styles.addBtnIcon}>👨‍👩‍👧</Text>
            <Text style={styles.addBtnText}>إضافة ولي أمر</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'students' && !showStudentForm && (
        <View style={styles.addButtonContainer}>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setShowStudentForm(true); setFormData({}); setEditingId(null); }}>
            <Text style={styles.addBtnIcon}>👨‍🎓</Text>
            <Text style={styles.addBtnText}>إضافة طالب</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'managers' && !showManagerForm && (
        <View style={styles.addButtonContainer}>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setShowManagerForm(true); setFormData({}); setEditingId(null); }}>
            <Text style={styles.addBtnIcon}>👨‍💼</Text>
            <Text style={styles.addBtnText}>إضافة مدير</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content} scrollEventThrottle={16} removeClippedSubviews={true}>
        {/* إعدادات المدرسة */}
        {activeTab === 'settings' && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>إعدادات موقع المدرسة 📍</Text>
            <Text style={styles.sectionDesc}>يستخدم هذا الموقع لإنهاء الرحلات تلقائياً وإبلاغ الأهالي بوصول الباص.</Text>
            
            <View style={styles.locationStatus}>
              <Text style={styles.locationStatusText}>
                الحالة: {schoolLocation ? '✅ تم تحديد الموقع' : '❌ لم يتم تحديد الموقع بعد'}
              </Text>
              {schoolLocation && (
                <Text style={styles.locationCoords}>
                  {schoolLocation.latitude.toFixed(5)}, {schoolLocation.longitude.toFixed(5)}
                </Text>
              )}
            </View>

            <TouchableOpacity style={styles.locationBtn} onPress={setLocationToCurrent}>
              <Text style={styles.locationBtnText}>📍 أنا في المدرسة (تحديد موقعي الحالي)</Text>
            </TouchableOpacity>

            <Text style={styles.noteText}>* سيتم استخدام هذا الموقع كنقطة النهاية الرسمية لجميع الرحلات.</Text>
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
              <Text style={styles.inputLabel}>السرعة القصوى المسموحة:</Text>
              <TouchableOpacity style={styles.speedPickerBtn} onPress={() => setShowSpeedPicker(true)}>
                <View style={styles.speedDisplayBox}>
                  <Text style={styles.speedDisplayText}>
                    {formData.max_speed ? (formData.max_speed === 'بدون تحديد' ? 'بدون تحديد' : `${formData.max_speed} كم/س`) : 'اضغط لاختيار'}
                  </Text>
                </View>
                <Text style={styles.speedPickerArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Modal لاختيار السرعة */}
            {showSpeedPicker && (
              <View style={styles.speedPickerModal}>
                <Text style={styles.speedPickerTitle}>اختر السرعة القصوى:</Text>
                <ScrollView style={styles.speedPickerList} nestedScrollEnabled={true}>
                  {speedOptions.map((speed, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={[styles.speedOption, formData.max_speed === speed && styles.speedOptionActive]}
                      onPress={() => { setFormData({ ...formData, max_speed: speed }); setShowSpeedPicker(false); if (speed === 'بدون تحديد') setEnableSpeedAlert(false); else setEnableSpeedAlert(true); }}
                    >
                      <Text style={[styles.speedOptionText, formData.max_speed === speed && styles.speedOptionTextActive]}>{speed === 'بدون تحديد' ? 'بدون تحديد' : `${speed} كم/س`}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.speedPickerClose} onPress={() => setShowSpeedPicker(false)}>
                  <Text style={styles.speedPickerCloseText}>إغلاق</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* مربع التنبيه عند تجاوز السرعة */}
            {formData.max_speed && formData.max_speed !== 'بدون تحديد' && (
              <TouchableOpacity 
                style={styles.checkboxContainer} 
                onPress={() => setEnableSpeedAlert(!enableSpeedAlert)}
              >
                <View style={[styles.checkbox, enableSpeedAlert && styles.checkboxChecked]} />
                <Text style={styles.checkboxLabel}>إرسال تنبيه عند تجاوز السرعة</Text>
              </TouchableOpacity>
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

        {/* نموذج المرافقين */}
        {activeTab === 'staff' && showStaffForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'تعديل بيانات المرافق' : 'إضافة مرافق جديد'}</Text>
            
            {renderInput('الاسم الكامل', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {renderInput('كلمة المرور', 'password', true)}
            {renderInput('رقم الهاتف', 'phone', false, true)}
            
            <Text style={styles.sectionLabel}>ربط المرافقة بالسائق:</Text>
            <ScrollView horizontal style={styles.chipScroll}>
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
            
            <Text style={styles.sectionLabel}>صلاحيات المرافقة:</Text>
            {renderPermission('تسجيل الحضور والغياب', 'canMarkAttendance')}
            {renderPermission('إضافة طلاب ومواقع', 'canAddStudents')}
            {renderPermission('رؤية موقع الباص', 'canViewBus')}

            <TouchableOpacity style={styles.saveBtn} onPress={() => handleAction('save')}>
              <Text style={styles.saveBtnText}>{editingId ? 'تحديث البيانات' : 'حفظ البيانات'}</Text>
            </TouchableOpacity>
            {editingId && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingId(null); setFormData({}); }}>
                <Text style={styles.cancelBtnText}>إلغاء التعديل</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowStaffForm(false); setFormData({}); setEditingId(null); }}>
              <Text style={styles.cancelBtnText}>إغلاق النموذج</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* نموذج أولياء الأمور */}
        {activeTab === 'parents' && showParentForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'تعديل بيانات ولي الأمر' : 'إضافة ولي أمر جديد'}</Text>
            
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
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowParentForm(false); setFormData({}); setEditingId(null); }}>
              <Text style={styles.cancelBtnText}>إغلاق النموذج</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* نموذج الطلاب */}
        {activeTab === 'students' && showStudentForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}</Text>
            
            {renderInput('الاسم الكامل', 'name')}
            {renderInput('اسم المستخدم', 'username')}
            {renderInput('كلمة المرور', 'password', true)}
            
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

            <Text style={styles.sectionLabel}>ربط بالسائق:</Text>
            <ScrollView horizontal style={styles.chipScroll}>
              {drivers.map(d => (
                <TouchableOpacity key={d.id} style={[styles.miniChip, formData.driver_id === d.username && styles.miniChipActive]} onPress={() => setFormData({ ...formData, driver_id: d.username === formData.driver_id ? null : d.username })}>
                  <Text style={[styles.miniChipText, formData.driver_id === d.username && styles.miniChipTextActive]}>سائق: {d.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={() => handleAction('save')}>
              <Text style={styles.saveBtnText}>{editingId ? 'تحديث البيانات' : 'حفظ البيانات'}</Text>
            </TouchableOpacity>
            {editingId && (
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingId(null); setFormData({}); }}>
                <Text style={styles.cancelBtnText}>إلغاء التعديل</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowStudentForm(false); setFormData({}); setEditingId(null); }}>
              <Text style={styles.cancelBtnText}>إغلاق النموذج</Text>
            </TouchableOpacity>
          </View>
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
                {drivers.map(d => (
                  <TouchableOpacity 
                    key={d.id} 
                    style={[styles.miniChip, selectedDriverReport === d.username && styles.miniChipActive]} 
                    onPress={() => setSelectedDriverReport(selectedDriverReport === d.username ? 'الكل' : d.username)}
                  >
                    <Text style={[styles.miniChipText, selectedDriverReport === d.username && styles.miniChipTextActive]}>{d.name}</Text>
                  </TouchableOpacity>
                ))}
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
                      {activeTab === 'students' ? `الصف: ${item.class} - شعبة: ${item.section}` : `الهاتف: ${item.phone}${item.password ? ` | كلمة السر: ${item.password}` : ''}`}
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
>>>>>>> 26cefefa39de4b8031862128921805f50f269406
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
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
=======
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
  tab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginHorizontal: 5, backgroundColor: '#F8FAFC' },
  activeTab: { backgroundColor: '#3B82F6' },
  tabText: { color: '#64748B', fontWeight: 'bold' },
  activeTabText: { color: '#FFF' },
  content: { flex: 1 },
  formCard: { backgroundColor: '#FFF', margin: 15, padding: 15, borderRadius: 15, elevation: 3 },
  formTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, textAlign: 'right', color: '#3B82F6' },
  inputWrapper: { marginBottom: 12 },
  inputLabel: { fontSize: 13, color: '#64748B', textAlign: 'right', marginBottom: 5, fontWeight: 'bold' },
  input: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, textAlign: 'right', borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B' },
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
,
  addBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  addBtnIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  speedDisplayBox: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  speedDisplayText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  sectionDesc: { fontSize: 12, color: '#64748B', textAlign: 'right', marginBottom: 15 },
  locationStatus: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 15 },
  locationStatusText: { fontSize: 14, fontWeight: 'bold', textAlign: 'right', color: '#1E293B' },
  locationCoords: { fontSize: 12, color: '#64748B', textAlign: 'right', marginTop: 5, fontFamily: 'monospace' },
  locationBtn: { backgroundColor: '#10B981', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  locationBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  noteText: { fontSize: 11, color: '#94A3B8', textAlign: 'right', fontStyle: 'italic' }
});
>>>>>>> 26cefefa39de4b8031862128921805f50f269406
