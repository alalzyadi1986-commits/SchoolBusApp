import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { getTripDetails } from '../services/tripService';

const TripMapScreen = ({ route, navigation }) => {
  const { tripId, schoolId } = route.params;
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // تتبع تفاصيل الرحلة والموقع بشكل حي
    const unsubscribe = getTripDetails(schoolId, tripId, (data) => {
      setTripData(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tripId, schoolId]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1E293B" />
        <Text style={styles.loadingText}>جاري فتح الخريطة...</Text>
      </View>
    );
  }

  // إحداثيات افتراضية في حال عدم توفر موقع (مثلاً وسط مكة المكرمة)
  const initialRegion = {
    latitude: tripData?.location?.latitude || 21.4225,
    longitude: tripData?.location?.longitude || 39.8262,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>تتبع مباشر - حافلة {tripData?.busNumber || '...'}</Text>
          <Text style={styles.headerSubtitle}>السائق: {tripData?.driverName || '...'}</Text>
        </View>
      </View>

      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={true}
        region={tripData?.location ? {
          latitude: tripData.location.latitude,
          longitude: tripData.location.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        } : initialRegion}
      >
        {tripData?.location && (
          <Marker
            coordinate={{
              latitude: tripData.location.latitude,
              longitude: tripData.location.longitude,
            }}
            title={`حافلة ${tripData.busNumber}`}
            description={`الطلاب: ${tripData.currentStudentsCount || 0}`}
          >
            <View style={styles.markerContainer}>
              <View style={styles.busMarker}>
                <Ionicons name="bus" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.markerArrow} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* بطاقة معلومات عائمة */}
      <View style={styles.floatingCard}>
        <View style={styles.cardRow}>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>عدد الطلاب</Text>
            <Text style={styles.cardValue}>{tripData?.currentStudentsCount || 0}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>الحالة</Text>
            <View style={styles.statusRow}>
              <View style={styles.pulseDot} />
              <Text style={[styles.cardValue, { color: '#10B981' }]}>متصل</Text>
            </View>
          </View>
        </View>
      </View>
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
    padding: 15,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    marginLeft: 15,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  busMarker: {
    backgroundColor: '#1E293B',
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#1E293B',
    transform: [{ rotate: '180deg' }],
    marginTop: -2,
  },
  floatingCard: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  cardRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  cardItem: {
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  statusRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginLeft: 6,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: '#F1F5F9',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
  }
});

export default TripMapScreen;
