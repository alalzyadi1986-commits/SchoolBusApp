import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';

export default function SubManagerCard({
  item,
  index,
  openPermissionsModal,
  openEditModal,
  toggleManagerStatus,
  deleteManager,
}) {
  const isActive = item.active;

  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        backgroundColor: isActive
          ? '#ECFDF5'
          : '#FEF2F2',
        borderWidth: 1,
        borderColor: isActive
          ? '#22C55E'
          : '#EF4444',
        borderRadius: 14,
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      {/* Number Column */}
      <View
        style={{
          width: 55,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isActive
            ? '#DCFCE7'
            : '#FEE2E2',
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: 'bold',
            color: '#0F172A',
          }}
        >
          {index + 1}
        </Text>
      </View>

      {/* Content */}
      <View
        style={{
          flex: 1,
          padding: 10,
        }}
      >
        <Text
          style={{
            textAlign: 'right',
            fontSize: 16,
            fontWeight: 'bold',
            color: '#0F172A',
          }}
        >
          {item.name}
        </Text>

        <Text
          style={{
            textAlign: 'right',
            color: '#475569',
            marginTop: 3,
            fontSize: 13,
          }}
        >
          اسم المستخدم: {item.username}
        </Text>

        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            marginTop: 6,
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: isActive
                ? '#22C55E'
                : '#EF4444',
              marginLeft: 6,
            }}
          />

          <Text
            style={{
              color: isActive
                ? '#16A34A'
                : '#DC2626',
              fontWeight: 'bold',
              fontSize: 13,
            }}
          >
            {isActive ? 'نشط' : 'موقوف'}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row-reverse',
            marginTop: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => openPermissionsModal(item)}
            style={{
              flex: 1,
              backgroundColor: '#3B82F6',
              paddingVertical: 8,
              borderRadius: 8,
              marginHorizontal: 2,
            }}
          >
            <Text
              style={{
                color: '#FFF',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: 11,
              }}
            >
              الصلاحيات
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openEditModal(item)}
            style={{
              flex: 1,
              backgroundColor: '#F59E0B',
              paddingVertical: 8,
              borderRadius: 8,
              marginHorizontal: 2,
            }}
          >
            <Text
              style={{
                color: '#FFF',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: 11,
              }}
            >
              تعديل
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => toggleManagerStatus(item.id)}
            style={{
              flex: 1,
              backgroundColor: isActive
                ? '#EF4444'
                : '#22C55E',
              paddingVertical: 8,
              borderRadius: 8,
              marginHorizontal: 2,
            }}
          >
            <Text
              style={{
                color: '#FFF',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: 11,
              }}
            >
              {isActive ? 'إيقاف' : 'تفعيل'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => deleteManager(item.id)}
            style={{
              flex: 1,
              backgroundColor: '#64748B',
              paddingVertical: 8,
              borderRadius: 8,
              marginHorizontal: 2,
            }}
          >
            <Text
              style={{
                color: '#FFF',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: 11,
              }}
            >
              حذف
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}