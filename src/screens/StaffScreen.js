import React, { useState, useEffect } from 'react';
<<<<<<< HEAD
import { StyleSheet, Text, View, TouchableOpacity, FlatList, Alert } from 'react-native';
import { ref, onValue, update } from "firebase/database";
import { db } from '../firebaseConfig';

export default function StaffScreen({ onBack, user, schoolId }) {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    // جلب طلاب المدرسة فقط باستخدام schoolId
    const studentsRef = ref(db, `schools/${schoolId}/students`);
    return onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setStudents(list);
      } else { setStudents([]); }
    });
  }, [schoolId]);

  const toggleStatus = (id, currentStatus) => {
    const newStatus = currentStatus === 'present' ? 'absent' : 'present';
    update(ref(db, `schools/${schoolId}/students/${id}`), { status: newStatus });
  };

  // الطلاب المجازون (غائبون)
  const absentStudents = students.filter(s => s.status === 'absent');
  // الطلاب الحاضرون
  const presentStudents = students.filter(s => s.status !== 'absent');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>لوحة المرافق 📋</Text>
      <Text style={styles.subTitle}>👤 {user?.name}</Text>

      {/* إحصائيات سريعة */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: '#2ecc71' }]}>
          <Text style={styles.statNum}>{presentStudents.length}</Text>
          <Text style={styles.statLabel}>حاضر</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#e74c3c' }]}>
          <Text style={styles.statNum}>{absentStudents.length}</Text>
          <Text style={styles.statLabel}>مجاز</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#3498db' }]}>
          <Text style={styles.statNum}>{students.length}</Text>
          <Text style={styles.statLabel}>الكل</Text>
        </View>
      </View>

      {/* تنبيه الطلاب المجازين */}
      {absentStudents.length > 0 && (
        <View style={styles.absentAlert}>
          <Text style={styles.absentTitle}>⚠️ طلاب مجازون - لا تذهب إليهم:</Text>
          {absentStudents.map(s => (
            <Text key={s.id} style={styles.absentName}>• {s.name}</Text>
          ))}
        </View>
      )}

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.studentItem,
            item.status === 'absent' && styles.absentItem
          ]}>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{item.name}</Text>
              {item.status === 'absent' && (
                <Text style={styles.absentTag}>مجاز</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => toggleStatus(item.id, item.status)}
              style={[
                styles.statusBtn,
                { backgroundColor: item.status === 'absent' ? '#e74c3c' : '#2ecc71' }
              ]}
            >
              <Text style={styles.statusBtnText}>
                {item.status === 'absent' ? '❌ مجاز' : '✅ حاضر'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.btnText}>خروج 🚪</Text>
      </TouchableOpacity>
    </View>
=======
import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, Alert, Linking } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, onValue, update, push, set } from "firebase/database";
import { db } from '../firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StaffScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { schoolId, user } = route.params || {};

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    const studentsRef = ref(db, `schools/${schoolId}/students`);
    const unsubscribe = onValue(studentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(s => (!user.driver_id || s.driver_id === user.driver_id) && s.status !== 'absent_today');
        setStudents(list);
      } else { setStudents([]); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [schoolId, user]);

  const toggleStatus = async (student, currentStatus) => {
    if (user?.permissions && !user.permissions.markAttendance) {
      Alert.alert('صلاحية مرفوضة', 'ليس لديك صلاحية تسجيل الحضور');
      return;
    }
    const newStatus = currentStatus === 'present' ? 'pending' : 'present';
    await update(ref(db, `schools/${schoolId}/students/${student.id}`), { status: newStatus });
    
    // إضافة سجل للتقرير
    if (newStatus === 'present') {
      const reportRef = ref(db, `schools/${schoolId}/reports`);
      const newReport = push(reportRef);
      await set(newReport, {
        type: 'attendance',
        timestamp: new Date().toISOString(),
        message: `المرافقة ${user.name} قامت بتحضير الطالب ${student.name} في الباص.`,
        studentId: student.id,
        staffId: user.username
      });
    }
  };

  const callParent = async (parentUsername) => {
    const parentRef = ref(db, `schools/${schoolId}/parents/${parentUsername}`);
    onValue(parentRef, (snap) => {
      const p = snap.val();
      if (p?.phone) Linking.openURL(`tel:${p.phone}`);
      else Alert.alert('خطأ', 'رقم ولي الأمر غير متوفر');
    }, { onlyOnce: true });
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}><Text style={styles.logoutText}>خروج</Text></TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.title}>لوحة المرافقة 📝</Text>
          <Text style={styles.staffName}>{user?.name}</Text>
        </View>
      </View>

      <FlatList
        data={students}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => (
          <View style={styles.studentCard}>
            <TouchableOpacity style={styles.callBtn} onPress={() => callParent(item.parent_username)}><Text style={styles.callBtnText}>📞 اتصل</Text></TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statusToggle, { backgroundColor: item.status === 'present' ? '#10B981' : '#F1F5F9' }]}
              onPress={() => toggleStatus(item, item.status)}
            >
              <Text style={[styles.statusToggleText, { color: item.status === 'present' ? '#FFF' : '#64748B' }]}>
                {item.status === 'present' ? 'تم الركوب ✓' : 'تحضير'}
              </Text>
            </TouchableOpacity>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{item.name}</Text>
              <Text style={styles.studentSub}>{item.class} - {item.section}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>لا يوجد طلاب للتحضير حالياً (أو الجميع غائبون)</Text>}
      />
    </SafeAreaView>
>>>>>>> 26cefefa39de4b8031862128921805f50f269406
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#f0f2f5' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 3, textAlign: 'center', color: '#2c3e50' },
  subTitle: { fontSize: 13, color: '#7f8c8d', textAlign: 'center', marginBottom: 15 },
  statsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 },
  statBox: { flex: 1, marginHorizontal: 5, padding: 12, borderRadius: 12, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: '#fff' },
  absentAlert: { backgroundColor: '#ffeaa7', padding: 12, borderRadius: 10, marginBottom: 15, borderRightWidth: 4, borderRightColor: '#e74c3c' },
  absentTitle: { fontSize: 14, fontWeight: 'bold', color: '#e74c3c', textAlign: 'right', marginBottom: 5 },
  absentName: { fontSize: 13, color: '#c0392b', textAlign: 'right' },
  studentItem: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, elevation: 2 },
  absentItem: { opacity: 0.6, borderRightWidth: 4, borderRightColor: '#e74c3c' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  absentTag: { fontSize: 11, color: '#e74c3c', textAlign: 'right' },
  statusBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
  statusBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  backBtn: { backgroundColor: '#2c3e50', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
=======
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 15, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  staffName: { fontSize: 14, color: '#64748B' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  studentCard: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 1 },
  studentInfo: { alignItems: 'flex-end', flex: 1, marginRight: 10 },
  studentName: { fontSize: 14, fontWeight: 'bold' },
  studentSub: { fontSize: 11, color: '#64748B' },
  statusToggle: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, minWidth: 80, alignItems: 'center', marginRight: 10 },
  statusToggleText: { fontSize: 11, fontWeight: 'bold' },
  callBtn: { backgroundColor: '#3B82F6', padding: 8, borderRadius: 8 },
  callBtnText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#64748B', marginTop: 50 }
});
>>>>>>> 26cefefa39de4b8031862128921805f50f269406
