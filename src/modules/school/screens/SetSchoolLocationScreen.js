import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { updateSchoolLocation } from '../services/schoolDataService';

const SetSchoolLocationScreen = ({ route, navigation }) => {
  const { schoolId, currentInfo } = route.params;
  const mapRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(!currentInfo?.location);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [region, setRegion] = useState({
    latitude: currentInfo?.location?.latitude || 24.7136, // الرياض افتراضياً
    longitude: currentInfo?.location?.longitude || 46.6753,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });
  
  const [selectedLocation, setSelectedLocation] = useState(currentInfo?.location || null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه', 'يرجى تفعيل صلاحيات الموقع لتسهيل الوصول لموقع المدرسة');
      }
    })();
  }, []);

  // وظيفة البحث عن اسم المدرسة باستخدام Expo Location Geocoding
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const result = await Location.geocodeAsync(searchQuery);
      if (result && result.length > 0) {
        const { latitude, longitude } = result[0];
        const newLoc = { latitude, longitude };
        
        setSelectedLocation(newLoc);
        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 1000);
      } else {
        Alert.alert('عذراً', 'لم نتمكن من العثور على هذا الموقع، يرجى كتابة اسم المدرسة بدقة أو اسم الحي والمدينة.');
      }
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء البحث، تأكد من اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  const handleMapPress = (e) => {
    if (!isEditing) return;
    setSelectedLocation(e.nativeEvent.coordinate);
  };

  const handleSave = async () => {
    if (!selectedLocation) {
      Alert.alert('خطأ', 'يرجى تحديد موقع المدرسة على الخريطة أولاً');
      return;
    }

    setLoading(true);
    try {
      await updateSchoolLocation(schoolId, {
        ...selectedLocation,
        searchName: searchQuery || null
      });
      Alert.alert('نجاح', 'تم حفظ موقع المدرسة بنجاح. سيظهر الآن لجميع السائقين والأهل.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('خطأ', 'فشل حفظ الموقع. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* الهيدر مع مساحة أمان علوية */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تحديد موقع المدرسة</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.searchSection}>
          <Text style={styles.infoText}>يمكنك البحث عن اسم المدرسة أو الحي لتحديد الموقع:</Text>
          <View style={styles.searchInputContainer}>
            <TextInput
              style={[styles.searchInput, !isEditing && styles.disabledInput]}
              placeholder="اكتب اسم المدرسة هنا..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              editable={isEditing}
            />
            <TouchableOpacity 
              style={[styles.parseButton, !isEditing && styles.disabledBtn]} 
              onPress={handleSearch}
              disabled={!isEditing || loading}
            >
              {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.parseButtonText}>بحث</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.mapContainer}>
          {isEditing && (
            <View style={styles.instructionOverlay}>
              <Text style={styles.instructionText}>قم بتحريك الخريطة أو الضغط لتحديد نقطة المدرسة بدقة</Text>
            </View>
          )}
          
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={region}
            onRegionChangeComplete={(reg) => {
              if (isEditing) setRegion(reg);
            }}
            onPress={handleMapPress}
          >
            {selectedLocation && (
              <Marker 
                coordinate={selectedLocation} 
                title="موقع المدرسة"
                pinColor="#1E293B"
              />
            )}
          </MapView>
          
          {isEditing && (
            <TouchableOpacity 
              style={styles.myLocationBtn}
              onPress={async () => {
                let location = await Location.getCurrentPositionAsync({});
                const newLoc = {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                };
                const newReg = {
                  ...newLoc,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                };
                setRegion(newReg);
                setSelectedLocation(newLoc);
                mapRef.current?.animateToRegion(newReg, 1000);
              }}
            >
              <Ionicons name="locate" size={24} color="#1E293B" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          {!isEditing ? (
            <TouchableOpacity 
              style={styles.editModeButton} 
              onPress={() => setIsEditing(true)}
            >
              <Text style={styles.saveButtonText}>تعديل موقع المدرسة</Text>
              <Ionicons name="create-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.footerBtns}>
              <TouchableOpacity 
                style={[styles.saveButton, { flex: 0.65 }, loading && styles.disabledButton]} 
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.saveButtonText}>حفظ الموقع</Text>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
              
              {currentInfo?.location && (
                <TouchableOpacity 
                  style={[styles.cancelButton, { flex: 0.3 }]} 
                  onPress={() => {
                    setIsEditing(false);
                    setSelectedLocation(currentInfo.location);
                    setRegion({
                      ...currentInfo.location,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    });
                    mapRef.current?.animateToRegion({
                      ...currentInfo.location,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }, 1000);
                  }}
                >
                  <Text style={styles.cancelButtonText}>إلغاء</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    // التعامل مع شريط الحالة
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  backButton: {
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'right',
  },
  searchSection: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    zIndex: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 12,
    textAlign: 'right',
    fontWeight: '600',
  },
  searchInputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 50,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 15,
    textAlign: 'right',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#1E293B',
  },
  disabledInput: {
    backgroundColor: '#F1F5F9',
    color: '#94A3B8',
  },
  parseButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    marginRight: 10,
    elevation: 2,
  },
  disabledBtn: {
    backgroundColor: '#94A3B8',
  },
  parseButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    marginTop: -10,
  },
  instructionOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    padding: 10,
    borderRadius: 10,
    zIndex: 5,
  },
  instructionText: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  myLocationBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    width: 55,
    height: 55,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerBtns: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  saveButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 15,
    elevation: 3,
  },
  editModeButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 15,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 15,
  },
  cancelButtonText: {
    color: '#64748B',
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  disabledButton: {
    opacity: 0.7,
  }
});

export default SetSchoolLocationScreen;
