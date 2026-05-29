import {
  ref,
  onValue,
} from 'firebase/database';

import { db } from '../../firebaseConfig';

export const subscribeToDriverInfo = (

  schoolId,

  driverId,

  onDriverUpdate

) => {

  const driverRef = ref(
    db,
    `schools/${schoolId}/drivers/${driverId}`
  );

  return onValue(

    driverRef,

    (snapshot) => {

      onDriverUpdate(
        snapshot.val()
      );

    }
  );

};

export const subscribeToStaffInfo = (

  schoolId,

  driverId,

  onStaffUpdate

) => {

  const staffRef = ref(
    db,
    `schools/${schoolId}/staff`
  );

  return onValue(

    staffRef,

    (snapshot) => {

      const data = snapshot.val();

      if (!data) {

        onStaffUpdate(null);

        return;

      }

      const matchedStaff =
        Object.values(data).find(

          (staff) =>

            staff.driverUsername ===
              driverId ||

            staff.driver_id ===
              driverId
        );

      onStaffUpdate(
        matchedStaff || null
      );

    }
  );

};

export const subscribeToBusLocation = (

  schoolId,

  driverId,

  onBusUpdate

) => {

  const busRef = ref(
    db,
    `schools/${schoolId}/bus/${driverId}`
  );

  return onValue(

    busRef,

    (snapshot) => {

      const busData =
        snapshot.val();

      if (

        !busData ||

        !busData.isActive ||

        !busData.latitude ||

        !busData.longitude

      ) {

        onBusUpdate(null);

        return;

      }

      const location = {

        latitude: parseFloat(
          busData.latitude
        ),

        longitude: parseFloat(
          busData.longitude
        ),

      };

      if (

        isNaN(location.latitude) ||

        isNaN(location.longitude)

      ) {

        return;

      }

      onBusUpdate(location);

    }
  );

};