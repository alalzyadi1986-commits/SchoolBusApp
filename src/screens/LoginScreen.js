import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  Dimensions,
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, get } from 'firebase/database';
import { db } from '../firebaseConfig'; 

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false); 
  const [isPasswordSecure, setIsPasswordSecure] = useState(true); 
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('remembered_username');
      const savedPass = await AsyncStorage.getItem('remembered_password');
      const isRemembered = await AsyncStorage.getItem('remember_me_status');

      if (isRemembered === 'true' && savedUser && savedPass) {
        setUsername(savedUser);
        setPassword(savedPass);
        setRememberMe(true);
      }
    } catch (error) {
      console.log('Error loading saved credentials:', error);
    }
  };

  const navigateToDashboard = (userRole, userData, schoolId) => {
    const params = { schoolId, user: userData };
    
    if (userRole === 'super_admin' || userRole === 'superadmin') {
      navigation.replace('SuperAdminScreen', params);
    } else if (userRole === 'school') {
      navigation.replace('SchoolScreen', params);
    } else if (userRole === 'driver') {
      navigation.replace('DriverScreen', params);
    } else if (userRole === 'attendant' || userRole === 'staff') {
      navigation.replace('StaffScreen', params);
    } else {
      navigation.replace('ParentScreen', params);
    }
  };

  const handleLogin = async () => {
    const enteredUser = username ? username.trim() : "";
    const enteredPass = password ? password.trim() : "";

    if (!enteredUser || !enteredPass) {
      Alert.alert('تنبيه', 'الرجاء إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setLoading(true);

    try {
      if (rememberMe) {
        await AsyncStorage.setItem('remembered_username', enteredUser);
        await AsyncStorage.setItem('remembered_password', enteredPass);
        await AsyncStorage.setItem('remember_me_status', 'true');
      } else {
        await AsyncStorage.removeItem('remembered_username');
        await AsyncStorage.removeItem('remembered_password');
        await AsyncStorage.setItem('remember_me_status', 'false');
      }

      // 1. التحقق من Super Admin
      if ((enteredUser === 'admin' || enteredUser === 'alalzyadi1986@gmail.com') && enteredPass === 'admin123') {
        const sessionData = { username: enteredUser, role: 'superadmin' };
        await AsyncStorage.setItem('user_session', JSON.stringify(sessionData));
        setLoading(false);
        navigateToDashboard('superadmin', sessionData, null);
        return;
      }

      // 2. جلب جميع المدارس للبحث فيها
      const schoolsRef = ref(db, 'schools');
      const snapshot = await get(schoolsRef);
      const allSchools = snapshot.val();

      if (allSchools) {
        for (const schoolId in allSchools) {
          const schoolData = allSchools[schoolId];

          if (schoolData.email === enteredUser && schoolData.password === enteredPass) {
            const sessionData = { ...schoolData, id: schoolId, role: 'school' };
            await AsyncStorage.setItem('user_session', JSON.stringify(sessionData));
            setLoading(false);
            navigateToDashboard('school', sessionData, schoolId);
            return;
          }

          if (schoolData.drivers) {
            for (const driverKey in schoolData.drivers) {
              const driver = schoolData.drivers[driverKey];
              if (driverKey === enteredUser && driver.password === enteredPass) {
                const sessionData = { ...driver, username: driverKey, role: 'driver' };
                await AsyncStorage.setItem('user_session', JSON.stringify(sessionData));
                setLoading(false);
                navigateToDashboard('driver', sessionData, schoolId);
                return;
              }
            }
          }

          if (schoolData.staff) {
            for (const staffKey in schoolData.staff) {
              const staff = schoolData.staff[staffKey];
              if (staffKey === enteredUser && staff.password === enteredPass) {
                const sessionData = { ...staff, username: staffKey, role: 'staff' };
                await AsyncStorage.setItem('user_session', JSON.stringify(sessionData));
                setLoading(false);
                navigateToDashboard('staff', sessionData, schoolId);
                return;
              }
            }
          }

          if (schoolData.parents) {
            for (const parentKey in schoolData.parents) {
              const parent = schoolData.parents[parentKey];
              if (parentKey === enteredUser && parent.password === enteredPass) {
                const sessionData = { ...parent, username: parentKey, role: 'parent' };
                await AsyncStorage.setItem('user_session', JSON.stringify(sessionData));
                setLoading(false);
                navigateToDashboard('parent', sessionData, schoolId);
                return;
              }
            }
          }
        }
      }

      setLoading(false);
      Alert.alert('خطأ في الدخول', 'اسم المستخدم أو كلمة المرور غير صحيحة.');

    } catch (error) {
      setLoading(false);
      console.error("Login Error:", error);
      Alert.alert('خطأ', 'حدث خطأ أثناء محاولة تسجيل الدخول.');
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topDecoration} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer} 
          bounces={false} 
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerArea}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🚌</Text>
            </View>
            <Text style={styles.title}>تطبيق باصات المدارس</Text>
            <Text style={styles.subtitle}>نظام التتبع الذكي والمتكامل</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.welcomeText}>تسجيل الدخول</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>اسم المستخدم</Text>
              <View style={styles.inputWrapper}>
                <TextInput 
                  style={styles.input}
                  placeholder="أدخل اسم المستخدم أو البريد"
                  placeholderTextColor="#94A3B8"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>كلمة المرور</Text>
              <View style={styles.passwordInputContainer}>
                <TouchableOpacity 
                  style={styles.visibilityButton} 
                  onPress={() => setIsPasswordSecure(!isPasswordSecure)}
                >
                  <Text style={styles.visibilityButtonText}>
                    {isPasswordSecure ? "👁️" : "🙈"}
                  </Text>
                </TouchableOpacity>
                <TextInput 
                  style={styles.passwordField}
                  placeholder="أدخل كلمة المرور"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={isPasswordSecure}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.optionsRow}>
              <TouchableOpacity 
                style={styles.checkboxContainer} 
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <Text style={styles.checkboxLabel}>تذكرني</Text>
                <View style={[styles.customCheckbox, rememberMe && styles.customCheckboxChecked]}>
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity>
                <Text style={styles.forgotPasswordText}>نسيت كلمة المرور؟</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
              onPress={handleLogin} 
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.loginButtonText}>دخول</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.supportTitle}>تحتاج لمساعدة؟</Text>
            <TouchableOpacity style={styles.contactBadge}>
              <Text style={styles.contactText}>📞 الدعم الفني: 999999999</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: width * 0.6,
    backgroundColor: '#3B82F6',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 100,
    height: 100,
    backgroundColor: '#FFF',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    marginBottom: 20,
  },
  logoEmoji: {
    fontSize: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 28,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 25,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    textAlign: 'right',
  },
  inputWrapper: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  input: {
    padding: 15,
    fontSize: 16,
    textAlign: 'right',
    color: '#1E293B',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  passwordField: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    textAlign: 'right',
    color: '#1E293B',
  },
  visibilityButton: {
    paddingHorizontal: 15,
  },
  visibilityButtonText: {
    fontSize: 18,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#64748B',
    marginRight: 8,
  },
  customCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customCheckboxChecked: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkmark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loginButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  supportTitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 10,
  },
  contactBadge: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  contactText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
});
