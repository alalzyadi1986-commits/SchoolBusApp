import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebaseConfig';

/**
 * Hook مخصص لجلب قائمة بيانات من Firebase Realtime Database
 * @param {string} path - المسار في قاعدة البيانات
 * @returns {Array} data - مصفوفة البيانات
 * @returns {boolean} loading - حالة التحميل
 */
export function useFirebaseList(path) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) return;

    const dataRef = ref(db, path);
    const unsubscribe = onValue(dataRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const list = Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
        setData(list);
      } else {
        setData([]);
      }
      setLoading(false);
    }, (error) => {
      console.error(`Firebase Hook Error (${path}):`, error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [path]);

  return [data, loading];
}
