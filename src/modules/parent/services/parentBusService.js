import {
  ref,
  onValue,
} from 'firebase/database';

import { db } from '../../../firebaseConfig';

export const subscribeToDriverInfo = (
  schoolId,
  driverId,
  onDriverFound
) => {

  const driverRef = ref(
    db,
    `schools/${schoolId}/drivers/${driverId}`
  );

  return onValue(

    driverRef,

    (snapshot) => {

      onDriverFound(
        snapshot.val()
      );

    },

    (error) => {

      console.log(
        'Driver service error:',
        error
      );

    }

  );

};

export const subscribeToStaffInfo = (
  schoolId,
  driverId,
  onStaffFound
) => {

  const staffRef = ref(
    db,
    `schools/${schoolId}/staff`
  );

  return onValue(

    staffRef,

    (snapshot) => {

      const data =
        snapshot.val();

      if (data) {

        const staffMember =
          Object.values(data).find(

            (staff) =>

              staff.driverUsername ===
                driverId ||

              staff.driver_id ===
                driverId

          );

        onStaffFound(
          staffMember || null
        );

      }

    },

    (error) => {

      console.log(
        'Staff service error:',
        error
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

        busData &&
        busData.isActive &&
        busData.latitude &&
        busData.longitude

      ) {

        onBusUpdate({

          latitude:
            parseFloat(
              busData.latitude
            ),

          longitude:
            parseFloat(
              busData.longitude
            ),

          speed:
            busData.speed || 0,

        });

      } else {

        onBusUpdate(null);

      }

    },

    (error) => {

      console.log(
        'Bus service error:',
        error
      );

    }

  );

};