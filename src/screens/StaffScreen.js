import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, onValue, update, push } from "firebase/database";
import { db } from '../firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StaffScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { schoolId, user } = route.params || {};

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState(user?.permissions || {});

  useEffect(() => {
    if (!schoolId) return;

    // جلب الطلاب المرتبطين بالسائق الذي تعمل معه المرافقة
    const studentsRef = ref(db, `schools/${schoolId}/students`);
    const unsubscribe = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(s => !user.driver_id || s.driver_id === user.driver_id);
        setStudents(list);
      } else {
        setStudents([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId, user]);

  const toggleStatus = async (studentId, currentStatus) => {
    if (!permissions.markAttendance) {
      Alert.alert('صلاحية مرفوضة', 'ليس لديك صلاحية تسجيل الحضور');
      return;
    }

    const newStatus = currentStatus === 'present' ? 'absent' : 'present';
    try {
      await update(ref(db, `schools/${schoolId}/students/${studentId}`), {
        status: newStatus,
        lastUpdate: new Date().toISOString(),
        updatedBy: user.username
      });
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحديث حالة الطالب');
    }
  };

  const handleLogout = () => {
    navigation.replace('Login');
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;
  }

  const presentCount = students.filter(s => s.status === 'present').length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.title}>لوحة المرافقة 📝</Text>
          <Text style={styles.staffName}>{user?.name}</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{students.length}</Text>
          <Text style={styles.statLab}>الإجمالي</Text>
        </View>
        <View style={[styles.statItem, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E2E8F0' }]}>
          <Text style={[styles.statVal, { color: '#10B981' }]}>{presentCount}</Text>
          <Text style={styles.statLab}>صعدوا</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statVal, { color: '#EF4444' }]}>{students.length - presentCount}</Text>
          <Text style={styles.statLab}>لم يصعدوا</Text>
        </View>
      </View>

      {permissions.addStudentsAndLocation && (
        <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert('قريباً', 'سيتم تفعيل ميزة إضافة المواقع في التحديث القادم')}>
          <Text style={styles.actionBtnText}>➕ إضافة طالب / موقع منزل</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={students}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => (
          <View style={styles.studentCard}>
            <TouchableOpacity 
              style={[styles.statusToggle, { backgroundColor: item.status === 'present' ? '#10B981' : '#F1F5F9' }]}
              onPress={() => toggleStatus(item.id, item.status)}
            >
              <Text style={[styles.statusToggleText, { color: item.status === 'present' ? '#FFF' : '#64748B' }]}>
                {item.status === 'present' ? 'تم الركوب ✓' : 'لم يركب'}
              </Text>
            </TouchableOpacity>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{item.name}</Text>
              <Text style={styles.studentSub}>{item.class} - {item.section}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>لا يوجد طلاب مرتبطين برحلتك حالياً</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  staffName: { fontSize: 14, color: '#64748B' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  summaryCard: { margin: 15, backgroundColor: '#FFF', borderRadius: 15, flexDirection: 'row', padding: 15, elevation: 2 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  statLab: { fontSize: 11, color: '#64748B', marginTop: 2 },
  actionBtn: { marginHorizontal: 15, marginBottom: 10, backgroundColor: '#3B82F6', padding: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  studentCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 1 },
  studentInfo: { alignItems: 'flex-end' },
  studentName: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  studentSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  statusToggle: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, minWidth: 100, alignItems: 'center' },
  statusToggleText: { fontSize: 12, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#64748B', marginTop: 50 }
});
