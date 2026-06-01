import React, { useState, useEffect, useMemo } from 'react';
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
import { db, storage } from '../../../../firebaseConfig';
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
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [inboxMessages, setInboxMessages] = useState([]);

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

    const inboxRef = ref(db, 'admin_inbox');
    const unsubscribeInbox = onValue(inboxRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let allMsgs = [];
        Object.keys(data).forEach(schoolId => {
          const schoolMsgs = data[schoolId];
          Object.keys(schoolMsgs).forEach(msgId => {
            allMsgs.push({ ...schoolMsgs[msgId], id: msgId, schoolId });
          });
        });
        setInboxMessages(allMsgs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      } else {
        setInboxMessages([]);
      }
    });

    return () => { unsubscribe(); unsubscribeInbox(); };
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

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) {
      setLoading(true);
      try {
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const storageRef = sRef(storage, `logos/${Date.now()}`);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        setLogoUrl(url);
      } catch (e) { Alert.alert('خطأ في الرفع', e.message); }
      finally { setLoading(false); }
    }
  };

  const handleSaveSchool = async () => {
    if (!schoolName || !adminEmail || !adminPassword) {
      Alert.alert('خطأ', 'يرجى تعبئة الحقول الأساسية');
      return;
    }
    setLoading(true);
    try {
      const schoolId = editingSchoolId || schoolName.toLowerCase().replace(/\s+/g, '_');
      const safeKey = adminEmail.replace(/\./g, ',');
      
      const schoolData = {
        name: schoolName,
        displayName: displayName || schoolName,
        logoUrl,
        googleMapsLink,
        planType,
        email: adminEmail,
        password: adminPassword,
        startDate: new Date(startDateStr).toISOString(),
        endDate: new Date(endDateStr).toISOString(),
        status: 'active'
      };

      await update(ref(db, `schools/${schoolId}`), schoolData);
      
      // تحديث الفهرس العام للمستخدمين
      await set(ref(db, `userIndex/${safeKey}`), { schoolId, role: 'school' });
      await set(ref(db, `users/${safeKey}`), {
        username: adminEmail,
        password: adminPassword,
        role: 'schoolAdmin',
        name: displayName || schoolName,
        schoolId
      });

      // تهيئة الفروع إذا كانت مدرسة جديدة
      if (!editingSchoolId) {
        const branches = ['drivers', 'students', 'parents', 'staff', 'bus', 'tracking', 'managers', 'emergencies', 'reports', 'messages'];
        for (const b of branches) {
          await set(ref(db, `schools/${schoolId}/${b}/_init`), true);
        }
      }

      Alert.alert('نجاح', 'تم حفظ بيانات المدرسة بنجاح');
      resetForm();
    } catch (e) { Alert.alert('خطأ', e.message); }
    finally { setLoading(false); }
  };

  const onToggleSchoolStatus = async (id, isCurrentlySuspended) => {
    try {
      await update(ref(db, `schools/${id}`), { status: isCurrentlySuspended ? 'active' : 'suspended' });
    } catch (e) { Alert.alert('خطأ', e.message); }
  };

  const checkSubscriptionStatus = (endDate, status) => {
    if (status === 'suspended') return { text: 'موقوف 🚫', color: '#EF4444' };
    const isExpired = new Date(endDate) < new Date();
    return isExpired ? { text: 'منتهي ⏳', color: '#F59E0B' } : { text: 'نشط ✅', color: '#10B981' };
  };

  const getPlanLimits = (type) => {
    const plans = { '1': { label: 'أساسية (3 باصات)', max: 3 }, '2': { label: 'متقدمة (10 باصات)', max: 10 }, '3': { label: 'احترافية (مفتوح)', max: 999 } };
    return plans[type] || plans['1'];
  };

  const formatDate = (dateStr) => {
    try { return new Date(dateStr).toLocaleDateString('ar-EG'); }
    catch (e) { return '---'; }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    setShowReportsModal(true);
    try {
      const schoolIds = schools.map(s => s.id);
      let totals = { buses: 0, students: 0, parents: 0, staff: 0, managers: 0 };
      
      const details = await Promise.all(schoolIds.map(async (id) => {
        const school = schools.find(s => s.id === id);
        const [d, s, p, st, m] = await Promise.all([
          get(ref(db, `schools/${id}/drivers`)),
          get(ref(db, `schools/${id}/students`)),
          get(ref(db, `schools/${id}/parents`)),
          get(ref(db, `schools/${id}/staff`)),
          get(ref(db, `schools/${id}/managers`))
        ]);
        
        const count = (snap) => snap.exists() ? Object.keys(snap.val()).filter(k => k !== '_init').length : 0;
        const dCount = count(d), sCount = count(s), pCount = count(p), stCount = count(st), mCount = count(m);
        
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
        <TouchableOpacity style={styles.mainActionBtn} onPress={() => setShowInboxModal(true)}>
          <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
            <Text style={styles.iconText}>📥</Text>
            {inboxMessages.length > 0 && <View style={styles.unreadBadge} />}
          </View>
          <Text style={styles.actionBtnLabel}>الرسائل الواردة</Text>
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
              <div style={styles.logoSection}>
                <TouchableOpacity style={styles.logoUpload} onPress={pickImage}>
                  {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.uploadedLogo} /> : (
                    <View style={styles.uploadPlaceholder}><Text style={{ fontSize: 30 }}>📸</Text><Text style={styles.uploadText}>رفع الشعار</Text></View>
                  )}
                </TouchableOpacity>
              </div>
              <TextInput style={styles.input} placeholder="اسم المدرسة (انجليزي)" value={schoolName} onChangeText={setSchoolName} />
              <TextInput style={styles.input} placeholder="اسم المدرسة للعرض (عربي)" value={displayName} onChangeText={setDisplayName} />
              <TextInput style={styles.input} placeholder="رابط جوجل مابس" value={googleMapsLink} onChangeText={setGoogleMapsLink} />
              <TextInput style={styles.input} placeholder="بريد المدير" value={adminEmail} onChangeText={setAdminEmail} keyboardType="email-address" />
              <TextInput style={styles.input} placeholder="كلمة المرور" value={adminPassword} onChangeText={setAdminPassword} secureTextEntry />
              
              <Text style={styles.label}>تواريخ الاشتراك (YYYY-MM-DD):</Text>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                <TextInput style={[styles.input, { width: '48%' }]} placeholder="بداية" value={startDateStr} onChangeText={setStartDateStr} />
                <TextInput style={[styles.input, { width: '48%' }]} placeholder="نهاية" value={endDateStr} onChangeText={setEndDateStr} />
              </View>

              <Text style={styles.label}>نوع الباقة:</Text>
              <View style={styles.planSelector}>
                {['1', '2', '3'].map(p => (
                  <TouchableOpacity key={p} style={[styles.planBtn, planType === p && styles.planBtnActive]} onPress={() => setPlanType(p)}>
                    <Text style={[styles.planText, planType === p && styles.planTextActive]}>{getPlanLimits(p).label.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalAction, styles.saveBtn]} onPress={handleSaveSchool} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalActionText}>حفظ المدرسة ✅</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalAction, styles.cancelBtn]} onPress={resetForm}>
                  <Text style={styles.modalActionText}>إلغاء ❌</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* مودال التقارير */}
      <Modal visible={showReportsModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '95%', maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>📊 التقارير الشاملة للنظام</Text>
            {loadingReports ? <ActivityIndicator size="large" color="#3B82F6" /> : (
              <ScrollView>
                <View style={styles.statsSummary}>
                  <View style={styles.summaryBox}><Text style={styles.summaryVal}>{reportsData.totalSchools}</Text><Text style={styles.summaryLab}>مدارس</Text></View>
                  <View style={styles.summaryBox}><Text style={styles.summaryVal}>{reportsData.totalBuses}</Text><Text style={styles.summaryLab}>باصات</Text></View>
                  <View style={styles.summaryBox}><Text style={styles.summaryVal}>{reportsData.totalStudents}</Text><Text style={styles.summaryLab}>طلاب</Text></View>
                </View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>المدرسة</Text>
                  <Text style={styles.tableCell}>باص</Text>
                  <Text style={styles.tableCell}>طالب</Text>
                  <Text style={styles.tableCell}>ولي أمر</Text>
                </View>
                {reportsData.schoolsDetails.map(item => (
                  <View key={item.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 2, textAlign: 'right' }]}>{item.name}</Text>
                    <Text style={styles.tableCell}>{item.drivers}</Text>
                    <Text style={styles.tableCell}>{item.students}</Text>
                    <Text style={styles.tableCell}>{item.parents}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowReportsModal(false)}>
              <Text style={styles.closeModalText}>إغلاق النافذة</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال إرسال رسالة */}
      <Modal visible={showMsgModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✉️ إرسال رسالة {msgTarget ? `إلى ${msgTarget.displayName || msgTarget.name}` : 'عامة'}</Text>
            <TextInput 
              style={styles.msgInput} 
              placeholder="اكتب محتوى الرسالة هنا..." 
              multiline 
              value={msgContent} 
              onChangeText={setMsgContent} 
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalAction, styles.saveBtn]} onPress={handleSendMessage} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalActionText}>إرسال الآن 🚀</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalAction, styles.cancelBtn]} onPress={() => setShowMsgModal(false)}>
                <Text style={styles.modalActionText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* مودال صندوق الوارد */}
      <Modal visible={showInboxModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '95%', maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>📥 الرسائل الواردة من المدارس</Text>
            <FlatList
              data={inboxMessages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.msgCard}>
                  <View style={styles.msgHeader}>
                    <Text style={styles.msgSchool}>{item.schoolName || 'مدرسة'}</Text>
                    <Text style={styles.msgTime}>{formatDate(item.timestamp)}</Text>
                  </View>
                  <Text style={styles.msgContent}>{item.content}</Text>
                  <Text style={styles.msgSender}>بواسطة: {item.sender}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>لا توجد رسائل واردة</Text>}
            />
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowInboxModal(false)}>
              <Text style={styles.closeModalText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 20, backgroundColor: '#FFF', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutText: { color: '#EF4444', fontWeight: 'bold' },
  actionGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', padding: 10, justifyContent: 'space-around' },
  mainActionBtn: { width: '30%', alignItems: 'center', marginBottom: 15 },
  iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 5, elevation: 3 },
  iconText: { fontSize: 22 },
  actionBtnLabel: { fontSize: 11, fontWeight: 'bold', color: '#475569', textAlign: 'center' },
  unreadBadge: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, backgroundColor: '#EF4444', borderRadius: 6, borderWidth: 2, borderColor: '#FFF' },
  searchSection: { paddingHorizontal: 20, marginBottom: 10 },
  searchInput: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', textAlign: 'right' },
  schoolCard: { backgroundColor: '#FFF', marginHorizontal: 15, marginBottom: 12, borderRadius: 15, padding: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 },
  cardLogo: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#F1F5F9' },
  logoPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  schoolName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', textAlign: 'right' },
  schoolEmail: { fontSize: 11, color: '#64748B', textAlign: 'right' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  cardDetails: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  detailText: { fontSize: 12, color: '#475569' },
  cardActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 5 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  actionText: { fontSize: 11, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#94A3B8' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', width: '90%', borderRadius: 25, padding: 20, elevation: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 20, textAlign: 'center' },
  logoSection: { alignItems: 'center', marginBottom: 15 },
  logoUpload: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  uploadedLogo: { width: '100%', height: '100%' },
  uploadPlaceholder: { alignItems: 'center' },
  uploadText: { fontSize: 10, color: '#64748B', marginTop: 5 },
  input: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12, textAlign: 'right' },
  label: { fontSize: 12, fontWeight: 'bold', color: '#475569', marginBottom: 8, textAlign: 'right' },
  planSelector: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 20 },
  planBtn: { flex: 1, paddingVertical: 10, marginHorizontal: 4, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
  planBtnActive: { backgroundColor: '#3B82F6' },
  planText: { fontSize: 11, color: '#64748B', fontWeight: 'bold' },
  planTextActive: { color: '#FFF' },
  modalActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 10 },
  modalAction: { flex: 0.48, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  saveBtn: { backgroundColor: '#10B981' },
  cancelBtn: { backgroundColor: '#EF4444' },
  modalActionText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  statsSummary: { flexDirection: 'row-reverse', justifyContent: 'space-around', padding: 15, backgroundColor: '#F0F9FF', borderRadius: 15, marginBottom: 20 },
  summaryBox: { alignItems: 'center' },
  summaryVal: { fontSize: 20, fontWeight: 'bold', color: '#0369A1' },
  summaryLab: { fontSize: 10, color: '#64748B' },
  tableHeader: { flexDirection: 'row-reverse', backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8 },
  tableRow: { flexDirection: 'row-reverse', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tableCell: { flex: 1, textAlign: 'center', fontSize: 11, color: '#475569' },
  closeModalBtn: { marginTop: 20, backgroundColor: '#64748B', padding: 12, borderRadius: 12, alignItems: 'center' },
  closeModalText: { color: '#FFF', fontWeight: 'bold' },
  msgInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 15, textAlign: 'right', height: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 15 },
  msgCard: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 15, marginBottom: 10, borderRightWidth: 4, borderRightColor: '#FEF3C7' },
  msgHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 5 },
  msgSchool: { fontWeight: 'bold', color: '#1E293B' },
  msgTime: { fontSize: 10, color: '#94A3B8' },
  msgContent: { fontSize: 13, color: '#475569', textAlign: 'right', lineHeight: 20 },
  msgSender: { fontSize: 11, color: '#3B82F6', marginTop: 5, textAlign: 'right', fontWeight: 'bold' }
});
