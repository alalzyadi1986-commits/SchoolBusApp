import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Animated,
  Dimensions,
  Linking,
} from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from '@react-navigation/native';
import { loginUser } from '../services/authService';
import { saveUserSession, getUserSession } from '../services/sessionService';
import { registerForPushNotificationsAsync } from '../utils/notifications';

const { height } = Dimensions.get('window');

const i18n = {
  ar: {
    appName: 'تطبيق الحافلة الذكية',
    loginTitle: 'تسجيل الدخول',
    usernameLabel: 'اسم المستخدم',
    usernamePlaceholder: 'أدخل اسم المستخدم',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: 'أدخل كلمة المرور',
    rememberMe: 'تذكر البيانات',
    loginBtn: 'دخول',
    contactUs: '📞 تواصل معنا للاشتراك',
    errorEmpty: 'الرجاء إدخال اسم المستخدم وكلمة المرور.',
    errorWrong: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
  }
};

export default function LoginScreen() {
  const navigation = useNavigation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const formAnim = useRef(new Animated.Value(0)).current;
  const t = i18n.ar;

  useEffect(() => {
    checkExistingSession();
    Animated.spring(formAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();
  }, []);

  const checkExistingSession = async () => {
    try {
      const session = await getUserSession();
      if (session && session.role && session.schoolId) {
        navigateToRole(session.role, { user: session, schoolId: session.schoolId });
        return;
      }
      
      const savedUser = await AsyncStorage.getItem('remembered_username');
      const savedPass = await AsyncStorage.getItem('remembered_password');
      if (savedUser) {
        setUsername(savedUser);
        if (savedPass) setPassword(savedPass);
        setRememberMe(true);
      }
    } catch (e) {
      console.log("Session check error", e);
    } finally {
      setCheckingSession(false);
    }
  };

  const navigateToRole = (role, params) => {
    const screens = {
      superadmin: 'SuperAdminScreen',
      school: 'SchoolScreen',
      driver: 'DriverScreen',
      staff: 'StaffScreen',
      parent: 'ParentScreen'
    };
    const target = screens[role] || 'Login';
    if (target !== 'Login') navigation.replace(target, params);
  };

  const handleLogin = async () => {
    const enteredUser = username.trim();
    const enteredPass = password.trim();

    if (!enteredUser || !enteredPass) {
      Alert.alert('⚠️', t.errorEmpty);
      return;
    }

    setLoading(true);
    try {
      const userData = await loginUser(enteredUser, enteredPass);
      if (!userData) {
        Alert.alert('❌', t.errorWrong);
        setLoading(false);
        return;
      }

      if (rememberMe) {
        await AsyncStorage.setItem('remembered_username', enteredUser);
        await AsyncStorage.setItem('remembered_password', enteredPass);
      } else {
        await AsyncStorage.removeItem('remembered_username');
        await AsyncStorage.removeItem('remembered_password');
      }

      await saveUserSession(userData);

      registerForPushNotificationsAsync().then(token => {
        if (token) console.log("Token obtained");
      });

      navigateToRole(userData.role, { user: userData, schoolId: userData.schoolId });
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('❌', 'حدث خطأ في الاتصال، يرجى المحاولة لاحقاً');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) return (
    <View style={styles.centered}><ActivityIndicator size="large" color="#3B82F6" /></View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1628" />
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>🚌</Text>
          <Text style={styles.appName}>{t.appName}</Text>
        </View>

        <Animated.View style={[styles.formContainer, { 
          opacity: formAnim, 
          transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] 
        }]}>
          <Text style={styles.loginTitle}>{t.loginTitle}</Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>{t.usernameLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.usernamePlaceholder}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              textAlign="right"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>{t.passwordLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.passwordPlaceholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textAlign="right"
            />
          </View>

          <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe(!rememberMe)}>
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Text style={styles.checkIcon}>✓</Text>}
            </View>
            <Text style={styles.rememberText}>{t.rememberMe}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.loginBtn, loading && styles.loginBtnDisabled]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>{t.loginBtn}</Text>}
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL('https://wa.me/+9660000000000')}>
          <Text style={styles.contactText}>{t.contactUs}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },
  centered: { flex: 1, backgroundColor: '#0A1628', justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, justifyContent: 'center', padding: 25 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoEmoji: { fontSize: 80, marginBottom: 10 },
  appName: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  formContainer: { backgroundColor: '#fff', borderRadius: 25, padding: 25 },
  loginTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', marginBottom: 25, textAlign: 'center' },
  inputWrapper: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, textAlign: 'right' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 15, fontSize: 16 },
  rememberRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 25 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: '#3B82F6', borderRadius: 6, marginLeft: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#3B82F6' },
  checkIcon: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  rememberText: { fontSize: 14, color: '#475569' },
  loginBtn: { backgroundColor: '#3B82F6', borderRadius: 12, padding: 18, alignItems: 'center' },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  contactBtn: { marginTop: 30, alignItems: 'center' },
  contactText: { color: '#94A3B8', fontSize: 14 }
});
