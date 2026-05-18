import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { db } from '../firebaseConfig';
import { ref, set, push, onValue, remove, update } from 'firebase/database';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function SuperAdminScreen({ navigation }) {
  const [schools, setSchools] = useState([]);
  const [schoolName, setSchoolName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(new Date().setFullYear(new Date().getFullYear() + 1)));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState(null);

  // جلب المدارس من قاعدة البيانات
  useEffect(() => {
    const schoolsRef = ref(db, 'schools');
    const unsubscribe = onValue(schoolsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setSchools(list);
      } else {
        setSchools([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const onStartDateChange = (event, selectedDate) => {
    setShowStartPicker(false);
    if (selectedDate) setStartDate(selectedDate);
  };

  const onEndDateChange = (event, selectedDate) => {
    setShowEndPicker(false);
    if (selectedDate) setEndDate(selectedDate);
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  const checkSubscriptionStatus = (end) => {
    if (!end) return { text: 'غير محدد', color: '#94A3B8' };
    const today = new Date();
    const expiry = new Date(end);
    if (expiry > today) {
      return { text: 'نشط', color: '#10B981' };
    } else {
      return { text: 'منتهي', color: '#EF4444' };
    }
  };

  // إضافة أو تعديل مدرسة
  const handleSaveSchool = async () => {
    if (!schoolName || !adminEmail || !adminPassword) {
      Alert.alert('خطأ', 'يرجى تعبئة جميع الحقول');
      return;
    }

    setLoading(true);
    try {
      const schoolData = {
        name: schoolName,
        email: adminEmail,
        password: adminPassword,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        role: 'school',
      };

      if (editingSchoolId) {
        const schoolRef = ref(db, `schools/${editingSchoolId}`);
        await update(schoolRef, schoolData);
        Alert.alert('نجاح', 'تم تحديث بيانات المدرسة بنجاح');
        setEditingSchoolId(null);
      } else {
        const newSchoolRef = push(ref(db, 'schools'));
        await set(newSchoolRef, schoolData);
        Alert.alert('نجاح', 'تم إضافة المدرسة بنجاح');
      }
      resetForm();
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء حفظ البيانات: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSchoolName('');
    setAdminEmail('');
    setAdminPassword('');
    setStartDate(new Date());
    setEndDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1)));
    setEditingSchoolId(null);
  };

  const handleEditPress = (school) => {
    setEditingSchoolId(school.id);
    setSchoolName(school.name);
    setAdminEmail(school.email);
    setAdminPassword(school.password);
    if (school.startDate) setStartDate(new Date(school.startDate));
    if (school.endDate) setEndDate(new Date(school.endDate));
  };

  const handleDeleteSchool = (id) => {
    Alert.alert(
      'تأكيد الحذف',
      'هل أنت متأكد من رغبتك في حذف هذه المدرسة نهائياً؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(ref(db, `schools/${id}`));
              Alert.alert('نجاح', 'تم حذف المدرسة بنجاح');
            } catch (error) {
              Alert.alert('خطأ', 'فشل الحذف: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const handleChangeAdminPassword = () => {
    Alert.alert('تنبيه', 'هذه الميزة ستكون متاحة قريباً في التحديث القادم.');
  };

  const renderSchoolItem = ({ item, index }) => {
    const status = checkSubscriptionStatus(item.endDate);
    return (
      <View style={styles.schoolCard}>
        <View style={styles.schoolHeader}>
          <Text style={styles.schoolNumber}>{index + 1}.</Text>
          <Text style={styles.schoolName}>{item.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
        </View>
        
        <View style={styles.schoolInfoRow}>
          <Text style={styles.schoolDetails}>المستخدم: {item.email}</Text>
          <Text style={styles.schoolDetails}>كلمة السر: {item.password}</Text>
        </View>
        
        <View style={styles.dateRow}>
          <Text style={styles.dateText}>من: {formatDate(item.startDate)}</Text>
          <Text style={styles.dateText}>إلى: {formatDate(item.endDate)}</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.editButton} onPress={() => handleEditPress(item)}>
            <Text style={styles.actionText}>تعديل</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteSchool(item.id)}>
            <Text style={styles.actionText}>حذف</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>لوحة التحكم للمدير العام</Text>
        <TouchableOpacity style={styles.changePassHeaderBtn} onPress={handleChangeAdminPassword}>
          <Text style={styles.changePassText}>🔐 تغيير كلمة سري</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={schools}
        keyExtractor={(item) => item.id}
        renderItem={renderSchoolItem}
        ListHeaderComponent={
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              {editingSchoolId ? 'تعديل بيانات المدرسة 📝' : 'إضافة مدرسة جديدة 🏫'}
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="اسم المدرسة"
              value={schoolName}
              onChangeText={setSchoolName}
            />
            
            <TextInput
              style={styles.input}
              placeholder="اسم المستخدم للمدرسة"
              value={adminEmail}
              onChangeText={setAdminEmail}
              autoCapitalize="none"
            />
            
            <TextInput
              style={styles.input}
              placeholder="كلمة المرور للمدرسة"
              value={adminPassword}
              onChangeText={setAdminPassword}
              autoCapitalize="none"
            />

            <View style={styles.datePickersRow}>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.dateBtnLabel}>تاريخ البدء</Text>
                <Text style={styles.dateBtnValue}>{formatDate(startDate)}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.dateBtnLabel}>تاريخ الانتهاء</Text>
                <Text style={styles.dateBtnValue}>{formatDate(endDate)}</Text>
              </TouchableOpacity>
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={onStartDateChange}
              />
            )}

            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={onEndDateChange}
              />
            )}

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveSchool} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{editingSchoolId ? 'تحديث البيانات' : 'إضافة المدرسة'}</Text>
              )}
            </TouchableOpacity>

            {editingSchoolId && (
              <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                <Text style={styles.buttonText}>إلغاء التعديل</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity style={styles.logoutButton} onPress={() => navigation.replace('LoginScreen')}>
            <Text style={styles.logoutButtonText}>تسجيل الخروج</Text>
          </TouchableOpacity>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    padding: 20, 
    backgroundColor: '#FFF', 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  changePassHeaderBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 8 },
  changePassText: { fontSize: 12, color: '#3B82F6', fontWeight: '600' },
  
  listContent: { padding: 15 },
  
  formContainer: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, marginBottom: 25, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  formTitle: { fontSize: 16, fontWeight: '700', marginBottom: 15, color: '#1E293B', textAlign: 'right' },
  input: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', textAlign: 'right', fontSize: 14 },
  
  datePickersRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 },
  dateBtn: { flex: 0.48, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  dateBtnLabel: { fontSize: 11, color: '#64748B', marginBottom: 4 },
  dateBtnValue: { fontSize: 13, color: '#1E293B', fontWeight: '600' },
  
  saveButton: { backgroundColor: '#3B82F6', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 5 },
  cancelButton: { backgroundColor: '#94A3B8', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  
  schoolCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  schoolHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
  schoolNumber: { fontSize: 16, fontWeight: 'bold', color: '#3B82F6', marginLeft: 8 },
  schoolName: { flex: 1, fontSize: 16, fontWeight: '800', color: '#1E293B', textAlign: 'right' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  
  schoolInfoRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  schoolDetails: { fontSize: 13, color: '#475569', textAlign: 'right' },
  
  dateRow: { flexDirection: 'row-reverse', justifyContent: 'space-around', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginBottom: 10 },
  dateText: { fontSize: 12, color: '#64748B' },
  
  actionButtons: { flexDirection: 'row', justifyContent: 'flex-start' },
  editButton: { backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, marginRight: 10 },
  deleteButton: { backgroundColor: '#FEE2E2', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
  actionText: { fontSize: 12, fontWeight: '700', color: '#3B82F6' },
  
  logoutButton: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 30, borderWidth: 1, borderColor: '#FEE2E2' },
  logoutButtonText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
});
