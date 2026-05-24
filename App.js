import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// استيراد جميع الشاشات
import LoginScreen from './src/screens/LoginScreen';
import SuperAdminScreen from './src/screens/SuperAdminScreen';
import SchoolScreen from './src/screens/SchoolScreen';
import DriverScreen from './src/screens/DriverScreen';
import ParentScreen from './src/screens/ParentScreen';
import StaffScreen from './src/screens/StaffScreen';

const Stack = createNativeStackNavigator();

// شاشة البداية - تتحقق من الجلسة المحفوظة وتوجه المستخدم فوراً
function SplashScreen({ navigation }) {
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await AsyncStorage.getItem('user_session');
        if (session) {
          const user = JSON.parse(session);
          const role = user.role;
          const schoolId = user.schoolId || null;

          if (role === 'superadmin') {
            navigation.replace('SuperAdminScreen', { user });
          } else if (role === 'school') {
            navigation.replace('SchoolScreen', { schoolId, user });
          } else if (role === 'driver') {
            navigation.replace('DriverScreen', { schoolId, user });
          } else if (role === 'staff') {
            navigation.replace('StaffScreen', { schoolId, user });
          } else if (role === 'parent') {
            navigation.replace('ParentScreen', { schoolId, user });
          } else {
            navigation.replace('Login');
          }
        } else {
          navigation.replace('Login');
        }
      } catch (error) {
        console.log('Session check error:', error);
        navigation.replace('Login');
      }
    };

    checkSession();
  }, []);

  return (
    <View style={styles.splashContainer}>
      <ActivityIndicator size="large" color="#007BFF" />
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash">

        {/* شاشة البداية - تحقق الجلسة */}
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ headerShown: false }}
        />

        {/* شاشة تسجيل الدخول */}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />

        {/* شاشة المدير العام */}
        <Stack.Screen
          name="SuperAdminScreen"
          component={SuperAdminScreen}
          options={{ headerShown: false }}
        />

        {/* شاشة إدارة المدرسة */}
        <Stack.Screen
          name="SchoolScreen"
          component={SchoolScreen}
          options={{ headerShown: false }}
        />

        {/* شاشة السائق */}
        <Stack.Screen
          name="DriverScreen"
          component={DriverScreen}
          options={{ headerShown: false }}
        />

        {/* شاشة ولي الأمر */}
        <Stack.Screen
          name="ParentScreen"
          component={ParentScreen}
          options={{ headerShown: false }}
        />

        {/* شاشة مرافق الباص */}
        <Stack.Screen
          name="StaffScreen"
          component={StaffScreen}
          options={{ headerShown: false }}
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
});
