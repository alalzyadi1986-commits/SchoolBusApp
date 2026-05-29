import React, { useState, useEffect, useRef } from 'react';

import ParentMap from '../components/ParentMap';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking,
  StatusBar,
} from 'react-native';

import * as Location from 'expo-location';

import {
  useRoute,
  useNavigation,
} from '@react-navigation/native';

import {
  ref,
  onValue,
  update,
  push,
  set,
} from 'firebase/database';

import { db } from '../../../firebaseConfig';

import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateDistance } from '../../../utils/geo';

import { clearUserSession } from '../../../services/sessionService';

import {
  subscribeToParentStudent,
} from '../services/parentStudentService';

import {
  subscribeToDriverInfo,
  subscribeToStaffInfo,
  subscribeToBusLocation,
} from '../services/parentBusService';

const { width } = Dimensions.get('window');

export default function ParentScreen() {

  const route = useRoute();

  const navigation = useNavigation();

  const { schoolId, user } =
    route.params || {};

  const [busLocation, setBusLocation] =
    useState(null);

  const [
    animatedBusLocation,
    setAnimatedBusLocation,
  ] = useState(null);

  const [myLocation, setMyLocation] =
    useState(null);

  const animationFrame =
    useRef(null);

  const [alertMinutes, setAlertMinutes] =
    useState(2);

  const [notified, setNotified] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [studentInfo, setStudentInfo] =
    useState(null);

  const [driverInfo, setDriverInfo] =
    useState(null);

  const [staffInfo, setStaffInfo] =
    useState(null);

  const [schoolLoc, setSchoolLoc] =
    useState(null);

  useEffect(() => {

    if (!schoolId || !user?.username) {

      setLoading(false);

      return;

    }

    const unsubStudent =
      subscribeToParentStudent(

        schoolId,

        user.username,

        setStudentInfo,

        () => setLoading(false)

      );

    const unsubSchool = onValue(

      ref(
        db,
        `schools/${schoolId}`
      ),

      (snap) => {

        const data = snap.val();

        if (
          data?.latitude &&
          data?.longitude
        ) {

          setSchoolLoc({

            latitude:
              parseFloat(
                data.latitude
              ),

            longitude:
              parseFloat(
                data.longitude
              ),

          });

        }

      }

    );

    (async () => {

      try {

        const { status } =
          await Location
            .requestForegroundPermissionsAsync();

        if (status === 'granted') {

          const loc =
            await Location
              .getCurrentPositionAsync({});

          setMyLocation({

            latitude:
              loc.coords.latitude,

            longitude:
              loc.coords.longitude,

          });

        }

      } catch (e) {

        console.log(
          'Location permission error:',
          e
        );

      }

    })();

    return () => {

      unsubStudent();

      unsubSchool();

    };

  }, [schoolId, user?.username]);

  useEffect(() => {

    const driverId =
      studentInfo?.driverUsername ||
      studentInfo?.driver_id;

    if (!schoolId || !driverId)
      return;

    const unsubDriver =
      subscribeToDriverInfo(

        schoolId,

        driverId,

        setDriverInfo

      );

    const unsubStaff =
      subscribeToStaffInfo(

        schoolId,

        driverId,

        setStaffInfo

      );

    const unsubBus =
      subscribeToBusLocation(

        schoolId,

        driverId,

        (newLoc) => {

          if (!newLoc) {

            setBusLocation(null);

            setAnimatedBusLocation(null);

            return;

          }

          if (!busLocation) {

            setBusLocation(
              newLoc
            );

            setAnimatedBusLocation(
              newLoc
            );

          } else {

            animateBus(

              animatedBusLocation ||
                busLocation,

              newLoc

            );

            setBusLocation(
              newLoc
            );

          }

          if (myLocation) {

            const dist =
              calculateDistance(

                newLoc.latitude,
                newLoc.longitude,

                myLocation.latitude,
                myLocation.longitude

              );

            const alertThreshold =
              alertMinutes * 0.5;

            if (

              dist <
                alertThreshold &&
              !notified &&
              studentInfo?.status !==
                'absent_today'

            ) {

              Alert.alert(

                '🔔 تنبيه وصول الباص 🚌',

                `الباص على بعد حوالي ${dist.toFixed(
                  1
                )} كم من موقعك وسيقوم بالوصول قريباً.`

              );

              setNotified(true);

            } else if (

              dist >
              alertThreshold + 0.5

            ) {

              setNotified(false);

            }

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

  const animateBus = (
    start,
    end
  ) => {

    let startTime = null;

    const duration = 10000;

    const step = (
      timestamp
    ) => {

      if (!startTime)
        startTime = timestamp;

      const progress =
        Math.min(

          (
            timestamp -
            startTime
          ) / duration,

          1

        );

      const currentLat =

        start.latitude +

        (
          end.latitude -
          start.latitude
        ) *
          progress;

      const currentLon =

        start.longitude +

        (
          end.longitude -
          start.longitude
        ) *
          progress;

      setAnimatedBusLocation({

        latitude: currentLat,

        longitude: currentLon,

      });

      if (progress < 1) {

        animationFrame.current =
          requestAnimationFrame(
            step
          );

      }

    };

    if (animationFrame.current) {

      cancelAnimationFrame(
        animationFrame.current
      );

    }

    animationFrame.current =
      requestAnimationFrame(
        step
      );

  };

  const handleLogout = async () => {

    Alert.alert(

      'تسجيل الخروج',

      'هل أنت متأكد؟',

      [

        {
          text: 'إلغاء',
          style: 'cancel',
        },

        {

          text: 'خروج',

          onPress: async () => {

            await clearUserSession();

            navigation.replace(
              'Login'
            );

          },

        },

      ]

    );

  };

  const reportAbsence = () => {

    if (!studentInfo) return;

    const isAbsent =
      studentInfo.status ===
      'absent_today';

    Alert.alert(

      isAbsent
        ? 'إلغاء الغياب'
        : 'إبلاغ عن غياب',

      isAbsent
        ? 'هل تريد إلغاء الغياب؟'
        : 'هل تريد إبلاغ السائق بغياب الطالب اليوم؟',

      [

        {
          text: 'إلغاء',
          style: 'cancel',
        },

        {

          text: 'تأكيد',

          onPress: async () => {

            const newStatus =
              isAbsent
                ? 'pending'
                : 'absent_today';

            await update(

              ref(

                db,

                `schools/${schoolId}/students/${studentInfo.id}`

              ),

              {

                status:
                  newStatus,

                lastUpdate:
                  new Date()
                    .toISOString(),

              }

            );

            const reportRef =
              ref(

                db,

                `schools/${schoolId}/reports`

              );

            await set(

              push(reportRef),

              {

                type:
                  'absence',

                timestamp:
                  new Date()
                    .toISOString(),

                studentId:
                  studentInfo.id,

                studentName:
                  studentInfo.name,

                parentUsername:
                  user.username,

                action:
                  isAbsent
                    ? 'cancelled'
                    : 'reported',

              }

            );

            Alert.alert(
              'تم إبلاغ المدرسة والسائق بنجاح'
            );

          },

        },

      ]

    );

  };

  const makeCall = (
    phone
  ) => {

    if (phone)

      Linking.openURL(
        `tel:${phone}`
      );

    else

      Alert.alert(
        'خطأ',
        'رقم الهاتف غير متوفر'
      );

  };

  if (loading) {

    return (

      <View style={styles.centered}>

        <ActivityIndicator
          size="large"
          color="#3B82F6"
        />

        <Text
          style={{
            marginTop: 10,
            color: '#64748B',
          }}
        >

          جاري تحميل البيانات...

        </Text>

      </View>

    );

  }

  return (

    <SafeAreaView
      style={styles.container}
    >

      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFF"
      />

      <View style={styles.header}>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
        >

          <Text style={styles.logoutText}>
            خروج
          </Text>

        </TouchableOpacity>

        <View
          style={{
            alignItems: 'flex-end',
          }}
        >

          <Text style={styles.title}>
            لوحة الأهل 🚌
          </Text>

          <Text
            style={styles.parentName}
          >

            عائلة{' '}
            {user?.name ||
              'المحترم'}

          </Text>

        </View>

      </View>

      <View style={styles.infoCard}>

        <View
          style={styles.studentHeader}
        >

          <TouchableOpacity

            style={[

              styles.absenceBtn,

              studentInfo?.status ===
                'absent_today' &&

                styles
                  .absenceBtnActive,

            ]}

            onPress={
              reportAbsence
            }
          >

            <Text

              style={[

                styles
                  .absenceBtnText,

                studentInfo?.status ===
                  'absent_today' &&

                  styles
                    .absenceBtnTextActive,

              ]}
            >

              {

                studentInfo?.status ===
                'absent_today'

                  ? 'إلغاء الغياب'

                  : 'إبلاغ عن غياب'

              }

            </Text>

          </TouchableOpacity>

          <View
            style={{
              alignItems:
                'flex-end',
            }}
          >

            <Text
              style={styles.studentName}
            >

              {

                studentInfo?.name ||
                'طالب غير معروف'

              }

            </Text>

            <Text
              style={styles.studentStatus}
            >

              الحالة:

              {

                studentInfo?.status ===
                'absent_today'

                  ? ' غائب اليوم ⭕'

                  : studentInfo?.status ===
                    'present'

                    ? ' داخل الباص ✅'

                    : ' ينتظر الباص ⏳'

              }

            </Text>

          </View>

        </View>

        <View
          style={styles.contactRow}
        >

          {
            driverInfo && (

              <TouchableOpacity

                style={styles.contactBtn}

                onPress={() =>
                  makeCall(
                    driverInfo.phone
                  )
                }
              >

                <Text
                  style={
                    styles.contactBtnText
                  }
                >

                  📞 السائق:{' '}
                  {driverInfo.name}

                </Text>

              </TouchableOpacity>

            )
          }

          {
            staffInfo && (

              <TouchableOpacity

                style={[

                  styles.contactBtn,

                  {
                    backgroundColor:
                      '#10B981',
                  },

                ]}

                onPress={() =>
                  makeCall(
                    staffInfo.phone
                  )
                }
              >

                <Text
                  style={
                    styles.contactBtnText
                  }
                >

                  📞 المرافقة:{' '}
                  {staffInfo.name}

                </Text>

              </TouchableOpacity>

            )
          }

        </View>

      </View>

      <View
        style={styles.settingsCard}
      >

        <Text
          style={styles.settingsTitle}
        >

          تنبيه القرب
          (قبل الوصول بـ):

        </Text>

        <View
          style={styles.optionsRow}
        >

          {
            [1, 2, 5, 10].map(
              (m) => (

                <TouchableOpacity

                  key={m}

                  style={[

                    styles.optBtn,

                    alertMinutes ===
                      m &&

                      styles
                        .optBtnActive,

                  ]}

                  onPress={() => {

                    setAlertMinutes(
                      m
                    );

                    setNotified(
                      false
                    );

                  }}
                >

                  <Text

                    style={[

                      styles.optText,

                      alertMinutes ===
                        m &&

                        styles
                          .optTextActive,

                    ]}
                  >

                    {m} د

                  </Text>

                </TouchableOpacity>

              )
            )
          }

        </View>

      </View>

      <ParentMap
        myLocation={myLocation}
        schoolLoc={schoolLoc}
        animatedBusLocation={
          animatedBusLocation
        }
      />

    </SafeAreaView>

  );

}

const styles =
  StyleSheet.create({

    container: {
      flex: 1,
      backgroundColor:
        '#F8FAFC',
    },

    centered: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
    },

    header: {
      padding: 15,
      backgroundColor:
        '#FFF',
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor:
        '#E2E8F0',
    },

    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#1E293B',
    },

    parentName: {
      fontSize: 14,
      color: '#64748B',
      marginTop: 3,
    },

    logoutBtn: {
      paddingHorizontal: 15,
      paddingVertical: 8,
      backgroundColor:
        '#FEE2E2',
      borderRadius: 10,
    },

    logoutText: {
      color: '#EF4444',
      fontWeight: 'bold',
    },

    infoCard: {
      margin: 15,
      padding: 15,
      backgroundColor:
        '#FFF',
      borderRadius: 15,
      elevation: 3,
    },

    studentHeader: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },

    studentName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#1E293B',
    },

    studentStatus: {
      fontSize: 14,
      color: '#64748B',
      marginTop: 4,
    },

    absenceBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor:
        '#EF4444',
    },

    absenceBtnActive: {
      backgroundColor:
        '#EF4444',
    },

    absenceBtnText: {
      color: '#EF4444',
      fontWeight: 'bold',
      fontSize: 12,
    },

    absenceBtnTextActive: {
      color: '#FFF',
    },

    contactRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      marginTop: 10,
    },

    contactBtn: {
      flex: 0.48,
      backgroundColor:
        '#3B82F6',
      padding: 10,
      borderRadius: 10,
      alignItems: 'center',
    },

    contactBtnText: {
      color: '#FFF',
      fontSize: 12,
      fontWeight: 'bold',
    },

    settingsCard: {
      marginHorizontal: 15,
      marginBottom: 15,
      padding: 15,
      backgroundColor:
        '#FFF',
      borderRadius: 15,
      elevation: 2,
    },

    settingsTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#1E293B',
      marginBottom: 10,
      textAlign: 'right',
    },

    optionsRow: {
      flexDirection: 'row',
      justifyContent:
        'space-around',
    },

    optBtn: {
      paddingHorizontal: 15,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor:
        '#F1F5F9',
    },

    optBtnActive: {
      backgroundColor:
        '#3B82F6',
    },

    optText: {
      color: '#64748B',
      fontWeight: 'bold',
    },

    optTextActive: {
      color: '#FFF',
    },

  });