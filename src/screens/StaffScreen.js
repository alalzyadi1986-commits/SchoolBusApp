import React, { useState, useEffect } from 'react';
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
  );
}

const styles = StyleSheet.create({
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