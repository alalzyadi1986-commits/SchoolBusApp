import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';

import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, onValue, update, push, set } from "firebase/database";
import { db } from '../firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clearUserSession } from '../services/sessionService';

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

    onValue(studentsRef, (snapshot) => {

      const data = snapshot.val();

      if (data) {

        const driverId = user?.driverUsername || user?.driver_id;

        const list = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key]
          }))
          .filter(student => {

            const studentDriverId =
              student.driverUsername || student.driver_id;

            return (
              (!driverId || studentDriverId === driverId) &&
              student.status !== 'absent_today'
            );
          });

        setStudents(list);

      } else {

        setStudents([]);

      }

      setLoading(false);

    });

    return () => {};

  }, [schoolId]);

  const toggleStatus = async (student, currentStatus) => {

    if (
      user?.permissions &&
      user.permissions.markAttendance === false
    ) {
      Alert.alert(
        'صلاحية مرفوضة',
        'ليس لديك صلاحية تسجيل الحضور'
      );
      return;
    }

    try {

      const newStatus =
        currentStatus === 'present'
          ? 'pending'
          : 'present';

      await update(
        ref(db, `schools/${schoolId}/students/${student.id}`),
        {
          status: newStatus
        }
      );

      if (newStatus === 'present') {

        const reportRef = ref(
          db,
          `schools/${schoolId}/reports`
        );

        const newReport = push(reportRef);

        await set(newReport, {
          type: 'attendance',
          timestamp: new Date().toISOString(),
          message: `المرافقة ${user.name} قامت بتحضير الطالب ${student.name} في الباص.`,
          studentId: student.id,
          staffId: user.username
        });

      }

    } catch (error) {

      Alert.alert(
        'خطأ',
        'حدث خطأ أثناء تحديث حالة الطالب'
      );

      console.log(error);

    }

  };

  const callParent = async (parentUsername) => {

    if (!parentUsername) {
      Alert.alert(
        'خطأ',
        'رقم ولي الأمر غير متوفر'
      );
      return;
    }

    try {

      const parentRef = ref(
        db,
        `schools/${schoolId}/parents/${parentUsername}`
      );

      onValue(
        parentRef,
        (snap) => {

          const parentData = snap.val();

          if (parentData?.phone) {

            Linking.openURL(`tel:${parentData.phone}`);

          } else {

            Alert.alert(
              'خطأ',
              'رقم ولي الأمر غير متوفر'
            );

          }

        },
        {
          onlyOnce: true
        }
      );

    } catch (error) {

      Alert.alert(
        'خطأ',
        'فشل الاتصال بولي الأمر'
      );

      console.log(error);

    }

  };

  const handleLogout = () => {

    Alert.alert(
      "تسجيل الخروج",
      "هل أنت متأكد؟",
      [
        {
          text: "إلغاء",
          style: "cancel"
        },
        {
          text: "خروج",
          style: "destructive",

          onPress: async () => {

            try {

              await clearUserSession();

              navigation.reset({
                index: 0,
                routes: [
                  {
                    name: 'Login'
                  }
                ]
              });

            } catch (error) {

              console.log(error);

              Alert.alert(
                'خطأ',
                'فشل تسجيل الخروج'
              );

            }

          }
        }
      ]
    );

  };

  if (loading) {

    return (
      <View style={styles.centered}>
        <ActivityIndicator
          size="large"
          color="#3B82F6"
        />
      </View>
    );

  }

  return (

    <SafeAreaView style={styles.container}>

      <View style={styles.header}>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>
            خروج
          </Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'flex-end' }}>

          <Text style={styles.title}>
            لوحة المرافقة 📝
          </Text>

          <Text style={styles.staffName}>
            {user?.name}
          </Text>

        </View>

      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 15
        }}

        renderItem={({ item }) => (

          <View style={styles.studentCard}>

            <TouchableOpacity
              style={styles.callBtn}
              onPress={() =>
                callParent(
                  item.parentUsername ||
                  item.parent_username
                )
              }
            >
              <Text style={styles.callBtnText}>
                📞 اتصل
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusToggle,
                {
                  backgroundColor:
                    item.status === 'present'
                      ? '#10B981'
                      : '#F1F5F9'
                }
              ]}

              onPress={() =>
                toggleStatus(item, item.status)
              }
            >

              <Text
                style={[
                  styles.statusToggleText,
                  {
                    color:
                      item.status === 'present'
                        ? '#FFF'
                        : '#64748B'
                  }
                ]}
              >

                {
                  item.status === 'present'
                    ? 'تم الركوب ✓'
                    : 'تحضير'
                }

              </Text>

            </TouchableOpacity>

            <View style={styles.studentInfo}>

              <Text style={styles.studentName}>
                {item.name}
              </Text>

              <Text style={styles.studentSub}>
                {item.class} - {item.section}
              </Text>

            </View>

          </View>

        )}

        ListEmptyComponent={
          <Text style={styles.emptyText}>
            لا يوجد طلاب للتحضير حالياً
          </Text>
        }

      />

    </SafeAreaView>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  header: {
    padding: 15,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },

  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B'
  },

  staffName: {
    fontSize: 14,
    color: '#64748B'
  },

  logoutBtn: {
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8
  },

  logoutText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 12
  },

  studentCard: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 1
  },

  studentInfo: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 10
  },

  studentName: {
    fontSize: 14,
    fontWeight: 'bold'
  },

  studentSub: {
    fontSize: 11,
    color: '#64748B'
  },

  statusToggle: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
    marginRight: 10
  },

  statusToggleText: {
    fontSize: 11,
    fontWeight: 'bold'
  },

  callBtn: {
    backgroundColor: '#3B82F6',
    padding: 8,
    borderRadius: 8
  },

  callBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold'
  },

  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    marginTop: 50
  }

});