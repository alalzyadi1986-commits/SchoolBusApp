import React from 'react';

import { NavigationContainer } from '@react-navigation/native';

import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from './src/screens/LoginScreen';

import SuperAdminScreen from './src/screens/SuperAdminScreen';

import SchoolScreen from './src/screens/SchoolScreen';

import DriverScreen from './src/modules/driver/screens/DriverScreen';

import StaffScreen from './src/screens/StaffScreen';

import ParentScreen from './src/modules/parent/screens/ParentScreen';

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

        <Stack.Screen
          name="Login"
          component={LoginScreen}
        />

        <Stack.Screen
          name="SuperAdminScreen"
          component={SuperAdminScreen}
        />

        <Stack.Screen
          name="SchoolScreen"
          component={SchoolScreen}
        />

        <Stack.Screen
          name="DriverScreen"
          component={DriverScreen}
        />

        <Stack.Screen
          name="StaffScreen"
          component={StaffScreen}
        />

        <Stack.Screen
          name="ParentScreen"
          component={ParentScreen}
        />

      </Stack.Navigator>

    </NavigationContainer>

  );

}