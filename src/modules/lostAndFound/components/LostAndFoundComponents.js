import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

/**
 * مكون بطاقة العنصر المفقود/المعثور عليه
 */
export const LostAndFoundItemCard = ({ item, onClaim, onResolve, onDelete, userRole, isClaimable, onConfirmReceipt }) => {
  const getStatusColor = (status, type) => {
    if (status === 'resolved') return '#3B82F6'; // أزرق للحل
    if (type === 'found') return '#10B981'; // أخضر للمعثور عليه النشط
    if (type === 'lost') return '#F59E0B'; // برتقالي للمفقود النشط
    return '#64748B'; // رمادي افتراضي
  };

  const getStatusText = (status, type) => {
    if (status === 'resolved') return 'تم الحل';
    if (type === 'found') return 'معثور عليه';
    if (type === 'lost') return 'مفقود (مبلغ عنه)';
    return 'غير معروف';
  };

  return (
    <View style={styles.card}>
      {/* الصورة */}
      {item.itemImageURL ? (
        <Image
          source={{ uri: item.itemImageURL }}
          style={styles.itemImage}
        />
      ) : (
        <View style={[styles.itemImage, styles.noImage]}>
          <Text style={styles.noImageText}>📷 لا توجد صورة</Text>
        </View>
      )}

      {/* الحالة والنوع */}
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status, item.type) }]}>
        <Text style={styles.statusText}>{getStatusText(item.status, item.type)}</Text>
      </View>

      {/* المعلومات */}
      <View style={styles.cardContent}>
        <Text style={styles.itemName}>{item.itemName}</Text>
        <Text style={styles.itemDescription}>{item.itemDescription}</Text>

        {/* معلومات الباص */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>🚌 الباص:</Text>
          <Text style={styles.infoValue}>{item.busId}</Text>
        </View>

        {/* معلومات المكتشف/المبلغ */}
        {item.type === 'found' && item.foundByName && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>👤 وجدت بواسطة:</Text>
            <Text style={styles.infoValue}>{item.foundByName}</Text>
          </View>
        )}
        {item.type === 'lost' && item.reportedByParentName && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>👨‍👩‍👧 أبلغ عنه:</Text>
            <Text style={styles.infoValue}>{item.reportedByParentName} ({item.studentName})</Text>
          </View>
        )}

        {/* تاريخ العثور/التبليغ */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📅 التاريخ:</Text>
          <Text style={styles.infoValue}>{new Date(item.foundAt || item.reportedAt).toLocaleDateString('ar-SA')}</Text>
        </View>

        {/* معلومات المطالب (إذا كان هناك) */}
        {item.claimedByParentName && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>✋ طالب به:</Text>
            <Text style={styles.infoValue}>{item.claimedByParentName}</Text>
          </View>
        )}

        {/* معلومات التسليم (إذا تم الحل) */}
        {item.status === 'resolved' && item.returnedAt && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>✅ تم التسليم:</Text>
            <Text style={styles.infoValue}>{new Date(item.returnedAt).toLocaleDateString('ar-SA')}</Text>
          </View>
        )}
      </View>

      {/* الأزرار */}
      <View style={styles.buttonsContainer}>
        {isClaimable && item.type === 'found' && item.status === 'active' && onClaim && (
          <TouchableOpacity
            style={[styles.button, styles.claimButton]}
            onPress={onClaim}
          >
            <Text style={styles.buttonText}>✓ هذا لولدي</Text>
          </TouchableOpacity>
        )}

        {(userRole === 'staff' || userRole === 'admin') && item.status === 'active' && onResolve && (
          <TouchableOpacity
            style={[styles.button, styles.resolveButton]}
            onPress={onResolve}
          >
            <Text style={styles.buttonText}>📦 تم الحل</Text>
          </TouchableOpacity>
        )}

        {(userRole === 'parent' && item.status === 'resolved' && !item.returnConfirmedByParent) && onConfirmReceipt && (
          <TouchableOpacity
            style={[styles.button, styles.confirmReceiptButton]}
            onPress={onConfirmReceipt}
          >
            <Text style={styles.buttonText}>👍 تأكيد الاستلام</Text>
          </TouchableOpacity>
        )}

        {(userRole === 'admin') && onDelete && (
          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={onDelete}
          >
            <Text style={styles.buttonText}>🗑️ حذف</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

/**
 * مكون نموذج إضافة عنصر معثور عليه (للمرافقة/الإدارة)
 */
export const AddFoundItemForm = ({
  formData,
  onFormChange,
  onImagePick,
  onSubmit,
  loading,
  drivers = [],
}) => {
  return (
    <View style={styles.formContainer}>
      {/* اسم العنصر */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>اسم العنصر</Text>
        <TextInput
          style={styles.formInput}
          placeholder="مثال: جاكيت أزرق"
          value={formData.itemName || ''}
          onChangeText={(text) => onFormChange('itemName', text)}
          placeholderTextColor="#CBD5E1"
        />
      </View>

      {/* وصف العنصر */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>وصف العنصر</Text>
        <TextInput
          style={[styles.formInput, styles.textArea]}
          placeholder="أضف وصفاً تفصيلياً للعنصر..."
          value={formData.itemDescription || ''}
          onChangeText={(text) => onFormChange('itemDescription', text)}
          multiline
          numberOfLines={4}
          placeholderTextColor="#CBD5E1"
        />
      </View>

      {/* اختيار الباص */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>اختر الباص الذي وجد فيه العنصر</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.driversList}>
          {drivers.map((driver) => (
            <TouchableOpacity
              key={driver.id}
              style={[
                styles.driverOption,
                formData.busId === driver.username && styles.driverOptionActive,
              ]}
              onPress={() => onFormChange('busId', driver.username)}
            >
              <Text
                style={[
                  styles.driverOptionText,
                  formData.busId === driver.username && styles.driverOptionTextActive,
                ]}
              >
                {driver.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* رفع الصورة */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>صورة العنصر</Text>
        <TouchableOpacity
          style={styles.imagePickButton}
          onPress={onImagePick}
        >
          <Text style={styles.imagePickButtonText}>📷 اختر صورة</Text>
        </TouchableOpacity>
        {formData.itemImageURL && (
          <Image
            source={{ uri: formData.itemImageURL }}
            style={styles.previewImage}
          />
        )}
      </View>

      {/* زر الإضافة */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={onSubmit}
        disabled={loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? '⏳ جاري الإضافة...' : '➕ إضافة العنصر المعثور عليه'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * مكون نموذج الإبلاغ عن عنصر مفقود (لولي الأمر)
 */
export const ReportLostItemForm = ({
  formData,
  onFormChange,
  onImagePick,
  onSubmit,
  loading,
  students = [],
}) => {
  return (
    <View style={styles.formContainer}>
      {/* اسم العنصر */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>اسم العنصر المفقود</Text>
        <TextInput
          style={styles.formInput}
          placeholder="مثال: محفظة، نظارة شمسية"
          value={formData.itemName || ''}
          onChangeText={(text) => onFormChange('itemName', text)}
          placeholderTextColor="#CBD5E1"
        />
      </View>

      {/* وصف العنصر */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>وصف العنصر المفقود</Text>
        <TextInput
          style={[styles.formInput, styles.textArea]}
          placeholder="أضف وصفاً تفصيلياً للعنصر..."
          value={formData.itemDescription || ''}
          onChangeText={(text) => onFormChange('itemDescription', text)}
          multiline
          numberOfLines={4}
          placeholderTextColor="#CBD5E1"
        />
      </View>

      {/* اختيار الطالب */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>الطالب الذي فقد العنصر</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.driversList}>
          {students.map((student) => (
            <TouchableOpacity
              key={student.id}
              style={[
                styles.driverOption,
                formData.studentId === student.id && styles.driverOptionActive,
              ]}
              onPress={() => onFormChange('student', { id: student.id, name: student.name, busId: student.driverUsername })}
            >
              <Text
                style={[
                  styles.driverOptionText,
                  formData.studentId === student.id && styles.driverOptionTextActive,
                ]}
              >
                {student.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* رفع الصورة */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>صورة العنصر (اختياري)</Text>
        <TouchableOpacity
          style={styles.imagePickButton}
          onPress={onImagePick}
        >
          <Text style={styles.imagePickButtonText}>📷 اختر صورة</Text>
        </TouchableOpacity>
        {formData.itemImageURL && (
          <Image
            source={{ uri: formData.itemImageURL }}
            style={styles.previewImage}
          />
        )}
      </View>

      {/* زر الإبلاغ */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled, { backgroundColor: '#EF4444' }]}} // لون أحمر للإبلاغ عن مفقود
        onPress={onSubmit}
        disabled={loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? '⏳ جاري الإبلاغ...' : '🚨 الإبلاغ عن مفقود'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * مكون قائمة العناصر المفقودة/المعثور عليها
 */
export const LostAndFoundList = ({ items, loading, onItemPress, emptyMessage }) => {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{emptyMessage || '✨ لا توجد عناصر حالياً'}</Text>
      </View>
    );
  }

  return (
    <View>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          onPress={() => onItemPress && onItemPress(item)}
        >
          <LostAndFoundItemCard item={item} />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  // بطاقة العنصر
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  itemImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F1F5F9',
  },
  noImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  cardContent: {
    padding: 14,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  itemDescription: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 11,
    color: '#1E293B',
    fontWeight: '500',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  claimButton: {
    backgroundColor: '#10B981',
  },
  resolveButton: {
    backgroundColor: '#3B82F6',
  },
  confirmReceiptButton: {
    backgroundColor: '#F59E0B',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // النموذج
  formContainer: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    textAlign: 'right',
  },
  textArea: {
    textAlignVertical: 'top',
    minHeight: 100,
  },
  driversList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  driverOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  driverOptionActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  driverOptionText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  driverOptionTextActive: {
    color: '#FFF',
  },
  imagePickButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
  },
  imagePickButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    marginTop: 12,
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // قائمة
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
