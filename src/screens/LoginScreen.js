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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, get, update } from 'firebase/database';
import { db } from '../firebaseConfig';
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
      Animated.timing(langAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),

      Animated.timing(langAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();

    setLang(prev => (prev === 'ar' ? 'en' : 'ar'));
  };

  const getWithTimeout = (dbRef, timeoutMs = 8000) => {
    return Promise.race([
      get(dbRef),

      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
      ),
    ]);
  };

  const loadSavedCredentials = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('remembered_username');
      const savedPass = await AsyncStorage.getItem('remembered_password');
      const isRemembered = await AsyncStorage.getItem('remember_me_status');

      if (isRemembered === 'true' && savedUser) {
        setUsername(savedUser);

        if (savedPass) {
          setPassword(savedPass);
        }

        setRememberMe(true);
      }
    } catch (error) {
      console.log('Error loading credentials:', error);
    }
  };

  const isSubscriptionActive = (endDate) => {
    if (!endDate) return false;

    return new Date(endDate) > new Date();
  };

  const savePushToken = async (role, schoolId, username, token) => {
    try {
      const safeUser = username.replace(/\./g, ',');

      let userPath = '';

      if (role === 'school') {
        userPath = `users/${safeUser}`;
      } else if (role === 'driver') {
        userPath = `schools/${schoolId}/drivers/${safeUser}`;
      } else if (role === 'staff') {
        userPath = `schools/${schoolId}/staff/${safeUser}`;
      } else if (role === 'parent') {
        userPath = `schools/${schoolId}/parents/${safeUser}`;
      }

      if (userPath) {
        await update(ref(db, userPath), {
          expoPushToken: token,
        });
      }

    } catch (e) {
      console.log('Push token save error:', e);
    }
  };

  const navigateToDashboard = async (userRole, userData, schoolId) => {
    const params = {
      schoolId,
      user: userData,
    };

    try {
      const token = await registerForPushNotificationsAsync();

      if (token && userData?.username) {
        await savePushToken(
          userRole,
          schoolId,
          userData.username,
          token
        );
      }

    } catch (e) {}

    if (userRole === 'superadmin') {
      navigation.replace('SuperAdminScreen', params);

    } else if (userRole === 'school') {
      navigation.replace('SchoolScreen', params);

    } else if (userRole === 'driver') {
      navigation.replace('DriverScreen', params);

    } else if (userRole === 'staff') {
      navigation.replace('StaffScreen', params);

    } else if (userRole === 'parent') {
      navigation.replace('ParentScreen', params);
    }
  };

  const hashPassword = (pw) => {
    let hash = 0;

    for (let i = 0; i < pw.length; i++) {
      const char = pw.charCodeAt(i);

      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(36);
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
      if (rememberMe) {
        await AsyncStorage.setItem(
          'remembered_username',
          enteredUser
        );

        await AsyncStorage.setItem(
          'remembered_password',
          enteredPass
        );

        await AsyncStorage.setItem(
          'remember_me_status',
          'true'
        );

      } else {
        await AsyncStorage.removeItem('remembered_username');
        await AsyncStorage.removeItem('remembered_password');

        await AsyncStorage.setItem(
          'remember_me_status',
          'false'
        );
      }

      // تسجيل دخول المدير العام
      if (enteredUser === 'admin') {

        const adminSnapshot = await getWithTimeout(
          ref(db, 'admin_settings/super_admin'),
          8000
        );

        const adminData = adminSnapshot.val();

        if (
          adminData &&
          enteredPass === adminData.password
        ) {

          const sessionData = {
            username: 'admin',
            role: 'superadmin',
          };

          await AsyncStorage.setItem(
            'user_session',
            JSON.stringify(sessionData)
          );

          setLoading(false);

          await navigateToDashboard(
            'superadmin',
            sessionData,
            null
          );

          return;
        }

        Alert.alert('❌', t.errorWrong);
        setLoading(false);
        return;
      }

      const safeUser = enteredUser.replace(/\./g, ',');

      // البحث في الفهرس
      const userIndexSnapshot = await getWithTimeout(
        ref(db, `userIndex/${safeUser}`),
        8000
      );

      const userIndex = userIndexSnapshot.val();

      if (!userIndex || !userIndex.schoolId) {
        Alert.alert('❌', t.errorWrong);
        setLoading(false);
        return;
      }

      const { schoolId, role } = userIndex;

      // التحقق من المدرسة
      const schoolSnapshot = await getWithTimeout(
        ref(db, `schools/${schoolId}`),
        8000
      );

      const schoolData = schoolSnapshot.val();

      if (
        !schoolData ||
        !isSubscriptionActive(schoolData.endDate)
      ) {
        Alert.alert('❌', t.errorInactive);
        setLoading(false);
        return;
      }

      let userData = null;

      // حساب المدرسة
      if (role === 'school') {

        const snap = await getWithTimeout(
          ref(db, `users/${safeUser}`),
          8000
        );

        userData = snap.val();

      } else {

        let rolePath = '';

        if (role === 'driver') {
          rolePath = 'drivers';

        } else if (role === 'staff') {
          rolePath = 'staff';

        } else if (role === 'parent') {
          rolePath = 'parents';

        } else if (role === 'manager') {
          rolePath = 'managers';
        }

        const snap = await getWithTimeout(
          ref(
            db,
            `schools/${schoolId}/${rolePath}/${safeUser}`
          ),
          8000
        );

        userData = snap.val();
      }

      if (
        !userData ||
        (
          userData.password !== enteredPass &&
          hashPassword(enteredPass) !== userData.password
        )
      ) {
        Alert.alert('❌', t.errorWrong);
        setLoading(false);
        return;
      }

      const sessionData = {
        ...userData,
        username: enteredUser,
        role,
        schoolId,
        schoolName: schoolData.name,
      };

      await AsyncStorage.setItem(
        'user_session',
        JSON.stringify(sessionData)
      );

      setLoading(false);

      await navigateToDashboard(
        role,
        sessionData,
        schoolId
      );

    } catch (error) {
      console.error('Login error:', error);

      Alert.alert(
        '❌',
        t.errorGeneral
      );

      setLoading(false);
    }
  };

  const handleContactUs = () => {
    Linking.openURL('https://wa.me/+9660000000000');
  };

  return (
    <View style={styles.container}>

      <StatusBar
        barStyle="light-content"
        backgroundColor="#0A1628"
      />

      <View style={StyleSheet.absoluteFill}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />
      </View>

      <Animated.View
        style={[
          styles.langBtnWrapper,
          { opacity: logoAnim }
        ]}
      >
        <TouchableOpacity
          style={styles.langBtn}
          onPress={toggleLang}
          activeOpacity={0.8}
        >
          <Animated.Text
            style={[
              styles.langBtnText,
              { opacity: langAnim }
            ]}
          >
            {lang === 'ar'
              ? '🇬🇧 EN'
              : '🇸🇦 عر'}
          </Animated.Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.content}>

        <Animated.View
          style={[
            styles.logoSection,
            { opacity: logoAnim }
          ]}
        >
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoIcon}>🚌</Text>
          </View>

          <Text style={styles.appName}>
            {t.appName}
          </Text>

          <Text style={styles.appTagline}>
            {t.appTagline}
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim }
              ],
            },
          ]}
        >

          <Text
            style={[
              styles.cardTitle,
              {
                textAlign: isRTL
                  ? 'right'
                  : 'left',
              },
            ]}
          >
            {t.loginTitle}
          </Text>

          <Text
            style={[
              styles.cardSubtitle,
              {
                textAlign: isRTL
                  ? 'right'
                  : 'left',
              },
            ]}
          >
            {t.loginSubtitle}
          </Text>

          <Text
            style={[
              styles.inputLabel,
              {
                textAlign: isRTL
                  ? 'right'
                  : 'left',
              },
            ]}
          >
            👤 {t.usernameLabel}
          </Text>

          <View
            style={[
              styles.inputContainer,
              usernameFocused &&
              styles.inputContainerFocused,
            ]}
          >
            <TextInput
              style={[
                styles.input,
                {
                  textAlign: isRTL
                    ? 'right'
                    : 'left',
                },
              ]}
              placeholder={t.usernamePlaceholder}
              placeholderTextColor="#94A3B8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              onFocus={() =>
                setUsernameFocused(true)
              }
              onBlur={() =>
                setUsernameFocused(false)
              }
            />
          </View>

          <Text
            style={[
              styles.inputLabel,
              {
                textAlign: isRTL
                  ? 'right'
                  : 'left',
                marginTop: 14,
              },
            ]}
          >
            🔒 {t.passwordLabel}
          </Text>

          <View
            style={[
              styles.inputContainer,
              passwordFocused &&
              styles.inputContainerFocused,
            ]}
          >
            <TextInput
              style={[
                styles.input,
                {
                  textAlign: isRTL
                    ? 'right'
                    : 'left',
                },
              ]}
              placeholder={t.passwordPlaceholder}
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={isPasswordSecure}
              onFocus={() =>
                setPasswordFocused(true)
              }
              onBlur={() =>
                setPasswordFocused(false)
              }
            />

            <TouchableOpacity
              onPress={() =>
                setIsPasswordSecure(
                  !isPasswordSecure
                )
              }
              style={styles.eyeButton}
            >
              <Text style={styles.eyeIcon}>
                {isPasswordSecure
                  ? '👁️'
                  : '🙈'}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.rememberMeRow,
              {
                flexDirection: isRTL
                  ? 'row-reverse'
                  : 'row',
              },
            ]}
          >
            <Text style={styles.rememberMeText}>
              {t.rememberMe}
            </Text>

            <TouchableOpacity
              style={[
                styles.toggle,
                rememberMe &&
                styles.toggleActive,
              ]}
              onPress={() =>
                setRememberMe(!rememberMe)
              }
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.toggleThumb,
                  {
                    left: rememberMe
                      ? undefined
                      : 3,

                    right: rememberMe
                      ? 3
                      : undefined,
                  },
                ]}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.loginButton,
              loading &&
              styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator
                color="#fff"
                size="small"
              />
            ) : (
              <Text style={styles.loginButtonText}>
                {isRTL
                  ? `← ${t.loginBtn}`
                  : `${t.loginBtn} →`}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactButton}
            onPress={handleContactUs}
            activeOpacity={0.8}
          >
            <Text style={styles.contactButtonText}>
              {t.contactUs}
            </Text>
          </TouchableOpacity>

        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },

  circle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#1E3A5F',
    top: -80,
    right: -80,
    opacity: 0.6,
  },

  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#F59E0B',
    bottom: 80,
    left: -60,
    opacity: 0.08,
  },

  circle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#3B82F6',
    top: height * 0.4,
    right: -40,
    opacity: 0.1,
  },

  langBtnWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 20,
    left: 20,
    zIndex: 100,
  },

  langBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },

  langBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },

  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },

  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: '#1E3A5F',
    borderWidth: 2,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 8,
  },

  logoIcon: {
    fontSize: 36,
  },

  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 4,
  },

  appTagline: {
    fontSize: 12,
    color: '#94A3B8',
  },

  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    elevation: 15,
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A1628',
    marginBottom: 4,
  },

  cardSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 20,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },

  inputContainerFocused: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBF0',
  },

  input: {
    flex: 1,
    fontSize: 14,
    color: '#0A1628',
    height: '100%',
  },

  eyeButton: {
    padding: 6,
  },

  eyeIcon: {
    fontSize: 16,
  },

  rememberMeRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 20,
  },

  rememberMeText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },

  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    position: 'relative',
  },

  toggleActive: {
    backgroundColor: '#F59E0B',
  },

  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFF',
    position: 'absolute',
    top: 2.5,
    elevation: 2,
  },

  loginButton: {
    backgroundColor: '#0A1628',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  loginButtonDisabled: {
    opacity: 0.7,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  contactButton: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  contactButtonText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
});