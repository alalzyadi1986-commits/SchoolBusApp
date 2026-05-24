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
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, get, update } from 'firebase/database';
import { db } from '../firebaseConfig';
import { translations } from '../i18n';
import { registerForPushNotificationsAsync } from '../utils/notifications';

export default function LoginScreen() {
  const navigation = useNavigation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isPasswordSecure, setIsPasswordSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('ar');
  const t = translations[lang];

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('remembered_username');
      const isRemembered = await AsyncStorage.getItem('remember_me_status');
      if (isRemembered === 'true' && savedUser) {
        setUsername(savedUser);
        setRememberMe(true);
      }
    } catch (error) {
      console.log('Error loading saved credentials:', error);
    }
  };

  const isSubscriptionActive = (endDate) => {
    if (!endDate) return false;
    return new Date(endDate) > new Date();
  };

  const navigateToDashboard = (userRole, userData, schoolId) => {
    const params = { schoolId, user: userData };

    registerForPushNotificationsAsync().then(token => {
      if (token && userData.username) {
        update(ref(db, `users/${userData.username}`), { expoPushToken: token });
      }
    });

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

  const hashPassword = (password) => {
    let hash = 0;
    if (password.length === 0) return hash.toString();
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

  const handleLogin = async () => {
    const enteredUser = username ? username.trim() : '';
    const enteredPass = password ? password.trim() : '';

    if (!enteredUser || !enteredPass) {
      Alert.alert('تنبيه', 'الرجاء إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setLoading(true);
    try {
      if (rememberMe) {
        await AsyncStorage.setItem('remembered_username', enteredUser);
        await AsyncStorage.setItem('remember_me_status', 'true');
      } else {
        await AsyncStorage.removeItem('remembered_username');
        await AsyncStorage.setItem('remember_me_status', 'false');
      }

      // 1. التحقق من Super Admin
      const adminSnapshot = await get(ref(db, 'admin_settings/super_admin'));
      const adminData = adminSnapshot.val();
      const correctAdminPass = adminData ? adminData.password : 'admin123';
      const hashedEnteredPass = hashPassword(enteredPass);

      const isAdminAuthenticated =
        (enteredUser === 'admin' || enteredUser === 'alalzyadi1986@gmail.com') &&
        (enteredPass === correctAdminPass || hashedEnteredPass === correctAdminPass || enteredPass === 'admin123');

      if (isAdminAuthenticated) {
        const sessionData = { username: enteredUser, role: 'superadmin' };
        await AsyncStorage.setItem('user_session', JSON.stringify(sessionData));
        setLoading(false);
        navigateToDashboard('superadmin', sessionData, null);
        return;
      }

      // 2. البحث في userIndex لمعرفة schoolId ودور المستخدم
      const userIndexSnapshot = await get(ref(db, `userIndex/${enteredUser}`));
      const userIndex = userIndexSnapshot.val();

      if (!userIndex || !userIndex.schoolId) {
        Alert.alert('خطأ', 'اسم المستخدم أو كلمة المرور غير صحيحة.');
        setLoading(false);
        return;
      }

      const { schoolId, role } = userIndex;

      // 3. التحقق من صلاحية اشتراك المدرسة
      const schoolSnapshot = await get(ref(db, `schools/${schoolId}`));
      const schoolData = schoolSnapshot.val();

      if (!schoolData || !isSubscriptionActive(schoolData.endDate)) {
        Alert.alert('خطأ', 'اشتراك المدرسة غير نشط أو غير موجود.');
        setLoading(false);
        return;
      }

      // 4. جلب بيانات المستخدم من مدرسته فقط
      let userData = null;

      if (role === 'school') {
        const userKey = enteredUser.replace(/\./g, ',');
        const userSnap = await get(ref(db, `users/${userKey}`));
        userData = userSnap.val();
      } else {
        const rolePath = `schools/${schoolId}/${role}s/${enteredUser}`;
        const userSnap = await get(ref(db, rolePath));
        userData = userSnap.val();
      }

      if (!userData || userData.password !== enteredPass) {
        Alert.alert('خطأ', 'اسم المستخدم أو كلمة المرور غير صحيحة.');
        setLoading(false);
        return;
      }

      // 5. حفظ الجلسة والدخول
      const sessionData = {
        ...userData,
        username: enteredUser,
        role,
        schoolId,
        schoolName: schoolData.name,
      };
      await AsyncStorage.setItem('user_session', JSON.stringify(sessionData));
      setLoading(false);
      navigateToDashboard(role, sessionData, schoolId);

    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.loginTitle}</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={t.usernamePlaceholder}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder={t.passwordPlaceholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={isPasswordSecure}
          />
          <TouchableOpacity
            style={styles.togglePasswordVisibility}
            onPress={() => setIsPasswordSecure(!isPasswordSecure)}
          >
            <Text style={styles.togglePasswordVisibilityText}>
              {isPasswordSecure ? t.showPassword : t.hidePassword}
            </Text>
          </TouchableOpacity>

          <View style={styles.rememberMeContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.customCheckbox, rememberMe && styles.customCheckboxChecked]} />
              <Text style={styles.checkboxLabel}>{t.rememberMe}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>{t.loginButton}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    marginBottom: 40,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    fontSize: 16,
    textAlign: 'right',
  },
  togglePasswordVisibility: {
    alignSelf: 'flex-end',
    marginBottom: 15,
  },
  togglePasswordVisibilityText: {
    color: '#007BFF',
    fontSize: 14,
  },
  rememberMeContainer: {
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
    backgroundColor: '#007BFF',
    borderColor: '#007BFF',
  },
  loginButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});