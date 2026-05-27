import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';

import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ref, onValue, update, push, set } from 'firebase/database';
import { db } from '../firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function ParentScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { schoolId, user } = route.params || {};

  const [busLocation, setBusLocation] = useState(null);
  const [animatedBusLocation, setAnimatedBusLocation] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const animationFrame = useRef(null);

  const [alertMinutes, setAlertMinutes] = useState(2);
  const [notified, setNotified] = useState(false);
  const [loading, setLoading] = useState(true);

  const [studentInfo, setStudentInfo] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [staffInfo, setStaffInfo] = useState(null);
  const [schoolLoc, setSchoolLoc] = useState(null);

  useEffect(() => {
    if (!schoolId || !user?.username) {
      setLoading(false);
      return;
    }

    // بيانات الطالب
    const unsubStudent = onValue(
      ref(db, `schools/${schoolId}/students`),
      (snapshot) => {
        const data = snapshot.val();

        if (data) {
          const myStudentKey = Object.keys(data).find(
            (key) =>
              data[key].parentUsername === user.username ||
              data[key].parent_username === user.username
          );

          if (myStudentKey) {
            setStudentInfo({
              id: myStudentKey,
              ...data[myStudentKey],
            });
          }
        }

        setLoading(false);
      }
    );

    // موقع المدرسة
    const unsubSchool = onValue(
      ref(db, `schools/${schoolId}`),
      (snap) => {
        const data = snap.val();

        if (data?.latitude && data?.longitude) {
          setSchoolLoc({
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude),
          });
        }
      }
    );

    // صلاحية الموقع
    (async () => {
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});

          setMyLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (e) {
        console.log('Location permission error:', e);
      }
    })();

    return () => {
      unsubStudent();
      unsubSchool();
    };
  }, [schoolId, user?.username]);

  // بيانات السائق والباص
  useEffect(() => {
    const driverId =
      studentInfo?.driverUsername || studentInfo?.driver_id;

    if (!schoolId || !driverId) return;

    const unsubDriver = onValue(
      ref(db, `schools/${schoolId}/drivers/${driverId}`),
      (snap) => {
        setDriverInfo(snap.val());
      }
    );

    const unsubStaff = onValue(
      ref(db, `schools/${schoolId}/staff`),
      (snap) => {
        const staffData = snap.val();

        if (staffData) {
          setStaffInfo(
            Object.values(staffData).find(
              (s) =>
                s.driverUsername === driverId ||
                s.driver_id === driverId
            )
          );
        }
      }
    );

    const unsubBus = onValue(
      ref(db, `schools/${schoolId}/bus/${driverId}`),
      (snap) => {
        const busData = snap.val();

        if (
          busData &&
          busData.isActive &&
          busData.latitude &&
          busData.longitude
        ) {
          const newLoc = {
            latitude: parseFloat(busData.latitude),
            longitude: parseFloat(busData.longitude),
          };

          if (
            isNaN(newLoc.latitude) ||
            isNaN(newLoc.longitude)
          ) {
            return;
          }

          if (!busLocation) {
            setBusLocation(newLoc);
            setAnimatedBusLocation(newLoc);
          } else {
            animateBus(busLocation, newLoc);
            setBusLocation(newLoc);
          }

          if (myLocation) {
            const dist = calculateDistance(
              newLoc.latitude,
              newLoc.longitude,
              myLocation.latitude,
              myLocation.longitude
            );

            if (
              dist < alertMinutes * 0.5 &&
              !notified &&
              studentInfo?.status !== 'absent_today'
            ) {
              Alert.alert(
                '🔔 تنبيه هام 🚌',
                `باص ${studentInfo?.name} يقترب من موقعك!`
              );

              setNotified(true);
            }
          }
        } else {
          setBusLocation(null);
          setAnimatedBusLocation(null);
        }
      }
    );

    return () => {
      unsubDriver();
      unsubStaff();
      unsubBus();
    };
  }, [
    schoolId,
    studentInfo,
    myLocation,
    alertMinutes,
    notified,
  ]);

  const reportAbsence = () => {
    if (!studentInfo) return;

    const isAbsent =
      studentInfo.status === 'absent_today';

    Alert.alert(
      isAbsent ? 'إلغاء الغياب' : 'إبلاغ عن غياب',
      isAbsent
        ? 'هل تريد إلغاء الغياب؟'
        : 'هل تريد إبلاغ السائق بغياب الطالب؟',
      [
        {
          text: 'إلغاء',
          style: 'cancel',
        },
        {
          text: 'تأكيد',
          onPress: async () => {
            const newStatus = isAbsent
              ? 'pending'
              : 'absent_today';

            await update(
              ref(
                db,
                `schools/${schoolId}/students/${studentInfo.id}`
              ),
              {
                status: newStatus,
                lastUpdate: new Date().toISOString(),
              }
            );

            const reportRef = ref(
              db,
              `schools/${schoolId}/reports`
            );

            const newReport = push(reportRef);

            await set(newReport, {
              type: 'absence',
              timestamp: new Date().toISOString(),
              studentId: studentInfo.id,
              parentUsername: user.username,
            });

            Alert.alert('تم التحديث بنجاح');
          },
        },
      ]
    );
  };

  const makeCall = (phone) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('رقم الهاتف غير متوفر');
    }
  };

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;

    const dLat =
      ((lat2 - lat1) * Math.PI) / 180;

    const dLon =
      ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    return (
      R *
      (2 *
        Math.atan2(
          Math.sqrt(a),
          Math.sqrt(1 - a)
        ))
    );
  }

  const animateBus = (start, end) => {
    let startTime = null;

    const duration = 10000;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;

      const progress = Math.min(
        (timestamp - startTime) / duration,
        1
      );

      const currentLat =
        start.latitude +
        (end.latitude - start.latitude) *
          progress;

      const currentLon =
        start.longitude +
        (end.longitude - start.longitude) *
          progress;

      setAnimatedBusLocation({
        latitude: currentLat,
        longitude: currentLon,
      });

      if (progress < 1) {
        animationFrame.current =
          requestAnimationFrame(step);
      }
    };

    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }

    animationFrame.current =
      requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

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
          onPress={() =>
            navigation.replace('Login')
          }
        >
          <Text style={styles.logoutText}>
            خروج
          </Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.title}>
            تتبع الباص 🚌
          </Text>

          <Text style={styles.parentName}>
            عائلة {user?.name || user?.family_name}
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.studentHeader}>
          <TouchableOpacity
            style={[
              styles.absenceBtn,
              studentInfo?.status ===
                'absent_today' &&
                styles.absenceBtnActive,
            ]}
            onPress={reportAbsence}
          >
            <Text
              style={[
                styles.absenceBtnText,
                studentInfo?.status ===
                  'absent_today' &&
                  styles.absenceBtnTextActive,
              ]}
            >
              {studentInfo?.status ===
              'absent_today'
                ? 'إلغاء الغياب'
                : 'إبلاغ عن غياب'}
            </Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.studentName}>
              {studentInfo?.name || 'غير مسجل'}
            </Text>

            <Text style={styles.studentStatus}>
              الحالة:
              {studentInfo?.status ===
              'absent_today'
                ? ' غائب اليوم ⭕'
                : studentInfo?.status ===
                  'present'
                ? ' داخل الباص ✅'
                : ' ينتظر الباص ⏳'}
            </Text>
          </View>
        </View>

        <View style={styles.contactRow}>
          {driverInfo && (
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() =>
                makeCall(driverInfo.phone)
              }
            >
              <Text style={styles.contactBtnText}>
                📞 السائق: {driverInfo.name}
              </Text>
            </TouchableOpacity>
          )}

          {staffInfo && (
            <TouchableOpacity
              style={[
                styles.contactBtn,
                { backgroundColor: '#10B981' },
              ]}
              onPress={() =>
                makeCall(staffInfo.phone)
              }
            >
              <Text style={styles.contactBtnText}>
                📞 المرافقة: {staffInfo.name}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>
          وقت التنبيه المفضل:
        </Text>

        <View style={styles.optionsRow}>
          {[1, 2, 5, 10].map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.optBtn,
                alertMinutes === m &&
                  styles.optBtnActive,
              ]}
              onPress={() => {
                setAlertMinutes(m);
                setNotified(false);
              }}
            >
              <Text
                style={[
                  styles.optText,
                  alertMinutes === m &&
                    styles.optTextActive,
                ]}
              >
                {m} د
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude:
            myLocation?.latitude ||
            schoolLoc?.latitude ||
            31.9454,

          longitude:
            myLocation?.longitude ||
            schoolLoc?.longitude ||
            35.9284,

          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
      >
        {myLocation && (
          <Marker
            coordinate={myLocation}
            title="منزلي"
            pinColor="green"
          />
        )}

        {schoolLoc && (
          <Marker
            coordinate={schoolLoc}
            title="المدرسة 🏫"
            pinColor="red"
          />
        )}

        {animatedBusLocation && (
          <Marker
            coordinate={animatedBusLocation}
            title="الباص 🚌"
            pinColor="blue"
          />
        )}
      </MapView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    padding: 15,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },

  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },

  parentName: {
    fontSize: 14,
    color: '#64748B',
  },

  logoutBtn: {
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },

  logoutText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 12,
  },

  infoCard: {
    margin: 15,
    padding: 15,
    backgroundColor: '#FFF',
    borderRadius: 15,
    elevation: 2,
  },

  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },

  studentStatus: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },

  absenceBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },

  absenceBtnActive: {
    backgroundColor: '#EF4444',
  },

  absenceBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
  },

  absenceBtnTextActive: {
    color: '#FFF',
  },

  contactRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },

  contactBtn: {
    backgroundColor: '#3B82F6',
    padding: 8,
    borderRadius: 8,
    flex: 0.48,
    alignItems: 'center',
  },

  contactBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },

  settingsCard: {
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#FFF',
    borderRadius: 15,
    elevation: 2,
  },

  settingsTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'right',
    marginBottom: 10,
  },

  optionsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },

  optBtn: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    minWidth: 60,
    alignItems: 'center',
  },

  optBtnActive: {
    backgroundColor: '#3B82F6',
  },

  optText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: 'bold',
  },

  optTextActive: {
    color: '#FFF',
  },

  map: {
    flex: 1,
  },
});