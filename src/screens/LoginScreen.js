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
  ScrollView 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, onValue, get } from 'firebase/database';
import { db } from '../firebaseConfig'; 

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

          // أ- التحقق إذا كان المستخدم هو مدير المدرسة نفسه
          if (schoolData.email === enteredUser && schoolData.password === enteredPass) {
            const sessionData = { ...schoolData, id: schoolId, role: 'school' };
            await AsyncStorage.setItem('user_session', JSON.stringify(sessionData));
            setLoading(false);
            navigateToDashboard('school', sessionData, schoolId);
            return;
          }

          // ب- البحث في السائقين التابعين لهذه المدرسة
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

          // ج- البحث في المرافقين
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

          // د- البحث في الأهل
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
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "none"} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false} showsVerticalScrollIndicator={false}>
        <View style={styles.headerArea}>
          <Text style={styles.logoText}>🚌</Text>
          <Text style={styles.title}>تطبيق باصات المدارس</Text>
          <Text style={styles.subtitle}>مرحباً بك، الرجاء تسجيل الدخول للمتابعة</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>اسم المستخدم أو البريد الإلكتروني</Text>
          <TextInput 
            style={styles.input}
            placeholder="أدخل اسم المستخدم أو الجيميل"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>كلمة المرور</Text>
          <View style={styles.passwordInputContainer}>
            <TouchableOpacity 
              style={styles.visibilityButton} 
              onPress={() => setIsPasswordSecure(!isPasswordSecure)}
            >
              <Text style={styles.visibilityButtonText}>
                {isPasswordSecure ? "إظهار 👁️" : "إخفاء 🙈"}
              </Text>
            </TouchableOpacity>
            <TextInput 
              style={styles.passwordField}
              placeholder="أدخل كلمة المرور"
              secureTextEntry={isPasswordSecure}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity 
            style={styles.checkboxContainer} 
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.8}
          >
            <Text style={styles.checkboxLabel}>تذكر كلمة السر</Text>
            <View style={[styles.customCheckbox, rememberMe && styles.customCheckboxChecked]}>
              {rememberMe && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginButtonText}>تسجيل الدخول</Text>
            )}
          </TouchableOpacity>

          <View style={styles.contactInfoArea}>
            <Text style={styles.contactText}>هاتف الدعم: 999999999</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FB' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  headerArea: { alignItems: 'center', marginBottom: 25 },
  logoText: { fontSize: 55, marginBottom: 5 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 5, textAlign: 'center' },
  formCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 3 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6, marginTop: 10, textAlign: 'right' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 15, textAlign: 'right' },
  passwordInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingLeft: 10 },
  passwordField: { flex: 1, padding: 12, fontSize: 15, textAlign: 'right' },
  visibilityButton: { padding: 5 },
  visibilityButtonText: { fontSize: 12, color: '#3B82F6', fontWeight: '600' },
  checkboxContainer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 15, marginBottom: 10 },
  checkboxLabel: { fontSize: 13, color: '#475569', marginRight: 8 },
  customCheckbox: { width: 18, height: 18, borderWidth: 1.5, borderColor: '#94A3B8', borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  customCheckboxChecked: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  checkmark: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  loginButton: { backgroundColor: '#10B981', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 15 },
  loginButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  contactInfoArea: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9', alignItems: 'center' },
  contactText: { fontSize: 13, color: '#64748B' },
});
