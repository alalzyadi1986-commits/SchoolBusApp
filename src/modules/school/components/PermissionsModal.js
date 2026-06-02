import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';

export default function PermissionsModal({
  visible,
  selectedManager,
  permissionsList,
  onClose,
}) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
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
            padding: 20,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              textAlign: 'right',
              marginBottom: 20,
            }}
          >
            صلاحيات المدير الفرعي
          </Text>

          {selectedManager &&
            permissionsList.map((permission) => (
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
                  }}
                >
                  {permission.label}
                </Text>

                <Text
                  style={{
                    color:
                      selectedManager.permissions[
                        permission.key
                      ]
                        ? '#16A34A'
                        : '#DC2626',
                    fontWeight: 'bold',
                  }}
                >
                  {selectedManager.permissions[
                    permission.key
                  ]
                    ? 'مسموح'
                    : 'غير مسموح'}
                </Text>
              </View>
            ))}

          <TouchableOpacity
            onPress={onClose}
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
              }}
            >
              إغلاق
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}