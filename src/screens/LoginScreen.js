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
import { ref, onValue } from 'firebase/database';
import { db } from '../firebaseConfig'; 

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false); 
  const [isPasswordSecure, setIsPasswordSecure] = useState(false); // false تعني كلمة السر ظاهرة افتراضياً
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  // جلب البيانات المحفوظة عند فتح الشاشة
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

  // دالة التوجيه الصحيحة والمطابقة لملف App.js بنسبة 100%
  const navigateToDashboard = (userRole) => {
    if (userRole === 'super_admin' || userRole === 'superadmin') {
      navigation.replace('SuperAdminScreen');
    } else if (userRole === 'school') {
      navigation.replace('SchoolScreen');
    } else if (userRole === 'driver') {
      navigation.replace('DriverScreen');
    } else if (userRole === 'attendant' || userRole === 'staff') {
      navigation.replace('StaffScreen');
    } else {
      navigation.replace('ParentScreen');
    }
  };

  // دالة الفحص والتحقق من الحسابات والـ Firebase
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
    } catch (e) {
      console.log("Error saving remember me status", e);
    }

    // التحقق من حساب المدير العام الثابت (Super Admin)
    if ((enteredUser === 'admin' || enteredUser === 'alalzyadi1986@gmail.com') && enteredPass === 'admin123') {
      const sessionData = { username: 'alalzyadi1986@gmail.com', role: 'superadmin' };
      await AsyncStorage.setItem('user_session', JSON.stringify(sessionData));
      setLoading(false);
      navigateToDashboard('superadmin');
      return;
    }

    // البحث في الحسابات الفرعية الأخرى داخل الفايربيس
    const pathsToCheck = [
      { path: 'schools', role: 'school' },
      { path: 'drivers', role: 'driver' },
      { path: 'attendants', role: 'staff' },
      { path: 'parents', role: 'parent' }
    ];

    let checkCount = 0;
    let foundUser = null;

    pathsToCheck.forEach((item) => {
      const branchRef = ref(db, item.path);
      onValue(branchRef, async (snapshot) => {
        checkCount++;
        const data = snapshot.val();

        if (data && !foundUser) {
          Object.keys(data).forEach((key) => {
            const userObj = data[key];
            const dbUser = userObj && userObj.username ? userObj.username.toString().trim() : null;
            const dbPass = userObj && userObj.password ? userObj.password.toString().trim() : null;

            if (dbUser === enteredUser && dbPass === enteredPass) {
              foundUser = { ...userObj, id: key, role: item.role };
            }
          });
        }

        if (checkCount === pathsToCheck.length) {
          setLoading(false);
          if (foundUser) {
            await AsyncStorage.setItem('user_session', JSON.stringify(foundUser));
            navigateToDashboard(foundUser.role);
          } else {
            Alert.alert('خطأ في الدخول', 'اسم المستخدم أو كلمة المرور غير صحيحة.');
          }
        }
      }, { onlyOnce: true });
    });
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
          {/* حقل اسم المستخدم أو الجيميل */}
          <Text style={styles.label}>اسم المستخدم أو البريد الإلكتروني</Text>
          <TextInput 
            style={styles.input}
            placeholder="أدخل اسم المستخدم أو الجيميل"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {/* حقل كلمة المرور مع زر الإظهار والإخفاء */}
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

          {/* تذكر كلمة السر */}
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

          {/* زر تسجيل الدخول */}
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginButtonText}>تسجيل الدخول</Text>
            )}
          </TouchableOpacity>

          {/* معلومات الهاتف والإيميل الثابتة */}
          <View style={styles.contactInfoArea}>
            <Text style={styles.contactText}>هاتف: 999999999</Text>
            <Text style={styles.contactText}>إيميل: 99999999</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 25,
  },
  logoText: {
    fontSize: 55,
    marginBottom: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 5,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    textAlign: 'right',
    color: '#0F172A',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingLeft: 10,
  },
  passwordField: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    textAlign: 'right',
    color: '#0F172A',
  },
  visibilityButton: {
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visibilityButtonText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },
  checkboxContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#475569',
    marginRight: 8,
    fontWeight: '500',
  },
  customCheckbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
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
    backgroundColor: '#10B981',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 15,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactInfoArea: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  contactText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '500',
  },
});