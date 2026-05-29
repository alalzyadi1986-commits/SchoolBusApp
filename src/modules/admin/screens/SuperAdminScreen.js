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
  ScrollView,
  StatusBar,
  Modal
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../../firebaseConfig';
import {
  ref,
  set,
  onValue,
  remove,
  update,
  get
} from 'firebase/database';

import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SuperAdminScreen({ navigation }) {

  const [schools, setSchools] = useState([]);
  const [schoolName, setSchoolName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [startDate, setStartDate] = useState(new Date());

  const [endDate, setEndDate] = useState(
    new Date(
      new Date().setFullYear(
        new Date().getFullYear() + 1
      )
    )
  );

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [loading, setLoading] = useState(false);

  const [editingSchoolId, setEditingSchoolId] = useState(null);

  const [showPassModal, setShowPassModal] = useState(false);
  const [newAdminPass, setNewAdminPass] = useState('');

  useEffect(() => {

    const schoolsRef = ref(db, 'schools');

    const unsubscribe = onValue(
      schoolsRef,
      (snapshot) => {

        const data = snapshot.val();

        if (data) {

          const list = Object.keys(data).map((key) => ({
            id: key,
            ...data[key]
          }));

          setSchools(list);

        } else {

          setSchools([]);

        }
      }
    );

    return () => unsubscribe();

  }, []);

  const formatDate = (date) => {

    if (!date) return '';

    const d = new Date(date);

    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;

  };

  const checkSubscriptionStatus = (end) => {

    if (!end) {
      return {
        text: 'غير محدد',
        color: '#94A3B8'
      };
    }

    const today = new Date();
    const expiry = new Date(end);

    return expiry > today
      ? {
          text: 'نشط ✅',
          color: '#10B981'
        }
      : {
          text: 'منتهي ❌',
          color: '#EF4444'
        };

  };

  const generateSchoolId = async () => {

    const snapshot = await get(ref(db, 'schools'));

    const data = snapshot.val();

    if (!data) {
      return 'school_001';
    }

    const ids = Object.keys(data)
      .filter(id => id.startsWith('school_'));

    if (ids.length === 0) {
      return 'school_001';
    }

    const numbers = ids.map(id => {
      const parts = id.split('_');
      return parseInt(parts[1]) || 0;
    });

    const maxNumber = Math.max(...numbers);

    const nextNumber = maxNumber + 1;

    return `school_${String(nextNumber).padStart(3, '0')}`;

  };

  const handleSaveSchool = async () => {

    if (
      !schoolName ||
      !adminEmail ||
      !adminPassword
    ) {

      Alert.alert(
        'خطأ',
        'يرجى تعبئة جميع الحقول'
      );

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

      const safeUserKey = adminEmail
        .replace(/\./g, ',');

      if (editingSchoolId) {

        await update(
          ref(db, `schools/${editingSchoolId}`),
          schoolData
        );

        await update(
          ref(db, `users/${safeUserKey}`),
          {
            ...schoolData,
            schoolId: editingSchoolId,
            username: adminEmail,
          }
        );

        await update(
          ref(db, `userIndex/${safeUserKey}`),
          {
            schoolId: editingSchoolId,
            role: 'school',
          }
        );

        Alert.alert(
          'نجاح',
          'تم تحديث بيانات المدرسة بنجاح'
        );

        setEditingSchoolId(null);

      } else {

        const newSchoolId =
          await generateSchoolId();

        await set(
          ref(db, `schools/${newSchoolId}`),
          schoolData
        );

        const branches = [
          'drivers',
          'students',
          'parents',
          'staff',
          'buses',
          'tracking',
          'managers',
          'emergencies',
          'reports'
        ];

        for (const branch of branches) {

          await set(
            ref(
              db,
              `schools/${newSchoolId}/${branch}`
            ),
            {
              temp: true
            }
          );

        }

        await set(
          ref(db, `users/${safeUserKey}`),
          {
            ...schoolData,
            schoolId: newSchoolId,
            username: adminEmail,
          }
        );

        await set(
          ref(db, `userIndex/${safeUserKey}`),
          {
            schoolId: newSchoolId,
            role: 'school',
          }
        );

        Alert.alert(
          'نجاح',
          'تم إضافة المدرسة بنجاح'
        );

      }

      resetForm();

    } catch (error) {

      Alert.alert(
        'خطأ',
        'حدث خطأ أثناء حفظ البيانات: ' +
          error.message
      );

    } finally {

      setLoading(false);

    }
  };

  const resetForm = () => {

    setSchoolName('');
    setAdminEmail('');
    setAdminPassword('');

    setStartDate(new Date());

    setEndDate(
      new Date(
        new Date().setFullYear(
          new Date().getFullYear() + 1
        )
      )
    );

    setEditingSchoolId(null);

  };

  const handleEditPress = (school) => {

    setEditingSchoolId(school.id);

    setSchoolName(school.name);
    setAdminEmail(school.email);
    setAdminPassword(school.password);

    if (school.startDate) {
      setStartDate(
        new Date(school.startDate)
      );
    }

    if (school.endDate) {
      setEndDate(
        new Date(school.endDate)
      );
    }
  };

  const handleDeleteSchool = (id) => {

    Alert.alert(
      'تأكيد الحذف',
      'هل أنت متأكد من رغبتك في حذف هذه المدرسة نهائياً؟',
      [
        {
          text: 'إلغاء',
          style: 'cancel'
        },

        {
          text: 'حذف',
          style: 'destructive',

          onPress: async () => {

            setLoading(true);

            try {

              const schoolToDelete =
                schools.find(
                  s => s.id === id
                );

              await remove(
                ref(db, `schools/${id}`)
              );

              if (
                schoolToDelete &&
                schoolToDelete.email
              ) {

                const safeUserKey =
                  schoolToDelete.email
                    .replace(/\./g, ',');

                await remove(
                  ref(
                    db,
                    `users/${safeUserKey}`
                  )
                );

                await remove(
                  ref(
                    db,
                    `userIndex/${safeUserKey}`
                  )
                );

              }

              Alert.alert(
                'نجاح',
                'تم حذف المدرسة بنجاح'
              );

            } catch (error) {

              Alert.alert(
                'خطأ',
                'حدث خطأ أثناء حذف المدرسة: ' +
                  error.message
              );

            } finally {

              setLoading(false);

            }
          },
        },
      ]
    );
  };

  const handleUpdateSuperAdminPassword = async () => {

    if (!newAdminPass) {

      Alert.alert(
        'خطأ',
        'الرجاء إدخال كلمة المرور الجديدة.'
      );

      return;
    }

    setLoading(true);

    try {

      await update(
        ref(db, 'admin_settings/super_admin'),
        {
          password: newAdminPass
        }
      );

      Alert.alert(
        'نجاح',
        'تم تحديث كلمة مرور المدير العام بنجاح.'
      );

      setShowPassModal(false);
      setNewAdminPass('');

    } catch (error) {

      Alert.alert(
        'خطأ',
        'حدث خطأ أثناء تحديث كلمة المرور: ' +
          error.message
      );

    } finally {

      setLoading(false);

    }
  };

  const handleLogout = async () => {

    await AsyncStorage.removeItem(
      'user_session'
    );

    navigation.replace('Login');

  };

  if (loading) {

    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#007BFF"
        />

        <Text style={{ marginTop: 10 }}>
          جاري تحميل البيانات...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFF"
      />

      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
        <Text style={styles.title}>لوحة المدير العام 👑</Text>
        <TouchableOpacity style={styles.passBtn} onPress={() => setShowPassModal(true)}>
          <Text style={styles.passBtnText}>🔐</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>
            {editingSchoolId ? 'تعديل بيانات المدرسة' : 'إضافة مدرسة جديدة'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="اسم المدرسة"
            value={schoolName}
            onChangeText={setSchoolName}
            textAlign="right"
          />

          <TextInput
            style={styles.input}
            placeholder="البريد الإلكتروني (اسم المستخدم)"
            value={adminEmail}
            onChangeText={setAdminEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textAlign="right"
            editable={!editingSchoolId}
          />

          <TextInput
            style={styles.input}
            placeholder="كلمة المرور"
            value={adminPassword}
            onChangeText={setAdminPassword}
            secureTextEntry
            textAlign="right"
          />

          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
              <Text style={styles.dateBtnText}>بداية الاشتراك: {formatDate(startDate)}</Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowStartPicker(false);
                  if (date) setStartDate(date);
                }}
              />
            )}
          </View>

          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
              <Text style={styles.dateBtnText}>نهاية الاشتراك: {formatDate(endDate)}</Text>
            </TouchableOpacity>
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowEndPicker(false);
                  if (date) setEndDate(date);
                }}
              />
            )}
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSchool}>
              <Text style={styles.saveBtnText}>
                {editingSchoolId ? 'تحديث البيانات' : 'إضافة المدرسة'}
              </Text>
            </TouchableOpacity>

            {editingSchoolId && (
              <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>المدارس المسجلة ({schools.length})</Text>
          {schools.map((item) => {
            const status = checkSubscriptionStatus(item.endDate);
            return (
              <View key={item.id} style={styles.schoolCard}>
                <View style={styles.schoolHeader}>
                  <Text style={styles.schoolName}>{item.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                  </View>
                </View>
                
                <Text style={styles.schoolInfo}>📧 {item.email}</Text>
                <Text style={styles.schoolInfo}>📅 ينتهي في: {formatDate(item.endDate)}</Text>

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleEditPress(item)}>
                    <Text style={styles.editBtnText}>تعديل</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteSchool(item.id)}>
                    <Text style={styles.deleteBtnText}>حذف</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={showPassModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تحديث كلمة مرور المدير العام</Text>
            <TextInput
              style={styles.input}
              placeholder="كلمة المرور الجديدة"
              value={newAdminPass}
              onChangeText={setNewAdminPass}
              secureTextEntry
              textAlign="right"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleUpdateSuperAdminPassword}>
                <Text style={styles.modalSaveBtnText}>تحديث</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPassModal(false)}>
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  passBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 8 },
  passBtnText: { fontSize: 16 },
  scrollContent: { padding: 15 },
  formCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 15, elevation: 2, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 15, textAlign: 'right' },
  input: { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14 },
  dateRow: { marginBottom: 10 },
  dateBtn: { backgroundColor: '#EFF6FF', padding: 12, borderRadius: 10, alignItems: 'flex-end' },
  dateBtnText: { color: '#3B82F6', fontWeight: '600' },
  btnRow: { flexDirection: 'row-reverse', marginTop: 10 },
  saveBtn: { flex: 1, backgroundColor: '#3B82F6', padding: 15, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: 'bold' },
  cancelBtn: { width: 80, backgroundColor: '#94A3B8', padding: 15, borderRadius: 10, alignItems: 'center', marginRight: 10 },
  cancelBtnText: { color: '#FFF', fontWeight: 'bold' },
  listSection: { marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 15, textAlign: 'right' },
  schoolCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 15, marginBottom: 12, elevation: 1 },
  schoolHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  schoolName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  schoolInfo: { fontSize: 13, color: '#64748B', marginBottom: 5, textAlign: 'right' },
  actionRow: { flexDirection: 'row', marginTop: 10 },
  editBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: '#EFF6FF', borderRadius: 8, marginRight: 10 },
  editBtnText: { color: '#3B82F6', fontWeight: 'bold' },
  deleteBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: '#FEE2E2', borderRadius: 8 },
  deleteBtnText: { color: '#EF4444', fontWeight: 'bold' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 25 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 20, textAlign: 'center' },
  modalBtns: { flexDirection: 'row-reverse', marginTop: 10 },
  modalSaveBtn: { flex: 1, backgroundColor: '#3B82F6', padding: 15, borderRadius: 10, alignItems: 'center' },
  modalSaveBtnText: { color: '#FFF', fontWeight: 'bold' },
  modalCancelBtn: { width: 80, backgroundColor: '#94A3B8', padding: 15, borderRadius: 10, alignItems: 'center', marginRight: 10 },
  modalCancelBtnText: { color: '#FFF', fontWeight: 'bold' }
});
