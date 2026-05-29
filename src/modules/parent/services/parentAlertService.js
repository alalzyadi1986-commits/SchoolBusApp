import { Alert } from 'react-native';

import { calculateDistance }
  from '../../../utils/geo';

export const checkBusArrivalAlert = ({

  busLocation,

  parentLocation,

  alertMinutes,

  notified,

  studentStatus,

  onNotify,

  onReset,

}) => {

  if (

    !busLocation ||
    !parentLocation

  ) return;

  const distance =
    calculateDistance(

      busLocation.latitude,
      busLocation.longitude,

      parentLocation.latitude,
      parentLocation.longitude

    );

  const alertThreshold =
    alertMinutes * 0.5;

  if (

    distance <
      alertThreshold &&

    !notified &&

    studentStatus !==
      'absent_today'

  ) {

    Alert.alert(

      '🔔 تنبيه وصول الباص 🚌',

      `الباص على بعد حوالي ${distance.toFixed(
        1
      )} كم من موقعك وسيصل قريباً.`

    );

    onNotify?.();

  }

  else if (

    distance >
    alertThreshold + 0.5

  ) {

    onReset?.();

  }

};