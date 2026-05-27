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
  Platform,
} from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from '@react-navigation/native';
import { loginUser } from '../services/authService';
import { saveUserSession } from '../services/sessionService';
import { registerForPushNotificationsAsync } from '../utils/notifications';

const { height } = Dimensions.get('window');

const i18n = {
  ar: {
    appTagline: 'نظام تتبع الباصات المدرسية',
    appName: 'تطبيق الحافلة الذكية',
    loginTitle: 'تسجيل الدخول',
    loginSubtitle: 'أهلاً بك، يرجى إدخال بياناتك',
    usernameLabel: 'اسم المستخدم',
    usernamePlaceholder: 'أدخل اسم المستخدم',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: 'أدخل كلمة المرور',
    rememberMe: 'تذكر البيانات',
    loginBtn: 'دخول',
    contactUs: '📞 تواصل معنا للاشتراك',
    errorEmpty: 'الرجاء إدخال اسم المستخدم وكلمة المرور.',
    errorInactive: 'اشتراك المدرسة غير نشط أو غير موجود.',
    errorWrong: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
    errorGeneral: 'حدث خطأ أثناء تسجيل الدخول.',
  },
  en: {
    appTagline: 'School Bus Tracking System',
    appName: 'Smart Bus App',
    loginTitle: 'Login',
    loginSubtitle: 'Welcome back! Please enter your details',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Enter your username',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    rememberMe: 'Remember Me',
    loginBtn: 'Login',
    contactUs: '📞 Contact us to subscribe',
    errorEmpty: 'Please enter username and password.',
    errorInactive: 'School subscription is inactive or not found.',
    errorWrong: 'Invalid username or password.',
    errorGeneral: 'An error occurred during login.',
  }
};

export default function LoginScreen() {
  const navigation = useNavigation();
  const [lang, setLang] = useState('ar');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const langAnim = useRef(new Animated.Value(1)).current;

  const t = i18n[lang];

  useEffect(() => {
    loadSavedCredentials();
    Animated.stagger(200, [
      Animated.timing(logoAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(formAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  const toggleLang = () => {
    Animated.sequence([
      Animated.timing(langAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(langAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    setLang(prev => (prev === 'ar' ? 'en' : 'ar'));
  };

  const loadSavedCredentials = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('remembered_username');
      const savedPass = await AsyncStorage.getItem('remembered_password');
      const isRemembered = await AsyncStorage.getItem('remember_me_status');
      if (isRemembered === 'true' && savedUser) {
        setUsername(savedUser);
        if (savedPass) setPassword(savedPass);
        setRememberMe(true);
      }
    } catch (error) {
      console.log('Error loading credentials:', error);
    }
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
        await AsyncStorage.setItem('remember_me_status', 'true');
      } else {
        await AsyncStorage.removeItem('remembered_username');
        await AsyncStorage.removeItem('remembered_password');
        await AsyncStorage.setItem('remember_me_status', 'false');
      }

      await saveUserSession(userData);

      // Register for notifications
      try {
        const token = await registerForPushNotificationsAsync();
        // Note: Actual saving to DB should be handled based on user role
      } catch (e) {
        console.log('Notification registration skipped or failed');
      }

      // Navigate by role and pass schoolId
      const params = { user: userData, schoolId: userData.schoolId };
      
      if (userData.role === 'superadmin') navigation.replace('SuperAdminScreen', params);
      else if (userData.role === 'school') navigation.replace('SchoolScreen', params);
      else if (userData.role === 'driver') navigation.replace('DriverScreen', params);
      else if (userData.role === 'staff') navigation.replace('StaffScreen', params);
      else if (userData.role === 'parent') navigation.replace('ParentScreen', params);

      setLoading(false);

    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('❌', t.errorWrong);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1628" />
      
      <Animated.View style={[styles.langBtnWrapper, { opacity: logoAnim }]}>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang} activeOpacity={0.8}>
          <Animated.Text style={[styles.langBtnText, { opacity: langAnim }]}>
            {lang === 'ar' ? '🇬🇧 EN' : '🇸🇦 عر'}
          </Animated.Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, { opacity: logoAnim, transform: [{ scale: logoAnim }] }]}>
          <Text style={styles.logoEmoji}>🚌</Text>
          <Text style={styles.appName}>{t.appName}</Text>
          <Text style={styles.appTagline}>{t.appTagline}</Text>
        </Animated.View>

        <Animated.View style={[styles.formContainer, { 
          opacity: formAnim, 
          transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] 
        }]}>
          <Text style={styles.loginTitle}>{t.loginTitle}</Text>
          <Text style={styles.loginSubtitle}>{t.loginSubtitle}</Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>{t.usernameLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.usernamePlaceholder}
              placeholderTextColor="#94A3B8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>{t.passwordLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.passwordPlaceholder}
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            style={styles.rememberRow} 
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Text style={styles.checkIcon}>✓</Text>}
            </View>
            <Text style={styles.rememberText}>{t.rememberMe}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>{t.loginBtn}</Text>
            )}
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
  langBtnWrapper: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
  langBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  langBtnText: { color: '#fff', fontWeight: 'bold' },
  content: { flex: 1, justifyContent: 'center', padding: 25 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoEmoji: { fontSize: 80, marginBottom: 10 },
  appName: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  appTagline: { fontSize: 16, color: '#94A3B8', marginTop: 5, textAlign: 'center' },
  formContainer: { backgroundColor: '#fff', borderRadius: 25, padding: 25, elevation: 10 },
  loginTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', marginBottom: 5 },
  loginSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 25 },
  inputWrapper: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 15, fontSize: 16, color: '#1E293B' },
  rememberRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: '#3B82F6', borderRadius: 6, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#3B82F6' },
  checkIcon: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  rememberText: { fontSize: 14, color: '#475569' },
  loginBtn: { backgroundColor: '#3B82F6', borderRadius: 12, padding: 18, alignItems: 'center', elevation: 4 },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  contactBtn: { marginTop: 30, alignItems: 'center' },
  contactText: { color: '#94A3B8', fontSize: 14 }
});
