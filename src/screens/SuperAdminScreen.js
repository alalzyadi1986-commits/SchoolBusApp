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
import { db } from '../firebaseConfig';
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

      // مفتاح آمن لفايربيس
      const safeUserKey = adminEmail
        .replace(/\./g, ',');

      // تعديل مدرسة موجودة
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

        // إنشاء ID مرتب
        const newSchoolId =
          await generateSchoolId();

        // حفظ المدرسة
        await set(
          ref(db, `schools/${newSchoolId}`),
          schoolData
        );

        // إنشاء الفروع الأساسية
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

        // إنشاء حساب المدرسة
        await set(
          ref(db, `users/${safeUserKey}`),
          {
            ...schoolData,
            schoolId: newSchoolId,
            username: adminEmail,
          }
        );

        // إنشاء userIndex
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

        <Text style={styles.title}>
          إدارة المدارس 👑
        </Text>

        <View style={styles.headerRight}>

          <TouchableOpacity
            style={styles.logoutHeaderBtn}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>
              🚪 خروج
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.changePassHeaderBtn}
            onPress={() =>
              setShowPassModal(true)
            }
          >
            <Text style={styles.changePassText}>
              🔐 كلمة سري
            </Text>
          </TouchableOpacity>

        </View>
      </View>

      <ScrollView style={styles.container}>

        <View style={styles.formContainer}>

          <Text style={styles.formTitle}>
            {
              editingSchoolId
                ? 'تعديل بيانات المدرسة 📝'
                : 'إضافة مدرسة جديدة 🏫'
            }
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
            placeholder="اسم المستخدم (للمدرسة)"
            value={adminEmail}
            onChangeText={setAdminEmail}
            autoCapitalize="none"
            textAlign="right"
          />

          <TextInput
            style={styles.input}
            placeholder="كلمة المرور"
            value={adminPassword}
            onChangeText={setAdminPassword}
            textAlign="right"
          />

          <View style={styles.datePickerContainer}>

            <TouchableOpacity
              onPress={() =>
                setShowStartPicker(true)
              }
              style={styles.datePickerButton}
            >
              <Text style={styles.datePickerButtonText}>
                📅 تاريخ البدء{'\n'}
                {formatDate(startDate)}
              </Text>
            </TouchableOpacity>

            {
              showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  onChange={(e, d) => {

                    setShowStartPicker(false);

                    if (d) {
                      setStartDate(d);
                    }
                  }}
                />
              )
            }

            <TouchableOpacity
              onPress={() =>
                setShowEndPicker(true)
              }
              style={styles.datePickerButton}
            >
              <Text style={styles.datePickerButtonText}>
                📅 تاريخ الانتهاء{'\n'}
                {formatDate(endDate)}
              </Text>
            </TouchableOpacity>

            {
              showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="default"
                  onChange={(e, d) => {

                    setShowEndPicker(false);

                    if (d) {
                      setEndDate(d);
                    }
                  }}
                />
              )
            }

          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveSchool}
            disabled={loading}
          >

            {
              loading
                ? (
                  <ActivityIndicator
                    color="#fff"
                  />
                )
                : (
                  <Text style={styles.saveButtonText}>
                    {
                      editingSchoolId
                        ? 'تحديث المدرسة'
                        : 'إضافة مدرسة'
                    }
                  </Text>
                )
            }

          </TouchableOpacity>

          {
            editingSchoolId && (
              <TouchableOpacity
                style={styles.cancelEditButton}
                onPress={resetForm}
              >
                <Text style={styles.cancelEditButtonText}>
                  إلغاء التعديل
                </Text>
              </TouchableOpacity>
            )
          }

        </View>

        <Text style={styles.listTitle}>
          المدارس المسجلة ({schools.length})
        </Text>

        <FlatList
          data={schools}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => {

            const status =
              checkSubscriptionStatus(
                item.endDate
              );

            return (
              <View style={styles.schoolCard}>

                <View style={styles.schoolInfo}>

                  <Text style={styles.schoolName}>
                    {item.name}
                  </Text>

                  <Text style={styles.schoolDetail}>
                    المستخدم: {item.email}
                  </Text>

                  <Text style={styles.schoolDetail}>
                    كلمة السر: {item.password}
                  </Text>

                  <Text
                    style={[
                      styles.schoolDetail,
                      { color: status.color }
                    ]}
                  >
                    الاشتراك: {status.text}
                  </Text>

                  <Text style={styles.schoolDetail}>
                    من:
                    {' '}
                    {formatDate(item.startDate)}
                    {' '}
                    إلى:
                    {' '}
                    {formatDate(item.endDate)}
                  </Text>

                </View>

                <View style={styles.schoolActions}>

                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() =>
                      handleEditPress(item)
                    }
                  >
                    <Text style={styles.editButtonText}>
                      تعديل
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() =>
                      handleDeleteSchool(item.id)
                    }
                  >
                    <Text style={styles.deleteButtonText}>
                      حذف
                    </Text>
                  </TouchableOpacity>

                </View>

              </View>
            );
          }}

          ListEmptyComponent={
            <Text style={styles.emptyListText}>
              لا توجد مدارس مسجلة.
            </Text>
          }
        />

      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={showPassModal}
        onRequestClose={() =>
          setShowPassModal(false)
        }
      >

        <View style={styles.centeredView}>

          <View style={styles.modalView}>

            <Text style={styles.modalTitle}>
              تغيير كلمة سر المدير العام
            </Text>

            <TextInput
              style={styles.input}
              placeholder="كلمة المرور الجديدة"
              value={newAdminPass}
              onChangeText={setNewAdminPass}
              textAlign="right"
            />

            <View style={styles.modalButtons}>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={
                  handleUpdateSuperAdminPassword
                }
              >
                <Text style={styles.modalBtnText}>
                  حفظ
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() =>
                  setShowPassModal(false)
                }
              >
                <Text style={styles.modalBtnText}>
                  إلغاء
                </Text>
              </TouchableOpacity>

            </View>

          </View>

        </View>

      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },

  header: {
    padding: 15,
    backgroundColor: '#FFF',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },

  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B'
  },

  logoutHeaderBtn: {
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    marginLeft: 8
  },

  logoutText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '700'
  },

  changePassHeaderBtn: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8
  },

  changePassText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600'
  },

  container: {
    flex: 1,
    padding: 15
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC'
  },

  formContainer: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3
  },

  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 15,
    color: '#1E293B',
    textAlign: 'right'
  },

  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
  },

  datePickerContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 10
  },

  datePickerButton: {
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    flex: 0.48,
  },

  datePickerButtonText: {
    color: '#1E293B',
    fontSize: 13,
    textAlign: 'center'
  },

  saveButton: {
    backgroundColor: '#007BFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 5,
    elevation: 2
  },

  saveButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16
  },

  cancelEditButton: {
    backgroundColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    elevation: 2
  },

  cancelEditButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16
  },

  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 10,
    textAlign: 'right'
  },

  schoolCard: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
  },

  schoolInfo: {
    flex: 1,
    alignItems: 'flex-end'
  },

  schoolName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4
  },

  schoolDetail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },

  schoolActions: {
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: 10
  },

  editButton: {
    backgroundColor: '#DBEAFE',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    minWidth: 60,
    alignItems: 'center'
  },

  editButtonText: {
    color: '#3B82F6',
    fontWeight: 'bold',
    fontSize: 12
  },

  deleteButton: {
    backgroundColor: '#FEE2E2',
    padding: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center'
  },

  deleteButtonText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 12
  },

  emptyListText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    fontSize: 16
  },

  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },

  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'stretch',
    elevation: 5,
    width: '85%',
  },

  modalTitle: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B'
  },

  modalButtons: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 15
  },

  modalSaveBtn: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 8,
    flex: 0.45,
    alignItems: 'center'
  },

  modalCancelBtn: {
    backgroundColor: '#94A3B8',
    padding: 10,
    borderRadius: 8,
    flex: 0.45,
    alignItems: 'center'
  },

  modalBtnText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center'
  },
});