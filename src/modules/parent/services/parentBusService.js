import { ref, onValue } from 'firebase/database';
import { db } from '../../../firebaseConfig';

export const subscribeToDriverInfo = (schoolId, driverId, callback) => {
  const driverRef = ref(db, `schools/${schoolId}/drivers/${driverId}`);
  return onValue(driverRef, (snapshot) => {
    callback(snapshot.val());
  });
};

export const subscribeToStaffInfo = (schoolId, driverId, callback) => {
  const staffRef = ref(db, `schools/${schoolId}/staff`);
  return onValue(staffRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const staffMember = Object.values(data).find(
        (staff) => staff.driverUsername === driverId || staff.driver_id === driverId
      );
      callback(staffMember || null);
    } else {
      callback(null);
    }
  });
};

export const subscribeToBusLocation = (schoolId, driverId, callback) => {
  const busRef = ref(db, `schools/${schoolId}/bus/${driverId}`);
  return onValue(busRef, (snapshot) => {
    const busData = snapshot.val();
    if (busData && busData.isActive && busData.latitude && busData.longitude) {
      callback({
        latitude: parseFloat(busData.latitude),
        longitude: parseFloat(busData.longitude),
        speed: busData.speed || 0,
      });
    } else {
      callback(null);
    }
  });
};
