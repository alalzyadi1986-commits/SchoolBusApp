import React, { useState, useEffect, useRef } from 'react';

import {
  requestLocationPermission,
  getCurrentLocation,
} from '../services/locationService';

import { updateBusLocation } from '../services/busService';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';

import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation } from '@react-navigation/native';

import {
  ref,
  onValue,
  update,
  push,
  set,
  get,
} from 'firebase/database';

import { db } from '../firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const LOCATION_TASK_NAME = 'background-location-task';

export default function DriverScreen() {

  const route = useRoute();
  const navigation = useNavigation();

  const { schoolId, user } = route.params || {};

  const [currentLoc, setCurrentLoc] = useState(null);
  const [students, setStudents] = useState([]);
  const [isTripActive, setIsTripActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [schoolLoc, setSchoolLoc] = useState(null);

  const stopTimers = useRef({});

  useEffect(() => {

    if (!schoolId || !user?.username) {
      return;
    }

    AsyncStorage.setItem(
      'background_session',
      JSON.stringify({
        schoolId,
        user,
      })
    );

    const studentsRef = ref(
      db,
      `schools/${schoolId}/students`
    );

    const unsubscribeStudents = onValue(
      studentsRef,
      (snapshot) => {

        const data = snapshot.val();

        if (data) {

          const list = Object.keys(data)
            .map((key) => ({
              id: key,
              ...data[key],
            }))
            .filter(
              (s) =>
                s.driverUsername === user.username &&
                s.status !== 'absent_today'
            );

          setStudents(list);

        } else {

          setStudents([]);
        }

        setLoading(false);
      }
    );

    (async () => {

      try {

        await requestLocationPermission();

        await Location.requestBackgroundPermissionsAsync();

        const loc = await getCurrentLocation();

        setCurrentLoc(loc);

        const hasStarted =
          await Location.hasStartedLocationUpdatesAsync(
            LOCATION_TASK_NAME
          );

        setIsTripActive(hasStarted);

      } catch (error) {

        console.log(error);
      }

    })();

    const schoolRef = ref(
      db,
      `schools/${schoolId}`
    );

    const unsubscribeSchool = onValue(
      schoolRef,
      (snap) => {

        const data = snap.val();

        if (data?.latitude && data?.longitude) {

          setSchoolLoc({
            latitude: data.latitude,
            longitude: data.longitude,
          });
        }
      }
    );

    return () => {

      unsubscribeStudents();
      unsubscribeSchool();
    };

  }, [schoolId, user]);

  const startTrip = async () => {

    try {

      if (
        user?.permissions &&
        user.permissions.canTrackLocation === false
      ) {

        Alert.alert(
          'صلاحية مرفوضة',
          'ليس لديك صلاحية بدء الرحلة'
        );

        return;
      }

      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {

        Alert.alert(
          'خطأ',
          'يجب السماح بالوصول للموقع'
        );

        return;
      }

      const { status: backgroundStatus } =
        await Location.requestBackgroundPermissionsAsync();

      if (backgroundStatus !== 'granted') {

        Alert.alert(
          'تنبيه',
          'يرجى اختيار السماح دائماً للموقع'
        );
      }

      await Location.startLocationUpdatesAsync(
        LOCATION_TASK_NAME,
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 10000,

          foregroundService: {
            notificationTitle: 'تطبيق الباص يعمل',
            notificationBody:
              'يتم تتبع الباص حالياً',
            notificationColor: '#3B82F6',
          },
        }
      );

      setIsTripActive(true);

      Alert.alert(
        'تم البدء',
        'بدأت الرحلة بنجاح'
      );

    } catch (err) {

      console.log(err);

      Alert.alert(
        'خطأ',
        'فشل في بدء الرحلة'
      );
    }
  };

  const stopTracking = async () => {

    try {

      const hasStarted =
        await Location.hasStartedLocationUpdatesAsync(
          LOCATION_TASK_NAME
        );

      if (hasStarted) {

        await Location.stopLocationUpdatesAsync(
          LOCATION_TASK_NAME
        );
      }

      if (schoolId && user?.username) {

        let closeLocation = 'Unknown';

        let distToSchool = 'N/A';

        try {

          const loc =
            await Location.getCurrentPositionAsync({});

          closeLocation =
            `${loc.coords.latitude},${loc.coords.longitude}`;

        } catch (e) {}

        await update(
          ref(
            db,
            `schools/${schoolId}/bus/${user.username}`
          ),
          {
            isActive: false,
            updatedAt: new Date().toISOString(),
            terminationType: 'manual',
            terminationDistance: distToSchool,
            terminationCoords: closeLocation,
          }
        );
      }

      setIsTripActive(false);
      setCurrentSpeed(0);

      Alert.alert(
        'تم الإنهاء',
        'تم إيقاف الرحلة'
      );

    } catch (err) {

      console.log(err);
    }
  };

  const sendEmergency = () => {

    Alert.alert(
      '⚠️ تأكيد',
      'هل تريد إرسال بلاغ طوارئ؟',
      [
        {
          text: 'إلغاء',
          style: 'cancel',
        },

        {
          text: 'إرسال',
          style: 'destructive',

          onPress: async () => {

            try {

              const emergencyRef = push(
                ref(
                  db,
                  `schools/${schoolId}/emergencies`
                )
              );

              await set(emergencyRef, {
                senderName: user.name,
                senderId: user.username,
                role: 'driver',
                message:
                  'السائق يطلب المساعدة',
                latitude:
                  currentLoc?.latitude || 0,
                longitude:
                  currentLoc?.longitude || 0,
                timestamp:
                  new Date().toISOString(),
                status: 'active',
              });

              Alert.alert(
                'تم الإرسال',
                'تم إرسال البلاغ'
              );

            } catch (err) {

              console.log(err);
            }
          },
        },
      ]
    );
  };

  const callParent = async (
    parentUsername
  ) => {

    try {

      const parentRef = ref(
        db,
        `schools/${schoolId}/parents/${parentUsername}`
      );

      const snap = await get(parentRef);

      const p = snap.val();

      if (p?.phone) {

        Linking.openURL(`tel:${p.phone}`);

      } else {

        Alert.alert(
          'خطأ',
          'رقم ولي الأمر غير متوفر'
        );
      }

    } catch (err) {

      console.log(err);
    }
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
          onPress={() => {

            stopTracking();

            navigation.replace('Login');
          }}
        >
          <Text style={styles.logoutText}>
            خروج
          </Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'flex-end' }}>

          <Text style={styles.title}>
            لوحة السائق 🚌
          </Text>

          <Text style={styles.driverName}>
            {user?.name} | باص {user?.busNumber}
          </Text>

        </View>

      </View>

      <View style={styles.speedCard}>
        <View style={styles.speedInfo}>
          <Text style={styles.speedValue}>
            {currentSpeed}
          </Text>

          <Text style={styles.speedUnit}>
            كم/س
          </Text>
        </View>

        <View style={styles.speedLimit}>
          <Text style={styles.limitText}>
            السرعة المحددة:
            {' '}
            {user?.maxSpeed || 80}
          </Text>

          {currentSpeed >
            (user?.maxSpeed || 80) && (
            <Text style={styles.speedWarning}>
              ⚠️ تجاوز السرعة!
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

TaskManager.defineTask(
  LOCATION_TASK_NAME,

  async ({ data, error }) => {

    if (error) {

      console.error(
        'Background Task Error:',
        error
      );

      return;
    }

    if (data) {

      const { locations } = data;

      const location = locations[0];

      if (location) {

        try {

          const sessionStr =
            await AsyncStorage.getItem(
              'background_session'
            );

          if (sessionStr) {

            const {
              schoolId,
              user,
            } = JSON.parse(sessionStr);

            const {
              latitude,
              longitude,
              speed,
            } = location.coords;

            const speedKmH = Math.max(
              0,
              Math.round((speed || 0) * 3.6)
            );

            await updateBusLocation(
              schoolId,
              user.username,
              latitude,
              longitude,
              speedKmH
            );
          }

        } catch (err) {

          console.error(
            'Error updating background location:',
            err
          );
        }
      }
    }
  }
);

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
});