import React from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export default function StudentItem({
  student,
  onCallParent,
}) {

  return (

    <View style={styles.studentItem}>

      <TouchableOpacity
        style={styles.callBtn}
        onPress={() =>
          onCallParent(
            student.parentPhone ||
            student.parent_username
          )
        }
      >

        <Text style={styles.callBtnText}>
          📞 اتصل
        </Text>

      </TouchableOpacity>

      <View style={{ alignItems: 'flex-end' }}>

        <Text style={styles.studentName}>
          {student.name}
        </Text>

        <Text style={styles.studentSub}>

          {student.class} -

          {
            student.status === 'present'
              ? ' ✅ داخل الباص'
              : ' ⏳ ينتظر'
          }

        </Text>

      </View>

    </View>

  );

}

const styles = StyleSheet.create({

  studentItem: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
  },

  studentName: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  studentSub: {
    fontSize: 12,
    color: '#64748B',
  },

  callBtn: {
    backgroundColor: '#3B82F6',
    padding: 8,
    borderRadius: 8,
  },

  callBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

});