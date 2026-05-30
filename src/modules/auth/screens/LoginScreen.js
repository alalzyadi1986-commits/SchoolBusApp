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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from '@react-navigation/native';

/**
 * المسارات الأصلية المضمونة من كودك
 */
import { loginUser } from '../services/authService';
import { saveUserSession, getUserSession } from '../../../services/sessionService';
import { registerForPushNotificationsAsync } from '../../../utils/notifications';

const { height, width } = Dimensions.get('window');

const i18n = {
  ar: {
    appName: 'حافلتي المدرسية',
    tagline: 'أمان وذكاء في كل رحلة',
    welcome: 'مرحباً بك!',
    subWelcome: 'سجل دخولك لمتابعة أطفالك',
    userPlaceholder: 'اسم المستخدم / الجوال',
    passPlaceholder: 'كلمة المرور',
    loginBtn: 'دخول آمن',
    rememberMe: 'تذكر بياناتي',
    about: 'عن التطبيق',
    contact: 'للاشتراك تواصل معنا',
    security: 'بياناتك مشفرة وآمنة',
  },
  en: {
    appName: 'My School Bus',
    tagline: 'Safety & Intelligence Always',
    welcome: 'Welcome!',
    subWelcome: 'Login to track your kids',
    userPlaceholder: 'Username / Mobile',
    passPlaceholder: 'Password',
    loginBtn: 'Secure Login',
    rememberMe: 'Remember Me',
    about: 'About Us',
    contact: 'Contact Us',
    security: 'Encrypted & Secure Data',
  }
};

export default function LoginScreen() {
  const navigation = useNavigation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('ar');
  const [showPassword, setShowPassword] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const t = i18n[language];

  useEffect(() => {
    checkSavedCredentials();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 1000, useNativeDriver: true })
    ]).start();
  }, []);

  // إصلاح منطق تذكر البيانات
  const checkSavedCredentials = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('remembered_username');
      const savedPass = await AsyncStorage.getItem('remembered_password');
      if (savedUser) {
        setUsername(savedUser);
        if (savedPass) setPassword(savedPass);
        setRememberMe(true);
      }
    } catch (e) {
      console.log("Error loading credentials", e);
    }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('⚠️', language === 'ar' ? 'الرجاء إدخال البيانات' : 'Please enter credentials');
      return;
    }
    setLoading(true);
    try {
      const userData = await loginUser(username, password);
      if (userData) {
        // حفظ البيانات إذا كان خيار "تذكرني" مفعلاً
        if (rememberMe) {
          await AsyncStorage.setItem('remembered_username', username);
          await AsyncStorage.setItem('remembered_password', password);
        } else {
          await AsyncStorage.removeItem('remembered_username');
          await AsyncStorage.removeItem('remembered_password');
        }

        await saveUserSession(userData);
        const screens = { 
          superadmin: 'SuperAdminScreen', 
          school: 'SchoolScreen', 
          schoolAdmin: 'SchoolScreen', 
          subManager: 'SchoolScreen', 
          driver: 'DriverScreen', 
          staff: 'StaffScreen', 
          parent: 'ParentScreen' 
        };
        navigation.replace(screens[userData.role] || 'Login', { user: userData, schoolId: userData.schoolId });
      } else {
        Alert.alert('❌', language === 'ar' ? 'بيانات غير صحيحة' : 'Invalid credentials');
      }
    } catch (e) {
      Alert.alert('❌', 'Login Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Legend Header Section */}
      <View style={styles.legendHeader}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}>
            <Text style={styles.btnIcon}>🌐</Text>
            <Text style={styles.btnLabel}>{language === 'ar' ? 'EN' : 'AR'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.circleBtn} onPress={() => setShowAbout(true)}>
            <Text style={styles.btnIcon}>ℹ️</Text>
            <Text style={styles.btnLabel}>{t.about}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.brandBox}>
          <Text style={styles.legendAppName}>{t.appName}</Text>
          <Text style={styles.legendTagline}>{t.tagline}</Text>
        </View>

        <View style={styles.busIllustration}>
          <Text style={styles.legendBus}>🚌</Text>
          <View style={styles.busShadow} />
        </View>
      </View>

      {/* Legend Form Section */}
      <Animated.View style={[styles.legendCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{t.welcome}</Text>
          <Text style={styles.cardSub}>{t.subWelcome}</Text>
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.legendInput}>
            <Text style={styles.legendIcon}>👤</Text>
            <TextInput
              style={[styles.textInput, { textAlign: language === 'ar' ? 'right' : 'left' }]}
              placeholder={t.userPlaceholder}
              value={username}
              onChangeText={setUsername}
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.legendInput}>
            <Text style={styles.legendIcon}>🔒</Text>
            <TextInput
              style={[styles.textInput, { textAlign: language === 'ar' ? 'right' : 'left' }]}
              placeholder={t.passPlaceholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.legendEye}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.legendOptions}>
          <TouchableOpacity style={styles.legendRemember} onPress={() => setRememberMe(!rememberMe)}>
            <View style={[styles.legendCheck, rememberMe && styles.legendCheckActive]}>
              {rememberMe && <Text style={styles.legendCheckIcon}>✓</Text>}
            </View>
            <Text style={styles.legendRememberText}>{t.rememberMe}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.legendLoginBtn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#1E3A8A" /> : (
            <Text style={styles.legendLoginText}>{t.loginBtn}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.legendFooter}>
          <View style={styles.legendSecurity}>
            <Text style={styles.legendShield}>🛡️</Text>
            <Text style={styles.legendSecurityText}>{t.security}</Text>
          </View>
          <TouchableOpacity onPress={() => Linking.openURL('https://wa.me/+9660000000000')}>
            <Text style={styles.legendContact}>{t.contact}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Modal About */}
      <Modal visible={showAbout} transparent animationType="fade">
        <View style={styles.modalBack}>
          <View style={styles.modalInner}>
            <Text style={styles.modalHeader}>{t.about}</Text>
            <Text style={styles.modalContent}>حافلتي المدرسية: شريككم الموثوق في رحلة تعليمية آمنة ومبتكرة.</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowAbout(false)}>
              <Text style={styles.modalCloseBtnText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E0F2FE' },
  legendHeader: {
    height: height * 0.4,
    backgroundColor: '#0EA5E9',
    borderBottomLeftRadius: 100,
    paddingTop: 40,
    alignItems: 'center',
    position: 'relative',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  circleBtn: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  btnIcon: { fontSize: 18 },
  btnLabel: { fontSize: 8, fontWeight: 'bold', color: '#0369A1' },
  brandBox: { alignItems: 'center', marginTop: 10 },
  legendAppName: { fontSize: 45, fontWeight: '900', color: '#fff', textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: {width: 2, height: 2}, textShadowRadius: 5 },
  legendTagline: { fontSize: 12, color: '#fff', fontWeight: '600', opacity: 0.9, marginTop: -5 },
  busIllustration: { marginTop: 10, alignItems: 'center' },
  legendBus: { fontSize: 100 },
  busShadow: { width: 120, height: 6, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 10, marginTop: -15 },
  legendCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 45,
    padding: 25,
    marginTop: -50,
    elevation: 25,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  cardInfo: { alignItems: 'center', marginBottom: 20 },
  cardTitle: { fontSize: 26, fontWeight: 'bold', color: '#0F172A' },
  cardSub: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 4 },
  inputGroup: { marginBottom: 10 },
  legendInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    paddingHorizontal: 18,
    marginBottom: 15,
    height: 60,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  legendIcon: { fontSize: 20, marginRight: 12 },
  textInput: { flex: 1, fontSize: 15, color: '#1E293B' },
  legendEye: { fontSize: 20, padding: 5 },
  legendOptions: { marginBottom: 20 },
  legendRemember: { flexDirection: 'row', alignItems: 'center' },
  legendCheck: { width: 22, height: 22, borderWidth: 2, borderColor: '#0EA5E9', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  legendCheckActive: { backgroundColor: '#0EA5E9' },
  legendCheckIcon: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  legendRememberText: { fontSize: 14, color: '#475569', fontWeight: '600' },
  legendLoginBtn: {
    backgroundColor: '#FACC15',
    borderRadius: 25,
    height: 65,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FACC15',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  legendLoginText: { fontSize: 20, fontWeight: '900', color: '#1E3A8A' },
  legendFooter: { alignItems: 'center', marginTop: 20 },
  legendSecurity: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  legendShield: { fontSize: 16, marginRight: 6 },
  legendSecurityText: { fontSize: 12, color: '#64748B', fontWeight: '800' },
  legendContact: { fontSize: 13, color: '#0EA5E9', fontWeight: 'bold' },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalInner: { backgroundColor: '#fff', padding: 30, borderRadius: 35, width: '85%', alignItems: 'center' },
  modalHeader: { fontSize: 24, fontWeight: 'bold', color: '#0369A1', marginBottom: 15 },
  modalContent: { fontSize: 16, color: '#475569', textAlign: 'center', lineHeight: 26 },
  modalCloseBtn: { marginTop: 25, backgroundColor: '#0EA5E9', paddingHorizontal: 40, paddingVertical: 12, borderRadius: 15 },
  modalCloseBtnText: { color: '#fff', fontWeight: 'bold' }
});
