import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SubManagerCard from '../components/SubManagerCard';
import SubManagerFormModal from '../components/SubManagerFormModal';
import PermissionsModal from '../components/PermissionsModal';

const DEFAULT_PERMISSIONS = {
  trips: false,
  drivers: false,
  students: false,
  supervisors: false,
  notifications: false,
  schoolLocation: false,
  subManagers: false,
};

const PERMISSIONS_LIST = [
  {
    key: 'trips',
    label: 'إدارة الرحلات',
  },
  {
    key: 'drivers',
    label: 'إدارة السائقين',
  },
  {
    key: 'students',
    label: 'إدارة الطلاب',
  },
  {
    key: 'supervisors',
    label: 'إدارة المشرفين',
  },
  {
    key: 'notifications',
    label: 'إدارة الإشعارات',
  },
  {
    key: 'schoolLocation',
    label: 'تعديل موقع المدرسة',
  },
  {
    key: 'subManagers',
    label: 'إدارة المدراء الفرعيين',
  },
];

export default function SubManagersScreen() {
  const [managers, setManagers] = useState([
    {
      id: '1',
      name: 'أحمد محمد',
      username: 'ahmad_admin',
      password: '123456',
      active: true,
      permissions: {
        trips: true,
        drivers: true,
        students: true,
        supervisors: false,
        notifications: true,
        schoolLocation: false,
        subManagers: false,
      },
    },
    {
      id: '2',
      name: 'خالد علي',
      username: 'khaled_admin',
      password: '123456',
      active: false,
      permissions: {
        trips: true,
        drivers: false,
        students: false,
        supervisors: false,
        notifications: true,
        schoolLocation: false,
        subManagers: false,
      },
    },
  ]);

  const [showFormModal, setShowFormModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] =
    useState(false);

  const [selectedManager, setSelectedManager] =
    useState(null);

  const [isEditing, setIsEditing] = useState(false);

  const [managerName, setManagerName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [permissions, setPermissions] = useState(
    DEFAULT_PERMISSIONS
  );

  const resetForm = () => {
    setManagerName('');
    setUsername('');
    setPassword('');
    setPermissions(DEFAULT_PERMISSIONS);
    setSelectedManager(null);
    setIsEditing(false);
  };

  const openAddModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (manager) => {
    setManagerName(manager.name);
    setUsername(manager.username);
    setPassword(manager.password);

    setPermissions(manager.permissions);

    setSelectedManager(manager);
    setIsEditing(true);

    setShowFormModal(true);
  };

  const saveManager = () => {
    if (
      !managerName.trim() ||
      !username.trim() ||
      !password.trim()
    ) {
      Alert.alert(
        'تنبيه',
        'يرجى تعبئة جميع الحقول'
      );
      return;
    }

    if (isEditing) {
      setManagers((prev) =>
        prev.map((item) =>
          item.id === selectedManager.id
            ? {
                ...item,
                name: managerName,
                username,
                password,
                permissions,
              }
            : item
        )
      );
    } else {
      const usernameExists = managers.some(
        (item) =>
          item.username.toLowerCase() ===
          username.toLowerCase()
      );

      if (usernameExists) {
        Alert.alert(
          'تنبيه',
          'اسم المستخدم مستخدم مسبقاً'
        );
        return;
      }

      const newManager = {
        id: Date.now().toString(),
        name: managerName,
        username,
        password,
        active: true,
        permissions,
      };

      setManagers((prev) => [
        newManager,
        ...prev,
      ]);
    }

    setShowFormModal(false);
    resetForm();
  };

  const deleteManager = (managerId) => {
    Alert.alert(
      'حذف مدير فرعي',
      'هل أنت متأكد من حذف المدير الفرعي؟',
      [
        {
          text: 'إلغاء',
          style: 'cancel',
        },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => {
            setManagers((prev) =>
              prev.filter(
                (item) => item.id !== managerId
              )
            );
          },
        },
      ]
    );
  };

  const toggleManagerStatus = (managerId) => {
    setManagers((prev) =>
      prev.map((item) =>
        item.id === managerId
          ? {
              ...item,
              active: !item.active,
            }
          : item
      )
    );
  };

  const openPermissionsModal = (manager) => {
    setSelectedManager(manager);
    setShowPermissionsModal(true);
  };

  const togglePermission = (key) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <SafeAreaView
  style={{
    flex: 1,
    backgroundColor: '#F8FAFC',
  }}
>
  {/* Header */}
  <View
    style={{
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 16,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#E2E8F0',
    }}
  >
    <Text
      style={{
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1E293B',
        textAlign: 'right',
      }}
    >
      المدراء الفرعيون
    </Text>

    <Text
      style={{
        marginTop: 6,
        color: '#64748B',
        textAlign: 'right',
        fontSize: 14,
      }}
    >
      عدد المدراء الفرعيين: {managers.length}
    </Text>
  </View>

  {/* Managers List */}
  <FlatList
    data={managers}
    keyExtractor={(item) => item.id}
    contentContainerStyle={{
      padding: 12,
      flexGrow: 1,
    }}
    
      renderItem={({ item, index }) => (
  <SubManagerCard
    item={item}
    index={index}
    openPermissionsModal={openPermissionsModal}
    openEditModal={openEditModal}
    toggleManagerStatus={toggleManagerStatus}
    deleteManager={deleteManager}
  />
)}
    ListEmptyComponent={
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <MaterialCommunityIcons
          name="account-tie"
          size={80}
          color="#CBD5E1"
        />

        <Text
          style={{
            marginTop: 12,
            color: '#64748B',
            fontSize: 16,
          }}
        >
          لا يوجد مدراء فرعيون حالياً
        </Text>
      </View>
    }
  />

  {/* Bottom Add Button */}
  <View
    style={{
      padding: 16,
      backgroundColor: '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor: '#E2E8F0',
    }}
  >
    <TouchableOpacity
      onPress={openAddModal}
      style={{
        backgroundColor: '#3B82F6',
        paddingVertical: 14,
        borderRadius: 12,
        flexDirection: 'row-reverse',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <MaterialCommunityIcons
        name="account-plus"
        size={22}
        color="#FFF"
      />

      <Text
        style={{
          color: '#FFF',
          fontSize: 16,
          fontWeight: 'bold',
          marginRight: 10,
        }}
      >
        إضافة مدير فرعي
      </Text>
    </TouchableOpacity>
  </View>
    <SubManagerFormModal
  visible={showFormModal}
  isEditing={isEditing}
  managerName={managerName}
  setManagerName={setManagerName}
  username={username}
  setUsername={setUsername}
  password={password}
  setPassword={setPassword}
  permissions={permissions}
  togglePermission={togglePermission}
  permissionsList={PERMISSIONS_LIST}
  saveManager={saveManager}
  onClose={() => {
    setShowFormModal(false);
    resetForm();
  }}
/>

  <PermissionsModal
  visible={showPermissionsModal}
  selectedManager={selectedManager}
  permissionsList={PERMISSIONS_LIST}
  onClose={() =>
    setShowPermissionsModal(false)
  }
/>
</SafeAreaView>
  );
}