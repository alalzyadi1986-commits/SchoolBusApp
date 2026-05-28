import React, {
  useState,
  useEffect,
  useRef,
} from 'react';

import DriverMap from '../components/DriverMap';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Linking,
  StatusBar,
} from 'react-native';

import * as TaskManager from 'expo-task-manager';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  useRoute,
  useNavigation,
} from '@react-navigation/native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  requestLocationPermission,
  getCurrentLocation,
} from '../../../services/locationService';

import {
  clearUserSession,
} from '../../../services/sessionService';

import {
  subscribeToDriverStudents,
} from '../services/driverStudentService';

import {
  startLiveLocationTracking,
} from '../services/driverLocationService';

import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../services/driverBackgroundService';

import {
  updateBusLocation,
} from '../../../services/busService';

import StudentItem from '../components/StudentItem';

const LOCATION_TASK_NAME =
  'background-location-task';

export default function DriverScreen() {

  const route = useRoute();

  const navigation = useNavigation();

  const { schoolId, user } =
    route.params || {};

  const [currentLoc, setCurrentLoc] =
    useState(null);

  const [students, setStudents] =
    useState([]);

  const [isTripActive, setIsTripActive] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [currentSpeed, setCurrentSpeed] =
    useState(0);

  const mapRef = useRef(null);

  const watchSubscription = useRef(null);

  useEffect(() => {

    if (!schoolId || !user?.username) {

      setLoading(false);

      return;

    }

    initializeScreen();

    return () => {

      if (watchSubscription.current) {

        watchSubscription.current.remove();

      }

    };

  }, []);

  const initializeScreen = async () => {

    try {

      await AsyncStorage.setItem(
        'background_session',
        JSON.stringify({
          schoolId,
          user,
        })
      );

      TaskManager
        .isTaskRegisteredAsync(
          LOCATION_TASK_NAME
        )
        .then(active => {

          setIsTripActive(active);

        });

      subscribeToStudents();

      await setupLocation();

    } catch (error) {

      console.log(error);

    } finally {

      setLoading(false);

    }

  };

  const subscribeToStudents = () => {

    subscribeToDriverStudents(
      schoolId,
      user.username,
      setStudents
    );

  };

  const setupLocation = async () => {

    try {

      await requestLocationPermission();

      const initialLocation =
        await getCurrentLocation();

      if (!initialLocation) return;

      const locationObject = {
        latitude:
          initialLocation.latitude,

        longitude:
          initialLocation.longitude,
      };

      setCurrentLoc(locationObject);

      mapRef.current?.animateToRegion(
        {
          ...locationObject,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );

      watchSubscription.current =
        await startLiveLocationTracking({

          schoolId,

          username: user.username,

          onLocationChange: ({
            location,
            speed,
          }) => {

            setCurrentLoc(location);

            setCurrentSpeed(speed);

            mapRef.current?.animateCamera({
              center: location,
              zoom: 17,
            });

          },

        });

    } catch (error) {

      console.log(error);

      Alert.alert(
        'خطأ',
        'تعذر تحديد موقعك'
      );

    }

  };

  const startTrip = async () => {

    try {

      await startBackgroundTracking(
        LOCATION_TASK_NAME
      );

      setIsTripActive(true);

      Alert.alert(
        'تم بدء الرحلة',
        'يتم الآن تتبع الباص مباشرة'
      );

    } catch (error) {

      Alert.alert(
        'خطأ',
        error.message
      );

    }

  };

  const stopTrip = async () => {

    try {

      await stopBackgroundTracking(
        LOCATION_TASK_NAME
      );

      setIsTripActive(false);

      Alert.alert(
        'تم إنهاء الرحلة',
        'تم إيقاف التتبع'
      );

    } catch (error) {

      Alert.alert(
        'خطأ',
        'فشل إيقاف الرحلة'
      );

    }

  };

  const handleLogout = () => {

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

            try {

              await clearUserSession();

              navigation.reset({
                index: 0,
                routes: [
                  {
                    name: 'Login',
                  },
                ],
              });

            } catch (error) {

              Alert.alert(
                'خطأ',
                'فشل تسجيل الخروج'
              );

            }

          },
        },
      ]
    );

  };

  const callParent = (phone) => {

    if (!phone) {

      Alert.alert(
        'خطأ',
        'رقم الهاتف غير متوفر'
      );

      return;

    }

    Linking.openURL(`tel:${phone}`);

  };

  if (loading) {

    return (

      <View style={styles.centered}>

        <ActivityIndicator
          size="large"
          color="#3B82F6"
        />

        <Text style={styles.loadingText}>
          جاري تحميل البيانات...
        </Text>

      </View>

    );

  }

  return (

    <SafeAreaView style={styles.container}>

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

        <View style={styles.headerInfo}>

          <Text style={styles.title}>
            لوحة السائق 🚌
          </Text>

          <Text style={styles.driverName}>
            {user?.name}
          </Text>

        </View>

      </View>

      <View style={styles.statusCard}>

        <View style={styles.speedCircle}>

          <Text style={styles.speedValue}>
            {currentSpeed}
          </Text>

          <Text style={styles.speedUnit}>
            كم/س
          </Text>

        </View>

        <TouchableOpacity
          style={[
            styles.tripBtn,
            isTripActive
              ? styles.stopBtn
              : styles.startBtn,
          ]}

          onPress={
            isTripActive
              ? stopTrip
              : startTrip
          }
        >

          <Text style={styles.tripBtnText}>

            {
              isTripActive
                ? 'إنهاء الرحلة 🏁'
                : 'بدء الرحلة 🚀'
            }

          </Text>

        </TouchableOpacity>

      </View>

      <DriverMap
        mapRef={mapRef}
        currentLoc={currentLoc}
      />

      <View
        style={styles.studentListContainer}
      >

        <Text style={styles.listTitle}>
          قائمة الطلاب ({students.length})
        </Text>

        <FlatList
          data={students}

          keyExtractor={(item) => item.id}

          renderItem={({ item }) => (

            <StudentItem
              student={item}
              onCallParent={callParent}
            />

          )}
        />

      </View>

    </SafeAreaView>

  );

}

TaskManager.defineTask(
  LOCATION_TASK_NAME,

  async ({ data, error }) => {

    if (error) return;

    if (data) {

      const { locations } = data;

      const location = locations[0];

      try {

        const session =
          await AsyncStorage.getItem(
            'background_session'
          );

        if (!session) return;

        const {
          schoolId,
          user,
        } = JSON.parse(session);

        await updateBusLocation(
          schoolId,
          user.username,
          location.coords.latitude,
          location.coords.longitude,
          location.coords.speed || 0
        );

      } catch (e) {

        console.log(
          'Background update failed:',
          e
        );

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

  loadingText: {
    marginTop: 15,
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

  headerInfo: {
    alignItems: 'flex-end',
  },

  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },

  driverName: {
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

  statusCard: {
    padding: 20,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  speedCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  speedValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },

  speedUnit: {
    fontSize: 10,
    color: '#64748B',
  },

  tripBtn: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    elevation: 3,
  },

  startBtn: {
    backgroundColor: '#10B981',
  },

  stopBtn: {
    backgroundColor: '#EF4444',
  },

  tripBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  studentListContainer: {
    flex: 1,
    padding: 15,
  },

  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'right',
  },

});