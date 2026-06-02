import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';

export default function SubManagerFormModal({
  visible,
  isEditing,
  managerName,
  setManagerName,
  username,
  setUsername,
  password,
  setPassword,
  permissions,
  togglePermission,
  permissionsList,
  saveManager,
  onClose,
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: '#FFF',
            borderRadius: 20,
            maxHeight: '90%',
            padding: 20,
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: 'bold',
                textAlign: 'right',
                marginBottom: 20,
                color: '#0F172A',
              }}
            >
              {isEditing
                ? 'تعديل مدير فرعي'
                : 'إضافة مدير فرعي'}
            </Text>

            <Text
              style={{
                textAlign: 'right',
                marginBottom: 6,
                color: '#334155',
              }}
            >
              اسم المدير الفرعي
            </Text>

            <TextInput
              value={managerName}
              onChangeText={setManagerName}
              placeholder="اسم المدير الفرعي"
              style={{
                borderWidth: 1,
                borderColor: '#CBD5E1',
                borderRadius: 12,
                padding: 12,
                marginBottom: 15,
                textAlign: 'right',
              }}
            />

            <Text
              style={{
                textAlign: 'right',
                marginBottom: 6,
                color: '#334155',
              }}
            >
              اسم المستخدم
            </Text>

            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="اسم المستخدم"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: '#CBD5E1',
                borderRadius: 12,
                padding: 12,
                marginBottom: 15,
                textAlign: 'right',
              }}
            />

            <Text
              style={{
                textAlign: 'right',
                marginBottom: 6,
                color: '#334155',
              }}
            >
              كلمة المرور
            </Text>

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="كلمة المرور"
              secureTextEntry
              style={{
                borderWidth: 1,
                borderColor: '#CBD5E1',
                borderRadius: 12,
                padding: 12,
                marginBottom: 20,
                textAlign: 'right',
              }}
            />

            <Text
              style={{
                textAlign: 'right',
                fontSize: 18,
                fontWeight: 'bold',
                marginBottom: 12,
                color: '#0F172A',
              }}
            >
              الصلاحيات
            </Text>

            {permissionsList.map((permission) => (
              <View
                key={permission.key}
                style={{
                  flexDirection: 'row-reverse',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    color: '#334155',
                    fontSize: 15,
                  }}
                >
                  {permission.label}
                </Text>

                <Switch
                  value={permissions[permission.key]}
                  onValueChange={() =>
                    togglePermission(permission.key)
                  }
                />
              </View>
            ))}

            <TouchableOpacity
              onPress={saveManager}
              style={{
                backgroundColor: '#3B82F6',
                paddingVertical: 14,
                borderRadius: 12,
                marginTop: 20,
              }}
            >
              <Text
                style={{
                  color: '#FFF',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: 16,
                }}
              >
                حفظ
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: '#E2E8F0',
                paddingVertical: 14,
                borderRadius: 12,
                marginTop: 10,
              }}
            >
              <Text
                style={{
                  color: '#334155',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: 16,
                }}
              >
                إلغاء
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}