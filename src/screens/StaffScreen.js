import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, onValue, update } from "firebase/database";
import { db } from '../firebaseConfig';

export default function StaffScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { schoolId, user } = route.params || {};

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const studentsRef = ref(db, `schools/${schoolId}/students`);
    const unsubscribe = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({
          id: key,
          ...data[key],
          status: data[key].status || 'absent' 
        }));
        setStudents(list);
      } else {
        setStudents([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId]);

  const toggleStatus = async (studentId, currentStatus) => {
    const newStatus = currentStatus === 'present' ? 'absent' : 'present';
    try {
      await update(ref(db, `schools/${schoolId}/students/${studentId}`), {
        status: newStatus
      });
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحديث حالة الطالب');
    }
  };

  const handleLogout = () => {
    navigation.replace('Login');
  };

  const presentCount = students.filter(s => s.status === 'present').length;
  const absentCount = students.length - presentCount;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>تحضير الطلاب 📝</Text>
        <Text style={styles.staffName}>المرافق: {user?.name || user?.username}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statBox, { backgroundColor: '#DCFCE7' }]}>
          <Text style={[styles.statNumber, { color: '#166534' }]}>{presentCount}</Text>
          <Text style={styles.statLabel}>حاضر</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#FEE2E2' }]}>
          <Text style={[styles.statNumber, { color: '#991B1B' }]}>{absentCount}</Text>
          <Text style={styles.statLabel}>غائب</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#DBEAFE' }]}>
          <Text style={[styles.statNumber, { color: '#1E40AF' }]}>{students.length}</Text>
          <Text style={styles.statLabel}>الإجمالي</Text>
        </View>
      </View>

      <FlatList
        data={students}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.studentCard}>
            <TouchableOpacity 
              style={[styles.statusBtn, item.status === 'present' ? styles.btnPresent : styles.btnAbsent]}
              onPress={() => toggleStatus(item.id, item.status)}
            >
              <Text style={styles.statusBtnText}>
                {item.status === 'present' ? 'حاضر ✓' : 'غائب ✖'}
              </Text>
            </TouchableOpacity>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{item.name}</Text>
              <Text style={styles.studentClass}>الصف: {item.class}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>لا يوجد طلاب مسجلين في هذه المدرسة حالياً</Text>
        }
      />

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FB', padding: 20, paddingTop: 50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 20, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
  staffName: { fontSize: 16, color: '#64748B', marginTop: 5 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { flex: 1, marginHorizontal: 5, padding: 15, borderRadius: 12, alignItems: 'center', elevation: 1 },
  statNumber: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  listContent: { paddingBottom: 20 },
  studentCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  studentInfo: { flex: 1, alignItems: 'flex-end' },
  studentName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  studentClass: { fontSize: 13, color: '#64748B', marginTop: 2 },
  statusBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, minWidth: 90, alignItems: 'center' },
  btnPresent: { backgroundColor: '#10B981' },
  btnAbsent: { backgroundColor: '#EF4444' },
  statusBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#64748B', marginTop: 50 },
  logoutBtn: { backgroundColor: '#64748B', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  logoutBtnText: { color: '#FFF', fontWeight: 'bold' }
});
