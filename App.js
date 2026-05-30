import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// استيراد الشاشات من مساراتها الجديدة (الهيكل المعياري الاحترافي)
import LoginScreen from './src/modules/auth/screens/LoginScreen';
import SuperAdminScreen from './src/modules/admin/screens/SuperAdminScreen';
import SchoolScreen from './src/modules/school/screens/SchoolScreen';
import DriverScreen from './src/modules/driver/screens/DriverScreen';
import StaffScreen from './src/modules/staff/screens/StaffScreen';
import ParentScreen from './src/modules/parent/screens/ParentScreen';
import ActiveTripsScreen from './src/modules/school/screens/ActiveTripsScreen';
import TripMapScreen from './src/modules/school/screens/TripMapScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SuperAdminScreen" component={SuperAdminScreen} />
        <Stack.Screen name="SchoolScreen" component={SchoolScreen} />
        <Stack.Screen name="DriverScreen" component={DriverScreen} />
        <Stack.Screen name="StaffScreen" component={StaffScreen} />
        <Stack.Screen name="ParentScreen" component={ParentScreen} />
        <Stack.Screen name="ActiveTrips" component={ActiveTripsScreen} />
        <Stack.Screen name="TripMap" component={TripMapScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
