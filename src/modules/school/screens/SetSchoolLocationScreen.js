import React, { useState, useEffect } from 'react';
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
  Platform
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { updateSchoolLocation } from '../services/schoolDataService';

const SetSchoolLocationScreen = ({ route, navigation }) => {
  const { schoolId, currentInfo } = route.params;
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [region, setRegion] = useState({
    latitude: currentInfo?.location?.latitude || 24.7136, // الرياض افتراضياً
    longitude: currentInfo?.location?.longitude || 46.6753,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [selectedLocation, setSelectedLocation] = useState(currentInfo?.location || null);
  const [googleMapsLink, setGoogleMapsLink] = useState('');

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه', 'يرجى تفعيل صلاحيات الموقع لتحديد موقع المدرسة بسهولة');
        return;
      }

      if (!currentInfo?.location) {
        let location = await Location.getCurrentPositionAsync({});
        const newRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        setRegion(newRegion);
        setSelectedLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    })();
  }, []);

  const handleMapPress = (e) => {
    setSelectedLocation(e.nativeEvent.coordinate);
  };

  const parseGoogleMapsLink = () => {
    if (!googleMapsLink.trim()) return;
    
    // محاولة استخراج الإحداثيات من الرابط (يدعم الروابط التي تحتوي على @lat,lng)
    const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = googleMapsLink.match(regex);
    
    if (match && match.length >= 3) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      const newLoc = { latitude: lat, longitude: lng };
      setSelectedLocation(newLoc);
      setRegion({
        ...region,
        latitude: lat,
        longitude: lng,
      });
      Alert.alert('تم', 'تم استخراج الموقع من الرابط بنجاح');
    } else {
      Alert.alert('خطأ', 'لم نتمكن من التعرف على الإحداثيات في هذا الرابط. يرجى التأكد من أنه رابط خرائط جوجل صحيح.');
    }
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
        addressLink: googleMapsLink || null
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
          <Text style={styles.infoText}>يمكنك لصق رابط خرائط جوجل هنا لاستخراج الموقع آلياً:</Text>
          <View style={styles.searchInputContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="https://maps.google.com/..."
              value={googleMapsLink}
              onChangeText={setGoogleMapsLink}
            />
            <TouchableOpacity style={styles.parseButton} onPress={parseGoogleMapsLink}>
              <Text style={styles.parseButtonText}>استخراج</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.mapContainer}>
          <Text style={styles.instructionText}>أو اضغط مطولاً على الخريطة لتحديد الموقع يدوياً:</Text>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            region={region}
            onRegionChangeComplete={setRegion}
            onPress={handleMapPress}
            onMapReady={() => setMapReady(true)}
          >
            {selectedLocation && (
              <Marker 
                coordinate={selectedLocation} 
                title="موقع المدرسة"
                pinColor="#1E293B"
              />
            )}
          </MapView>
          
          <TouchableOpacity 
            style={styles.myLocationBtn}
            onPress={async () => {
              let location = await Location.getCurrentPositionAsync({});
              setRegion({
                ...region,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
              setSelectedLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
            }}
          >
            <Ionicons name="locate" size={24} color="#1E293B" />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.saveButton, loading && styles.disabledButton]} 
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.saveButtonText}>حفظ موقع المدرسة</Text>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
    padding: 15,
    backgroundColor: '#FFFFFF',
  },
  infoText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
    textAlign: 'right',
  },
  searchInputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 45,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 15,
    textAlign: 'right',
    fontSize: 12,
  },
  parseButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 15,
    height: 45,
    borderRadius: 10,
    justifyContent: 'center',
    marginRight: 10,
  },
  parseButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  instructionText: {
    fontSize: 12,
    color: '#1E293B',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 8,
    textAlign: 'center',
    zIndex: 5,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  myLocationBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 10,
  },
  disabledButton: {
    opacity: 0.7,
  }
});

export default SetSchoolLocationScreen;
