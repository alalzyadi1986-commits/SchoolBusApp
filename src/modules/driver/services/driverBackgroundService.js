import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateBusLocation } from '../../../services/busService';

const LOCATION_TASK_NAME = 'background-location-task';

// تعريف المهمة في الخلفية هنا لضمان عملها حتى لو تم إغلاق التطبيق
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0];
    try {
      const session = await AsyncStorage.getItem('background_session');
      if (session) {
        const { schoolId, user } = JSON.parse(session);
        const speed = Math.round(location.coords.speed * 3.6) || 0;
        // تمرير latitude, longitude, speed كمعاملات منفصلة مع ضمان تحديث الوقت والحالة
        await updateBusLocation(
          schoolId, 
          user.username, 
          location.coords.latitude, 
          location.coords.longitude, 
          speed
        );
      }
    } catch (e) {
      console.error('Background location update error:', e);
    }
  }
});

export const startBackgroundTracking = async (taskName) => {
  // طلب صلاحيات الموقع في المقدمة أولاً
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    throw new Error('Foreground location permission not granted');
  }

  // ثم طلب صلاحيات الموقع في الخلفية
  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') {
    throw new Error('Background location permission not granted');
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(taskName);
  if (!isRegistered) {
    await Location.startLocationUpdatesAsync(taskName, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 10000, // تحديث كل 10 ثوانٍ
      distanceInterval: 10, // أو كل 10 أمتار
      foregroundService: {
        // إعدادات خدمة المقدمة لضمان عمل التتبع في الخلفية على أندرويد
        channelId: 'background_location',
        notificationTitle: 'تتبع الحافلة',
        notificationBody: 'يتم تتبع موقع الحافلة في الخلفية.',
        notificationColor: '#3B82F6',
      },
    });
  }
};

export const stopBackgroundTracking = async (taskName) => {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(taskName);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(taskName);
  }
};
