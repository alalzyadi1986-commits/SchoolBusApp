import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { subscribeToActiveTrips } from '../services/tripService';

const ActiveTripsScreen = ({ route, navigation }) => {
  const { schoolId, schoolName } = route.params;
  const [loading, setLoading] = useState(true);
  const [activeTrips, setActiveTrips] = useState([]);

  useEffect(() => {
    // الاشتراك في تحديثات الرحلات الحية
    const unsubscribe = subscribeToActiveTrips(schoolId, (trips) => {
      setActiveTrips(trips);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId]);

  const renderTripItem = ({ item }) => (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <View style={styles.busInfo}>
          <View style={styles.busIconContainer}>
            <Ionicons name="bus" size={24} color="#1E293B" />
          </View>
          <View>
            <Text style={styles.busNumber}>حافلة رقم: {item.busNumber || 'N/A'}</Text>
            <Text style={styles.driverName}>السائق: {item.driverName || 'غير معروف'}</Text>
          </View>
        </View>
        <View style={styles.statusBadge}>
          <View style={styles.pulseDot} />
          <Text style={styles.statusText}>نشط الآن</Text>
        </View>
      </View>

      <View style={styles.tripDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="people" size={18} color="#64748B" />
          <Text style={styles.detailLabel}>الطلاب حالياً:</Text>
          <Text style={styles.detailValue}>{item.currentStudentsCount || 0}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time" size={18} color="#64748B" />
          <Text style={styles.detailLabel}>وقت البدء:</Text>
          <Text style={styles.detailValue}>{item.startTime ? new Date(item.startTime).toLocaleTimeString('ar-EG') : '--:--'}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.trackButton}
        onPress={() => navigation.navigate('TripMap', { tripId: item.id, schoolId })}
      >
        <Text style={styles.trackButtonText}>تتبع المسار المباشر</Text>
        <Ionicons name="map-outline" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>مراقبة الرحلات النشطة</Text>
          <Text style={styles.headerSubtitle}>{schoolName}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1E293B" />
          <Text style={styles.loadingText}>جاري جلب الرحلات الحية...</Text>
        </View>
      ) : activeTrips.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="bus-outline" size={64} color="#CBD5E1" />
          </View>
          <Text style={styles.emptyTitle}>لا توجد رحلات نشطة حالياً</Text>
          <Text style={styles.emptySubtitle}>ستظهر الرحلات هنا بمجرد أن يبدأ السائقون المسار</Text>
        </View>
      ) : (
        <FlatList
          data={activeTrips}
          renderItem={renderTripItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'right',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'right',
  },
  listContent: {
    padding: 15,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  busInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  busIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  busNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'right',
  },
  driverName: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
  },
  statusBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginLeft: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#059669',
  },
  tripDetails: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 15,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  trackButton: {
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  trackButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginRight: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
  },
  emptyIconContainer: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  }
});

export default ActiveTripsScreen;
