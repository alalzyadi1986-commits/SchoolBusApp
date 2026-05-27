import * as Location from 'expo-location';
import { Platform } from 'react-native';

/**
 * طلب أذونات الموقع (الأمامية والخلفية)
 */
export const requestLocationPermission = async () => {
  // 1. طلب إذن الموقع في الأمام (Foreground)
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  
  if (foregroundStatus !== 'granted') {
    throw new Error('Foreground location permission denied');
  }

  // 2. طلب إذن الموقع في الخلفية (Background) - مطلوب للأندرويد لتتبع الباص
  if (Platform.OS === 'android') {
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('Background location permission denied');
      // لا نرمي خطأ هنا لأن التطبيق قد يعمل في الأمام فقط، لكننا سنحتاجه لتتبع الباص
    }
  }

  return true;
};

/**
 * جلب الموقع الحالي بدقة عالية
 */
export const getCurrentLocation = async () => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return location.coords;
  } catch (error) {
    console.error('Error getting current location:', error);
    // محاولة جلب آخر موقع معروف كبديل في حال فشل الحصول على الموقع الحالي
    const lastLocation = await Location.getLastKnownPositionAsync();
    if (lastLocation) return lastLocation.coords;
    throw error;
  }
};
