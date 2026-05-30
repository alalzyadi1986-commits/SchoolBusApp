import { ref, onValue, off, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../../../config/firebase';

/**
 * خدمة مراقبة الرحلات النشطة
 */

export const subscribeToActiveTrips = (schoolId, callback) => {
  if (!schoolId) return () => {};

  // الرحلات يتم تخزينها تحت مسار trips/[schoolId]
  const tripsRef = ref(db, `trips/${schoolId}`);
  
  // تصفية الرحلات التي حالتها 'active' فقط
  const activeTripsQuery = query(
    tripsRef,
    orderByChild('status'),
    equalTo('active')
  );

  const listener = onValue(activeTripsQuery, (snapshot) => {
    const trips = [];
    snapshot.forEach((childSnapshot) => {
      trips.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    callback(trips);
  }, (error) => {
    console.error("Active Trips Subscription Error:", error);
  });

  // إرجاع دالة لإلغاء الاشتراك عند مغادرة الشاشة
  return () => off(activeTripsQuery, 'value', listener);
};

export const getTripDetails = (schoolId, tripId, callback) => {
  const tripRef = ref(db, `trips/${schoolId}/${tripId}`);
  return onValue(tripRef, (snapshot) => {
    callback(snapshot.val());
  });
};
