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
    rememberMe: 'Remember me',
    loginBtn: 'Login',
    contactUs: '📞 Contact us to subscribe',
    errorEmpty: 'Please enter your username and password.',
    errorInactive: 'School subscription is inactive or not found.',
    errorWrong: 'Incorrect username or password.',
    errorGeneral: 'An error occurred.',
  },
};

export default function LoginScreen() {
  const navigation = useNavigation();

  const [lang, setLang] = useState('ar');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isPasswordSecure, setIsPasswordSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const t = i18n[lang];
  const isRTL = lang === 'ar';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;
  const langAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadSavedCredentials();

    Animated.sequence([
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
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

  const handleContactUs = () => {
    Linking.openURL('https://wa.me/+9660000000000');
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

      const token = await registerForPushNotificationsAsync();
      if (token && userData?.username) {
        await userData.savePushToken?.(token);
      }

      // Navigate by role
      if (userData.role === 'superadmin') navigation.replace('SuperAdminScreen', { user: userData });
      else if (userData.role === 'school') navigation.replace('SchoolScreen', { user: userData });
      else if (userData.role === 'driver') navigation.replace('DriverScreen', { user: userData });
      else if (userData.role === 'staff') navigation.replace('StaffScreen', { user: userData });
      else if (userData.role === 'parent') navigation.replace('ParentScreen', { user: userData });

      setLoading(false);

    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('❌', t.errorGeneral);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1628" />
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />
      </View>

      <Animated.View style={[styles.langBtnWrapper, { opacity: logoAnim }]}>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang} activeOpacity={0.8}>
          <Animated.Text style={[styles.langBtnText, { opacity: langAnim }]}>
            {lang === 'ar' ? '🇬🇧 EN' : '🇸🇦 عر'}
          </Animated.Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.content}>
        <Animated.View style={[styles.logoSection, { opacity: logoAnim }]}>
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoIcon}>🚌</Text>
          </View>
          <Text style={styles.appName}>{i18n[lang].appName}</Text>
          <Text style={styles.appTagline}>{i18n[lang].appTagline}</Text>
        </Animated.View>

        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={[styles.cardTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{i18n[lang].loginTitle}</Text>
          <Text style={[styles.cardSubtitle, { textAlign: isRTL ? 'right' : 'left' }]}>{i18n[lang].loginSubtitle}</Text>

          <Text style={[styles.inputLabel, { textAlign: isRTL ? 'right' : 'left' }]}>👤 {i18n[lang].usernameLabel}</Text>
          <View style={[styles.inputContainer, usernameFocused && styles.inputContainerFocused]}>
            <TextInput
              style={[styles.input, { textAlign: isRTL ? 'right' : 'left' }]}
              placeholder={i18n[lang].usernamePlaceholder}
              placeholderTextColor="#94A3B8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              onFocus={() => setUsernameFocused(true)}
              onBlur={() => setUsernameFocused(false)}
            />
          </View>

          <Text style={[styles.inputLabel, { textAlign: isRTL ? 'right' : 'left', marginTop: 14 }]}>🔒 {i18n[lang].passwordLabel}</Text>
          <View style={[styles.inputContainer, passwordFocused && styles.inputContainerFocused]}>
            <TextInput
              style={[styles.input, { textAlign: isRTL ? 'right' : 'left' }]}
              placeholder={i18n[lang].passwordPlaceholder}
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={isPasswordSecure}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
            <TouchableOpacity onPress={() => setIsPasswordSecure(!isPasswordSecure)} style={styles.eyeButton}>
              <Text style={styles.eyeIcon}>{isPasswordSecure ? '👁️' : '🙈'}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.rememberMeRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={styles.rememberMeText}>{i18n[lang].rememberMe}</Text>
            <TouchableOpacity
              style={[styles.toggle, rememberMe && styles.toggleActive]}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleThumb, { left: rememberMe ? undefined : 3, right: rememberMe ? 3 : undefined }]} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.loginButton, loading && styles.loginButtonDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.loginButtonText}>{isRTL ? `← ${i18n[lang].loginBtn}` : `${i18n[lang].loginBtn} →`}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactButton} onPress={handleContactUs} activeOpacity={0.8}>
            <Text style={styles.contactButtonText}>{i18n[lang].contactUs}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// احتفظت بالـ styles كما هي دون أي تغيير
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1628' },
  circle1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: '#1E3A5F', top: -80, right: -80, opacity: 0.6 },
  circle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#F59E0B', bottom: 80, left: -60, opacity: 0.08 },
  circle3: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#3B82F6', top: height * 0.4, right: -40, opacity: 0.1 },
  langBtnWrapper: { position: 'absolute', top: Platform.OS === 'ios' ? 55 : 20, left: 20, zIndex: 100 },
  langBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  langBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 },
  logoSection: { alignItems: 'center', marginBottom: 24 },
  logoPlaceholder: { width: 80, height: 80, borderRadius: 22, backgroundColor: '#1E3A5F', borderWidth: 2, borderColor: '#F59E0B', justifyContent: 'center', alignItems: 'center', marginBottom: 12, elevation: 8 },
  logoIcon: { fontSize: 36 },
  appName: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1, marginBottom: 4 },
  appTagline: { fontSize: 12, color: '#94A3B8' },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, elevation: 15 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#0A1628', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: '#94A3B8', marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, height: 48 },
  inputContainerFocused: { borderColor: '#F59E0B', backgroundColor: '#FFFBF0' },
  input: { flex: 1, fontSize: 14, color: '#0A1628', height: '100%' },
  eyeButton: { padding: 6 },
  eyeIcon: { fontSize: 16 },
  rememberMeRow: { alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 20 },
  rememberMeText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', justifyContent: 'center', position: 'relative' },
  toggleActive: { backgroundColor: '#F59E0B' },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF', position: 'absolute', top: 2.5, elevation: 2 },
  loginButton: { backgroundColor: '#0A1628', borderRadius: 14, height: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  loginButtonDisabled: { opacity: 0.7 },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  contactButton: { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, height: 44, justifyContent: 'center', alignItems: 'center' },
  contactButtonText: { color: '#64748B', fontSize: 13, fontWeight: '700' },
});