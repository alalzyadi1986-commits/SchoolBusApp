import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { db } from '../firebaseConfig';
import { ref, set, push, onValue, remove, update } from 'firebase/database';

export default function SuperAdminScreen({ navigation }) {
  const [schools, setSchools] = useState([]);
  const [schoolName, setSchoolName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
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

  // إضافة أو تعديل مدرسة
  const handleSaveSchool = async () => {
    if (!schoolName || !adminEmail || !adminPassword) {
      Alert.alert('خطأ', 'يرجى تعبئة جميع الحقول');
      return;
    }

    setLoading(true);
    try {
      if (editingSchoolId) {
        // وضع التعديل
        const schoolRef = ref(db, `schools/${editingSchoolId}`);
        await update(schoolRef, {
          name: schoolName,
          email: adminEmail,
          password: adminPassword,
        });
        Alert.alert('نجاح', 'تم تحديث بيانات المدرسة بنجاح');
        setEditingSchoolId(null);
      } else {
        // وضع الإضافة الجديدة
        const newSchoolRef = push(ref(db, 'schools'));
        await set(newSchoolRef, {
          name: schoolName,
          email: adminEmail,
          password: adminPassword,
          role: 'school',
        });
        Alert.alert('نجاح', 'تم إضافة المدرسة بنجاح');
      }
      setSchoolName('');
      setAdminEmail('');
      setAdminPassword('');
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء حفظ البيانات: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // تجهيز البيانات للتعديل
  const handleEditPress = (school) => {
    setEditingSchoolId(school.id);
    setSchoolName(school.name);
    setAdminEmail(school.email);
    setAdminPassword(school.password);
  };

  // إلغاء وضع التعديل
  const handleCancelEdit = () => {
    setEditingSchoolId(null);
    setSchoolName('');
    setAdminEmail('');
    setAdminPassword('');
  };

  // حذف مدرسة بعد التأكيد
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

  // دالة تسجيل الخروج المتوافقة مع الحاوية الجديدة
  const handleLogout = () => {
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>لوحة المدير العام (Super Admin)</Text>

      {/* نموذج الإدخال والتعديل */}
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
          placeholder="بريد مدير المدرسة الإلكتروني"
          value={adminEmail}
          onChangeText={setAdminEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="كلمة المرور للمدرسة"
          value={adminPassword}
          onChangeText={setAdminPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveSchool} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{editingSchoolId ? 'تحديث البيانات' : 'إضافة'}</Text>
          )}
        </TouchableOpacity>

        {editingSchoolId && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
            <Text style={styles.buttonText}>إلغاء التعديل</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* قائمة المدارس */}
      <Text style={styles.subtitle}>المدارس المسجلة حالياً:</Text>
      <FlatList
        data={schools}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.schoolCard}>
            <View>
              <Text style={styles.schoolName}>{item.name}</Text>
              <Text style={styles.schoolDetails}>الإيميل: {item.email}</Text>
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
        )}
      />

      {/* زر تسجيل الخروج */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5', paddingTop: 40 },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#333' },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#555' },
  formContainer: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 20, elevation: 3 },
  formTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#444' },
  input: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#ddd', textAlign: 'right' },
  saveButton: { backgroundColor: '#2ecc71', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  cancelButton: { backgroundColor: '#7f8c8d', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  schoolCard: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  schoolName: { fontSize: 16, fontWeight: 'bold', color: '#333', textAlign: 'right' },
  schoolDetails: { fontSize: 14, color: '#666', marginTop: 4, textAlign: 'right' },
  actionButtons: { flexDirection: 'row' },
  editButton: { backgroundColor: '#3498db', padding: 8, borderRadius: 5, marginRight: 5 },
  deleteButton: { backgroundColor: '#e74c3c', padding: 8, borderRadius: 5 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  logoutButton: { backgroundColor: '#c0392b', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 10 },
  logoutButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});