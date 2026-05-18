import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// استيراد جميع الشاشات الخاصة بالتطبيق
import LoginScreen from './src/screens/LoginScreen';
import SuperAdminScreen from './src/screens/SuperAdminScreen'; 
import SchoolScreen from './src/screens/SchoolScreen';
import DriverScreen from './src/screens/DriverScreen';
import ParentScreen from './src/screens/ParentScreen';
import StaffScreen from './src/screens/StaffScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        {/* شاشة تسجيل الدخول */}
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false }} 
        />
        
        {/* شاشة المدير العام - Super Admin */}
        <Stack.Screen 
          name="SuperAdminScreen" 
          component={SuperAdminScreen} 
          options={{ 
            title: 'لوحة التحكم للمدير العام', 
            headerLeft: () => null,
            headerTitleAlign: 'center'
          }} 
        />
        
        {/* شاشة إدارة المدرسة */}
        <Stack.Screen 
          name="SchoolScreen" 
          component={SchoolScreen} 
          options={{ 
            title: 'لوحة تحكم المدرسة', 
            headerLeft: () => null,
            headerTitleAlign: 'center'
          }} 
        />
        
        {/* شاشة السائق */}
        <Stack.Screen 
          name="DriverScreen" 
          component={DriverScreen} 
          options={{ 
            title: 'شاشة السائق', 
            headerLeft: () => null,
            headerTitleAlign: 'center'
          }} 
        />
        
        {/* شاشة ولي الأمر */}
        <Stack.Screen 
          name="ParentScreen" 
          component={ParentScreen} 
          options={{ 
            title: 'شاشة ولي الأمر', 
            headerLeft: () => null,
            headerTitleAlign: 'center'
          }} 
        />
        
        {/* شاشة مرافق الباص */}
        <Stack.Screen 
          name="StaffScreen" 
          component={StaffScreen} 
          options={{ 
            title: 'شاشة مرافق الباص', 
            headerLeft: () => null,
            headerTitleAlign: 'center'
          }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}