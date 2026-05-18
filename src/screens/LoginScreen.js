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
                  placeholder="أدخل اسم المستخدم"
                  placeholderTextColor="#94A3B8"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
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
            <Text style={styles.supportTitle}>لطلب الاشتراك أو الدعم</Text>
            <View style={styles.contactBadge}>
              <Text style={styles.contactText}>📞 الهاتف: 999999</Text>
              <Text style={[styles.contactText, { marginTop: 5 }]}>📧 البريد: 9999999</Text>
            </View>
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
    height: width * 0.5,
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
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 30,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoCircle: {
    width: 80,
    height: 80,
    backgroundColor: '#FFF',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    marginBottom: 15,
  },
  logoEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
    textAlign: 'center',
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
    textAlign: 'right',
  },
  inputWrapper: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  input: {
    padding: 12,
    fontSize: 15,
    textAlign: 'right',
    color: '#1E293B',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  passwordField: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    textAlign: 'right',
    color: '#1E293B',
  },
  visibilityButton: {
    paddingHorizontal: 12,
  },
  visibilityButtonText: {
    fontSize: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 12,
    color: '#64748B',
    marginRight: 8,
  },
  customCheckbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customCheckboxChecked: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkmark: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  loginButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  loginButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    marginTop: 25,
    alignItems: 'center',
  },
  supportTitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 8,
  },
  contactBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  contactText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
});
