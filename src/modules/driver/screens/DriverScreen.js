import React, { useState, useEffect, useRef } from 'react';
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
  StatusBar,
  Image,
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
} from 'firebase/database';

import { db } from '../../../firebaseConfig';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  requestLocationPermission,
  getCurrentLocation,
} from '../../../services/locationService';

import { updateBusLocation } from '../../../services/busService';

import { clearUserSession } from '../../../services/sessionService';

const { width } = Dimensions.get('window');

const LOCATION_TASK_NAME = 'background-location-task';

const TRACKING_INTERVAL = 5000;

export default function DriverScreen() {

  const route = useRoute();
  const navigation = useNavigation();

  const { schoolId, user } = route.params || {};

  const [currentLoc, setCurrentLoc] = useState(null);

  const [students, setStudents] = useState([]);

  const [isTripActive, setIsTripActive] = useState(false);

  const [loading, setLoading] = useState(true);

  const [currentSpeed, setCurrentSpeed] = useState(0);

  const mapRef = useRef(null);

  const watchSubscription = useRef(null);

  useEffect(() => {

    if (!schoolId || !user?.username) {
      setLoading(false);
      return;
    }

    AsyncStorage.setItem(
      'background_session',
      JSON.stringify({ schoolId, user })
    );

    TaskManager.isTaskRegisteredAsync(
      LOCATION_TASK_NAME
    ).then(active => {
      setIsTripActive(active);
    });

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
              ...data[key]
            }))
            .filter(student => {

              return (
                (
                  student.driverUsername === user.username ||
                  student.driver_id === user.username
                ) &&
                student.status !== 'absent_today'
              );

            });

          setStudents(list);

        } else {

          setStudents([]);

        }

        setLoading(false);

      }
    );

    const setupLocation = async () => {

      try {

        await requestLocationPermission();

        const initialLoc = await getCurrentLocation();

        if (initialLoc) {

          const locObj = {
            latitude: initialLoc.latitude,
            longitude: initialLoc.longitude,
          };

          setCurrentLoc(locObj);

          mapRef.current?.animateToRegion(
            {
              ...locObj,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            1000
          );

        }

        watchSubscription.current =
          await Location.watchPositionAsync(

            {
              accuracy:
                Location.Accuracy.BestForNavigation,

              timeInterval: TRACKING_INTERVAL,

              distanceInterval: 5,
            },

            async (location) => {

              const newLoc = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              };

              setCurrentLoc(newLoc);

              setCurrentSpeed(
                Math.round(
                  (location.coords.speed || 0) * 3.6
                )
              );

              if (isTripActive) {

                await updateBusLocation(
                  schoolId,
                  user.username,
                  newLoc.latitude,
                  newLoc.longitude,
                  location.coords.speed || 0
                );

              }

              mapRef.current?.animateCamera({
                center: newLoc,
                zoom: 17,
              });

            }

          );

      } catch (e) {

        console.log('Location setup error:', e);

        Alert.alert(
          'خطأ',
          'تعذر تحديد موقعك الحالي'
        );

      }

    };

    setupLocation();

    return () => {

      unsubscribeStudents();

      if (watchSubscription.current) {
        watchSubscription.current.remove();
      }

    };

  }, [schoolId, user, isTripActive]);

  const startTrip = async () => {

    try {

      const { status } =
        await Location.requestBackgroundPermissionsAsync();

      if (status !== 'granted') {

        Alert.alert(
          "صلاحية مرفوضة",
          "يجب السماح بالوصول للموقع دائماً."
        );

        return;

      }

      await Location.startLocationUpdatesAsync(
        LOCATION_TASK_NAME,
        {
          accuracy:
            Location.Accuracy.BestForNavigation,

          timeInterval: TRACKING_INTERVAL,

          distanceInterval: 5,

          foregroundService: {
            notificationTitle: "تتبع الباص نشط 🚌",
            notificationBody:
              "يتم مشاركة موقعك الآن مع أولياء الأمور",

            notificationColor: "#3B82F6",
          },
        }
      );

      setIsTripActive(true);

      Alert.alert(
        "تم بدء الرحلة",
        "يتم الآن تتبع الباص مباشرة."
      );

    } catch (e) {

      Alert.alert(
        "خطأ",
        "فشل بدء تتبع الموقع."
      );

    }

  };

  const stopTrip = async () => {

    try {

      await Location.stopLocationUpdatesAsync(
        LOCATION_TASK_NAME
      );

      await update(
        ref(
          db,
          `schools/${schoolId}/bus/${user.username}`
        ),
        {
          isActive: false,
          lastActive: new Date().toISOString(),
        }
      );

      setIsTripActive(false);

      Alert.alert(
        "تم إنهاء الرحلة",
        "توقف تتبع الموقع."
      );

    } catch (e) {

      Alert.alert(
        "خطأ",
        "حدث خطأ أثناء إيقاف الرحلة."
      );

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

  const callParent = (phone) => {

    if (phone) {

      Linking.openURL(`tel:${phone}`);

    } else {

      Alert.alert(
        "خطأ",
        "رقم الهاتف غير متوفر"
      );

    }

  };

  if (loading || !currentLoc) {

    return (

      <View style={styles.centered}>

        <ActivityIndicator
          size="large"
          color="#3B82F6"
        />

        <Text style={{ marginTop: 15 }}>
          جاري تحديد موقعك الحقيقي...
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

        <View style={{ alignItems: 'flex-end' }}>

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
              : styles.startBtn
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

      <MapView
        ref={mapRef}
        style={styles.map}

        region={{
          latitude: currentLoc.latitude,
          longitude: currentLoc.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}

        showsUserLocation={true}

        followsUserLocation={true}

        showsMyLocationButton={true}
      >

        <Marker
          coordinate={currentLoc}
          tracksViewChanges={false}
        >

          <View style={styles.busMarker}>

            <Image
              source={{
                uri:
                  'https://cdn-icons-png.flaticon.com/512/3448/3448339.png'
              }}

              style={styles.busImage}
            />

          </View>

        </Marker>

      </MapView>

      <View style={styles.studentListContainer}>

        <Text style={styles.listTitle}>
          قائمة الطلاب ({students.length})
        </Text>

        <FlatList
          data={students}

          keyExtractor={(item) => item.id}

          renderItem={({ item }) => (

            <View style={styles.studentItem}>

              <TouchableOpacity
                style={styles.callBtn}

                onPress={() =>
                  callParent(
                    item.parentPhone ||
                    item.parent_username
                  )
                }
              >

                <Text style={styles.callBtnText}>
                  📞 اتصل
                </Text>

              </TouchableOpacity>

              <View style={{ alignItems: 'flex-end' }}>

                <Text style={styles.studentName}>
                  {item.name}
                </Text>

                <Text style={styles.studentSub}>

                  {item.class} -

                  {
                    item.status === 'present'
                      ? ' ✅ داخل الباص'
                      : ' ⏳ ينتظر'
                  }

                </Text>

              </View>

            </View>

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

        if (session) {

          const { schoolId, user } =
            JSON.parse(session);

          await updateBusLocation(
            schoolId,
            user.username,
            location.coords.latitude,
            location.coords.longitude,
            location.coords.speed || 0
          );

        }

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

  driverName: {
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

  statusCard: {
    padding: 20,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around'
  },

  speedCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center'
  },

  speedValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B'
  },

  speedUnit: {
    fontSize: 10,
    color: '#64748B'
  },

  tripBtn: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    elevation: 3
  },

  startBtn: {
    backgroundColor: '#10B981'
  },

  stopBtn: {
    backgroundColor: '#EF4444'
  },

  tripBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold'
  },

  map: {
    height: 260,
    width: '100%'
  },

  busMarker: {
    backgroundColor: '#FFF',
    padding: 6,
    borderRadius: 50,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#3B82F6'
  },

  busImage: {
    width: 40,
    height: 40,
    resizeMode: 'contain'
  },

  studentListContainer: {
    flex: 1,
    padding: 15
  },

  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'right'
  },

  studentItem: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1
  },

  studentName: {
    fontSize: 14,
    fontWeight: 'bold'
  },

  studentSub: {
    fontSize: 12,
    color: '#64748B'
  },

  callBtn: {
    backgroundColor: '#3B82F6',
    padding: 8,
    borderRadius: 8
  },

  callBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold'
  }

});