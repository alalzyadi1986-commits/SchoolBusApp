import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Modal,
  Image
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { db, storage } from '../../../firebaseConfig';
import {
  ref,
  set,
  onValue,
  remove,
  update,
  get
} from 'firebase/database';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';

import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

export default function SuperAdminScreen({ navigation }) {

  const [schools, setSchools] = useState([]);
  const [filteredSchools, setFilteredSchools] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [schoolName, setSchoolName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [planType, setPlanType] = useState('1'); // '1', '2', '3'
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(
    new Date(new Date().setFullYear(new Date().getFullYear() + 1))
  );

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState(null);

  const [showPassModal, setShowPassModal] = useState(false);
  const [newAdminPass, setNewAdminPass] = useState('');

  // ميزة الرسائل
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgTarget, setMsgTarget] = useState(null); // null for all, or school object
  const [msgContent, setMsgContent] = useState('');

  useEffect(() => {
    const schoolsRef = ref(db, 'schools');
    const unsubscribe = onValue(schoolsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((key) => ({
          id: key,
          ...data[key]
        }));
        setSchools(list);
        setFilteredSchools(list);
      } else {
        setSchools([]);
        setFilteredSchools([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // نظام البحث الذكي
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredSchools(schools);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = schools.filter(school => 
        (school.name && school.name.toLowerCase().includes(lowerQuery)) ||
        (school.displayName && school.displayName.toLowerCase().includes(lowerQuery)) ||
        (school.email && school.email.toLowerCase().includes(lowerQuery))
      );
      setFilteredSchools(filtered);
    }
  }, [searchQuery, schools]);

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  const checkSubscriptionStatus = (end) => {
    if (!end) return { text: 'غير محدد', color: '#94A3B8' };
    const today = new Date();
    const expiry = new Date(end);
    return expiry > today ? { text: 'نشط ✅', color: '#10B981' } : { text: 'منتهي ❌', color: '#EF4444' };
  };

  const getPlanLimits = (type) => {
    switch (type) {
      case '1':
        return { maxBuses: 3, maxStudents: 50, label: 'الباقة الصغرى (3 باصات)' };
      case '2':
        return { maxBuses: 7, maxStudents: 200, label: 'الباقة المتوسطة (7 باصات)' };
      case '3':
        return { maxBuses: 1000, maxStudents: 10000, label: 'الباقة المفتوحة' };
      default:
        return { maxBuses: 3, maxStudents: 50, label: 'الباقة الصغرى' };
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri) => {
    setLoading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `logos/${Date.now()}.jpg`;
      const storageRef = sRef(storage, filename);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      setLogoUrl(url);
    } catch (e) {
      Alert.alert('خطأ في الرفع', e.message);
    } finally {
      setLoading(false);
    }
  };

  const generateSchoolId = async () => {
    const snapshot = await get(ref(db, 'schools'));
    const data = snapshot.val();
    if (!data) return 'school_001';
    const ids = Object.keys(data).filter(id => id.startsWith('school_'));
    if (ids.length === 0) return 'school_001';
    const numbers = ids.map(id => parseInt(id.split('_')[1]) || 0);
    return `school_${String(Math.max(...numbers) + 1).padStart(3, '0')}`;
  };

  const handleSaveSchool = async () => {
    if (!schoolName || !displayName || !adminEmail || !adminPassword) {
      Alert.alert('خطأ', 'يرجى تعبئة الحقول الأساسية');
      return;
    }
    setLoading(true);
    try {
      const limits = getPlanLimits(planType);
      const schoolData = {
        name: schoolName,
        displayName,
        logoUrl,
        googleMapsLink,
        planType,
        limits,
        email: adminEmail,
        password: adminPassword,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        role: 'school',
      };
      const safeUserKey = adminEmail.replace(/\./g, ',');

      if (editingSchoolId) {
        await update(ref(db, `schools/${editingSchoolId}`), schoolData);
        await update(ref(db, `users/${safeUserKey}`), { ...schoolData, schoolId: editingSchoolId, username: adminEmail });
        await update(ref(db, `userIndex/${safeUserKey}`), { schoolId: editingSchoolId, role: 'school' });
        Alert.alert('نجاح', 'تم التحديث بنجاح');
      } else {
        const newSchoolId = await generateSchoolId();
        await set(ref(db, `schools/${newSchoolId}`), schoolData);
        const branches = ['drivers', 'students', 'parents', 'staff', 'bus', 'tracking', 'managers', 'emergencies', 'reports', 'messages'];
        for (const branch of branches) {
          await set(ref(db, `schools/${newSchoolId}/${branch}`), { _init: true });
        }
        await set(ref(db, `users/${safeUserKey}`), { ...schoolData, schoolId: newSchoolId, username: adminEmail });
        await set(ref(db, `userIndex/${safeUserKey}`), { schoolId: newSchoolId, role: 'school' });
        Alert.alert('نجاح', 'تمت الإضافة بنجاح');
      }
      resetForm();
    } catch (error) {
      Alert.alert('خطأ', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!msgContent.trim()) return;
    setLoading(true);
    try {
      const msgData = {
        id: Date.now(),
        sender: 'Super Admin',
        content: msgContent,
        timestamp: new Date().toISOString(),
        type: 'admin_broadcast'
      };

      if (msgTarget) {
        // رسالة لمدرسة محددة
        await set(ref(db, `schools/${msgTarget.id}/messages/${msgData.id}`), msgData);
      } else {
        // رسالة لجميع المدارس
        for (const school of schools) {
          await set(ref(db, `schools/${school.id}/messages/${msgData.id}`), msgData);
        }
      }
      Alert.alert('نجاح', 'تم إرسال الرسالة');
      setShowMsgModal(false);
      setMsgContent('');
    } catch (e) {
      Alert.alert('خطأ', e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSchoolName(''); setDisplayName(''); setLogoUrl(''); setGoogleMapsLink('');
    setPlanType('1'); setAdminEmail(''); setAdminPassword('');
    setStartDate(new Date()); setEndDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1)));
    setEditingSchoolId(null);
  };

  const handleEditPress = (school) => {
    setEditingSchoolId(school.id);
    setSchoolName(school.name);
    setDisplayName(school.displayName || school.name);
    setLogoUrl(school.logoUrl || '');
    setGoogleMapsLink(school.googleMapsLink || '');
    setPlanType(school.planType || '1');
    setAdminEmail(school.email);
    setAdminPassword(school.password);
    if (school.startDate) setStartDate(new Date(school.startDate));
    if (school.endDate) setEndDate(new Date(school.endDate));
  };

  const renderSchoolItem = ({ item }) => {
    const status = checkSubscriptionStatus(item.endDate);
    const limits = getPlanLimits(item.planType);
    return (
      <View style={styles.schoolCard}>
        <View style={styles.cardHeader}>
          {item.logoUrl ? (
            <Image source={{ uri: item.logoUrl }} style={styles.cardLogo} />
          ) : (
            <View style={styles.logoPlaceholder}><Text>🏫</Text></View>
          )}
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.schoolName}>{item.displayName || item.name}</Text>
            <Text style={styles.schoolEmail}>{item.email}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
        </View>
        <View style={styles.cardDetails}>
          <Text style={styles.detailText}>📦 {limits.label}</Text>
          <Text style={styles.detailText}>📅 ينتهي: {formatDate(item.endDate)}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleEditPress(item)}>
            <Text style={styles.actionText}>تعديل ✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F0F9FF' }]} onPress={() => { setMsgTarget(item); setShowMsgModal(true); }}>
            <Text style={[styles.actionText, { color: '#0EA5E9' }]}>رسالة ✉️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]} onPress={() => handleDeleteSchool(item.id)}>
            <Text style={[styles.actionText, { color: '#EF4444' }]}>حذف 🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const handleDeleteSchool = (id) => {
    Alert.alert('تأكيد الحذف', 'حذف هذه المدرسة نهائياً؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        setLoading(true);
        try {
          const schoolToDelete = schools.find(s => s.id === id);
          await remove(ref(db, `schools/${id}`));
          if (schoolToDelete?.email) {
            const safeKey = schoolToDelete.email.replace(/\./g, ',');
            await remove(ref(db, `users/${safeKey}`));
            await remove(ref(db, `userIndex/${safeKey}`));
          }
          Alert.alert('نجاح', 'تم الحذف');
        } catch (e) { Alert.alert('خطأ', e.message); }
        finally { setLoading(false); }
      }}
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>لوحة المدير العام 👑</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}>
            <Text style={styles.logoutText}>خروج</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{editingSchoolId ? 'تعديل مدرسة' : 'إضافة مدرسة جديدة'}</Text>
          
          <View style={styles.logoSection}>
            <TouchableOpacity style={styles.logoUpload} onPress={pickImage}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.uploadedLogo} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Text style={{ fontSize: 30 }}>📸</Text>
                  <Text style={styles.uploadText}>رفع الشعار</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <TextInput style={styles.input} placeholder="اسم المدرسة في النظام (انجليزي)" value={schoolName} onChangeText={setSchoolName} />
          <TextInput style={styles.input} placeholder="اسم المدرسة للعرض (عربي)" value={displayName} onChangeText={setDisplayName} />
          <TextInput style={styles.input} placeholder="رابط تقييم جوجل مابس" value={googleMapsLink} onChangeText={setGoogleMapsLink} />
          <TextInput style={styles.input} placeholder="البريد الإلكتروني للمدير" value={adminEmail} onChangeText={setAdminEmail} keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="كلمة المرور" value={adminPassword} onChangeText={setAdminPassword} secureTextEntry />

          <Text style={styles.label}>اختر باقة الاشتراك:</Text>
          <View style={styles.planContainer}>
            {[
              { id: '1', name: 'صغيرة (3)' },
              { id: '2', name: 'متوسطة (7)' },
              { id: '3', name: 'مفتوحة' }
            ].map(plan => (
              <TouchableOpacity key={plan.id} style={[styles.planOption, planType === plan.id && styles.planActive]} onPress={() => setPlanType(plan.id)}>
                <Text style={[styles.planText, planType === plan.id && styles.planTextActive]}>{plan.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSchool} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{editingSchoolId ? 'تحديث البيانات' : 'إنشاء المدرسة'}</Text>}
          </TouchableOpacity>
          {editingSchoolId && <TouchableOpacity onPress={resetForm}><Text style={styles.cancelText}>إلغاء التعديل</Text></TouchableOpacity>}
        </View>

        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>المدارس المسجلة ({filteredSchools.length})</Text>
            <TouchableOpacity style={styles.broadcastBtn} onPress={() => { setMsgTarget(null); setShowMsgModal(true); }}>
              <Text style={styles.broadcastText}>رسالة للجميع 📢</Text>
            </TouchableOpacity>
          </View>
          
          <TextInput 
            style={styles.searchInput} 
            placeholder="بحث ذكي (اسم، بريد، عرض)..." 
            value={searchQuery} 
            onChangeText={setSearchQuery} 
          />

          <FlatList
            data={filteredSchools}
            keyExtractor={item => item.id}
            renderItem={renderSchoolItem}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.emptyText}>لا توجد مدارس مطابقة للبحث</Text>}
          />
        </View>
      </ScrollView>

      {/* مودال الرسائل */}
      <Modal visible={showMsgModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{msgTarget ? `رسالة إلى: ${msgTarget.displayName}` : 'رسالة عامة لجميع المدارس'}</Text>
            <TextInput 
              style={styles.msgInput} 
              placeholder="اكتب رسالتك هنا..." 
              multiline 
              numberOfLines={4} 
              value={msgContent} 
              onChangeText={setMsgContent} 
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.sendBtn]} onPress={handleSendMessage}>
                <Text style={styles.modalBtnText}>إرسال الآن</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.closeBtn]} onPress={() => setShowMsgModal(false)}>
                <Text style={styles.modalBtnText}>إغلاق</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1E293B' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold' },
  formCard: { margin: 20, padding: 20, backgroundColor: '#FFF', borderRadius: 20, elevation: 4 },
  formTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  logoSection: { alignItems: 'center', marginBottom: 20 },
  logoUpload: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
  uploadedLogo: { width: 100, height: 100, borderRadius: 50 },
  uploadPlaceholder: { alignItems: 'center' },
  uploadText: { fontSize: 10, color: '#64748B', marginTop: 5 },
  input: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10, marginBottom: 10, textAlign: 'right' },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 10, textAlign: 'right' },
  planContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 20 },
  planOption: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, alignItems: 'center', marginHorizontal: 2 },
  planActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  planText: { fontSize: 11, color: '#64748B' },
  planTextActive: { color: '#FFF', fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#3B82F6', padding: 15, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  cancelText: { textAlign: 'center', color: '#64748B', marginTop: 10 },
  listSection: { paddingHorizontal: 20 },
  listHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  listTitle: { fontSize: 18, fontWeight: 'bold' },
  broadcastBtn: { backgroundColor: '#0EA5E9', padding: 8, borderRadius: 8 },
  broadcastText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  searchInput: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0', textAlign: 'right' },
  schoolCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 15, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center' },
  cardLogo: { width: 40, height: 40, borderRadius: 20 },
  logoPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  schoolName: { fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  schoolEmail: { fontSize: 12, color: '#64748B', textAlign: 'right' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  cardDetails: { marginTop: 10, padding: 10, backgroundColor: '#F8FAFC', borderRadius: 10 },
  detailText: { fontSize: 12, color: '#475569', textAlign: 'right', marginBottom: 2 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },
  actionBtn: { padding: 8, borderRadius: 8 },
  actionText: { fontSize: 12, fontWeight: 'bold', color: '#3B82F6' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  msgInput: { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 15, textAlign: 'right', height: 100, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
  sendBtn: { backgroundColor: '#3B82F6' },
  closeBtn: { backgroundColor: '#94A3B8' },
  modalBtnText: { color: '#FFF', fontWeight: 'bold' }
});
