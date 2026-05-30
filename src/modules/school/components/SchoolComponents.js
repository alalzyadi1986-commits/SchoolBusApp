import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';

/**
 * مكون بطاقة المعلومات الموحد داخل المدرسة
 */
export const SchoolDataItem = React.memo(({ item, tab, onEdit, onDelete, permissions }) => {
  const canEdit = permissions.edit_items;
  const canDelete = permissions.delete_items;

  return (
    <View style={styles.card}>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardSub}>{item.username}</Text>
        {tab === 'managers' && item.permissions && (
          <Text style={styles.permsSummary}>
            صلاحيات: {Object.keys(item.permissions).filter(k => item.permissions[k]).length}
          </Text>
        )}
      </View>
      <View style={styles.cardActions}>
        {canEdit && (
          <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(item)}>
            <Text style={styles.editBtnText}>تعديل</Text>
          </TouchableOpacity>
        )}
        {canDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item)}>
            <Text style={styles.deleteBtnText}>حذف</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  cardSub: { fontSize: 13, color: '#64748B' },
  permsSummary: { fontSize: 11, color: '#3B82F6', marginTop: 2, fontWeight: 'bold' },
  cardActions: { flexDirection: 'row' },
  editBtn: { padding: 8, backgroundColor: '#EFF6FF', borderRadius: 8, marginRight: 8 },
  editBtnText: { color: '#3B82F6', fontSize: 12, fontWeight: 'bold' },
  deleteBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  deleteBtnText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
});
