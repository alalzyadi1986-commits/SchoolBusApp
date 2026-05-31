import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Modal,
  Image,
  ScrollView
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { db, storage } from '../../../firebaseConfig';
import {
  ref,
  set,
  onValue,
  remove,
  update,
  get,
  push
} from 'firebase/database';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';

import * as ImagePicker from 'expo-image-picker';

// --- المكونات الفرعية ---

const SchoolItem = React.memo(({ item, onEdit, onMsg, onDelete, onToggleStatus, checkStatus, getLimits, format }) => {
  const status = checkStatus(item.endDate, item.status);
  const limits = getLimits(item.planType);
  const isSuspended = item.status === 'suspended';

  return (
    <View style={[styles.schoolCard, isSuspended && { opacity: 0.7, borderRightWidth: 5, borderRightColor: '#EF4444' }]}>
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
        <Text style={styles.detailText}>📅 ينتهي: {format(item.endDate)}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(item)}>
          <Text style={styles.actionText}>تعديل ✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: isSuspended ? '#F0FDF4' : '#FFF1F2' }]} 
          onPress={() => onToggleStatus(item.id, isSuspended)}
        >
          <Text style={[styles.actionText, { color: isSuspended ? '#10B981' : '#EF4444' }]}>
            {isSuspended ? 'تفعيل 🔓' : 'إيقاف 🚫'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F0F9FF' }]} onPress={() => onMsg(item)}>
          <Text style={[styles.actionText, { color: '#0EA5E9' }]}>رسالة ✉️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEF2F2' }]} onPress={() => onDelete(item.id)}>
          <Text style={[styles.actionText, { color: '#EF4444' }]}>حذف 🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function SuperAdminScreen({ navigation }) {
  const [schools, setSchools] = useState([]);
  const [filteredSchools, setFilteredSchools] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // بيانات المدرسة
  const [schoolName, setSchoolName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [planType, setPlanType] = useState('1');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  // تواريخ الاشتراك
  const [startDateStr, setStartDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [endDateStr, setEndDateStr] = useState(new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState(null);

  // حالات الـ Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showMsgModal, setShowMsgModal] = useState(false);

  // إحصائيات التقارير
  const [reportsData, setReportsData] = useState({
    totalSchools: 0,
    totalBuses: 0,
    totalStudents: 0,
    totalParents: 0,
    totalStaff: 0,
    totalManagers: 0,
    schoolsDetails: []
  });
  const [loadingReports, setLoadingReports] = useState(false);

  const [newAdminPass, setNewAdminPass] = useState('');
  const [msgTarget, setMsgTarget] = useState(null);
  const [msgContent, setMsgContent] = useState('');

  useEffect(() => {
    const schoolsRef = ref(db, 'schools');
    const unsubscribe = onValue(schoolsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
        setSchools(list);
        setFilteredSchools(list);
      } else {
        setSchools([]);
        setFilteredSchools([]);
      }
    });
    return () => unsubscribe();
  }, []);

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

  const resetForm = () => {
    setSchoolName('');
    setDisplayName('');
    setLogoUrl('');
    setGoogleMapsLink('');
    setPlanType('1');
    setAdminEmail('');
    setAdminPassword('');
    setStartDateStr(new Date().toISOString().split('T')[0]);
    setEndDateStr(new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]);
    setEditingSchoolId(null);
    setShowFormModal(false);
  };

  const onEditSchool = (item) => {
    setEditingSchoolId(item.id);
    setSchoolName(item.name || '');
    setDisplayName(item.displayName || '');
    setLogoUrl(item.logoUrl || '');
    setGoogleMapsLink(item.googleMapsLink || '');
    setPlanType(item.planType || '1');
    setAdminEmail(item.email || '');
    setAdminPassword(item.password || '');
    if (item.startDate) setStartDateStr(new Date(item.startDate).toISOString().split('T')[0]);
    if (item.endDate) setEndDateStr(new Date(item.endDate).toISOString().split('T')[0]);
    setShowFormModal(true);
  };

  const onToggleSchoolStatus = async (id, currentSuspended) => {
    try {
      await update(ref(db, `schools/${id}`), {
        status: currentSuspended ? 'active' : 'suspended'
      });
      Alert.alert('نجاح', currentSuspended ? 'تم تفعيل المدرسة' : 'تم إيقاف المدرسة مؤقتاً');
    } catch (e) {
      Alert.alert('خطأ', 'فشل في تغيير الحالة');
    }
  };

  const formatDate = useCallback((date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }, []);

  const checkSubscriptionStatus = useCallback((end, status) => {
    if (status === 'suspended') return { text: 'موقوف مؤقتاً 🚫', color: '#EF4444' };
    if (!end) return { text: 'غير محدد', color: '#94A3B8' };
    const today = new Date();
    const expiry = new Date(end);
    return expiry > today ? { text: 'نشط ✅', color: '#10B981' } : { text: 'منتهي ❌', color: '#EF4444' };
  }, []);

  const getPlanLimits = useCallback((type) => {
    switch (type) {
      case '1': return { maxBuses: 3, maxStudents: 50, label: 'الباقة الصغرى (3 باصات)' };
      case '2': return { maxBuses: 7, maxStudents: 200, label: 'الباقة المتوسطة (7 باصات)' };
      case '3': return { maxBuses: 1000, maxStudents: 10000, label: 'الباقة المفتوحة' };
      default: return { maxBuses: 3, maxStudents: 50, label: 'الباقة الصغرى' };
    }
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) uploadImage(result.assets[0].uri);
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
        startDate: new Date(startDateStr).toISOString(),
        endDate: new Date(endDateStr).toISOString(),
        status: 'active',
        role: 'schoolAdmin',
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

  const fetchReports = async () => {
    setLoadingReports(true);
    setShowReportsModal(true);
    try {
      const schoolsSnap = await get(ref(db, 'schools'));
      const schoolsData = schoolsSnap.val();
      if (!schoolsData) {
        setReportsData({ totalSchools: 0, totalBuses: 0, totalStudents: 0, totalParents: 0, totalStaff: 0, totalManagers: 0, schoolsDetails: [] });
        return;
      }

      const schoolIds = Object.keys(schoolsData);
      let totals = { buses: 0, students: 0, parents: 0, staff: 0, managers: 0 };
      
      const details = await Promise.all(schoolIds.map(async (id) => {
        const school = schoolsData[id];
        const countBranch = (branch) => {
          if (!school[branch]) return 0;
          return Object.keys(school[branch]).filter(k => k !== '_init').length;
        };

        const dCount = countBranch('drivers');
        const sCount = countBranch('students');
        const pCount = countBranch('parents');
        const stCount = countBranch('staff');
        const mCount = countBranch('managers');

        totals.buses += dCount;
        totals.students += sCount;
        totals.parents += pCount;
        totals.staff += stCount;
        totals.managers += mCount;

        return { id, name: school.displayName || school.name, drivers: dCount, students: sCount, parents: pCount, staff: stCount, managers: mCount };
      }));

      setReportsData({
        totalSchools: schoolIds.length,
        totalBuses: totals.buses,
        totalStudents: totals.students,
        totalParents: totals.parents,
        totalStaff: totals.staff,
        totalManagers: totals.managers,
        schoolsDetails: details
      });
    } catch (error) {
      Alert.alert('خطأ في جلب التقارير', error.message);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleSendMessage = async () => {
    if (!msgContent.trim()) return;
    setLoading(true);
    try {
      const msg = {
        id: Date.now().toString(),
        content: msgContent,
        sender: 'المدير العام',
        timestamp: new Date().toISOString(),
        type: 'broadcast'
      };
      if (msgTarget) {
        await push(ref(db, `schools/${msgTarget.id}/messages`), msg);
      } else {
        for (const school of schools) {
          await push(ref(db, `schools/${school.id}/messages`), msg);
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

  const handleDeleteSchool = (id) => {
    Alert.alert('تأكيد الحذف', 'سيتم حذف المدرسة وجميع بياناتها نهائياً. هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف نهائي', style: 'destructive', onPress: async () => {
        try {
          const school = schools.find(s => s.id === id);
          if (school && school.email) {
            const safeKey = school.email.replace(/\./g, ',');
            await remove(ref(db, `users/${safeKey}`));
            await remove(ref(db, `userIndex/${safeKey}`));
          }
          await remove(ref(db, `schools/${id}`));
          Alert.alert('تم الحذف', 'تمت إزالة المدرسة بنجاح');
        } catch (e) { Alert.alert('خطأ', e.message); }
      }}
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>لوحة المدير العام 👑</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.mainActionBtn} onPress={() => setShowFormModal(true)}>
          <View style={[styles.iconCircle, { backgroundColor: '#3B82F6' }]}><Text style={styles.iconText}>➕</Text></View>
          <Text style={styles.actionBtnLabel}>إضافة مدرسة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mainActionBtn} onPress={fetchReports}>
          <View style={[styles.iconCircle, { backgroundColor: '#10B981' }]}><Text style={styles.iconText}>📊</Text></View>
          <Text style={styles.actionBtnLabel}>التقارير</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mainActionBtn} onPress={() => { setMsgTarget(null); setShowMsgModal(true); }}>
          <View style={[styles.iconCircle, { backgroundColor: '#0EA5E9' }]}><Text style={styles.iconText}>📢</Text></View>
          <Text style={styles.actionBtnLabel}>رسالة عامة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mainActionBtn} onPress={() => setShowPassModal(true)}>
          <View style={[styles.iconCircle, { backgroundColor: '#64748B' }]}><Text style={styles.iconText}>🔐</Text></View>
          <Text style={styles.actionBtnLabel}>كلمة السر</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <TextInput style={styles.searchInput} placeholder="بحث عن مدرسة..." value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      <FlatList
        data={filteredSchools}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SchoolItem 
            item={item} 
            onEdit={onEditSchool} 
            onToggleStatus={onToggleSchoolStatus}
            onMsg={(s) => { setMsgTarget(s); setShowMsgModal(true); }}
            onDelete={handleDeleteSchool}
            checkStatus={checkSubscriptionStatus}
            getLimits={getPlanLimits}
            format={formatDate}
          />
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>لا توجد مدارس حالياً</Text>}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* مودال إضافة/تعديل مدرسة */}
      <Modal visible={showFormModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingSchoolId ? 'تعديل بيانات المدرسة' : 'إضافة مدرسة جديدة'}</Text>
              <View style={styles.logoSection}>
                <TouchableOpacity style={styles.logoUpload} onPress={pickImage}>
                  {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.uploadedLogo} /> : (
                    <View style={styles.uploadPlaceholder}><Text style={{ fontSize: 30 }}>📸</Text><Text style={styles.uploadText}>رفع الشعار</Text></View>
                  )}
                </TouchableOpacity>
              </View>
              <TextInput style={styles.input} placeholder="اسم المدرسة (انجليزي)" value={schoolName} onChangeText={setSchoolName} />
              <TextInput style={styles.input} placeholder="اسم المدرسة للعرض (عربي)" value={displayName} onChangeText={setDisplayName} />
              <TextInput style={styles.input} placeholder="رابط جوجل مابس" value={googleMapsLink} onChangeText={setGoogleMapsLink} />
              <TextInput style={styles.input} placeholder="بريد المدير" value={adminEmail} onChangeText={setAdminEmail} keyboardType="email-address" />
              <TextInput style={styles.input} placeholder="كلمة المرور" value={adminPassword} onChangeText={setAdminPassword} secureTextEntry />
              
              <Text style={styles.label}>تواريخ الاشتراك (YYYY-MM-DD):</Text>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                <TextInput style={[styles.input, { flex: 0.48 }]} placeholder="البداية" value={startDateStr} onChangeText={setStartDateStr} />
                <TextInput style={[styles.input, { flex: 0.48 }]} placeholder="النهاية" value={endDateStr} onChangeText={setEndDateStr} />
              </View>

              <Text style={styles.label}>باقة الاشتراك:</Text>
              <View style={styles.planContainer}>
                {[{ id: '1', name: 'صغيرة (3)' }, { id: '2', name: 'متوسطة (7)' }, { id: '3', name: 'مفتوحة' }].map(plan => (
                  <TouchableOpacity key={plan.id} style={[styles.planOption, planType === plan.id && styles.planActive]} onPress={() => setPlanType(plan.id)}>
                    <Text style={[styles.planText, planType === plan.id && styles.planTextActive]}>{plan.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSaveSchool} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalBtnText}>{editingSchoolId ? 'تحديث' : 'إنشاء'}</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.closeBtn]} onPress={resetForm}><Text style={styles.modalBtnText}>إلغاء</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* مودال التقارير */}
      <Modal visible={showReportsModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>📊 الإحصائيات العامة للمشروع</Text>
            {loadingReports ? <ActivityIndicator size="large" color="#3B82F6" style={{ margin: 20 }} /> : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.globalStats}>
                  <View style={styles.globalStatItem}><Text style={styles.globalStatVal}>{reportsData.totalSchools}</Text><Text style={styles.globalStatLabel}>مدرسة</Text></View>
                  <View style={styles.globalStatItem}><Text style={styles.globalStatVal}>{reportsData.totalBuses}</Text><Text style={styles.globalStatLabel}>باص</Text></View>
                  <View style={styles.globalStatItem}><Text style={styles.globalStatVal}>{reportsData.totalStudents}</Text><Text style={styles.globalStatLabel}>طالب</Text></View>
                  <View style={styles.globalStatItem}><Text style={styles.globalStatVal}>{reportsData.totalParents}</Text><Text style={styles.globalStatLabel}>أهل</Text></View>
                </View>
                
                <Text style={[styles.label, { textAlign: 'center', marginTop: 15, marginBottom: 10 }]}>تفاصيل المدارس:</Text>
                {reportsData.schoolsDetails.map((school) => (
                  <View key={school.id} style={styles.reportCard}>
                    <Text style={styles.reportSchoolName}>{school.name}</Text>
                    <View style={styles.reportGrid}>
                      <View style={styles.reportItem}><Text style={styles.reportVal}>{school.drivers}</Text><Text style={styles.reportLabel}>سائق</Text></View>
                      <View style={styles.reportItem}><Text style={styles.reportVal}>{school.students}</Text><Text style={styles.reportLabel}>طالب</Text></View>
                      <View style={styles.reportItem}><Text style={styles.reportVal}>{school.parents}</Text><Text style={styles.reportLabel}>أهل</Text></View>
                      <View style={styles.reportItem}><Text style={styles.reportVal}>{school.staff}</Text><Text style={styles.reportLabel}>مرافق</Text></View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={[styles.modalBtn, styles.closeBtn, { marginTop: 15 }]} onPress={() => setShowReportsModal(false)}><Text style={styles.modalBtnText}>إغلاق</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودالات أخرى (كلمة السر والرسائل) */}
      <Modal visible={showPassModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تغيير كلمة سر المدير العام</Text>
            <TextInput style={styles.input} placeholder="كلمة السر الجديدة" value={newAdminPass} onChangeText={setNewAdminPass} secureTextEntry />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={async () => {
                if (!newAdminPass.trim()) return;
                setLoading(true);
                try {
                  await set(ref(db, 'admin_settings/super_admin/password'), newAdminPass);
                  Alert.alert('نجاح', 'تم التغيير'); setShowPassModal(false); setNewAdminPass('');
                } catch (e) { Alert.alert('خطأ', e.message); } finally { setLoading(false); }
              }}><Text style={styles.modalBtnText}>حفظ</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.closeBtn]} onPress={() => setShowPassModal(false)}><Text style={styles.modalBtnText}>إلغاء</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showMsgModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{msgTarget ? `رسالة إلى: ${msgTarget.displayName}` : 'رسالة عامة للجميع'}</Text>
            <TextInput style={styles.msgInput} placeholder="اكتب رسالتك هنا..." multiline numberOfLines={4} value={msgContent} onChangeText={setMsgContent} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.sendBtn]} onPress={handleSendMessage}><Text style={styles.modalBtnText}>إرسال</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.closeBtn]} onPress={() => setShowMsgModal(false)}><Text style={styles.modalBtnText}>إغلاق</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  actionGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', padding: 15, justifyContent: 'space-between' },
  mainActionBtn: { width: '23%', alignItems: 'center', marginBottom: 10 },
  iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 5, elevation: 3 },
  iconText: { fontSize: 20 },
  actionBtnLabel: { fontSize: 10, fontWeight: 'bold', color: '#475569', textAlign: 'center' },
  searchSection: { paddingHorizontal: 20, marginBottom: 10 },
  searchInput: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', textAlign: 'right' },
  schoolCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 15, marginHorizontal: 20, marginBottom: 15, elevation: 2 },
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
  actionBtn: { padding: 8, borderRadius: 8, minWidth: 60, alignItems: 'center' },
  actionText: { fontSize: 11, fontWeight: 'bold', color: '#3B82F6' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 25, padding: 20, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#1E293B' },
  logoSection: { alignItems: 'center', marginBottom: 20 },
  logoUpload: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
  uploadedLogo: { width: 80, height: 80, borderRadius: 40 },
  uploadPlaceholder: { alignItems: 'center' },
  uploadText: { fontSize: 10, color: '#64748B', marginTop: 5 },
  input: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12, marginBottom: 10, textAlign: 'right', fontSize: 13 },
  label: { fontSize: 13, fontWeight: 'bold', marginBottom: 8, textAlign: 'right', color: '#475569' },
  planContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 },
  planOption: { flex: 1, padding: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, alignItems: 'center', marginHorizontal: 2 },
  planActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  planText: { fontSize: 9, color: '#64748B' },
  planTextActive: { color: '#FFF', fontWeight: 'bold' },
  modalBtns: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 5 },
  saveBtn: { backgroundColor: '#3B82F6' },
  closeBtn: { backgroundColor: '#94A3B8' },
  sendBtn: { backgroundColor: '#0EA5E9' },
  modalBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  msgInput: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 15, textAlign: 'right', height: 100, textAlignVertical: 'top' },
  globalStats: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', backgroundColor: '#F1F5F9', padding: 15, borderRadius: 15 },
  globalStatItem: { width: '48%', backgroundColor: '#FFF', padding: 10, borderRadius: 12, alignItems: 'center', marginBottom: 10, elevation: 2 },
  globalStatVal: { fontSize: 18, fontWeight: 'bold', color: '#3B82F6' },
  globalStatLabel: { fontSize: 10, color: '#64748B', marginTop: 2 },
  reportCard: { backgroundColor: '#FFF', padding: 12, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  reportSchoolName: { fontSize: 14, fontWeight: 'bold', color: '#1E293B', marginBottom: 8, textAlign: 'right' },
  reportGrid: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  reportItem: { alignItems: 'center', flex: 1 },
  reportVal: { fontSize: 14, fontWeight: 'bold', color: '#3B82F6' },
  reportLabel: { fontSize: 8, color: '#64748B', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 40 }
});
